/**
 * Sleep mode (ADR 0002 / 0021): a 30 min countdown shown on the audio screen.
 *
 *  - The counter is always visible while in audio mode.
 *  - Any interaction on the audio screen restarts the countdown (ADR 0021):
 *    the child is still awake. Once it fired, only “Wznów” brings it back.
 *  - There is no separate reset button: every touch already resets the timer.
 *  - When the countdown reaches zero, playback stops, the audio screen stays.
 *  - It is a shut-off switch after falling asleep, never a limit — it does not
 *    collide with “audio without limits”.
 *
 * Pure transitions, unit-tested; the UI in `ui/PlayerScreen.tsx` only calls
 * these functions.
 */

/** 30 minutes: a bedtime shut-off after the last interaction. */
export const SLEEP_DURATION_MS = 30 * 60 * 1000;

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

/** Reset the countdown to a full 30 minutes (resuming playback). */
export function resetSleepTimer(): SleepTimerState {
  return freshSleepTimer();
}

/**
 * Interaction on the audio screen restarts a running countdown. A fired timer
 * stays fired: after the shut-off point, playback requires an explicit resume,
 * so a random touch cannot silently start the film again (ADR 0021).
 */
export function resetSleepOnActivity(state: SleepTimerState): SleepTimerState {
  return state.fired ? state : freshSleepTimer();
}

/** Render the countdown as h:mm:ss (e.g. "0:30:00", "0:04:59"). */
export function formatCountdown(totalMs: number): string {
  const totalSeconds = Math.max(0, Math.round(totalMs / 1000));
  const h = String(Math.floor(totalSeconds / 3600));
  const m = String(Math.floor((totalSeconds % 3600) / 60)).padStart(2, '0');
  const s = String(totalSeconds % 60).padStart(2, '0');
  return `${h}:${m}:${s}`;
}