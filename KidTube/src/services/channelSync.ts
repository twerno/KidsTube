/**
 * Channel sync: pull the Atom feed, turn entries into Video records according
 * to the channel policy, and merge them into the repository.
 */

import type { Channel, Video } from '../domain/types';
import { isChannelMuted } from '../domain/channels';
import { channelFeedUrl } from '../domain/youtubeUrl';
import { parseYouTubeFeed, type RssVideo } from '../domain/rss';
import { mergeSyncedVideos, rssToVideos } from '../domain/content';
import type { Repository } from '../data/repository';
import type { FetchLike } from './youtubeMetadata';

export async function fetchChannelFeed(
  channelId: string,
  fetchFn: FetchLike = fetch as unknown as FetchLike,
): Promise<RssVideo[]> {
  try {
    const res = await fetchFn(channelFeedUrl(channelId), {
      headers: { Accept: 'application/atom+xml, application/xml, text/xml' },
    });
    if (!res.ok) {
      return [];
    }
    const xml = await (res as unknown as { text: () => Promise<string> }).text();
    return parseYouTubeFeed(xml);
  } catch {
    return [];
  }
}

export interface SyncResult {
  added: Video[];
  total: number;
}

/** Sync a single channel and persist any newly discovered videos. */
export async function syncChannel(
  repo: Repository,
  channel: Channel,
  fetchFn?: FetchLike,
  now: number = Date.now(),
): Promise<SyncResult> {
  // Muted channels stay visible but never fetch RSS (ADR 0015). The guard also
  // covers direct calls from explicit actions, not just the bulk sync.
  if (isChannelMuted(channel)) {
    return { added: [], total: 0 };
  }

  const entries = await fetchChannelFeed(channel.id, fetchFn);
  if (entries.length === 0) {
    return { added: [], total: 0 };
  }

  const incoming = rssToVideos(entries, channel, now);
  const existing = await repo.listVideos();
  const relevant = existing.filter(v => v.channelId === channel.id);
  const { videos, added } = mergeSyncedVideos(relevant, incoming);

  await repo.upsertVideos(videos);
  return { added, total: videos.length };
}

/** Sync every non-blocked watched channel. Never throws for one bad channel. */
export async function syncAllChannels(
  repo: Repository,
  fetchFn?: FetchLike,
): Promise<{ added: Video[]; perChannel: Record<string, number> }> {
  const channels = await repo.listChannels();
  const added: Video[] = [];
  const perChannel: Record<string, number> = {};

  for (const channel of channels) {
    if (channel.status === 'blocked' || isChannelMuted(channel)) {
      continue;
    }
    const result = await syncChannel(repo, channel, fetchFn);
    perChannel[channel.id] = result.added.length;
    added.push(...result.added);
  }

  return { added, perChannel };
}
