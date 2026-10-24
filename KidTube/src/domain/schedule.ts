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

import type { ExtraTimePool, Schedule, TimeWindow } from './types';
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

/** An empty pool for a local day (ADR 0011). */
export function emptyExtraTime(dayKey: string): ExtraTimePool {
  return { dateKey: dayKey, grantedSeconds: 0, remainingSeconds: 0 };
}

/** A stored pool from another day is expired; treat it as empty for today. */
export function normalizeExtraTime(
  pool: ExtraTimePool | undefined,
  dayKey: string,
): ExtraTimePool {
  if (!pool || pool.dateKey !== dayKey) {
    return emptyExtraTime(dayKey);
  }
  const granted = Math.max(0, pool.grantedSeconds);
  return {
    dateKey: dayKey,
    grantedSeconds: granted,
    remainingSeconds: Math.min(granted, Math.max(0, pool.remainingSeconds)),
  };
}

/** Seconds already consumed from the extra pool. */
export function extraTimeUsedSeconds(pool: ExtraTimePool): number {
  return Math.max(0, pool.grantedSeconds - pool.remainingSeconds);
}

/** Base-limit consumption, i.e. total video time minus what came from the pool. */
export function baseUsedSeconds(totalUsedSeconds: number, pool: ExtraTimePool): number {
  return Math.max(0, totalUsedSeconds - extraTimeUsedSeconds(pool));
}

/** Add a one-off grant; consecutive grants sum up (ADR 0011). */
export function grantExtraTime(
  pool: ExtraTimePool | undefined,
  dayKey: string,
  seconds: number,
): ExtraTimePool {
  const base = normalizeExtraTime(pool, dayKey);
  const added = Math.max(0, seconds);
  return {
    ...base,
    grantedSeconds: base.grantedSeconds + added,
    remainingSeconds: base.remainingSeconds + added,
  };
}

/** Does the schedule currently have any gate the extra pool could lift? */
export function hasTimeGate(schedule: Schedule): boolean {
  const normalized = normalizeSchedule(schedule);
  return (
    normalized.enabled &&
    (normalized.window != null || (normalized.dailyLimitMinutes ?? 0) > 0)
  );
}

/**
 * Fold a stretch of actual video playback into the extra pool (ADR 0011).
 * Greedy: inside the window, base-limit seconds are used first; extra seconds
 * are consumed only after the base limit is exhausted or outside the window.
 * With no base limit, the window itself is unlimited, so only outside-window
 * playback consumes the pool.
 */
export function consumeVideoSeconds(
  schedule: Schedule,
  date: Date,
  usedSecondsBefore: number,
  pool: ExtraTimePool | undefined,
  seconds: number,
): ExtraTimePool {
  const normalized = normalizeSchedule(schedule);
  const dayKey = dateKey(date);
  const current = normalizeExtraTime(pool, dayKey);
  if (!normalized.enabled || seconds <= 0 || current.remainingSeconds <= 0) {
    return current;
  }

  const inWindow = isWithinWindow(normalized, date);
  const limitSeconds = (normalized.dailyLimitMinutes ?? 0) * 60;
  const usedFromBase = baseUsedSeconds(usedSecondsBefore, current);

  let extraWanted: number;
  if (!inWindow) {
    extraWanted = seconds;
  } else if (limitSeconds > 0) {
    const baseRemaining = Math.max(0, limitSeconds - usedFromBase);
    extraWanted = Math.max(0, seconds - baseRemaining);
  } else {
    // Inside the window with no base limit: playback was already allowed.
    extraWanted = 0;
  }

  const consumed = Math.min(current.remainingSeconds, extraWanted);
  return consumed > 0
    ? { ...current, remainingSeconds: current.remainingSeconds - consumed }
    : current;
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
  extraTime?: ExtraTimePool,
): PlaybackDecision {
  const normalized = normalizeSchedule(schedule);
  if (mode === 'audio' || !normalized.enabled) {
    return { allowed: true };
  }

  const extra = normalizeExtraTime(extraTime, dateKey(date));
  // Any remaining extra time unlocks the window and covers an exhausted limit
  // (ADR 0011). It is consumed only when the base gate would otherwise block.
  if (extra.remainingSeconds > 0) {
    return { allowed: true };
  }

  if (!isWithinWindow(normalized, date)) {
    return { allowed: false, reason: 'outside-window' };
  }
  const limitMinutes = normalized.dailyLimitMinutes ?? 0;
  const usedForBase = baseUsedSeconds(usedSecondsToday, extra);
  if (limitMinutes > 0 && usedForBase >= limitMinutes * 60) {
    return { allowed: false, reason: 'daily-limit' };
  }
  return { allowed: true };
}

/** Remaining seconds in today's video budget, or undefined when unlimited. */
export function remainingSecondsToday(
  schedule: Schedule,
  usedSecondsToday: number,
  extraTime?: ExtraTimePool,
  date: Date = new Date(),
): number | undefined {
  const normalized = normalizeSchedule(schedule);
  // A disabled schedule turns off every time control — including the daily
  // budget (ADR 0002). Otherwise a left-over limit would still hard-cut video.
  if (!normalized.enabled) {
    return undefined;
  }

  const extra = normalizeExtraTime(extraTime, dateKey(date));
  const limitMinutes = normalized.dailyLimitMinutes ?? 0;
  const inWindow = isWithinWindow(normalized, date);

  if (limitMinutes > 0) {
    const baseRemaining = Math.max(
      0,
      limitMinutes * 60 - baseUsedSeconds(usedSecondsToday, extra),
    );
    // Outside the window only the extra pool is usable; in the window both.
    return inWindow ? baseRemaining + extra.remainingSeconds : extra.remainingSeconds;
  }

  // No base limit: inside the window playback is unlimited, but a granted pool
  // is still the only counter shown to the child (ADR 0011).
  return extra.remainingSeconds > 0 ? extra.remainingSeconds : undefined;
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