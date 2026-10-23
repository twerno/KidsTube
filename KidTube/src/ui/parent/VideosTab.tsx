import React, { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, SectionList, StyleSheet, Text, View } from 'react-native';
import { Field } from '../components';
import { Chip } from './Chip';
import { VideoRow } from './VideoRow';
import { colors, spacing } from '../theme';
import type { Video, VideoStatus } from '../../domain/types';

type StatusFilter = 'all' | VideoStatus;

const STATUS_FILTERS: { key: StatusFilter; label: string }[] = [
  { key: 'all', label: 'Wszystkie' },
  { key: 'allowed', label: 'Dozwolone' },
  { key: 'pending', label: 'Oczekujące' },
  { key: 'blocked', label: 'Zablokowane' },
];

interface Section {
  title: string;
  data: Video[];
  /** Full size of the channel group (data is emptied when collapsed). */
  count: number;
}

export function VideosTab({
  videos,
  onSetStatus,
}: {
  videos: Video[];
  onSetStatus: (video: Video, status: VideoStatus) => void;
}) {
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState<StatusFilter>('all');
  const [channel, setChannel] = useState<string>('all');
  const [grouped, setGrouped] = useState(true);
  // Accordion: exactly one channel group is expanded at a time (ADR 0005).
  const [openChannel, setOpenChannel] = useState<string | null>(null);

  const channelNames = useMemo(() => {
    const names = new Set<string>();
    videos.forEach(v => {
      if (v.channelTitle) {
        names.add(v.channelTitle);
      }
    });
    return [...names].sort((a, b) => a.localeCompare(b));
  }, [videos]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return videos.filter(v => {
      if (status !== 'all' && v.status !== status) {
        return false;
      }
      if (channel !== 'all' && v.channelTitle !== channel) {
        return false;
      }
      if (q && !`${v.title} ${v.channelTitle ?? ''}`.toLowerCase().includes(q)) {
        return false;
      }
      return true;
    });
  }, [videos, query, status, channel]);

  const sections = useMemo<Section[]>(() => {
    const sorted = [...filtered].sort((a, b) =>
      (b.publishedAt ?? b.addedAt) - (a.publishedAt ?? a.addedAt),
    );
    if (!grouped) {
      return [{ title: '', data: sorted, count: sorted.length }];
    }
    const byChannel = new Map<string, Video[]>();
    sorted.forEach(v => {
      const key = v.channelTitle ?? 'Bez kanału';
      const list = byChannel.get(key) ?? [];
      list.push(v);
      byChannel.set(key, list);
    });
    return [...byChannel.entries()]
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([title, data]) => ({
        title,
        data: openChannel === title ? data : [],
        count: data.length,
      }));
  }, [filtered, grouped, openChannel]);

  // Keep exactly one group open (default: the first) whenever the grouping is on.
  useEffect(() => {
    if (!grouped) {
      return;
    }
    const titles = sections.map(s => s.title);
    if (titles.length > 0 && (!openChannel || !titles.includes(openChannel))) {
      setOpenChannel(titles[0]);
    }
  }, [grouped, sections, openChannel]);

  return (
    <View style={styles.container}>
      <View style={styles.filters}>
        <Field
          value={query}
          onChangeText={setQuery}
          placeholder="Szukaj po tytule lub kanale…"
          autoCorrect={false}
        />

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
          {STATUS_FILTERS.map(f => (
            <Chip key={f.key} label={f.label} active={status === f.key} onPress={() => setStatus(f.key)} />
          ))}
        </ScrollView>

        {channelNames.length > 1 ? (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
            <Chip label="Wszystkie kanały" active={channel === 'all'} onPress={() => setChannel('all')} />
            {channelNames.map(name => (
              <Chip key={name} label={name} active={channel === name} onPress={() => setChannel(name)} />
            ))}
          </ScrollView>
        ) : null}

        <View style={styles.summaryRow}>
          <Text style={styles.summary}>
            {filtered.length} {filtered.length === 1 ? 'film' : 'filmów'}
          </Text>
          <Chip label="Grupuj po kanale" active={grouped} onPress={() => setGrouped(g => !g)} />
        </View>
      </View>

      <SectionList
        sections={sections}
        keyExtractor={item => item.id}
        stickySectionHeadersEnabled={false}
        contentContainerStyle={styles.listContent}
        initialNumToRender={12}
        windowSize={11}
        removeClippedSubviews
        ListEmptyComponent={<Text style={styles.empty}>Brak filmów dla wybranych filtrów.</Text>}
        renderSectionHeader={({ section }) =>
          section.title ? (
            <Pressable
              accessibilityRole="button"
              onPress={() => setOpenChannel(section.title)}
              style={styles.sectionHeader}
            >
              <Text style={styles.sectionTitle}>
                {section.title} ({section.count})
              </Text>
              <Text style={styles.sectionChevron}>
                {openChannel === section.title ? '▾' : '▸'}
              </Text>
            </Pressable>
          ) : null
        }
        renderItem={({ item }) => <VideoRow video={item} onSetStatus={onSetStatus} />}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
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
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
    paddingVertical: spacing.sm,
    marginTop: spacing.md,
    marginBottom: spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  sectionTitle: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '700',
    flexShrink: 1,
  },
  sectionChevron: { color: colors.textMuted, fontSize: 16, fontWeight: '700' },
  empty: { color: colors.textMuted, textAlign: 'center', marginTop: spacing.xl, fontSize: 15 },
});
