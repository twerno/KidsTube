import React, { useCallback, useEffect, useRef, useState } from 'react';
import { BackHandler, Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { EmbedPlayer, type PlayerHandle, type PlayerState } from './EmbedPlayer';
import { PlayerControls } from './player/PlayerControls';
import { lockLandscape, lockPortrait, unlockOrientation } from '../native/orientation';
import { colors, radius, spacing } from './theme';
import type { Video } from '../domain/types';
import {
  formatCountdown,
  freshSleepTimer,
  resetSleepTimer,
  tickSleepTimer,
  type SleepTimerState,
} from '../domain/sleepMode';

export interface PlayerScreenProps {
  video: Video;
  audioOnly?: boolean;
  /** Audio mode is lifted to the route so App stops counting the daily usage. */
  onAudioOnlyChange?: (audioOnly: boolean) => void;
  onClose: () => void;
}

const INITIAL_STATE: PlayerState = {
  playing: true,
  position: 0,
  duration: 0,
  playerState: -1,
  buffering: true,
  captionsOn: false,
  audioTracks: [],
  audioIndex: 0,
};

const CONTROLS_HIDE_MS = 4000;
// On first reveal we keep the bar up longer so it masks YouTube's startup UI.
const CONTROLS_HIDE_INITIAL_MS = 8000;

export function PlayerScreen({
  video,
  audioOnly: initialAudioOnly = false,
  onAudioOnlyChange,
  onClose,
}: PlayerScreenProps) {
  const playerRef = useRef<PlayerHandle>(null);
  const [audioOnly, setAudioOnly] = useState(initialAudioOnly);
  const [ended, setEnded] = useState(false);
  const [playNonce, setPlayNonce] = useState(0);
  const [state, setState] = useState<PlayerState>(INITIAL_STATE);
  const [controlsVisible, setControlsVisible] = useState(true);
  const [scrubbing, setScrubbing] = useState(false);
  const [interacted, setInteracted] = useState(false);
  const [interactionNonce, setInteractionNonce] = useState(0);
  const [sleepTimer, setSleepTimer] = useState<SleepTimerState>(freshSleepTimer);

  // Entering audio mode starts a fresh 1 h sleep countdown (ADR 0002).
  useEffect(() => {
    if (audioOnly) {
      setSleepTimer(freshSleepTimer());
    }
  }, [audioOnly]);

  // Tick the countdown while audio is actually playing; firing pauses the player.
  useEffect(() => {
    if (!audioOnly || sleepTimer.fired || !state.playing) {
      return undefined;
    }
    const timer = setInterval(() => {
      const next = tickSleepTimer(sleepTimer, 1000, true);
      if (next.fired && !sleepTimer.fired) {
        playerRef.current?.pause();
      }
      setSleepTimer(next);
    }, 1000);
    return () => clearInterval(timer);
  }, [audioOnly, sleepTimer, state.playing]);

  const replay = () => {
    setEnded(false);
    setInteracted(false);
    setPlayNonce(value => value + 1);
    setControlsVisible(true);
  };

  const showControls = useCallback(() => {
    setControlsVisible(true);
    setInteracted(true);
    setInteractionNonce(value => value + 1);
  }, []);

  useEffect(() => {
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      onClose();
      return true;
    });
    return () => subscription.remove();
  }, [onClose]);

  // Auto-hide the control bar while playing. It stays put while the user is
  // scrubbing and is re-armed on every interaction (interactionNonce).
  useEffect(() => {
    if (
      !controlsVisible ||
      ended ||
      scrubbing ||
      state.buffering ||
      state.playerState === 3 || // YT.PlayerState.BUFFERING
      state.playerState !== 1 // only count down while YT.PlayerState.PLAYING
    ) {
      return undefined;
    }
    const timer = setTimeout(
      () => setControlsVisible(false),
      interacted ? CONTROLS_HIDE_MS : CONTROLS_HIDE_INITIAL_MS,
    );
    return () => clearTimeout(timer);
  }, [
    controlsVisible,
    ended,
    scrubbing,
    state.buffering,
    state.playerState,
    state.playing,
    interacted,
    interactionNonce,
  ]);

  useEffect(() => {
    if (audioOnly) {
      lockPortrait();
    } else {
      lockLandscape();
    }
  }, [audioOnly]);

  useEffect(() => () => unlockOrientation(), []);

  const onSeek = (seconds: number) => {
    playerRef.current?.seekTo(seconds);
    setState(prev => ({ ...prev, position: seconds }));
    showControls();
  };

  return (
    <View style={styles.container}>
      {/* Player is never interactive; all input goes to our native controls. */}
      <EmbedPlayer
        key={playNonce}
        ref={playerRef}
        videoId={video.id}
        autoPlay
        onEnded={() => setEnded(true)}
        onState={setState}
      />

      {/* Tap anywhere to toggle the control bar (does not reach YouTube). */}
      {!audioOnly && !ended ? (
        <Pressable style={StyleSheet.absoluteFill} onPress={showControls} />
      ) : null}

      {ended ? (
        <View style={styles.endOverlay}>
          <Text style={styles.endEmoji}>🎬</Text>
          <Text numberOfLines={3} style={styles.audioTitle}>
            Koniec: {video.title}
          </Text>
          <View style={styles.endActions}>
            <Pressable onPress={replay} style={[styles.endBtn, styles.endBtnPrimary]}>
              <Text style={styles.endBtnPrimaryText}>Jeszcze raz</Text>
            </Pressable>
            <Pressable onPress={onClose} style={styles.endBtn}>
              <Text style={styles.endBtnText}>Wróć do listy</Text>
            </Pressable>
          </View>
        </View>
      ) : null}

      {audioOnly ? (
        <View style={styles.audioOverlay}>
          {video.thumbnailUrl ? (
            <Image source={{ uri: video.thumbnailUrl }} style={styles.cover} />
          ) : null}
          <Text numberOfLines={3} style={styles.audioTitle}>
            {video.title}
          </Text>
          {video.channelTitle ? <Text style={styles.audioChannel}>{video.channelTitle}</Text> : null}
          <Text style={styles.audioHint}>
            Tryb audio — bez obrazu i bez limitu czasu. Ekran możesz teraz zgasić.
          </Text>
          <View style={styles.sleepCard}>
            <Text style={styles.sleepLabel}>😴 Tryb snu: {formatCountdown(sleepTimer.remainingMs)}</Text>
            {sleepTimer.fired ? (
              <Pressable
                onPress={() => {
                  playerRef.current?.play();
                  setSleepTimer(resetSleepTimer());
                }}
                style={styles.sleepBtn}
              >
                <Text style={styles.sleepBtnText}>▶ Wznów odtwarzanie (1 h)</Text>
              </Pressable>
            ) : (
              <Pressable onPress={() => setSleepTimer(resetSleepTimer())} style={styles.sleepBtn}>
                <Text style={styles.sleepBtnText}>Zresetuj licznik (1 h)</Text>
              </Pressable>
            )}
          </View>
        </View>
      ) : null}

      {!ended && !audioOnly && controlsVisible ? (
        <PlayerControls
          state={state}
          onTogglePlay={() => {
            playerRef.current?.togglePlay();
            showControls();
          }}
          onSeek={onSeek}
          onToggleCaptions={() => {
            playerRef.current?.toggleCaptions();
            showControls();
          }}
          onSelectAudio={index => {
            playerRef.current?.setAudioTrack(index);
            showControls();
          }}
          onScrubStart={() => {
            setScrubbing(true);
            showControls();
          }}
          onScrubEnd={() => {
            setScrubbing(false);
            showControls();
          }}
        />
      ) : null}

      <View style={styles.topControls}>
        <Pressable onPress={onClose} hitSlop={10} style={styles.controlBtn}>
          <Text style={styles.controlText}>‹ Menu</Text>
        </Pressable>
        <Pressable
          onPress={() => {
            const next = !audioOnly;
            setAudioOnly(next);
            onAudioOnlyChange?.(next);
          }}
          hitSlop={10}
          style={styles.controlBtn}
        >
          <Text style={styles.controlText}>{audioOnly ? 'Wideo' : 'Tylko dźwięk'}</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.black },
  topControls: {
    position: 'absolute',
    top: spacing.sm,
    left: spacing.sm,
    flexDirection: 'row',
    gap: spacing.sm,
  },
  controlBtn: {
    backgroundColor: 'rgba(16,20,24,0.72)',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.lg,
  },
  controlText: { color: colors.primary, fontSize: 13, fontWeight: '700' },
  audioOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: colors.bg,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
    gap: spacing.md,
  },
  cover: { width: 220, height: 220, borderRadius: radius.lg, backgroundColor: colors.card },
  audioTitle: { color: colors.text, fontSize: 20, fontWeight: '700', textAlign: 'center' },
  audioChannel: { color: colors.textMuted, fontSize: 14 },
  audioHint: {
    color: colors.textMuted,
    fontSize: 13,
    textAlign: 'center',
    marginTop: spacing.md,
    lineHeight: 19,
  },
  sleepCard: {
    marginTop: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderRadius: radius.lg,
    backgroundColor: colors.card,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    alignItems: 'center',
    gap: spacing.sm,
  },
  sleepLabel: { color: colors.text, fontSize: 16, fontWeight: '700' },
  sleepBtn: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: radius.lg,
    backgroundColor: colors.primary,
  },
  sleepBtnText: { color: colors.black, fontSize: 14, fontWeight: '800' },
  endOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: colors.bg,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
    gap: spacing.md,
  },
  endEmoji: { fontSize: 56 },
  endActions: { flexDirection: 'row', gap: spacing.md, marginTop: spacing.lg },
  endBtn: {
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
    borderRadius: radius.lg,
    backgroundColor: colors.card,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  endBtnText: { color: colors.text, fontSize: 15, fontWeight: '700' },
  endBtnPrimary: { backgroundColor: colors.primary },
  endBtnPrimaryText: { color: colors.black, fontSize: 15, fontWeight: '800' },
});
