import React from 'react';
import { ActivityIndicator, Modal, StyleSheet, Text, View } from 'react-native';
import { Button, Card } from '../components';
import { colors, spacing } from '../theme';
import { filmsLabel } from '../../domain/plural';
import type { CatalogRunState } from '../../services/youtubeCatalog';

/**
 * Blocking progress panel for a catalog import (ADR 0009). It stays until the
 * run ends; while it runs the only action is “Przerwij”, which keeps the
 * checkpoint for the next attempt.
 */
export function CatalogProgressModal({
  run,
  onCancel,
  onClose,
}: {
  run?: CatalogRunState;
  onCancel: () => void;
  onClose: () => void;
}) {
  if (!run) {
    return null;
  }
  const running = run.phase === 'running';
  const status =
    run.phase === 'done'
      ? 'Katalog wczytany.'
      : run.phase === 'cancelled'
        ? 'Pobieranie przerwane.'
        : 'Pobieranie zatrzymane.';

  return (
    <Modal visible transparent animationType="fade" onRequestClose={running ? onCancel : onClose}>
      <View style={styles.backdrop}>
        <Card style={styles.sheet}>
          <Text style={styles.title}>Katalog kanału</Text>
          <Text numberOfLines={2} style={styles.channel}>
            {run.channelTitle}
          </Text>

          {running ? (
            <>
              <Text style={styles.status}>Wczytywanie trwa…</Text>
              <ActivityIndicator color={colors.primary} />
            </>
          ) : (
            <Text style={styles.status}>{status}</Text>
          )}

          <Text style={styles.count}>{filmsLabel(run.imported)}</Text>

          {!running && run.message ? <Text style={styles.error}>{run.message}</Text> : null}

          {running ? (
            <Button title="Przerwij" variant="secondary" onPress={onCancel} />
          ) : (
            <Button title="Zamknij" onPress={onClose} />
          )}
        </Card>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.68)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  sheet: { width: '100%', maxWidth: 460, gap: spacing.md },
  title: { color: colors.text, fontSize: 20, fontWeight: '800' },
  channel: { color: colors.textMuted, fontSize: 14 },
  status: { color: colors.text, fontSize: 16, fontWeight: '700' },
  count: { color: colors.text, fontSize: 22, fontWeight: '800' },
  error: { color: colors.warning, fontSize: 13, lineHeight: 19 },
});
