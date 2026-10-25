/**
 * Keeping the channel list consistent with approved films (ADR 0015).
 *
 * When the parent approves a film from a channel that is not watched yet, the
 * channel is added as muted. It then appears in the parent's channel list for
 * grouping/management but does not fetch RSS until the parent unmutes it.
 */

import type { Channel, Video } from '../domain/types';
import { mutedChannelForVideo } from '../domain/channels';
import { projectStatus } from '../domain/decisions';
import type { Repository } from '../data/repository';

/**
 * Create the muted channel for one approved film, if the channel is missing.
 * Idempotent: an existing channel (muted or not) is left untouched.
 */
export async function ensureChannelForApprovedVideo(
  repo: Repository,
  video: Pick<Video, 'channelId' | 'channelTitle'>,
  now: number = Date.now(),
): Promise<Channel | undefined> {
  const channel = mutedChannelForVideo(video, now);
  if (!channel) {
    return undefined;
  }
  if (await repo.getChannel(channel.id)) {
    return undefined;
  }
  await repo.upsertChannel(channel);
  return channel;
}

/**
 * Backfill after startup or a repository change: every allowed film whose
 * channel is not stored gets a muted channel. The decision history is the
 * source of truth for “allowed”, so old cached statuses cannot create channels
 * for films the parent rejected later.
 */
export async function ensureMutedChannelsForApprovedVideos(
  repo: Repository,
  now: number = Date.now(),
): Promise<Channel[]> {
  const [channels, videos, decisions] = await Promise.all([
    repo.listChannels(),
    repo.listVideos(),
    repo.listDecisions(),
  ]);
  const known = new Set(channels.map(channel => channel.id));
  const created: Channel[] = [];

  for (const video of videos) {
    if (!video.channelId || known.has(video.channelId)) {
      continue;
    }
    if (projectStatus(video, decisions) !== 'allowed') {
      continue;
    }
    const channel = mutedChannelForVideo(video, now);
    if (!channel) {
      continue;
    }
    await repo.upsertChannel(channel);
    known.add(channel.id);
    created.push(channel);
  }

  return created;
}
