/**
 * Time controls: allowed playback windows, a daily minute budget and the
 * “night mode” (audio-only) threshold. Pure functions, easy to test.
 */

import type { Schedule, TimeWindow } from './types';
import { DEFAULT_SCHEDULE } from './types';

export type PlaybackBlockReason = 'outside-window' | 'daily-limit';

export interface PlaybackDecision {
  allowed: boolean;
  reason?: PlaybackBlockReason;
}

export const MINUTES_PER_DAY = 24 * 60;

/** Local minutes since midnight. */
export function minuteOfDay(date: Date): number {
  return date.getHours() * 60 + date.getMinutes();
}

/** Local YYYY-MM-DD key for usage bookkeeping. */
export function dateKey(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function normalizeSchedule(schedule?: Schedule): Schedule {
  return schedule ? { ...DEFAULT_SCHEDULE, ...schedule } : { ...DEFAULT_SCHEDULE };
}

function isInWindow(window: TimeWindow, day: number, minute: number): boolean {
  if (!window.days.includes(day)) {
    return false;
  }
  if (window.startMinute <= window.endMinute) {
    return minute >= window.startMinute && minute < window.endMinute;
  }
  // Wraps past midnight: active from start until end of the day.
  return minute >= window.startMinute;
}

export function isWithinWindows(windows: TimeWindow[], date: Date): boolean {
  if (windows.length === 0) {
    return true;
  }
  const day = date.getDay();
  const prevDay = (day + 6) % 7;
  const minute = minuteOfDay(date);

  for (const window of windows) {
    if (isInWindow(window, day, minute)) {
      return true;
    }
    // Tail of a window that started yesterday and wrapped past midnight.
    if (
      window.startMinute > window.endMinute &&
      window.days.includes(prevDay) &&
      minute < window.endMinute
    ) {
      return true;
    }
  }
  return false;
}

/**
 * Decide whether playback may start now.
 *
 * @param usedSecondsToday seconds already played today (local date)
 */
export function canPlay(
  schedule: Schedule,
  usedSecondsToday: number,
  date: Date = new Date(),
): PlaybackDecision {
  const normalized = normalizeSchedule(schedule);
  if (!normalized.enabled) {
    return { allowed: true };
  }
  if (!isWithinWindows(normalized.windows, date)) {
    return { allowed: false, reason: 'outside-window' };
  }
  const limitMinutes = normalized.dailyLimitMinutes ?? 0;
  if (limitMinutes > 0 && usedSecondsToday >= limitMinutes * 60) {
    return { allowed: false, reason: 'daily-limit' };
  }
  return { allowed: true };
}

/** Remaining seconds in today's budget, or undefined when unlimited. */
export function remainingSecondsToday(
  schedule: Schedule,
  usedSecondsToday: number,
): number | undefined {
  const limitMinutes = normalizeSchedule(schedule).dailyLimitMinutes ?? 0;
  if (limitMinutes <= 0) {
    return undefined;
  }
  return Math.max(0, limitMinutes * 60 - usedSecondsToday);
}

/** True when “night mode” should force audio-only playback. */
export function isAudioOnlyNow(schedule: Schedule, date: Date = new Date()): boolean {
  const normalized = normalizeSchedule(schedule);
  if (!normalized.enabled || normalized.audioOnlyAfterMinute == null) {
    return false;
  }
  return minuteOfDay(date) >= normalized.audioOnlyAfterMinute;
}

/** Parse "HH:MM" into minutes from midnight, or undefined when malformed. */
export function parseHHMM(value: string): number | undefined {
  const match = value.trim().match(/^(\d{1,2}):(\d{2})$/);
  if (!match) {
    return undefined;
  }
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (hours > 23 || minutes > 59) {
    return undefined;
  }
  return hours * 60 + minutes;
}

export function formatHHMM(minute: number): string {
  const h = Math.floor(minute / 60) % 24;
  const m = minute % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}
