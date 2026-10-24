import React from 'react';
import { StyleSheet, Text } from 'react-native';
import { colors, spacing } from '../theme';

/** Shared empty state: “nothing here” vs “nothing in this filter” (ADR 0016). */
export function EmptyState({ children }: { children: React.ReactNode }) {
  return <Text style={styles.empty}>{children}</Text>;
}

const styles = StyleSheet.create({
  empty: {
    color: colors.textMuted,
    textAlign: 'center',
    fontSize: 15,
    lineHeight: 22,
    marginTop: spacing.xl,
    paddingHorizontal: spacing.lg,
  },
});
