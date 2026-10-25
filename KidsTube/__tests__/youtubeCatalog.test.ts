import { MemoryRepository } from '../src/data/memoryRepository';
import { CATALOG_DELAY_BASE_MS, CATALOG_DELAY_SPREAD_MS, catalogDelayMs } from '../src/domain/catalog';
import type { Channel } from '../src/domain/types';
import type { FetchLike } from '../src/services/youtubeMetadata';
import {
  CatalogError,
  fetchCatalogPage,
  runCatalogImport,
} from '../src/services/youtubeCatalog';

const CHANNEL: Channel = {
  id: 'UC_TEST',
  title: 'Kanał testowy',
  policy: 'manual',
  status: 'allowed',
  addedAt: 1,
};

const videoItem = (videoId: string) => ({
  richItemRenderer: {
    content: {
      videoRenderer: {
        videoId,
        title: { runs: [{ text: `Film ${videoId}` }] },
        thumbnail: { thumbnails: [{ url: 'small' }, { url: `https://img/${videoId}.jpg` }] },
      },
    },
  },
});

const lockupItem = (videoId: string, title = `Film ${videoId}`, contentType = 'LOCKUP_CONTENT_TYPE_VIDEO') => ({
  richItemRenderer: {
    content: {
      lockupViewModel: {
        contentId: videoId,
        contentType,
        metadata: { lockupMetadataViewModel: { title: { content: title } } },
        contentImage: {
          thumbnailViewModel: {
            image: { sources: [{ url: 'small' }, { url: `https://img/${videoId}.jpg` }] },
          },
        },
      },
    },
  },
});

const continuationItem = (token: string) => ({
  continuationItemRenderer: {
    continuationEndpoint: { continuationCommand: { token } },
  },
});

const firstPage = (videoIds: string[], token?: string) => ({
  contents: {
    twoColumnBrowseResultsRenderer: {
      tabs: [
        {
          tabRenderer: {
            selected: true,
            content: {
              richGridRenderer: {
                contents: [
                  ...videoIds.map(videoItem),
                  ...(token ? [continuationItem(token)] : []),
                ],
              },
            },
          },
        },
      ],
    },
  },
});

const continuationPage = (videoIds: string[], token?: string) => ({
  onResponseReceivedActions: [
    {
      appendContinuationItemsAction: {
        continuationItems: [
          ...videoIds.map(videoItem),
          ...(token ? [continuationItem(token)] : []),
        ],
      },
    },
  ],
});

const ok = (json: unknown) => ({
  ok: true,
  status: 200,
  json: async () => json,
});

/** Fetch double that records continuation tokens and returns queued responses. */
const catalogFetch = (responses: unknown[]): { fetchFn: FetchLike; tokens: (string | undefined)[] } => {
  const tokens: (string | undefined)[] = [];
  const fetchFn: FetchLike = async (_input, init) => {
    const body = JSON.parse(String(init?.body ?? '{}'));
    tokens.push(body.continuation);
    const next = responses.shift();
    if (!next) {
      throw new Error('no more responses');
    }
    return ok(next);
  };
  return { fetchFn, tokens };
};

describe('catalog pacing (ADR 0009)', () => {
  it('randomises 3–7 s between requests', () => {
    expect(catalogDelayMs(() => 0)).toBe(CATALOG_DELAY_BASE_MS - CATALOG_DELAY_SPREAD_MS / 2);
    expect(catalogDelayMs(() => 0.5)).toBe(CATALOG_DELAY_BASE_MS);
    expect(catalogDelayMs(() => 1)).toBe(CATALOG_DELAY_BASE_MS + CATALOG_DELAY_SPREAD_MS / 2);
  });
});

describe('fetchCatalogPage (ADR 0009)', () => {
  it('reads the Videos tab and its continuation token', async () => {
    const { fetchFn, tokens } = catalogFetch([firstPage(['a', 'b'], 'T1')]);
    const page = await fetchCatalogPage(CHANNEL.id, undefined, fetchFn);
    expect(page.videos.map(video => video.videoId)).toEqual(['a', 'b']);
    expect(page.videos[0].thumbnailUrl).toBe('https://img/a.jpg');
    expect(page.nextToken).toBe('T1');
    expect(tokens).toEqual([undefined]);
  });

  it('reads the current lockupViewModel grid shape', async () => {
    const page = {
      contents: {
        twoColumnBrowseResultsRenderer: {
          tabs: [
            {
              tabRenderer: {
                selected: true,
                content: {
                  richGridRenderer: {
                    contents: [lockupItem('a'), lockupItem('b'), continuationItem('T1')],
                  },
                },
              },
            },
          ],
        },
      },
    };
    const { fetchFn } = catalogFetch([page]);
    const parsed = await fetchCatalogPage(CHANNEL.id, undefined, fetchFn);
    expect(parsed.videos).toEqual([
      { videoId: 'a', title: 'Film a', thumbnailUrl: 'https://img/a.jpg' },
      { videoId: 'b', title: 'Film b', thumbnailUrl: 'https://img/b.jpg' },
    ]);
    expect(parsed.nextToken).toBe('T1');
  });

  it('ignores non-video lockups (e.g. playlists)', async () => {
    const page = {
      contents: {
        twoColumnBrowseResultsRenderer: {
          tabs: [
            {
              tabRenderer: {
                selected: true,
                content: {
                  richGridRenderer: {
                    contents: [lockupItem('a'), lockupItem('PL1', 'Playlista', 'LOCKUP_CONTENT_TYPE_PLAYLIST')],
                  },
                },
              },
            },
          ],
        },
      },
    };
    const { fetchFn } = catalogFetch([page]);
    const parsed = await fetchCatalogPage(CHANNEL.id, undefined, fetchFn);
    expect(parsed.videos.map(video => video.videoId)).toEqual(['a']);
  });

  it('reads a continuation page', async () => {
    const { fetchFn, tokens } = catalogFetch([continuationPage(['c'], 'T2')]);
    const page = await fetchCatalogPage(CHANNEL.id, 'T1', fetchFn);
    expect(page.videos.map(video => video.videoId)).toEqual(['c']);
    expect(page.nextToken).toBe('T2');
    expect(tokens).toEqual(['T1']);
  });

  it('reports HTTP errors', async () => {
    const fetchFn: FetchLike = async () => ({
      ok: false,
      status: 429,
      json: async () => ({}),
    });
    await expect(fetchCatalogPage(CHANNEL.id, undefined, fetchFn)).rejects.toMatchObject({
      kind: 'http',
    });
  });

  it('reports a timeout instead of hanging forever', async () => {
    const fetchFn: FetchLike = () => new Promise(() => undefined);
    const failure = fetchCatalogPage(CHANNEL.id, undefined, fetchFn, 10);
    await expect(failure).rejects.toBeInstanceOf(CatalogError);
    await expect(failure).rejects.toMatchObject({ kind: 'timeout' });
  });
});

describe('runCatalogImport (ADR 0009)', () => {
  it('walks the whole catalog, merges films and marks the checkpoint done', async () => {
    const repo = new MemoryRepository({ channels: [CHANNEL] });
    const { fetchFn, tokens } = catalogFetch([
      firstPage(['a', 'b'], 'T1'),
      continuationPage(['c']),
    ]);
    const delays: number[] = [];
    const progress: number[] = [];

    const result = await runCatalogImport(repo, CHANNEL, {
      fetchFn,
      delay: async ms => {
        delays.push(ms);
      },
      random: () => 0.5,
      onProgress: imported => progress.push(imported),
    });

    expect(result).toMatchObject({ imported: 3, added: 3, done: true, cancelled: false });
    expect(tokens).toEqual([undefined, 'T1']);
    // One pause before the second request, none before the first.
    expect(delays).toEqual([5000]);
    expect(progress).toEqual([2, 3]);
    const channel = await repo.getChannel(CHANNEL.id);
    expect(channel?.catalog).toMatchObject({ imported: 3, done: true });
    expect((await repo.listVideos()).map(video => video.id).sort()).toEqual(['a', 'b', 'c']);
    // `manual` policy → pending.
    expect((await repo.listVideos()).every(video => video.status === 'pending')).toBe(true);
  });

  it('stops on the first error and keeps the checkpoint', async () => {
    const repo = new MemoryRepository({ channels: [CHANNEL] });
    let call = 0;
    const fetchFn: FetchLike = async () => {
      call += 1;
      if (call === 1) {
        return ok(firstPage(['a'], 'T1'));
      }
      return { ok: false, status: 500, json: async () => ({}) };
    };
    const result = await runCatalogImport(repo, CHANNEL, {
      fetchFn,
      delay: async () => undefined,
    });

    expect(result.done).toBe(false);
    expect(result.error).toBeTruthy();
    const channel = await repo.getChannel(CHANNEL.id);
    expect(channel?.catalog).toMatchObject({ imported: 1, done: false });
    expect(channel?.catalog?.error).toBeTruthy();
    expect((await repo.listVideos()).map(video => video.id)).toEqual(['a']);
  });

  it('resumes from the stored cursor by replaying the last page without double counting', async () => {
    const repo = new MemoryRepository({
      channels: [{ ...CHANNEL, catalog: { imported: 2, resumeToken: 'T1', done: false } }],
      videos: [
        { id: 'a', channelId: CHANNEL.id, title: 'a', status: 'blocked', source: 'rss', addedAt: 1 },
      ],
    });
    const { fetchFn, tokens } = catalogFetch([
      continuationPage(['a', 'b'], 'T2'),
      continuationPage(['c']),
    ]);

    const result = await runCatalogImport(repo, CHANNEL, {
      fetchFn,
      delay: async () => undefined,
    });

    expect(tokens).toEqual(['T1', 'T2']);
    expect(result).toMatchObject({ imported: 3, done: true });
    const videos = await repo.listVideos();
    // The parent's decision on “a” survives the replay.
    expect(videos.find(video => video.id === 'a')?.status).toBe('blocked');
  });

  it('restarts from the beginning when the stored cursor expired', async () => {
    const repo = new MemoryRepository({
      channels: [{ ...CHANNEL, catalog: { imported: 5, resumeToken: 'OLD', done: false } }],
    });
    const { fetchFn } = catalogFetch([{}]);

    const result = await runCatalogImport(repo, CHANNEL, {
      fetchFn,
      delay: async () => undefined,
    });

    expect(result.imported).toBe(0);
    expect(result.error).toContain('Kursor wygasł');
    expect((await repo.getChannel(CHANNEL.id))?.catalog).toMatchObject({ imported: 0, done: false });
  });

  it('can be cancelled between pages', async () => {
    const repo = new MemoryRepository({ channels: [CHANNEL] });
    const { fetchFn, tokens } = catalogFetch([
      firstPage(['a'], 'T1'),
      continuationPage(['b']),
    ]);
    let pages = 0;

    const result = await runCatalogImport(repo, CHANNEL, {
      fetchFn,
      delay: async () => undefined,
      onProgress: () => {
        pages += 1;
      },
      // Cancel after the first page: the second request must never go out.
      isCancelled: () => pages >= 1,
    });

    expect(result.cancelled).toBe(true);
    expect(result.done).toBe(false);
    expect(result.imported).toBe(1);
    expect(tokens).toEqual([undefined]);
    expect((await repo.getChannel(CHANNEL.id))?.catalog).toMatchObject({
      imported: 1,
      done: false,
    });
  });

  it('applies the channel policy to imported films', async () => {
    const autoChannel: Channel = { ...CHANNEL, id: 'UC_AUTO', policy: 'auto_approve' };
    const repo = new MemoryRepository({ channels: [autoChannel] });
    const { fetchFn } = catalogFetch([firstPage(['a'])]);

    await runCatalogImport(repo, autoChannel, { fetchFn, delay: async () => undefined });

    expect((await repo.listVideos())[0]?.status).toBe('allowed');
  });

  it('does nothing when the catalog is already done', async () => {
    const repo = new MemoryRepository({
      channels: [{ ...CHANNEL, catalog: { imported: 10, done: true } }],
    });
    const { fetchFn, tokens } = catalogFetch([]);
    const result = await runCatalogImport(repo, CHANNEL, { fetchFn });
    expect(result).toMatchObject({ imported: 10, done: true });
    expect(tokens).toEqual([]);
  });
});
