/**
 * Parent-panel selectors (ADR 0016) — pure rules behind the panel's sections.
 *
 * Every selector takes the already projected video list (ADR 0001) and the
 * channel list, so "what the child can see" and "what the panel shows" cannot
 * drift apart: a blocked channel hides all of its films without rewriting a
 * single video status. Blocking is a projection, never a decision.
 */

import type { Channel, Decision, Video, VideoStatus } from './types';
import { isChannelMuted } from './channels';
import { latestDecision } from './decisions';
import { videoSortTime } from './content';

/** Source chips of the “Do zatwierdzenia” section (ADR 0016). */
export type SourceFilter = 'all' | 'rss' | 'child' | 'link';

/** Status chips of the channel screen (ADR 0018). */
export type ChannelStatusFilter = 'accepted' | 'rejected' | 'pending';

export const DEFAULT_CHANNEL_STATUS_FILTER: ChannelStatusFilter = 'accepted';

export interface ChannelStatusCounts {
  accepted: number;
  rejected: number;
  pending: number;
}

/** Stable key of the pseudo-entry grouping films with no channel id. */
export const UNKNOWN_CHANNEL_KEY = '__unknown__';

/** One position of the horizontal channel bar (ADR 0005 / ADR 0016). */
export interface ChannelBarEntry {
  /** Filter key: a channel id, `UNKNOWN_CHANNEL_KEY` or `__all__` in the UI. */
  key: string;
  channelId?: string;
  title: string;
  thumbnailUrl?: string;
  /** Number of films this entry would show. */
  count: number;
  /** False when the channel has no record yet (marker “nieobserwowany”). */
  observed: boolean;
  /** The trailing pseudo-entry for films without a channel id. */
  isUnknown?: boolean;
  /** The leading “Wszystkie” entry added by the UI. */
  isAll?: boolean;
}

function blockedChannelIds(channels: Channel[]): Set<string> {
  return new Set(channels.filter(channel => channel.status === 'blocked').map(channel => channel.id));
}

/**
 * A channel blocks all of its films, with one explicit exception (ADR 0019):
 * a manual `allow` decision taken *after* the channel was blocked wins for that
 * single film. Only then can the parent grant one film from a blocked channel.
 */
function hasBlockException(video: Video, channel: Channel, decisions: Decision[]): boolean {
  if (channel.blockedAt === undefined) {
    return false;
  }
  const latest = latestDecision(decisions, video.id);
  return (
    latest?.outcome === 'allow' &&
    latest.source === 'manual' &&
    latest.at > channel.blockedAt
  );
}

/** Whether a video is hidden by its blocked channel (projection only). */
export function isBlockedChannelVideo(
  video: Video,
  channels: Channel[],
  decisions: Decision[] = [],
): boolean {
  if (!video.channelId) {
    return false;
  }
  const channel = channels.find(candidate => candidate.id === video.channelId);
  if (!channel || channel.status !== 'blocked') {
    return false;
  }
  return !hasBlockException(video, channel, decisions);
}

/**
 * Channels whose RSS/catalog films are cached but deliberately kept out of the
 * approval queue: the legacy `muted` flag (no RSS at all) and the `quiet`
 * policy (RSS runs, new films wait silently). Shared links and the child's
 * proposals are never hidden — they are explicit actions (ADR 0019).
 */
function cacheOnlyChannelIds(channels: Channel[]): Set<string> {
  return new Set(
    channels
      .filter(channel => isChannelMuted(channel) || channel.policy === 'quiet')
      .map(channel => channel.id),
  );
}

/** All film lists follow publication dates, newest first (ADR 0020). */
function newestFirst(videos: Video[]): Video[] {
  return [...videos].sort((a, b) => videoSortTime(b) - videoSortTime(a));
}

/**
 * The decision queue: pending films whose channel is not blocked. Films of a
 * blocked channel wait under that channel in the “Zablokowane” section and
 * come back here after unblocking — nothing is written to the decision history.
 */
export function pendingVideos(videos: Video[], channels: Channel[]): Video[] {
  const blocked = blockedChannelIds(channels);
  const cacheOnly = cacheOnlyChannelIds(channels);
  return newestFirst(videos.filter(video => {
    if (video.status !== 'pending') {
      return false;
    }
    if (video.channelId && blocked.has(video.channelId)) {
      return false;
    }
    // Only scans (RSS / catalog) obey the cache-only policy. A shared link or
    // the child's proposal is an explicit request and belongs in the queue.
    if (video.source === 'rss' && video.channelId && cacheOnly.has(video.channelId)) {
      return false;
    }
    return true;
  }));
}

/** Pending films of one channel, including films hidden from the queue (muted). */
export function pendingForChannel(videos: Video[], channelId: string): Video[] {
  return newestFirst(
    videos.filter(video => video.channelId === channelId && video.status === 'pending'),
  );
}

/** The child's library: allowed films whose channel is not blocked. */
export function libraryVideos(
  videos: Video[],
  channels: Channel[],
  decisions: Decision[] = [],
): Video[] {
  return newestFirst(
    videos.filter(
      video => video.status === 'allowed' && !isBlockedChannelVideo(video, channels, decisions),
    ),
  );
}

/**
 * The archive of the “Zablokowane” section: films blocked by a decision plus
 * every film of a blocked channel (whatever its status).
 */
export function blockedVideos(
  videos: Video[],
  channels: Channel[],
  decisions: Decision[] = [],
): Video[] {
  return newestFirst(
    videos.filter(
      video => video.status === 'blocked' || isBlockedChannelVideo(video, channels, decisions),
    ),
  );
}

export function blockedChannels(channels: Channel[]): Channel[] {
  return channels.filter(channel => channel.status === 'blocked');
}

/** Films of one blocked channel, shown under its channel card. */
export function videosForChannel(videos: Video[], channelId: string): Video[] {
  return videos
    .filter(video => video.channelId === channelId)
    .sort((a, b) => videoSortTime(b) - videoSortTime(a));
}

const STATUS_FOR_FILTER: Record<ChannelStatusFilter, VideoStatus> = {
  accepted: 'allowed',
  rejected: 'blocked',
  pending: 'pending',
};

/** Counts of all three statuses for one channel (ADR 0018). */
export function channelStatusCounts(
  videos: Video[],
  channelId: string,
): ChannelStatusCounts {
  const counts: ChannelStatusCounts = { accepted: 0, rejected: 0, pending: 0 };
  for (const video of videos) {
    if (video.channelId !== channelId) {
      continue;
    }
    if (video.status === 'allowed') {
      counts.accepted += 1;
    } else if (video.status === 'blocked') {
      counts.rejected += 1;
    } else {
      counts.pending += 1;
    }
  }
  return counts;
}

/** Films of one channel matching a status chip (ADR 0018). */
export function filterChannelVideos(
  videos: Video[],
  channelId: string,
  filter: ChannelStatusFilter,
): Video[] {
  const status = STATUS_FOR_FILTER[filter];
  return videos
    .filter(video => video.channelId === channelId && video.status === status)
    .sort((a, b) => videoSortTime(b) - videoSortTime(a));
}

/** The filter key a video belongs to: its channel id or the unknown bucket. */
export function channelKeyOf(video: Video): string {
  return video.channelId ? video.channelId : UNKNOWN_CHANNEL_KEY;
}

export function matchesSource(video: Video, filter: SourceFilter): boolean {
  switch (filter) {
    case 'all':
      return true;
    case 'rss':
      return video.source === 'rss';
    case 'child':
      // Only the child's own “Zaproponuj film”: a shared link is not attributed
      // to anyone (ADR 0016).
      return video.source === 'propose';
    case 'link':
      return video.source === 'share' || video.source === 'manual';
  }
}

export function matchesChannel(video: Video, key: string | null): boolean {
  return key === null || channelKeyOf(video) === key;
}

/** Films matching both filter levels; `null` channel means “all channels”. */
export function filterVideos(
  videos: Video[],
  source: SourceFilter,
  channelKey: string | null,
): Video[] {
  return newestFirst(
    videos.filter(video => matchesSource(video, source) && matchesChannel(video, channelKey)),
  );
}

export interface SourceCounts {
  all: number;
  rss: number;
  child: number;
  link: number;
}

/**
 * Source chip counts, scoped to the selected channel: the number on a chip is
 * the number of films the parent would see after tapping it (ADR 0016).
 */
export function countBySource(videos: Video[], channelKey: string | null): SourceCounts {
  const counts: SourceCounts = { all: 0, rss: 0, child: 0, link: 0 };
  for (const video of videos) {
    if (!matchesChannel(video, channelKey)) {
      continue;
    }
    counts.all += 1;
    if (video.source === 'rss') {
      counts.rss += 1;
    } else if (video.source === 'propose') {
      counts.child += 1;
    } else {
      counts.link += 1;
    }
  }
  return counts;
}

/**
 * Channel bar entries for the films that pass the source filter (faceted
 * counts). The “Kanał nieznany” entry appears only when such films exist.
 */
export function channelBarEntries(videos: Video[], channels: Channel[]): ChannelBarEntry[] {
  const byKey = new Map<string, ChannelBarEntry>();
  for (const video of videos) {
    const key = channelKeyOf(video);
    const existing = byKey.get(key);
    if (existing) {
      existing.count += 1;
      continue;
    }
    const channel = video.channelId
      ? channels.find(candidate => candidate.id === video.channelId)
      : undefined;
    byKey.set(key, {
      key,
      channelId: video.channelId,
      title: channel?.title ?? video.channelTitle ?? video.channelId ?? 'Kanał nieznany',
      thumbnailUrl: channel?.thumbnailUrl,
      count: 1,
      observed: !!channel,
      isUnknown: key === UNKNOWN_CHANNEL_KEY,
    });
  }
  return [...byKey.values()].sort((a, b) => a.title.localeCompare(b.title));
}

/**
 * Drop a channel filter that no longer exists in the bar (the channel got
 * blocked, or its last film left the list) so a dead filter cannot leave an
 * empty list behind.
 */
export function normalizeChannelFilter(
  entries: ChannelBarEntry[],
  channelKey: string | null,
): string | null {
  if (channelKey === null) {
    return null;
  }
  return entries.some(entry => entry.key === channelKey) ? channelKey : null;
}
