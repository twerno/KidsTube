/**
 * Date grouping for video lists (ADR 0020 / 0024) — pure and testable.
 *
 * The child's feed follows publication dates, so a long list gets two “live”
 * buckets (this week, this month) and then one bucket per calendar month, the
 * newest month first: “w październiku”, “we wrześniu”, …, “w styczniu”, and
 * older months with their year — “w grudniu 2025”, “w listopadzie 2025”. The
 * grouping is only a presentation aid; ordering inside every bucket stays
 * newest-first. Films without a publication date end up in “Bez daty”.
 */

import type { Video, WatchProgress } from './types';
import { videoPublicationTime, videoSortTime } from './content';
import { dateKey } from './schedule';
import { formatHistoryDay } from './watchHistoryView';

export type VideoGroupKey = 'week' | 'month' | 'unknown' | `month:${string}`;

export interface VideoGroup {
  key: VideoGroupKey;
  title: string;
  videos: Video[];
}

/** Any dated band of films: publication-date groups and day groups. */
export interface VideoDayGroup {
  key: string;
  title: string;
  videos: Video[];
}

/**
 * Month names in the locative with their preposition, so the heading reads
 * “W październiku”, but “We wrześniu” (the only month starting with a
 * consonant cluster that takes “we”).
 */
const MONTH_PL = [
  'w styczniu',
  'w lutym',
  'w marcu',
  'w kwietniu',
  'w maju',
  'w czerwcu',
  'w lipcu',
  'w sierpniu',
  'we wrześniu',
  'w październiku',
  'w listopadzie',
  'w grudniu',
];

function startOfWeek(now: Date): Date {
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  // Monday is the first day of the week in Poland (Sunday = 0).
  const offset = (start.getDay() + 6) % 7;
  start.setDate(start.getDate() - offset);
  return start;
}

function startOfMonth(now: Date): Date {
  return new Date(now.getFullYear(), now.getMonth(), 1);
}

/** `month:2026-10` — one band per calendar month older than the current one. */
function monthKeyOf(timestamp: number): VideoGroupKey {
  return `month:${dateKey(new Date(timestamp)).slice(0, 7)}`;
}

/** “month:2026-10” -> “W październiku”, “month:2025-12” -> “W grudniu 2025”. */
function monthTitleOf(key: VideoGroupKey, now: Date): string {
  const [year, month] = (key.slice('month:'.length).split('-') as [string, string]).map(Number);
  const base = MONTH_PL[month - 1];
  const title = `${base[0].toUpperCase()}${base.slice(1)}`;
  return year === now.getFullYear() ? title : `${title} ${year}`;
}

/**
 * Bucket films by publication date. Empty groups are omitted; films without a
 * usable date go to the trailing “Bez daty”. Month bands follow the calendar:
 * every older month gets its own band, newest first, and only months from
 * another year carry the year in the heading.
 */
export function groupVideosByDate(videos: Video[], now: Date = new Date()): VideoGroup[] {
  const weekStart = startOfWeek(now).getTime();
  const monthStart = startOfMonth(now).getTime();
  const buckets = new Map<VideoGroupKey, Video[]>();

  for (const video of videos) {
    const timestamp = videoPublicationTime(video);
    let key: VideoGroupKey;
    if (!Number.isFinite(timestamp) || timestamp <= 0) {
      key = 'unknown';
    } else if (timestamp >= weekStart) {
      key = 'week';
    } else if (timestamp >= monthStart) {
      key = 'month';
    } else {
      key = monthKeyOf(timestamp);
    }
    const bucket = buckets.get(key) ?? [];
    bucket.push(video);
    buckets.set(key, bucket);
  }

  const months = [...buckets.keys()]
    .filter((key): key is `month:${string}` => key.startsWith('month:'))
    // “month:YYYY-MM” sorts lexicographically, so newest month first.
    .sort((a, b) => (a < b ? 1 : a > b ? -1 : 0));
  const order: VideoGroupKey[] = [
    ...(['week', 'month'] as const).filter(key => buckets.has(key)),
    ...months,
    ...(buckets.has('unknown') ? (['unknown'] as const) : []),
  ];

  const titleOf = (key: VideoGroupKey): string => {
    if (key === 'week') {
      return 'W tym tygodniu';
    }
    if (key === 'month') {
      return 'W tym miesiącu';
    }
    if (key === 'unknown') {
      return 'Bez daty';
    }
    return monthTitleOf(key, now);
  };

  return order.map(key => ({
    key,
    title: titleOf(key),
    videos: [...(buckets.get(key) ?? [])].sort((a, b) => videoSortTime(b) - videoSortTime(a)),
  }));
}

/**
 * Bands for “Kontynuuj oglądanie” (ADR 0023): one band per local day of the
 * last playback, newest day first, and inside a band the most recently watched
 * film first. The headings reuse the viewing history wording (“Dziś”,
 * “Wczoraj”, “23 października 2026”), so both screens read the same way.
 *
 * Films without a stored playback are dropped — without it there is no
 * “last watched” date to band them by.
 */
export function groupVideosByLastWatched(
  videos: Video[],
  progress: WatchProgress[],
  now: number = Date.now(),
): VideoDayGroup[] {
  const lastWatchedAt = new Map(progress.map(entry => [entry.videoId, entry.lastWatchedAt]));
  const buckets = new Map<string, { video: Video; watchedAt: number }[]>();

  for (const video of videos) {
    const watchedAt = lastWatchedAt.get(video.id);
    if (watchedAt == null || !Number.isFinite(watchedAt) || watchedAt <= 0) {
      continue;
    }
    const key = dateKey(new Date(watchedAt));
    const bucket = buckets.get(key) ?? [];
    bucket.push({ video, watchedAt });
    buckets.set(key, bucket);
  }

  return [...buckets.entries()]
    .sort(([a], [b]) => (a < b ? 1 : a > b ? -1 : 0))
    .map(([key, entries]) => ({
      key,
      title: formatHistoryDay(key, now),
      videos: entries.sort((a, b) => b.watchedAt - a.watchedAt).map(entry => entry.video),
    }));
}
