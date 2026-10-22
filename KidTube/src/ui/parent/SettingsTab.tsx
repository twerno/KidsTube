import React, { useState } from 'react';
import { ScrollView, StyleSheet, Text } from 'react-native';
import { Button, Card, Field } from '../components';
import { colors, spacing } from '../theme';

export function SettingsTab({
  childName,
  refreshing,
  onChildName,
  onChangePin,
  onSync,
}: {
  childName?: string;
  refreshing?: boolean;
  onChildName: (name: string) => void;
  onChangePin: () => void;
  onSync: () => void;
}) {
  const [name, setName] = useState(childName ?? '');

  return (
    <ScrollView contentContainerStyle={styles.content}>
      <Card style={styles.card}>
        <Field
          label="Imię dziecka"
          value={name}
          onChangeText={setName}
          onEndEditing={() => onChildName(name.trim())}
          placeholder="np. Staś"
        />
        <Button
          title="Synchronizuj wszystkie kanały"
          variant="secondary"
          onPress={onSync}
          loading={refreshing}
        />
        <Button title="Zmień kod rodzica" variant="secondary" onPress={onChangePin} />
      </Card>

      <Text style={styles.hint}>
        Kod rodzica chroni tylko ten panel — lista filmów dziecka jest dostępna bez kodu.
      </Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: spacing.lg, paddingBottom: spacing.xl * 2, gap: spacing.md },
  card: { gap: spacing.md },
  hint: { color: colors.textMuted, fontSize: 13, lineHeight: 19 },
});
