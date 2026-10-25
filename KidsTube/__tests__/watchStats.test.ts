import { averageStats, lastDayKeys, statsForDays, todayStats } from '../src/domain/watchStats';
import type { WatchHistoryEntry } from '../src/domain/types';
import { dateKey } from '../src/domain/schedule';

const NOW = new Date(2026, 9, 23, 12, 0, 0).getTime(); // 2026-10-23, local noon

const entry = (overrides: Partial<WatchHistoryEntry> & Pick<WatchHistoryEntry, 'dateKey'>): WatchHistoryEntry => ({
  videoId: `${overrides.dateKey}-video`,
  title: 'Film',
  firstWatchedAt: 0,
  lastWatchedAt: 0,
  audioSeconds: 0,
  videoSeconds: 0,
  ...overrides,
});

const day = (offset: number) => {
  const date = new Date(NOW);
  date.setDate(date.getDate() - offset);
  return dateKey(date);
};

describe('watch statistics (ADR 0016)', () => {
  it('lists seven local days, today first', () => {
    expect(lastDayKeys(NOW, 7)).toEqual([0, 1, 2, 3, 4, 5, 6].map(day));
  });

  it('sums today only and splits video from audio', () => {
    const entries = [
      entry({ dateKey: day(0), videoSeconds: 600, audioSeconds: 120 }),
      entry({ dateKey: day(0), videoSeconds: 60, videoId: 'second' }),
      entry({ dateKey: day(1), videoSeconds: 900 }),
    ];
    expect(todayStats(entries, NOW)).toEqual({
      videoSeconds: 660,
      audioSeconds: 120,
      videoCount: 2,
      audioCount: 1,
    });
  });

  it('counts a material in both modes when it was played both ways', () => {
    const entries = [entry({ dateKey: day(0), videoSeconds: 300, audioSeconds: 300 })];
    expect(todayStats(entries, NOW)).toEqual({
      videoSeconds: 300,
      audioSeconds: 300,
      videoCount: 1,
      audioCount: 1,
    });
  });

  it('averages over seven calendar days, counting empty days as zero', () => {
    const entries = [
      entry({ dateKey: day(0), videoSeconds: 700, audioSeconds: 70 }),
      entry({ dateKey: day(3), videoSeconds: 700 }),
      entry({ dateKey: day(7), videoSeconds: 7000 }),
    ];
    expect(averageStats(entries, NOW)).toEqual({
      videoSeconds: 200,
      audioSeconds: 10,
      videoCount: 2 / 7,
      audioCount: 1 / 7,
    });
  });

  it('ignores entries outside the window', () => {
    const entries = [entry({ dateKey: day(6), videoSeconds: 70 }), entry({ dateKey: day(7), videoSeconds: 700 })];
    expect(statsForDays(entries, lastDayKeys(NOW, 7)).videoSeconds).toBe(70);
  });
});
