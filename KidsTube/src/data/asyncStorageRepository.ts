/** Device persistence backed by AsyncStorage (single JSON blob per collection). */

import AsyncStorage from '@react-native-async-storage/async-storage';
import type {
  Channel,
  ChannelProposal,
  DatabaseSnapshot,
  Decision,
  ExtraTimePool,
  PinGuardState,
  PinRecord,
  Settings,
  Video,
  VideoStatus,
  WatchHistoryEntry,
  WatchProgress,
} from '../domain/types';
import { DEFAULT_SETTINGS } from '../domain/types';
import { statusForOutcome } from '../domain/decisions';
import type { Repository } from './repository';
import {
  clearPinRecordSecurely,
  loadPinRecordSecurely,
  savePinRecordSecurely,
} from '../native/pinStorage';

const KEYS = {
  settings: '@kidtube/settings/v1',
  channels: '@kidtube/channels/v1',
  channelProposals: '@kidtube/channel-proposals/v1',
  videos: '@kidtube/videos/v1',
  decisions: '@kidtube/decisions/v1',
  usage: '@kidtube/usage/v1',
  watchProgress: '@kidtube/watch-progress/v1',
  watchHistory: '@kidtube/watch-history/v1',
  extraTime: '@kidtube/extra-time/v1',
  pinGuard: '@kidtube/pin-guard/v1',
};

/** Markers of an in-flight whole-database replace (ADR 0017). */
const REPLACE_KEYS = {
  pending: '@kidtube/replace-pending/v1',
  rollback: '@kidtube/replace-rollback/v1',
};

async function readJson<T>(key: string, fallback: T): Promise<T> {
  try {
    const raw = await AsyncStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function legacyPinRecord(settings: Settings): PinRecord | undefined {
  if (settings.pinHash && settings.pinSalt && settings.pinIterations) {
    return {
      hash: settings.pinHash,
      salt: settings.pinSalt,
      iterations: settings.pinIterations,
    };
  }
  return undefined;
}

/** Remove the pre-ADR 0022 plaintext PIN fields from a settings object. */
function stripLegacyPin(settings: Settings): void {
  delete settings.pinHash;
  delete settings.pinSalt;
  delete settings.pinIterations;
}

export class AsyncStorageRepository implements Repository {
  private channels = new Map<string, Channel>();
  private channelProposals = new Map<string, ChannelProposal>();
  private videos = new Map<string, Video>();
  private decisions: Decision[] = [];
  private usage = new Map<string, number>();
  private watchProgress = new Map<string, WatchProgress>();
  private watchHistory: WatchHistoryEntry[] = [];
  private extraTime?: ExtraTimePool;
  private pinGuard: PinGuardState = { failedAttempts: 0 };
  private pinRecord?: PinRecord;
  private settings: Settings = { ...DEFAULT_SETTINGS };
  private loaded = false;

  async init(): Promise<void> {
    if (this.loaded) {
      return;
    }
    const [
      settings,
      channels,
      channelProposals,
      videos,
      decisions,
      usage,
      watchProgress,
      watchHistory,
      extraTime,
      pinGuard,
    ] = await Promise.all([
      readJson<Settings>(KEYS.settings, { ...DEFAULT_SETTINGS }),
      readJson<Channel[]>(KEYS.channels, []),
      readJson<ChannelProposal[]>(KEYS.channelProposals, []),
      readJson<Video[]>(KEYS.videos, []),
      readJson<Decision[]>(KEYS.decisions, []),
      readJson<Record<string, number>>(KEYS.usage, {}),
      readJson<WatchProgress[]>(KEYS.watchProgress, []),
      readJson<WatchHistoryEntry[]>(KEYS.watchHistory, []),
      readJson<ExtraTimePool | undefined>(KEYS.extraTime, undefined),
      readJson<PinGuardState>(KEYS.pinGuard, { failedAttempts: 0 }),
    ]);
    this.settings = { ...DEFAULT_SETTINGS, ...settings };
    const legacyPin = legacyPinRecord(this.settings);
    stripLegacyPin(this.settings);
    channels.forEach(c => this.channels.set(c.id, c));
    (channelProposals ?? []).forEach(p => this.channelProposals.set(p.id, p));
    videos.forEach(v => this.videos.set(v.id, v));
    this.decisions = [...(decisions ?? [])];
    Object.entries(usage ?? {}).forEach(([key, seconds]) => this.usage.set(key, seconds));
    (watchProgress ?? []).forEach(p => this.watchProgress.set(p.videoId, p));
    this.watchHistory = [...(watchHistory ?? [])];
    this.extraTime = extraTime ?? undefined;
    this.pinGuard = pinGuard ?? { failedAttempts: 0 };
    await this.finishInterruptedReplace();

    // ADR 0022: move a legacy PIN record out of AsyncStorage into the
    // Keystore-backed store. If secure storage is unavailable, keep the old
    // fields in AsyncStorage so the parent is never locked out.
    const securePin = await loadPinRecordSecurely();
    if (securePin) {
      this.pinRecord = securePin;
      await this.persistSettings();
    } else if (legacyPin) {
      this.pinRecord = legacyPin;
      const saved = await savePinRecordSecurely(legacyPin);
      if (saved) {
        await this.persistSettings();
      } else {
        this.writeLegacyPin(legacyPin);
        await this.persistSettings();
      }
    }
    this.loaded = true;
  }

  private async persistChannels(): Promise<void> {
    await AsyncStorage.setItem(KEYS.channels, JSON.stringify([...this.channels.values()]));
  }

  private async persistChannelProposals(): Promise<void> {
    await AsyncStorage.setItem(
      KEYS.channelProposals,
      JSON.stringify([...this.channelProposals.values()]),
    );
  }

  private async persistVideos(): Promise<void> {
    await AsyncStorage.setItem(KEYS.videos, JSON.stringify([...this.videos.values()]));
  }

  private async persistSettings(): Promise<void> {
    await AsyncStorage.setItem(KEYS.settings, JSON.stringify(this.settings));
  }

  private async persistUsage(): Promise<void> {
    await AsyncStorage.setItem(KEYS.usage, JSON.stringify(Object.fromEntries(this.usage)));
  }

  private async persistDecisions(): Promise<void> {
    await AsyncStorage.setItem(KEYS.decisions, JSON.stringify(this.decisions));
  }

  private async persistWatchProgress(): Promise<void> {
    await AsyncStorage.setItem(KEYS.watchProgress, JSON.stringify([...this.watchProgress.values()]));
  }

  private async persistWatchHistory(): Promise<void> {
    await AsyncStorage.setItem(KEYS.watchHistory, JSON.stringify(this.watchHistory));
  }

  async snapshotAll(): Promise<DatabaseSnapshot> {
    return {
      settings: { ...this.settings },
      channels: [...this.channels.values()].map(channel => ({ ...channel })),
      channelProposals: [...this.channelProposals.values()].map(proposal => ({ ...proposal })),
      videos: [...this.videos.values()].map(video => ({ ...video })),
      decisions: this.decisions.map(decision => ({ ...decision })),
      usage: Object.fromEntries(this.usage),
      watchProgress: [...this.watchProgress.values()].map(progress => ({ ...progress })),
      watchHistory: this.watchHistory.map(entry => ({ ...entry })),
      extraTime: this.extraTime ? { ...this.extraTime } : null,
    };
  }

  private entries(snapshot: DatabaseSnapshot): Record<string, string> {
    return Object.fromEntries(this.serialize(snapshot));
  }

  private serialize(snapshot: DatabaseSnapshot): [string, string][] {
    return [
      [KEYS.settings, JSON.stringify(snapshot.settings)],
      [KEYS.channels, JSON.stringify(snapshot.channels)],
      [KEYS.channelProposals, JSON.stringify(snapshot.channelProposals)],
      [KEYS.videos, JSON.stringify(snapshot.videos)],
      [KEYS.decisions, JSON.stringify(snapshot.decisions)],
      [KEYS.usage, JSON.stringify(snapshot.usage)],
      [KEYS.watchProgress, JSON.stringify(snapshot.watchProgress)],
      [KEYS.watchHistory, JSON.stringify(snapshot.watchHistory)],
      [KEYS.extraTime, JSON.stringify(snapshot.extraTime)],
    ];
  }

  private apply(snapshot: DatabaseSnapshot): void {
    this.settings = { ...DEFAULT_SETTINGS, ...snapshot.settings };
    stripLegacyPin(this.settings);
    this.channels = new Map(snapshot.channels.map(channel => [channel.id, channel]));
    this.channelProposals = new Map(
      snapshot.channelProposals.map(proposal => [proposal.id, proposal]),
    );
    this.videos = new Map(snapshot.videos.map(video => [video.id, video]));
    this.decisions = [...snapshot.decisions];
    this.usage = new Map(Object.entries(snapshot.usage));
    this.watchProgress = new Map(
      snapshot.watchProgress.map(progress => [progress.videoId, progress]),
    );
    this.watchHistory = [...snapshot.watchHistory];
    this.extraTime = snapshot.extraTime ? { ...snapshot.extraTime } : undefined;
  }

  async replaceAll(snapshot: DatabaseSnapshot): Promise<void> {
    const previous = await this.snapshotAll();
    try {
      // The markers make a crash mid-replace recoverable: on the next start the
      // pending snapshot is either finished or replaced by the rollback copy.
      await AsyncStorage.setItem(REPLACE_KEYS.pending, JSON.stringify(snapshot));
      await AsyncStorage.setItem(REPLACE_KEYS.rollback, JSON.stringify(previous));
      await AsyncStorage.setMany(this.entries(snapshot));
      await AsyncStorage.removeMany([REPLACE_KEYS.pending, REPLACE_KEYS.rollback]);
      this.apply(snapshot);
    } catch (error) {
      try {
        await AsyncStorage.setMany(this.entries(previous));
        this.apply(previous);
      } catch {
        // Storage is failing; keep the markers for the next start.
        throw error;
      }
      await AsyncStorage.removeMany([REPLACE_KEYS.pending, REPLACE_KEYS.rollback]).catch(
        () => undefined,
      );
      throw error;
    }
  }

  private async finishInterruptedReplace(): Promise<void> {
    const pending = await readJson<DatabaseSnapshot | null>(REPLACE_KEYS.pending, null);
    if (!pending) {
      return;
    }
    try {
      await AsyncStorage.setMany(this.entries(pending));
      this.apply(pending);
    } catch {
      const rollback = await readJson<DatabaseSnapshot | null>(REPLACE_KEYS.rollback, null);
      if (rollback) {
        try {
          await AsyncStorage.setMany(this.entries(rollback));
        } catch {
          // Keep the markers: the next start can try again.
          return;
        }
        this.apply(rollback);
      }
    }
    await AsyncStorage.removeMany([REPLACE_KEYS.pending, REPLACE_KEYS.rollback]).catch(
      () => undefined,
    );
  }

  async getSettings(): Promise<Settings> {
    return { ...this.settings };
  }

  async updateSettings(patch: Partial<Settings>): Promise<Settings> {
    this.settings = { ...this.settings, ...patch };
    await this.persistSettings();
    return { ...this.settings };
  }

  async listChannels(): Promise<Channel[]> {
    return [...this.channels.values()].sort((a, b) => a.title.localeCompare(b.title));
  }

  async getChannel(id: string): Promise<Channel | undefined> {
    return this.channels.get(id);
  }

  async upsertChannel(channel: Channel): Promise<void> {
    this.channels.set(channel.id, channel);
    await this.persistChannels();
  }

  async removeChannel(id: string): Promise<void> {
    this.channels.delete(id);
    for (const [videoId, video] of this.videos) {
      if (video.channelId === id) {
        this.videos.delete(videoId);
      }
    }
    await Promise.all([this.persistChannels(), this.persistVideos()]);
  }

  async listChannelProposals(): Promise<ChannelProposal[]> {
    return [...this.channelProposals.values()].sort((a, b) => b.addedAt - a.addedAt);
  }

  async getChannelProposal(id: string): Promise<ChannelProposal | undefined> {
    return this.channelProposals.get(id);
  }

  async upsertChannelProposal(proposal: ChannelProposal): Promise<void> {
    this.channelProposals.set(proposal.id, proposal);
    await this.persistChannelProposals();
  }

  async removeChannelProposal(id: string): Promise<void> {
    this.channelProposals.delete(id);
    await this.persistChannelProposals();
  }

  async listVideos(): Promise<Video[]> {
    return [...this.videos.values()];
  }

  async getVideo(id: string): Promise<Video | undefined> {
    return this.videos.get(id);
  }

  async upsertVideos(videos: Video[]): Promise<void> {
    videos.forEach(v => this.videos.set(v.id, v));
    await this.persistVideos();
  }

  async setVideoStatus(id: string, status: VideoStatus): Promise<void> {
    const video = this.videos.get(id);
    if (video) {
      this.videos.set(id, { ...video, status });
      await this.persistVideos();
    }
  }

  async removeVideo(id: string): Promise<void> {
    this.videos.delete(id);
    await this.persistVideos();
  }

  async listPendingVideos(): Promise<Video[]> {
    return [...this.videos.values()].filter(v => v.status === 'pending');
  }

  async listDecisions(): Promise<Decision[]> {
    return [...this.decisions];
  }

  async recordDecision(decision: Decision): Promise<void> {
    await this.recordDecisions([decision]);
  }

  async recordDecisions(decisions: Decision[]): Promise<void> {
    if (decisions.length === 0) {
      return;
    }
    let videosTouched = false;
    for (const decision of decisions) {
      this.decisions.push(decision);
      const video = this.videos.get(decision.videoId);
      if (video) {
        this.videos.set(video.id, { ...video, status: statusForOutcome(decision.outcome) });
        videosTouched = true;
      }
    }
    // One write per collection instead of one per decision: bulk actions on a
    // channel with hundreds of films must not hammer AsyncStorage.
    await Promise.all([
      this.persistDecisions(),
      videosTouched ? this.persistVideos() : Promise.resolve(),
    ]);
  }

  async getUsage(dateKey: string): Promise<number> {
    return this.usage.get(dateKey) ?? 0;
  }

  async addUsageSeconds(dateKey: string, seconds: number): Promise<void> {
    this.usage.set(dateKey, (this.usage.get(dateKey) ?? 0) + seconds);
    await this.persistUsage();
  }

  async resetUsage(dateKey: string): Promise<void> {
    this.usage.delete(dateKey);
    await this.persistUsage();
  }

  async getExtraTime(): Promise<ExtraTimePool | undefined> {
    return this.extraTime ? { ...this.extraTime } : undefined;
  }

  async saveExtraTime(pool: ExtraTimePool): Promise<void> {
    this.extraTime = { ...pool };
    await AsyncStorage.setItem(KEYS.extraTime, JSON.stringify(this.extraTime));
  }

  async getPinGuard(): Promise<PinGuardState> {
    return { ...this.pinGuard };
  }

  async savePinGuard(state: PinGuardState): Promise<void> {
    this.pinGuard = { ...state };
    await AsyncStorage.setItem(KEYS.pinGuard, JSON.stringify(this.pinGuard));
  }

  async getPinRecord(): Promise<PinRecord | undefined> {
    if (this.pinRecord) {
      return { ...this.pinRecord };
    }
    const secure = await loadPinRecordSecurely();
    if (secure) {
      this.pinRecord = secure;
      return { ...secure };
    }
    return legacyPinRecord(this.settings);
  }

  async savePinRecord(record: PinRecord): Promise<boolean> {
    const saved = await savePinRecordSecurely(record);
    this.pinRecord = { ...record };
    if (saved) {
      stripLegacyPin(this.settings);
    } else {
      // Last-resort fallback for environments without the native module: keep
      // the old hash fields so the app still starts. On Android the module is
      // always present, so this branch is not used on device.
      this.writeLegacyPin(record);
    }
    await this.persistSettings();
    return saved;
  }

  async clearPinRecord(): Promise<boolean> {
    const cleared = await clearPinRecordSecurely();
    this.pinRecord = undefined;
    stripLegacyPin(this.settings);
    await this.persistSettings();
    return cleared;
  }

  private writeLegacyPin(record: PinRecord): void {
    this.settings.pinHash = record.hash;
    this.settings.pinSalt = record.salt;
    this.settings.pinIterations = record.iterations;
  }

  async getWatchProgress(videoId: string): Promise<WatchProgress | undefined> {
    return this.watchProgress.get(videoId);
  }

  async listWatchProgress(): Promise<WatchProgress[]> {
    return [...this.watchProgress.values()];
  }

  async saveWatchProgress(progress: WatchProgress): Promise<void> {
    this.watchProgress.set(progress.videoId, progress);
    await this.persistWatchProgress();
  }

  async listWatchHistory(): Promise<WatchHistoryEntry[]> {
    return [...this.watchHistory];
  }

  async getWatchHistoryEntry(
    videoId: string,
    dateKey: string,
  ): Promise<WatchHistoryEntry | undefined> {
    return this.watchHistory.find(e => e.videoId === videoId && e.dateKey === dateKey);
  }

  async saveWatchHistory(entry: WatchHistoryEntry): Promise<void> {
    const index = this.watchHistory.findIndex(
      e => e.videoId === entry.videoId && e.dateKey === entry.dateKey,
    );
    if (index >= 0) {
      this.watchHistory[index] = entry;
    } else {
      this.watchHistory.push(entry);
    }
    await this.persistWatchHistory();
  }
}
