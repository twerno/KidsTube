/**
 * Date grouping for video lists (ADR 0020) — pure and testable.
 *
 * The child's feed follows publication dates, so a long list gets three
 * familiar buckets: this week, this month and the previous calendar month,
 * plus a catch-all for older uploads. The grouping is only a presentation
 * aid; ordering inside every bucket stays newest-first.
 */

import type { Video } from './types';
import { videoPublicationTime, videoSortTime } from './content';

export type VideoGroupKey = 'week' | 'month' | 'previousMonth' | 'older' | 'unknown';

export interface VideoGroup {
  key: VideoGroupKey;
  title: string;
  videos: Video[];
}

const MONTHS_LOCATIVE_PL = [
  'styczniu',
  'lutym',
  'marcu',
  'kwietniu',
  'maju',
  'czerwcu',
  'lipcu',
  'sierpniu',
  'wrześniu',
  'październiku',
  'listopadzie',
  'grudniu',
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

function startOfPreviousMonth(now: Date): Date {
  return new Date(now.getFullYear(), now.getMonth() - 1, 1);
}

function previousMonthTitle(now: Date): string {
  const month = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const yearSuffix =
    month.getFullYear() === now.getFullYear() ? '' : ` ${month.getFullYear()}`;
  return `We ${MONTHS_LOCATIVE_PL[month.getMonth()]}${yearSuffix}`;
}

function groupKeyOf(timestamp: number, now: Date): VideoGroupKey {
  if (timestamp >= startOfWeek(now).getTime()) {
    return 'week';
  }
  if (timestamp >= startOfMonth(now).getTime()) {
    return 'month';
  }
  if (timestamp >= startOfPreviousMonth(now).getTime()) {
    return 'previousMonth';
  }
  return 'older';
}

/**
 * Bucket films by publication date (falling back to import time). Empty groups
 * are omitted; films without a usable date go to the trailing “Bez daty”.
 */
export function groupVideosByDate(videos: Video[], now: Date = new Date()): VideoGroup[] {
  const buckets = new Map<VideoGroupKey, Video[]>();

  for (const video of videos) {
    const timestamp = videoPublicationTime(video);
    const key: VideoGroupKey =
      Number.isFinite(timestamp) && timestamp > 0 ? groupKeyOf(timestamp, now) : 'unknown';
    const bucket = buckets.get(key) ?? [];
    bucket.push(video);
    buckets.set(key, bucket);
  }

  const order: VideoGroupKey[] = ['week', 'month', 'previousMonth', 'older', 'unknown'];
  const titleOf = (key: VideoGroupKey): string => {
    switch (key) {
      case 'week':
        return 'W tym tygodniu';
      case 'month':
        return 'W tym miesiącu';
      case 'previousMonth':
        return previousMonthTitle(now);
      case 'older':
        return 'Starsze';
      case 'unknown':
        return 'Bez daty';
    }
  };

  return order
    .filter(key => (buckets.get(key)?.length ?? 0) > 0)
    .map(key => ({
      key,
      title: titleOf(key),
      videos: [...(buckets.get(key) ?? [])].sort(
        (a, b) => videoSortTime(b) - videoSortTime(a),
      ),
    }));
}
