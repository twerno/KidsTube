import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { PlayerState } from '../EmbedPlayer';
import { SeekBar } from './SeekBar';
import { formatCountdown } from '../../domain/sleepMode';
import { relativeSeek } from '../../domain/playback';
import { colors, radius, spacing } from '../theme';

export interface AudioControlsProps {
  state: PlayerState;
  loop: boolean;
  onToggleLoop: () => void;
  sleepRemainingMs: number;
  sleepFired: boolean;
  /** Reset the sleep counter to a full hour. */
  onResetSleep: () => void;
  /** Resume playback and restart the sleep counter. */
  onResumeSleep: () => void;
  onTogglePlay: () => void;
  onSeek: (seconds: number) => void;
  onScrubStart?: () => void;
  onScrubEnd?: () => void;
}

const JUMP_BACK_LONG = -5 * 60;
const JUMP_BACK_SHORT = -30;
const JUMP_FORWARD_SHORT = 30;
const JUMP_FORWARD_LONG = 5 * 60;

export function AudioControls({
  state,
  loop,
  onToggleLoop,
  sleepRemainingMs,
  sleepFired,
  onResetSleep,
  onResumeSleep,
  onTogglePlay,
  onSeek,
  onScrubStart,
  onScrubEnd,
}: AudioControlsProps) {
  const seekBy = (delta: number) => {
    onSeek(relativeSeek(state.position, delta, state.duration));
  };

  return (
    <View style={styles.panel}>
      <View style={styles.topRow}>
        <Pressable
          onPress={onToggleLoop}
          hitSlop={8}
          style={[styles.chip, loop && styles.chipOn]}
          accessibilityRole="switch"
          accessibilityState={{ checked: loop }}
        >
          <Text style={[styles.chipText, loop && styles.chipTextOn]}>
            🔁 Pętla {loop ? 'wł.' : 'wył.'}
          </Text>
        </Pressable>

        <View style={styles.sleepRow}>
          <Text style={styles.sleepText}>😴 {formatCountdown(sleepRemainingMs)}</Text>
          {sleepFired ? (
            <Pressable onPress={onResumeSleep} hitSlop={8} style={styles.sleepBtn}>
              <Text style={styles.sleepBtnText}>▶ Wznów</Text>
            </Pressable>
          ) : (
            <Pressable onPress={onResetSleep} hitSlop={8} style={styles.sleepBtn}>
              <Text style={styles.sleepBtnText}>Reset</Text>
            </Pressable>
          )}
        </View>
      </View>

      <SeekBar
        position={state.position}
        duration={state.duration}
        onSeek={onSeek}
        onScrubStart={onScrubStart}
        onScrubEnd={onScrubEnd}
      />

      <View style={styles.transport}>
        <Pressable onPress={() => seekBy(JUMP_BACK_LONG)} hitSlop={8} style={styles.jumpBtn}>
          <Text style={styles.jumpText}>−5 min</Text>
        </Pressable>
        <Pressable onPress={() => seekBy(JUMP_BACK_SHORT)} hitSlop={8} style={styles.jumpBtn}>
          <Text style={styles.jumpText}>−30 s</Text>
        </Pressable>

        <Pressable onPress={onTogglePlay} hitSlop={10} style={styles.playBtn}>
          <Text style={styles.playIcon}>{state.playing ? '❚❚' : '▶'}</Text>
        </Pressable>

        <Pressable onPress={() => seekBy(JUMP_FORWARD_SHORT)} hitSlop={8} style={styles.jumpBtn}>
          <Text style={styles.jumpText}>+30 s</Text>
        </Pressable>
        <Pressable onPress={() => seekBy(JUMP_FORWARD_LONG)} hitSlop={8} style={styles.jumpBtn}>
          <Text style={styles.jumpText}>+5 min</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  panel: {
    width: '100%',
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.lg,
    borderRadius: radius.lg,
    backgroundColor: colors.card,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  chip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.lg,
    backgroundColor: 'rgba(255,255,255,0.12)',
  },
  chipOn: { backgroundColor: colors.primary },
  chipText: { color: colors.text, fontSize: 13, fontWeight: '700' },
  chipTextOn: { color: colors.black },
  sleepRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  sleepText: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  sleepBtn: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: radius.sm,
    backgroundColor: 'rgba(255,255,255,0.12)',
  },
  sleepBtnText: { color: colors.primary, fontSize: 12, fontWeight: '800' },
  transport: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.xs,
  },
  jumpBtn: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: spacing.sm,
    borderRadius: radius.lg,
    backgroundColor: 'rgba(255,255,255,0.12)',
  },
  jumpText: { color: colors.text, fontSize: 13, fontWeight: '700' },
  playBtn: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  playIcon: { color: colors.black, fontSize: 20, fontWeight: '900' },
});