/**
 * Secure PIN-record storage bridge (see PinStorageModule.kt, ADR 0022).
 *
 * The PBKDF2 hash/salt/iterations are encrypted with a key that never leaves
 * the Android Keystore. AsyncStorage therefore contains no PIN material at all.
 * The bridge is a safe no-op when the native module is unavailable (tests,
 * other platforms); the repository keeps a legacy fallback for that case.
 */

import { NativeModules } from 'react-native';
import type { PinRecord } from '../domain/types';

export interface PinStorageNative {
  save(json: string): Promise<boolean | void> | boolean | void;
  load(): Promise<string | null> | string | null;
  clear(): Promise<boolean | void> | boolean | void;
}

export interface PinStorageBridge {
  /** Persist the encrypted record. False when secure storage is unavailable. */
  save(record: PinRecord): Promise<boolean>;
  load(): Promise<PinRecord | undefined>;
  clear(): Promise<boolean>;
}

function parseRecord(raw: string | null | undefined): PinRecord | undefined {
  if (!raw) {
    return undefined;
  }
  try {
    const value = JSON.parse(raw) as Partial<PinRecord>;
    if (
      typeof value.hash !== 'string' ||
      !value.hash ||
      typeof value.salt !== 'string' ||
      !value.salt ||
      typeof value.iterations !== 'number' ||
      !Number.isFinite(value.iterations) ||
      value.iterations <= 0
    ) {
      return undefined;
    }
    return { hash: value.hash, salt: value.salt, iterations: value.iterations };
  } catch {
    return undefined;
  }
}

export function createPinStorageBridge(
  native: PinStorageNative | undefined,
): PinStorageBridge {
  return {
    async save(record) {
      if (!native?.save) {
        return false;
      }
      try {
        await native.save(JSON.stringify(record));
        return true;
      } catch {
        return false;
      }
    },
    async load() {
      if (!native?.load) {
        return undefined;
      }
      try {
        return parseRecord(await native.load());
      } catch {
        return undefined;
      }
    },
    async clear() {
      if (!native?.clear) {
        return false;
      }
      try {
        await native.clear();
        return true;
      } catch {
        return false;
      }
    },
  };
}

const bridge = createPinStorageBridge(
  NativeModules.PinStorage as PinStorageNative | undefined,
);

export function savePinRecordSecurely(record: PinRecord): Promise<boolean> {
  return bridge.save(record);
}

export function loadPinRecordSecurely(): Promise<PinRecord | undefined> {
  return bridge.load();
}

export function clearPinRecordSecurely(): Promise<boolean> {
  return bridge.clear();
}
