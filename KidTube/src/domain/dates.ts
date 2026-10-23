/**
 * Date formatting for the UI. Pure and free of `Intl`, so it behaves the same
 * on every device without relying on locale data being bundled.
 */

const MONTHS_PL = [
  'sty',
  'lut',
  'mar',
  'kwi',
  'maj',
  'cze',
  'lip',
  'sie',
  'wrz',
  'paź',
  'lis',
  'gru',
];

/** `1610000000000` -> `"22 paź 2026"`; empty string for a missing/invalid date. */
export function formatPublishedDate(timestamp?: number): string {
  if (timestamp == null || !Number.isFinite(timestamp) || timestamp <= 0) {
    return '';
  }
  const date = new Date(timestamp);
  return `${date.getDate()} ${MONTHS_PL[date.getMonth()]} ${date.getFullYear()}`;
}