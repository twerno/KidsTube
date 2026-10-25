import React, { useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { Button, Card } from '../components';
import { PinPrompt } from '../PinPrompt';
import { colors, radius, spacing } from '../theme';
import type { BackupFile } from '../../domain/backup';
import { backupCounts, type ExportOutcome, type PickOutcome, type RestoreOutcome } from '../../services/databaseBackup';
import { filmsLabel, channelsLabel } from '../../domain/plural';

/** `2026-10-24T12:34:56.000Z` → local `2026-10-24 14:34`. */
function formatStamp(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    return iso;
  }
  const pad = (value: number) => String(value).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(
    date.getHours(),
  )}:${pad(date.getMinutes())}`;
}

type PinAction = 'export' | 'restore';

export interface DatabaseSectionProps {
  onExport: () => Promise<ExportOutcome>;
  onPick: () => Promise<PickOutcome>;
  onRestore: (file: BackupFile) => Promise<RestoreOutcome>;
  onVerifyPin: (pin: string) => Promise<boolean>;
  lockedUntil?: number;
}

/**
 * “Baza danych” (ADR 0017): export the whole local database to a JSON file and
 * restore it. The import replaces everything — it never merges — and can change
 * the parent PIN, so both actions sit behind the shared PIN gate.
 */
export function DatabaseSection({
  onExport,
  onPick,
  onRestore,
  onVerifyPin,
  lockedUntil,
}: DatabaseSectionProps) {
  const [busy, setBusy] = useState(false);
  const [pinAction, setPinAction] = useState<PinAction | undefined>();
  const [picked, setPicked] = useState<{ file: BackupFile; name?: string } | undefined>();
  const [message, setMessage] = useState<{ tone: 'ok' | 'error'; text: string } | undefined>();

  const startExport = () => {
    setMessage(undefined);
    setPinAction('export');
  };

  const submitExport = async (pin: string): Promise<boolean> => {
    const valid = await onVerifyPin(pin);
    if (!valid) {
      return false;
    }
    setPinAction(undefined);
    setBusy(true);
    const outcome = await onExport();
    setBusy(false);
    if (outcome.status === 'saved') {
      setMessage({ tone: 'ok', text: 'Kopia zapisana.' });
    } else if (outcome.status === 'error') {
      setMessage({ tone: 'error', text: outcome.message });
    }
    return true;
  };

  const startImport = async () => {
    setMessage(undefined);
    setBusy(true);
    const outcome = await onPick();
    setBusy(false);
    if (outcome.status === 'picked') {
      setPicked({ file: outcome.file, name: outcome.name });
    } else if (outcome.status === 'error') {
      setMessage({ tone: 'error', text: outcome.message });
    }
  };

  const submitRestore = async (pin: string): Promise<boolean> => {
    const valid = await onVerifyPin(pin);
    if (!valid) {
      return false;
    }
    setPinAction(undefined);
    if (!picked) {
      return true;
    }
    setBusy(true);
    const outcome = await onRestore(picked.file);
    setBusy(false);
    if (!outcome.ok) {
      setMessage({ tone: 'error', text: outcome.message });
    }
    return true;
  };

  const pinPrompt =
    pinAction === 'export'
      ? {
          title: 'Eksport bazy',
          subtitle: 'Plik zawiera dane wrażliwe. Potwierdź kodem rodzica.',
          onSubmit: submitExport,
        }
      : pinAction === 'restore'
        ? {
            title: 'Import bazy',
            subtitle: 'Zastąpisz całą bazę. Potwierdź kodem rodzica.',
            onSubmit: submitRestore,
          }
        : undefined;

  const counts = picked ? backupCounts(picked.file.data) : undefined;

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        <Card style={styles.card}>
          <Text style={styles.sectionTitle}>Kopia zapasowa</Text>
          <Text style={styles.hint}>
            Cała baza w jednym pliku JSON: biblioteka, kanały, decyzje, historia i ustawienia.
            Kod rodzica nie jest częścią kopii — zostaje na tym urządzeniu. Plik nie jest
            szyfrowany — traktuj go jak dane wrażliwe.
          </Text>
          <Button title="Eksportuj bazę do JSON" onPress={startExport} loading={busy} />
          <Button
            title="Importuj bazę z JSON"
            variant="secondary"
            onPress={startImport}
            loading={busy}
          />
        </Card>

        {message ? (
          <Card style={styles.card}>
            <Text style={message.tone === 'ok' ? styles.ok : styles.error}>{message.text}</Text>
          </Card>
        ) : null}

        {picked && counts ? (
          <Card style={styles.card}>
            <Text style={styles.sectionTitle}>Podsumowanie pliku</Text>
            <Text style={styles.details}>
              {picked.name ?? 'kopia.json'} · {formatStamp(picked.file.exportedAt)} · wersja{' '}
              {picked.file.appVersion}
            </Text>
            <Text style={styles.details}>
              {filmsLabel(counts.films)} · {channelsLabel(counts.channels)} · {counts.decisions}{' '}
              decyzji · {counts.history} wpisów historii
            </Text>
            <View style={styles.warningBox}>
              <Text style={styles.warning}>
                Import zastąpi całą obecną bazę. Ustawienia i liczniki czasu pochodzą z pliku.
              </Text>
              <Text style={styles.warning}>
                Kod rodzica nie jest częścią kopii: po imporcie pozostanie obecny kod. Na
                urządzeniu bez kodu ustawisz nowy po imporcie.
              </Text>
              <Text style={styles.warning}>
                Warto najpierw wyeksportować obecną bazę, żeby mieć drogę powrotu.
              </Text>
            </View>
            <Button
              title="Importuj i zastąp bazę"
              variant="danger"
              onPress={() => setPinAction('restore')}
              loading={busy}
            />
            <Button
              title="Anuluj"
              variant="secondary"
              onPress={() => setPicked(undefined)}
              disabled={busy}
            />
          </Card>
        ) : null}
      </ScrollView>

      <PinPrompt
        visible={!!pinPrompt}
        title={pinPrompt?.title ?? ''}
        subtitle={pinPrompt?.subtitle}
        lockedUntil={lockedUntil}
        onSubmit={pinPrompt?.onSubmit ?? (async () => false)}
        onCancel={() => setPinAction(undefined)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: spacing.lg, paddingBottom: spacing.xl * 2, gap: spacing.md },
  card: { gap: spacing.md },
  sectionTitle: { color: colors.text, fontSize: 16, fontWeight: '800' },
  hint: { color: colors.textMuted, fontSize: 13, lineHeight: 19 },
  details: { color: colors.textMuted, fontSize: 13, lineHeight: 19 },
  warningBox: {
    gap: spacing.xs,
    backgroundColor: 'rgba(255,159,10,0.12)',
    borderColor: 'rgba(255,159,10,0.45)',
    borderWidth: 1,
    borderRadius: radius.md,
    padding: spacing.md,
  },
  warning: { color: colors.warning, fontSize: 13, lineHeight: 19 },
  ok: { color: colors.success, fontSize: 14, fontWeight: '700' },
  error: { color: colors.danger, fontSize: 14, lineHeight: 20 },
});
