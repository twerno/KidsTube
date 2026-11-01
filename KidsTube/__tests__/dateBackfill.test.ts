import { MemoryRepository } from '../src/data/memoryRepository';
import {
  backfillPublicationDates,
  videosMissingPublicationDate,
} from '../src/services/dateBackfill';
import type { FetchLike } from '../src/services/youtubeMetadata';
import type { Video } from '../src/domain/types';

const video = (id: string, extra: Partial<Video> = {}): Video => ({
  id,
  title: id,
  status: 'allowed',
  source: 'rss',
  addedAt: 0,
  ...extra,
});

/** InnerTube `player` fake: only the ids in `dates` resolve. */
function playerFetch(dates: Record<string, string>, calls: string[] = []): FetchLike {
  return (async (_url: string, init?: { body?: string }) => {
    const body = JSON.parse(init?.body ?? '{}') as { videoId?: string };
    const videoId = body.videoId ?? '';
    calls.push(videoId);
    const publishDate = dates[videoId];
    return {
      ok: true,
      status: 200,
      json: async () =>
        publishDate
          ? {
              microformat: { playerMicroformatRenderer: { publishDate } },
              videoDetails: { channelId: 'UC_x5XG1OV2P6uZZ5FSM9Ttw' },
            }
          : {},
      text: async () => '',
    };
  }) as unknown as FetchLike;
}

const noSleep = async () => undefined;

describe('publication date backfill (ADR 0023)', () => {
  it('picks films without a date, freshest import first, and skips blocked ones', () => {
    const picked = videosMissingPublicationDate([
      video('dated', { publishedAt: 1000, addedAt: 500 }),
      video('blocked', { status: 'blocked', addedAt: 900 }),
      video('old-import', { addedAt: 100 }),
      video('new-import', { addedAt: 800 }),
    ]);
    expect(picked.map(item => item.id)).toEqual(['new-import', 'old-import']);
  });

  it('fills the exact publication date from InnerTube', async () => {
    const repo = new MemoryRepository({
      videos: [video('a', { addedAt: 10 }), video('b', { addedAt: 20 })],
    });
    const result = await backfillPublicationDates(
      repo,
      playerFetch({ b: '2024-03-01T10:00:00-08:00' }),
      { sleep: noSleep },
    );

    expect(result.tried).toBe(2);
    expect(result.updated.map(item => item.id)).toEqual(['b']);
    expect(await repo.getVideo('b')).toMatchObject({
      publishedAt: Date.parse('2024-03-01T10:00:00-08:00'),
    });
    // A miss is not a write: the film keeps its missing date for the next run.
    expect((await repo.getVideo('a'))?.publishedAt).toBeUndefined();
  });

  it('asks about at most `limit` films per run', async () => {
    const videos = ['a', 'b', 'c', 'd'].map((id, index) => video(id, { addedAt: index }));
    const repo = new MemoryRepository({ videos });
    const calls: string[] = [];
    const result = await backfillPublicationDates(
      repo,
      playerFetch({ a: '2024-01-01T00:00:00Z', b: '2024-01-02T00:00:00Z' }, calls),
      { limit: 2, spacingMs: 0, sleep: noSleep },
    );

    expect(result.tried).toBe(2);
    expect(calls).toEqual(['d', 'c']);
  });

  it('paces the calls between requests', async () => {
    const repo = new MemoryRepository({ videos: [video('a'), video('b'), video('c')] });
    const sleeps: number[] = [];
    await backfillPublicationDates(repo, playerFetch({}), {
      spacingMs: 800,
      sleep: async (ms: number) => {
        sleeps.push(ms);
      },
    });
    expect(sleeps).toEqual([800, 800]);
  });
});
