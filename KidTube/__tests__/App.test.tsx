/**
 * @format
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import React from 'react';
import ReactTestRenderer from 'react-test-renderer';
import App from '../App';
import type { Channel } from '../src/domain/types';
import { ChildHomeScreen } from '../src/ui/ChildHomeScreen';

const CHANNEL: Channel = {
  id: 'UC_x5XG1OV2P6uZZ5FSM9Ttw',
  title: 'Kanał testowy',
  policy: 'auto_approve',
  status: 'allowed',
  addedAt: 0,
};

const FEED = `<?xml version="1.0"?>
<feed xmlns:yt="http://www.youtube.com/xml/schemas/2015" xmlns:media="http://search.yahoo.com/mrss/">
 <yt:channelId>${CHANNEL.id}</yt:channelId>
 <title>${CHANNEL.title}</title>
 <entry>
  <yt:videoId>UN-0gLuVOZU</yt:videoId>
  <yt:channelId>${CHANNEL.id}</yt:channelId>
  <title>Testowy film</title>
  <published>2024-01-01T00:00:00+00:00</published>
  <media:group><media:thumbnail url="https://img/UN-0gLuVOZU.jpg"/></media:group>
 </entry>
</feed>`;

const flush = () => new Promise<void>(resolve => setTimeout(resolve, 0));

beforeEach(async () => {
  await AsyncStorage.clear();
});

afterEach(() => {
  jest.restoreAllMocks();
});

test('renders correctly', async () => {
  await ReactTestRenderer.act(() => {
    ReactTestRenderer.create(<App />);
  });
});

test('syncs channels once when the app opens (ADR 0006)', async () => {
  await AsyncStorage.setItem('@kidtube/channels/v1', JSON.stringify([CHANNEL]));
  // A configured PIN skips the first-run setup screen, so the child view mounts.
  await AsyncStorage.setItem(
    '@kidtube/settings/v1',
    JSON.stringify({ pinHash: 'hash', pinSalt: 'salt', pinIterations: 1 }),
  );
  const fetchMock = jest.fn(async (_input: string, _init?: unknown) => ({
    ok: true,
    status: 200,
    json: async () => ({}),
    text: async () => FEED,
  }));
  (globalThis as unknown as { fetch: typeof fetch }).fetch = fetchMock as unknown as typeof fetch;

  let tree: ReactTestRenderer.ReactTestRenderer | undefined;
  await ReactTestRenderer.act(async () => {
    tree = ReactTestRenderer.create(<App />);
    await flush();
  });
  // Let the queued first sync finish (it runs after the ready state is shown).
  await ReactTestRenderer.act(async () => {
    await flush();
    await flush();
  });

  expect(fetchMock).toHaveBeenCalledTimes(1);
  expect(String(fetchMock.mock.calls[0][0])).toContain(`channel_id=${CHANNEL.id}`);

  // The child's pull-to-refresh runs the same sync action (ADR 0006). Two
  // quick pulls share one run instead of fetching the channel twice.
  const home = tree!.root.findByType(ChildHomeScreen);
  await ReactTestRenderer.act(async () => {
    const first = home.props.onRefresh();
    const second = home.props.onRefresh();
    await Promise.all([first, second]);
    await flush();
  });
  expect(fetchMock).toHaveBeenCalledTimes(2);

  await ReactTestRenderer.act(async () => {
    tree?.unmount();
  });
});
