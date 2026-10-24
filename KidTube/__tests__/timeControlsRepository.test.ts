import AsyncStorage from '@react-native-async-storage/async-storage';
import { AsyncStorageRepository } from '../src/data/asyncStorageRepository';
import { MemoryRepository } from '../src/data/memoryRepository';
import type { ExtraTimePool, PinGuardState } from '../src/domain/types';

const pool: ExtraTimePool = {
  dateKey: '2026-10-24',
  grantedSeconds: 15 * 60,
  remainingSeconds: 10 * 60,
};

const guard: PinGuardState = { failedAttempts: 3, lockedUntil: 123_456 };

describe.each([
  ['memory', () => new MemoryRepository()],
  ['async storage', () => new AsyncStorageRepository()],
])('extra time & PIN guard in %s repository (ADR 0011/0012)', (_name, make) => {
  beforeEach(async () => {
    await AsyncStorage.clear();
  });

  it('stores the extra-time pool', async () => {
    const repo = make();
    await repo.init();
    await repo.saveExtraTime(pool);
    expect(await repo.getExtraTime()).toEqual(pool);
  });

  it('stores the PIN guard state', async () => {
    const repo = make();
    await repo.init();
    await repo.savePinGuard(guard);
    expect(await repo.getPinGuard()).toEqual(guard);
  });
});

describe('PIN guard persistence (ADR 0012)', () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
  });

  it('survives an app restart with AsyncStorage', async () => {
    const repo = new AsyncStorageRepository();
    await repo.init();
    await repo.savePinGuard(guard);

    const restarted = new AsyncStorageRepository();
    await restarted.init();
    expect(await restarted.getPinGuard()).toEqual(guard);
  });
});
