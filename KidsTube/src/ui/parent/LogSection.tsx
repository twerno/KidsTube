import React, { useEffect, useState } from 'react';
import { FlatList, StyleSheet, Text, View } from 'react-native';
import { EmptyState } from './EmptyState';
import { colors, spacing } from '../theme';
import { getLogEntries, subscribeLog } from '../../services/logStore';
import type { LogEntry } from '../../domain/log';

function clockTime(at: number): string {
  const date = new Date(at);
  const pad = (value: number) => String(value).padStart(2, '0');
  return `${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
}

const LEVEL_COLOR = {
  info: colors.textMuted,
  warn: colors.warning,
  error: colors.danger,
} as const;

/** “Log”: session-only ring buffer, read-only (ADR 0016). */
export function LogSection() {
  const [entries, setEntries] = useState<LogEntry[]>(getLogEntries);

  useEffect(() => subscribeLog(setEntries), []);

  // Newest first, without mutating the store.
  const data = [...entries].reverse();

  return (
    <FlatList
      data={data}
      keyExtractor={(item, index) => `${item.at}:${item.tag}:${index}`}
      contentContainerStyle={data.length === 0 ? styles.emptyContent : styles.content}
      removeClippedSubviews={false}
      ListEmptyComponent={<EmptyState>Brak zdarzeń w tej sesji.</EmptyState>}
      renderItem={({ item }: { item: LogEntry }) => (
        <View style={styles.row}>
          <Text style={styles.time}>{clockTime(item.at)}</Text>
          <View style={styles.body}>
            <Text style={[styles.tag, { color: LEVEL_COLOR[item.level] }]}>{item.tag}</Text>
            <Text style={styles.message}>{item.message}</Text>
          </View>
        </View>
      )}
    />
  );
}

const styles = StyleSheet.create({
  content: { padding: spacing.lg, paddingBottom: spacing.xl * 2 },
  emptyContent: { flexGrow: 1, justifyContent: 'center' },
  row: {
    flexDirection: 'row',
    gap: spacing.md,
    paddingVertical: spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  time: { color: colors.textMuted, fontSize: 12, fontVariant: ['tabular-nums'] },
  body: { flex: 1, gap: 2 },
  tag: { fontSize: 11, fontWeight: '800', textTransform: 'uppercase' },
  message: { color: colors.text, fontSize: 13, lineHeight: 18 },
});
