/**
 * Publication dates for films stored without one.
 *
 * `publishedAt` is only known when the source carried it: the channel RSS feed
 * (exact date), InnerTube's `player` metadata (exact date) or the catalog
 * import (relative label, e.g. “2 weeks ago”). A film imported by an older
 * build — or one whose metadata call failed — therefore keeps an empty date
 * forever and sits in “Bez daty” even though YouTube knows the answer.
 *
 * This pass fills those holes: InnerTube's `player` returns the exact
 * `publishDate`, so a small paced batch per sync run is enough to dry up the
 * unknown bucket over a few app starts. Nothing is fetched twice per run and a
 * failure is not retried within the run; the next sync tries again.
 */

import type { Repository } from '../data/repository';
import type { Video } from '../domain/types';
import { recordLog } from './logStore';
import { fetchPublishDate, type FetchLike } from './youtubeMetadata';

/** How many films one sync run may ask about. */
export const BACKFILL_BATCH = 8;
/** Pause between two InnerTube calls, so a sync never looks like a sweep. */
export const BACKFILL_SPACING_MS = 800;

export interface BackfillResult {
  /** Films that gained a publication date (already saved). */
  updated: Video[];
  /** How many films were asked about. */
  tried: number;
}

export interface BackfillOptions {
  limit?: number;
  spacingMs?: number;
  sleep?: (ms: number) => Promise<void>;
}

const defaultSleep = (ms: number): Promise<void> =>
  new Promise(resolve => {
    setTimeout(resolve, ms);
  });

/** Films with no usable publication date, freshest import first. */
export function videosMissingPublicationDate(videos: Video[]): Video[] {
  return videos
    .filter(video => !(typeof video.publishedAt === 'number' && video.publishedAt > 0))
    // Blocked films are not worth a request: nobody is going to watch them.
    .filter(video => video.status !== 'blocked')
    .sort((a, b) => b.addedAt - a.addedAt);
}

export async function backfillPublicationDates(
  repo: Repository,
  fetchFn?: FetchLike,
  options: BackfillOptions = {},
): Promise<BackfillResult> {
  const limit = Math.max(0, options.limit ?? BACKFILL_BATCH);
  const spacingMs = Math.max(0, options.spacingMs ?? BACKFILL_SPACING_MS);
  const sleep = options.sleep ?? defaultSleep;

  const batch = videosMissingPublicationDate(await repo.listVideos()).slice(0, limit);
  const updated: Video[] = [];

  for (const [index, video] of batch.entries()) {
    if (index > 0 && spacingMs > 0) {
      await sleep(spacingMs);
    }
    const publishedAt = await fetchPublishDate(video.id, fetchFn);
    if (publishedAt == null || !Number.isFinite(publishedAt) || publishedAt <= 0) {
      continue;
    }
    const next: Video = { ...video, publishedAt };
    await repo.upsertVideos([next]);
    updated.push(next);
  }

  if (updated.length > 0) {
    recordLog('info', 'sync', `daty publikacji uzupełnione=${updated.length}`);
  }
  return { updated, tried: batch.length };
}
