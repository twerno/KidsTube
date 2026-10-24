import {
  INITIAL_CHILD_NAV,
  activeChildTab,
  canGoBackChild,
  currentChildView,
  goBackChild,
  openChildChannel,
  selectChildTab,
} from '../src/domain/childNavigation';

const channel = { id: 'UC1', title: 'Kanał' };

describe('child navigation (ADR 0004a)', () => {
  it('starts on the feed', () => {
    expect(currentChildView(INITIAL_CHILD_NAV)).toEqual({ kind: 'feed' });
    expect(activeChildTab(INITIAL_CHILD_NAV)).toBe('feed');
    expect(canGoBackChild(INITIAL_CHILD_NAV)).toBe(false);
  });

  it('switches tabs to their root and keeps the active tab derived', () => {
    const history = selectChildTab(INITIAL_CHILD_NAV, 'history');
    expect(history.stack.map(view => view.kind)).toEqual(['history']);
    expect(activeChildTab(history)).toBe('history');
  });

  it('is a no-op when the active root tab is selected again', () => {
    expect(selectChildTab(INITIAL_CHILD_NAV, 'feed')).toBe(INITIAL_CHILD_NAV);
  });

  it('pushes a channel on top of the channel list and derives the channels tab', () => {
    const channels = selectChildTab(INITIAL_CHILD_NAV, 'channels');
    const detail = openChildChannel(channels, channel);
    expect(detail.stack.map(view => view.kind)).toEqual(['channels', 'channel']);
    expect(activeChildTab(detail)).toBe('channels');
    expect(currentChildView(detail)).toMatchObject({ channelId: 'UC1', channelTitle: 'Kanał' });
    expect(canGoBackChild(detail)).toBe(true);
  });

  it('back returns to the channel list and stops at the root', () => {
    const detail = openChildChannel(selectChildTab(INITIAL_CHILD_NAV, 'channels'), channel);
    const list = goBackChild(detail);
    expect(currentChildView(list)).toEqual({ kind: 'channels' });
    expect(goBackChild(list)).toBe(list);
    expect(goBackChild(INITIAL_CHILD_NAV)).toBe(INITIAL_CHILD_NAV);
  });

  it('selecting a tab from a channel detail resets the path', () => {
    const detail = openChildChannel(selectChildTab(INITIAL_CHILD_NAV, 'channels'), channel);
    const feed = selectChildTab(detail, 'feed');
    expect(feed).toEqual({ stack: [{ kind: 'feed' }] });
  });
});
