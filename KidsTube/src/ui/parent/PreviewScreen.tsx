/**
 * Parent preview (ADR 0001 / 0005): play a not-yet-approved video inside the
 * parent's context so the parent can judge it before deciding.
 *
 * Reuses the same locked embed as the child's player, but:
 *  - no time gating — limits apply to the child, never to the parent's review,
 *  - the preview never touches the child's daily limit, watch state or history,
 *  - explicit decision bar: Wstecz / Odrzuć / Akceptuj.
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { BackHandler, Pressable, StyleSheet, Text, View } from 'react-native';
import { EmbedPlayer, type PlayerHandle, type PlayerState } from '../EmbedPlayer';
import { PlayerControls } from '../player/PlayerControls';
import { Button } from '../components';
import { colors, radius, spacing } from '../theme';
import { SOURCE_LABEL } from './labels';
import type { Video, VideoStatus } from '../../domain/types';

/**
 * Actions offered by the preview depend on the film's current status (ADR 0016):
 * a decision that would not change anything is never offered.
 */
export type PreviewAction = 'pending' | 'allowed' | 'blocked' | 'channel-blocked' | 'none';

export interface PreviewScreenProps {
  video: Video;
  actions: PreviewAction;
  /** Extra context, e.g. a material that is no longer in the library. */
  note?: string;
  onDecide?: (video: Video, status: VideoStatus) => void;
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

export function PreviewScreen({ video, actions, note, onDecide, onClose }: PreviewScreenProps) {
  const playerRef = useRef<PlayerHandle>(null);
  const [state, setState] = useState<PlayerState>(INITIAL_STATE);
  const [ended, setEnded] = useState(false);
  const [playNonce, setPlayNonce] = useState(0);

  const handleSeek = useCallback((seconds: number) => {
    playerRef.current?.seekTo(seconds);
    setState(prev => ({ ...prev, position: seconds }));
  }, []);

  useEffect(() => {
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      onClose();
      return true;
    });
    return () => subscription.remove();
  }, [onClose]);

  const replay = () => {
    setEnded(false);
    setPlayNonce(value => value + 1);
  };

  return (
    <View style={styles.container}>
      <EmbedPlayer
        key={playNonce}
        ref={playerRef}
        videoId={video.id}
        autoPlay
        onEnded={() => setEnded(true)}
        onState={setState}
      />

      {/* Tap anywhere outside the bars to toggle play/pause. */}
      {!ended ? (
        <Pressable style={StyleSheet.absoluteFill} onPress={() => playerRef.current?.togglePlay()} />
      ) : null}

      {ended ? (
        <View style={styles.endOverlay}>
          <Text style={styles.endEmoji}>🎬</Text>
          <Text numberOfLines={3} style={styles.endTitle}>
            Koniec podglądu.
          </Text>
          <Pressable onPress={replay} style={[styles.endBtn, styles.endBtnPrimary]}>
            <Text style={styles.endBtnPrimaryText}>Jeszcze raz</Text>
          </Pressable>
          <Pressable onPress={onClose} style={styles.endBtn}>
            <Text style={styles.endBtnText}>Wróć</Text>
          </Pressable>
        </View>
      ) : null}

      {!ended ? (
        <PlayerControls
          state={state}
          onTogglePlay={() => playerRef.current?.togglePlay()}
          onSeek={handleSeek}
          onToggleCaptions={() => playerRef.current?.toggleCaptions()}
          onSelectAudio={index => playerRef.current?.setAudioTrack(index)}
          showAudioPicker={false}
        />
      ) : null}

      <View style={styles.header}>
        <Text numberOfLines={2} style={styles.headerTitle}>
          {video.title}
        </Text>
        <Text numberOfLines={1} style={styles.headerMeta}>
          {[video.channelTitle, SOURCE_LABEL[video.source]].filter(Boolean).join(' · ')}
        </Text>
        <View style={styles.headerActions}>
          <Button title="Wstecz" variant="ghost" onPress={onClose} />
          <Text style={styles.headerHint}>podgląd rodzica — bez wpływu na limity dziecka</Text>
          {note ? <Text style={styles.headerNote}>{note}</Text> : null}
        </View>
        {actions !== 'none' && onDecide ? (
          <View style={styles.decisionActions}>
            {actions === 'pending' ? (
              <>
                <Button
                  title="Odrzuć"
                  variant="danger"
                  onPress={() => onDecide(video, 'blocked')}
                />
                <Button
                  title="Akceptuj"
                  variant="primary"
                  onPress={() => onDecide(video, 'allowed')}
                />
              </>
            ) : null}
            {actions === 'allowed' ? (
              <Button
                title="Cofnij zgodę"
                variant="danger"
                onPress={() => onDecide(video, 'blocked')}
              />
            ) : null}
            {actions === 'blocked' ? (
              <Button
                title="Przywróć"
                variant="secondary"
                onPress={() => onDecide(video, 'allowed')}
              />
            ) : null}
            {actions === 'channel-blocked' ? (
              <>
                <Button
                  title="Odrzuć"
                  variant="danger"
                  onPress={() => onDecide(video, 'blocked')}
                />
                <Button
                  title="Zezwól na ten film"
                  variant="primary"
                  onPress={() => onDecide(video, 'allowed')}
                />
              </>
            ) : null}
          </View>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.black },
  header: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    padding: spacing.md,
    gap: spacing.xs,
    backgroundColor: 'rgba(8,10,13,0.78)',
  },
  headerTitle: { color: colors.primary, fontSize: 16, fontWeight: '800' },
  headerMeta: { color: colors.primary, fontSize: 12, opacity: 0.8 },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginTop: spacing.xs,
  },
  headerHint: { color: colors.warning, fontSize: 11, flexShrink: 1 },
  decisionActions: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.sm,
    paddingTop: spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(255,255,255,0.2)',
  },
  headerNote: { color: colors.textMuted, fontSize: 11, flexShrink: 1 },
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
  endTitle: { color: colors.text, fontSize: 18, fontWeight: '700', textAlign: 'center' },
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