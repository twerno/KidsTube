/**
 * The child's feed as a grid of large thumbnails (ADR 0004a / 0020). The same
 * grid is reused for a channel detail view and “Kontynuuj oglądanie”.
 *
 * Feed and channel group films into publication-date bands (this week / this
 * month / previous month / older), so a long library gives a sense of how old
 * the material is. “Kontynuuj oglądanie” groups by the day of the last playback
 * instead (ADR 0023) — there the interesting date is when the child watched,
 * not when the film was uploaded. A persistent scrollbar marks the position.
 */

import React, { useMemo } from 'react';
import {
  Image,
  Pressable,
  RefreshControl,
  SectionList,
  StyleSheet,
  type SectionListRenderItemInfo,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import { WatchBadge } from '../components';
import { colors, radius, spacing } from '../theme';
import { formatPublishedDate } from '../../domain/dates';
import { groupVideosByDate, groupVideosByLastWatched } from '../../domain/videoGroups';
import type { Video, WatchProgress } from '../../domain/types';

interface GridRow {
  key: string;
  videos: Video[];
}

/** How the list is split into bands above the rows. */
export type VideoGridGrouping = 'publicationDate' | 'lastWatched' | 'none';

interface GridSection {
  key: string;
  title: string;
  data: GridRow[];
}

function rowsOf(videos: Video[]): GridRow[] {
  const rows: GridRow[] = [];
  for (let index = 0; index < videos.length; index += 2) {
    const pair = videos.slice(index, index + 2);
    rows.push({ key: pair.map(video => video.id).join(':'), videos: pair });
  }
  return rows;
}

export function VideoGrid({
  videos,
  watchProgress,
  onPlay,
  refreshing,
  onRefresh,
  emptyText,
  groupBy = 'publicationDate',
}: {
  videos: Video[];
  watchProgress?: WatchProgress[];
  onPlay: (video: Video) => void;
  refreshing?: boolean;
  onRefresh?: () => void;
  emptyText: string;
  /** Which dates the bands follow (ADR 0020 / 0023). */
  groupBy?: VideoGridGrouping;
}) {
  const { width } = useWindowDimensions();
  const progressByVideoId = useMemo(
    () => new Map((watchProgress ?? []).map(progress => [progress.videoId, progress])),
    [watchProgress],
  );
  const tileWidth = Math.max(120, Math.floor((width - spacing.lg * 2 - spacing.md) / 2));

  const sections = useMemo((): GridSection[] => {
    if (groupBy === 'none') {
      return [{ key: 'all', title: '', data: rowsOf(videos) }];
    }
    const groups =
      groupBy === 'lastWatched'
        ? groupVideosByLastWatched(videos, watchProgress ?? [])
        : groupVideosByDate(videos);
    return groups.map(group => ({
      key: group.key,
      title: group.title,
      data: rowsOf(group.videos),
    }));
  }, [videos, watchProgress, groupBy]);

  return (
    <SectionList
      sections={sections}
      keyExtractor={item => item.key}
      contentContainerStyle={videos.length === 0 ? styles.emptyContainer : styles.content}
      stickySectionHeadersEnabled={false}
      // Android defaults `removeClippedSubviews` to true, which makes long
      // lists jump back to the top; keep it off.
      removeClippedSubviews={false}
      // A persistent scrollbar makes the list length and position visible.
      showsVerticalScrollIndicator
      persistentScrollbar
      refreshControl={
        onRefresh ? <RefreshControl refreshing={!!refreshing} onRefresh={onRefresh} /> : undefined
      }
      ListEmptyComponent={<Text style={styles.empty}>{emptyText}</Text>}
      renderSectionHeader={({ section }: { section: GridSection }) =>
        section.title ? <Text style={styles.sectionTitle}>{section.title}</Text> : null
      }
      renderItem={({ item }: SectionListRenderItemInfo<GridRow>) => (
        <View style={styles.gridRow}>
          {item.videos.map((video: Video) => (
            <Pressable
              key={video.id}
              accessibilityRole="button"
              accessibilityLabel={video.title}
              onPress={() => onPlay(video)}
              style={({ pressed }) => [
                styles.tile,
                { width: tileWidth },
                pressed && styles.tilePressed,
              ]}
            >
              <View style={styles.thumbWrap}>
                {video.thumbnailUrl ? (
                  <Image source={{ uri: video.thumbnailUrl }} style={styles.thumb} />
                ) : (
                  <View style={[styles.thumb, styles.thumbEmpty]} />
                )}
                <WatchBadge
                  progress={progressByVideoId.get(video.id)}
                  style={styles.thumbBadge}
                />
              </View>
              <Text numberOfLines={2} style={styles.title}>
                {video.title}
              </Text>
              {video.channelTitle ? (
                <Text numberOfLines={1} style={styles.channel}>
                  {video.channelTitle}
                </Text>
              ) : null}
              {video.publishedAt ? (
                <Text style={styles.date}>{formatPublishedDate(video.publishedAt)}</Text>
              ) : null}
            </Pressable>
          ))}
        </View>
      )}
    />
  );
}

const styles = StyleSheet.create({
  content: { padding: spacing.lg, paddingBottom: spacing.xl },
  emptyContainer: { flexGrow: 1, justifyContent: 'center', padding: spacing.xl },
  empty: { color: colors.textMuted, textAlign: 'center', fontSize: 15, lineHeight: 22 },
  sectionTitle: {
    color: colors.textMuted,
    fontSize: 13,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    paddingTop: spacing.sm,
    paddingBottom: spacing.sm,
  },
  gridRow: { flexDirection: 'row', gap: spacing.md, marginBottom: spacing.lg },
  tile: { gap: spacing.xs },
  tilePressed: { opacity: 0.85 },
  thumbWrap: { width: '100%', borderRadius: radius.md, overflow: 'hidden' },
  thumb: { width: '100%', aspectRatio: 16 / 9, backgroundColor: colors.cardAlt },
  thumbEmpty: { borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border },
  thumbBadge: { position: 'absolute', left: spacing.xs, bottom: spacing.xs },
  title: { color: colors.text, fontSize: 15, fontWeight: '700', lineHeight: 19 },
  channel: { color: colors.textMuted, fontSize: 13 },
  date: { color: colors.textMuted, fontSize: 12 },
});
