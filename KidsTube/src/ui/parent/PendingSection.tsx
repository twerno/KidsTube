import React, { useEffect, useMemo, useState } from 'react';
import { FlatList, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { Button, Card } from '../components';
import { Chip } from './Chip';
import { ChannelBar, type ChannelBarEntry } from './ChannelBar';
import { EmptyState } from './EmptyState';
import { VideoRow } from './VideoRow';
import { colors, spacing } from '../theme';
import {
  channelBarEntries,
  countBySource,
  filterVideos,
  matchesSource,
  normalizeChannelFilter,
  pendingVideos,
  type SourceFilter,
} from '../../domain/panel';
import type { Channel, ChannelProposal, Video, VideoStatus } from '../../domain/types';

const SOURCE_CHIPS: { key: SourceFilter; label: string }[] = [
  { key: 'all', label: 'Wszystkie' },
  { key: 'rss', label: 'Z kanału' },
  { key: 'child', label: 'Od dziecka' },
  { key: 'link', label: 'Z linku' },
];

const ALL_ENTRY = '__all__';

function ChannelProposalCard({
  proposal,
  onApprove,
  onReject,
  onRetry,
}: {
  proposal: ChannelProposal;
  onApprove: (proposal: ChannelProposal) => void;
  onReject: (proposal: ChannelProposal) => void;
  onRetry: (proposal: ChannelProposal) => void;
}) {
  const resolved = !!proposal.channelId && proposal.resolved;
  return (
    <Card style={styles.channelCard}>
      <Text style={styles.eyebrow}>propozycja kanału</Text>
      <Text numberOfLines={2} style={styles.channelTitle}>
        {proposal.title}
      </Text>
      <Text numberOfLines={1} style={styles.channelSubtitle}>
        {proposal.handle ? `@${proposal.handle}` : proposal.rawUrl}
      </Text>
      {!resolved ? (
        <Text style={styles.warning}>
          Nie udało się rozpoznać kanału. Spróbuj ponownie albo odrzuć propozycję.
        </Text>
      ) : null}
      <View style={styles.rowActions}>
        {resolved ? (
          <Button compact title="Dodaj kanał" onPress={() => onApprove(proposal)} />
        ) : (
          <Button compact title="Spróbuj ponownie" variant="secondary" onPress={() => onRetry(proposal)} />
        )}
        <Button compact title="Odrzuć" variant="secondary" onPress={() => onReject(proposal)} />
      </View>
    </Card>
  );
}

export interface PendingSectionProps {
  /** Projected videos: the panel reads the same projection as the child world. */
  videos: Video[];
  channels: Channel[];
  proposals: ChannelProposal[];
  refreshing: boolean;
  onRefresh: () => void;
  onSetStatus: (video: Video, status: VideoStatus) => void;
  onPreview: (video: Video) => void;
  onApproveChannel: (proposal: ChannelProposal) => void;
  onRejectChannel: (proposal: ChannelProposal) => void;
  onRetryChannel: (proposal: ChannelProposal) => void;
}

/** “Do zatwierdzenia”: two filter levels, faceted counts (ADR 0016). */
export function PendingSection({
  videos,
  channels,
  proposals,
  refreshing,
  onRefresh,
  onSetStatus,
  onPreview,
  onApproveChannel,
  onRejectChannel,
  onRetryChannel,
}: PendingSectionProps) {
  const [source, setSource] = useState<SourceFilter>('all');
  const [channelKey, setChannelKey] = useState<string | null>(null);

  const queue = useMemo(
    () => pendingVideos(videos, channels),
    [videos, channels],
  );

  const bars = useMemo(
    () => channelBarEntries(queue.filter(video => matchesSource(video, source)), channels),
    [queue, channels, source],
  );

  const activeChannel = normalizeChannelFilter(bars, channelKey);

  useEffect(() => {
    if (activeChannel !== channelKey) {
      setChannelKey(activeChannel);
    }
  }, [activeChannel, channelKey]);

  const counts = useMemo(() => countBySource(queue, activeChannel), [queue, activeChannel]);

  const visible = useMemo(
    () => filterVideos(queue, source, activeChannel),
    [queue, source, activeChannel],
  );

  const barEntries = useMemo<ChannelBarEntry[]>(() => {
    const scoped = queue.filter(video => matchesSource(video, source));
    return [
      { key: ALL_ENTRY, title: 'Wszystkie', count: scoped.length, observed: true, isAll: true },
      ...bars,
    ];
  }, [bars, queue, source]);

  const emptyText =
    queue.length === 0 && proposals.length === 0
      ? 'Nic nie czeka na decyzję.'
      : 'Brak filmów w tym filtrze.';

  const header = (
    <View style={styles.header}>
      <View style={styles.chips}>
        {SOURCE_CHIPS.map(chip => (
          <Chip
            key={chip.key}
            label={`${chip.label} (${counts[chip.key]})`}
            active={source === chip.key}
            onPress={() => setSource(chip.key)}
          />
        ))}
      </View>

      {barEntries.length > 1 ? (
        <ChannelBar entries={barEntries} selected={activeChannel} onSelect={setChannelKey} />
      ) : null}

      {proposals.length > 0 ? (
        <View style={styles.proposalGroup}>
          <Text style={styles.sectionTitle}>Kanały ({proposals.length})</Text>
          {proposals.map(proposal => (
            <ChannelProposalCard
              key={proposal.id}
              proposal={proposal}
              onApprove={onApproveChannel}
              onReject={onRejectChannel}
              onRetry={onRetryChannel}
            />
          ))}
        </View>
      ) : null}
    </View>
  );

  return (
    <FlatList
      showsVerticalScrollIndicator
      persistentScrollbar
      data={visible}
      keyExtractor={item => item.id}
      contentContainerStyle={styles.content}
      removeClippedSubviews={false}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />
      }
      ListHeaderComponent={header}
      ListEmptyComponent={<EmptyState>{emptyText}</EmptyState>}
      renderItem={({ item }: { item: Video }) => (
        <View style={styles.entry}>
          <VideoRow video={item} onSetStatus={onSetStatus} onPreview={onPreview} />
        </View>
      )}
    />
  );
}

const styles = StyleSheet.create({
  content: { padding: spacing.lg, paddingBottom: spacing.xl * 2 },
  header: { gap: spacing.md, marginBottom: spacing.sm },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, paddingVertical: spacing.xs },
  entry: { gap: spacing.xs },
  eyebrow: { color: colors.textMuted, fontSize: 12, fontWeight: '700' },
  proposalGroup: { gap: spacing.sm },
  sectionTitle: { color: colors.text, fontSize: 16, fontWeight: '800' },
  channelCard: { gap: spacing.xs },
  channelTitle: { color: colors.text, fontSize: 15, fontWeight: '700' },
  channelSubtitle: { color: colors.textMuted, fontSize: 12 },
  warning: { color: colors.warning, fontSize: 13, lineHeight: 18 },
  rowActions: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.xs, flexWrap: 'wrap' },
});
