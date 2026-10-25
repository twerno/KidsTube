import React from 'react';
import { Modal, Pressable, StyleSheet, View } from 'react-native';
import { PinGateCard } from './PinGateCard';

export interface PinPromptProps {
  visible: boolean;
  title: string;
  subtitle?: string;
  lockedUntil?: number;
  onSubmit: (pin: string) => Promise<boolean> | boolean;
  onCancel: () => void;
}

/** Modal PIN prompt for the extra-time action (ADR 0011/0012). */
export function PinPrompt({
  visible,
  title,
  subtitle,
  lockedUntil,
  onSubmit,
  onCancel,
}: PinPromptProps) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <View style={styles.backdrop}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onCancel} />
        <View style={styles.sheet}>
          <PinGateCard
            mode="unlock"
            title={title}
            subtitle={subtitle}
            lockedUntil={lockedUntil}
            onSubmit={onSubmit}
            onCancel={onCancel}
          />
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.62)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  sheet: { width: '100%', maxWidth: 480 },
});
