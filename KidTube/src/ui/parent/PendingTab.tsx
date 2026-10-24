import React, { useMemo, useState } from 'react';
import { FlatList, StyleSheet, Text, View } from 'react-native';
import { Button, Card } from '../components';
import { VideoRow } from './VideoRow';
import { Chip } from './Chip';
import { colors, spacing } from '../theme';
import type { ChannelProposal, Video, VideoSource, VideoStatus } from '../../domain/types';

/** Where a pending entry came from — ADR 0001 distinguishes RSS scans from the child's proposals. */
export const SOURCE_LABEL: Record<VideoSource, string> = {
  rss: 'z kanału · RSS',
  propose: 'propozycja dziecka',
  share: 'propozycja (udostępnione)',
  manual: 'dodane ręcznie',
};

type SourceFilter = 'all' | 'rss' | 'child';

const isChildProposal = (v: Video) => v.source === 'propose' || v.source === 'share';

function ChannelProposalCard({
  proposal,
  onApprove,
  onReject,
  onRetry,
}: {
  proposal: ChannelProposal;
  onApprove?: (proposal: ChannelProposal) => void;
  onReject?: (proposal: ChannelProposal) => void;
  onRetry?: (proposal: ChannelProposal) => void;
}) {
  const approvedChannel = !!proposal.channelId && proposal.resolved;
  return (
    <Card style={styles.channelCard}>
      <Text style={styles.source}>udostępniony kanał</Text>
      <Text numberOfLines={2} style={styles.channelTitle}>
        {proposal.title}
      </Text>
      <Text numberOfLines={1} style={styles.channelSubtitle}>
        {proposal.handle ? `@${proposal.handle}` : proposal.rawUrl}
      </Text>
      {!approvedChannel ? (
        <Text style={styles.unresolved}>
          Nie udało się jeszcze rozpoznać kanału. Możesz spróbować ponownie albo odrzucić propozycję.
        </Text>
      ) : null}
      <View style={styles.actions}>
        {approvedChannel ? (
          <Button
            title="Dodaj kanał"
            compact
            onPress={() => onApprove?.(proposal)}
          />
        ) : (
          <Button
            title="Spróbuj ponownie"
            variant="secondary"
            compact
            onPress={() => onRetry?.(proposal)}
          />
        )}
        <Button
          title="Odrzuć"
          variant="ghost"
          compact
          onPress={() => onReject?.(proposal)}
        />
      </View>
    </Card>
  );
}

export function PendingTab({
  videos,
  channelProposals = [],
  onSetStatus,
  onPreview,
  onApproveChannelProposal,
  onRejectChannelProposal,
  onRetryChannelProposal,
}: {
  videos: Video[];
  channelProposals?: ChannelProposal[];
  onSetStatus: (video: Video, status: VideoStatus) => void;
  onPreview?: (video: Video) => void;
  onApproveChannelProposal?: (proposal: ChannelProposal) => void;
  onRejectChannelProposal?: (proposal: ChannelProposal) => void;
  onRetryChannelProposal?: (proposal: ChannelProposal) => void;
}) {
  const [filter, setFilter] = useState<SourceFilter>('all');

  const filtered = useMemo(() => {
    if (filter === 'rss') {
      return videos.filter(v => v.source === 'rss');
    }
    if (filter === 'child') {
      return videos.filter(isChildProposal);
    }
    return videos;
  }, [videos, filter]);

  const chips: { key: SourceFilter; label: string; count: number }[] = [
    { key: 'all', label: 'Wszystkie', count: videos.length },
    { key: 'rss', label: 'Z RSS', count: videos.filter(v => v.source === 'rss').length },
    { key: 'child', label: 'Propozycje dziecka', count: videos.filter(isChildProposal).length },
  ];

  const channelSection =
    channelProposals.length > 0 ? (
      <View style={styles.channelSection}>
        <Text style={styles.sectionTitle}>Kanały ({channelProposals.length})</Text>
        {channelProposals.map(proposal => (
          <ChannelProposalCard
            key={proposal.id}
            proposal={proposal}
            onApprove={onApproveChannelProposal}
            onReject={onRejectChannelProposal}
            onRetry={onRetryChannelProposal}
          />
        ))}
      </View>
    ) : null;

  return (
    <View style={styles.container}>
      <View style={styles.chips}>
        {chips.map(item => (
          <Chip
            key={item.key}
            label={`${item.label} (${item.count})`}
            active={filter === item.key}
            onPress={() => setFilter(item.key)}
          />
        ))}
      </View>

      <FlatList
        data={filtered}
        keyExtractor={item => item.id}
        contentContainerStyle={styles.content}
        removeClippedSubviews={false}
        maintainVisibleContentPosition={{ minIndexForVisible: 0 }}
        ListHeaderComponent={channelSection ?? undefined}
        ListEmptyComponent={
          <Text style={styles.empty}>
            {videos.length === 0
              ? channelProposals.length === 0
                ? 'Brak pozycji oczekujących na akceptację.'
                : 'Brak filmów oczekujących na akceptację.'
              : 'Brak filmów w tym filtrze.'}
          </Text>
        }
        renderItem={({ item }) => (
          <View style={styles.entry}>
            <Text style={styles.source}>{SOURCE_LABEL[item.source]}</Text>
            <VideoRow video={item} onSetStatus={onSetStatus} onPreview={onPreview} />
          </View>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  chips: { flexDirection: 'row', gap: spacing.sm, paddingHorizontal: spacing.lg, paddingBottom: spacing.sm },
  content: { padding: spacing.lg, paddingBottom: spacing.xl * 2 },
  empty: { color: colors.textMuted, textAlign: 'center', marginTop: spacing.xl, fontSize: 15 },
  entry: { gap: spacing.xs },
  source: { color: colors.textMuted, fontSize: 12, fontWeight: '700' },
  channelSection: { gap: spacing.sm, marginBottom: spacing.lg },
  sectionTitle: { color: colors.text, fontSize: 16, fontWeight: '800' },
  channelCard: { gap: spacing.xs },
  channelTitle: { color: colors.text, fontSize: 15, fontWeight: '700' },
  channelSubtitle: { color: colors.textMuted, fontSize: 12 },
  unresolved: { color: colors.warning, fontSize: 13, lineHeight: 18 },
  actions: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.xs, flexWrap: 'wrap' },
});
