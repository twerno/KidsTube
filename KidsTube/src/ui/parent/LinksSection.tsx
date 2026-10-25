import React from 'react';
import { ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { Button, Card } from '../components';
import { colors, spacing } from '../theme';

/** “Powiąż z linkami YouTube” (ADR 0014 / ADR 0016). */
export function LinksSection({
  youtubeLinkHandlerEnabled,
  onYouTubeLinkHandlerChange,
  onOpenLinkHandlingSettings,
}: {
  youtubeLinkHandlerEnabled: boolean;
  onYouTubeLinkHandlerChange: (enabled: boolean) => void;
  onOpenLinkHandlingSettings: () => void;
}) {
  return (
    <ScrollView contentContainerStyle={styles.content}>
      <Card style={styles.card}>
        <Text style={styles.sectionTitle}>Linki YouTube</Text>
        <View style={styles.switchRow}>
          <Text style={styles.switchLabel}>Otwieraj linki YouTube w KidsTube</Text>
          <Switch value={youtubeLinkHandlerEnabled} onValueChange={onYouTubeLinkHandlerChange} />
        </View>
        <Text style={styles.hint}>
          Po włączeniu KidsTube zgłosi się jako aplikacja do otwierania linków YouTube; wybór
          domyślnej aplikacji nadal robisz w ustawieniach systemowych. Aby przypisać KidsTube,
          wyłącz systemową aplikację YouTube.
        </Text>
        <Button
          title="Ustawienia otwierania linków"
          variant="secondary"
          onPress={onOpenLinkHandlingSettings}
        />
      </Card>

      <Text style={styles.hint}>
        Udostępnianie linków działa zawsze, niezależnie od tej opcji. Kod rodzica chroni tylko
        panel — lista filmów dziecka jest dostępna bez kodu.
      </Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: spacing.lg, paddingBottom: spacing.xl * 2, gap: spacing.md },
  card: { gap: spacing.md },
  sectionTitle: { color: colors.text, fontSize: 16, fontWeight: '800' },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  switchLabel: { color: colors.text, flex: 1, fontSize: 14 },
  hint: { color: colors.textMuted, fontSize: 13, lineHeight: 19 },
});
