import React, { useMemo, useState } from 'react';
import { FlatList, StyleSheet, Text, View } from 'react-native';
import { VideoRow } from './VideoRow';
import { Chip } from './Chip';
import { colors, spacing } from '../theme';
import type { Video, VideoSource, VideoStatus } from '../../domain/types';

/** Where a pending entry came from — ADR 0001 distinguishes RSS scans from the child's proposals. */
export const SOURCE_LABEL: Record<VideoSource, string> = {
  rss: 'z kanału · RSS',
  propose: 'propozycja dziecka',
  share: 'propozycja (udostępnione)',
  manual: 'dodane ręcznie',
};

type SourceFilter = 'all' | 'rss' | 'child';

const isChildProposal = (v: Video) => v.source === 'propose' || v.source === 'share';

export function PendingTab({
  videos,
  onSetStatus,
  onPreview,
}: {
  videos: Video[];
  onSetStatus: (video: Video, status: VideoStatus) => void;
  onPreview?: (video: Video) => void;
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
        ListEmptyComponent={
          <Text style={styles.empty}>
            {videos.length === 0
              ? 'Brak filmów oczekujących na akceptację.'
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
});