import React, { useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import type { PlayerState } from '../EmbedPlayer';
import { SeekBar } from './SeekBar';
import { colors, radius, spacing } from '../theme';

export interface PlayerControlsProps {
  state: PlayerState;
  onTogglePlay: () => void;
  onSeek: (seconds: number) => void;
  onToggleCaptions: () => void;
  onSelectAudio: (index: number) => void;
  /** Parent preview hides the audio-track picker; the child keeps it. */
  showAudioPicker?: boolean;
  onScrubStart?: () => void;
  onScrubEnd?: () => void;
}

// YouTube does not always expose a language for an audio track. When it does,
// turn the code into a readable Polish name instead of showing a raw code.
const LANGUAGE_NAMES: Record<string, string> = {
  pl: 'Polski',
  en: 'Angielski',
  de: 'Niemiecki',
  fr: 'Francuski',
  es: 'Hiszpański',
  it: 'Włoski',
  pt: 'Portugalski',
  uk: 'Ukraiński',
  cs: 'Czeski',
  sk: 'Słowacki',
  ru: 'Rosyjski',
  nl: 'Niderlandzki',
  sv: 'Szwedzki',
  no: 'Norweski',
  da: 'Duński',
  fi: 'Fiński',
  hu: 'Węgierski',
  ro: 'Rumuński',
  tr: 'Turecki',
  ja: 'Japoński',
  ko: 'Koreański',
  zh: 'Chiński',
  ar: 'Arabski',
  he: 'Hebrajski',
  iw: 'Hebrajski',
  hi: 'Hindi',
  bn: 'Bengalski',
  ml: 'Malajalam',
  ta: 'Tamilski',
  te: 'Telugu',
  vi: 'Wietnamski',
  th: 'Tajski',
  id: 'Indonezyjski',
  ms: 'Malajski',
  fa: 'Perski',
  el: 'Grecki',
  bg: 'Bułgarski',
  hr: 'Chorwacki',
  sr: 'Serbski',
  sl: 'Słoweński',
  lt: 'Litewski',
  lv: 'Łotewski',
  et: 'Estoński',
};

function audioTrackName(track: PlayerState['audioTracks'][number], index: number): string {
  const code = (track.languageCode ?? '').trim().slice(0, 2).toLowerCase();
  const mapped = code ? LANGUAGE_NAMES[code] : undefined;
  const fallback = `Ścieżka ${index + 1}`;
  // Prefer a mapped language name; otherwise the player's own label if it is
  // more than the generic fallback; otherwise the fallback.
  let name: string;
  if (mapped && (!track.label || track.label === code || track.label === fallback)) {
    name = mapped;
  } else {
    name = track.label || mapped || fallback;
  }
  return track.isOriginal ? `${name} (oryginał)` : name;
}

export function PlayerControls({
  state,
  onTogglePlay,
  onSeek,
  onToggleCaptions,
  onSelectAudio,
  showAudioPicker = true,
  onScrubStart,
  onScrubEnd,
}: PlayerControlsProps) {
  const [audioOpen, setAudioOpen] = useState(false);
  const hasAudioChoice = showAudioPicker && state.audioTracks.length > 1;

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
              🔊 {audioTrackName(state.audioTracks[state.audioIndex] ?? { index: 0, label: '' }, state.audioIndex)}
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
        <View style={styles.modalRoot}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setAudioOpen(false)} />
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Ścieżka dźwiękowa</Text>
            <ScrollView
              style={styles.modalList}
              contentContainerStyle={styles.modalListContent}
              showsVerticalScrollIndicator
            >
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
                    {audioTrackName(track, track.index)}
                  </Text>
                </Pressable>
              ))}
            </ScrollView>
          </View>
        </View>
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
  chip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.lg,
    backgroundColor: 'rgba(255,255,255,0.12)',
  },
  chipOn: { backgroundColor: colors.primary },
  chipText: { color: colors.text, fontSize: 13, fontWeight: '700' },
  chipTextOn: { color: colors.black },
  modalRoot: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
  },
  modalCard: {
    width: '100%',
    maxWidth: 420,
    maxHeight: '85%',
    backgroundColor: colors.card,
    borderRadius: radius.md,
    padding: spacing.lg,
    gap: spacing.sm,
  },
  modalTitle: { color: colors.text, fontSize: 16, fontWeight: '800', marginBottom: spacing.sm },
  modalList: { flexShrink: 1 },
  modalListContent: { paddingBottom: spacing.xs },
  modalRow: { paddingVertical: spacing.md, paddingHorizontal: spacing.sm, borderRadius: radius.sm },
  modalRowText: { color: colors.text, fontSize: 15 },
  modalRowTextActive: { color: colors.primary, fontWeight: '800' },
});
