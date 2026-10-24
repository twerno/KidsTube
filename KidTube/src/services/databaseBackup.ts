/**
 * Database export/import orchestration (ADR 0017).
 *
 * The file is built from a repository snapshot (not raw AsyncStorage keys) and
 * validated completely before anything is written. Restoring is a repository
 * transaction; `pinGuard` is never imported and is zeroed after a success.
 */

import type { Repository } from '../data/repository';
import type { BackupFile } from '../domain/backup';
import { buildBackup, parseBackup } from '../domain/backup';
import type { DatabaseSnapshot } from '../domain/types';
import { openBackupFile, saveBackupFile } from '../native/backupFile';
import { recordLog } from './logStore';

export type ExportOutcome =
  | { status: 'saved' }
  | { status: 'cancelled' }
  | { status: 'error'; message: string };

export type PickOutcome =
  | { status: 'picked'; file: BackupFile; name?: string }
  | { status: 'cancelled' }
  | { status: 'error'; message: string };

export type RestoreOutcome = { ok: true } | { ok: false; message: string };

const pad = (value: number) => String(value).padStart(2, '0');

/** `kidtube-backup-YYYY-MM-DD-HHmm.json` in local time. */
export function backupFileName(date: Date = new Date()): string {
  const stamp = `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(
    date.getDate(),
  )}-${pad(date.getHours())}${pad(date.getMinutes())}`;
  return `kidtube-backup-${stamp}.json`;
}

export function backupCounts(snapshot: DatabaseSnapshot) {
  return {
    channels: snapshot.channels.length,
    films: snapshot.videos.length,
    decisions: snapshot.decisions.length,
    history: snapshot.watchHistory.length,
  };
}

export async function exportDatabase(
  repo: Repository,
  appVersion: string,
): Promise<ExportOutcome> {
  let snapshot: DatabaseSnapshot;
  try {
    snapshot = await repo.snapshotAll();
  } catch (error) {
    recordLog('error', 'db', `eksport: odczyt bazy nieudany (${String(error)})`);
    return { status: 'error', message: 'Nie udało się odczytać bazy do kopii.' };
  }

  const file = buildBackup(snapshot, appVersion);
  const status = await saveBackupFile(backupFileName(), JSON.stringify(file, null, 2));

  if (status === 'saved') {
    const counts = backupCounts(snapshot);
    recordLog(
      'info',
      'db',
      `eksport: ${counts.films} filmów, ${counts.channels} kanałów, ${counts.decisions} decyzji`,
    );
    return { status: 'saved' };
  }
  if (status === 'cancelled') {
    return { status: 'cancelled' };
  }
  recordLog('error', 'db', 'eksport: brak dostępu do wyboru plików');
  return { status: 'error', message: 'Nie udało się otworzyć wyboru miejsca zapisu.' };
}

export async function pickDatabase(): Promise<PickOutcome> {
  const picked = await openBackupFile();
  if (picked.status === 'unavailable') {
    recordLog('error', 'db', 'import: brak dostępu do wyboru plików');
    return { status: 'error', message: 'Nie udało się otworzyć wyboru pliku.' };
  }
  if (picked.status === 'cancelled') {
    return { status: 'cancelled' };
  }

  const parsed = parseBackup(picked.content);
  if (!parsed.ok) {
    recordLog('error', 'db', `import: walidacja nieudana (${parsed.error})`);
    return { status: 'error', message: parsed.error };
  }
  return { status: 'picked', file: parsed.file, name: picked.name };
}

/** Replace the whole database with the file's snapshot (ADR 0017). */
export async function applyBackup(repo: Repository, file: BackupFile): Promise<RestoreOutcome> {
  try {
    // The parent PIN never leaves the device: the current code stays, and a
    // device without a code asks for a new one after the import (ADR 0017).
    const current = await repo.getSettings();
    await repo.replaceAll(file.data);
    await repo.updateSettings(
      current.pinHash && current.pinSalt && current.pinIterations
        ? {
            pinHash: current.pinHash,
            pinSalt: current.pinSalt,
            pinIterations: current.pinIterations,
            configured: true,
          }
        : { configured: false },
    );
    // The lockout state is device-local as well (ADR 0012/0017).
    await repo.savePinGuard({ failedAttempts: 0 });
    const counts = backupCounts(file.data);
    recordLog(
      'info',
      'db',
      `import: ${counts.films} filmów, ${counts.channels} kanałów, ${counts.decisions} decyzji`,
    );
    return { ok: true };
  } catch (error) {
    recordLog('error', 'db', `import: zapis nieudany (${String(error)})`);
    return {
      ok: false,
      message: 'Nie udało się zapisać kopii. Poprzednia baza została przywrócona.',
    };
  }
}
