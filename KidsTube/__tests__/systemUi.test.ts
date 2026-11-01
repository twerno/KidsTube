import { createSystemUiBridge } from '../src/native/systemUi';

describe('immersive playback — navigation bar bridge', () => {
  it('forwards hide/show to the native module', async () => {
    const native = {
      hideNavigation: jest.fn(async () => true),
      showNavigation: jest.fn(async () => true),
      setScreenBrightness: jest.fn(async () => true),
      restoreScreenBrightness: jest.fn(async () => true),
    };
    const bridge = createSystemUiBridge(native);

    await bridge.hideNavigation();
    await bridge.showNavigation();
    await bridge.setScreenBrightness(0.15);
    await bridge.restoreScreenBrightness();

    expect(native.hideNavigation).toHaveBeenCalledTimes(1);
    expect(native.showNavigation).toHaveBeenCalledTimes(1);
    expect(native.setScreenBrightness).toHaveBeenCalledWith(0.15);
    expect(native.restoreScreenBrightness).toHaveBeenCalledTimes(1);
  });

  it('is a safe no-op without the native module (tests/other platforms)', async () => {
    const bridge = createSystemUiBridge(undefined);
    await expect(bridge.hideNavigation()).resolves.toBeUndefined();
    await expect(bridge.showNavigation()).resolves.toBeUndefined();
    await expect(bridge.setScreenBrightness(0.15)).resolves.toBeUndefined();
    await expect(bridge.restoreScreenBrightness()).resolves.toBeUndefined();
  });

  it('swallows native failures so playback and leaving the player never break', async () => {
    const bridge = createSystemUiBridge({
      hideNavigation: async () => {
        throw new Error('boom');
      },
      showNavigation: async () => {
        throw new Error('boom');
      },
      setScreenBrightness: async () => {
        throw new Error('boom');
      },
      restoreScreenBrightness: async () => {
        throw new Error('boom');
      },
    });
    await expect(bridge.hideNavigation()).resolves.toBeUndefined();
    await expect(bridge.showNavigation()).resolves.toBeUndefined();
    await expect(bridge.setScreenBrightness(0.15)).resolves.toBeUndefined();
    await expect(bridge.restoreScreenBrightness()).resolves.toBeUndefined();
    await expect(bridge.setScreenBrightness(0.15)).resolves.toBeUndefined();
    await expect(bridge.restoreScreenBrightness()).resolves.toBeUndefined();
  });
});
