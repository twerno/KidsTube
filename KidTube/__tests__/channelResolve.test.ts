import {
  extractChannelId,
  extractChannelTitle,
  resolveChannelFromUrl,
} from '../src/services/channelResolve';
import type { FetchLike } from '../src/services/youtubeMetadata';

const CHANNEL_ID = 'UCZhWZdKjn0e3ctyVZxsMkKQ';

const FEED = `<?xml version="1.0"?>
<feed xmlns:yt="http://www.youtube.com/xml/schemas/2015" xmlns:media="http://search.yahoo.com/mrss/">
 <yt:channelId>${CHANNEL_ID}</yt:channelId>
 <entry>
  <yt:videoId>UN-0gLuVOZU</yt:videoId>
  <yt:channelId>${CHANNEL_ID}</yt:channelId>
  <title>Some video</title>
  <author><name>shinmiri2</name></author>
  <published>2024-01-01T00:00:00+00:00</published>
 </entry>
</feed>`;

const PAGE = `<html><head>
<link rel="canonical" href="https://www.youtube.com/channel/${CHANNEL_ID}">
<meta property="og:title" content="shinmiri2 &amp; friends">
</head></html>`;

function resolverFetch(
  resolveJson: unknown,
  resolveOk = true,
  feed = FEED,
): FetchLike {
  return async input => {
    if (input.includes('navigation/resolve_url')) {
      return {
        ok: resolveOk,
        status: resolveOk ? 200 : 500,
        json: async () => resolveJson,
      } as any;
    }
    return {
      ok: true,
      status: 200,
      json: async () => ({}),
      text: async () => feed,
    } as any;
  };
}

describe('channelResolve', () => {
  it('extracts the channel id and title from HTML', () => {
    expect(extractChannelId(PAGE)).toBe(CHANNEL_ID);
    expect(extractChannelTitle(PAGE)).toBe('shinmiri2 & friends');
  });

  it('resolves via InnerTube and gets the title from the feed', async () => {
    const resolved = await resolveChannelFromUrl(
      'https://www.youtube.com/@shinmiri2101',
      resolverFetch({ endpoint: { browseEndpoint: { browseId: CHANNEL_ID } } }),
    );
    expect(resolved).toEqual({
      channelId: CHANNEL_ID,
      title: 'shinmiri2',
      handle: 'shinmiri2101',
    });
  });

  it('returns undefined when InnerTube has no browseId', async () => {
    const resolved = await resolveChannelFromUrl(
      'https://www.youtube.com/@nope',
      resolverFetch({ endpoint: {} }),
    );
    expect(resolved).toBeUndefined();
  });
});
