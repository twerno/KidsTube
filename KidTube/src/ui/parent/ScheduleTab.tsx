import React from 'react';
import { ScrollView, StyleSheet, Text } from 'react-native';
import { Button, Card } from '../components';
import { ScheduleEditor } from '../ScheduleEditor';
import { colors, spacing } from '../theme';
import { normalizeSchedule, remainingSecondsToday } from '../../domain/schedule';
import type { Schedule } from '../../domain/types';

function formatMinutes(seconds: number): number {
  return Math.floor(seconds / 60);
}

export function ScheduleTab({
  schedule,
  usedSecondsToday,
  onResetUsage,
  onScheduleChange,
}: {
  schedule?: Schedule;
  usedSecondsToday: number;
  onResetUsage: () => void;
  onScheduleChange: (schedule: Schedule) => void;
}) {
  const normalized = normalizeSchedule(schedule);
  const remaining = remainingSecondsToday(normalized, usedSecondsToday);
  const limit = normalized.dailyLimitMinutes ?? 0;

  return (
    <ScrollView contentContainerStyle={styles.content}>
      <Text style={styles.hint}>
        Jedno okno oglądania (od–do, każdego dnia) i dzienny limit wideo. Tryb audio działa
        zawsze — np. do audiobooków na dobranoc — i nie zużywa limitu.
      </Text>

      <Card style={styles.usage}>
        <Text style={styles.usageTitle}>Wykorzystanie dzisiaj</Text>
        <Text style={styles.usageValue}>{formatMinutes(usedSecondsToday)} min</Text>
        <Text style={styles.usageHint}>
          {remaining === undefined
            ? 'Limit wyłączony (bez ograniczenia).'
            : `Limit: ${limit} min · Pozostało: ${formatMinutes(remaining)} min`}
        </Text>
        <Button
          title="Wyzeruj dzisiejszy licznik"
          variant="secondary"
          onPress={onResetUsage}
        />
      </Card>

      <ScheduleEditor schedule={schedule} onSave={onScheduleChange} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: spacing.lg, paddingBottom: spacing.xl * 2 },
  hint: { color: colors.textMuted, fontSize: 14, lineHeight: 20, marginBottom: spacing.md },
  usage: { marginBottom: spacing.md },
  usageTitle: { color: colors.textMuted, fontSize: 13, fontWeight: '700', marginBottom: spacing.xs },
  usageValue: { color: colors.text, fontSize: 28, fontWeight: '800' },
  usageHint: { color: colors.textMuted, fontSize: 13, marginTop: spacing.xs, marginBottom: spacing.md },
});
