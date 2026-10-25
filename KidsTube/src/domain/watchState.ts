/**
 * Per-video watching state and resume position (ADR 0004) — pure rules.
 *
 * The child's “stan obejrzenia” is derived from the locally stored playback
 * position, never from the unreliable oEmbed duration: new / partially watched
 * (whole minutes) / watched in full. The same position is the resume point, so
 * opening a partially watched video continues exactly where the child stopped.
 */

import type { WatchProgress } from './types';

export type WatchState =
  | { kind: 'new' }
  | { kind: 'partial'; minutes: number }
  | { kind: 'complete' };

/** A video never played is “new”; a completed one stays “complete”. */
export function watchState(progress: WatchProgress | undefined): WatchState {
  if (!progress || (!progress.completed && progress.positionSeconds <= 0)) {
    return { kind: 'new' };
  }
  if (progress.completed) {
    return { kind: 'complete' };
  }
  return { kind: 'partial', minutes: partialMinutes(progress.positionSeconds) };
}

/**
 * Partial progress in whole minutes. There is no reliable total duration
 * (oEmbed does not expose it), so minutes are used instead of a percentage.
 * Any partial progress rounds to at least one minute, so the badge reads
 * “1 min” rather than “0 min”.
 */
export function partialMinutes(seconds: number): number {
  return Math.max(1, Math.round(seconds / 60));
}

/**
 * Record the current playback position. This is where the video will resume
 * (unless it was already completed). Negative positions are clamped, and
 * “last watched” never moves backwards.
 */
export function updateProgress(
  progress: WatchProgress | undefined,
  videoId: string,
  positionSeconds: number,
  at: number,
  durationSeconds?: number,
): WatchProgress {
  const base: WatchProgress = progress ?? {
    videoId,
    positionSeconds: 0,
    completed: false,
    lastWatchedAt: at,
  };
  const duration =
    durationSeconds && durationSeconds > 0 ? durationSeconds : base.durationSeconds;
  return {
    ...base,
    videoId,
    positionSeconds: Math.max(0, positionSeconds),
    durationSeconds: duration,
    lastWatchedAt: Math.max(base.lastWatchedAt, at),
  };
}

/** Mark a video as watched in full (reaching the end, or seeking to it). */
export function markCompleted(progress: WatchProgress, at: number): WatchProgress {
  return { ...progress, completed: true, lastWatchedAt: Math.max(progress.lastWatchedAt, at) };
}

/**
 * Where playback should start, in seconds. A completed video restarts from the
 * beginning; an untouched one starts at zero.
 */
export function resumeSeconds(progress: WatchProgress | undefined): number {
  if (!progress || progress.completed) {
    return 0;
  }
  return Math.max(0, progress.positionSeconds);
}
