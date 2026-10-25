import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, radius, spacing } from '../theme';

export interface PanelHeaderProps {
  title: string;
  /** Present on every screen below the index; the index shows “Zamknij”. */
  onBack?: () => void;
  right?: React.ReactNode;
}

/** One header for all panel screens (ADR 0016: back only pops the stack). */
export function PanelHeader({ title, onBack, right }: PanelHeaderProps) {
  return (
    <View style={styles.header}>
      {onBack ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Wstecz"
          onPress={onBack}
          style={({ pressed }) => [styles.back, pressed && styles.pressed]}
        >
          <Text style={styles.backText}>‹ Wstecz</Text>
        </Pressable>
      ) : null}
      <Text numberOfLines={1} style={styles.title}>
        {title}
      </Text>
      {right ?? null}
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.md,
  },
  back: {
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
    borderRadius: radius.sm,
    backgroundColor: colors.cardAlt,
  },
  pressed: { opacity: 0.85 },
  backText: { color: colors.primary, fontSize: 14, fontWeight: '700' },
  title: { color: colors.text, fontSize: 20, fontWeight: '800', flex: 1 },
});
