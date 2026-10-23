import {
  markCompleted,
  partialMinutes,
  resumeSeconds,
  updateProgress,
  watchState,
} from '../src/domain/watchState';
import type { WatchProgress } from '../src/domain/types';

const progress = (positionSeconds: number, completed = false): WatchProgress => ({
  videoId: 'v1',
  positionSeconds,
  completed,
  lastWatchedAt: 100,
});

describe('watch state and resume (ADR 0004)', () => {
  it('treats a video with no progress as new', () => {
    expect(watchState(undefined)).toEqual({ kind: 'new' });
    expect(watchState(progress(0))).toEqual({ kind: 'new' });
  });

  it('reports partial progress in whole minutes (at least one)', () => {
    expect(watchState(progress(30))).toEqual({ kind: 'partial', minutes: 1 });
    expect(watchState(progress(90))).toEqual({ kind: 'partial', minutes: 2 });
    expect(partialMinutes(600)).toBe(10);
  });

  it('reports a completed video as complete, even if it stopped early', () => {
    expect(watchState(progress(10, true))).toEqual({ kind: 'complete' });
  });

  it('records the latest position and advances lastWatchedAt', () => {
    const first = updateProgress(undefined, 'v1', 30, 1_000);
    expect(first).toEqual({
      videoId: 'v1',
      positionSeconds: 30,
      completed: false,
      lastWatchedAt: 1_000,
    });

    // A seek backwards moves the resume point back too — “where you stopped”.
    const second = updateProgress(first, 'v1', 12, 2_000);
    expect(second.positionSeconds).toBe(12);
    expect(second.lastWatchedAt).toBe(2_000);

    // Never moves “last watched” backwards; clamps negative positions.
    expect(updateProgress(second, 'v1', 5, 1_500).lastWatchedAt).toBe(2_000);
    expect(updateProgress(second, 'v1', -10, 3_000).positionSeconds).toBe(0);
  });

  it('keeps the last known duration so the resume slider lands correctly', () => {
    const first = updateProgress(undefined, 'v1', 30, 1_000, 300);
    expect(first.durationSeconds).toBe(300);
    // A later report without duration keeps the stored one; a real one updates it.
    expect(updateProgress(first, 'v1', 40, 2_000).durationSeconds).toBe(300);
    expect(updateProgress(first, 'v1', 40, 2_000, 305).durationSeconds).toBe(305);
    expect(updateProgress(first, 'v1', 40, 2_000, 0).durationSeconds).toBe(300);
  });

  it('marks a video complete without losing its position', () => {
    const done = markCompleted(updateProgress(undefined, 'v1', 120, 1_000), 2_000);
    expect(done.completed).toBe(true);
    expect(done.positionSeconds).toBe(120);
    expect(done.lastWatchedAt).toBe(2_000);
  });

  it('resumes a partial video where it stopped and restarts a completed one', () => {
    expect(resumeSeconds(undefined)).toBe(0);
    expect(resumeSeconds(progress(0))).toBe(0);
    expect(resumeSeconds(progress(125))).toBe(125);
    expect(resumeSeconds(progress(125, true))).toBe(0);
  });
});
