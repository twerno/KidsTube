import React, { useState } from 'react';
import {
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
  type GestureResponderEvent,
  type LayoutChangeEvent,
} from 'react-native';
import type { PlayerState } from '../EmbedPlayer';
import { colors, radius, spacing } from '../theme';

export function formatTime(seconds: number): string {
  if (!isFinite(seconds) || seconds < 0) {
    return '0:00';
  }
  const total = Math.floor(seconds);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const mm = h > 0 ? String(m).padStart(2, '0') : String(m);
  const ss = String(s).padStart(2, '0');
  return h > 0 ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
}

interface SeekBarProps {
  position: number;
  duration: number;
  onSeek: (seconds: number) => void;
  onScrubStart?: () => void;
  onScrubEnd?: () => void;
}

function SeekBar({ position, duration, onSeek, onScrubStart, onScrubEnd }: SeekBarProps) {
  const [width, setWidth] = useState(0);
  const [scrub, setScrub] = useState<number | null>(null);

  const onLayout = (event: LayoutChangeEvent) => setWidth(event.nativeEvent.layout.width);
  const ratioFromX = (x: number) => (width > 0 ? Math.min(1, Math.max(0, x / width)) : 0);
  const seekFromX = (x: number) => {
    if (duration > 0) {
      onSeek(ratioFromX(x) * duration);
    }
  };
  const shown = scrub ?? position;
  const ratio = duration > 0 ? Math.min(1, Math.max(0, shown / duration)) : 0;

  const grant = (event: GestureResponderEvent) => {
    onScrubStart?.();
    setScrub(ratioFromX(event.nativeEvent.locationX) * duration);
  };
  const move = (event: GestureResponderEvent) => {
    setScrub(ratioFromX(event.nativeEvent.locationX) * duration);
  };
  const release = (event: GestureResponderEvent) => {
    seekFromX(event.nativeEvent.locationX);
    setScrub(null);
    onScrubEnd?.();
  };

  return (
    <View
      style={styles.seekHit}
      onLayout={onLayout}
      onStartShouldSetResponder={() => true}
      onMoveShouldSetResponder={() => true}
      onResponderGrant={grant}
      onResponderMove={move}
      onResponderRelease={release}
      onResponderTerminate={() => { setScrub(null); onScrubEnd?.(); }}
    >
      <View style={styles.seekTrack}>
        <View style={[styles.seekFill, { width: `${ratio * 100}%` }]} />
        <View style={[styles.seekKnob, { left: `${ratio * 100}%` }]} />
      </View>
    </View>
  );
}

export interface PlayerControlsProps {
  state: PlayerState;
  onTogglePlay: () => void;
  onSeek: (seconds: number) => void;
  onToggleCaptions: () => void;
  onSelectAudio: (index: number) => void;
  onScrubStart?: () => void;
  onScrubEnd?: () => void;
}

export function PlayerControls({
  state,
  onTogglePlay,
  onSeek,
  onToggleCaptions,
  onSelectAudio,
  onScrubStart,
  onScrubEnd,
}: PlayerControlsProps) {
  const [audioOpen, setAudioOpen] = useState(false);
  const hasAudioChoice = state.audioTracks.length > 1;

  return (
    <View style={styles.bar} pointerEvents="box-none">
      <View style={styles.row}>
        <Pressable onPress={onTogglePlay} hitSlop={12} style={styles.playBtn}>
          <Text style={styles.playIcon}>{state.playing ? '❚❚' : '▶'}</Text>
        </Pressable>

        <View style={styles.mid}>
          <SeekBar
            position={state.position}
            duration={state.duration}
            onSeek={onSeek}
            onScrubStart={onScrubStart}
            onScrubEnd={onScrubEnd}
          />
          <View style={styles.times}>
            <Text style={styles.time}>{formatTime(state.position)}</Text>
            <Text style={styles.time}>{formatTime(state.duration)}</Text>
          </View>
        </View>

        <Pressable
          onPress={onToggleCaptions}
          hitSlop={10}
          style={[styles.chip, state.captionsOn && styles.chipOn]}
        >
          <Text style={[styles.chipText, state.captionsOn && styles.chipTextOn]}>CC</Text>
        </Pressable>

        {hasAudioChoice ? (
          <Pressable onPress={() => setAudioOpen(true)} hitSlop={10} style={styles.chip}>
            <Text style={styles.chipText}>
              🔊 {state.audioTracks[state.audioIndex]?.label ?? 'Audio'}
            </Text>
          </Pressable>
        ) : null}
      </View>

      <Modal
        visible={audioOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setAudioOpen(false)}
      >
        <Pressable style={styles.modalBackdrop} onPress={() => setAudioOpen(false)}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Ścieżka dźwiękowa</Text>
            {state.audioTracks.map(track => (
              <Pressable
                key={track.index}
                style={styles.modalRow}
                onPress={() => {
                  onSelectAudio(track.index);
                  setAudioOpen(false);
                }}
              >
                <Text
                  style={[
                    styles.modalRowText,
                    track.index === state.audioIndex && styles.modalRowTextActive,
                  ]}
                >
                  {track.index === state.audioIndex ? '● ' : '○ '}
                  {track.label}
                </Text>
              </Pressable>
            ))}
          </View>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    paddingBottom: spacing.md,
    backgroundColor: 'rgba(8,10,13,0.82)',
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  playBtn: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  playIcon: { color: colors.black, fontSize: 18, fontWeight: '900' },
  mid: { flex: 1, gap: spacing.xs },
  seekHit: { paddingVertical: spacing.sm, justifyContent: 'center' },
  seekTrack: {
    height: 6,
    borderRadius: 3,
    backgroundColor: 'rgba(255,255,255,0.25)',
    justifyContent: 'center',
  },
  seekFill: { position: 'absolute', left: 0, top: 0, bottom: 0, backgroundColor: colors.primary, borderRadius: 3 },
  seekKnob: {
    position: 'absolute',
    width: 16,
    height: 16,
    borderRadius: 8,
    marginLeft: -8,
    backgroundColor: colors.text,
  },
  times: { flexDirection: 'row', justifyContent: 'space-between' },
  time: { color: colors.textMuted, fontSize: 12, fontVariant: ['tabular-nums'] },
  chip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.lg,
    backgroundColor: 'rgba(255,255,255,0.12)',
  },
  chipOn: { backgroundColor: colors.primary },
  chipText: { color: colors.text, fontSize: 13, fontWeight: '700' },
  chipTextOn: { color: colors.black },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
  },
  modalCard: {
    width: '100%',
    maxWidth: 420,
    backgroundColor: colors.card,
    borderRadius: radius.md,
    padding: spacing.lg,
    gap: spacing.sm,
  },
  modalTitle: { color: colors.text, fontSize: 16, fontWeight: '800', marginBottom: spacing.sm },
  modalRow: { paddingVertical: spacing.md, paddingHorizontal: spacing.sm, borderRadius: radius.sm },
  modalRowText: { color: colors.text, fontSize: 15 },
  modalRowTextActive: { color: colors.primary, fontWeight: '800' },
});
