import {
  EMPTY_PIN_GUARD,
  PIN_LOCK_MS,
  canAttempt,
  formatLockCountdown,
  normalizePinGuard,
  recordFailure,
  recordSuccess,
  remainingLockMs,
} from '../src/domain/pinGuard';

describe('parent PIN lockout (ADR 0012)', () => {
  it('locks after three consecutive failures', () => {
    const now = 10_000;
    const once = recordFailure(EMPTY_PIN_GUARD, now);
    const twice = recordFailure(once, now + 1_000);
    const thrice = recordFailure(twice, now + 2_000);
    expect(once.lockedUntil).toBeUndefined();
    expect(twice.lockedUntil).toBeUndefined();
    expect(thrice.lockedUntil).toBe(now + 2_000 + PIN_LOCK_MS);
    expect(canAttempt(thrice, now + 3_000)).toBe(false);
  });

  it('does not count attempts while locked, and unlocks after three minutes', () => {
    const now = 10_000;
    const locked = recordFailure(recordFailure(recordFailure(EMPTY_PIN_GUARD, now), now), now);
    const during = recordFailure(locked, now + 30_000);
    expect(during).toEqual(locked);
    expect(canAttempt(locked, now + PIN_LOCK_MS - 1)).toBe(false);
    expect(normalizePinGuard(locked, now + PIN_LOCK_MS)).toEqual(EMPTY_PIN_GUARD);
    expect(canAttempt(locked, now + PIN_LOCK_MS)).toBe(true);
  });

  it('a success clears the counter and any lock', () => {
    const once = recordFailure(EMPTY_PIN_GUARD, 1_000);
    expect(recordSuccess()).toEqual(EMPTY_PIN_GUARD);
    expect(once.failedAttempts).toBe(1);
  });

  it('reports the remaining lock and formats m:ss', () => {
    expect(remainingLockMs({ failedAttempts: 3, lockedUntil: 61_000 }, 1_000)).toBe(60_000);
    expect(formatLockCountdown(60_000)).toBe('1:00');
    expect(formatLockCountdown(9_000)).toBe('0:09');
  });
});
