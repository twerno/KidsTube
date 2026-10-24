/**
 * Runtime store for the session log (ADR 0016).
 *
 * Keeps the ring buffer outside React so that any module (services included)
 * can record an event; the panel's Log screen subscribes and re-reads it.
 * Everything stays in memory: no persistence, no PII, no secrets.
 */

import { appendLog, type LogEntry, type LogLevel } from '../domain/log';

let entries: LogEntry[] = [];
const listeners = new Set<(entries: LogEntry[]) => void>();

export function recordLog(
  level: LogLevel,
  tag: string,
  message: string,
  now: number = Date.now(),
): void {
  entries = appendLog(entries, { level, tag, message, at: now });
  for (const listener of listeners) {
    listener(entries);
  }
  const line = `[KidTube:${tag}] ${message}`;
  if (level === 'error') {
    console.warn(line);
  } else {
    console.log(line);
  }
}

export function getLogEntries(): LogEntry[] {
  return entries;
}

export function subscribeLog(listener: (entries: LogEntry[]) => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** Tests only: drop the buffer and keep the listeners. */
export function clearLog(): void {
  entries = [];
  for (const listener of listeners) {
    listener(entries);
  }
}
