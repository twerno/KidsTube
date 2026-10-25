/**
 * The child's feed as a grid of large thumbnails (ADR 0004a). The same grid is
 * reused for a channel detail view, filtered to that channel's films.
 */

import React, { useMemo } from 'react';
import {
  FlatList,
  Image,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import { WatchBadge } from '../components';
import { colors, radius, spacing } from '../theme';
import { formatPublishedDate } from '../../domain/dates';
import type { Video, WatchProgress } from '../../domain/types';

export function VideoGrid({
  videos,
  watchProgress,
  onPlay,
  refreshing,
  onRefresh,
  emptyText,
}: {
  videos: Video[];
  watchProgress?: WatchProgress[];
  onPlay: (video: Video) => void;
  refreshing?: boolean;
  onRefresh?: () => void;
  emptyText: string;
}) {
  const { width } = useWindowDimensions();
  const progressByVideoId = useMemo(
    () => new Map((watchProgress ?? []).map(progress => [progress.videoId, progress])),
    [watchProgress],
  );
  const tileWidth = Math.max(
    120,
    Math.floor((width - spacing.lg * 2 - spacing.md) / 2),
  );

  return (
    <FlatList
      data={videos}
      keyExtractor={item => item.id}
      numColumns={2}
      columnWrapperStyle={styles.gridRow}
      contentContainerStyle={videos.length === 0 ? styles.emptyContainer : styles.content}
      // Android defaults `removeClippedSubviews` to true, which makes long
      // lists jump back to the top; keep it off and pin the visible row.
      removeClippedSubviews={false}
      maintainVisibleContentPosition={{ minIndexForVisible: 0 }}
      refreshControl={
        onRefresh ? <RefreshControl refreshing={!!refreshing} onRefresh={onRefresh} /> : undefined
      }
      ListEmptyComponent={<Text style={styles.empty}>{emptyText}</Text>}
      renderItem={({ item }) => (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={item.title}
          onPress={() => onPlay(item)}
          style={({ pressed }) => [
            styles.tile,
            { width: tileWidth },
            pressed && styles.tilePressed,
          ]}
        >
          <View style={styles.thumbWrap}>
            {item.thumbnailUrl ? (
              <Image source={{ uri: item.thumbnailUrl }} style={styles.thumb} />
            ) : (
              <View style={[styles.thumb, styles.thumbEmpty]} />
            )}
            <WatchBadge
              progress={progressByVideoId.get(item.id)}
              style={styles.thumbBadge}
            />
          </View>
          <Text numberOfLines={2} style={styles.title}>
            {item.title}
          </Text>
          {item.channelTitle ? (
            <Text numberOfLines={1} style={styles.channel}>
              {item.channelTitle}
            </Text>
          ) : null}
          {item.publishedAt ? (
            <Text style={styles.date}>{formatPublishedDate(item.publishedAt)}</Text>
          ) : null}
        </Pressable>
      )}
    />
  );
}

const styles = StyleSheet.create({
  content: { padding: spacing.lg, gap: spacing.lg },
  gridRow: { gap: spacing.md },
  emptyContainer: { flexGrow: 1, justifyContent: 'center', padding: spacing.xl },
  empty: { color: colors.textMuted, textAlign: 'center', fontSize: 15, lineHeight: 22 },
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
