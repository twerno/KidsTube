import { LOG_LIMIT, appendLog, type LogEntry } from '../src/domain/log';
import { clearLog, getLogEntries, recordLog, subscribeLog } from '../src/services/logStore';

const entry = (index: number): LogEntry => ({
  at: index,
  level: 'info',
  tag: 'test',
  message: `entry ${String(index)}`,
});

describe('session log (ADR 0016)', () => {
  it('keeps the newest entries and drops the oldest', () => {
    let entries: LogEntry[] = [];
    for (let index = 0; index <= LOG_LIMIT; index += 1) {
      entries = appendLog(entries, entry(index));
    }
    expect(entries).toHaveLength(LOG_LIMIT);
    expect(entries[0].at).toBe(1);
    expect(entries[entries.length - 1].at).toBe(LOG_LIMIT);
  });

  it('respects a custom limit', () => {
    const entries = appendLog(appendLog([], entry(1)), entry(2), 1);
    expect(entries.map(item => item.at)).toEqual([2]);
  });

  it('keeps the store session-only and notifies subscribers', () => {
    clearLog();
    const seen: LogEntry[][] = [];
    const unsubscribe = subscribeLog(list => seen.push(list));

    recordLog('info', 'add', 'dodano film', 1000);
    recordLog('error', 'sync', 'HTTP 404', 2000);

    expect(getLogEntries().map(item => item.tag)).toEqual(['add', 'sync']);
    expect(seen[seen.length - 1]).toHaveLength(2);

    unsubscribe();
    recordLog('info', 'add', 'po odpięciu', 3000);
    expect(seen[seen.length - 1]).toHaveLength(2);

    clearLog();
    expect(getLogEntries()).toEqual([]);
  });
});
