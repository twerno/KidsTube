import { MemoryRepository } from '../src/data/memoryRepository';
import {
  ensureChannelForApprovedVideo,
  ensureMutedChannelsForApprovedVideos,
} from '../src/services/channelMuting';
import { manualDecision } from '../src/domain/decisions';
import type { Channel, Video } from '../src/domain/types';

const CHANNEL_ID = 'UCZhWZdKjn0e3ctyVZxsMkKQ';

const known: Channel = {
  id: 'UC_x5XG1OV2P6uZZ5FSM9Ttw',
  title: 'Znany',
  policy: 'manual',
  status: 'allowed',
  addedAt: 0,
};

const allowedOrphan: Video = {
  id: 'ssr2cTC2bhs',
  channelId: CHANNEL_ID,
  channelTitle: 'shinmiri2',
  title: 'Film',
  status: 'allowed',
  source: 'manual',
  addedAt: 10,
};

describe('muted channels for approved films (ADR 0015)', () => {
  it('creates one muted channel for an approved film and does not duplicate it', async () => {
    const repo = new MemoryRepository();

    const created = await ensureChannelForApprovedVideo(repo, allowedOrphan, 100);
    expect(created).toMatchObject({
      id: CHANNEL_ID,
      title: 'shinmiri2',
      policy: 'manual',
      status: 'allowed',
      muted: true,
    });
    expect(await ensureChannelForApprovedVideo(repo, allowedOrphan, 200)).toBeUndefined();
    expect(await repo.listChannels()).toHaveLength(1);
  });

  it('leaves an already watched channel untouched', async () => {
    const repo = new MemoryRepository({ channels: [known] });
    const existing: Video = { ...allowedOrphan, channelId: known.id, channelTitle: known.title };

    expect(await ensureChannelForApprovedVideo(repo, existing, 100)).toBeUndefined();
    expect(await repo.getChannel(known.id)).toEqual(known);
  });

  it('backfills only allowed films with an unknown channel', async () => {
    const decision = manualDecision(allowedOrphan, 'allow', 50);
    const rejected: Video = {
      ...allowedOrphan,
      id: 'rejected1',
      channelId: 'UCbbbbbbbbbbbbbbbbbbbbbb',
      status: 'blocked',
    };
    const pending: Video = {
      ...allowedOrphan,
      id: 'pending1',
      channelId: 'UCcccccccccccccccccccccc',
      status: 'pending',
    };
    const knownVideo: Video = {
      ...allowedOrphan,
      id: 'known1',
      channelId: known.id,
      channelTitle: known.title,
      status: 'allowed',
    };
    const repo = new MemoryRepository({
      channels: [known],
      videos: [
        allowedOrphan,
        // Stored status says allowed, but the latest decision rejects it.
        { ...allowedOrphan, id: 'decided1' },
        rejected,
        pending,
        knownVideo,
      ],
      decisions: [manualDecision({ ...allowedOrphan, id: 'decided1' }, 'reject', 20), decision],
    });

    const created = await ensureMutedChannelsForApprovedVideos(repo, 100);

    expect(created.map(channel => channel.id)).toEqual([CHANNEL_ID]);
    expect((await repo.getChannel(CHANNEL_ID))?.muted).toBe(true);
    expect(await repo.getChannel('UCbbbbbbbbbbbbbbbbbbbbbb')).toBeUndefined();
    expect(await repo.getChannel('UCcccccccccccccccccccccc')).toBeUndefined();
  });
});
