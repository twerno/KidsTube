/**
 * Viewing-history aggregation (ADR 0004) — pure rules.
 *
 * The history records how long the child actually spent on each material, split
 * per playback mode (audio vs video), grouped by local day. One entry per
 * (video, day); repeated watching on the same day accumulates into it, and a
 * metadata snapshot keeps the entry readable after the video is gone.
 */

import type { Video, WatchHistoryEntry, WatchMode } from './types';

/** A reported stretch of actual playback, ready to fold into the history. */
export interface WatchStretch {
  video: Pick<Video, 'id' | 'channelId' | 'channelTitle' | 'title' | 'thumbnailUrl'>;
  /** Local day (YYYY-MM-DD) the time belongs to. */
  dateKey: string;
  mode: WatchMode;
  seconds: number;
  at: number;
}

export function entryTotalSeconds(entry: WatchHistoryEntry): number {
  return entry.audioSeconds + entry.videoSeconds;
}

/**
 * Fold a playback stretch into its (video, day) entry, creating the entry when
 * it does not exist yet. Extra seconds are attributed to the mode they were
 * played in; the metadata snapshot is refreshed from the freshest values.
 */
export function mergeWatchStretch(
  existing: WatchHistoryEntry | undefined,
  stretch: WatchStretch,
): WatchHistoryEntry {
  const { video, dateKey, mode, seconds, at } = stretch;
  const added = Math.max(0, seconds);
  const base: WatchHistoryEntry = existing ?? {
    videoId: video.id,
    dateKey,
    title: video.title,
    channelTitle: video.channelTitle,
    thumbnailUrl: video.thumbnailUrl,
    firstWatchedAt: at,
    lastWatchedAt: at,
    audioSeconds: 0,
    videoSeconds: 0,
  };
  return {
    ...base,
    title: video.title || base.title,
    channelTitle: video.channelTitle ?? base.channelTitle,
    thumbnailUrl: video.thumbnailUrl ?? base.thumbnailUrl,
    firstWatchedAt: Math.min(base.firstWatchedAt, at),
    lastWatchedAt: Math.max(base.lastWatchedAt, at),
    audioSeconds: base.audioSeconds + (mode === 'audio' ? added : 0),
    videoSeconds: base.videoSeconds + (mode === 'video' ? added : 0),
  };
}

export interface WatchHistoryDay {
  dateKey: string;
  totalSeconds: number;
  audioSeconds: number;
  videoSeconds: number;
  entries: WatchHistoryEntry[];
}

/**
 * Group entries into local days, newest day first, newest material first within
 * a day. `YYYY-MM-DD` keys sort lexicographically, so no date parsing is needed.
 */
export function groupWatchHistory(entries: WatchHistoryEntry[]): WatchHistoryDay[] {
  const byDay = new Map<string, WatchHistoryEntry[]>();
  for (const entry of entries) {
    const list = byDay.get(entry.dateKey) ?? [];
    list.push(entry);
    byDay.set(entry.dateKey, list);
  }
  return [...byDay.entries()]
    .sort(([a], [b]) => (a < b ? 1 : a > b ? -1 : 0))
    .map(([dateKey, dayEntries]) => ({
      dateKey,
      totalSeconds: dayEntries.reduce((sum, entry) => sum + entryTotalSeconds(entry), 0),
      audioSeconds: dayEntries.reduce((sum, entry) => sum + entry.audioSeconds, 0),
      videoSeconds: dayEntries.reduce((sum, entry) => sum + entry.videoSeconds, 0),
      entries: [...dayEntries].sort((a, b) => b.lastWatchedAt - a.lastWatchedAt),
    }));
}
