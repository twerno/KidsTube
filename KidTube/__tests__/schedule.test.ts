import type { Schedule, TimeWindow } from '../src/domain/types';
import {
  canPlay,
  dateKey,
  formatHHMM,
  isAudioOnlyNow,
  isWithinWindows,
  minuteOfDay,
  parseHHMM,
  remainingSecondsToday,
} from '../src/domain/schedule';

// 2024-01-01 is a Monday (getDay() === 1).
const mondayNoon = new Date(2024, 0, 1, 12, 0);
const mondayLate = new Date(2024, 0, 1, 23, 30);
const tuesdayEarly = new Date(2024, 0, 2, 0, 30);

const base: Schedule = { enabled: true, windows: [], dailyLimitMinutes: 0 };

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

describe('isWithinWindows', () => {
  it('is always true when there are no windows', () => {
    expect(isWithinWindows([], mondayNoon)).toBe(true);
  });

  it('matches a simple daytime window', () => {
    const window: TimeWindow = { days: [1], startMinute: 8 * 60, endMinute: 20 * 60 };
    expect(isWithinWindows([window], mondayNoon)).toBe(true);
    expect(isWithinWindows([window], mondayLate)).toBe(false);
  });

  it('ignores windows on other days', () => {
    const window: TimeWindow = { days: [0], startMinute: 8 * 60, endMinute: 20 * 60 };
    expect(isWithinWindows([window], mondayNoon)).toBe(false);
  });

  it('handles windows wrapping past midnight', () => {
    // Monday 22:00 -> 02:00
    const window: TimeWindow = {
      days: [1],
      startMinute: 22 * 60,
      endMinute: 2 * 60,
    };
    expect(isWithinWindows([window], new Date(2024, 0, 1, 22, 30))).toBe(true);
    expect(isWithinWindows([window], tuesdayEarly)).toBe(true);
    expect(isWithinWindows([window], new Date(2024, 0, 2, 3, 0))).toBe(false);
  });
});

describe('canPlay', () => {
  it('allows everything when disabled', () => {
    expect(canPlay({ ...base, enabled: false }, 99999, mondayNoon).allowed).toBe(true);
  });

  it('blocks outside the allowed window', () => {
    const schedule: Schedule = {
      ...base,
      windows: [{ days: [1], startMinute: 8 * 60, endMinute: 20 * 60 }],
    };
    expect(canPlay(schedule, 0, mondayNoon)).toEqual({ allowed: true });
    expect(canPlay(schedule, 0, mondayLate)).toEqual({
      allowed: false,
      reason: 'outside-window',
    });
  });

  it('enforces the daily limit', () => {
    const schedule: Schedule = { ...base, dailyLimitMinutes: 30 };
    expect(canPlay(schedule, 29 * 60, mondayNoon).allowed).toBe(true);
    expect(canPlay(schedule, 30 * 60, mondayNoon)).toEqual({
      allowed: false,
      reason: 'daily-limit',
    });
  });

  it('reports remaining budget', () => {
    expect(remainingSecondsToday({ ...base, dailyLimitMinutes: 30 }, 10 * 60)).toBe(20 * 60);
    expect(remainingSecondsToday(base, 10 * 60)).toBeUndefined();
  });
});

describe('isAudioOnlyNow', () => {
  it('is false when disabled or unset', () => {
    expect(isAudioOnlyNow(base, mondayLate)).toBe(false);
    expect(isAudioOnlyNow({ ...base, enabled: false, audioOnlyAfterMinute: 0 }, mondayLate)).toBe(
      false,
    );
  });

  it('switches to audio-only after the threshold', () => {
    const schedule: Schedule = { ...base, audioOnlyAfterMinute: 19 * 60 };
    expect(isAudioOnlyNow(schedule, new Date(2024, 0, 1, 18, 59))).toBe(false);
    expect(isAudioOnlyNow(schedule, new Date(2024, 0, 1, 19, 0))).toBe(true);
  });
});
