/**
 * Persistence boundary. The UI and services depend only on this interface, so
 * the in-memory implementation (tests, previews) and the AsyncStorage-backed
 * implementation (device) are interchangeable.
 */

import type { Channel, Settings, Video, VideoStatus } from '../domain/types';

export interface Repository {
  init(): Promise<void>;

  getSettings(): Promise<Settings>;
  updateSettings(patch: Partial<Settings>): Promise<Settings>;

  listChannels(): Promise<Channel[]>;
  getChannel(id: string): Promise<Channel | undefined>;
  upsertChannel(channel: Channel): Promise<void>;
  removeChannel(id: string): Promise<void>;

  listVideos(): Promise<Video[]>;
  getVideo(id: string): Promise<Video | undefined>;
  upsertVideos(videos: Video[]): Promise<void>;
  setVideoStatus(id: string, status: VideoStatus): Promise<void>;
  removeVideo(id: string): Promise<void>;

  listPendingVideos(): Promise<Video[]>;

  /** Seconds of playback recorded for a local date key (YYYY-MM-DD). */
  getUsage(dateKey: string): Promise<number>;
  addUsageSeconds(dateKey: string, seconds: number): Promise<void>;
}
