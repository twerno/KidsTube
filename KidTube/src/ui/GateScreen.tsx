import React, { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Button, Card, Field } from './components';
import { colors, spacing } from './theme';

export interface GateScreenProps {
  mode: 'setup' | 'unlock';
  title: string;
  subtitle?: string;
  onSubmit: (pin: string) => Promise<boolean> | boolean;
  onCancel?: () => void;
}

const MIN_PIN_LENGTH = 4;

export function GateScreen({ mode, title, subtitle, onSubmit, onCancel }: GateScreenProps) {
  const [pin, setPin] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | undefined>();
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    setError(undefined);
    if (pin.length < MIN_PIN_LENGTH) {
      setError(`Kod musi mieć co najmniej ${MIN_PIN_LENGTH} cyfry.`);
      return;
    }
    if (mode === 'setup' && pin !== confirm) {
      setError('Kody nie są identyczne.');
      return;
    }
    setBusy(true);
    const ok = await onSubmit(pin);
    setBusy(false);
    if (!ok) {
      setError('Nieprawidłowy kod.');
      setPin('');
      setConfirm('');
    }
  };

  return (
    <View style={styles.container}>
      <Card>
        <Text style={styles.title}>{title}</Text>
        {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}

        <Field
          label="Kod rodzica"
          value={pin}
          onChangeText={setPin}
          keyboardType="number-pad"
          secureTextEntry
          maxLength={12}
          autoFocus
          placeholder="••••"
        />
        {mode === 'setup' ? (
          <Field
            label="Powtórz kod"
            value={confirm}
            onChangeText={setConfirm}
            keyboardType="number-pad"
            secureTextEntry
            maxLength={12}
            placeholder="••••"
          />
        ) : null}

        {error ? <Text style={styles.error}>{error}</Text> : null}

        <View style={styles.actions}>
          {onCancel ? <Button title="Anuluj" variant="secondary" onPress={onCancel} /> : null}
          <Button
            title={mode === 'setup' ? 'Ustaw kod' : 'Odblokuj'}
            onPress={submit}
            loading={busy}
          />
        </View>
      </Card>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', padding: spacing.lg, gap: spacing.lg },
  title: { color: colors.text, fontSize: 22, fontWeight: '700' },
  subtitle: { color: colors.textMuted, fontSize: 14, marginTop: spacing.xs, marginBottom: spacing.md },
  error: { color: colors.danger, marginTop: spacing.sm },
  actions: { flexDirection: 'row', justifyContent: 'flex-end', gap: spacing.sm, marginTop: spacing.lg },
});
