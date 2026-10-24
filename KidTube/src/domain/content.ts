/**
 * Pure rules for deciding what the child can see and play.
 *
 * Keeping this free of I/O makes the whole policy trivially testable, and the
 * UI/repository layers just feed it data.
 */

import type { Channel, Video, VideoStatus } from './types';
import type { Decision } from './types';
import { latestDecision } from './decisions';
import type { RssVideo } from './rss';

/** What status a freshly discovered upload should get. */
export function decideNewVideoStatus(channel: Pick<Channel, 'policy' | 'status'>): VideoStatus {
  if (channel.status === 'blocked') {
    return 'blocked';
  }
  return channel.policy === 'auto_approve' ? 'allowed' : 'pending';
}

/** A video only plays when explicitly allowed. */
export function isPlayable(video: Pick<Video, 'status'>): boolean {
  return video.status === 'allowed';
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
 * Sort key for the child feed: the moment the video was decided (ADR 0001),
 * falling back to publication / addition time for still-undecided uploads.
 */
export function videoSortTime(video: Video, decisions: Decision[]): number {
  const latest = latestDecision(decisions, video.id);
  return latest ? latest.at : video.publishedAt ?? video.addedAt;
}

export function videosForChild(videos: Video[], decisions: Decision[] = []): Video[] {
  return videos
    .filter(isPlayable)
    .sort((a, b) => videoSortTime(b, decisions) - videoSortTime(a, decisions));
}

export function pendingVideos(videos: Video[]): Video[] {
  return videos.filter(v => v.status === 'pending');
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
  return videos.filter(video => video.channelId === channelId);
}

/**
 * Pending videos that came from a channel RSS scan (parent labels them as
 * “z kanału · RSS” — ADR 0001).
 */
export function rssPendingVideos(videos: Video[]): Video[] {
  return videos.filter(v => v.status === 'pending' && v.source === 'rss');
}

/**
 * Pending videos the child itself asked for (its propose button or a link
 * shared on the device). This is exactly what the child's
 * “Do zatwierdzenia” tab shows — ADR 0001 / ADR 0004.
 */
export function proposalsForChild(videos: Video[]): Video[] {
  return videos.filter(v => v.status === 'pending' && (v.source === 'propose' || v.source === 'share'));
}
