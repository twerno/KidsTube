import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { ChannelDetails } from './ChannelCard';
import { EmptyState } from './EmptyState';
import { VideoRow } from './VideoRow';
import { colors, spacing } from '../theme';
import { blockedChannels, isBlockedChannelVideo, videosForChannel } from '../../domain/panel';
import type { Channel, Decision, Video, VideoStatus } from '../../domain/types';

export interface BlockedSectionProps {
  videos: Video[];
  channels: Channel[];
  decisions: Decision[];
  onPreview: (video: Video) => void;
  onSetStatus: (video: Video, status: VideoStatus) => void;
  onToggleBlocked: (channel: Channel) => void;
}

/**
 * “Zablokowane”: a pure archive (ADR 0016). Blocked channels sit with their
 * films — the channel is restored with “Odblokuj” — while films rejected by a
 * decision keep their own “Przywróć”. No counter: this is not a queue.
 */
export function BlockedSection({
  videos,
  channels,
  decisions,
  onPreview,
  onSetStatus,
  onToggleBlocked,
}: BlockedSectionProps) {
  const blocked = blockedChannels(channels);
  const rejected = videos.filter(
    video => video.status === 'blocked' && !isBlockedChannelVideo(video, channels, decisions),
  );
  const isEmpty = blocked.length === 0 && rejected.length === 0;

  return (
    <ScrollView showsVerticalScrollIndicator persistentScrollbar contentContainerStyle={styles.content}>
      {isEmpty ? (
        <EmptyState>Nic nie zostało zablokowane ani odrzucone.</EmptyState>
      ) : null}

      {blocked.map(channel => {
        const films = videosForChannel(videos, channel.id).filter(video =>
          isBlockedChannelVideo(video, channels, decisions),
        );
        return (
          <View key={channel.id} style={styles.group}>
            <ChannelDetails
              channel={channel}
              videos={films}
              onBlock={onToggleBlocked}
              showManage={false}
            />
            <Text style={styles.blockedNote}>
              Kanał zablokowany. Możesz zezwolić na pojedynczy film — bez odblokowywania kanału.
            </Text>
            {films.map(video => (
              <VideoRow
                key={video.id}
                video={video}
                onPreview={onPreview}
                onSetStatus={video.status === 'allowed' ? undefined : onSetStatus}
                statusLabel="wstrzymany"
                statusColor={colors.warning}
                showActions={video.status !== 'allowed'}
              />
            ))}
          </View>
        );
      })}

      {rejected.length > 0 ? (
        <View style={styles.group}>
          {blocked.length > 0 ? (
            <Text style={styles.sectionTitle}>Filmy zablokowane decyzją</Text>
          ) : null}
          {rejected.map(video => (
            <VideoRow key={video.id} video={video} onSetStatus={onSetStatus} onPreview={onPreview} />
          ))}
        </View>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: spacing.lg, paddingBottom: spacing.xl * 2 },
  group: { gap: spacing.sm, marginBottom: spacing.lg },
  sectionTitle: { color: colors.text, fontSize: 16, fontWeight: '800' },
  blockedNote: { color: colors.textMuted, fontSize: 12, lineHeight: 17 },
});
