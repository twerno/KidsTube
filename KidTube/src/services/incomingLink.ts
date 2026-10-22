/**
 * Handle a link arriving via Android share/VIEW intent.
 *
 * Video links are resolved against the local database:
 *   - allowed  -> the caller may open the player,
 *   - blocked  -> reject,
 *   - unknown  -> create a `pending` record (source: share) so the parent can
 *                 approve or reject it later.
 *
 * Channel links are returned as a proposal; the parent panel decides whether to
 * watch them. (Handle/slug resolution is a TODO — it needs either the channel
 * page or the data API, both deliberately out of scope for now.)
 */

import type { Channel, Video } from '../domain/types';
import { parseYouTubeLink, type ParsedYouTubeLink } from '../domain/youtubeUrl';
import type { Repository } from '../data/repository';
import { fetchOEmbed, type FetchLike } from './youtubeMetadata';

export type IncomingLinkResult =
  | { kind: 'play'; video: Video }
  | { kind: 'blocked'; video: Video }
  | { kind: 'pending'; video: Video }
  | { kind: 'channel'; channel: Channel }
  | { kind: 'channel-proposal'; proposal: ParsedYouTubeLink & { kind: 'channel' } }
  | { kind: 'unknown'; raw: string };

export async function handleIncomingLink(
  raw: string,
  repo: Repository,
  fetchFn?: FetchLike,
  now: number = Date.now(),
): Promise<IncomingLinkResult> {
  const parsed = parseYouTubeLink(raw);

  if (parsed.kind === 'video') {
    const existing = await repo.getVideo(parsed.videoId);
    if (existing) {
      if (existing.status === 'allowed') {
        return { kind: 'play', video: existing };
      }
      if (existing.status === 'blocked') {
        return { kind: 'blocked', video: existing };
      }
      return { kind: 'pending', video: existing };
    }

    const meta = await fetchOEmbed(parsed.videoId, fetchFn);
    const video: Video = {
      id: parsed.videoId,
      title: meta?.title ?? parsed.videoId,
      thumbnailUrl: meta?.thumbnailUrl,
      status: 'pending',
      source: 'share',
      addedAt: now,
    };
    await repo.upsertVideos([video]);
    return { kind: 'pending', video };
  }

  if (parsed.kind === 'channel') {
    if (parsed.channelId) {
      const known = await repo.getChannel(parsed.channelId);
      if (known && known.status !== 'blocked') {
        return { kind: 'channel', channel: known };
      }
    }
    return { kind: 'channel-proposal', proposal: parsed };
  }

  return { kind: 'unknown', raw };
}
