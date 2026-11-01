/**
 * Pure rules for deciding what the child can see and play.
 *
 * Keeping this free of I/O makes the whole policy trivially testable, and the
 * UI/repository layers just feed it data.
 */

import type { Channel, Video, VideoStatus, WatchProgress } from './types';
import type { Decision } from './types';
import { statusForOutcome } from './decisions';
import type { RssVideo } from './rss';

/** What status a freshly discovered upload should get (ADR 0001 / 0019). */
export function decideNewVideoStatus(channel: Pick<Channel, 'policy' | 'status'>): VideoStatus {
  if (channel.status === 'blocked') {
    return 'blocked';
  }
  switch (channel.policy) {
    case 'auto_approve':
      return 'allowed';
    case 'auto_block':
      return 'blocked';
    case 'quiet':
    case 'manual':
    default:
      // `quiet` films are cached as pending but stay out of the approval queue
      // (see `pendingVideos` in panel.ts); the channel screen can still show them.
      return 'pending';
  }
}

/** A video only plays when explicitly allowed. */
export function isPlayable(video: Pick<Video, 'status'>): boolean {
  return video.status === 'allowed';
}

/**
 * Status for a video arriving through a shared link (ADR 0013). The order is
 * deliberate: a blocked channel wins, then the latest parent decision, then the
 * channel policy. An auto-approved link gets no decision entry — exactly like
 * an RSS upload (ADR 0001).
 */
export function decideIncomingVideoStatus(
  channel: Pick<Channel, 'policy' | 'status'> | undefined,
  latest: Pick<Decision, 'outcome'> | undefined,
): VideoStatus {
  if (channel?.status === 'blocked') {
    return 'blocked';
  }
  if (latest) {
    return statusForOutcome(latest.outcome);
  }
  if (channel?.status === 'allowed') {
    switch (channel.policy) {
      case 'auto_approve':
        return 'allowed';
      case 'auto_block':
        return 'blocked';
      case 'quiet':
      case 'manual':
      default:
        return 'pending';
    }
  }
  return 'pending';
}

/** Turn RSS entries into Video records using the channel policy. */
export function rssToVideos(
  entries: RssVideo[],
  channel: Channel,
  now: number = Date.now(),
): Video[] {
  const status = decideNewVideoStatus(channel);
  return entries.map(entry => ({
    id: entry.videoId,
    channelId: entry.channelId ?? channel.id,
    channelTitle: entry.channelTitle ?? channel.title,
    title: entry.title,
    publishedAt: entry.publishedAt,
    thumbnailUrl: entry.thumbnailUrl,
    status,
    source: 'rss',
    addedAt: now,
  }));
}

/**
 * Merge freshly synced videos with what we already store.
 *
 * Rules:
 *  - a video the parent already decided on keeps its status (a manual block or
 *    approval must never be overwritten by a later sync),
 *  - new videos adopt the channel policy,
 *  - an existing video may gain fresher metadata.
 */
export function mergeSyncedVideos(
  existing: Video[],
  incoming: Video[],
): { videos: Video[]; added: Video[] } {
  const byId = new Map(existing.map(v => [v.id, v]));
  const added: Video[] = [];

  for (const fresh of incoming) {
    const current = byId.get(fresh.id);
    if (current) {
      byId.set(fresh.id, {
        ...current,
        title: fresh.title || current.title,
        thumbnailUrl: fresh.thumbnailUrl ?? current.thumbnailUrl,
        publishedAt: fresh.publishedAt ?? current.publishedAt,
        channelTitle: fresh.channelTitle ?? current.channelTitle,
      });
    } else {
      byId.set(fresh.id, fresh);
      added.push(fresh);
    }
  }

  return { videos: [...byId.values()], added };
}

/**
 * Sort key for video lists: the publication date, falling back to the import
 * time for entries whose feed/metadata did not carry a date. Decision time is
 * deliberately not used — the child's order follows the channel chronology,
 * not when the parent happened to approve a film (ADR 0019).
 */
export function videoSortTime(video: Video): number {
  return video.publishedAt ?? video.addedAt;
}

export function videosForChild(videos: Video[]): Video[] {
  return videos
    .filter(isPlayable)
    .sort((a, b) => videoSortTime(b) - videoSortTime(a));
}

export function pendingVideos(videos: Video[]): Video[] {
  return videos
    .filter(v => v.status === 'pending')
    .sort((a, b) => videoSortTime(b) - videoSortTime(a));
}

/** A channel as the child sees it: the parent's channel plus its allowed films. */
export interface ChildChannelEntry {
  channel: Channel;
  videoCount: number;
}

/**
 * Channels of the child's “Kanały” tab (ADR 0004a): only allowed channels that
 * have at least one playable film. A channel with no approved content is not
 * part of the child's library yet, so it would only be an empty room.
 */
export function channelsForChild(
  channels: Channel[],
  childVideos: Video[],
): ChildChannelEntry[] {
  const counts = new Map<string, number>();
  for (const video of childVideos) {
    if (video.channelId) {
      counts.set(video.channelId, (counts.get(video.channelId) ?? 0) + 1);
    }
  }
  return channels
    .filter(channel => channel.status !== 'blocked')
    .map(channel => ({ channel, videoCount: counts.get(channel.id) ?? 0 }))
    .filter(entry => entry.videoCount > 0)
    .sort((a, b) => a.channel.title.localeCompare(b.channel.title));
}

/** Feed restricted to one channel — the channel detail view (ADR 0004a). */
export function videosForChannel(videos: Video[], channelId: string): Video[] {
  return videos
    .filter(video => video.channelId === channelId)
    .sort((a, b) => videoSortTime(b) - videoSortTime(a));
}

/**
 * “Kontynuuj oglądanie” (ADR 0020): films the child started but did not finish,
 * newest activity first. Completed films and never-played ones are excluded.
 */
export function continueWatchingVideos(
  videos: Video[],
  progress: WatchProgress[],
): Video[] {
  const byId = new Map(videos.map(video => [video.id, video]));
  return progress
    .filter(entry => !entry.completed && entry.positionSeconds > 0)
    .slice()
    .sort((a, b) => b.lastWatchedAt - a.lastWatchedAt)
    .map(entry => byId.get(entry.videoId))
    .filter((video): video is Video => !!video);
}

/**
 * Pending videos that came from a channel RSS scan (parent labels them as
 * “z kanału · RSS” — ADR 0001).
 */
export function rssPendingVideos(videos: Video[]): Video[] {
  return videos
    .filter(v => v.status === 'pending' && v.source === 'rss')
    .sort((a, b) => videoSortTime(b) - videoSortTime(a));
}

/**
 * Pending videos the child itself asked for (its propose button or a link
 * shared on the device). This is exactly what the child's
 * “Do zatwierdzenia” tab shows — ADR 0001 / ADR 0004.
 */
export function proposalsForChild(videos: Video[]): Video[] {
  // A shared link is not attributed to the child (ADR 0013/0016); only the
  // child's own “Zaproponuj film” entries belong in this tab.
  return videos
    .filter(v => v.status === 'pending' && v.source === 'propose')
    .sort((a, b) => videoSortTime(b) - videoSortTime(a));
}
