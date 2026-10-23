/**
 * Time controls (ADR 0002): a single weekly playback window (gate for video),
 * a daily video minute budget and unrestricted audio mode.
 *
 *  - `window` — one od–do interval, the same every day; wraps past midnight.
 *  - `dailyLimitMinutes` — one budget per calendar day, reset local midnight,
 *    consumed only by video playback.
 *  - Audio mode is never gated: no window, no limit.
 *  - Sleep mode lives in `domain/sleepMode.ts`.
 *
 * Pure functions, easy to test.
 */

import type { Schedule, TimeWindow } from './types';
import { DEFAULT_SCHEDULE } from './types';

export type PlaybackBlockReason = 'outside-window' | 'daily-limit';

/** Audio bypasses every gate; only video is restricted (ADR 0002). */
export type PlaybackMode = 'video' | 'audio';

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

interface LegacyScheduleShape {
  /** Pre-ADR 0002 shape: multiple per-day windows. Only the first is kept. */
  windows?: Array<{ startMinute?: number; endMinute?: number }>;
  /** Pre-ADR 0002 “quiet hour”; removed in ADR 0002, ignored. */
  audioOnlyAfterMinute?: number;
}

/**
 * Coerce a stored schedule to the current shape: migrate the legacy multi-window
 * shape and drop the removed “quiet hour” field so it is not persisted again.
 */
export function normalizeSchedule(schedule?: Schedule): Schedule {
  const normalized: Schedule = schedule ? { ...DEFAULT_SCHEDULE, ...schedule } : { ...DEFAULT_SCHEDULE };
  if (schedule) {
    const legacy = schedule as Schedule & LegacyScheduleShape;
    if (!normalized.window && legacy.windows) {
      const legacyFirst = legacy.windows.find(w => w.startMinute != null && w.endMinute != null);
      if (legacyFirst) {
        normalized.window = {
          startMinute: legacyFirst.startMinute as number,
          endMinute: legacyFirst.endMinute as number,
        };
      }
    }
    // Removed in ADR 0002: the “quiet hour” must not survive a round-trip.
    delete (normalized as Schedule & LegacyScheduleShape).audioOnlyAfterMinute;
  }
  return normalized;
}

function isInWindow(window: TimeWindow, minute: number): boolean {
  if (window.startMinute <= window.endMinute) {
    return minute >= window.startMinute && minute < window.endMinute;
  }
  // Wraps past midnight: active from start until the end of the day.
  return minute >= window.startMinute;
}

/** True when `date` falls inside the single weekly window (no window = always). */
export function isWithinWindow(schedule: Schedule, date: Date = new Date()): boolean {
  const { window } = normalizeSchedule(schedule);
  if (!window) {
    return true;
  }
  const minute = minuteOfDay(date);
  if (isInWindow(window, minute)) {
    return true;
  }
  // Tail of a window that started yesterday and wrapped past midnight.
  return window.startMinute > window.endMinute && minute < window.endMinute;
}

/**
 * Decide whether playback of the given mode may start now.
 * Audio is always allowed; video is gated by the window and the daily budget.
 *
 * @param mode 'audio' skips every gate (ADR 0002)
 * @param usedSecondsToday seconds of video already played today (local date)
 */
export function canPlay(
  schedule: Schedule,
  mode: PlaybackMode,
  usedSecondsToday: number,
  date: Date = new Date(),
): PlaybackDecision {
  const normalized = normalizeSchedule(schedule);
  if (mode === 'audio' || !normalized.enabled) {
    return { allowed: true };
  }
  if (!isWithinWindow(normalized, date)) {
    return { allowed: false, reason: 'outside-window' };
  }
  const limitMinutes = normalized.dailyLimitMinutes ?? 0;
  if (limitMinutes > 0 && usedSecondsToday >= limitMinutes * 60) {
    return { allowed: false, reason: 'daily-limit' };
  }
  return { allowed: true };
}

/** Remaining seconds in today's video budget, or undefined when unlimited. */
export function remainingSecondsToday(
  schedule: Schedule,
  usedSecondsToday: number,
): number | undefined {
  const normalized = normalizeSchedule(schedule);
  // A disabled schedule turns off every time control — including the daily
  // budget (ADR 0002). Otherwise a left-over limit would still hard-cut video.
  if (!normalized.enabled) {
    return undefined;
  }
  const limitMinutes = normalized.dailyLimitMinutes ?? 0;
  if (limitMinutes <= 0) {
    return undefined;
  }
  return Math.max(0, limitMinutes * 60 - usedSecondsToday);
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