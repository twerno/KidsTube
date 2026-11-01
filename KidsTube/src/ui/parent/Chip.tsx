import React from 'react';
import { Pressable, StyleSheet, Text, type StyleProp, type ViewStyle } from 'react-native';
import { colors, radius, spacing } from '../theme';

export function Chip({
  label,
  active,
  onPress,
  compact,
  style,
}: {
  label: string;
  active?: boolean;
  onPress: () => void;
  /** Tighter padding and font for a single row of equal-width chips. */
  compact?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.chip,
        compact && styles.chipCompact,
        active && styles.chipActive,
        style,
        pressed && styles.chipPressed,
      ]}
    >
      <Text
        numberOfLines={compact ? 2 : 1}
        style={[styles.chipText, compact && styles.chipTextCompact, active && styles.chipTextActive]}
      >
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  chip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.lg,
    backgroundColor: colors.cardAlt,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  chipCompact: {
    paddingHorizontal: spacing.xs,
    paddingVertical: spacing.xs,
    borderRadius: radius.md,
  },
  chipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipPressed: { opacity: 0.8 },
  chipText: { color: colors.textMuted, fontSize: 13, fontWeight: '600' },
  chipTextCompact: { fontSize: 11, lineHeight: 14, textAlign: 'center' },
  chipTextActive: { color: '#04203a' },
});
