import {
  MAX_WATCH_STEP_MS,
  advanceWatch,
  beginWatch,
  unreportedSeconds,
} from '../src/domain/watchTime';

describe('watch time (ADR 0003: limit counts actual playback)', () => {
  it('starts at zero with the observation timestamp', () => {
    expect(beginWatch(1_000)).toEqual({ seconds: 0, observedAt: 1_000 });
  });

  it('accumulates wall time while counting', () => {
    let clock = beginWatch(0);
    clock = advanceWatch(clock, 1_000, true);
    clock = advanceWatch(clock, 3_000, true);
    expect(clock.seconds).toBe(3);
  });

  it('does not accumulate while paused, but keeps the clock fresh', () => {
    let clock = beginWatch(0);
    clock = advanceWatch(clock, 10_000, false);
    expect(clock.seconds).toBe(0);
    // Time spent paused must not be credited on resume.
    clock = advanceWatch(clock, 11_000, true);
    expect(clock.seconds).toBe(1);
  });

  it('ignores a backwards jump in the observation timestamp', () => {
    let clock = beginWatch(5_000);
    clock = advanceWatch(clock, 4_000, true);
    expect(clock.seconds).toBe(0);
    expect(clock.observedAt).toBe(4_000);
  });

  it('caps a single step so background/stall time is not credited', () => {
    let clock = beginWatch(0);
    // Ten minutes pass between observations while the last state was “playing”
    // (e.g. the app was backgrounded). Only one small step is credited.
    clock = advanceWatch(clock, 10 * 60_000, true);
    expect(clock.seconds).toBe(MAX_WATCH_STEP_MS / 1000);

    // Normal polling (0.5 s) is credited in full.
    clock = advanceWatch(clock, 10 * 60_000 + 500, true);
    expect(clock.seconds).toBe(MAX_WATCH_STEP_MS / 1000 + 0.5);
  });

  it('reports only whole seconds not yet reported', () => {
    let clock = beginWatch(0);
    clock = advanceWatch(clock, 1_500, true);
    expect(unreportedSeconds(clock, 0)).toBe(1);
    // After reporting 1, the half second is not rounded up yet.
    expect(unreportedSeconds(clock, 1)).toBe(0);
    clock = advanceWatch(clock, 2_000, true);
    expect(unreportedSeconds(clock, 1)).toBe(1);
  });

  it('never reports a negative amount', () => {
    const clock = advanceWatch(beginWatch(0), 500, true);
    expect(unreportedSeconds(clock, 5)).toBe(0);
  });
});
