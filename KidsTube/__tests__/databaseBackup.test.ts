import { NativeModules } from 'react-native';
import { MemoryRepository } from '../src/data/memoryRepository';
import { BACKUP_FORMAT, parseBackup } from '../src/domain/backup';
import {
  applyBackup,
  backupFileName,
  exportDatabase,
  pickDatabase,
} from '../src/services/databaseBackup';
import type { DatabaseSnapshot } from '../src/domain/types';

interface NativeBackup {
  saveJson: (fileName: string, content: string) => Promise<string | null>;
  openJson: () => Promise<{ content?: string; name?: string } | null>;
}

const nativeHolder = NativeModules as { KidTubeBackup?: NativeBackup };

const SNAPSHOT: DatabaseSnapshot = {
  settings: {
    childName: 'Staś',
    configured: false,
    schedule: { enabled: false, dailyLimitMinutes: 0 },
    youtubeLinkHandlerEnabled: false,
  },
  channels: [
    { id: 'UC_NEW', title: 'Nowy kanał', policy: 'manual', status: 'allowed', addedAt: 10 },
  ],
  channelProposals: [],
  videos: [
    {
      id: 'v-new',
      channelId: 'UC_NEW',
      title: 'Nowy film',
      status: 'allowed',
      source: 'manual',
      addedAt: 11,
    },
  ],
  decisions: [{ videoId: 'v-new', outcome: 'allow', source: 'manual', at: 12 }],
  usage: { '2026-10-24': 60 },
  watchProgress: [],
  watchHistory: [],
  extraTime: null,
};

const validFile = (): string =>
  JSON.stringify({
    format: BACKUP_FORMAT,
    schemaVersion: 1,
    exportedAt: new Date().toISOString(),
    appVersion: '0.9.0',
    data: SNAPSHOT,
  });

const seeded = async (): Promise<MemoryRepository> => {
  const repo = new MemoryRepository();
  await repo.init();
  await repo.replaceAll(SNAPSHOT);
  return repo;
};

afterEach(() => {
  delete nativeHolder.KidTubeBackup;
  jest.restoreAllMocks();
});

describe('backup file name (ADR 0017)', () => {
  it('uses local date and time', () => {
    expect(backupFileName(new Date(2026, 9, 24, 7, 5))).toBe(
      'kidtube-backup-2026-10-24-0705.json',
    );
  });
});

describe('database export (ADR 0017)', () => {
  it('writes a valid snapshot with every collection and no PIN guard', async () => {
    let saved = '';
    nativeHolder.KidTubeBackup = {
      saveJson: async (_name, content) => {
        saved = content;
        return 'file:///backup.json';
      },
      openJson: async () => null,
    };

    expect(await exportDatabase(await seeded(), '0.9.0')).toEqual({ status: 'saved' });

    const parsed = parseBackup(saved);
    expect(parsed.ok).toBe(true);
    if (parsed.ok) {
      expect(parsed.file.appVersion).toBe('0.9.0');
      expect(parsed.file.data).toEqual(SNAPSHOT);
    }
    expect(saved).not.toContain('pinGuard');
    expect(saved).not.toContain('pinHash');
  });

  it('reports a cancelled chooser without writing anything', async () => {
    nativeHolder.KidTubeBackup = { saveJson: async () => null, openJson: async () => null };
    expect(await exportDatabase(await seeded(), '0.9.0')).toEqual({ status: 'cancelled' });
  });

  it('reports an unavailable file chooser', async () => {
    expect(await exportDatabase(await seeded(), '0.9.0')).toEqual({
      status: 'error',
      message: 'Nie udało się otworzyć wyboru miejsca zapisu.',
    });
  });
});

describe('database import (ADR 0017)', () => {
  it('accepts a valid file and returns the parsed snapshot', async () => {
    nativeHolder.KidTubeBackup = {
      saveJson: async () => null,
      openJson: async () => ({ content: validFile(), name: 'kopia.json' }),
    };

    const outcome = await pickDatabase();
    expect(outcome.status).toBe('picked');
    if (outcome.status === 'picked') {
      expect(outcome.name).toBe('kopia.json');
      expect(outcome.file.data.channels).toHaveLength(1);
    }
  });

  it('rejects an invalid file before touching the database', async () => {
    nativeHolder.KidTubeBackup = {
      saveJson: async () => null,
      openJson: async () => ({ content: '{"format":"x"}', name: 'zly.json' }),
    };

    const outcome = await pickDatabase();
    expect(outcome.status).toBe('error');
  });

  it('replaces the database and zeroes the PIN guard', async () => {
    const repo = new MemoryRepository({
      channels: [
        { id: 'UC_OLD', title: 'Stary', policy: 'manual', status: 'allowed', addedAt: 1 },
      ],
    });
    await repo.savePinGuard({ failedAttempts: 3, lockedUntil: 999 });

    const parsed = parseBackup(validFile());
    if (!parsed.ok) {
      throw new Error('fixture');
    }

    expect(await applyBackup(repo, parsed.file)).toEqual({ ok: true });
    expect(await repo.getPinGuard()).toEqual({ failedAttempts: 0 });
    expect((await repo.listChannels()).map(channel => channel.id)).toEqual(['UC_NEW']);
    expect((await repo.getVideo('v-old'))).toBeUndefined();
  });

  it('keeps the device PIN record across an import', async () => {
    const repo = await seeded();
    const pinRecord = { hash: 'device-hash', salt: 'device-salt', iterations: 210_000 };
    await repo.savePinRecord(pinRecord);
    await repo.updateSettings({ configured: true });

    const parsed = parseBackup(validFile());
    if (!parsed.ok) {
      throw new Error('fixture');
    }

    expect(await applyBackup(repo, parsed.file)).toEqual({ ok: true });
    expect(await repo.getPinRecord()).toEqual(pinRecord);
    expect((await repo.getSettings()).configured).toBe(true);
    // The PIN record never leaks into the regular settings/backup snapshot.
    expect((await repo.getSettings()).pinHash).toBeUndefined();
  });

  it('reports a failed write', async () => {
    const repo = await seeded();
    jest.spyOn(repo, 'replaceAll').mockRejectedValueOnce(new Error('disk'));

    const parsed = parseBackup(validFile());
    if (!parsed.ok) {
      throw new Error('fixture');
    }

    expect(await applyBackup(repo, parsed.file)).toEqual({
      ok: false,
      message: 'Nie udało się zapisać kopii. Poprzednia baza została przywrócona.',
    });
  });
});
