/**
 * Channel flags shared by the parent panel and the sync pipeline (ADR 0015).
 *
 * A muted channel is still a real channel: it appears in the parent's list and
 * can group its films, but it never fetches RSS. Muting is how a channel that
 * arrived through an approved film is parked without subscribing to its feed.
 */

import type { Channel, Video } from './types';

/** Absent flag means “not muted” (backward compatible with stored channels). */
export function isChannelMuted(channel: Pick<Channel, 'muted'>): boolean {
  return channel.muted === true;
}

/** Copy with a new muted state; keeps every other channel setting untouched. */
export function withChannelMuted(channel: Channel, muted: boolean): Channel {
  return { ...channel, muted };
}

/**
 * The channel record created when the parent approves a film whose channel is
 * not watched yet. It is deliberately `manual` (new uploads must be reviewed if
 * the parent later unmutes it) and muted (no RSS until then).
 *
 * A film without a channel id cannot establish a channel — the group would have
 * no stable identity to deduplicate or sync.
 */
export function mutedChannelForVideo(
  video: Pick<Video, 'channelId' | 'channelTitle'>,
  now: number = Date.now(),
): Channel | undefined {
  if (!video.channelId) {
    return undefined;
  }
  const title = video.channelTitle?.trim();
  return {
    id: video.channelId,
    title: title ? title : video.channelId,
    policy: 'manual',
    status: 'allowed',
    muted: true,
    addedAt: now,
  };
}
