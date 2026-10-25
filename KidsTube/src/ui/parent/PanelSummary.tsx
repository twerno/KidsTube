import React, { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Card } from '../components';
import { colors, spacing } from '../theme';
import { formatCompactDuration } from '../../domain/duration';
import { remainingSecondsToday, normalizeSchedule } from '../../domain/schedule';
import { averageStats, todayStats } from '../../domain/watchStats';
import type { ExtraTimePool, Schedule, WatchHistoryEntry } from '../../domain/types';

function Row({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <View style={styles.row}>
      <Text style={styles.label}>{label}</Text>
      <Text style={styles.value}>{value}</Text>
      {hint ? <Text style={styles.hint}>{hint}</Text> : null}
    </View>
  );
}

/**
 * Index summary (ADR 0016): remaining video time, today's split and the
 * seven-day daily average. Everything is derived from existing state.
 */
export function PanelSummary({
  schedule,
  usedSecondsToday,
  extraTime,
  entries,
}: {
  schedule?: Schedule;
  usedSecondsToday: number;
  extraTime?: ExtraTimePool;
  entries: WatchHistoryEntry[];
}) {
  const remaining = useMemo(
    () => remainingSecondsToday(normalizeSchedule(schedule), usedSecondsToday, extraTime),
    [schedule, usedSecondsToday, extraTime],
  );
  const today = useMemo(() => todayStats(entries), [entries]);
  const average = useMemo(() => averageStats(entries), [entries]);

  return (
    <Card style={styles.statCard}>
      <Row
        label="Pozostało wideo dziś"
        value={remaining === undefined ? 'Bez limitu' : formatCompactDuration(remaining)}
      />
      <Row
        label="Dziś"
        value={`Filmy: ${formatCompactDuration(today.videoSeconds)} (${today.videoCount}) · Audio: ${formatCompactDuration(
          today.audioSeconds,
        )} (${today.audioCount})`}
      />
      <Row
        label="7 dni"
        value={`Filmy: ${formatCompactDuration(
          Math.round(average.videoSeconds),
        )} (${Math.round(average.videoCount)}) · Audio: ${formatCompactDuration(
          Math.round(average.audioSeconds),
        )} (${Math.round(average.audioCount)})`}
        hint="średnio na dzień"
      />
      <Text style={styles.legend}>
        W nawiasie: liczba materiałów odtworzonych w tym trybie; w wierszu 7 dni — średnia na dzień.
      </Text>
    </Card>
  );
}

const styles = StyleSheet.create({
  // A saturated primary surface: the summary must read as a different kind of
  // block than the section rows under it.
  statCard: {
    gap: spacing.sm,
    backgroundColor: colors.primaryDark,
    borderColor: colors.primary,
    borderWidth: 1,
  },
  row: { gap: 2 },
  label: { color: 'rgba(255,255,255,0.78)', fontSize: 12, fontWeight: '700' },
  value: { color: '#ffffff', fontSize: 15, fontWeight: '700' },
  hint: { color: 'rgba(255,255,255,0.72)', fontSize: 11 },
  legend: {
    color: 'rgba(255,255,255,0.72)',
    fontSize: 11,
    marginTop: spacing.xs,
    lineHeight: 16,
  },
});
