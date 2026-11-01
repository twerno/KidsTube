import {
  DEFAULT_CHANNEL_STATUS_FILTER,
  UNKNOWN_CHANNEL_KEY,
  blockedChannels,
  blockedVideos,
  channelBarEntries,
  isBlockedChannelVideo,
  channelStatusCounts,
  countBySource,
  filterChannelVideos,
  filterVideos,
  libraryVideos,
  matchesSource,
  normalizeChannelFilter,
  pendingForChannel,
  pendingVideos,
} from '../src/domain/panel';
import type { Channel, Video } from '../src/domain/types';

const channel = (overrides: Partial<Channel> & Pick<Channel, 'id' | 'title'>): Channel => ({
  policy: 'manual',
  status: 'allowed',
  addedAt: 0,
  ...overrides,
});

const CHANNEL_A = channel({ id: 'UC_A', title: 'Kanał A', policy: 'auto_approve' });
const CHANNEL_MUTED = channel({ id: 'UC_M', title: 'Kanał wyciszony', muted: true });
const CHANNEL_C = channel({ id: 'UC_C', title: 'Kanał C' });
const CHANNEL_BLOCKED = channel({ id: 'UC_B', title: 'Kanał zablokowany', status: 'blocked' });

const video = (overrides: Partial<Video> & Pick<Video, 'id'>): Video => ({
  title: overrides.id,
  status: 'pending',
  source: 'rss',
  addedAt: 0,
  ...overrides,
});

const PENDING_RSS = video({ id: 'v-rss', channelId: 'UC_C', channelTitle: 'Kanał C' });
const PENDING_CHILD = video({ id: 'v-child', source: 'propose', channelId: 'UC_NEW', channelTitle: 'Nowy kanał' });
const PENDING_LINK = video({ id: 'v-link', source: 'share', channelId: undefined, channelTitle: 'Bez id' });
const PENDING_MANUAL = video({ id: 'v-manual', source: 'manual', channelId: 'UC_C' });
const PENDING_BLOCKED_CHANNEL = video({ id: 'v-blocked-channel', channelId: 'UC_B', channelTitle: 'Kanał zablokowany' });
const ALLOWED_LIBRARY = { ...video({ id: 'v-allowed' }), status: 'allowed' as const, channelId: 'UC_C' };
const ALLOWED_BLOCKED_CHANNEL: Video = {
  ...video({ id: 'v-allowed-blocked', channelId: 'UC_B' }),
  status: 'allowed',
};
const BLOCKED_DECISION: Video = { ...video({ id: 'v-rejected', channelId: 'UC_C' }), status: 'blocked' };

const VIDEOS = [
  PENDING_RSS,
  PENDING_CHILD,
  PENDING_LINK,
  PENDING_MANUAL,
  PENDING_BLOCKED_CHANNEL,
  ALLOWED_LIBRARY,
  ALLOWED_BLOCKED_CHANNEL,
  BLOCKED_DECISION,
];

describe('panel selectors (ADR 0016)', () => {
  it('keeps films of blocked channels out of the decision queue', () => {
    const pending = pendingVideos(VIDEOS, [CHANNEL_A, CHANNEL_BLOCKED]);
    expect(pending.map(v => v.id)).toEqual(['v-rss', 'v-child', 'v-link', 'v-manual']);
  });

  it('hides pending scans of muted channels from the queue but keeps them for the channel', () => {
    const mutedChannel = channel({ id: 'UC_MUTED', title: 'Wyciszony', muted: true });
    const film = video({ id: 'v-muted', channelId: 'UC_MUTED', channelTitle: 'Wyciszony' });

    expect(pendingVideos([film], [mutedChannel])).toEqual([]);
    expect(pendingForChannel([film], 'UC_MUTED')).toEqual([film]);
  });

  it('keeps explicit links and proposals from a muted/quiet channel in the queue (ADR 0019)', () => {
    const mutedChannel = channel({ id: 'UC_MUTED', title: 'Wyciszony', muted: true });
    const quietChannel = channel({ id: 'UC_QUIET', title: 'Cichy', policy: 'quiet' });
    const rss = video({ id: 'v-quiet-rss', channelId: 'UC_QUIET', source: 'rss' });
    const share = video({ id: 'v-muted-share', channelId: 'UC_MUTED', source: 'share' });
    const propose = video({ id: 'v-quiet-propose', channelId: 'UC_QUIET', source: 'propose' });

    expect(pendingVideos([rss], [quietChannel])).toEqual([]);
    expect(pendingVideos([share], [mutedChannel]).map(v => v.id)).toEqual(['v-muted-share']);
    expect(pendingVideos([propose], [quietChannel]).map(v => v.id)).toEqual(['v-quiet-propose']);
  });

  it('keeps films of blocked channels out of the library', () => {
    const library = libraryVideos(VIDEOS, [CHANNEL_A, CHANNEL_BLOCKED]);
    expect(library.map(v => v.id)).toEqual(['v-allowed']);
  });

  it('lets a manual allow newer than the block make one film visible (ADR 0019)', () => {
    const blocked = channel({
      id: 'UC_B',
      title: 'Kanał zablokowany',
      status: 'blocked',
      blockedAt: 1_000,
    });
    const film = video({ id: 'v-exempt', channelId: 'UC_B', status: 'allowed' });
    const decisions = [
      {
        videoId: 'v-exempt',
        outcome: 'allow' as const,
        source: 'manual' as const,
        at: 2_000,
      },
    ];

    expect(isBlockedChannelVideo(film, [blocked], decisions)).toBe(false);
    expect(libraryVideos([film], [blocked], decisions).map(v => v.id)).toEqual(['v-exempt']);
    expect(blockedVideos([film], [blocked], decisions)).toEqual([]);

    // An older allow (before the block) is not an exception.
    expect(
      isBlockedChannelVideo(film, [blocked], [{ ...decisions[0], at: 500 }]),
    ).toBe(true);
    // Nor is an automatic repeat of an earlier allow.
    expect(
      isBlockedChannelVideo(film, [blocked], [{ ...decisions[0], source: 'auto' }]),
    ).toBe(true);
  });

  it('moves both rejected films and every film of a blocked channel to the archive', () => {
    const blocked = blockedVideos(VIDEOS, [CHANNEL_BLOCKED]);
    expect(blocked.map(v => v.id).sort()).toEqual([
      'v-allowed-blocked',
      'v-blocked-channel',
      'v-rejected',
    ]);
  });

  it('lists only blocked channels', () => {
    expect(blockedChannels([CHANNEL_A, CHANNEL_MUTED, CHANNEL_BLOCKED]).map(c => c.id)).toEqual([
      'UC_B',
    ]);
  });

  it('splits sources by who actually asked: a shared link is not a child proposal', () => {
    expect(matchesSource(PENDING_CHILD, 'child')).toBe(true);
    expect(matchesSource(PENDING_LINK, 'child')).toBe(false);
    expect(matchesSource(PENDING_LINK, 'link')).toBe(true);
    expect(matchesSource(PENDING_MANUAL, 'link')).toBe(true);
    expect(matchesSource(PENDING_RSS, 'rss')).toBe(true);
  });

  it('builds channel bar entries with observed markers and an unknown bucket', () => {
    const entries = channelBarEntries(VIDEOS, [CHANNEL_A, CHANNEL_C, CHANNEL_MUTED, CHANNEL_BLOCKED]);
    const byKey = new Map(entries.map(entry => [entry.key, entry]));

    expect(byKey.get('UC_NEW')?.observed).toBe(false);
    expect(byKey.get('UC_C')?.observed).toBe(true);
    expect(byKey.get(UNKNOWN_CHANNEL_KEY)?.isUnknown).toBe(true);
    expect(byKey.get(UNKNOWN_CHANNEL_KEY)?.title).toBe('Bez id');
    expect(byKey.get(UNKNOWN_CHANNEL_KEY)?.count).toBe(1);
  });

  it('counts source chips inside the selected channel (faceted counts)', () => {
    const scoped = countBySource(VIDEOS, 'UC_C');
    expect(scoped).toEqual({ all: 4, rss: 3, child: 0, link: 1 });

    const global = countBySource(VIDEOS, null);
    expect(global.all).toBe(VIDEOS.length);
    expect(global.child).toBe(1);
  });

  it('filters by both levels at once', () => {
    const filtered = filterVideos(VIDEOS, 'rss', 'UC_C');
    expect(filtered.map(v => v.id).sort()).toEqual(['v-allowed', 'v-rejected', 'v-rss']);
  });

  it('drops a channel filter that no longer has an entry', () => {
    const entries = channelBarEntries(pendingVideos(VIDEOS, [CHANNEL_BLOCKED]), [
      CHANNEL_A,
      CHANNEL_BLOCKED,
    ]);
    expect(normalizeChannelFilter(entries, 'UC_GONE')).toBeNull();
    expect(normalizeChannelFilter(entries, 'UC_NEW')).toBe('UC_NEW');
    expect(normalizeChannelFilter(entries, null)).toBeNull();
  });
});

describe('channel status filters (ADR 0018)', () => {
  it('defaults to accepted', () => {
    expect(DEFAULT_CHANNEL_STATUS_FILTER).toBe('accepted');
  });

  it('counts all three statuses inside one channel', () => {
    expect(channelStatusCounts(VIDEOS, 'UC_C')).toEqual({
      accepted: 1,
      rejected: 1,
      pending: 2,
    });
  });

  it('filters channel films by the selected status only', () => {
    expect(filterChannelVideos(VIDEOS, 'UC_C', 'accepted').map(v => v.id)).toEqual([
      'v-allowed',
    ]);
    expect(filterChannelVideos(VIDEOS, 'UC_C', 'rejected').map(v => v.id)).toEqual([
      'v-rejected',
    ]);
    expect(filterChannelVideos(VIDEOS, 'UC_C', 'pending').map(v => v.id)).toEqual([
      'v-rss',
      'v-manual',
    ]);
  });
});
