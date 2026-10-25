/** Compact duration labels shared by badges and the viewing history. */

/** `0` -> `0m`, `42` -> `<1m`, `90` -> `1m`, `6_000` -> `1h:40m`. */
export function formatCompactDuration(seconds: number): string {
  const total = Math.max(0, Math.floor(seconds));
  if (total < 60) {
    return total <= 0 ? '0m' : '<1m';
  }
  const minutes = Math.floor(total / 60);
  if (minutes < 60) {
    return `${minutes}m`;
  }
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return `${hours}h:${String(rest).padStart(2, '0')}m`;
}

/** `1m / 1h:40m`; without a cached total only the first value is shown. */
export function formatDurationRatio(seconds: number, totalSeconds?: number): string {
  const current = formatCompactDuration(seconds);
  return totalSeconds && totalSeconds > 0
    ? `${current} / ${formatCompactDuration(totalSeconds)}`
    : current;
}
