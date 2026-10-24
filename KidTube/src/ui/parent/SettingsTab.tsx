import React, { useState } from 'react';
import { ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { Button, Card, Field } from '../components';
import { colors, spacing } from '../theme';

export function SettingsTab({
  childName,
  refreshing,
  onChildName,
  onChangePin,
  onSync,
  youtubeLinkHandlerEnabled,
  onYouTubeLinkHandlerChange,
  onOpenLinkHandlingSettings,
}: {
  childName?: string;
  refreshing?: boolean;
  onChildName: (name: string) => void;
  onChangePin: () => void;
  onSync: () => void;
  /** ADR 0014: optional system handler for YouTube VIEW links. */
  youtubeLinkHandlerEnabled?: boolean;
  onYouTubeLinkHandlerChange: (enabled: boolean) => void;
  onOpenLinkHandlingSettings: () => void;
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

      <Card style={styles.card}>
        <Text style={styles.sectionTitle}>Linki YouTube</Text>
        <View style={styles.switchRow}>
          <Text style={styles.switchLabel}>Otwieraj linki YouTube w KidTube</Text>
          <Switch
            value={!!youtubeLinkHandlerEnabled}
            onValueChange={onYouTubeLinkHandlerChange}
          />
        </View>
        <Text style={styles.hint}>
          Po włączeniu KidTube zgłosi się jako aplikacja do otwierania linków YouTube;
          wybór domyślnej aplikacji nadal robisz w ustawieniach systemowych.
          Aby przypisać KidTube należy wyłączyć systemowa aplikację YouTube!
        </Text>
        <Button
          title="Ustawienia otwierania linków"
          variant="secondary"
          onPress={onOpenLinkHandlingSettings}
        />
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
  sectionTitle: { color: colors.text, fontSize: 16, fontWeight: '800' },
  switchRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.md },
  switchLabel: { color: colors.text, flex: 1, fontSize: 14 },
  hint: { color: colors.textMuted, fontSize: 13, lineHeight: 19 },
});
