import { MemoryRepository } from '../src/data/memoryRepository';
import {
  handleIncomingLink,
  shouldProcessIncomingLink,
} from '../src/services/incomingLink';
import type { FetchLike } from '../src/services/youtubeMetadata';
import type { Channel, Decision, Video } from '../src/domain/types';

const AUTO_CHANNEL = 'UCaaaaaaaaaaaaaaaaaaaaaa';
const MANUAL_CHANNEL = 'UC_x5XG1OV2P6uZZ5FSM9Ttw';
const BLOCKED_CHANNEL = 'UCbbbbbbbbbbbbbbbbbbbbbb';
const UNKNOWN_CHANNEL = 'UCcccccccccccccccccccccc';
const RESOLVED_CHANNEL = 'UCZhWZdKjn0e3ctyVZxsMkKQ';

const autoChannel: Channel = {
  id: AUTO_CHANNEL,
  title: 'Auto',
  policy: 'auto_approve',
  status: 'allowed',
  addedAt: 0,
};

const manualChannel: Channel = {
  id: MANUAL_CHANNEL,
  title: 'Manual',
  policy: 'manual',
  status: 'allowed',
  addedAt: 0,
};

const blockedChannel: Channel = {
  id: BLOCKED_CHANNEL,
  title: 'Blocked channel',
  policy: 'auto_approve',
  status: 'blocked',
  addedAt: 0,
};

function feed(channelId: string, title = 'Resolved title', videoId = 'RESOLVED123'): string {
  return `<?xml version="1.0"?>
<feed xmlns:yt="http://www.youtube.com/xml/schemas/2015" xmlns:media="http://search.yahoo.com/mrss/">
 <yt:channelId>${channelId}</yt:channelId>
 <entry>
  <yt:videoId>${videoId}</yt:videoId>
  <yt:channelId>${channelId}</yt:channelId>
  <title>Some video</title>
  <author><name>${title}</name></author>
  <published>2024-01-01T00:00:00+00:00</published>
 </entry>
</feed>`;
}

interface ApiOptions {
  title?: string;
  author?: string;
  channelId?: string;
  channelTitle?: string;
  publishDate?: string;
  resolveId?: string;
  feedChannelId?: string;
  feedTitle?: string;
}

function apiFetch(options: ApiOptions = {}): FetchLike {
  return async (input) => {
    if (input.includes('/oembed')) {
      return {
        ok: true,
        status: 200,
        json: async () => ({
          title: options.title ?? 'Found it',
          author_name: options.author ?? options.channelTitle ?? 'Some author',
          thumbnail_url: 'thumb',
        }),
      } as any;
    }
    if (input.includes('/youtubei/v1/player')) {
      return {
        ok: true,
        status: 200,
        json: async () => ({
          videoDetails: {
            channelId: options.channelId,
            author: options.channelTitle,
          },
          microformat: {
            playerMicroformatRenderer: {
              publishDate: options.publishDate ?? '2024-02-03T00:00:00Z',
            },
          },
        }),
      } as any;
    }
    if (input.includes('navigation/resolve_url')) {
      return {
        ok: !!options.resolveId,
        status: options.resolveId ? 200 : 404,
        json: async () =>
          options.resolveId
            ? { endpoint: { browseEndpoint: { browseId: options.resolveId } } }
            : {},
      } as any;
    }
    if (input.includes('feeds/videos.xml')) {
      return {
        ok: true,
        status: 200,
        json: async () => ({}),
        text: async () =>
          feed(options.feedChannelId ?? options.resolveId ?? RESOLVED_CHANNEL, options.feedTitle),
      } as any;
    }
    return { ok: false, status: 404, json: async () => ({}) } as any;
  };
}

const allowedVideo: Video = {
  id: 'UN-0gLuVOZU',
  title: 'Allowed',
  status: 'allowed',
  source: 'rss',
  addedAt: 0,
};

const blockedVideo: Video = {
  id: 'BLOCKED1234',
  title: 'Blocked',
  status: 'blocked',
  source: 'rss',
  addedAt: 0,
};

const decision = (
  videoId: string,
  outcome: Decision['outcome'],
  at = 1,
): Decision => ({ videoId, outcome, source: 'manual', at });

describe('incoming VIEW gate (ADR 0014)', () => {
  it('always processes shares', () => {
    expect(shouldProcessIncomingLink('share', false)).toBe(true);
    expect(shouldProcessIncomingLink('share', true)).toBe(true);
  });

  it('only processes VIEW links when the handler is enabled', () => {
    expect(shouldProcessIncomingLink('view', false)).toBe(false);
    expect(shouldProcessIncomingLink('view', true)).toBe(true);
  });
});

describe('shared films (ADR 0013)', () => {
  it('creates a pending film for an unknown link and stores channel metadata', async () => {
    const repo = new MemoryRepository();
    const result = await handleIncomingLink(
      'https://youtu.be/BRANDnew123',
      repo,
      apiFetch({ channelId: UNKNOWN_CHANNEL, channelTitle: 'Unknown channel' }),
    );
    expect(result.kind).toBe('pending');
    const stored = await repo.getVideo('BRANDnew123');
    expect(stored).toMatchObject({
      title: 'Found it',
      status: 'pending',
      source: 'share',
      channelId: UNKNOWN_CHANNEL,
      channelTitle: 'Unknown channel',
    });
    expect(stored?.publishedAt).toBe(Date.parse('2024-02-03T00:00:00Z'));
  });

  it('stores a child proposal with source propose', async () => {
    const repo = new MemoryRepository();
    const result = await handleIncomingLink(
      'https://youtu.be/PROPOSE1234',
      repo,
      apiFetch({ title: 'Wanted' }),
      undefined,
      'propose',
    );
    expect(result.kind).toBe('pending');
    const stored = await repo.getVideo('PROPOSE1234');
    expect(stored).toMatchObject({ title: 'Wanted', status: 'pending', source: 'propose' });
  });

  it('re-attributes an undecided RSS entry to an explicit link (ADR 0019)', async () => {
    const rssPending: Video = {
      id: 'RSSPENDING1',
      channelId: MANUAL_CHANNEL,
      channelTitle: manualChannel.title,
      title: 'From RSS',
      status: 'pending',
      source: 'rss',
      addedAt: 1,
    };

    const forChild = new MemoryRepository({ channels: [manualChannel], videos: [rssPending] });
    const childResult = await handleIncomingLink(
      'https://youtu.be/RSSPENDING1',
      forChild,
      undefined,
      undefined,
      'propose',
    );
    expect(childResult.kind).toBe('pending');
    expect((await forChild.getVideo('RSSPENDING1'))?.source).toBe('propose');

    const forParent = new MemoryRepository({ channels: [manualChannel], videos: [rssPending] });
    const shareResult = await handleIncomingLink('https://youtu.be/RSSPENDING1', forParent);
    expect(shareResult.kind).toBe('pending');
    expect((await forParent.getVideo('RSSPENDING1'))?.source).toBe('share');
  });

  it('does not overwrite the source after a decision', async () => {
    const decided: Video = {
      id: 'DECIDED1234',
      channelId: MANUAL_CHANNEL,
      title: 'Decided',
      status: 'pending',
      source: 'rss',
      addedAt: 1,
    };
    const repo = new MemoryRepository({
      channels: [manualChannel],
      videos: [decided],
      decisions: [decision('DECIDED1234', 'reject', 10)],
    });
    const result = await handleIncomingLink('https://youtu.be/DECIDED1234', repo);
    expect(result.kind).toBe('blocked');
    expect((await repo.getVideo('DECIDED1234'))?.source).toBe('rss');
  });

  it('does not autoplay an already allowed film; it reports the library hit', async () => {
    const repo = new MemoryRepository({ videos: [allowedVideo] });
    const result = await handleIncomingLink('https://youtu.be/UN-0gLuVOZU', repo);
    expect(result).toEqual({ kind: 'allowed', video: allowedVideo, reason: 'known' });
  });

  it('returns blocked for a blocked film', async () => {
    const repo = new MemoryRepository({ videos: [blockedVideo] });
    const result = await handleIncomingLink('https://youtu.be/BLOCKED1234', repo);
    expect(result.kind).toBe('blocked');
  });

  it('uses the latest parent decision after the film was removed', async () => {
    const repo = new MemoryRepository({
      channels: [manualChannel],
      decisions: [decision('REMOVED1234', 'allow', 10)],
    });
    const result = await handleIncomingLink(
      'https://youtu.be/REMOVED1234',
      repo,
      apiFetch({ channelId: MANUAL_CHANNEL }),
    );
    expect(result.kind).toBe('allowed');
    if (result.kind === 'allowed') {
      expect(result.reason).toBe('decision');
    }
    expect((await repo.getVideo('REMOVED1234'))?.status).toBe('allowed');
  });

  it('auto-approves a new film from an auto_approve channel without a decision', async () => {
    const repo = new MemoryRepository({ channels: [autoChannel] });
    const result = await handleIncomingLink(
      'https://youtu.be/AUTOnew1234',
      repo,
      apiFetch({ channelId: AUTO_CHANNEL }),
    );
    expect(result.kind).toBe('allowed');
    if (result.kind === 'allowed') {
      expect(result.reason).toBe('policy');
    }
    expect((await repo.getVideo('AUTOnew1234'))?.status).toBe('allowed');
    expect(await repo.listDecisions()).toHaveLength(0);
  });

  it('marks a new film from a manual channel as pending', async () => {
    const repo = new MemoryRepository({ channels: [manualChannel] });
    const result = await handleIncomingLink(
      'https://youtu.be/MANnew12345',
      repo,
      apiFetch({ channelId: MANUAL_CHANNEL }),
    );
    expect(result.kind).toBe('pending');
    expect((await repo.getVideo('MANnew12345'))?.status).toBe('pending');
  });

  it('blocks a new film from a blocked channel', async () => {
    const repo = new MemoryRepository({ channels: [blockedChannel] });
    const result = await handleIncomingLink(
      'https://youtu.be/BLKnew12345',
      repo,
      apiFetch({ channelId: BLOCKED_CHANNEL }),
    );
    expect(result.kind).toBe('blocked');
  });

  it('lets the latest rejection win over an auto_approve policy', async () => {
    const repo = new MemoryRepository({
      channels: [autoChannel],
      decisions: [decision('REJECTED123', 'reject', 10)],
    });
    const result = await handleIncomingLink(
      'https://youtu.be/REJECTED123',
      repo,
      apiFetch({ channelId: AUTO_CHANNEL }),
    );
    expect(result.kind).toBe('blocked');
  });

  it('lets the latest approval win on a manual channel', async () => {
    const repo = new MemoryRepository({
      channels: [manualChannel],
      decisions: [decision('APPROVED123', 'allow', 10)],
    });
    const result = await handleIncomingLink(
      'https://youtu.be/APPROVED123',
      repo,
      apiFetch({ channelId: MANUAL_CHANNEL }),
    );
    expect(result.kind).toBe('allowed');
  });

  it('creates a muted channel when a prior approval reveals an unknown channel', async () => {
    const repo = new MemoryRepository({
      decisions: [decision('APPROVED999', 'allow', 10)],
    });
    const result = await handleIncomingLink(
      'https://youtu.be/APPROVED999',
      repo,
      apiFetch({ channelId: UNKNOWN_CHANNEL, channelTitle: 'Unknown channel' }),
    );

    expect(result.kind).toBe('allowed');
    expect(await repo.getChannel(UNKNOWN_CHANNEL)).toMatchObject({
      title: 'Unknown channel',
      policy: 'manual',
      status: 'allowed',
      muted: true,
    });
  });

  it('does not duplicate a repeated share', async () => {
    const repo = new MemoryRepository();
    await handleIncomingLink(
      'https://youtu.be/BRANDnew123',
      repo,
      apiFetch({ channelId: UNKNOWN_CHANNEL }),
    );
    await handleIncomingLink(
      'https://youtu.be/BRANDnew123',
      repo,
      apiFetch({ channelId: UNKNOWN_CHANNEL }),
    );
    expect(await repo.listVideos()).toHaveLength(1);
    expect(await repo.listDecisions()).toHaveLength(0);
  });

  it('keeps a child proposal pending even for an auto_approve channel', async () => {
    const repo = new MemoryRepository({ channels: [autoChannel] });
    const result = await handleIncomingLink(
      'https://youtu.be/CHILDnew123',
      repo,
      apiFetch({ channelId: AUTO_CHANNEL }),
      undefined,
      'propose',
    );
    expect(result.kind).toBe('pending');
    expect((await repo.getVideo('CHILDnew123'))?.source).toBe('propose');
  });
});

describe('shared channels (ADR 0013)', () => {
  it('recognises a watched channel by id', async () => {
    const repo = new MemoryRepository({ channels: [manualChannel] });
    const result = await handleIncomingLink(
      `https://www.youtube.com/channel/${MANUAL_CHANNEL}`,
      repo,
    );
    expect(result).toEqual({ kind: 'channel-known', channel: manualChannel });
  });

  it('does not resurrect or propose a blocked channel', async () => {
    const repo = new MemoryRepository({ channels: [blockedChannel] });
    const result = await handleIncomingLink(
      `https://www.youtube.com/channel/${BLOCKED_CHANNEL}`,
      repo,
    );
    expect(result.kind).toBe('channel-blocked');
    expect(await repo.listChannelProposals()).toHaveLength(0);
  });

  it('resolves an unknown handle into a channel proposal', async () => {
    const repo = new MemoryRepository();
    const result = await handleIncomingLink(
      'https://www.youtube.com/@someone',
      repo,
      apiFetch({ resolveId: RESOLVED_CHANNEL, feedTitle: 'Someone' }),
    );
    expect(result.kind).toBe('channel-proposal');
    if (result.kind === 'channel-proposal') {
      expect(result.created).toBe(true);
      expect(result.proposal).toMatchObject({
        channelId: RESOLVED_CHANNEL,
        title: 'Someone',
        handle: 'someone',
        resolved: true,
      });
    }
    expect(await repo.listChannelProposals()).toHaveLength(1);
    expect(await repo.listChannels()).toHaveLength(0);
  });

  it('deduplicates a repeated channel share by channel id', async () => {
    const repo = new MemoryRepository();
    const fetchFn = apiFetch({ resolveId: RESOLVED_CHANNEL });
    await handleIncomingLink('https://www.youtube.com/@someone', repo, fetchFn);
    const second = await handleIncomingLink('https://www.youtube.com/@someone', repo, fetchFn);
    expect(second.kind).toBe('channel-proposal');
    if (second.kind === 'channel-proposal') {
      expect(second.created).toBe(false);
    }
    expect(await repo.listChannelProposals()).toHaveLength(1);
  });

  it('keeps an unresolved proposal for a later retry', async () => {
    const repo = new MemoryRepository();
    const result = await handleIncomingLink(
      'https://www.youtube.com/@nobody',
      repo,
      apiFetch(),
    );
    expect(result.kind).toBe('channel-proposal');
    if (result.kind === 'channel-proposal') {
      expect(result.proposal).toMatchObject({ resolved: false, rawUrl: 'https://www.youtube.com/@nobody' });
    }
    expect(await repo.listChannelProposals()).toHaveLength(1);
  });

  it('does not create a proposal for an unrelated link', async () => {
    const repo = new MemoryRepository();
    const result = await handleIncomingLink('https://example.com/video', repo);
    expect(result.kind).toBe('unknown');
    expect(await repo.listChannelProposals()).toHaveLength(0);
    expect(await repo.listVideos()).toHaveLength(0);
  });
});
