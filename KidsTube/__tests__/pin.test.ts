import { hashPin, verifyPin } from '../src/security/pin';

describe('PIN hashing', () => {
  it('verifies the correct pin and rejects wrong ones', async () => {
    const record = await hashPin('0421', 1000);
    expect(await verifyPin('0421', record)).toBe(true);
    expect(await verifyPin('0422', record)).toBe(false);
    expect(await verifyPin('', record)).toBe(false);
  });

  it('uses a random salt so equal pins hash differently', async () => {
    const a = await hashPin('0421', 1000);
    const b = await hashPin('0421', 1000);
    expect(a.salt).not.toBe(b.salt);
    expect(a.hash).not.toBe(b.hash);
    expect(await verifyPin('0421', a)).toBe(true);
    expect(await verifyPin('0421', b)).toBe(true);
  });
});
