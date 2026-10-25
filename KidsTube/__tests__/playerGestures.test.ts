import {
  INITIAL_GESTURE_STATE,
  TAP_SEQUENCE_MS,
  resolveTap,
  seekDeltaForZone,
  seekFeedbackLabel,
  tapZone,
  type GestureState,
} from '../src/domain/playerGestures';

describe('player gesture zones (ADR 0004b)', () => {
  it('splits the surface into 25% / 50% / 25% zones', () => {
    expect(tapZone(0, 1000)).toBe('left');
    expect(tapZone(249, 1000)).toBe('left');
    expect(tapZone(250, 1000)).toBe('center');
    expect(tapZone(500, 1000)).toBe('center');
    expect(tapZone(750, 1000)).toBe('center');
    expect(tapZone(751, 1000)).toBe('right');
    expect(tapZone(1000, 1000)).toBe('right');
  });

  it('treats an unmeasured surface as the centre', () => {
    expect(tapZone(100, 0)).toBe('center');
  });

  it('maps the edges to ±10 s and the centre to no seek', () => {
    expect(seekDeltaForZone('left')).toBe(-10);
    expect(seekDeltaForZone('right')).toBe(10);
    expect(seekDeltaForZone('center')).toBeUndefined();
  });
});

describe('tap sequences (ADR 0004b)', () => {
  it('waits after the first edge tap, then adds another ±10 s per tap', () => {
    let state: GestureState = INITIAL_GESTURE_STATE;
    const first = resolveTap(state, 'right', 1_000);
    expect(first.kind).toBe('wait');
    state = first.state;

    const second = resolveTap(state, 'right', 1_100);
    expect(second).toMatchObject({ kind: 'seek', deltaSeconds: 10, feedbackSeconds: 10 });
    state = second.state;

    const third = resolveTap(state, 'right', 1_200);
    expect(third).toMatchObject({ kind: 'seek', deltaSeconds: 10, feedbackSeconds: 20 });
    state = third.state;

    const fourth = resolveTap(state, 'right', 1_300);
    expect(fourth).toMatchObject({ kind: 'seek', deltaSeconds: 10, feedbackSeconds: 30 });
  });

  it('accumulates negative seeks on the left edge', () => {
    let state: GestureState = INITIAL_GESTURE_STATE;
    state = resolveTap(state, 'left', 1_000).state;
    const second = resolveTap(state, 'left', 1_100);
    const third = resolveTap(second.state, 'left', 1_200);
    expect(second).toMatchObject({ deltaSeconds: -10, feedbackSeconds: -10 });
    expect(third).toMatchObject({ deltaSeconds: -10, feedbackSeconds: -20 });
  });

  it('still accumulates after a 300 ms gap (350 ms window)', () => {
    const first = resolveTap(INITIAL_GESTURE_STATE, 'right', 1_000);
    const second = resolveTap(first.state, 'right', 1_100);
    const third = resolveTap(second.state, 'right', 1_400);
    expect(third).toMatchObject({ kind: 'seek', deltaSeconds: 10, feedbackSeconds: 20 });
  });

  it('starts a new sequence once the tap window has passed', () => {
    const first = resolveTap(INITIAL_GESTURE_STATE, 'right', 1_000);
    const second = resolveTap(first.state, 'right', 1_100);
    const later = resolveTap(second.state, 'right', 1_100 + TAP_SEQUENCE_MS + 1);
    expect(later.kind).toBe('wait');
  });

  it('treats a second centre tap as one single-tap action, not a double tap', () => {
    const first = resolveTap(INITIAL_GESTURE_STATE, 'center', 1_000);
    const second = resolveTap(first.state, 'center', 1_100);
    expect(second).toMatchObject({ kind: 'single', zone: 'center' });
  });

  it('does not combine taps from different edge zones', () => {
    const first = resolveTap(INITIAL_GESTURE_STATE, 'left', 1_000);
    const second = resolveTap(first.state, 'right', 1_100);
    expect(second).toMatchObject({ kind: 'single', zone: 'left' });
  });

  it('formats cumulative feedback labels', () => {
    expect(seekFeedbackLabel(10)).toBe('+10 s');
    expect(seekFeedbackLabel(20)).toBe('+20 s');
    expect(seekFeedbackLabel(-30)).toBe('−30 s');
  });
});
