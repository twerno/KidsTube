/**
 * Parent PIN lockout (ADR 0012) — pure, persisted by the repository.
 *
 * Three consecutive failed verifications lock the parent profile for three
 * minutes. Validation errors in the UI do not call these functions, so they
 * never count as guessing. A success clears both the counter and the lock.
 */

import type { PinGuardState } from './types';

export const MAX_PIN_FAILURES = 3;
export const PIN_LOCK_MS = 3 * 60 * 1000;

export const EMPTY_PIN_GUARD: PinGuardState = { failedAttempts: 0 };

/** Drop an expired lock and reset the counter (ADR 0012: after expiry, 3 tries). */
export function normalizePinGuard(state: PinGuardState, now: number): PinGuardState {
  if (state.lockedUntil != null && state.lockedUntil <= now) {
    return EMPTY_PIN_GUARD;
  }
  return { failedAttempts: state.failedAttempts, lockedUntil: state.lockedUntil };
}

export function canAttempt(state: PinGuardState, now: number): boolean {
  return !(state.lockedUntil != null && state.lockedUntil > now);
}

export function remainingLockMs(state: PinGuardState, now: number): number {
  return Math.max(0, (state.lockedUntil ?? 0) - now);
}

/** A real verification failure. The third one starts the three-minute lock. */
export function recordFailure(state: PinGuardState, now: number): PinGuardState {
  const normalized = normalizePinGuard(state, now);
  if (!canAttempt(normalized, now)) {
    return normalized;
  }
  const failedAttempts = normalized.failedAttempts + 1;
  if (failedAttempts >= MAX_PIN_FAILURES) {
    return { failedAttempts, lockedUntil: now + PIN_LOCK_MS };
  }
  return { failedAttempts };
}

export function recordSuccess(): PinGuardState {
  return EMPTY_PIN_GUARD;
}

/** `m:ss` countdown for the locked Gate/PIN prompt. */
export function formatLockCountdown(remainingMs: number): string {
  const totalSeconds = Math.max(0, Math.ceil(remainingMs / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}
