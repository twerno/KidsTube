import {
  BACKUP_FORMAT,
  BACKUP_SCHEMA_VERSION,
  buildBackup,
  parseBackup,
} from '../src/domain/backup';
import type { DatabaseSnapshot } from '../src/domain/types';

const SNAPSHOT: DatabaseSnapshot = {
  settings: {
    pinHash: 'hash',
    pinSalt: 'salt',
    pinIterations: 210_000,
    childName: 'Staś',
    configured: true,
    schedule: { enabled: true, window: { startMinute: 420, endMinute: 1200 }, dailyLimitMinutes: 60 },
    youtubeLinkHandlerEnabled: true,
  },
  channels: [
    {
      id: 'UC_A',
      title: 'Kanał A',
      handle: 'kanal-a',
      thumbnailUrl: 'https://img/a.jpg',
      policy: 'manual',
      status: 'allowed',
      muted: true,
      addedAt: 10,
      catalog: { imported: 120, resumeToken: 'T1', done: false, error: 'HTTP 429' },
    },
  ],
  channelProposals: [
    {
      id: 'UC_NEW',
      channelId: 'UC_NEW',
      rawUrl: 'https://www.youtube.com/@nowy',
      title: 'Nowy kanał',
      resolved: true,
      addedAt: 20,
    },
  ],
  videos: [
    {
      id: 'v1',
      channelId: 'UC_A',
      channelTitle: 'Kanał A',
      title: 'Film 1',
      publishedAt: 5,
      thumbnailUrl: 'https://img/v1.jpg',
      status: 'allowed',
      source: 'rss',
      addedAt: 30,
    },
  ],
  decisions: [
    { videoId: 'v1', outcome: 'allow', source: 'manual', at: 40, channelId: 'UC_A' },
    { videoId: 'v1', outcome: 'retract', source: 'manual', at: 50 },
    // Orphan: the film is gone, the history stays.
    { videoId: 'gone', outcome: 'reject', source: 'auto', at: 60 },
  ],
  usage: { '2026-10-24': 600 },
  watchProgress: [
    { videoId: 'v1', positionSeconds: 120, durationSeconds: 300, completed: false, lastWatchedAt: 70 },
  ],
  watchHistory: [
    {
      videoId: 'gone',
      dateKey: '2026-10-23',
      title: 'Stary film',
      firstWatchedAt: 80,
      lastWatchedAt: 90,
      audioSeconds: 30,
      videoSeconds: 60,
    },
  ],
  extraTime: { dateKey: '2026-10-24', grantedSeconds: 900, remainingSeconds: 600 },
};

const document = (mutate?: (raw: Record<string, any>) => void): string => {
  const file = JSON.parse(JSON.stringify(buildBackup(SNAPSHOT, '0.9.0')));
  mutate?.(file);
  return JSON.stringify(file);
};

describe('backup format (ADR 0017)', () => {
  it('round-trips every collection through build and parse', () => {
    const parsed = parseBackup(document());
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) {
      return;
    }
    expect(parsed.file.format).toBe(BACKUP_FORMAT);
    expect(parsed.file.schemaVersion).toBe(BACKUP_SCHEMA_VERSION);
    // The PIN derivatives never leave the device (ADR 0017).
    const expected = JSON.parse(JSON.stringify(SNAPSHOT));
    delete expected.settings.pinHash;
    delete expected.settings.pinSalt;
    delete expected.settings.pinIterations;
    expect(parsed.file.data).toEqual(expected);
    expect(parsed.file.data.settings.pinHash).toBeUndefined();
  });

  it('allows orphans and repeated decisions for one film', () => {
    const parsed = parseBackup(document());
    expect(parsed.ok).toBe(true);
    if (parsed.ok) {
      expect(parsed.file.data.decisions.map(d => d.videoId)).toEqual(['v1', 'v1', 'gone']);
    }
  });

  it('never writes PIN derivatives into the file', () => {
    const file = buildBackup(SNAPSHOT, '0.9.0');
    expect(file.data.settings.pinHash).toBeUndefined();
    expect(JSON.stringify(file)).not.toContain('pinHash');
    expect(JSON.stringify(file)).not.toContain('pinSalt');
  });

  it('accepts a snapshot without a PIN and without extra time', () => {
    const parsed = parseBackup(
      document(file => {
        delete file.data.settings.pinHash;
        delete file.data.settings.pinSalt;
        delete file.data.settings.pinIterations;
        file.data.extraTime = null;
      }),
    );
    expect(parsed.ok).toBe(true);
    if (parsed.ok) {
      expect(parsed.file.data.extraTime).toBeNull();
    }
  });

  it('ignores unknown fields instead of rejecting the file', () => {
    const parsed = parseBackup(
      document(file => {
        file.futureFlag = true;
        file.data.settings.futureSetting = 'x';
        file.data.videos[0].futureField = 1;
      }),
    );
    expect(parsed.ok).toBe(true);
  });

  it('rejects a document that is not JSON', () => {
    expect(parseBackup('{ not json')).toEqual({
      ok: false,
      error: 'Plik nie jest poprawnym JSON-em.',
    });
  });

  it('rejects a foreign file', () => {
    const parsed = parseBackup(document(file => {
      file.format = 'other-app';
    }));
    expect(parsed.ok).toBe(false);
    if (!parsed.ok) {
      expect(parsed.error).toContain('To nie jest plik kopii KidsTube');
    }
  });

  it('rejects a newer schema version with a clear message', () => {
    const parsed = parseBackup(document(file => {
      file.schemaVersion = 2;
    }));
    expect(parsed.ok).toBe(false);
    if (!parsed.ok) {
      expect(parsed.error).toContain('nowszej wersji');
    }
  });

  it('requires every collection', () => {
    const parsed = parseBackup(document(file => delete file.data.decisions));
    expect(parsed.ok).toBe(false);
    if (!parsed.ok) {
      expect(parsed.error).toContain('data.decisions');
    }
  });

  it('rejects duplicate channel identifiers', () => {
    const parsed = parseBackup(
      document(file => file.data.channels.push({ ...file.data.channels[0] })),
    );
    expect(parsed.ok).toBe(false);
    if (!parsed.ok) {
      expect(parsed.error).toContain('zduplikowany identyfikator kanału');
    }
  });

  it('rejects duplicate video identifiers', () => {
    const parsed = parseBackup(document(file => file.data.videos.push({ ...file.data.videos[0] })));
    expect(parsed.ok).toBe(false);
    if (!parsed.ok) {
      expect(parsed.error).toContain('zduplikowany identyfikator filmu');
    }
  });

  it('rejects duplicate history entries for the same film and day', () => {
    const parsed = parseBackup(
      document(file => file.data.watchHistory.push({ ...file.data.watchHistory[0] })),
    );
    expect(parsed.ok).toBe(false);
    if (!parsed.ok) {
      expect(parsed.error).toContain('zduplikowany wpis historii');
    }
  });

  it('rejects unknown enum values', () => {
    const parsed = parseBackup(document(file => {
      file.data.videos[0].status = 'maybe';
    }));
    expect(parsed.ok).toBe(false);
    if (!parsed.ok) {
      expect(parsed.error).toContain('nieznana wartość');
    }
  });

  it('rejects negative numbers', () => {
    const parsed = parseBackup(document(file => {
      file.data.videos[0].addedAt = -1;
    }));
    expect(parsed.ok).toBe(false);
    if (!parsed.ok) {
      expect(parsed.error).toContain('mniejsza niż 0');
    }
  });

  it('ignores PIN fields in an incoming file instead of importing them', () => {
    const parsed = parseBackup(
      document(file => {
        file.data.settings.pinHash = 'legacy';
        file.data.settings.pinSalt = 'legacy';
        file.data.settings.pinIterations = 210_000;
      }),
    );
    expect(parsed.ok).toBe(true);
    if (parsed.ok) {
      expect(parsed.file.data.settings.pinHash).toBeUndefined();
      expect(parsed.file.data.settings.pinSalt).toBeUndefined();
      expect(parsed.file.data.settings.pinIterations).toBeUndefined();
    }
  });

  it('rejects an invalid catalog checkpoint', () => {
    const parsed = parseBackup(
      document(file => {
        file.data.channels[0].catalog.imported = -1;
      }),
    );
    expect(parsed.ok).toBe(false);
  });

  it('rejects malformed usage keys', () => {
    const parsed = parseBackup(document(file => {
      file.data.usage = { yesterday: 10 };
    }));
    expect(parsed.ok).toBe(false);
  });
});
