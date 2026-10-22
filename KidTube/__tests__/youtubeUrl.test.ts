import { parseYouTubeLink, channelFeedUrl, extractYouTubeUrl } from '../src/domain/youtubeUrl';

describe('parseYouTubeLink', () => {
  it('accepts a naked video id', () => {
    expect(parseYouTubeLink('UN-0gLuVOZU')).toEqual({
      kind: 'video',
      videoId: 'UN-0gLuVOZU',
      raw: 'UN-0gLuVOZU',
    });
  });

  it.each([
    'https://www.youtube.com/watch?v=UN-0gLuVOZU',
    'https://www.youtube.com/watch?v=UN-0gLuVOZU&t=30s',
    'http://m.youtube.com/watch?v=UN-0gLuVOZU',
    'https://music.youtube.com/watch?v=UN-0gLuVOZU&feature=share',
    'https://youtu.be/UN-0gLuVOZU',
    'https://www.youtube.com/embed/UN-0gLuVOZU',
    'https://www.youtube.com/shorts/UN-0gLuVOZU',
    'https://www.youtube.com/live/UN-0gLuVOZU',
    'https://www.youtube-nocookie.com/embed/UN-0gLuVOZU',
    'vnd.youtube:UN-0gLuVOZU',
    'www.youtube.com/watch?v=UN-0gLuVOZU',
  ])('parses video link %s', link => {
    const parsed = parseYouTubeLink(link);
    expect(parsed.kind).toBe('video');
    if (parsed.kind === 'video') {
      expect(parsed.videoId).toBe('UN-0gLuVOZU');
    }
  });

  it('parses channel by id', () => {
    const parsed = parseYouTubeLink(
      'https://www.youtube.com/channel/UC_x5XG1OV2P6uZZ5FSM9Ttw',
    );
    expect(parsed).toMatchObject({
      kind: 'channel',
      channelId: 'UC_x5XG1OV2P6uZZ5FSM9Ttw',
    });
  });

  it('parses channel by @handle', () => {
    const parsed = parseYouTubeLink('https://www.youtube.com/@shinmiri2101');
    expect(parsed).toMatchObject({ kind: 'channel', handle: 'shinmiri2101' });
  });

  it('parses bare @handle and bare name', () => {
    expect(parseYouTubeLink('@shinmiri2101')).toMatchObject({
      kind: 'channel',
      handle: 'shinmiri2101',
    });
    expect(parseYouTubeLink('shinmiri2101')).toMatchObject({
      kind: 'channel',
      handle: 'shinmiri2101',
    });
  });

  it('parses channel by /c/ slug', () => {
    const parsed = parseYouTubeLink('https://www.youtube.com/c/SomeChannel');
    expect(parsed).toMatchObject({ kind: 'channel', slug: 'SomeChannel' });
  });

  it('rejects unrelated links', () => {
    expect(parseYouTubeLink('https://example.com/watch?v=UN-0gLuVOZU').kind).toBe('unknown');
    expect(parseYouTubeLink('https://www.youtube.com/feed/subscriptions').kind).toBe('unknown');
    expect(parseYouTubeLink('').kind).toBe('unknown');
  });

  it('builds feed urls', () => {
    expect(channelFeedUrl('UC_x5XG1OV2P6uZZ5FSM9Ttw')).toBe(
      'https://www.youtube.com/feeds/videos.xml?channel_id=UC_x5XG1OV2P6uZZ5FSM9Ttw',
    );
  });
});

describe('extractYouTubeUrl', () => {
  it('finds a link inside shared text', () => {
    expect(extractYouTubeUrl('Zobacz to: https://youtu.be/UN-0gLuVOZU?si=abc !')).toBe(
      'https://youtu.be/UN-0gLuVOZU?si=abc',
    );
  });

  it('skips non-youtube links', () => {
    expect(extractYouTubeUrl('https://example.com/watch?v=UN-0gLuVOZU')).toBeUndefined();
  });

  it('returns undefined when there is no link', () => {
    expect(extractYouTubeUrl('brak linku')).toBeUndefined();
  });
});
