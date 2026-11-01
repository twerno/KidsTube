import { MemoryRepository } from '../src/data/memoryRepository';
import { syncAllChannels, syncChannel } from '../src/services/channelSync';
import type { FetchLike } from '../src/services/youtubeMetadata';
import type { Channel } from '../src/domain/types';

const channelXml = (channelId: string, title: string, videoId: string) => `<?xml version="1.0"?>
<feed xmlns:yt="http://www.youtube.com/xml/schemas/2015" xmlns:media="http://search.yahoo.com/mrss/">
 <yt:channelId>${channelId}</yt:channelId>
 <title>${title}</title>
 <entry>
  <yt:videoId>${videoId}</yt:videoId>
  <yt:channelId>${channelId}</yt:channelId>
  <title>${title} video</title>
  <published>2024-01-01T00:00:00+00:00</published>
  <media:group><media:thumbnail url="https://img/${videoId}.jpg"/></media:group>
 </entry>
</feed>`;

function feedFetch(xml: string): FetchLike {
  return async () => ({
    ok: true,
    status: 200,
    json: async () => ({}),
    text: async () => xml,
  } as any);
}

const manual: Channel = {
  id: 'UC_x5XG1OV2P6uZZ5FSM9Ttw',
  title: 'Manual',
  policy: 'manual',
  status: 'allowed',
  addedAt: 0,
};

const auto: Channel = {
  id: 'UCaaaaaaaaaaaaaaaaaaaaaa',
  title: 'Auto',
  policy: 'auto_approve',
  status: 'allowed',
  addedAt: 0,
};

describe('channelSync', () => {
  it('imports videos as pending for manual channels', async () => {
    const repo = new MemoryRepository({ channels: [manual] });
    const result = await syncChannel(
      repo,
      manual,
      feedFetch(channelXml(manual.id, manual.title, 'UN-0gLuVOZU')),
    );
    expect(result.added).toHaveLength(1);
    expect((await repo.getVideo('UN-0gLuVOZU'))?.status).toBe('pending');
  });

  it('imports videos as allowed for auto-approve channels', async () => {
    const repo = new MemoryRepository({ channels: [auto] });
    await syncChannel(repo, auto, feedFetch(channelXml(auto.id, auto.title, 'AUTOvideo1')));
    expect((await repo.getVideo('AUTOvideo1'))?.status).toBe('allowed');
  });

  it('caches quiet-channel films as pending and auto-blocks auto_block films (ADR 0019)', async () => {
    const quiet: Channel = { ...manual, id: 'UCquiet', policy: 'quiet' };
    const blocked: Channel = { ...auto, id: 'UCblocked', policy: 'auto_block' };
    const repo = new MemoryRepository({ channels: [quiet, blocked] });

    await syncChannel(repo, quiet, feedFetch(channelXml(quiet.id, quiet.title, 'QUIETvideo1')));
    await syncChannel(
      repo,
      blocked,
      feedFetch(channelXml(blocked.id, blocked.title, 'BLOCKEDvid1')),
    );

    expect((await repo.getVideo('QUIETvideo1'))?.status).toBe('pending');
    expect((await repo.getVideo('BLOCKEDvid1'))?.status).toBe('blocked');
  });

  it('syncs all channels and preserves decisions on re-sync', async () => {
    const repo = new MemoryRepository({ channels: [manual, auto] });
    const fetchFor = async (input: string) => {
      const xml = input.includes(manual.id)
        ? channelXml(manual.id, manual.title, 'UN-0gLuVOZU')
        : channelXml(auto.id, auto.title, 'AUTOvideo1');
      return { ok: true, status: 200, json: async () => ({}), text: async () => xml } as any;
    };
    const fetchLike: FetchLike = fetchFor;

    await syncAllChannels(repo, fetchLike);
    await repo.setVideoStatus('UN-0gLuVOZU', 'blocked');
    await syncAllChannels(repo, fetchLike);

    expect((await repo.getVideo('UN-0gLuVOZU'))?.status).toBe('blocked');
    expect((await repo.getVideo('AUTOvideo1'))?.status).toBe('allowed');
  });

  it('never fetches RSS for a muted channel (ADR 0015)', async () => {
    const muted: Channel = { ...manual, muted: true };
    const repo = new MemoryRepository({ channels: [muted] });
    const fetchLike = jest.fn(async () => {
      throw new Error('muted channel must not be fetched');
    });

    expect(await syncChannel(repo, muted, fetchLike)).toEqual({ added: [], total: 0 });
    expect(await syncAllChannels(repo, fetchLike)).toEqual({
      added: [],
      perChannel: {},
    });
    expect(fetchLike).not.toHaveBeenCalled();
  });

  it('syncs again once the channel is unmuted', async () => {
    const muted: Channel = { ...auto, muted: true };
    const repo = new MemoryRepository({ channels: [muted] });
    const fetchLike = feedFetch(channelXml(auto.id, auto.title, 'AUTOvideo1'));

    await syncAllChannels(repo, fetchLike);
    expect(await repo.getVideo('AUTOvideo1')).toBeUndefined();

    await repo.upsertChannel({ ...muted, muted: false });
    await syncAllChannels(repo, fetchLike);
    expect((await repo.getVideo('AUTOvideo1'))?.status).toBe('allowed');
  });
});
