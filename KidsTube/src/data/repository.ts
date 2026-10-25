/**
 * Persistence boundary. The UI and services depend only on this interface, so
 * the in-memory implementation (tests, previews) and the AsyncStorage-backed
 * implementation (device) are interchangeable.
 */

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

export interface Repository {
  init(): Promise<void>;

  /** Whole-database snapshot for a backup file (ADR 0017). */
  snapshotAll(): Promise<DatabaseSnapshot>;
  /**
   * Replace the whole database in one transaction (ADR 0017). A rollback copy
   * is kept until every collection is written; an interrupted replace is
   * finished or rolled back on the next `init`.
   */
  replaceAll(snapshot: DatabaseSnapshot): Promise<void>;

  getSettings(): Promise<Settings>;
  updateSettings(patch: Partial<Settings>): Promise<Settings>;

  listChannels(): Promise<Channel[]>;
  getChannel(id: string): Promise<Channel | undefined>;
  upsertChannel(channel: Channel): Promise<void>;
  removeChannel(id: string): Promise<void>;

  /** Channel links waiting for the parent's decision (ADR 0013). */
  listChannelProposals(): Promise<ChannelProposal[]>;
  getChannelProposal(id: string): Promise<ChannelProposal | undefined>;
  upsertChannelProposal(proposal: ChannelProposal): Promise<void>;
  removeChannelProposal(id: string): Promise<void>;

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
  /** Append several decisions in one write (bulk actions on a channel). */
  recordDecisions(decisions: Decision[]): Promise<void>;

  /** Seconds of playback recorded for a local date key (YYYY-MM-DD). */
  getUsage(dateKey: string): Promise<number>;
  addUsageSeconds(dateKey: string, seconds: number): Promise<void>;
  /** Clear a day's watch time (parent action / test aid). */
  resetUsage(dateKey: string): Promise<void>;

  /** One-off extra video time for a local day (ADR 0011). */
  getExtraTime(): Promise<ExtraTimePool | undefined>;
  saveExtraTime(pool: ExtraTimePool): Promise<void>;

  /** Local parent-PIN attempt state (ADR 0012), separate from Settings. */
  getPinGuard(): Promise<PinGuardState>;
  savePinGuard(state: PinGuardState): Promise<void>;

  /**
   * Per-video watching progress (ADR 0004): resume position and “stan
   * obejrzenia”. Kept separately from the history so it survives untouched.
   */
  getWatchProgress(videoId: string): Promise<WatchProgress | undefined>;
  listWatchProgress(): Promise<WatchProgress[]>;
  /** Upsert by video id. */
  saveWatchProgress(progress: WatchProgress): Promise<void>;

  /** Viewing history (ADR 0004): one entry per video and local day. */
  listWatchHistory(): Promise<WatchHistoryEntry[]>;
  getWatchHistoryEntry(videoId: string, dateKey: string): Promise<WatchHistoryEntry | undefined>;
  /** Upsert by (video id, date key). */
  saveWatchHistory(entry: WatchHistoryEntry): Promise<void>;
}
