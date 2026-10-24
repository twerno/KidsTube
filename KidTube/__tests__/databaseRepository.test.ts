import AsyncStorage from '@react-native-async-storage/async-storage';
import { AsyncStorageRepository } from '../src/data/asyncStorageRepository';
import { MemoryRepository } from '../src/data/memoryRepository';
import type { Channel, DatabaseSnapshot, Video } from '../src/domain/types';

const PENDING_KEY = '@kidtube/replace-pending/v1';
const ROLLBACK_KEY = '@kidtube/replace-rollback/v1';

const OLD_CHANNEL: Channel = {
  id: 'UC_OLD',
  title: 'Stary kanał',
  policy: 'manual',
  status: 'allowed',
  addedAt: 1,
  muted: true,
};

const OLD_VIDEO: Video = {
  id: 'v-old',
  channelId: 'UC_OLD',
  title: 'Stary film',
  status: 'allowed',
  source: 'rss',
  addedAt: 1,
};

const SNAPSHOT: DatabaseSnapshot = {
  settings: {
    childName: 'Staś',
    configured: true,
    schedule: { enabled: false, dailyLimitMinutes: 0 },
    youtubeLinkHandlerEnabled: false,
  },
  channels: [
    {
      id: 'UC_NEW',
      title: 'Nowy kanał',
      policy: 'auto_approve',
      status: 'allowed',
      addedAt: 10,
    },
  ],
  channelProposals: [
    {
      id: 'UC_PROP',
      channelId: 'UC_PROP',
      rawUrl: 'https://www.youtube.com/@prop',
      title: 'Propozycja',
      resolved: true,
      addedAt: 11,
    },
  ],
  videos: [
    {
      id: 'v-new',
      channelId: 'UC_NEW',
      title: 'Nowy film',
      status: 'allowed',
      source: 'manual',
      addedAt: 12,
    },
  ],
  decisions: [{ videoId: 'v-new', outcome: 'retract', source: 'manual', at: 13 }],
  usage: { '2026-10-24': 120 },
  watchProgress: [
    { videoId: 'v-new', positionSeconds: 30, completed: false, lastWatchedAt: 14 },
  ],
  watchHistory: [
    {
      videoId: 'v-new',
      dateKey: '2026-10-24',
      title: 'Nowy film',
      firstWatchedAt: 14,
      lastWatchedAt: 15,
      audioSeconds: 20,
      videoSeconds: 40,
    },
  ],
  extraTime: { dateKey: '2026-10-24', grantedSeconds: 900, remainingSeconds: 600 },
};

const ids = (channels: Channel[]) => channels.map(channel => channel.id);

describe.each([
  ['memory', () => new MemoryRepository()],
  ['async storage', () => new AsyncStorageRepository()],
])('database snapshot and replace in %s repository (ADR 0017)', (_name, make) => {
  beforeEach(async () => {
    await AsyncStorage.clear();
  });

  it('replaces the whole database, dropping data absent from the snapshot', async () => {
    const repo = make();
    await repo.init();
    await repo.updateSettings({ childName: 'Stare imię' });
    await repo.upsertChannel(OLD_CHANNEL);
    await repo.upsertVideos([OLD_VIDEO]);

    await repo.replaceAll(SNAPSHOT);

    expect(ids(await repo.listChannels())).toEqual(['UC_NEW']);
    expect((await repo.getSettings()).childName).toBe('Staś');
    expect((await repo.getVideo('v-old'))).toBeUndefined();
    expect(await repo.getUsage('2026-10-24')).toBe(120);
    expect((await repo.listWatchHistory())[0]?.audioSeconds).toBe(20);
    expect(await repo.getExtraTime()).toEqual(SNAPSHOT.extraTime);
  });

  it('snapshots every collection', async () => {
    const repo = make();
    await repo.init();
    await repo.replaceAll(SNAPSHOT);
    expect(await repo.snapshotAll()).toEqual(SNAPSHOT);
  });

  it('returns copies that cannot mutate the repository', async () => {
    const repo = make();
    await repo.init();
    await repo.replaceAll(SNAPSHOT);
    const snapshot = await repo.snapshotAll();
    snapshot.channels[0].title = 'Zmieniony z zewnątrz';
    snapshot.videos.push(OLD_VIDEO);
    expect((await repo.listChannels())[0].title).toBe('Nowy kanał');
    expect(await repo.getVideo('v-old')).toBeUndefined();
  });
});

describe.each([
  ['memory', () => new MemoryRepository()],
  ['async storage', () => new AsyncStorageRepository()],
])('bulk decisions in %s repository', (_name, make) => {
  beforeEach(async () => {
    await AsyncStorage.clear();
  });

  it('appends every decision in order and updates the cached statuses', async () => {
    const repo = make();
    await repo.init();
    await repo.upsertVideos([
      {
        id: 'v1',
        channelId: 'UC1',
        title: 'v1',
        status: 'pending',
        source: 'rss',
        addedAt: 0,
      },
      {
        id: 'v2',
        channelId: 'UC1',
        title: 'v2',
        status: 'pending',
        source: 'rss',
        addedAt: 0,
      },
    ]);

    await repo.recordDecisions([
      { videoId: 'v1', outcome: 'allow', source: 'manual', at: 10 },
      { videoId: 'v2', outcome: 'reject', source: 'manual', at: 11 },
    ]);

    expect((await repo.listDecisions()).map(decision => decision.videoId)).toEqual(['v1', 'v2']);
    expect((await repo.getVideo('v1'))?.status).toBe('allowed');
    expect((await repo.getVideo('v2'))?.status).toBe('blocked');
  });
});

describe('failed replace rolls back (ADR 0017)', () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
  });

  it('restores the previous database when writing fails', async () => {
    const repo = new AsyncStorageRepository();
    await repo.init();
    await repo.updateSettings({ childName: 'Stare imię' });
    await repo.upsertChannel(OLD_CHANNEL);
    await repo.upsertVideos([OLD_VIDEO]);

    const spy = jest
      .spyOn(AsyncStorage, 'setMany')
      .mockRejectedValueOnce(new Error('disk full'));

    await expect(repo.replaceAll(SNAPSHOT)).rejects.toThrow('disk full');
    spy.mockRestore();

    expect(ids(await repo.listChannels())).toEqual(['UC_OLD']);
    expect((await repo.getSettings()).childName).toBe('Stare imię');
    expect(await AsyncStorage.getItem(PENDING_KEY)).toBeNull();
    expect(await AsyncStorage.getItem(ROLLBACK_KEY)).toBeNull();

    // A fresh instance must see the old database, not a partial import.
    const reopened = new AsyncStorageRepository();
    await reopened.init();
    expect(ids(await reopened.listChannels())).toEqual(['UC_OLD']);
  });
});

describe('interrupted replace is finished on the next start (ADR 0017)', () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
  });

  it('applies the pending snapshot and clears the markers', async () => {
    await AsyncStorage.setItem(PENDING_KEY, JSON.stringify(SNAPSHOT));
    await AsyncStorage.setItem(ROLLBACK_KEY, JSON.stringify({ ...SNAPSHOT, channels: [] }));

    const repo = new AsyncStorageRepository();
    await repo.init();

    expect(ids(await repo.listChannels())).toEqual(['UC_NEW']);
    expect(await AsyncStorage.getItem(PENDING_KEY)).toBeNull();
    expect(await AsyncStorage.getItem(ROLLBACK_KEY)).toBeNull();
  });
});
