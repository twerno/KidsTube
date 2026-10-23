/** Device persistence backed by AsyncStorage (single JSON blob per collection). */

import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Channel, Decision, Settings, Video, VideoStatus } from '../domain/types';
import { DEFAULT_SETTINGS } from '../domain/types';
import { statusForOutcome } from '../domain/decisions';
import type { Repository } from './repository';

const KEYS = {
  settings: '@kidtube/settings/v1',
  channels: '@kidtube/channels/v1',
  videos: '@kidtube/videos/v1',
  decisions: '@kidtube/decisions/v1',
  usage: '@kidtube/usage/v1',
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
  private videos = new Map<string, Video>();
  private decisions: Decision[] = [];
  private usage = new Map<string, number>();
  private settings: Settings = { ...DEFAULT_SETTINGS };
  private loaded = false;

  async init(): Promise<void> {
    if (this.loaded) {
      return;
    }
    const [settings, channels, videos, decisions, usage] = await Promise.all([
      readJson<Settings>(KEYS.settings, { ...DEFAULT_SETTINGS }),
      readJson<Channel[]>(KEYS.channels, []),
      readJson<Video[]>(KEYS.videos, []),
      readJson<Decision[]>(KEYS.decisions, []),
      readJson<Record<string, number>>(KEYS.usage, {}),
    ]);
    this.settings = { ...DEFAULT_SETTINGS, ...settings };
    channels.forEach(c => this.channels.set(c.id, c));
    videos.forEach(v => this.videos.set(v.id, v));
    this.decisions = [...(decisions ?? [])];
    Object.entries(usage ?? {}).forEach(([key, seconds]) => this.usage.set(key, seconds));
    this.loaded = true;
  }

  private async persistChannels(): Promise<void> {
    await AsyncStorage.setItem(KEYS.channels, JSON.stringify([...this.channels.values()]));
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
}
