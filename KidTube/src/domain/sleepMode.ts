/**
 * Sleep mode (ADR 0002): a 1 h countdown shown on the audio screen.
 *
 *  - The counter is always visible while in audio mode.
 *  - When the countdown reaches zero, playback stops, the audio screen stays.
 *  - The child may resume; resuming (or resetting) starts a fresh 1 h countdown.
 *  - It is a shut-off switch after falling asleep, never a limit — it does not
 *    collide with “audio without limits”.
 *
 * Pure transitions, unit-tested; the UI in `ui/PlayerScreen.tsx` only calls
 * these functions.
 */

export const SLEEP_DURATION_MS = 60 * 60 * 1000;

export interface SleepTimerState {
  /** Milliseconds left on the current countdown. */
  remainingMs: number;
  /** True once the countdown fired and playback was stopped. */
  fired: boolean;
}

export function freshSleepTimer(): SleepTimerState {
  return { remainingMs: SLEEP_DURATION_MS, fired: false };
}

/**
 * Advance the countdown by `dt` while playback is running.
 * Returns the same state when the timer is paused, already fired or empty.
 */
export function tickSleepTimer(
  state: SleepTimerState,
  dt: number,
  playing: boolean,
): SleepTimerState {
  if (!playing || state.fired || state.remainingMs <= 0) {
    return state;
  }
  const next = Math.max(0, state.remainingMs - dt);
  return next <= 0 ? { remainingMs: 0, fired: true } : { remainingMs: next, fired: false };
}

/** Reset the countdown to a full hour (manual reset or resuming playback). */
export function resetSleepTimer(): SleepTimerState {
  return freshSleepTimer();
}

/** Render the countdown as h:mm:ss (e.g. "1:00:00", "0:04:59"). */
export function formatCountdown(totalMs: number): string {
  const totalSeconds = Math.max(0, Math.round(totalMs / 1000));
  const h = String(Math.floor(totalSeconds / 3600));
  const m = String(Math.floor((totalSeconds % 3600) / 60)).padStart(2, '0');
  const s = String(totalSeconds % 60).padStart(2, '0');
  return `${h}:${m}:${s}`;
}