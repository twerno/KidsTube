/**
 * Parent PIN hashing.
 *
 * Uses the native PBKDF2-HMAC-SHA256 module when running on device (fast),
 * and falls back to the pure-JS noble implementation elsewhere (tests, Node).
 * Pure JS is orders of magnitude too slow on Hermes for a high iteration
 * count, hence the native path.
 */

import { NativeModules } from 'react-native';
import { pbkdf2Async } from '@noble/hashes/pbkdf2.js';
import { sha256 } from '@noble/hashes/sha2.js';
import { randomBytes, utf8ToBytes, bytesToHex, hexToBytes } from '@noble/hashes/utils.js';
import type { PinRecord } from '../domain/types';

export type { PinRecord } from '../domain/types';

export const DEFAULT_ITERATIONS = 210_000;
const KEY_LENGTH_BYTES = 32;
const SALT_BYTES = 16;

interface PinCryptoNative {
  pbkdf2(
    password: string,
    saltHex: string,
    iterations: number,
    keyLength: number,
  ): Promise<string>;
  randomBytes(length: number): Promise<string>;
}

function nativeCrypto(): PinCryptoNative | undefined {
  return (NativeModules as { PinCrypto?: PinCryptoNative }).PinCrypto;
}

async function deriveHash(
  pin: string,
  saltHex: string,
  iterations: number,
  keyLength: number = KEY_LENGTH_BYTES,
): Promise<string> {
  const native = nativeCrypto();
  if (native?.pbkdf2) {
    return native.pbkdf2(pin, saltHex, iterations, keyLength);
  }
  const hash = await pbkdf2Async(sha256, utf8ToBytes(pin), hexToBytes(saltHex), {
    c: iterations,
    dkLen: keyLength,
  });
  return bytesToHex(hash);
}

async function createSalt(length: number = SALT_BYTES): Promise<string> {
  const native = nativeCrypto();
  if (native?.randomBytes) {
    return native.randomBytes(length);
  }
  return bytesToHex(randomBytes(length));
}

export async function hashPin(
  pin: string,
  iterations: number = DEFAULT_ITERATIONS,
): Promise<PinRecord> {
  const salt = await createSalt();
  const hash = await deriveHash(pin, salt, iterations);
  return { hash, salt, iterations };
}

/** Constant-time-ish comparison of two equal-length hex strings. */
function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) {
    return false;
  }
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    // eslint-disable-next-line no-bitwise
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}

export async function verifyPin(pin: string, record: PinRecord): Promise<boolean> {
  const hash = await deriveHash(pin, record.salt, record.iterations);
  return safeEqual(hash, record.hash);
}
