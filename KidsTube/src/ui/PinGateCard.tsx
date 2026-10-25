/**
 * Shared PIN entry card for the parent gate and the extra-time prompt
 * (ADR 0012). Lockout state comes from App; this card only renders the
 * countdown and disables input while the profile is locked.
 */

import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Button, Card, Field } from './components';
import { colors, spacing } from './theme';
import { formatLockCountdown } from '../domain/pinGuard';

const MIN_PIN_LENGTH = 4;

export interface PinGateCardProps {
  title: string;
  subtitle?: string;
  mode: 'setup' | 'unlock';
  /** Unix ms lockout end from ADR 0012; absent/past means attempts allowed. */
  lockedUntil?: number;
  onSubmit: (pin: string) => Promise<boolean> | boolean;
  onCancel?: () => void;
}

export function PinGateCard({
  title,
  subtitle,
  mode,
  lockedUntil,
  onSubmit,
  onCancel,
}: PinGateCardProps) {
  const [pin, setPin] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | undefined>();
  const [busy, setBusy] = useState(false);
  const [now, setNow] = useState(() => Date.now());

  const remainingMs = Math.max(0, (lockedUntil ?? 0) - now);
  const locked = remainingMs > 0;

  useEffect(() => {
    setNow(Date.now());
    if (!lockedUntil || lockedUntil <= Date.now()) {
      return undefined;
    }
    const timer = setInterval(() => {
      const current = Date.now();
      setNow(current);
      if (current >= lockedUntil) {
        clearInterval(timer);
      }
    }, 500);
    return () => clearInterval(timer);
  }, [lockedUntil]);

  // Do not leave a stale “wrong code” message under the lock countdown.
  useEffect(() => {
    if (remainingMs === 0) {
      setError(undefined);
    }
  }, [remainingMs]);

  const submit = async () => {
    if (locked || busy) {
      return;
    }
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
        autoFocus={!locked}
        editable={!locked && !busy}
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
          editable={!busy}
          placeholder="••••"
        />
      ) : null}

      {locked ? (
        <Text style={styles.locked}>
          Zbyt wiele prób. Spróbuj ponownie za {formatLockCountdown(remainingMs)}.
        </Text>
      ) : error ? (
        <Text style={styles.error}>{error}</Text>
      ) : null}

      <View style={styles.actions}>
        {onCancel ? <Button title="Anuluj" variant="secondary" onPress={onCancel} /> : null}
        <Button
          title={mode === 'setup' ? 'Ustaw kod' : 'Odblokuj'}
          onPress={submit}
          disabled={locked}
          loading={busy}
        />
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  title: { color: colors.text, fontSize: 22, fontWeight: '700' },
  subtitle: { color: colors.textMuted, fontSize: 14, marginTop: spacing.xs, marginBottom: spacing.md },
  error: { color: colors.danger, marginTop: spacing.sm },
  locked: { color: colors.warning, marginTop: spacing.sm, fontSize: 14, lineHeight: 20 },
  actions: { flexDirection: 'row', justifyContent: 'flex-end', gap: spacing.sm, marginTop: spacing.lg },
});
