import {
  isChannelMuted,
  mutedChannelForVideo,
  withChannelMuted,
} from '../src/domain/channels';
import type { Channel } from '../src/domain/types';

const channel: Channel = {
  id: 'UC_x5XG1OV2P6uZZ5FSM9Ttw',
  title: 'Kanał',
  policy: 'auto_approve',
  status: 'allowed',
  addedAt: 10,
};

describe('channel mute flag (ADR 0015)', () => {
  it('treats an absent flag as not muted', () => {
    expect(isChannelMuted(channel)).toBe(false);
    expect(isChannelMuted({ ...channel, muted: false })).toBe(false);
    expect(isChannelMuted({ ...channel, muted: true })).toBe(true);
  });

  it('toggles only the muted flag', () => {
    const muted = withChannelMuted(channel, true);
    expect(muted).toEqual({ ...channel, muted: true });
    expect(withChannelMuted(muted, false)).toEqual({ ...channel, muted: false });
  });

  it('builds a manual, allowed and muted channel for an approved film', () => {
    expect(
      mutedChannelForVideo(
        { channelId: 'UCZhWZdKjn0e3ctyVZxsMkKQ', channelTitle: ' shinmiri2 ' },
        123,
      ),
    ).toEqual({
      id: 'UCZhWZdKjn0e3ctyVZxsMkKQ',
      title: 'shinmiri2',
      policy: 'manual',
      status: 'allowed',
      muted: true,
      addedAt: 123,
    });
  });

  it('falls back to the channel id as the title', () => {
    expect(
      mutedChannelForVideo({ channelId: 'UCZhWZdKjn0e3ctyVZxsMkKQ' }, 1)?.title,
    ).toBe('UCZhWZdKjn0e3ctyVZxsMkKQ');
  });

  it('cannot create a channel without a channel id', () => {
    expect(mutedChannelForVideo({ channelTitle: 'Bez id' }, 1)).toBeUndefined();
  });
});
