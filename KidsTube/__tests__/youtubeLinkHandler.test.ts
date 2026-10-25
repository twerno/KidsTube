import AsyncStorage from '@react-native-async-storage/async-storage';
import { AsyncStorageRepository } from '../src/data/asyncStorageRepository';
import { MemoryRepository } from '../src/data/memoryRepository';
import { createYouTubeLinkHandlerBridge } from '../src/native/youtubeLinkHandler';

describe('optional YouTube VIEW handler (ADR 0014)', () => {
  it('is disabled by default', async () => {
    const memory = new MemoryRepository();
    const storage = new AsyncStorageRepository();
    await storage.init();
    expect((await memory.getSettings()).youtubeLinkHandlerEnabled).toBe(false);
    expect((await storage.getSettings()).youtubeLinkHandlerEnabled).toBe(false);
  });

  it('persists the setting across an app restart', async () => {
    await AsyncStorage.clear();
    const repo = new AsyncStorageRepository();
    await repo.init();
    await repo.updateSettings({ youtubeLinkHandlerEnabled: true });

    const restarted = new AsyncStorageRepository();
    await restarted.init();
    expect((await restarted.getSettings()).youtubeLinkHandlerEnabled).toBe(true);
  });

  it('enabling and disabling call the native component bridge', async () => {
    const native = {
      setEnabled: jest.fn(async () => true),
      isDefaultHandler: jest.fn(async () => true),
      openDefaultAppsSettings: jest.fn(async () => true),
    };
    const bridge = createYouTubeLinkHandlerBridge(native);

    await bridge.setEnabled(true);
    await bridge.setEnabled(false);
    expect(native.setEnabled.mock.calls).toEqual([[true], [false]]);
    expect(await bridge.isDefaultHandler()).toBe(true);
    await bridge.openDefaultAppsSettings();
    expect(native.openDefaultAppsSettings).toHaveBeenCalledTimes(1);
  });

  it('is a safe no-op without the native module (tests/other platforms)', async () => {
    const bridge = createYouTubeLinkHandlerBridge(undefined);
    await expect(bridge.setEnabled(true)).resolves.toBeUndefined();
    expect(await bridge.isDefaultHandler()).toBe(false);
    await expect(bridge.openDefaultAppsSettings()).resolves.toBeUndefined();
  });

  it('treats a failing default-handler query as “not default”', async () => {
    const bridge = createYouTubeLinkHandlerBridge({
      setEnabled: () => undefined,
      isDefaultHandler: async () => {
        throw new Error('boom');
      },
      openDefaultAppsSettings: () => undefined,
    });
    expect(await bridge.isDefaultHandler()).toBe(false);
  });
});
