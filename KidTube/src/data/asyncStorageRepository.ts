/** Device persistence backed by AsyncStorage (single JSON blob per collection). */

import AsyncStorage from '@react-native-async-storage/async-storage';
import type {
  Channel,
  ChannelProposal,
  Decision,
  ExtraTimePool,
  PinGuardState,
  Settings,
  Video,
  VideoStatus,
  WatchHistoryEntry,
  WatchProgress,
} from '../domain/types';
import { DEFAULT_SETTINGS } from '../domain/types';
import { statusForOutcome } from '../domain/decisions';
import type { Repository } from './repository';

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

async function readJson<T>(key: string, fallback: T): Promise<T> {
  try {
    const raw = await AsyncStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
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
    channels.forEach(c => this.channels.set(c.id, c));
    (channelProposals ?? []).forEach(p => this.channelProposals.set(p.id, p));
    videos.forEach(v => this.videos.set(v.id, v));
    this.decisions = [...(decisions ?? [])];
    Object.entries(usage ?? {}).forEach(([key, seconds]) => this.usage.set(key, seconds));
    (watchProgress ?? []).forEach(p => this.watchProgress.set(p.videoId, p));
    this.watchHistory = [...(watchHistory ?? [])];
    this.extraTime = extraTime;
    this.pinGuard = pinGuard ?? { failedAttempts: 0 };
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
    this.decisions.push(decision);
    const video = this.videos.get(decision.videoId);
    if (video) {
      this.videos.set(video.id, { ...video, status: statusForOutcome(decision.outcome) });
      await Promise.all([this.persistDecisions(), this.persistVideos()]);
    } else {
      await this.persistDecisions();
    }
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
