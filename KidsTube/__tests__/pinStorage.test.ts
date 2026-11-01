import { createPinStorageBridge } from '../src/native/pinStorage';

const record = { hash: 'abc123', salt: 'def456', iterations: 210_000 };

describe('secure PIN record storage bridge (ADR 0022)', () => {
  it('stores the JSON record through the native module and reads it back', async () => {
    let stored: string | null = null;
    const native = {
      save: jest.fn(async (json: string) => {
        stored = json;
        return true;
      }),
      load: jest.fn(async () => stored),
      clear: jest.fn(async () => {
        stored = null;
        return true;
      }),
    };
    const bridge = createPinStorageBridge(native);

    await expect(bridge.save(record)).resolves.toBe(true);
    expect(JSON.parse(stored ?? '{}')).toEqual(record);
    await expect(bridge.load()).resolves.toEqual(record);
    await expect(bridge.clear()).resolves.toBe(true);
    await expect(bridge.load()).resolves.toBeUndefined();

    expect(native.save).toHaveBeenCalledTimes(1);
    expect(native.load).toHaveBeenCalledTimes(2);
    expect(native.clear).toHaveBeenCalledTimes(1);
  });

  it('rejects malformed records instead of returning partial data', async () => {
    const bridge = createPinStorageBridge({
      save: async () => true,
      load: async () => '{"hash":"abc"}',
      clear: async () => true,
    });
    await expect(bridge.load()).resolves.toBeUndefined();

    const invalidIterations = createPinStorageBridge({
      save: async () => true,
      load: async () => JSON.stringify({ ...record, iterations: 0 }),
      clear: async () => true,
    });
    await expect(invalidIterations.load()).resolves.toBeUndefined();
  });

  it('is a safe no-op when the native module is unavailable', async () => {
    const bridge = createPinStorageBridge(undefined);
    await expect(bridge.save(record)).resolves.toBe(false);
    await expect(bridge.load()).resolves.toBeUndefined();
    await expect(bridge.clear()).resolves.toBe(false);
  });

  it('swallows native failures so PIN entry never crashes', async () => {
    const bridge = createPinStorageBridge({
      save: async () => {
        throw new Error('keystore');
      },
      load: async () => {
        throw new Error('keystore');
      },
      clear: async () => {
        throw new Error('keystore');
      },
    });
    await expect(bridge.save(record)).resolves.toBe(false);
    await expect(bridge.load()).resolves.toBeUndefined();
    await expect(bridge.clear()).resolves.toBe(false);
  });
});
