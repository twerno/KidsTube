/** Storage Access Framework bridge for database backups (ADR 0017). */

import { NativeModules } from 'react-native';

interface BackupFileNative {
  saveJson(fileName: string, content: string): Promise<string | null>;
  openJson(): Promise<{ content?: string; name?: string } | null>;
}

function native(): BackupFileNative | undefined {
  return (NativeModules as { KidTubeBackup?: BackupFileNative }).KidTubeBackup;
}

export type SaveBackupStatus = 'saved' | 'cancelled' | 'unavailable';

export type OpenBackupResult =
  | { status: 'picked'; content: string; name?: string }
  | { status: 'cancelled' }
  | { status: 'unavailable' };

/** Ask the system for a destination and write the JSON document there. */
export async function saveBackupFile(
  fileName: string,
  content: string,
): Promise<SaveBackupStatus> {
  const module = native();
  if (!module?.saveJson) {
    return 'unavailable';
  }
  try {
    const uri = await module.saveJson(fileName, content);
    return uri ? 'saved' : 'cancelled';
  } catch {
    return 'unavailable';
  }
}

/** Ask the system for a file and return its whole content. */
export async function openBackupFile(): Promise<OpenBackupResult> {
  const module = native();
  if (!module?.openJson) {
    return { status: 'unavailable' };
  }
  try {
    const picked = await module.openJson();
    if (!picked || typeof picked.content !== 'string') {
      return { status: 'cancelled' };
    }
    return { status: 'picked', content: picked.content, name: picked.name };
  } catch {
    return { status: 'unavailable' };
  }
}
