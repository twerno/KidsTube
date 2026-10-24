import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { ChannelDetails } from './ChannelCard';
import { EmptyState } from './EmptyState';
import { VideoRow } from './VideoRow';
import { colors, spacing } from '../theme';
import { blockedChannels, isBlockedChannelVideo, videosForChannel } from '../../domain/panel';
import type { Channel, Video, VideoStatus } from '../../domain/types';

export interface BlockedSectionProps {
  videos: Video[];
  channels: Channel[];
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
  onPreview,
  onSetStatus,
  onToggleBlocked,
}: BlockedSectionProps) {
  const blocked = blockedChannels(channels);
  const rejected = videos.filter(
    video => video.status === 'blocked' && !isBlockedChannelVideo(video, channels),
  );
  const isEmpty = blocked.length === 0 && rejected.length === 0;

  return (
    <ScrollView contentContainerStyle={styles.content}>
      {isEmpty ? (
        <EmptyState>Nic nie zostało zablokowane ani odrzucone.</EmptyState>
      ) : null}

      {blocked.map(channel => {
        const films = videosForChannel(videos, channel.id);
        return (
          <View key={channel.id} style={styles.group}>
            <ChannelDetails
              channel={channel}
              videos={films}
              onBlock={onToggleBlocked}
              showManage={false}
            />
            {films.map(video => (
              <VideoRow
                key={video.id}
                video={video}
                onPreview={onPreview}
                statusLabel="wstrzymany"
                statusColor={colors.warning}
                showActions={false}
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
});
