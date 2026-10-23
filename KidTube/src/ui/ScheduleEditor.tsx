import React, { useState } from 'react';
import { StyleSheet, Switch, Text, View } from 'react-native';
import { Button, Card, Field } from './components';
import { colors, spacing } from './theme';
import type { Schedule } from '../domain/types';
import { formatHHMM, normalizeSchedule, parseHHMM } from '../domain/schedule';

export interface ScheduleEditorProps {
  schedule?: Schedule;
  onSave: (schedule: Schedule) => void;
}

export function ScheduleEditor({ schedule, onSave }: ScheduleEditorProps) {
  const normalized = normalizeSchedule(schedule);
  const primary = normalized.window;

  const [enabled, setEnabled] = useState(normalized.enabled);
  const [from, setFrom] = useState(primary ? formatHHMM(primary.startMinute) : '07:00');
  const [to, setTo] = useState(primary ? formatHHMM(primary.endMinute) : '20:00');
  const [limit, setLimit] = useState(
    normalized.dailyLimitMinutes ? String(normalized.dailyLimitMinutes) : '',
  );
  const [error, setError] = useState<string | undefined>();

  const save = () => {
    const start = parseHHMM(from);
    const end = parseHHMM(to);
    if (enabled && (start == null || end == null)) {
      setError('Godziny muszą być w formacie HH:MM, np. 07:00.');
      return;
    }
    if (enabled && start === end) {
      setError('Godzina „od" i „do" nie mogą być jednakowe.');
      return;
    }
    const limitNumber = limit.trim() ? Number(limit) : 0;
    if (limit.trim() && (!Number.isFinite(limitNumber) || limitNumber < 0)) {
      setError('Limit dzienny to liczba minut (0 = bez limitu).');
      return;
    }
    setError(undefined);
    onSave({
      enabled,
      window:
        enabled && start != null && end != null ? { startMinute: start, endMinute: end } : undefined,
      dailyLimitMinutes: limitNumber,
    });
  };

  return (
    <Card style={styles.card}>
      <View style={styles.row}>
        <Text style={styles.label}>Harmonogram włączony</Text>
        <Switch value={enabled} onValueChange={setEnabled} />
      </View>

      <View style={styles.twoColumns}>
        <View style={styles.column}>
          <Field label="Oglądanie od" value={from} onChangeText={setFrom} placeholder="07:00" />
        </View>
        <View style={styles.column}>
          <Field label="do" value={to} onChangeText={setTo} placeholder="20:00" />
        </View>
      </View>

      <Field
        label="Limit dzienny (minuty, puste = bez limitu)"
        value={limit}
        onChangeText={setLimit}
        keyboardType="number-pad"
        placeholder="np. 60"
      />

      <Text style={styles.hint}>
        Harmonogram dotyczy tylko oglądania wideo. Tryb audio działa zawsze — wystarczy wybrać
        „Tylko dźwięk".
      </Text>

      {error ? <Text style={styles.error}>{error}</Text> : null}
      <Button title="Zapisz harmonogram" variant="secondary" onPress={save} />
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { gap: spacing.md },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  label: { color: colors.text, fontSize: 15, flex: 1 },
  twoColumns: { flexDirection: 'row', gap: spacing.md },
  column: { flex: 1 },
  hint: { color: colors.textMuted, fontSize: 13, lineHeight: 19 },
  error: { color: colors.danger, fontSize: 14 },
});