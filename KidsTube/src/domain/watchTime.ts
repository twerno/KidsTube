/**
 * Watch-time accounting for the daily video budget (ADR 0003).
 *
 * The limit counts **actual playback**, not the time the player screen is open:
 * pausing, buffering, loading and network errors must not consume the budget.
 * The player reports its play state (ADR 0003), and this pure accumulator turns
 * wall-clock observations into whole playback seconds.
 *
 * Pure functions, easy to test.
 */

export interface WatchClock {
  /** Seconds of actual playback accumulated, including a sub-second part. */
  seconds: number;
  /** Wall-clock timestamp (ms) of the last observation. */
  observedAt: number;
}

/**
 * Largest interval credited in a single observation (ms). The player reports
 * its state about every 500 ms; a bigger gap means the JS/WebView was paused
 * (app in the background, a stalled render, a frozen page) and we cannot know
 * whether playback continued. Crediting only a small step avoids over-counting
 * hours of background time as watch time.
 */
export const MAX_WATCH_STEP_MS = 2_000;

/** Start a fresh clock. `now` is `Date.now()` at player open. */
export function beginWatch(now: number): WatchClock {
  return { seconds: 0, observedAt: now };
}

/**
 * Move the clock to `now`, crediting the elapsed time only while `counting`.
 * While paused the timestamp is still advanced, so the paused interval is not
 * credited retroactively on the next tick. Any single interval longer than
 * `MAX_WATCH_STEP_MS` (background/stall) is capped, never fully credited.
 */
export function advanceWatch(clock: WatchClock, now: number, counting: boolean): WatchClock {
  const elapsedMs = Math.max(0, now - clock.observedAt);
  const creditedMs = counting ? Math.min(elapsedMs, MAX_WATCH_STEP_MS) : 0;
  return {
    seconds: clock.seconds + creditedMs / 1000,
    observedAt: now,
  };
}

/**
 * Whole playback seconds accumulated since `reported`. Callers report these in
 * increments and then move their `reported` counter to `Math.floor(seconds)`.
 */
export function unreportedSeconds(clock: WatchClock, reported: number): number {
  return Math.max(0, Math.floor(clock.seconds) - reported);
}
