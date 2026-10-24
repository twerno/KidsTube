/**
 * View helpers for the viewing history (ADR 0004a) — pure and testable.
 *
 * Day headings use Polish names and the familiar “Dziś / Wczoraj” shortcuts.
 * No `Intl`, so the output is identical on every device.
 */

import { dateKey } from './schedule';

const MONTHS_GENITIVE_PL = [
  'stycznia',
  'lutego',
  'marca',
  'kwietnia',
  'maja',
  'czerwca',
  'lipca',
  'sierpnia',
  'września',
  'października',
  'listopada',
  'grudnia',
];

interface DayParts {
  year: number;
  month: number;
  day: number;
}

function parseDayKey(value: string): DayParts | undefined {
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) {
    return undefined;
  }
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (month < 1 || month > 12 || day < 1 || day > 31) {
    return undefined;
  }
  return { year, month, day };
}

/** `2026-10-23` -> `Dziś` / `Wczoraj` / `23 października 2026`. */
export function formatHistoryDay(dayKey: string, now: number = Date.now()): string {
  const today = new Date(now);
  if (dayKey === dateKey(today)) {
    return 'Dziś';
  }
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  if (dayKey === dateKey(yesterday)) {
    return 'Wczoraj';
  }
  const parts = parseDayKey(dayKey);
  if (!parts) {
    return dayKey;
  }
  return `${parts.day} ${MONTHS_GENITIVE_PL[parts.month - 1]} ${parts.year}`;
}

