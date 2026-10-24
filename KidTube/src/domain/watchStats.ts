/**
 * Watch-time statistics for the parent panel's summary (ADR 0016).
 *
 * The panel shows today's time and the average over the last seven calendar
 * days, split into video and audio. The denominator is always seven — days
 * without watching count as zero — so the average is comparable with the daily
 * video limit.
 */

import type { WatchHistoryEntry } from './types';
import { dateKey } from './schedule';

export interface WatchStats {
  /** Seconds of playback in video mode. */
  videoSeconds: number;
  /** Seconds of playback in audio mode. */
  audioSeconds: number;
  /** Materials played in video mode at least once. */
  videoCount: number;
  /** Materials played in audio mode at least once. */
  audioCount: number;
}

export function emptyWatchStats(): WatchStats {
  return { videoSeconds: 0, audioSeconds: 0, videoCount: 0, audioCount: 0 };
}

/** Local day keys of the last `days` calendar days, today first. */
export function lastDayKeys(now: number, days: number): string[] {
  const keys: string[] = [];
  for (let offset = 0; offset < days; offset += 1) {
    const day = new Date(now);
    day.setDate(day.getDate() - offset);
    keys.push(dateKey(day));
  }
  return keys;
}

/** Sum of the entries belonging to the given local days. */
export function statsForDays(entries: WatchHistoryEntry[], dayKeys: string[]): WatchStats {
  const wanted = new Set(dayKeys);
  const stats = emptyWatchStats();
  for (const entry of entries) {
    if (!wanted.has(entry.dateKey)) {
      continue;
    }
    stats.videoSeconds += entry.videoSeconds;
    stats.audioSeconds += entry.audioSeconds;
    if (entry.videoSeconds > 0) {
      stats.videoCount += 1;
    }
    if (entry.audioSeconds > 0) {
      stats.audioCount += 1;
    }
  }
  return stats;
}

export function todayStats(entries: WatchHistoryEntry[], now: number = Date.now()): WatchStats {
  return statsForDays(entries, [dateKey(new Date(now))]);
}

export interface AverageWatchStats {
  videoSeconds: number;
  audioSeconds: number;
  videoCount: number;
  audioCount: number;
}

/**
 * Daily average over the last seven calendar days (empty days count as zero).
 * Values are fractional — the panel rounds them for display.
 */
export function averageStats(
  entries: WatchHistoryEntry[],
  now: number = Date.now(),
  days: number = 7,
): AverageWatchStats {
  const stats = statsForDays(entries, lastDayKeys(now, days));
  return {
    videoSeconds: stats.videoSeconds / days,
    audioSeconds: stats.audioSeconds / days,
    videoCount: stats.videoCount / days,
    audioCount: stats.audioCount / days,
  };
}
