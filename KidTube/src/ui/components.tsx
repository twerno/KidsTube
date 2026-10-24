import React from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  type TextInputProps,
} from 'react-native';
import { colors, radius, spacing } from './theme';
import { watchState } from '../domain/watchState';
import { formatDurationRatio } from '../domain/duration';
import type { WatchProgress } from '../domain/types';

type Variant = 'primary' | 'secondary' | 'danger' | 'ghost';

export function Button({
  title,
  onPress,
  variant = 'primary',
  disabled,
  loading,
  compact,
}: {
  title: string;
  onPress: () => void;
  variant?: Variant;
  disabled?: boolean;
  loading?: boolean;
  /** Smaller padding + label, for button rows inside list entries. */
  compact?: boolean;
}) {
  const palette = {
    primary: { bg: colors.primary, fg: '#04203a' },
    secondary: { bg: colors.cardAlt, fg: colors.text },
    danger: { bg: colors.danger, fg: '#fff' },
    ghost: { bg: 'transparent', fg: colors.primary },
  }[variant];

  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      disabled={disabled || loading}
      style={({ pressed }) => [
        styles.button,
        compact && styles.buttonCompact,
        { backgroundColor: palette.bg, opacity: disabled ? 0.5 : pressed ? 0.85 : 1 },
      ]}
    >
      {loading ? (
        <ActivityIndicator color={palette.fg} />
      ) : (
        <Text
          numberOfLines={1}
          style={[styles.buttonText, compact && styles.buttonTextCompact, { color: palette.fg }]}
        >
          {title}
        </Text>
      )}
    </Pressable>
  );
}

export function Card({ children, style }: { children: React.ReactNode; style?: any }) {
  return <View style={[styles.card, style]}>{children}</View>;
}

export function Field(props: TextInputProps & { label?: string }) {
  const { label, style, ...rest } = props;
  return (
    <View style={styles.field}>
      {label ? <Text style={styles.label}>{label}</Text> : null}
      <TextInput
        placeholderTextColor={colors.textMuted}
        style={[styles.input, style]}
        {...rest}
      />
    </View>
  );
}

export function SectionTitle({ children }: { children: React.ReactNode }) {
  return <Text style={styles.sectionTitle}>{children}</Text>;
}

/**
 * “Stan obejrzenia” pill for a child tile (ADR 0004/0004a): new, watched in
 * full, or the last watched minute next to the cached film duration
 * (`12m / 1h:40m`). A never-played video shows “Nowy”.
 */
export function WatchBadge({ progress, style }: { progress?: WatchProgress; style?: any }) {
  const state = watchState(progress);
  if (state.kind === 'new') {
    return <Text style={[styles.badge, styles.badgeNew, style]}>Nowy</Text>;
  }
  if (state.kind === 'complete') {
    return <Text style={[styles.badge, styles.badgeDone, style]}>✓ W całości</Text>;
  }
  return (
    <Text style={[styles.badge, styles.badgePartial, style]}>
      {formatDurationRatio(progress?.positionSeconds ?? 0, progress?.durationSeconds)}
    </Text>
  );
}

const styles = StyleSheet.create({
  button: {
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 46,
  },
  buttonCompact: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.sm,
    minHeight: 38,
  },
  buttonText: { fontSize: 16, fontWeight: '600' },
  buttonTextCompact: { fontSize: 13 },
  card: {
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    padding: spacing.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  field: { gap: spacing.xs },
  label: { color: colors.textMuted, fontSize: 13 },
  input: {
    backgroundColor: colors.cardAlt,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    color: colors.text,
    fontSize: 16,
  },
  sectionTitle: {
    color: colors.textMuted,
    fontSize: 13,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginBottom: spacing.sm,
  },
  badge: {
    overflow: 'hidden',
    borderRadius: radius.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    fontSize: 11,
    fontWeight: '800',
  },
  badgeNew: { backgroundColor: colors.primary, color: colors.black },
  badgePartial: { backgroundColor: 'rgba(16,20,24,0.85)', color: colors.warning },
  badgeDone: { backgroundColor: 'rgba(16,20,24,0.85)', color: colors.success },
});
