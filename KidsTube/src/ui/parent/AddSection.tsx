import React, { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Button, Card, Field } from '../components';
import { ChannelDetails } from './ChannelCard';
import { VideoRow } from './VideoRow';
import { colors, spacing } from '../theme';
import { isBlockedChannelVideo } from '../../domain/panel';
import type { AddLinkResult } from '../../services/addByLink';
import type { Channel, ChannelPolicy, Video, VideoStatus } from '../../domain/types';

type AddResult =
  | { kind: 'video'; videoId: string; channelBlocked: boolean }
  | { kind: 'channel'; channelId: string };

export interface AddSectionProps {
  /** False when the panel pushed another screen: the inline result is ephemeral. */
  active: boolean;
  videos: Video[];
  channels: Channel[];
  onAddLink: (link: string) => Promise<AddLinkResult>;
  onSetStatus: (video: Video, status: VideoStatus) => void;
  onPreview: (video: Video) => void;
  onSelectPolicy: (channel: Channel, policy: ChannelPolicy) => void;
  onToggleMuted: (channel: Channel) => void;
  onToggleBlocked: (channel: Channel) => void;
  onBlockAllVideos?: (channel: Channel) => void;
}

/** “Dodaj film/kanał”: one input, one action, no pre-choice (ADR 0016). */
export function AddSection({
  active,
  videos,
  channels,
  onAddLink,
  onSetStatus,
  onPreview,
  onSelectPolicy,
  onToggleMuted,
  onToggleBlocked,
  onBlockAllVideos,
}: AddSectionProps) {
  const [link, setLink] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<{ message: string; details: string } | undefined>();
  const [showDetails, setShowDetails] = useState(false);
  const [result, setResult] = useState<AddResult | undefined>();

  useEffect(() => {
    if (!active) {
      setResult(undefined);
      setError(undefined);
      setShowDetails(false);
    }
  }, [active]);

  const submit = async () => {
    const value = link.trim();
    if (!value || busy) {
      return;
    }
    setBusy(true);
    setError(undefined);
    try {
      const outcome = await onAddLink(value);
      if (!outcome.ok) {
        setResult(undefined);
        setError({ message: outcome.message, details: outcome.details });
        return;
      }
      setLink('');
      if (outcome.kind === 'video') {
        setResult({ kind: 'video', videoId: outcome.video.id, channelBlocked: outcome.channelBlocked });
      } else {
        setResult({ kind: 'channel', channelId: outcome.channel.id });
      }
    } finally {
      setBusy(false);
    }
  };

  const addedVideo =
    result?.kind === 'video' ? videos.find(video => video.id === result.videoId) : undefined;
  const addedChannel =
    result?.kind === 'channel' ? channels.find(channel => channel.id === result.channelId) : undefined;
  const channelBlocked = addedVideo ? isBlockedChannelVideo(addedVideo, channels) : false;

  return (
    <ScrollView showsVerticalScrollIndicator persistentScrollbar contentContainerStyle={styles.content}>
      <Card style={styles.card}>
        <Field
          label="Link do filmu lub kanału"
          value={link}
          onChangeText={setLink}
          autoCapitalize="none"
          autoCorrect={false}
          placeholder="https://www.youtube.com/…"
          onSubmitEditing={submit}
        />
        <Text style={styles.hint}>
          Film zostanie od razu dopuszczony. Kanał dodasz jako ręczny — jego filmy trafią do
          zatwierdzenia.
        </Text>
        <Button title="Dodaj" onPress={submit} loading={busy} disabled={!link.trim()} />
      </Card>

      {error ? (
        <Card style={styles.card}>
          <Text style={styles.error}>{error.message}</Text>
          <Pressable
            accessibilityRole="button"
            onPress={() => setShowDetails(value => !value)}
            style={styles.detailsToggle}
          >
            <Text style={styles.detailsToggleText}>
              {showDetails ? 'Ukryj szczegóły' : 'Szczegóły'}
            </Text>
          </Pressable>
          {showDetails ? <Text style={styles.details}>{error.details}</Text> : null}
          <Button title="Spróbuj ponownie" variant="secondary" onPress={submit} />
        </Card>
      ) : null}

      {result?.kind === 'video' && addedVideo ? (
        <View style={styles.result}>
          {channelBlocked ? (
            <Text style={styles.blockedWarning}>
              Kanał tego filmu jest zablokowany — film jest w bibliotece, ale dziecko go nie
              widzi. Cofnij zgodę, żeby wycofać dodanie.
            </Text>
          ) : null}
          <VideoRow video={addedVideo} onSetStatus={onSetStatus} onPreview={onPreview} />
        </View>
      ) : null}

      {result?.kind === 'channel' && addedChannel ? (
        <View style={styles.result}>
          <ChannelDetails
            channel={addedChannel}
            videos={videos.filter(video => video.channelId === addedChannel.id)}
            onSelectPolicy={onSelectPolicy}
            onToggleMuted={onToggleMuted}
            onBlock={onToggleBlocked}
            onBlockAllVideos={onBlockAllVideos}
          />
        </View>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: spacing.lg, paddingBottom: spacing.xl * 2, gap: spacing.md },
  card: { gap: spacing.md },
  hint: { color: colors.textMuted, fontSize: 13, lineHeight: 19 },
  error: { color: colors.danger, fontSize: 14, lineHeight: 20 },
  detailsToggle: { paddingVertical: spacing.xs },
  detailsToggleText: { color: colors.primary, fontSize: 13, fontWeight: '700' },
  details: {
    color: colors.textMuted,
    fontSize: 12,
    lineHeight: 18,
    backgroundColor: colors.cardAlt,
    borderRadius: 8,
    padding: spacing.sm,
  },
  result: { gap: spacing.sm },
  blockedWarning: { color: colors.danger, fontSize: 13, lineHeight: 19, fontWeight: '700' },
});
