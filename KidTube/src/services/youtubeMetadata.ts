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

export interface PlayerMetadata {
  /** Publication time (Unix ms); oEmbed does not carry it. */
  publishedAt?: number;
  /** Owning channel id, used to apply the channel policy (ADR 0013). */
  channelId?: string;
  /** Channel display name, as a fallback when the channel is not watched yet. */
  channelTitle?: string;
}

const CHANNEL_ID_RE = /^UC[A-Za-z0-9_-]{22}$/;

/**
 * Publication date and owning channel from InnerTube's `player` response.
 * Best-effort: a missing field or a network error just leaves it undefined.
 */
export async function fetchPlayerMetadata(
  videoId: string,
  fetchFn: FetchLike = fetch as unknown as FetchLike,
): Promise<PlayerMetadata | undefined> {
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
    const timestamp = typeof raw === 'string' ? Date.parse(raw) : NaN;
    const candidateChannelId = data?.videoDetails?.channelId ?? microformat?.externalChannelId;
    return {
      publishedAt: Number.isFinite(timestamp) ? timestamp : undefined,
      channelId:
        typeof candidateChannelId === 'string' && CHANNEL_ID_RE.test(candidateChannelId)
          ? candidateChannelId
          : undefined,
      channelTitle:
        typeof data?.videoDetails?.author === 'string'
          ? data.videoDetails.author
          : typeof microformat?.ownerChannelName === 'string'
            ? microformat.ownerChannelName
            : undefined,
    };
  } catch {
    return undefined;
  }
}

/** Publication date for a video, or undefined when unavailable. */
export async function fetchPublishDate(
  videoId: string,
  fetchFn: FetchLike = fetch as unknown as FetchLike,
): Promise<number | undefined> {
  const metadata = await fetchPlayerMetadata(videoId, fetchFn);
  return metadata?.publishedAt;
}
