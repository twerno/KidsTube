import { isAllowedPlayerUrl } from '../src/domain/playerGuard';

const ID = 'UN-0gLuVOZU';

describe('isAllowedPlayerUrl', () => {
  it('allows the embed page of the whitelisted video', () => {
    expect(isAllowedPlayerUrl(`https://www.youtube.com/embed/${ID}`, ID)).toBe(true);
    expect(
      isAllowedPlayerUrl(
        `https://www.youtube.com/embed/${ID}?playsinline=1&autoplay=1&rel=0`,
        ID,
      ),
    ).toBe(true);
  });

  it('allows youtube-nocookie embed and about:blank', () => {
    expect(isAllowedPlayerUrl(`https://www.youtube-nocookie.com/embed/${ID}`, ID)).toBe(true);
    expect(isAllowedPlayerUrl('about:blank', ID)).toBe(true);
  });

  it('blocks navigating to a different video (More videos / related)', () => {
    expect(isAllowedPlayerUrl('https://www.youtube.com/embed/OTHER_VIDEO_1', ID)).toBe(false);
    expect(isAllowedPlayerUrl('https://www.youtube.com/watch?v=OTHER_VIDEO_1', ID)).toBe(false);
    expect(isAllowedPlayerUrl('https://youtu.be/OTHER_VIDEO_1', ID)).toBe(false);
    expect(isAllowedPlayerUrl('https://www.youtube.com/shorts/OTHER_VIDEO_1', ID)).toBe(false);
  });

  it('blocks the YouTube chrome links (logo, title, channel)', () => {
    expect(isAllowedPlayerUrl('https://www.youtube.com/', ID)).toBe(false);
    expect(isAllowedPlayerUrl('https://www.youtube.com/results?search_query=x', ID)).toBe(false);
    expect(isAllowedPlayerUrl('https://www.youtube.com/@somechannel', ID)).toBe(false);
    expect(isAllowedPlayerUrl('https://www.youtube.com/channel/UC123', ID)).toBe(false);
  });

  it('blocks non-YouTube hosts and insecure schemes', () => {
    expect(isAllowedPlayerUrl('https://evil.example.com/embed/' + ID, ID)).toBe(false);
    expect(isAllowedPlayerUrl(`http://www.youtube.com/embed/${ID}`, ID)).toBe(false);
    expect(isAllowedPlayerUrl('java' + 'script:alert(1)', ID)).toBe(false);
    expect(isAllowedPlayerUrl('', ID)).toBe(false);
  });

  it('is not fooled by lookalike hosts', () => {
    expect(isAllowedPlayerUrl(`https://www.youtube.com.evil.com/embed/${ID}`, ID)).toBe(false);
    expect(isAllowedPlayerUrl(`https://notyoutube.com/embed/${ID}`, ID)).toBe(false);
  });
});
