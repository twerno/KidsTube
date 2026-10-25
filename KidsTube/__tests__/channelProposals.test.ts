import AsyncStorage from '@react-native-async-storage/async-storage';
import { AsyncStorageRepository } from '../src/data/asyncStorageRepository';
import { MemoryRepository } from '../src/data/memoryRepository';
import {
  approveChannelProposal,
  rejectChannelProposal,
  retryChannelProposal,
  saveChannelProposal,
} from '../src/services/channelProposals';
import type { FetchLike } from '../src/services/youtubeMetadata';
import type { Channel, ChannelProposal } from '../src/domain/types';

const CHANNEL_ID = 'UCZhWZdKjn0e3ctyVZxsMkKQ';

const FEED = `<?xml version="1.0"?>
<feed xmlns:yt="http://www.youtube.com/xml/schemas/2015" xmlns:media="http://search.yahoo.com/mrss/">
 <yt:channelId>${CHANNEL_ID}</yt:channelId>
 <entry>
  <yt:videoId>UN-0gLuVOZU</yt:videoId>
  <yt:channelId>${CHANNEL_ID}</yt:channelId>
  <title>First film</title>
  <author><name>Shared channel</name></author>
  <published>2024-01-01T00:00:00+00:00</published>
 </entry>
</feed>`;

function fakeFetch(resolveId?: string): FetchLike {
  return async input => {
    if (input.includes('navigation/resolve_url')) {
      return {
        ok: !!resolveId,
        status: resolveId ? 200 : 404,
        json: async () =>
          resolveId ? { endpoint: { browseEndpoint: { browseId: resolveId } } } : {},
      } as any;
    }
    return {
      ok: true,
      status: 200,
      json: async () => ({}),
      text: async () => FEED,
    } as any;
  };
}

const resolvedProposal: ChannelProposal = {
  id: CHANNEL_ID,
  channelId: CHANNEL_ID,
  rawUrl: 'https://www.youtube.com/channel/' + CHANNEL_ID,
  title: 'Shared channel',
  resolved: true,
  addedAt: 10,
};

const unresolvedProposal: ChannelProposal = {
  id: 'raw:https://www.youtube.com/@someone',
  rawUrl: 'https://www.youtube.com/@someone',
  title: 'https://www.youtube.com/@someone',
  resolved: false,
  addedAt: 10,
};

describe('channel proposals (ADR 0013)', () => {
  it('approving creates a manual, allowed channel and queues its RSS films', async () => {
    const repo = new MemoryRepository({ channelProposals: [resolvedProposal] });
    const result = await approveChannelProposal(repo, resolvedProposal, fakeFetch(), 100);

    expect(result.kind).toBe('added');
    expect(await repo.getChannel(CHANNEL_ID)).toMatchObject({
      policy: 'manual',
      status: 'allowed',
    });
    expect(await repo.listChannelProposals()).toHaveLength(0);
    expect((await repo.getVideo('UN-0gLuVOZU'))?.status).toBe('pending');
    // No video decision is created by approving the channel itself.
    expect(await repo.listDecisions()).toHaveLength(0);
  });

  it('resolves an unresolved proposal while approving it', async () => {
    const repo = new MemoryRepository({ channelProposals: [unresolvedProposal] });
    const result = await approveChannelProposal(
      repo,
      unresolvedProposal,
      fakeFetch(CHANNEL_ID),
      100,
    );

    expect(result.kind).toBe('added');
    expect((await repo.getChannel(CHANNEL_ID))?.policy).toBe('manual');
    expect(await repo.listChannelProposals()).toHaveLength(0);
  });

  it('keeps the proposal when resolution fails', async () => {
    const repo = new MemoryRepository({ channelProposals: [unresolvedProposal] });
    const result = await approveChannelProposal(repo, unresolvedProposal, fakeFetch());

    expect(result.kind).toBe('unresolved');
    expect(await repo.listChannelProposals()).toHaveLength(1);
    expect(await repo.listChannels()).toHaveLength(0);
  });

  it('does not duplicate an already watched channel and drops the proposal', async () => {
    const existing: Channel = {
      id: CHANNEL_ID,
      title: 'Existing',
      policy: 'auto_approve',
      status: 'allowed',
      addedAt: 0,
    };
    const repo = new MemoryRepository({ channels: [existing], channelProposals: [resolvedProposal] });
    const result = await approveChannelProposal(repo, resolvedProposal);

    expect(result.kind).toBe('already');
    expect(await repo.listChannels()).toHaveLength(1);
    expect((await repo.getChannel(CHANNEL_ID))?.policy).toBe('auto_approve');
    expect(await repo.listChannelProposals()).toHaveLength(0);
  });

  it('unmutes an existing muted channel and resumes its RSS (ADR 0015)', async () => {
    const muted: Channel = {
      id: CHANNEL_ID,
      title: 'Muted',
      policy: 'manual',
      status: 'allowed',
      muted: true,
      addedAt: 0,
    };
    const repo = new MemoryRepository({ channels: [muted], channelProposals: [resolvedProposal] });
    const result = await approveChannelProposal(repo, resolvedProposal, fakeFetch(), 100);

    expect(result.kind).toBe('unmuted');
    expect((await repo.getChannel(CHANNEL_ID))?.muted).toBe(false);
    expect(await repo.listChannels()).toHaveLength(1);
    expect(await repo.listChannelProposals()).toHaveLength(0);
    expect((await repo.getVideo('UN-0gLuVOZU'))?.status).toBe('pending');
  });

  it('rejecting removes the proposal and leaves no decision', async () => {
    const repo = new MemoryRepository({ channelProposals: [resolvedProposal] });
    await rejectChannelProposal(repo, resolvedProposal);

    expect(await repo.listChannelProposals()).toHaveLength(0);
    expect(await repo.listChannels()).toHaveLength(0);
    expect(await repo.listDecisions()).toHaveLength(0);
  });

  it('retrying an unresolved proposal stores its resolved channel metadata', async () => {
    const repo = new MemoryRepository({ channelProposals: [unresolvedProposal] });
    const result = await retryChannelProposal(repo, unresolvedProposal, fakeFetch(CHANNEL_ID));

    expect(result.kind).toBe('resolved');
    const [stored] = await repo.listChannelProposals();
    expect(stored).toMatchObject({
      id: CHANNEL_ID,
      channelId: CHANNEL_ID,
      resolved: true,
      title: 'Shared channel',
    });
    expect(await repo.listChannelProposals()).toHaveLength(1);
    expect(await repo.listChannels()).toHaveLength(0);
  });

  it('retrying a now-known channel removes the stale proposal', async () => {
    const existing: Channel = {
      id: CHANNEL_ID,
      title: 'Existing',
      policy: 'manual',
      status: 'allowed',
      addedAt: 0,
    };
    const repo = new MemoryRepository({
      channels: [existing],
      channelProposals: [unresolvedProposal],
    });
    const result = await retryChannelProposal(repo, unresolvedProposal, fakeFetch(CHANNEL_ID));

    expect(result.kind).toBe('already');
    expect(await repo.listChannelProposals()).toHaveLength(0);
  });

  it('persists proposals across an app restart', async () => {
    await AsyncStorage.clear();
    const repo = new AsyncStorageRepository();
    await repo.init();
    await repo.upsertChannelProposal(resolvedProposal);

    const restarted = new AsyncStorageRepository();
    await restarted.init();
    expect(await restarted.listChannelProposals()).toEqual([resolvedProposal]);
  });

  it('deduplicates by channel id when an unresolved raw link is enriched', async () => {
    const repo = new MemoryRepository({ channelProposals: [unresolvedProposal] });
    const enriched = await retryChannelProposal(
      repo,
      unresolvedProposal,
      fakeFetch(CHANNEL_ID),
    );
    expect(enriched.kind).toBe('resolved');

    const again = await saveChannelProposal(repo, {
      ...resolvedProposal,
      rawUrl: 'https://www.youtube.com/@someone',
    });
    expect(again.created).toBe(false);
    expect(await repo.listChannelProposals()).toHaveLength(1);
  });
});
