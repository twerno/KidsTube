/**
 * Domain types for KidTube.
 *
 * The whole app revolves around two curated lists:
 *  - channels the parent trusts (with an auto-approve or manual policy)
 *  - videos, each carrying its own allow/pending/block status
 */

export type VideoStatus = 'allowed' | 'pending' | 'blocked';

/** Where a video record came from. */
export type VideoSource = 'rss' | 'manual' | 'share';

/** How newly discovered videos of a channel are handled. */
export type ChannelPolicy = 'auto_approve' | 'manual';

export type ChannelStatus = 'allowed' | 'blocked';

/** A recurring playback window. `days` uses JS `Date.getDay()` (0=Sunday). */
export interface TimeWindow {
  days: number[];
  /** Minutes from midnight, inclusive. */
  startMinute: number;
  /** Minutes from midnight, exclusive. If <= start, the window wraps past midnight. */
  endMinute: number;
}

/** Parental time controls: when playback is allowed and for how long. */
export interface Schedule {
  enabled: boolean;
  /** Playback allowed only inside these windows (empty = always allowed). */
  windows: TimeWindow[];
  /** Daily playback cap in minutes (undefined or 0 = unlimited). */
  dailyLimitMinutes?: number;
  /** After this minute-of-day, force audio-only “night mode” (undefined = never). */
  audioOnlyAfterMinute?: number;
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
  windows: [],
  dailyLimitMinutes: 0,
};

export const DEFAULT_SETTINGS: Settings = {
  configured: false,
  schedule: DEFAULT_SCHEDULE,
};
