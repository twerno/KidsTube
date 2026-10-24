import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { spacing } from '../theme';
import type { Video, VideoStatus } from '../../domain/types';

const TONE = {
  allowed: '#12803a',
  blocked: '#c62828',
} as const;

const LABEL = {
  allowed: 'Zatwierdzono',
  blocked: 'Odrzucono',
} as const;

export interface DecisionToastProps {
  video: Video;
  status: VideoStatus;
  onUndo: () => void;
}

/**
 * The 10-second decision bar (ADR 0016). It is deliberately a **light** surface
 * on the dark panel: it must be the first thing the eye catches, because it is
 * the only place where a fresh decision can be taken back.
 */
export function DecisionToast({ video, status, onUndo }: DecisionToastProps) {
  if (status === 'pending') {
    return null;
  }
  const tone = TONE[status];
  return (
    <View style={[styles.bar, { borderLeftColor: tone }]}>
      <View style={styles.text}>
        <Text style={[styles.outcome, { color: tone }]}>{LABEL[status]}</Text>
        <Text numberOfLines={2} style={styles.title}>
          {video.title}
        </Text>
      </View>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Cofnij decyzję"
        onPress={onUndo}
        style={({ pressed }) => [styles.undo, pressed && styles.pressed]}
      >
        <Text style={styles.undoText}>Cofnij</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    position: 'absolute',
    left: spacing.lg,
    right: spacing.lg,
    bottom: spacing.xl,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.lg,
    backgroundColor: '#f4f7fa',
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#d5dee8',
    borderLeftWidth: 6,
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.lg,
    elevation: 12,
    shadowColor: '#000000',
    shadowOpacity: 0.35,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
  },
  text: { flex: 1, gap: 3 },
  outcome: {
    fontSize: 13,
    fontWeight: '900',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  title: { color: '#101418', fontSize: 14, fontWeight: '600', lineHeight: 21 },
  undo: {
    paddingVertical: 12,
    paddingHorizontal: 18,
    borderRadius: 10,
    backgroundColor: '#101418',
  },
  pressed: { opacity: 0.85 },
  undoText: { color: '#ffffff', fontSize: 15, fontWeight: '800' },
});
