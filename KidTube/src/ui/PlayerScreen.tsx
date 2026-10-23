import React, { useCallback, useEffect, useRef, useState } from 'react';
import { BackHandler, Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { EmbedPlayer, type PlayerHandle, type PlayerState } from './EmbedPlayer';
import { PlayerControls } from './player/PlayerControls';
import { AudioControls } from './player/AudioControls';
import { lockLandscape, lockPortrait, unlockOrientation } from '../native/orientation';
import { colors, radius, spacing } from './theme';
import type { Video } from '../domain/types';
import { freshSleepTimer, resetSleepTimer, tickSleepTimer, type SleepTimerState } from '../domain/sleepMode';
import { advanceWatch, beginWatch, unreportedSeconds } from '../domain/watchTime';

export interface PlayerScreenProps {
  video: Video;
  audioOnly?: boolean;
  /** Audio mode is lifted to the route so App stops counting the daily usage. */
  onAudioOnlyChange?: (audioOnly: boolean) => void;
  /** Incremental actual-playback seconds (ADR 0003: the daily budget is real play time). */
  onPlayedSeconds?: (seconds: number) => void;
  /** Seconds left in today's video budget; undefined when there is no limit. */
  remainingVideoSeconds?: number;
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
  onPlayedSeconds,
  remainingVideoSeconds,
  onClose,
}: PlayerScreenProps) {
  const playerRef = useRef<PlayerHandle>(null);
  const [audioOnly, setAudioOnly] = useState(initialAudioOnly);
  const [ended, setEnded] = useState(false);
  const [error, setError] = useState<string | undefined>();
  const [errorCount, setErrorCount] = useState(0);
  const [limitReached, setLimitReached] = useState(false);
  // Best-effort resume target after a retry (ADR 0003).
  const resumeRef = useRef(0);
  const [playNonce, setPlayNonce] = useState(0);
  const [state, setState] = useState<PlayerState>(INITIAL_STATE);
  const [controlsVisible, setControlsVisible] = useState(true);
  const [scrubbing, setScrubbing] = useState(false);
  const [interacted, setInteracted] = useState(false);
  const [interactionNonce, setInteractionNonce] = useState(0);
  const [sleepTimer, setSleepTimer] = useState<SleepTimerState>(freshSleepTimer);
  const [loop, setLoop] = useState(false);
  // Read by the end handler without re-creating the callback on every toggle.
  const loopRef = useRef(loop);

  useEffect(() => {
    loopRef.current = loop;
  }, [loop]);

  // Count only actual playback (ADR 0003): paused, buffering and error time do
  // not consume the daily budget, and audio never does (ADR 0002).
  const watchRef = useRef(beginWatch(Date.now()));
  const reportedRef = useRef(0);
  useEffect(() => {
    const counting = !audioOnly && state.playing && !state.buffering;
    watchRef.current = advanceWatch(watchRef.current, Date.now(), counting);
    const delta = unreportedSeconds(watchRef.current, reportedRef.current);
    if (delta > 0) {
      reportedRef.current += delta;
      onPlayedSeconds?.(delta);
    }
  }, [state, audioOnly, onPlayedSeconds]);

  // Entering audio mode starts a fresh 1 h sleep countdown (ADR 0002).
  useEffect(() => {
    if (audioOnly) {
      setSleepTimer(freshSleepTimer());
    } else {
      // “Loop” is an audio-screen feature; drop it when back to video.
      setLoop(false);
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

  // With “play in a loop” on, an ended video silently restarts instead of
  // showing the end screen.
  const handleEnded = () => {
    if (loopRef.current) {
      playerRef.current?.seekTo(0);
      playerRef.current?.play();
      return;
    }
    setEnded(true);
  };

  // Network / HTTP errors from the WebView: show an explicit retry screen. No
  // automatic retries (ADR 0003) — the child decides.
  const handleError = (info?: string) => {
    resumeRef.current = state.position;
    setError(info ?? 'Nie udało się odtworzyć materiału.');
    setErrorCount(count => count + 1);
  };

  const retry = () => {
    setError(undefined);
    setPlayNonce(value => value + 1);
  };

  // Hard cut (ADR 0002/0005): the moment the daily video budget hits zero, pause
  // and offer audio mode. The child never keeps watching past the limit.
  useEffect(() => {
    if (audioOnly || limitReached) {
      return;
    }
    if (remainingVideoSeconds !== undefined && remainingVideoSeconds <= 0) {
      playerRef.current?.pause();
      setLimitReached(true);
    }
  }, [audioOnly, remainingVideoSeconds, limitReached]);

  // Switching to audio after the cut must resume playback (video was paused).
  const switchToAudio = () => {
    setAudioOnly(true);
    onAudioOnlyChange?.(true);
    if (limitReached) {
      setLimitReached(false);
      playerRef.current?.play();
    }
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
        onReady={() => {
          if (resumeRef.current > 1) {
            playerRef.current?.seekTo(resumeRef.current);
          }
        }}
        onEnded={handleEnded}
        onError={handleError}
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
              <Text style={styles.endBtnPrimaryText}>Zagraj ponownie</Text>
            </Pressable>
            <Pressable onPress={onClose} style={styles.endBtn}>
              <Text style={styles.endBtnText}>Wróć do listy</Text>
            </Pressable>
          </View>
        </View>
      ) : null}

      {audioOnly ? (
        <View style={styles.audioOverlay}>
          <View style={styles.audioTop}>
            {video.thumbnailUrl ? (
              <Image source={{ uri: video.thumbnailUrl }} style={styles.cover} />
            ) : null}
            <Text numberOfLines={3} style={styles.audioTitle}>
              {video.title}
            </Text>
            {video.channelTitle ? (
              <Text style={styles.audioChannel}>{video.channelTitle}</Text>
            ) : null}
          </View>

          <AudioControls
            state={state}
            loop={loop}
            onToggleLoop={() => setLoop(value => !value)}
            sleepRemainingMs={sleepTimer.remainingMs}
            sleepFired={sleepTimer.fired}
            onResetSleep={() => setSleepTimer(resetSleepTimer())}
            onResumeSleep={() => {
              playerRef.current?.play();
              setSleepTimer(resetSleepTimer());
            }}
            onTogglePlay={() => {
              // After the track finished, play starts it over from the beginning
              // (the audio screen stays up so the sleep counter remains visible).
              if (ended) {
                setEnded(false);
                playerRef.current?.seekTo(0);
                playerRef.current?.play();
                if (sleepTimer.fired) {
                  setSleepTimer(resetSleepTimer());
                }
                return;
              }
              if (!state.playing && sleepTimer.fired) {
                setSleepTimer(resetSleepTimer());
              }
              playerRef.current?.togglePlay();
            }}
            onSeek={onSeek}
            onScrubStart={() => setScrubbing(true)}
            onScrubEnd={() => setScrubbing(false)}
          />
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

      {limitReached && !audioOnly && !error ? (
        <View style={styles.endOverlay}>
          <Text style={styles.endEmoji}>⏰</Text>
          <Text numberOfLines={3} style={styles.audioTitle}>
            Czas na dziś wykorzystany
          </Text>
          <Text style={styles.audioChannel}>Możesz słuchać dalej z wyłączonym obrazem.</Text>
          <View style={styles.endActions}>
            <Pressable onPress={switchToAudio} style={[styles.endBtn, styles.endBtnPrimary]}>
              <Text style={styles.endBtnPrimaryText}>Tylko dźwięk</Text>
            </Pressable>
            <Pressable onPress={onClose} style={styles.endBtn}>
              <Text style={styles.endBtnText}>Wróć do listy</Text>
            </Pressable>
          </View>
        </View>
      ) : null}

      {error ? (
        <View style={styles.endOverlay}>
          <Text style={styles.endEmoji}>📡</Text>
          <Text numberOfLines={3} style={styles.audioTitle}>
            Nie udało się odtworzyć materiału
          </Text>
          {errorCount >= 2 ? (
            <Text style={styles.audioChannel}>Sprawdź połączenie z internetem.</Text>
          ) : null}
          <View style={styles.endActions}>
            <Pressable onPress={retry} style={[styles.endBtn, styles.endBtnPrimary]}>
              <Text style={styles.endBtnPrimaryText}>Spróbuj ponownie</Text>
            </Pressable>
            <Pressable onPress={onClose} style={styles.endBtn}>
              <Text style={styles.endBtnText}>Wróć do listy</Text>
            </Pressable>
          </View>
        </View>
      ) : null}

      <View style={styles.topControls}>
        <View style={styles.topLeft}>
          <Pressable onPress={onClose} hitSlop={10} style={styles.controlBtn}>
            <Text style={styles.controlText}>‹ Menu</Text>
          </Pressable>
          <Pressable
            onPress={() => {
              if (audioOnly) {
                setAudioOnly(false);
                onAudioOnlyChange?.(false);
              } else {
                switchToAudio();
              }
            }}
            hitSlop={10}
            style={styles.controlBtn}
          >
            <Text style={styles.controlText}>{audioOnly ? 'Wideo' : 'Tylko dźwięk'}</Text>
          </Pressable>
        </View>
        {!audioOnly && !ended && !error && controlsVisible && remainingVideoSeconds !== undefined ? (
          <Text style={styles.remainingText}>
            ⏳ {Math.ceil(Math.max(0, remainingVideoSeconds) / 60)} min
          </Text>
        ) : null}
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
    right: spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  topLeft: { flexDirection: 'row', gap: spacing.sm, alignItems: 'center' },
  remainingText: {
    backgroundColor: 'rgba(16,20,24,0.72)',
    color: colors.primary,
    fontSize: 13,
    fontWeight: '700',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.lg,
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
    justifyContent: 'space-between',
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.xl * 2,
    paddingBottom: spacing.xl,
    gap: spacing.lg,
  },
  audioTop: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
  },
  cover: { width: 220, height: 220, borderRadius: radius.lg, backgroundColor: colors.card },
  audioTitle: { color: colors.text, fontSize: 20, fontWeight: '700', textAlign: 'center' },
  audioChannel: { color: colors.textMuted, fontSize: 14 },
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
