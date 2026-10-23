import React from 'react';
import { ScrollView, StyleSheet, Text } from 'react-native';
import { ScheduleEditor } from '../ScheduleEditor';
import { colors, spacing } from '../theme';
import type { Schedule } from '../../domain/types';

export function ScheduleTab({
  schedule,
  onScheduleChange,
}: {
  schedule?: Schedule;
  onScheduleChange: (schedule: Schedule) => void;
}) {
  return (
    <ScrollView contentContainerStyle={styles.content}>
      <Text style={styles.hint}>
        Jedno okno oglądania (od–do, każdego dnia) i dzienny limit wideo. Tryb audio działa
        zawsze — np. do audiobooków na dobranoc — i nie zużywa limitu.
      </Text>
      <ScheduleEditor schedule={schedule} onSave={onScheduleChange} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: spacing.lg, paddingBottom: spacing.xl * 2 },
  hint: { color: colors.textMuted, fontSize: 14, lineHeight: 20, marginBottom: spacing.md },
});
