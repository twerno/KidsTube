/**
 * Pure playback math used by the transport buttons on the audio screen.
 */

/**
 * Target position after jumping `deltaSeconds` from `position`, clamped to
 * [0, duration]. When the duration is unknown (<= 0) only the lower bound is
 * enforced, so a back-jump still works on a still-loading player.
 */
export function relativeSeek(position: number, deltaSeconds: number, duration: number): number {
  const target = position + deltaSeconds;
  if (duration > 0) {
    return Math.min(Math.max(0, target), duration);
  }
  return Math.max(0, target);
}