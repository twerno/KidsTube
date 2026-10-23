import { MemoryRepository } from '../src/data/memoryRepository';
import { handleIncomingLink } from '../src/services/incomingLink';
import type { FetchLike } from '../src/services/youtubeMetadata';
import type { Channel, Video } from '../src/domain/types';

function fakeFetch(jsonBody: unknown, ok = true): FetchLike {
  return async () => ({
    ok,
    status: ok ? 200 : 404,
    json: async () => jsonBody,
  });
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

const channel: Channel = {
  id: 'UC_x5XG1OV2P6uZZ5FSM9Ttw',
  title: 'Google for Developers',
  policy: 'manual',
  status: 'allowed',
  addedAt: 0,
};

describe('handleIncomingLink', () => {
  it('creates a pending video for an unknown link', async () => {
    const repo = new MemoryRepository();
    const result = await handleIncomingLink(
      'https://youtu.be/BRANDnew123',
      repo,
      fakeFetch({ title: 'Found it', thumbnail_url: 'thumb' }),
    );
    expect(result.kind).toBe('pending');
    const stored = await repo.getVideo('BRANDnew123');
    expect(stored).toMatchObject({ title: 'Found it', status: 'pending', source: 'share' });
  });

  it('stores a child proposal with source propose', async () => {
    const repo = new MemoryRepository();
    const result = await handleIncomingLink(
      'https://youtu.be/PROPOSE1234',
      repo,
      fakeFetch({ title: 'Wanted' }),
      undefined,
      'propose',
    );
    expect(result.kind).toBe('pending');
    const stored = await repo.getVideo('PROPOSE1234');
    expect(stored).toMatchObject({ title: 'Wanted', status: 'pending', source: 'propose' });
  });

  it('returns play for an allowed video', async () => {
    const repo = new MemoryRepository({ videos: [allowedVideo] });
    const result = await handleIncomingLink('https://youtu.be/UN-0gLuVOZU', repo);
    expect(result).toEqual({ kind: 'play', video: allowedVideo });
  });

  it('returns blocked for a blocked video', async () => {
    const repo = new MemoryRepository({ videos: [blockedVideo] });
    const result = await handleIncomingLink('https://youtu.be/BLOCKED1234', repo);
    expect(result.kind).toBe('blocked');
  });

  it('recognises a watched channel by id', async () => {
    const repo = new MemoryRepository({ channels: [channel] });
    const result = await handleIncomingLink(
      'https://www.youtube.com/channel/UC_x5XG1OV2P6uZZ5FSM9Ttw',
      repo,
    );
    expect(result).toEqual({ kind: 'channel', channel });
  });

  it('returns a channel proposal for unknown channels', async () => {
    const repo = new MemoryRepository();
    const result = await handleIncomingLink('https://www.youtube.com/@someone', repo);
    expect(result.kind).toBe('channel-proposal');
  });

  it('ignores unrelated links', async () => {
    const repo = new MemoryRepository();
    const result = await handleIncomingLink('https://example.com', repo);
    expect(result.kind).toBe('unknown');
  });
});
