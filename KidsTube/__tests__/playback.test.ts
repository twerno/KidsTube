import { relativeSeek } from '../src/domain/playback';

describe('relativeSeek', () => {
  it('jumps backwards and forwards', () => {
    expect(relativeSeek(1000, -30, 3600)).toBe(970);
    expect(relativeSeek(1000, 30, 3600)).toBe(1030);
    expect(relativeSeek(1000, -5 * 60, 3600)).toBe(700);
    expect(relativeSeek(1000, 5 * 60, 3600)).toBe(1300);
  });

  it('never goes below zero', () => {
    expect(relativeSeek(10, -30, 3600)).toBe(0);
  });

  it('never goes past the end', () => {
    expect(relativeSeek(3590, 30, 3600)).toBe(3600);
  });

  it('clamps only the lower bound when the duration is unknown', () => {
    expect(relativeSeek(10, -30, 0)).toBe(0);
    expect(relativeSeek(1000, 30, 0)).toBe(1030);
  });
});