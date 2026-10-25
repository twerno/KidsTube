/**
 * Catalog import pacing (ADR 0009).
 *
 * The unauthenticated InnerTube API has no documented quota, so the only
 * precaution is a deliberately slow, human-paced request rate: every request
 * after the first waits 5 s ± 2 s, randomised each time. This is a safety net,
 * not a mirror of Google's limit — the real limit is unknown.
 */

import type { CatalogCheckpoint } from './types';

export const CATALOG_DELAY_BASE_MS = 5000;
export const CATALOG_DELAY_SPREAD_MS = 4000;

/** One random pause between two catalog requests: 3 000–7 000 ms. */
export function catalogDelayMs(random: () => number = Math.random): number {
  return CATALOG_DELAY_BASE_MS + random() * CATALOG_DELAY_SPREAD_MS - CATALOG_DELAY_SPREAD_MS / 2;
}

export function emptyCatalogCheckpoint(): CatalogCheckpoint {
  return { imported: 0, done: false };
}

export function isCatalogRunning(checkpoint: CatalogCheckpoint | undefined): boolean {
  return !!checkpoint && !checkpoint.done;
}
