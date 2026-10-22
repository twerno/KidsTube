/** In-memory Repository used by tests, previews and the first-run demo mode. */

import type { Channel, Settings, Video, VideoStatus } from '../domain/types';
import { DEFAULT_SETTINGS } from '../domain/types';
import type { Repository } from './repository';

export class MemoryRepository implements Repository {
  private settings: Settings;
  private channels = new Map<string, Channel>();
  private videos = new Map<string, Video>();
  private usage = new Map<string, number>();

  constructor(seed?: {
    settings?: Settings;
    channels?: Channel[];
    videos?: Video[];
    usage?: Record<string, number>;
  }) {
    this.settings = { ...DEFAULT_SETTINGS, ...seed?.settings };
    seed?.channels?.forEach(c => this.channels.set(c.id, c));
    seed?.videos?.forEach(v => this.videos.set(v.id, v));
    Object.entries(seed?.usage ?? {}).forEach(([key, seconds]) => this.usage.set(key, seconds));
  }

  async init(): Promise<void> {}

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

  async getUsage(dateKey: string): Promise<number> {
    return this.usage.get(dateKey) ?? 0;
  }

  async addUsageSeconds(dateKey: string, seconds: number): Promise<void> {
    this.usage.set(dateKey, (this.usage.get(dateKey) ?? 0) + seconds);
  }
}
