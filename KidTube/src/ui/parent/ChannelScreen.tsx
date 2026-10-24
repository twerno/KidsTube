import React, { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { ChannelDetails } from './ChannelCard';
import { Chip } from './Chip';
import { EmptyState } from './EmptyState';
import { VideoRow } from './VideoRow';
import { colors, spacing } from '../theme';
import {
  DEFAULT_CHANNEL_STATUS_FILTER,
  channelStatusCounts,
  filterChannelVideos,
  type ChannelStatusFilter,
} from '../../domain/panel';
import type { Channel, Video, VideoStatus } from '../../domain/types';

export const CHANNEL_STATUS_CHIPS: {
  key: ChannelStatusFilter;
  label: string;
  empty: string;
}[] = [
  {
    key: 'accepted',
    label: 'Zaakceptowane',
    empty: 'Brak zaakceptowanych filmów w tym kanale.',
  },
  {
    key: 'rejected',
    label: 'Odrzucone',
    empty: 'Brak odrzuconych filmów w tym kanale.',
  },
  {
    key: 'pending',
    label: 'Oczekujące',
    empty: 'Brak oczekujących filmów w tym kanale.',
  },
];

export interface ChannelScreenProps {
  channel: Channel;
  /** All videos; the screen scopes them to this channel and status. */
  videos: Video[];
  onSetStatus: (video: Video, status: VideoStatus) => void;
  onPreview: (video: Video) => void;
  onTogglePolicy: (channel: Channel) => void;
  onToggleMuted: (channel: Channel) => void;
  onBlock: (channel: Channel) => void;
}

/**
 * Channel screen with three status chips (ADR 0018). There is deliberately no
 * “Wszystkie” chip: exactly one status is always visible.
 */
export function ChannelScreen({
  channel,
  videos,
  onSetStatus,
  onPreview,
  onTogglePolicy,
  onToggleMuted,
  onBlock,
}: ChannelScreenProps) {
  const [filter, setFilter] = useState<ChannelStatusFilter>(DEFAULT_CHANNEL_STATUS_FILTER);
  const counts = useMemo(
    () => channelStatusCounts(videos, channel.id),
    [videos, channel.id],
  );
  const films = useMemo(
    () => filterChannelVideos(videos, channel.id, filter),
    [videos, channel.id, filter],
  );
  const activeFilter = CHANNEL_STATUS_CHIPS.find(chip => chip.key === filter);
  const blockedChannel = channel.status === 'blocked';

  return (
    <ScrollView contentContainerStyle={styles.content}>
      <ChannelDetails
        channel={channel}
        videos={videos}
        onTogglePolicy={onTogglePolicy}
        onToggleMuted={onToggleMuted}
        onBlock={onBlock}
      />

      <View style={styles.chips}>
        {CHANNEL_STATUS_CHIPS.map(chip => (
          <Chip
            key={chip.key}
            compact
            style={styles.chip}
            label={`${chip.label} (${counts[chip.key]})`}
            active={filter === chip.key}
            onPress={() => setFilter(chip.key)}
          />
        ))}
      </View>

      {films.length === 0 ? (
        <EmptyState>{activeFilter?.empty ?? 'Brak filmów w tym filtrze.'}</EmptyState>
      ) : (
        films.map(video => (
          <VideoRow
            key={video.id}
            video={video}
            onSetStatus={blockedChannel ? undefined : onSetStatus}
            onPreview={onPreview}
            statusLabel={blockedChannel ? 'wstrzymany' : undefined}
            statusColor={blockedChannel ? colors.warning : undefined}
            showActions={!blockedChannel}
          />
        ))
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: spacing.lg, paddingBottom: spacing.xl * 2, gap: spacing.sm },
  chips: { flexDirection: 'row', gap: spacing.xs, paddingVertical: spacing.xs },
  chip: { flex: 1 },
});
