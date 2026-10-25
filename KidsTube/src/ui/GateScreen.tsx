import React from 'react';
import { StyleSheet, View } from 'react-native';
import { PinGateCard } from './PinGateCard';
import { spacing } from './theme';

export interface GateScreenProps {
  mode: 'setup' | 'unlock';
  title: string;
  subtitle?: string;
  /** Unix ms lockout end (ADR 0012); only used in unlock mode. */
  lockedUntil?: number;
  onSubmit: (pin: string) => Promise<boolean> | boolean;
  onCancel?: () => void;
}

export function GateScreen({
  mode,
  title,
  subtitle,
  lockedUntil,
  onSubmit,
  onCancel,
}: GateScreenProps) {
  return (
    <View style={styles.container}>
      <PinGateCard
        mode={mode}
        title={title}
        subtitle={subtitle}
        lockedUntil={lockedUntil}
        onSubmit={onSubmit}
        onCancel={onCancel}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', padding: spacing.lg },
});
