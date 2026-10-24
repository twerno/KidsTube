/**
 * Full channel catalog import through InnerTube's `browse` endpoint (ADR 0009).
 *
 * The same public WEB client already used for metadata is asked for the
 * channel's “Videos” tab and then paginated with `continuation` tokens. The API
 * is undocumented, so every response is parsed defensively and covered by
 * frozen-JSON tests; the pacing is a human-slow safety net (5 s ± 2 s), not a
 * mirror of any known Google quota (the real limit is unknown).
 */

import type { Repository } from '../data/repository';
import { catalogDelayMs, emptyCatalogCheckpoint } from '../domain/catalog';
import { mergeSyncedVideos, rssToVideos } from '../domain/content';
import type { Channel } from '../domain/types';
import type { RssVideo } from '../domain/rss';
import type { FetchLike } from './youtubeMetadata';
import { recordLog } from './logStore';

const INNERTUBE_KEY = 'AIzaSyAO_FJ2SlqU8Q4STEHLGCilw_Y9_11qcW8';
const BROWSE_URL = `https://www.youtube.com/youtubei/v1/browse?key=${INNERTUBE_KEY}&prettyPrint=false`;
/** The “Videos” tab of a channel. */
const VIDEOS_TAB_PARAMS = 'EgZ2aWRlb3PyBgQKAjoA';
const CLIENT_VERSION = '2.20240101.00.00';
const MOBILE_UA =
  'Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 Chrome/120 Mobile';

export const CATALOG_REQUEST_TIMEOUT_MS = 20_000;

export type CatalogErrorKind = 'network' | 'http' | 'parse' | 'timeout';

export class CatalogError extends Error {
  constructor(
    public readonly kind: CatalogErrorKind,
    message: string,
  ) {
    super(message);
  }
}

export interface CatalogPage {
  videos: RssVideo[];
  nextToken?: string;
}

function textOf(node: unknown): string | undefined {
  if (!node || typeof node !== 'object') {
    return undefined;
  }
  const value = node as Record<string, unknown>;
  if (typeof value.simpleText === 'string') {
    return value.simpleText;
  }
  if (Array.isArray(value.runs)) {
    const text = value.runs
      .map(run => (run && typeof run === 'object' ? (run as { text?: string }).text ?? '' : ''))
      .join('');
    return text || undefined;
  }
  return undefined;
}

function thumbnailOf(node: unknown): string | undefined {
  const thumbnails = (node as { thumbnail?: { thumbnails?: { url?: string }[] } } | undefined)
    ?.thumbnail?.thumbnails;
  return Array.isArray(thumbnails) && thumbnails.length > 0
    ? thumbnails[thumbnails.length - 1]?.url
    : undefined;
}

function videoFrom(node: unknown): RssVideo | undefined {
  const content = (node as { richItemRenderer?: { content?: Record<string, unknown> } } | undefined)
    ?.richItemRenderer?.content;

  // Legacy grid shape.
  const legacy =
    (content?.videoRenderer as { videoId?: unknown; title?: unknown } | undefined) ??
    (node as { videoRenderer?: unknown } | undefined)?.videoRenderer;
  if (legacy && typeof legacy === 'object') {
    const video = legacy as { videoId?: unknown; title?: unknown };
    const title = textOf(video.title);
    if (typeof video.videoId === 'string' && title) {
      return { videoId: video.videoId, title, thumbnailUrl: thumbnailOf(legacy) };
    }
  }

  // Current grid shape (YouTube's `lockupViewModel`); playlists use the same
  // renderer with a different content type, so only videos are accepted.
  const lockup = (content?.lockupViewModel ?? (node as { lockupViewModel?: unknown } | undefined)?.lockupViewModel) as
    | {
        contentId?: unknown;
        contentType?: unknown;
        contentImage?: { thumbnailViewModel?: { image?: unknown } };
        metadata?: { lockupMetadataViewModel?: { title?: { content?: unknown } } };
      }
    | undefined;
  if (!lockup || typeof lockup !== 'object') {
    return undefined;
  }
  if (typeof lockup.contentType === 'string' && !lockup.contentType.includes('VIDEO')) {
    return undefined;
  }
  const lockupTitle = lockup.metadata?.lockupMetadataViewModel?.title?.content;
  if (typeof lockup.contentId !== 'string' || typeof lockupTitle !== 'string' || !lockupTitle) {
    return undefined;
  }
  const sources = (
    lockup.contentImage?.thumbnailViewModel?.image as
      | { sources?: { url?: string }[] }
      | undefined
  )?.sources;
  return {
    videoId: lockup.contentId,
    title: lockupTitle,
    thumbnailUrl:
      Array.isArray(sources) && sources.length > 0
        ? sources[sources.length - 1]?.url
        : undefined,
  };
}

function continuationOf(items: unknown[]): string | undefined {
  for (const item of items) {
    const token = (
      item as {
        continuationItemRenderer?: {
          continuationEndpoint?: { continuationCommand?: { token?: unknown } };
        };
      }
    )?.continuationItemRenderer?.continuationEndpoint?.continuationCommand?.token;
    if (typeof token === 'string') {
      return token;
    }
  }
  return undefined;
}

/** Deep fallback when the known structural path changes. */
function deepVideos(node: unknown): RssVideo[] {
  const found: RssVideo[] = [];
  const walk = (value: unknown) => {
    if (!value || typeof value !== 'object') {
      return;
    }
    if (Array.isArray(value)) {
      value.forEach(walk);
      return;
    }
    const record = value as Record<string, unknown>;
    if (record.videoRenderer) {
      const video = videoFrom({ videoRenderer: record.videoRenderer });
      if (video) {
        found.push(video);
      }
    }
    Object.values(record).forEach(walk);
  };
  walk(node);
  return found;
}

function extractPage(json: unknown, token: string | undefined): CatalogPage {
  let items: unknown[] = [];
  if (!token) {
    const tabs =
      (json as { contents?: { twoColumnBrowseResultsRenderer?: { tabs?: unknown[] } } })
        ?.contents?.twoColumnBrowseResultsRenderer?.tabs ?? [];
    const tab =
      tabs.find(
        entry =>
          (entry as { tabRenderer?: { selected?: boolean } })?.tabRenderer?.selected === true,
      ) ??
      tabs.find(
        entry =>
          textOf((entry as { tabRenderer?: { title?: unknown } })?.tabRenderer?.title) ===
          'Videos',
      ) ??
      tabs[0];
    const content = (tab as { tabRenderer?: { content?: Record<string, unknown> } } | undefined)
      ?.tabRenderer?.content;
    items =
      (content?.richGridRenderer as { contents?: unknown[] } | undefined)?.contents ??
      (content?.sectionListRenderer as { contents?: unknown[] } | undefined)?.contents ??
      [];
  } else {
    const actions =
      (json as { onResponseReceivedActions?: unknown[] })?.onResponseReceivedActions ?? [];
    for (const action of actions) {
      const continuationItems = (
        action as {
          appendContinuationItemsAction?: { continuationItems?: unknown[] };
        }
      )?.appendContinuationItemsAction?.continuationItems;
      if (Array.isArray(continuationItems)) {
        items = continuationItems;
        break;
      }
    }
  }

  const videos = items
    .map(videoFrom)
    .filter((video): video is RssVideo => !!video);
  if (videos.length === 0) {
    // The response shape may have changed: keep a best-effort deep scan, but the
    // continuation token still comes from the structural path.
    videos.push(...deepVideos(items));
  }
  const unique = new Map(videos.map(video => [video.videoId, video]));
  return { videos: [...unique.values()], nextToken: continuationOf(items) };
}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new CatalogError('timeout', `Brak odpowiedzi w ${Math.round(ms / 1000)} s`)),
      ms,
    );
    promise.then(
      value => {
        clearTimeout(timer);
        resolve(value);
      },
      error => {
        clearTimeout(timer);
        reject(error);
      },
    );
  });
}

/** Fetch one catalog page: the first one by channel id, then by continuation token. */
export async function fetchCatalogPage(
  channelId: string,
  token?: string,
  fetchFn: FetchLike = fetch as unknown as FetchLike,
  timeoutMs: number = CATALOG_REQUEST_TIMEOUT_MS,
): Promise<CatalogPage> {
  const body = token
    ? {
        context: { client: { clientName: 'WEB', clientVersion: CLIENT_VERSION } },
        continuation: token,
      }
    : {
        context: { client: { clientName: 'WEB', clientVersion: CLIENT_VERSION } },
        browseId: channelId,
        params: VIDEOS_TAB_PARAMS,
      };

  let response: Awaited<ReturnType<FetchLike>>;
  try {
    response = await withTimeout(
      fetchFn(BROWSE_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'User-Agent': MOBILE_UA },
        body: JSON.stringify(body),
      }),
      timeoutMs,
    );
  } catch (error) {
    if (error instanceof CatalogError) {
      throw error;
    }
    throw new CatalogError('network', `Błąd sieci (${String(error)})`);
  }

  if (!response.ok) {
    throw new CatalogError('http', `HTTP ${response.status}`);
  }

  let json: unknown;
  try {
    json = await response.json();
  } catch {
    throw new CatalogError('parse', 'Odpowiedź nie jest JSON-em');
  }

  const page = extractPage(json, token);
  return page;
}

export type CatalogRunPhase = 'running' | 'done' | 'error' | 'cancelled';

export interface CatalogRunState {
  channelId: string;
  channelTitle: string;
  imported: number;
  phase: CatalogRunPhase;
  message?: string;
}

export interface CatalogRunOptions {
  fetchFn?: FetchLike;
  timeoutMs?: number;
  delay?: (ms: number) => Promise<void>;
  random?: () => number;
  isCancelled?: () => boolean;
  onProgress?: (imported: number) => void;
  now?: () => number;
}

export interface CatalogRunResult {
  imported: number;
  added: number;
  done: boolean;
  cancelled: boolean;
  error?: string;
}

const sleep = (ms: number) => new Promise<void>(resolve => setTimeout(resolve, ms));

/**
 * Walk the catalog from the channel's checkpoint until it ends, errors, or the
 * parent cancels. Every fetched page is merged immediately and the checkpoint is
 * persisted, so a stop never loses progress.
 */
export async function runCatalogImport(
  repo: Repository,
  channel: Channel,
  options: CatalogRunOptions = {},
): Promise<CatalogRunResult> {
  const delay = options.delay ?? sleep;
  const random = options.random ?? Math.random;
  const isCancelled = options.isCancelled ?? (() => false);
  const now = options.now ?? (() => Date.now());

  const stored = (await repo.getChannel(channel.id)) ?? channel;
  let checkpoint = stored.catalog ?? emptyCatalogCheckpoint();
  if (checkpoint.done) {
    return { imported: checkpoint.imported, added: 0, done: true, cancelled: false };
  }

  const save = async (patch: Partial<typeof checkpoint>) => {
    checkpoint = { ...checkpoint, ...patch };
    await repo.upsertChannel({ ...stored, catalog: checkpoint });
  };

  // A resume replays the last processed page: new uploads may have shifted the
  // range, and the replay also detects an expired token (empty page).
  let replay = checkpoint.imported > 0 || checkpoint.resumeToken !== undefined;
  let token = replay ? checkpoint.resumeToken : undefined;
  let imported = checkpoint.imported;
  let added = 0;
  let first = true;
  const seenTokens = new Set<string>();

  while (true) {
    if (isCancelled()) {
      await save({});
      return { imported, added, done: false, cancelled: true };
    }
    if (!first) {
      await delay(catalogDelayMs(random));
      if (isCancelled()) {
        await save({});
        return { imported, added, done: false, cancelled: true };
      }
    }
    first = false;

    if (token) {
      if (seenTokens.has(token)) {
        const message = 'Kursor kontynuacji się zapętlił';
        await save({ error: message });
        recordLog('error', 'catalog', `${stored.title}: ${message}`);
        return { imported, added, done: false, cancelled: false, error: message };
      }
      seenTokens.add(token);
    }

    const usedToken = token;
    let page: CatalogPage;
    try {
      page = await fetchCatalogPage(stored.id, usedToken, options.fetchFn, options.timeoutMs);
    } catch (error) {
      const message = error instanceof CatalogError ? error.message : String(error);
      await save({ error: message });
      recordLog('error', 'catalog', `${stored.title}: ${message}`);
      return { imported, added, done: false, cancelled: false, error: message };
    }

    if (replay && page.videos.length === 0) {
      // The continuation expired: the next run starts from the beginning.
      const message = 'Kursor wygasł — następne pobranie zacznie od początku';
      checkpoint = { imported: 0, done: false, error: message };
      await repo.upsertChannel({ ...stored, catalog: checkpoint });
      recordLog('warn', 'catalog', `${stored.title}: ${message}`);
      return { imported: 0, added, done: false, cancelled: false, error: message };
    }

    const incoming = rssToVideos(page.videos, stored, now());
    const existing = (await repo.listVideos()).filter(video => video.channelId === stored.id);
    const merged = mergeSyncedVideos(existing, incoming);
    await repo.upsertVideos(merged.videos);
    added += merged.added.length;
    // The progress counter is the number of films the channel has after the
    // merge. Replaying the last page (resume) then cannot lose or double count
    // anything: duplicates are dropped by `videoId`.
    imported = merged.videos.length;
    replay = false;
    token = page.nextToken;
    const done = !token;
    await save({ resumeToken: usedToken, imported, done, error: undefined });
    options.onProgress?.(imported);
    recordLog(
      'info',
      'catalog',
      `${stored.title}: strona (+${merged.added.length}) → ${imported} filmów${done ? ' · koniec' : ''}`,
    );

    if (done) {
      return { imported, added, done: true, cancelled: false };
    }
  }
}
