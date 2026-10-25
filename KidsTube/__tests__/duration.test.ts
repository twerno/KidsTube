import { formatCompactDuration, formatDurationRatio } from '../src/domain/duration';

describe('compact duration labels (ADR 0004a)', () => {
  it('formats compact durations', () => {
    expect(formatCompactDuration(0)).toBe('0m');
    expect(formatCompactDuration(42)).toBe('<1m');
    expect(formatCompactDuration(90)).toBe('1m');
    expect(formatCompactDuration(3_600)).toBe('1h:00m');
    expect(formatCompactDuration(6_000)).toBe('1h:40m');
  });

  it('puts the current position next to the cached total duration', () => {
    expect(formatDurationRatio(60, 6_000)).toBe('1m / 1h:40m');
    expect(formatDurationRatio(90, 3_600)).toBe('1m / 1h:00m');
    expect(formatDurationRatio(0, 3_600)).toBe('0m / 1h:00m');
    // Older progress / videos without a cached duration keep just the first value.
    expect(formatDurationRatio(60)).toBe('1m');
  });
});
