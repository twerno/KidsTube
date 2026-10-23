import React, { useMemo, useState } from 'react';
import { FlatList, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Field } from '../components';
import { Chip } from './Chip';
import { ChannelBar, type ChannelBarEntry } from './ChannelBar';
import { VideoRow } from './VideoRow';
import { colors, spacing } from '../theme';
import type { Channel, Video, VideoStatus } from '../../domain/types';

type StatusFilter = 'all' | VideoStatus;

const STATUS_FILTERS: { key: StatusFilter; label: string }[] = [
  { key: 'all', label: 'Wszystkie' },
  { key: 'allowed', label: 'Dozwolone' },
  { key: 'pending', label: 'Oczekujące' },
  { key: 'blocked', label: 'Zablokowane' },
];

export function VideosTab({
  videos,
  channels = [],
  onSetStatus,
  onPreview,
}: {
  videos: Video[];
  channels?: Channel[];
  onSetStatus: (video: Video, status: VideoStatus) => void;
  onPreview?: (video: Video) => void;
}) {
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState<StatusFilter>('all');
  // Horizontal channel-icon bar selects one channel; tapping it again clears
  // the filter (no separate “all channels” chip — ADR 0005).
  const [channel, setChannel] = useState<string | null>(null);

  // One icon per channel that actually has videos; the avatar is looked up in
  // the watched channels (placeholder circle while avatars are missing). Each
  // entry carries the channel's film count.
  const channelEntries = useMemo<ChannelBarEntry[]>(() => {
    const counts = new Map<string, number>();
    const match = new Map<string, Channel | undefined>();
    videos.forEach(v => {
      const title = v.channelTitle;
      if (!title) {
        return;
      }
      counts.set(title, (counts.get(title) ?? 0) + 1);
      if (!match.has(title)) {
        match.set(
          title,
          channels.find(c => c.id === v.channelId || c.title === title),
        );
      }
    });
    return [...counts.entries()]
      .map(([title, count]) => ({
        key: title,
        title,
        thumbnailUrl: match.get(title)?.thumbnailUrl,
        count,
      }))
      .sort((a, b) => a.title.localeCompare(b.title));
  }, [videos, channels]);

  // The bar always leads with “Wszystkie” when there is anything to filter.
  const barEntries = useMemo<ChannelBarEntry[]>(() => {
    if (channelEntries.length === 0) {
      return [];
    }
    return [
      { key: '__all__', title: 'Wszystkie', count: videos.length, isAll: true },
      ...channelEntries,
    ];
  }, [channelEntries, videos.length]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return videos
      .filter(v => {
        if (status !== 'all' && v.status !== status) {
          return false;
        }
        if (channel !== null && v.channelTitle !== channel) {
          return false;
        }
        if (q && !`${v.title} ${v.channelTitle ?? ''}`.toLowerCase().includes(q)) {
          return false;
        }
        return true;
      })
      .sort((a, b) => (b.publishedAt ?? b.addedAt) - (a.publishedAt ?? a.addedAt));
  }, [videos, query, status, channel]);

  // Counts for the status chips, scoped to the selected channel (the search box
  // does not move them, so the chips stay stable while typing).
  const statusCounts = useMemo<Record<StatusFilter, number>>(() => {
    const counts: Record<StatusFilter, number> = {
      all: 0,
      allowed: 0,
      pending: 0,
      blocked: 0,
    };
    videos.forEach(v => {
      if (channel !== null && v.channelTitle !== channel) {
        return;
      }
      counts.all += 1;
      counts[v.status] += 1;
    });
    return counts;
  }, [videos, channel]);

  return (
    <View style={styles.container}>
      {barEntries.length > 0 ? (
        <View style={styles.channelBar}>
          <ChannelBar entries={barEntries} selected={channel} onSelect={setChannel} />
        </View>
      ) : null}

      <View style={styles.filters}>
        <Field
          value={query}
          onChangeText={setQuery}
          placeholder="Szukaj po tytule lub kanale…"
          autoCorrect={false}
        />

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
          {STATUS_FILTERS.map(f => (
            <Chip
              key={f.key}
              label={`${f.label} (${statusCounts[f.key]})`}
              active={status === f.key}
              onPress={() => setStatus(f.key)}
            />
          ))}
        </ScrollView>

        <View style={styles.summaryRow}>
          <Text style={styles.summary}>
            {filtered.length} {filtered.length === 1 ? 'film' : 'filmów'}
            {channel !== null ? ` · ${channel}` : ''}
          </Text>
        </View>
      </View>

      <FlatList
        data={filtered}
        keyExtractor={item => item.id}
        contentContainerStyle={styles.listContent}
        initialNumToRender={12}
        windowSize={11}
        removeClippedSubviews={false}
        maintainVisibleContentPosition={{ minIndexForVisible: 0 }}
        ListEmptyComponent={<Text style={styles.empty}>Brak filmów dla wybranych filtrów.</Text>}
        renderItem={({ item }) => (
          <VideoRow video={item} onSetStatus={onSetStatus} onPreview={onPreview} />
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  channelBar: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  filters: { paddingHorizontal: spacing.lg, paddingTop: spacing.md, gap: spacing.sm },
  chips: { gap: spacing.sm, paddingVertical: spacing.xs },
  summaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  summary: { color: colors.textMuted, fontSize: 13 },
  listContent: { paddingHorizontal: spacing.lg, paddingTop: spacing.sm, paddingBottom: spacing.xl * 2 },
  empty: { color: colors.textMuted, textAlign: 'center', marginTop: spacing.xl, fontSize: 15 },
});
