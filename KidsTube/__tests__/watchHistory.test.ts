import {
  entryTotalSeconds,
  groupWatchHistory,
  mergeWatchStretch,
} from '../src/domain/watchHistory';
import type { Video, WatchHistoryEntry } from '../src/domain/types';

const video: Pick<Video, 'id' | 'channelId' | 'channelTitle' | 'title' | 'thumbnailUrl'> = {
  id: 'v1',
  channelId: 'UC1',
  channelTitle: 'Kanał',
  title: 'Film',
  thumbnailUrl: 'https://img/v1.jpg',
};

describe('viewing history aggregation (ADR 0004)', () => {
  it('creates an entry from a stretch, splitting time by mode', () => {
    const entry = mergeWatchStretch(undefined, {
      video,
      dateKey: '2026-10-22',
      mode: 'video',
      seconds: 120,
      at: 1_000,
    });
    expect(entry).toEqual({
      videoId: 'v1',
      dateKey: '2026-10-22',
      title: 'Film',
      channelTitle: 'Kanał',
      thumbnailUrl: 'https://img/v1.jpg',
      firstWatchedAt: 1_000,
      lastWatchedAt: 1_000,
      audioSeconds: 0,
      videoSeconds: 120,
    });
  });

  it('accumulates repeated watching on the same day, keeping the first timestamp', () => {
    const first = mergeWatchStretch(undefined, {
      video,
      dateKey: '2026-10-22',
      mode: 'video',
      seconds: 60,
      at: 1_000,
    });
    const second = mergeWatchStretch(first, {
      video,
      dateKey: '2026-10-22',
      mode: 'audio',
      seconds: 30,
      at: 5_000,
    });
    expect(second.videoSeconds).toBe(60);
    expect(second.audioSeconds).toBe(30);
    expect(second.firstWatchedAt).toBe(1_000);
    expect(second.lastWatchedAt).toBe(5_000);
    expect(entryTotalSeconds(second)).toBe(90);
  });

  it('groups by day, newest first, materials newest first, with totals', () => {
    const make = (
      videoId: string,
      dateKey: string,
      lastWatchedAt: number,
      seconds: number,
    ): WatchHistoryEntry => ({
      videoId,
      dateKey,
      title: videoId,
      firstWatchedAt: lastWatchedAt,
      lastWatchedAt,
      audioSeconds: 0,
      videoSeconds: seconds,
    });
    const days = groupWatchHistory([
      make('a', '2026-10-21', 100, 60),
      make('b', '2026-10-22', 200, 30),
      make('c', '2026-10-22', 300, 90),
    ]);
    expect(days.map(d => d.dateKey)).toEqual(['2026-10-22', '2026-10-21']);
    expect(days[0].entries.map(e => e.videoId)).toEqual(['c', 'b']);
    expect(days[0].totalSeconds).toBe(120);
    expect(days[0].videoSeconds).toBe(120);
    expect(days[0].audioSeconds).toBe(0);
    expect(days[1].totalSeconds).toBe(60);
  });
});
