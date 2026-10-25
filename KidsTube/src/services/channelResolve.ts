/**
 * Resolve an `@handle` / `/c/slug` / `/user/slug` channel URL to its channel id.
 *
 * Reading the public channel HTML page is unreliable: YouTube redirects to a
 * cookie-consent wall for EU regions and the page has no channel id. Instead we
 * use YouTube's own InnerTube `navigation/resolve_url` endpoint, which returns
 * the `browseId` (channel id) as JSON and needs no cookies. The channel title
 * comes from the public RSS feed.
 *
 * (The HTML extractors are kept as a best-effort fallback and for tests.)
 */

import type { FetchLike } from './youtubeMetadata';
import { fetchChannelFeed } from './channelSync';

const MOBILE_UA =
  'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36';

// Public WEB client key used by youtube.com itself. Not a secret, not account
// bound; it only lets us call the resolve endpoint.
const INNERTUBE_KEY = 'AIzaSyAO_FJ2SlqU8Q4STEHLGCilw_Y9_11qcW8';
const INNERTUBE_RESOLVE_URL =
  `https://www.youtube.com/youtubei/v1/navigation/resolve_url?key=${INNERTUBE_KEY}&prettyPrint=false`;

const CHANNEL_ID_RE = /UC[A-Za-z0-9_-]{22}/;

export interface ResolvedChannel {
  channelId: string;
  title: string;
  handle?: string;
}

const ENTITIES: Record<string, string> = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  '#39': "'",
};

function log(...args: unknown[]): void {
  console.log('[KidsTube:resolve]', ...args);
}

function decodeEntities(value: string): string {
  return value.replace(/&(#x?[0-9a-fA-F]+|[a-zA-Z]+);/g, (match, entity: string) => {
    if (entity in ENTITIES) {
      return ENTITIES[entity];
    }
    if (/^#x[0-9a-fA-F]+$/.test(entity)) {
      return String.fromCodePoint(parseInt(entity.slice(2), 16));
    }
    if (/^#[0-9]+$/.test(entity)) {
      return String.fromCodePoint(parseInt(entity.slice(1), 10));
    }
    return match;
  });
}

export function extractChannelId(html: string): string | undefined {
  const patterns = [
    /<link[^>]+rel="canonical"[^>]+href="https:\/\/www\.youtube\.com\/channel\/(UC[A-Za-z0-9_-]{22})"/i,
    /<meta[^>]+property="og:url"[^>]+content="https:\/\/www\.youtube\.com\/channel\/(UC[A-Za-z0-9_-]{22})"/i,
    /"externalId":"(UC[A-Za-z0-9_-]{22})"/,
    /"channelId":"(UC[A-Za-z0-9_-]{22})"/,
    /"browseId":"(UC[A-Za-z0-9_-]{22})"/,
  ];
  for (const pattern of patterns) {
    const match = html.match(pattern);
    if (match) {
      return match[1];
    }
  }
  return undefined;
}

export function extractChannelTitle(html: string): string | undefined {
  const og = html.match(/<meta[^>]+property="og:title"[^>]+content="([^"]*)"/i);
  if (og) {
    return decodeEntities(og[1]);
  }
  const title = html.match(/<title>([^<]*)<\/title>/i);
  return title ? decodeEntities(title[1]) : undefined;
}

function handleFromUrl(url: string): string | undefined {
  const match = url.match(/youtube\.com\/@([^/?#]+)/i);
  return match ? match[1] : undefined;
}

/** Ask InnerTube to resolve an arbitrary YouTube URL to a channel id. */
async function resolveViaInnerTube(
  url: string,
  fetchFn: FetchLike,
): Promise<string | undefined> {
  try {
    const res = await fetchFn(INNERTUBE_RESOLVE_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': MOBILE_UA,
      },
      body: JSON.stringify({
        context: {
          client: {
            clientName: 'WEB',
            clientVersion: '2.20240101.00.00',
            hl: 'en',
            gl: 'US',
          },
        },
        url,
      }),
    });
    if (!res.ok) {
      log('innertube status', res.status);
      return undefined;
    }
    const data = await res.json();
    const browseId = data?.endpoint?.browseEndpoint?.browseId;
    if (typeof browseId === 'string') {
      const match = browseId.match(CHANNEL_ID_RE);
      if (match) {
        log('innertube id', match[0]);
        return match[0];
      }
    }
    log('innertube no browseId', JSON.stringify(data).slice(0, 200));
    return undefined;
  } catch (error) {
    log('innertube threw', String(error));
    return undefined;
  }
}

/** Best-effort HTML fallback (usually blocked by consent in the EU). */
async function resolveViaPage(
  url: string,
  fetchFn: FetchLike,
): Promise<string | undefined> {
  try {
    const res = await fetchFn(url, {
      headers: {
        'User-Agent': MOBILE_UA,
        Accept: 'text/html,application/xhtml+xml',
        'Accept-Language': 'en-US,en;q=0.9',
      },
    });
    if (!res.ok || !res.text) {
      return undefined;
    }
    const html = await res.text();
    const id = extractChannelId(html);
    log('page fallback', 'status', res.status, 'len', html.length, 'id', id);
    return id;
  } catch (error) {
    log('page fallback threw', String(error));
    return undefined;
  }
}

/** Fetch a channel page and resolve it to `{ channelId, title }`. */
async function tryResolve(
  url: string,
  fetchFn: FetchLike,
): Promise<ResolvedChannel | undefined> {
  const channelId = (await resolveViaInnerTube(url, fetchFn)) ?? (await resolveViaPage(url, fetchFn));
  if (!channelId) {
    return undefined;
  }

  const entries = await fetchChannelFeed(channelId, fetchFn);
  const title = entries[0]?.channelTitle ?? channelId;
  return { channelId, title, handle: handleFromUrl(url) };
}

const RESOLVE_TIMEOUT_MS = 20_000;

/** Resolve a channel URL to `{ channelId, title }`, with a hard timeout. */
export async function resolveChannelFromUrl(
  url: string,
  fetchFn: FetchLike = fetch as unknown as FetchLike,
): Promise<ResolvedChannel | undefined> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<undefined>(resolve => {
    timer = setTimeout(() => {
      log('timeout after', RESOLVE_TIMEOUT_MS, 'ms for', url);
      resolve(undefined);
    }, RESOLVE_TIMEOUT_MS);
  });
  try {
    return await Promise.race([tryResolve(url, fetchFn), timeout]);
  } finally {
    if (timer) {
      clearTimeout(timer);
    }
  }
}
