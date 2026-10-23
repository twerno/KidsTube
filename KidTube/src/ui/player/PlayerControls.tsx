import React, { useRef, useState } from 'react';
import {
  Modal,
  Pressable,
  ScrollView,
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
  // Last known finger x in bar-local pixels. On a plain tap the release event
  // may not carry a meaningful x; without this, tap-to-seek used to jump to 0.
  const lastXRef = useRef(0);
  const barRef = useRef<React.ComponentRef<typeof View>>(null);
  // Absolute page x of the bar's left edge. `locationX` is relative to the
  // *current touch target*, which changes as the finger leaves the bar and made
  // the value jump; `pageX` is absolute, so measuring the bar once keeps
  // scrubbing stable no matter where the finger is.
  const barXRef = useRef(0);
  const barWidthRef = useRef(0);

  const measureBar = () => {
    barRef.current?.measureInWindow((x, _y, w) => {
      barXRef.current = x;
      if (w > 0) {
        barWidthRef.current = w;
      }
    });
  };

  const onLayout = (event: LayoutChangeEvent) => {
    const w = event.nativeEvent.layout.width;
    setWidth(w);
    barWidthRef.current = w;
    measureBar();
  };

  const localX = (event: GestureResponderEvent) => {
    const w = barWidthRef.current || width;
    if (w <= 0) {
      return 0;
    }
    return Math.min(w, Math.max(0, event.nativeEvent.pageX - barXRef.current));
  };
  const ratioFromX = (x: number) => {
    const w = barWidthRef.current || width;
    return w > 0 ? Math.min(1, Math.max(0, x / w)) : 0;
  };
  const seekFromX = (x: number) => {
    if (duration > 0) {
      onSeek(ratioFromX(x) * duration);
    }
  };
  const shown = scrub ?? position;
  const ratio = duration > 0 ? Math.min(1, Math.max(0, shown / duration)) : 0;

  const grant = (event: GestureResponderEvent) => {
    measureBar();
    lastXRef.current = localX(event);
    onScrubStart?.();
    setScrub(ratioFromX(lastXRef.current) * duration);
  };
  const move = (event: GestureResponderEvent) => {
    lastXRef.current = localX(event);
    setScrub(ratioFromX(lastXRef.current) * duration);
  };
  // Seek only on release (never while dragging); see the comment on lastXRef.
  const release = () => {
    seekFromX(lastXRef.current);
    setScrub(null);
    onScrubEnd?.();
  };
  const terminate = () => {
    setScrub(null);
    onScrubEnd?.();
  };

  const labelWidth = 56;
  const labelLeft =
    width > 0
      ? Math.min(Math.max(ratio * width - labelWidth / 2, 0), Math.max(width - labelWidth, 0))
      : 0;

  return (
    <View>
      <View
        ref={barRef}
        style={styles.seekHit}
        onLayout={onLayout}
        onStartShouldSetResponder={() => true}
        onMoveShouldSetResponder={() => true}
        // Never give the gesture up mid-drag: otherwise a sibling/parent can
        // steal it, which resets `scrub` and makes the bar + label flicker.
        onResponderTerminationRequest={() => false}
        onResponderGrant={grant}
        onResponderMove={move}
        onResponderRelease={release}
        onResponderTerminate={terminate}
      >
        <View style={styles.seekTrack}>
          <View style={[styles.seekFill, { width: `${ratio * 100}%` }]} />
          <View style={[styles.seekKnob, { left: `${ratio * 100}%` }]} />
        </View>
      </View>
      <View style={styles.times}>
        <Text style={styles.time}>{formatTime(0)}</Text>
        <Text style={styles.time}>{formatTime(duration)}</Text>
        {width > 0 ? (
          <View
            pointerEvents="none"
            style={[styles.scrubTime, { left: labelLeft, width: labelWidth }]}
          >
            <Text style={styles.scrubTimeText}>{formatTime(shown)}</Text>
          </View>
        ) : null}
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
  times: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 2 },
  time: { color: colors.textMuted, fontSize: 12, fontVariant: ['tabular-nums'] },
  // Target-time chip: sits on the same line as the start/end times and covers
  // them (opaque background, rendered last) whenever they would collide.
  scrubTime: {
    position: 'absolute',
    top: -1,
    alignItems: 'center',
    backgroundColor: colors.card,
    borderRadius: radius.sm,
    paddingVertical: 2,
  },
  scrubTimeText: {
    color: colors.text,
    fontSize: 12,
    fontWeight: '800',
    fontVariant: ['tabular-nums'],
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
