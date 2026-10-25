import { parseYouTubeFeed, parseFeedChannelId } from '../src/domain/rss';

const FEED = `<?xml version="1.0" encoding="UTF-8"?>
<feed xmlns:yt="http://www.youtube.com/xml/schemas/2015" xmlns:media="http://search.yahoo.com/mrss/" xmlns="http://www.w3.org/2005/Atom">
 <link rel="self" href="http://www.youtube.com/feeds/videos.xml?channel_id=UC_x5XG1OV2P6uZZ5FSM9Ttw"/>
 <id>yt:channel:_x5XG1OV2P6uZZ5FSM9Ttw</id>
 <yt:channelId>UC_x5XG1OV2P6uZZ5FSM9Ttw</yt:channelId>
 <title>Google for Developers</title>
 <entry>
  <id>yt:video:UN-0gLuVOZU</id>
  <yt:videoId>UN-0gLuVOZU</yt:videoId>
  <yt:channelId>UC_x5XG1OV2P6uZZ5FSM9Ttw</yt:channelId>
  <title>A &amp; B</title>
  <link rel="alternate" href="https://www.youtube.com/watch?v=UN-0gLuVOZU"/>
  <author>
   <name>Google for Developers</name>
   <uri>https://www.youtube.com/channel/UC_x5XG1OV2P6uZZ5FSM9Ttw</uri>
  </author>
  <published>2023-05-01T10:00:00+00:00</published>
  <media:group>
   <media:title>A &amp; B</media:title>
   <media:thumbnail url="https://i.ytimg.com/vi/UN-0gLuVOZU/hqdefault.jpg" width="480" height="360"/>
  </media:group>
 </entry>
 <entry>
  <id>yt:video:AAAbbbCCC11</id>
  <yt:videoId>AAAbbbCCC11</yt:videoId>
  <yt:channelId>UC_x5XG1OV2P6uZZ5FSM9Ttw</yt:channelId>
  <title><![CDATA[Second <video>]]></title>
  <published>2023-04-01T10:00:00+00:00</published>
 </entry>
 <entry>
  <id>yt:video:AAAbbbCCC11</id>
  <yt:videoId>AAAbbbCCC11</yt:videoId>
  <title>Duplicate</title>
 </entry>
</feed>`;

describe('parseYouTubeFeed', () => {
  it('extracts channel id', () => {
    expect(parseFeedChannelId(FEED)).toBe('UC_x5XG1OV2P6uZZ5FSM9Ttw');
  });

  it('parses entries, decodes entities and skips duplicates', () => {
    const videos = parseYouTubeFeed(FEED);
    expect(videos).toHaveLength(2);
    expect(videos[0]).toMatchObject({
      videoId: 'UN-0gLuVOZU',
      channelId: 'UC_x5XG1OV2P6uZZ5FSM9Ttw',
      channelTitle: 'Google for Developers',
      title: 'A & B',
      thumbnailUrl: 'https://i.ytimg.com/vi/UN-0gLuVOZU/hqdefault.jpg',
    });
    expect(videos[0].publishedAt).toBe(Date.parse('2023-05-01T10:00:00+00:00'));
    expect(videos[1].title).toBe('Second <video>');
  });

  it('returns empty for junk input', () => {
    expect(parseYouTubeFeed('')).toEqual([]);
    expect(parseYouTubeFeed('<feed></feed>')).toEqual([]);
  });
});
