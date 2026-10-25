import type { ExtraTimePool, Schedule } from '../src/domain/types';
import {
  canPlay,
  consumeVideoSeconds,
  emptyExtraTime,
  grantExtraTime,
  hasTimeGate,
  normalizeExtraTime,
  remainingSecondsToday,
} from '../src/domain/schedule';

const daytime: Schedule = {
  enabled: true,
  window: { startMinute: 8 * 60, endMinute: 20 * 60 },
  dailyLimitMinutes: 30,
};
const noon = new Date(2024, 0, 1, 12, 0);
const late = new Date(2024, 0, 1, 21, 0);
const day = '2024-01-01';

const pool = (granted: number, remaining = granted): ExtraTimePool => ({
  dateKey: day,
  grantedSeconds: granted,
  remainingSeconds: remaining,
});

describe('extra time pool (ADR 0011)', () => {
  it('expires a pool from another day', () => {
    expect(normalizeExtraTime(pool(900), '2024-01-02')).toEqual(emptyExtraTime('2024-01-02'));
  });

  it('sums consecutive grants', () => {
    const first = grantExtraTime(undefined, day, 15 * 60);
    const second = grantExtraTime(first, day, 60 * 60);
    expect(second.grantedSeconds).toBe(75 * 60);
    expect(second.remainingSeconds).toBe(75 * 60);
  });

  it('uses the base limit first inside the window', () => {
    const initial = pool(15 * 60);
    const unchanged = consumeVideoSeconds(daytime, noon, 5 * 60, initial, 10 * 60);
    expect(unchanged.remainingSeconds).toBe(15 * 60);
  });

  it('spills over into the pool when a stretch crosses the base limit', () => {
    const initial = pool(15 * 60);
    const next = consumeVideoSeconds(daytime, noon, 29 * 60, initial, 2 * 60);
    expect(next.remainingSeconds).toBe(14 * 60);
  });

  it('consumes the pool outside the window', () => {
    const next = consumeVideoSeconds(daytime, late, 0, pool(15 * 60), 10 * 60);
    expect(next.remainingSeconds).toBe(5 * 60);
  });

  it('does not consume the pool inside a window without a base limit', () => {
    const noLimit: Schedule = { enabled: true, window: daytime.window, dailyLimitMinutes: 0 };
    const next = consumeVideoSeconds(noLimit, noon, 0, pool(15 * 60), 10 * 60);
    expect(next.remainingSeconds).toBe(15 * 60);
  });

  it('unlocks the window and an exhausted limit while the pool is positive', () => {
    expect(canPlay(daytime, 'video', 30 * 60, late, pool(60))).toEqual({ allowed: true });
    expect(canPlay(daytime, 'video', 30 * 60, noon, pool(60))).toEqual({ allowed: true });
    expect(canPlay(daytime, 'video', 30 * 60, late, pool(60, 0))).toEqual({
      allowed: false,
      reason: 'outside-window',
    });
    expect(canPlay(daytime, 'video', 31 * 60, noon, pool(60, 0))).toEqual({
      allowed: false,
      reason: 'daily-limit',
    });
  });

  it('counts the effective remaining time: base + pool in the window, pool outside', () => {
    expect(remainingSecondsToday(daytime, 10 * 60, pool(15 * 60), noon)).toBe(35 * 60);
    expect(remainingSecondsToday(daytime, 10 * 60, pool(15 * 60), late)).toBe(15 * 60);
    expect(remainingSecondsToday(daytime, 10 * 60, pool(15 * 60, 0), late)).toBe(0);
  });

  it('shows the pool as the only counter when there is no base limit', () => {
    const noLimit: Schedule = { enabled: true, window: daytime.window, dailyLimitMinutes: 0 };
    expect(remainingSecondsToday(noLimit, 10 * 60, pool(15 * 60), noon)).toBe(15 * 60);
    expect(remainingSecondsToday(noLimit, 10 * 60, undefined, noon)).toBeUndefined();
  });

  it('offers extra time only when the schedule has a gate', () => {
    expect(hasTimeGate(daytime)).toBe(true);
    expect(hasTimeGate({ enabled: true, dailyLimitMinutes: 30 })).toBe(true);
    expect(hasTimeGate({ enabled: true })).toBe(false);
    expect(hasTimeGate({ enabled: false, dailyLimitMinutes: 30 })).toBe(false);
  });
});
