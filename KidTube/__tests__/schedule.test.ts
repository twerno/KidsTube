import type { Schedule } from '../src/domain/types';
import {
  canPlay,
  dateKey,
  formatHHMM,
  isWithinWindow,
  minuteOfDay,
  normalizeSchedule,
  parseHHMM,
  remainingSecondsToday,
} from '../src/domain/schedule';

// 2024-01-01 is a Monday. The window is the same for every weekday (ADR 0002),
// so the weekday never matters anymore.
const mondayNoon = new Date(2024, 0, 1, 12, 0);
const tuesdayNoon = new Date(2024, 0, 2, 12, 0);
const sundayNoon = new Date(2024, 0, 7, 12, 0);
const mondayLate = new Date(2024, 0, 1, 23, 30);
const tuesdayEarly = new Date(2024, 0, 2, 0, 30);

const base: Schedule = { enabled: true, dailyLimitMinutes: 0 };

describe('time helpers', () => {
  it('computes minute of day and date key', () => {
    expect(minuteOfDay(mondayLate)).toBe(23 * 60 + 30);
    expect(dateKey(mondayNoon)).toBe('2024-01-01');
  });

  it('parses and formats HH:MM', () => {
    expect(parseHHMM('07:05')).toBe(425);
    expect(parseHHMM('23:59')).toBe(1439);
    expect(parseHHMM('24:00')).toBeUndefined();
    expect(parseHHMM('7:5')).toBeUndefined();
    expect(formatHHMM(425)).toBe('07:05');
  });
});

describe('isWithinWindow', () => {
  it('is always true when there is no window', () => {
    expect(isWithinWindow(base, mondayNoon)).toBe(true);
  });

  it('matches a simple daytime window', () => {
    const schedule: Schedule = { ...base, window: { startMinute: 8 * 60, endMinute: 20 * 60 } };
    expect(isWithinWindow(schedule, mondayNoon)).toBe(true);
    expect(isWithinWindow(schedule, mondayLate)).toBe(false);
  });

  it('applies the same window every day of the week', () => {
    const schedule: Schedule = { ...base, window: { startMinute: 8 * 60, endMinute: 20 * 60 } };
    expect(isWithinWindow(schedule, mondayNoon)).toBe(true);
    expect(isWithinWindow(schedule, tuesdayNoon)).toBe(true);
    expect(isWithinWindow(schedule, sundayNoon)).toBe(true);
  });

  it('handles a window wrapping past midnight', () => {
    const schedule: Schedule = { ...base, window: { startMinute: 22 * 60, endMinute: 2 * 60 } };
    expect(isWithinWindow(schedule, new Date(2024, 0, 1, 22, 30))).toBe(true);
    expect(isWithinWindow(schedule, tuesdayEarly)).toBe(true);
    expect(isWithinWindow(schedule, new Date(2024, 0, 2, 3, 0))).toBe(false);
  });
});

describe('canPlay', () => {
  it('allows everything when disabled', () => {
    expect(canPlay({ ...base, enabled: false }, 'video', 99999, mondayNoon).allowed).toBe(true);
  });

  it('blocks video outside the allowed window', () => {
    const schedule: Schedule = {
      ...base,
      window: { startMinute: 8 * 60, endMinute: 20 * 60 },
    };
    expect(canPlay(schedule, 'video', 0, mondayNoon)).toEqual({ allowed: true });
    expect(canPlay(schedule, 'video', 0, mondayLate)).toEqual({
      allowed: false,
      reason: 'outside-window',
    });
  });

  it('enforces the daily limit for video', () => {
    const schedule: Schedule = { ...base, dailyLimitMinutes: 30 };
    expect(canPlay(schedule, 'video', 29 * 60, mondayNoon).allowed).toBe(true);
    expect(canPlay(schedule, 'video', 30 * 60, mondayNoon)).toEqual({
      allowed: false,
      reason: 'daily-limit',
    });
  });

  it('never blocks audio — outside the window and over the limit (ADR 0002)', () => {
    const schedule: Schedule = {
      ...base,
      window: { startMinute: 8 * 60, endMinute: 20 * 60 },
      dailyLimitMinutes: 30,
    };
    expect(canPlay(schedule, 'audio', 0, mondayLate)).toEqual({ allowed: true });
    expect(canPlay(schedule, 'audio', 30 * 60, sundayNoon)).toEqual({ allowed: true });
  });

  it('reports remaining budget', () => {
    expect(remainingSecondsToday({ ...base, dailyLimitMinutes: 30 }, 10 * 60)).toBe(20 * 60);
    expect(remainingSecondsToday(base, 10 * 60)).toBeUndefined();
  });

  it('turns the daily budget off together with the schedule (no hard cut)', () => {
    // A leftover limit must not keep cutting video once the schedule is off.
    const schedule: Schedule = { ...base, enabled: false, dailyLimitMinutes: 30 };
    expect(remainingSecondsToday(schedule, 30 * 60)).toBeUndefined();
  });
});

describe('normalizeSchedule', () => {
  it('migrates a pre-ADR 0002 schedule: first window wins, quiet hour is dropped', () => {
    const legacy: Record<string, unknown> = {
      enabled: true,
      windows: [{ days: [1], startMinute: 7 * 60, endMinute: 21 * 60 }],
      dailyLimitMinutes: 0,
      audioOnlyAfterMinute: 19 * 60,
    };
    const normalized = normalizeSchedule(legacy as unknown as Schedule);
    expect(normalized.window).toEqual({ startMinute: 7 * 60, endMinute: 21 * 60 });
    // The legacy “quiet hour” key is not carried over (ADR 0002).
    expect((normalized as unknown as Record<string, unknown>).audioOnlyAfterMinute).toBeUndefined();
  });

  it('treats an empty legacy windows array as no window', () => {
    const legacy: Record<string, unknown> = { enabled: true, windows: [] };
    expect(normalizeSchedule(legacy as unknown as Schedule).window).toBeUndefined();
  });
});