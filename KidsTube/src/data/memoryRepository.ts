/** In-memory Repository used by tests, previews and the first-run demo mode. */

import type {
  Channel,
  ChannelProposal,
  DatabaseSnapshot,
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

export class MemoryRepository implements Repository {
  private settings: Settings;
  private channels = new Map<string, Channel>();
  private channelProposals = new Map<string, ChannelProposal>();
  private videos = new Map<string, Video>();
  private decisions: Decision[] = [];
  private usage = new Map<string, number>();
  private watchProgress = new Map<string, WatchProgress>();
  private watchHistory: WatchHistoryEntry[] = [];
  private extraTime?: ExtraTimePool;
  private pinGuard: PinGuardState = { failedAttempts: 0 };

  constructor(seed?: {
    settings?: Settings;
    channels?: Channel[];
    channelProposals?: ChannelProposal[];
    videos?: Video[];
    decisions?: Decision[];
    usage?: Record<string, number>;
    watchProgress?: WatchProgress[];
    watchHistory?: WatchHistoryEntry[];
  }) {
    this.settings = { ...DEFAULT_SETTINGS, ...seed?.settings };
    seed?.channels?.forEach(c => this.channels.set(c.id, c));
    seed?.channelProposals?.forEach(p => this.channelProposals.set(p.id, p));
    seed?.videos?.forEach(v => this.videos.set(v.id, v));
    this.decisions = [...(seed?.decisions ?? [])];
    Object.entries(seed?.usage ?? {}).forEach(([key, seconds]) => this.usage.set(key, seconds));
    seed?.watchProgress?.forEach(p => this.watchProgress.set(p.videoId, p));
    this.watchHistory = [...(seed?.watchHistory ?? [])];
  }

  async init(): Promise<void> {}

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

  async replaceAll(snapshot: DatabaseSnapshot): Promise<void> {
    this.settings = { ...DEFAULT_SETTINGS, ...snapshot.settings };
    this.channels = new Map(snapshot.channels.map(channel => [channel.id, channel]));
    this.channelProposals = new Map(
      snapshot.channelProposals.map(proposal => [proposal.id, proposal]),
    );
    this.videos = new Map(snapshot.videos.map(video => [video.id, video]));
    this.decisions = [...snapshot.decisions];
    this.usage = new Map(Object.entries(snapshot.usage));
    this.watchProgress = new Map(snapshot.watchProgress.map(progress => [progress.videoId, progress]));
    this.watchHistory = [...snapshot.watchHistory];
    this.extraTime = snapshot.extraTime ? { ...snapshot.extraTime } : undefined;
  }

  async getSettings(): Promise<Settings> {
    return { ...this.settings };
  }

  async updateSettings(patch: Partial<Settings>): Promise<Settings> {
    this.settings = { ...this.settings, ...patch };
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
  }

  async removeChannel(id: string): Promise<void> {
    this.channels.delete(id);
    for (const [videoId, video] of this.videos) {
      if (video.channelId === id) {
        this.videos.delete(videoId);
      }
    }
  }

  async listChannelProposals(): Promise<ChannelProposal[]> {
    return [...this.channelProposals.values()].sort((a, b) => b.addedAt - a.addedAt);
  }

  async getChannelProposal(id: string): Promise<ChannelProposal | undefined> {
    return this.channelProposals.get(id);
  }

  async upsertChannelProposal(proposal: ChannelProposal): Promise<void> {
    this.channelProposals.set(proposal.id, proposal);
  }

  async removeChannelProposal(id: string): Promise<void> {
    this.channelProposals.delete(id);
  }

  async listVideos(): Promise<Video[]> {
    return [...this.videos.values()];
  }

  async getVideo(id: string): Promise<Video | undefined> {
    return this.videos.get(id);
  }

  async upsertVideos(videos: Video[]): Promise<void> {
    videos.forEach(v => this.videos.set(v.id, v));
  }

  async setVideoStatus(id: string, status: VideoStatus): Promise<void> {
    const video = this.videos.get(id);
    if (video) {
      this.videos.set(id, { ...video, status });
    }
  }

  async removeVideo(id: string): Promise<void> {
    this.videos.delete(id);
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
    for (const decision of decisions) {
      this.decisions.push(decision);
      const video = this.videos.get(decision.videoId);
      if (video) {
        this.videos.set(video.id, { ...video, status: statusForOutcome(decision.outcome) });
      }
    }
  }

  async getUsage(dateKey: string): Promise<number> {
    return this.usage.get(dateKey) ?? 0;
  }

  async addUsageSeconds(dateKey: string, seconds: number): Promise<void> {
    this.usage.set(dateKey, (this.usage.get(dateKey) ?? 0) + seconds);
  }

  async resetUsage(dateKey: string): Promise<void> {
    this.usage.delete(dateKey);
  }

  async getExtraTime(): Promise<ExtraTimePool | undefined> {
    return this.extraTime ? { ...this.extraTime } : undefined;
  }

  async saveExtraTime(pool: ExtraTimePool): Promise<void> {
    this.extraTime = { ...pool };
  }

  async getPinGuard(): Promise<PinGuardState> {
    return { ...this.pinGuard };
  }

  async savePinGuard(state: PinGuardState): Promise<void> {
    this.pinGuard = { ...state };
  }

  async getWatchProgress(videoId: string): Promise<WatchProgress | undefined> {
    return this.watchProgress.get(videoId);
  }

  async listWatchProgress(): Promise<WatchProgress[]> {
    return [...this.watchProgress.values()];
  }

  async saveWatchProgress(progress: WatchProgress): Promise<void> {
    this.watchProgress.set(progress.videoId, progress);
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
  }
}
