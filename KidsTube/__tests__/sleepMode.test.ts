import {
  SLEEP_DURATION_MS,
  formatCountdown,
  freshSleepTimer,
  resetSleepOnActivity,
  resetSleepTimer,
  tickSleepTimer,
} from '../src/domain/sleepMode';

describe('sleep mode (ADR 0002)', () => {
  it('starts with a full hour and nothing fired', () => {
    expect(freshSleepTimer()).toEqual({ remainingMs: SLEEP_DURATION_MS, fired: false });
  });

  it('ticks down while playing', () => {
    const next = tickSleepTimer(freshSleepTimer(), 1000, true);
    expect(next).toEqual({ remainingMs: SLEEP_DURATION_MS - 1000, fired: false });
  });

  it('does not tick while paused', () => {
    const state = tickSleepTimer(freshSleepTimer(), 5000, false);
    expect(state).toEqual(freshSleepTimer());
  });

  it('fires exactly once when the countdown reaches zero', () => {
    const almost = tickSleepTimer(freshSleepTimer(), SLEEP_DURATION_MS - 500, true);
    expect(almost.remainingMs).toBe(500);

    const fired = tickSleepTimer(almost, 500, true);
    expect(fired).toEqual({ remainingMs: 0, fired: true });

    // Already fired: stays put even while playing.
    expect(tickSleepTimer(fired, 1000, true)).toEqual(fired);
  });

  it('reset restores a fresh full-hour countdown', () => {
    const fired = tickSleepTimer(freshSleepTimer(), SLEEP_DURATION_MS, true);
    expect(resetSleepTimer()).toEqual(freshSleepTimer());
    expect(fired.fired).toBe(true);
  });

  it('restarts a running countdown on activity but never resurrects a fired one', () => {
    const partly = tickSleepTimer(freshSleepTimer(), 10_000, true);
    expect(resetSleepOnActivity(partly)).toEqual(freshSleepTimer());

    const fired = { remainingMs: 0, fired: true };
    expect(resetSleepOnActivity(fired)).toBe(fired);
  });

  it('formats the countdown as h:mm:ss', () => {
    expect(SLEEP_DURATION_MS).toBe(30 * 60 * 1000);
    expect(formatCountdown(SLEEP_DURATION_MS)).toBe('0:30:00');
    expect(formatCountdown(4 * 60 * 1000 + 59 * 1000)).toBe('0:04:59');
    expect(formatCountdown(0)).toBe('0:00:00');
  });
});