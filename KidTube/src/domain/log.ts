/**
 * Session log for the parent panel's “Log” section (ADR 0016).
 *
 * A bounded, in-memory ring buffer: newest entries at the end, oldest dropped
 * first. Nothing is persisted, exported or sent anywhere — the app is
 * side-loaded (ADR 0007) and has no `logcat` access, so this is the only
 * diagnostics channel a parent can read.
 */

export type LogLevel = 'info' | 'warn' | 'error';

export interface LogEntry {
  /** Unix ms. */
  at: number;
  level: LogLevel;
  /** Short area tag, e.g. `add`, `sync`, `link`. */
  tag: string;
  message: string;
}

export const LOG_LIMIT = 100;

/** Append an entry, keeping at most `limit` newest ones. */
export function appendLog(
  entries: readonly LogEntry[],
  entry: LogEntry,
  limit: number = LOG_LIMIT,
): LogEntry[] {
  const next = [...entries, entry];
  return next.length > limit ? next.slice(next.length - limit) : next;
}
