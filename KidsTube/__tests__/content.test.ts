import type { Channel, Video, VideoSource, VideoStatus } from '../src/domain/types';
import {
  channelsForChild,
  continueWatchingVideos,
  decideIncomingVideoStatus,
  decideNewVideoStatus,
  isPlayable,
  mergeSyncedVideos,
  pendingVideos,
  proposalsForChild,
  rssPendingVideos,
  rssToVideos,
  videoSortTime,
  videosForChild,
  videosForChannel,
} from '../src/domain/content';

const channel: Channel = {
  id: 'UC_x5XG1OV2P6uZZ5FSM9Ttw',
  title: 'Google for Developers',
  policy: 'manual',
  status: 'allowed',
  addedAt: 0,
};

const now = 1_700_000_000_000;

describe('decideNewVideoStatus', () => {
  it('honours auto_approve', () => {
    expect(decideNewVideoStatus({ policy: 'auto_approve', status: 'allowed' })).toBe('allowed');
  });

  it('defaults to pending for manual channels', () => {
    expect(decideNewVideoStatus({ policy: 'manual', status: 'allowed' })).toBe('pending');
  });

  it('blocks everything from a blocked channel', () => {
    expect(decideNewVideoStatus({ policy: 'auto_approve', status: 'blocked' })).toBe('blocked');
  });

  it('supports automatic blocking and quiet caching (ADR 0019)', () => {
    expect(decideNewVideoStatus({ policy: 'auto_block', status: 'allowed' })).toBe('blocked');
    expect(decideNewVideoStatus({ policy: 'quiet', status: 'allowed' })).toBe('pending');
  });
});

describe('decideIncomingVideoStatus (ADR 0019)', () => {
  it('honours every channel policy for a shared link without a decision', () => {
    expect(
      decideIncomingVideoStatus({ policy: 'auto_approve', status: 'allowed' }, undefined),
    ).toBe('allowed');
    expect(decideIncomingVideoStatus({ policy: 'manual', status: 'allowed' }, undefined)).toBe(
      'pending',
    );
    expect(decideIncomingVideoStatus({ policy: 'auto_block', status: 'allowed' }, undefined)).toBe(
      'blocked',
    );
    expect(decideIncomingVideoStatus({ policy: 'quiet', status: 'allowed' }, undefined)).toBe(
      'pending',
    );
  });

  it('lets a blocked channel win over a previous allow decision', () => {
    expect(
      decideIncomingVideoStatus({ policy: 'auto_approve', status: 'blocked' }, { outcome: 'allow' }),
    ).toBe('blocked');
  });
});

describe('rssToVideos', () => {
  it('maps entries using the channel policy', () => {
    const videos = rssToVideos(
      [{ videoId: 'UN-0gLuVOZU', title: 'T', publishedAt: 123, thumbnailUrl: 'x' }],
      channel,
      now,
    );
    expect(videos[0]).toMatchObject({
      id: 'UN-0gLuVOZU',
      channelId: channel.id,
      channelTitle: channel.title,
      status: 'pending',
      source: 'rss',
      addedAt: now,
    });
  });
});

describe('mergeSyncedVideos', () => {
  const existing: Video = {
    id: 'AAAbbbCCC11',
    channelId: channel.id,
    title: 'Old',
    status: 'blocked',
    source: 'rss',
    addedAt: 1,
  };

  it('never overwrites a parent decision', () => {
    const incoming: Video = {
      id: 'AAAbbbCCC11',
      channelId: channel.id,
      title: 'New title',
      status: 'allowed',
      source: 'rss',
      addedAt: 2,
    };
    const { videos, added } = mergeSyncedVideos([existing], [incoming]);
    expect(added).toHaveLength(0);
    expect(videos[0].status).toBe('blocked');
    expect(videos[0].title).toBe('New title');
  });

  it('adds genuinely new videos', () => {
    const incoming: Video = {
      id: 'NEWvideo123',
      channelId: channel.id,
      title: 'Fresh',
      status: 'pending',
      source: 'rss',
      addedAt: 2,
    };
    const { videos, added } = mergeSyncedVideos([existing], [incoming]);
    expect(added.map(v => v.id)).toEqual(['NEWvideo123']);
    expect(videos).toHaveLength(2);
  });
});

describe('child view helpers', () => {
  const base: Video = {
    id: 'x',
    title: 't',
    status: 'pending',
    source: 'rss',
    addedAt: 0,
  };

  it('only plays allowed videos', () => {
    expect(isPlayable({ status: 'allowed' })).toBe(true);
    expect(isPlayable({ status: 'pending' })).toBe(false);
    expect(isPlayable({ status: 'blocked' })).toBe(false);
  });

  it('filters and sorts the child library', () => {
    const videos: Video[] = [
      { ...base, id: 'a', status: 'allowed', publishedAt: 100 },
      { ...base, id: 'b', status: 'pending', publishedAt: 200 },
      { ...base, id: 'c', status: 'allowed', publishedAt: 300 },
    ];
    expect(videosForChild(videos).map(v => v.id)).toEqual(['c', 'a']);
    expect(pendingVideos(videos).map(v => v.id)).toEqual(['b']);
  });

  it('sorts by publication date, not by the decision or import time (ADR 0020)', () => {
    const videos: Video[] = [
      { ...base, id: 'old', status: 'allowed', publishedAt: 100, addedAt: 900 },
      { ...base, id: 'new', status: 'allowed', publishedAt: 300, addedAt: 10 },
      { ...base, id: 'undated', status: 'allowed', addedAt: 200 },
    ];
    // A decision for the older film does not lift it above a newer upload.
    const decisions = [
      { videoId: 'old', outcome: 'allow' as const, source: 'manual' as const, at: 1_000 },
    ];
    expect(videosForChild(videos).map(v => v.id)).toEqual(['new', 'undated', 'old']);
    expect(videoSortTime(videos[0])).toBe(100);
    expect(videoSortTime(videos[2])).toBe(200);
    expect(decisions).toHaveLength(1);
  });

  it('collects films started but not finished, ordered by publication date (ADR 0020)', () => {
    const videos: Video[] = [
      { ...base, id: 'a', status: 'allowed', publishedAt: 300 },
      { ...base, id: 'b', status: 'allowed', publishedAt: 250 },
      { ...base, id: 'c', status: 'allowed', publishedAt: 100 },
    ];
    const progress = [
      { videoId: 'a', positionSeconds: 30, completed: false, lastWatchedAt: 10 },
      { videoId: 'b', positionSeconds: 120, completed: true, lastWatchedAt: 30 },
      { videoId: 'c', positionSeconds: 60, completed: false, lastWatchedAt: 20 },
      { videoId: 'gone', positionSeconds: 10, completed: false, lastWatchedAt: 40 },
      { videoId: 'never', positionSeconds: 0, completed: false, lastWatchedAt: 50 },
    ];
    // Watching 'c' later does not lift it above the newer publication 'a'.
    expect(continueWatchingVideos(videos, progress).map(v => v.id)).toEqual(['a', 'c']);
  });
});

describe('pending source helpers (ADR 0001)', () => {
  const make = (id: string, status: VideoStatus, source: VideoSource): Video => ({
    id,
    title: id,
    status,
    source,
    addedAt: 0,
  });

  it('rssPendingVideos picks pending RSS scans only', () => {
    const videos: Video[] = [
      make('r1', 'pending', 'rss'),
      make('p1', 'pending', 'propose'),
      make('s1', 'pending', 'share'),
      make('m1', 'pending', 'manual'),
      make('a1', 'allowed', 'rss'),
    ];
    expect(rssPendingVideos(videos).map(v => v.id)).toEqual(['r1']);
  });

  it('proposalsForChild shows only the child\'s own pending entries', () => {
    const videos: Video[] = [
      make('r1', 'pending', 'rss'),
      make('p1', 'pending', 'propose'),
      make('s1', 'pending', 'share'),
      make('m1', 'pending', 'manual'),
      make('p2', 'allowed', 'propose'),
    ];
    expect(proposalsForChild(videos).map(v => v.id)).toEqual(['p1']);
  });
});

describe('child channels (ADR 0004a)', () => {
  const secondChannel: Channel = {
    ...channel,
    id: 'UC2',
    title: 'Alpha',
    status: 'blocked',
  };
  const makeVideo = (id: string, channelId: string): Video => ({
    id,
    channelId,
    title: id,
    status: 'allowed',
    source: 'rss',
    addedAt: 0,
  });

  it('lists allowed channels with at least one playable film, sorted by title', () => {
    const channels = [channel, secondChannel, { ...channel, id: 'UC3', title: 'Empty' }];
    const videos = [makeVideo('a', channel.id), makeVideo('b', channel.id)];
    const entries = channelsForChild(channels, videos);
    expect(entries.map(entry => entry.channel.id)).toEqual([channel.id]);
    expect(entries[0].videoCount).toBe(2);
  });

  it('filters the feed to one channel', () => {
    const videos = [
      makeVideo('a', channel.id),
      makeVideo('b', secondChannel.id),
      makeVideo('c', channel.id),
    ];
    expect(videosForChannel(videos, channel.id).map(v => v.id)).toEqual(['a', 'c']);
  });
});
