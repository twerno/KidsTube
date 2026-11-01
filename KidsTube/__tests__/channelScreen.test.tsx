import React from 'react';
import ReactTestRenderer from 'react-test-renderer';
import { ChannelScreen } from '../src/ui/parent/ChannelScreen';
import { Chip } from '../src/ui/parent/Chip';
import { Text } from 'react-native';
import { EmptyState } from '../src/ui/parent/EmptyState';
import { Button } from '../src/ui/components';
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
      onSelectPolicy={noop}
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
  // The channel card also uses chips for the “new films” policy (ADR 0019);
  // the status chip helper only looks at counted labels.
  return tree.root
    .findAllByType(Chip)
    .map(node => String(node.props.label))
    .filter(label => /\(\d+\)$/.test(label));
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

describe('channel catalog import and bulk actions (ADR 0009)', () => {
  const renderWith = async (
    channel: Channel,
    options: Partial<React.ComponentProps<typeof ChannelScreen>> = {},
    videos: Video[] = VIDEOS,
  ): Promise<ReactTestRenderer.ReactTestRenderer> => {
    let tree: ReactTestRenderer.ReactTestRenderer | undefined;
    await ReactTestRenderer.act(async () => {
      tree = ReactTestRenderer.create(
        <ChannelScreen
          channel={channel}
          videos={videos}
          onSetStatus={noop}
          onPreview={noop}
          onSelectPolicy={noop}
          onToggleMuted={noop}
          onBlock={noop}
          {...options}
        />,
      );
    });
    return tree!;
  };

  const button = (tree: ReactTestRenderer.ReactTestRenderer, prefix: string) => {
    const found = tree.root
      .findAllByType(Button)
      .find(node => String(node.props.title).startsWith(prefix));
    if (!found) {
      throw new Error(`Brak przycisku ${prefix}`);
    }
    return found;
  };

  it('offers “Pobierz wszystkie” and starts the import', async () => {
    const onStartCatalog = jest.fn();
    const tree = await renderWith(CHANNEL, { onStartCatalog });

    const importButton = button(tree, 'Pobierz wszystkie');
    await ReactTestRenderer.act(async () => {
      importButton.props.onPress();
    });
    expect(onStartCatalog).toHaveBeenCalledWith(CHANNEL, false);
  });

  it('offers a full re-download once the catalog is done (ADR 0019)', async () => {
    const done: Channel = { ...CHANNEL, catalog: { imported: 40, done: true } };
    const onStartCatalog = jest.fn();
    const tree = await renderWith(done, { onStartCatalog });

    const importButton = button(tree, 'Pobierz ponownie');
    expect(importButton.props.disabled).toBe(false);
    await ReactTestRenderer.act(async () => {
      importButton.props.onPress();
    });
    expect(onStartCatalog).toHaveBeenCalledWith(done, true);
  });

  it('selects one of four “new films” policies (ADR 0019)', async () => {
    const onSelectPolicy = jest.fn();
    const tree = await renderWith(CHANNEL, { onSelectPolicy });

    const quiet = tree.root
      .findAllByType(Chip)
      .find(node => String(node.props.label).startsWith('Wyciszenie'));
    expect(quiet).toBeTruthy();
    await ReactTestRenderer.act(async () => {
      quiet!.props.onPress();
    });
    expect(onSelectPolicy).toHaveBeenCalledWith(CHANNEL, 'quiet');
  });

  it('offers to continue a paused import and shows its progress', async () => {
    const paused: Channel = {
      ...CHANNEL,
      catalog: { imported: 120, resumeToken: 'T1', done: false, error: 'HTTP 429' },
    };
    const tree = await renderWith(paused, { onStartCatalog: noop });

    expect(button(tree, 'Kontynuuj pobieranie')).toBeTruthy();
    const texts = tree.root.findAllByType(Text).map(node =>
      Array.isArray(node.props.children)
        ? node.props.children.join('')
        : String(node.props.children),
    );
    expect(texts.some(text => text.includes('Wczytano 120 filmów'))).toBe(true);
    expect(texts.some(text => text.includes('HTTP 429'))).toBe(true);
  });

  it('bulk decisions cover all pending films of the channel', async () => {
    const onBulkDecide = jest.fn();
    const tree = await renderWith(CHANNEL, { onBulkDecide });

    await ReactTestRenderer.act(async () => {
      button(tree, 'Akceptuj wszystkie (2)').props.onPress();
      button(tree, 'Odrzuć wszystkie (2)').props.onPress();
    });

    expect(onBulkDecide).toHaveBeenNthCalledWith(1, CHANNEL, 'allow');
    expect(onBulkDecide).toHaveBeenNthCalledWith(2, CHANNEL, 'reject');
  });

  it('hides bulk buttons when the channel has no pending films', async () => {
    const tree = await renderWith(CHANNEL, { onBulkDecide: noop }, [
      video({ id: 'v-accepted', status: 'allowed' }),
    ]);
    expect(
      tree.root.findAllByType(Button).some(node => String(node.props.title).startsWith('Akceptuj')),
    ).toBe(false);
  });

  it('disables the catalog and bulk actions while an import runs', async () => {
    const tree = await renderWith(CHANNEL, {
      onStartCatalog: noop,
      onBulkDecide: noop,
      catalogRunning: true,
    });

    expect(button(tree, 'Pobierz wszystkie').props.disabled).toBe(true);
    expect(button(tree, 'Akceptuj wszystkie').props.disabled).toBe(true);
    expect(button(tree, 'Odrzuć wszystkie').props.disabled).toBe(true);
  });
});
