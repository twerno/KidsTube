import { formatPublishedDate } from '../src/domain/dates';

describe('formatPublishedDate', () => {
  it('formats a timestamp with a Polish month abbreviation', () => {
    // Local noon avoids any timezone shifting the calendar day.
    expect(formatPublishedDate(new Date(2026, 9, 22, 12).getTime())).toBe('22 paź 2026');
    expect(formatPublishedDate(new Date(2024, 0, 1, 12).getTime())).toBe('1 sty 2024');
  });

  it('returns an empty string for missing or invalid dates', () => {
    expect(formatPublishedDate(undefined)).toBe('');
    expect(formatPublishedDate(0)).toBe('');
    expect(formatPublishedDate(-5)).toBe('');
    expect(formatPublishedDate(Number.NaN)).toBe('');
  });
});