/**
 * Player gesture zones and tap sequences (ADR 0004b) — pure rules.
 *
 * The video surface is split into a 50% centre zone and two 25% edge zones.
 * A single centre tap toggles play/pause; a double tap on an edge seeks by
 * ±10 s. Further taps in the same edge sequence keep adding another ±10 s.
 * Recognition waits ~350 ms for the second tap (the UI owns that timer).
 */

export type TapZone = 'left' | 'center' | 'right';

export const GESTURE_SEEK_SECONDS = 10;

/** How long a tap may wait for the next one in the same gesture sequence. */
export const TAP_SEQUENCE_MS = 350;

export function tapZone(x: number, width: number): TapZone {
  if (width <= 0) {
    return 'center';
  }
  const ratio = Math.min(1, Math.max(0, x / width));
  if (ratio < 0.25) {
    return 'left';
  }
  if (ratio > 0.75) {
    return 'right';
  }
  return 'center';
}

/** Edge zones seek; the centre zone has no seek delta. */
export function seekDeltaForZone(zone: TapZone): number | undefined {
  if (zone === 'left') {
    return -GESTURE_SEEK_SECONDS;
  }
  if (zone === 'right') {
    return GESTURE_SEEK_SECONDS;
  }
  return undefined;
}

export interface PendingTap {
  zone: TapZone;
  at: number;
}

export interface EdgeSequence {
  zone: TapZone;
  at: number;
  /** Seeks already applied in this sequence (1 after the first double tap). */
  steps: number;
}

export interface GestureState {
  /** The first tap, waiting for a possible second one. */
  pending?: PendingTap;
  /** An active edge sequence; extra taps keep adding ±10 s. */
  sequence?: EdgeSequence;
}

export const INITIAL_GESTURE_STATE: GestureState = {};

export type GestureDecision =
  | { kind: 'wait'; state: GestureState }
  | { kind: 'single'; zone: TapZone; state: GestureState }
  | {
      kind: 'seek';
      deltaSeconds: number;
      /** Cumulative label for this sequence (10, 20, 30…). */
      feedbackSeconds: number;
      state: GestureState;
    };

/**
 * Resolve one tap into a gesture decision. The caller stores `decision.state`
 * and, for `wait`, schedules the single-tap action after `windowMs`.
 */
export function resolveTap(
  state: GestureState,
  zone: TapZone,
  now: number,
  windowMs: number = TAP_SEQUENCE_MS,
): GestureDecision {
  const delta = seekDeltaForZone(zone);
  const sequence = state.sequence;
  if (sequence && sequence.zone === zone && now - sequence.at <= windowMs && delta !== undefined) {
    const steps = sequence.steps + 1;
    return {
      kind: 'seek',
      deltaSeconds: delta,
      feedbackSeconds: delta * steps,
      state: { sequence: { zone, at: now, steps } },
    };
  }

  const pending = state.pending;
  if (pending) {
    if (pending.zone === zone && delta !== undefined) {
      return {
        kind: 'seek',
        deltaSeconds: delta,
        feedbackSeconds: delta,
        state: { sequence: { zone, at: now, steps: 1 } },
      };
    }
    // Not a valid edge double tap: finish the pending single tap, ignore this one.
    return { kind: 'single', zone: pending.zone, state: {} };
  }

  return { kind: 'wait', state: { pending: { zone, at: now } } };
}

/** `+10 s`, `+20 s`, `−10 s`… for the seek feedback pill. */
export function seekFeedbackLabel(seconds: number): string {
  if (seconds > 0) {
    return `+${seconds} s`;
  }
  if (seconds < 0) {
    return `−${Math.abs(seconds)} s`;
  }
  return '0 s';
}
