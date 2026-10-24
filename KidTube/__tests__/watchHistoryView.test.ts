import { formatHistoryDay } from '../src/domain/watchHistoryView';

describe('watch history day headings (ADR 0004a)', () => {
  it('uses Dziś / Wczoraj and Polish dates for older days', () => {
    const now = new Date(2026, 9, 23, 12, 0, 0).getTime();
    expect(formatHistoryDay('2026-10-23', now)).toBe('Dziś');
    expect(formatHistoryDay('2026-10-22', now)).toBe('Wczoraj');
    expect(formatHistoryDay('2026-10-20', now)).toBe('20 października 2026');
    expect(formatHistoryDay('not-a-day', now)).toBe('not-a-day');
  });
});
