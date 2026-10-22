/**
 * Metadata lookup without an API key, via YouTube's public oEmbed endpoint.
 * Returns title, author and thumbnail for a known video id.
 */

import { watchUrl } from '../domain/youtubeUrl';

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
