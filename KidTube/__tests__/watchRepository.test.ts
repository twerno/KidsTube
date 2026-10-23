import AsyncStorage from '@react-native-async-storage/async-storage';
import { AsyncStorageRepository } from '../src/data/asyncStorageRepository';
import { MemoryRepository } from '../src/data/memoryRepository';
import { mergeWatchStretch } from '../src/domain/watchHistory';
import type { WatchHistoryEntry, WatchProgress } from '../src/domain/types';

const progress: WatchProgress = {
  videoId: 'v1',
  positionSeconds: 125,
  completed: false,
  lastWatchedAt: 1_000,
};

const historyEntry: WatchHistoryEntry = {
  videoId: 'v1',
  dateKey: '2026-10-22',
  title: 'Film',
  firstWatchedAt: 1_000,
  lastWatchedAt: 2_000,
  audioSeconds: 30,
  videoSeconds: 60,
};

describe.each([
  ['memory', () => new MemoryRepository()],
  ['async storage', () => new AsyncStorageRepository()],
])('watch progress & history in %s repository (ADR 0004)', (_name, make) => {
  beforeEach(async () => {
    await AsyncStorage.clear();
  });

  it('upserts progress by video id', async () => {
    const repo = make();
    await repo.init();
    await repo.saveWatchProgress(progress);
    expect(await repo.getWatchProgress('v1')).toEqual(progress);
    expect(await repo.listWatchProgress()).toHaveLength(1);

    await repo.saveWatchProgress({ ...progress, positionSeconds: 200, completed: true });
    const saved = await repo.getWatchProgress('v1');
    expect(saved?.positionSeconds).toBe(200);
    expect(saved?.completed).toBe(true);
    expect(await repo.listWatchProgress()).toHaveLength(1);
  });

  it('upserts history by (video, day) and accumulates modes', async () => {
    const repo = make();
    await repo.init();
    await repo.saveWatchHistory(historyEntry);

    const existing = await repo.getWatchHistoryEntry('v1', '2026-10-22');
    const merged = mergeWatchStretch(existing, {
      video: { id: 'v1', title: 'Film' },
      dateKey: '2026-10-22',
      mode: 'audio',
      seconds: 10,
      at: 3_000,
    });
    await repo.saveWatchHistory(merged);

    const all = await repo.listWatchHistory();
    expect(all).toHaveLength(1);
    expect(all[0].audioSeconds).toBe(40);
    expect(all[0].videoSeconds).toBe(60);
    expect(all[0].lastWatchedAt).toBe(3_000);
  });

  it('keeps a separate entry for a different day', async () => {
    const repo = make();
    await repo.init();
    await repo.saveWatchHistory(historyEntry);
    await repo.saveWatchHistory({ ...historyEntry, dateKey: '2026-10-23' });
    expect(await repo.listWatchHistory()).toHaveLength(2);
  });
});
