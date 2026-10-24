import React from 'react';
import ReactTestRenderer from 'react-test-renderer';
import { ChannelScreen } from '../src/ui/parent/ChannelScreen';
import { Chip } from '../src/ui/parent/Chip';
import { EmptyState } from '../src/ui/parent/EmptyState';
import { VideoRow } from '../src/ui/parent/VideoRow';
import type { Channel, Video } from '../src/domain/types';

const CHANNEL: Channel = {
  id: 'UC_CHANNEL',
  title: 'Kanał testowy',
  policy: 'manual',
  status: 'allowed',
  addedAt: 0,
};

const OTHER_CHANNEL: Channel = {
  id: 'UC_OTHER',
  title: 'Inny kanał',
  policy: 'manual',
  status: 'allowed',
  addedAt: 0,
};

const video = (
  overrides: Partial<Video> & Pick<Video, 'id' | 'status'>,
): Video => ({
  title: overrides.id,
  source: 'rss',
  channelId: CHANNEL.id,
  channelTitle: CHANNEL.title,
  addedAt: 0,
  ...overrides,
});

const VIDEOS: Video[] = [
  video({ id: 'v-accepted', status: 'allowed' }),
  video({ id: 'v-rejected', status: 'blocked' }),
  video({ id: 'v-pending-1', status: 'pending' }),
  video({ id: 'v-pending-2', status: 'pending' }),
  video({ id: 'v-other', status: 'pending', channelId: OTHER_CHANNEL.id }),
];

const noop = () => undefined;

function screen(videos: Video[]): React.ReactElement {
  return (
    <ChannelScreen
      channel={CHANNEL}
      videos={videos}
      onSetStatus={noop}
      onPreview={noop}
      onTogglePolicy={noop}
      onToggleMuted={noop}
      onBlock={noop}
    />
  );
}

async function render(videos: Video[]): Promise<ReactTestRenderer.ReactTestRenderer> {
  let tree: ReactTestRenderer.ReactTestRenderer | undefined;
  await ReactTestRenderer.act(async () => {
    tree = ReactTestRenderer.create(screen(videos));
  });
  return tree!;
}

function chipLabels(tree: ReactTestRenderer.ReactTestRenderer): string[] {
  return tree.root.findAllByType(Chip).map(node => String(node.props.label));
}

function visibleVideoIds(tree: ReactTestRenderer.ReactTestRenderer): string[] {
  return tree.root.findAllByType(VideoRow).map(node => String(node.props.video.id));
}

async function pressChip(
  tree: ReactTestRenderer.ReactTestRenderer,
  prefix: string,
): Promise<void> {
  const chip = tree.root
    .findAllByType(Chip)
    .find(node => String(node.props.label).startsWith(prefix));
  if (!chip) {
    throw new Error(`Brak chipa ${prefix}`);
  }
  await ReactTestRenderer.act(async () => {
    chip.props.onPress();
  });
}

describe('channel screen status filters (ADR 0018)', () => {
  it('shows exactly three status chips, no “Wszystkie”, and starts on accepted', async () => {
    const tree = await render(VIDEOS);

    expect(chipLabels(tree)).toEqual([
      'Zaakceptowane (1)',
      'Odrzucone (1)',
      'Oczekujące (2)',
    ]);
    expect(chipLabels(tree).some(label => label.startsWith('Wszystkie'))).toBe(false);
    expect(visibleVideoIds(tree)).toEqual(['v-accepted']);
  });

  it("filters the channel's films by the selected status", async () => {
    const tree = await render(VIDEOS);

    await pressChip(tree, 'Odrzucone');
    expect(visibleVideoIds(tree)).toEqual(['v-rejected']);

    await pressChip(tree, 'Oczekujące');
    expect(visibleVideoIds(tree)).toEqual(['v-pending-1', 'v-pending-2']);

    await pressChip(tree, 'Zaakceptowane');
    expect(visibleVideoIds(tree)).toEqual(['v-accepted']);
  });

  it('keeps the active filter after a decision and updates the counts', async () => {
    const tree = await render(VIDEOS);
    await pressChip(tree, 'Oczekujące');

    const afterDecision = VIDEOS.map(entry =>
      entry.id === 'v-pending-1' ? { ...entry, status: 'allowed' as const } : entry,
    );
    await ReactTestRenderer.act(async () => {
      tree.update(screen(afterDecision));
    });

    expect(chipLabels(tree)).toEqual([
      'Zaakceptowane (2)',
      'Odrzucone (1)',
      'Oczekujące (1)',
    ]);
    expect(visibleVideoIds(tree)).toEqual(['v-pending-2']);
  });

  it('shows the status-specific empty state instead of jumping filters', async () => {
    const tree = await render(VIDEOS);
    await pressChip(tree, 'Oczekujące');

    const withoutPending = VIDEOS.map(entry =>
      entry.status === 'pending' && entry.channelId === CHANNEL.id
        ? { ...entry, status: 'allowed' as const }
        : entry,
    );
    await ReactTestRenderer.act(async () => {
      tree.update(screen(withoutPending));
    });

    expect(chipLabels(tree)).toContain('Oczekujące (0)');
    expect(visibleVideoIds(tree)).toEqual([]);
    const empty = tree.root.findByType(EmptyState);
    expect(empty.props.children).toBe('Brak oczekujących filmów w tym kanale.');
  });

  it('resets to accepted when the channel screen is opened fresh', async () => {
    const first = await render(VIDEOS);
    await pressChip(first, 'Odrzucone');
    expect(visibleVideoIds(first)).toEqual(['v-rejected']);

    await ReactTestRenderer.act(async () => {
      first.unmount();
    });

    const second = await render(VIDEOS);
    expect(visibleVideoIds(second)).toEqual(['v-accepted']);
  });
});
