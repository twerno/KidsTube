/**
 * Metadata lookup without an API key: oEmbed for title/author/thumbnail and
 * InnerTube's `player` endpoint for the publication date (oEmbed has none).
 */

import { watchUrl } from '../domain/youtubeUrl';

// Public WEB client key used by youtube.com itself. Not a secret, not account
// bound; it only lets us call YouTube's own endpoints.
const INNERTUBE_KEY = 'AIzaSyAO_FJ2SlqU8Q4STEHLGCilw_Y9_11qcW8';
const INNERTUBE_PLAYER_URL =
  `https://www.youtube.com/youtubei/v1/player?key=${INNERTUBE_KEY}&prettyPrint=false`;

// A mobile browser UA is friendlier to embedded playback downstream.
const MOBILE_UA =
  'Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 Chrome/120 Mobile';

export interface VideoMetadata {
  videoId: string;
  title: string;
  authorName?: string;
  authorUrl?: string;
  thumbnailUrl?: string;
}

export type FetchLike = (
  input: string,
  init?: {
    method?: string;
    headers?: Record<string, string>;
    body?: string;
  },
) => Promise<{
  ok: boolean;
  status: number;
  json: () => Promise<any>;
  text?: () => Promise<string>;
}>;

export async function fetchOEmbed(
  videoId: string,
  fetchFn: FetchLike = fetch as unknown as FetchLike,
): Promise<VideoMetadata | undefined> {
  const endpoint = `https://www.youtube.com/oembed?url=${encodeURIComponent(
    watchUrl(videoId),
  )}&format=json`;

  try {
    const res = await fetchFn(endpoint, {
      headers: {
        // A mobile browser UA is friendlier to embedded playback downstream.
        'User-Agent': 'Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 Chrome/120 Mobile',
      },
    });
    if (!res.ok) {
      return undefined;
    }
    const data = await res.json();
    return {
      videoId,
      title: typeof data?.title === 'string' ? data.title : videoId,
      authorName: data?.author_name,
      authorUrl: data?.author_url,
      thumbnailUrl: data?.thumbnail_url,
    };
  } catch {
    return undefined;
  }
}

/**
 * Publication date for a video, from InnerTube's `player` response
 * (`microformat.playerMicroformatRenderer.publishDate`). oEmbed does not carry
 * it. Returns a Unix timestamp in ms, or undefined when unavailable.
 */
export async function fetchPublishDate(
  videoId: string,
  fetchFn: FetchLike = fetch as unknown as FetchLike,
): Promise<number | undefined> {
  try {
    const res = await fetchFn(INNERTUBE_PLAYER_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'User-Agent': MOBILE_UA },
      body: JSON.stringify({
        context: { client: { clientName: 'WEB', clientVersion: '2.20240101.00.00' } },
        videoId,
      }),
    });
    if (!res.ok) {
      return undefined;
    }
    const data = await res.json();
    const microformat = data?.microformat?.playerMicroformatRenderer;
    const raw = microformat?.publishDate ?? microformat?.uploadDate;
    if (typeof raw !== 'string') {
      return undefined;
    }
    const timestamp = Date.parse(raw);
    return Number.isFinite(timestamp) ? timestamp : undefined;
  } catch {
    return undefined;
  }
}
