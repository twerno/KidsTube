/**
 * Persistence boundary. The UI and services depend only on this interface, so
 * the in-memory implementation (tests, previews) and the AsyncStorage-backed
 * implementation (device) are interchangeable.
 */

import type { Channel, Decision, Settings, Video, VideoStatus } from '../domain/types';

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
  /** Low-level cache setter; parent actions should use `recordDecision` instead. */
  setVideoStatus(id: string, status: VideoStatus): Promise<void>;
  removeVideo(id: string): Promise<void>;

  listPendingVideos(): Promise<Video[]>;

  /**
   * Append-only decision history (ADR 0001). Recording a decision also refreshes
   * the cached `Video.status` projection.
   */
  listDecisions(): Promise<Decision[]>;
  recordDecision(decision: Decision): Promise<void>;

  /** Seconds of playback recorded for a local date key (YYYY-MM-DD). */
  getUsage(dateKey: string): Promise<number>;
  addUsageSeconds(dateKey: string, seconds: number): Promise<void>;
  /** Clear a day's watch time (parent action / test aid). */
  resetUsage(dateKey: string): Promise<void>;
}
