/**
 * Domain types for KidTube.
 *
 * The whole app revolves around two curated lists:
 *  - channels the parent trusts (with an auto-approve or manual policy)
 *  - videos, each carrying its own allow/pending/block status
 */

export type VideoStatus = 'allowed' | 'pending' | 'blocked';

/** Where a video record came from. */
export type VideoSource = 'rss' | 'manual' | 'share' | 'propose';

/** Outcome of a decision: the parent lets the video in or keeps it out. */
export type DecisionOutcome = 'allow' | 'reject';

/** Who decided: the parent directly, or the system repeating a prior decision. */
export type DecisionSource = 'manual' | 'auto';

/**
 * One append-only entry in the decision history (ADR 0001). The latest entry
 * for a video is the source of truth for its visibility; `Video.status` is a
 * cached projection that keeps the UI simple.
 */
export interface Decision {
  videoId: string;
  outcome: DecisionOutcome;
  source: DecisionSource;
  at: number;
  /** Channel snapshot, so the history outlives a removed channel. */
  channelId?: string;
}

/** How newly discovered videos of a channel are handled. */
export type ChannelPolicy = 'auto_approve' | 'manual';

export type ChannelStatus = 'allowed' | 'blocked';

/**
 * The single recurring playback window (od–do), the same for every day of the
 * week (ADR 0002: one window, no per-day rhythm).
 */
export interface TimeWindow {
  /** Minutes from midnight, inclusive. */
  startMinute: number;
  /** Minutes from midnight, exclusive. If <= start, the window wraps past midnight. */
  endMinute: number;
}

/** Parental time controls: when playback is allowed and for how long. */
export interface Schedule {
  enabled: boolean;
  /**
   * The only gate for video playback; undefined = always allowed.
   * Audio mode is never gated (ADR 0002).
   */
  window?: TimeWindow;
  /** Daily video cap in minutes (undefined or 0 = unlimited). Audio never consumes it. */
  dailyLimitMinutes?: number;
}

export interface Channel {
  /** YouTube channel id, e.g. "UC_x5XG1OV2P6uZZ5FSM9Ttw". */
  id: string;
  title: string;
  /** Optional @handle or vanity slug, used for display only. */
  handle?: string;
  thumbnailUrl?: string;
  /** How new uploads are treated when synced from the RSS feed. */
  policy: ChannelPolicy;
  /** A blocked channel is hidden from the child entirely. */
  status: ChannelStatus;
  addedAt: number;
}

export interface Video {
  /** YouTube video id (11 chars). */
  id: string;
  channelId?: string;
  channelTitle?: string;
  title: string;
  publishedAt?: number;
  thumbnailUrl?: string;
  status: VideoStatus;
  source: VideoSource;
  addedAt: number;
}

/** Playback mode a stretch of watching happened in (ADR 0002 / ADR 0004). */
export type WatchMode = 'video' | 'audio';

/**
 * Per-video watching progress (ADR 0004). `positionSeconds` is the last known
 * playback position — the resume point (“wznawiamy tam, gdzie dziecko
 * skończyło”). `completed` sticks once the child reaches the end (or seeks to
 * it) and makes the next open restart from the beginning. Purely local.
 */
export interface WatchProgress {
  videoId: string;
  positionSeconds: number;
  /**
   * Last known total duration (seconds); undefined until measured. Seeding it
   * lets the resume slider land at the right place before the video loads.
   */
  durationSeconds?: number;
  completed: boolean;
  /** When the video was last played, for “recently watched” ordering. */
  lastWatchedAt: number;
}

/**
 * One material's watch time on a given local day, for the viewing history
 * (ADR 0004). Carries a snapshot of the video metadata so the history survives
 * removed videos and channels.
 */
export interface WatchHistoryEntry {
  videoId: string;
  /** Local day (YYYY-MM-DD) the time is attributed to. */
  dateKey: string;
  title: string;
  channelTitle?: string;
  thumbnailUrl?: string;
  firstWatchedAt: number;
  lastWatchedAt: number;
  audioSeconds: number;
  videoSeconds: number;
}

export interface Settings {
  /** PBKDF2 hash of the parent PIN. Absent until the parent sets one. */
  pinHash?: string;
  pinSalt?: string;
  pinIterations?: number;
  childName?: string;
  /** Set once the first-run wizard has completed. */
  configured?: boolean;
  schedule?: Schedule;
}

export const DEFAULT_SCHEDULE: Schedule = {
  enabled: false,
  dailyLimitMinutes: 0,
};

export const DEFAULT_SETTINGS: Settings = {
  configured: false,
  schedule: DEFAULT_SCHEDULE,
};
