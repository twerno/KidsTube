/**
 * Child navigation (ADR 0004 / 0004a) — pure rules.
 *
 * The child moves through four root tabs. A channel opens as a pushed view on
 * top of the channels tab, so “back” returns to the channel list instead of
 * jumping to the home screen. The stack is kept in `App` while the player is
 * open, which makes playback return to the exact context it started from
 * (feed → film → back → feed, channels → channel → film → back → channel).
 */

import type { Channel } from './types';

export type ChildTab = 'feed' | 'channels' | 'proposals' | 'history';

export type ChildView =
  | { kind: 'feed' }
  | { kind: 'channels' }
  | { kind: 'channel'; channelId: string; channelTitle: string }
  | { kind: 'proposals' }
  | { kind: 'history' };

export interface ChildNavState {
  /** Bottom of the stack is always a tab root; the last entry is visible. */
  stack: ChildView[];
}

export const INITIAL_CHILD_NAV: ChildNavState = { stack: [{ kind: 'feed' }] };

export function currentChildView(state: ChildNavState): ChildView {
  return state.stack[state.stack.length - 1] ?? { kind: 'feed' };
}

/** A channel detail belongs to the “Kanały” tab, not to a tab of its own. */
export function activeChildTab(state: ChildNavState): ChildTab {
  const view = currentChildView(state);
  return view.kind === 'channel' ? 'channels' : view.kind;
}

/**
 * Tabs replace the whole path with their root view. Tapping the active root
 * tab again is a no-op; tapping “Kanały” while inside a channel returns to the
 * channel list.
 */
export function selectChildTab(state: ChildNavState, tab: ChildTab): ChildNavState {
  if (state.stack.length === 1 && state.stack[0].kind === tab) {
    return state;
  }
  return { stack: [{ kind: tab }] };
}

/** Open a channel detail on top of the current path. */
export function openChildChannel(
  state: ChildNavState,
  channel: Pick<Channel, 'id' | 'title'>,
): ChildNavState {
  const view = currentChildView(state);
  if (view.kind === 'channel' && view.channelId === channel.id) {
    return state;
  }
  return {
    stack: [
      ...state.stack,
      { kind: 'channel', channelId: channel.id, channelTitle: channel.title },
    ],
  };
}

export function canGoBackChild(state: ChildNavState): boolean {
  return state.stack.length > 1;
}

/** One contextual step back; a root tab stays put (the OS closes the app). */
export function goBackChild(state: ChildNavState): ChildNavState {
  if (!canGoBackChild(state)) {
    return state;
  }
  return { stack: state.stack.slice(0, -1) };
}
