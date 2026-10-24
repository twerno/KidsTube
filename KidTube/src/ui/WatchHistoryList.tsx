/**
 * Viewing history grouped by day (ADR 0004a), shared by both worlds.
 *
 * The child sees thumbnails and can open a still-available film in the player.
 * The parent panel uses the same data as a plain read-only text list (no
 * thumbnails, no playback). A child material shows where the child is in the
 * film next to the day's session time (`12m / 1h:40m · Sesja 25m`); the parent
 * sees only the session time. A day header shows only the day's total.
 */

import React, { useMemo } from 'react';
import { Image, Pressable, SectionList, StyleSheet, Text, View } from 'react-native';
import { colors, radius, spacing } from './theme';
import { entryTotalSeconds, groupWatchHistory } from '../domain/watchHistory';
import { formatCompactDuration, formatDurationRatio } from '../domain/duration';
import { formatHistoryDay } from '../domain/watchHistoryView';
import type { WatchHistoryEntry, WatchProgress } from '../domain/types';

export function WatchHistoryList({
  entries,
  showThumbnails,
  watchProgress,
  onPlayEntry,
  emptyText,
}: {
  entries: WatchHistoryEntry[];
  showThumbnails: boolean;
  /** Distances cached from actual playback, keyed by video id. */
  watchProgress?: WatchProgress[];
  /** Child only: open a still-available material in the player. */
  onPlayEntry?: (entry: WatchHistoryEntry) => void;
  emptyText: string;
}) {
  const sections = useMemo(
    () =>
      groupWatchHistory(entries).map(day => ({
        ...day,
        data: day.entries,
      })),
    [entries],
  );
  const progressByVideoId = useMemo(
    () => new Map((watchProgress ?? []).map(progress => [progress.videoId, progress])),
    [watchProgress],
  );

  return (
    <SectionList
      sections={sections}
      keyExtractor={item => `${item.dateKey}:${item.videoId}`}
      contentContainerStyle={entries.length === 0 ? styles.emptyContainer : styles.content}
      removeClippedSubviews={false}
      stickySectionHeadersEnabled={false}
      ListEmptyComponent={<Text style={styles.empty}>{emptyText}</Text>}
      renderSectionHeader={({ section }) => (
        <View style={styles.dayHeader}>
          <Text style={styles.dayTitle}>{formatHistoryDay(section.dateKey)}</Text>
          <Text style={styles.dayTotal}>
            Łącznie {formatCompactDuration(section.totalSeconds)}
          </Text>
        </View>
      )}
      renderItem={({ item }) =>
        showThumbnails ? (
          <ChildHistoryRow
            entry={item}
            progress={progressByVideoId.get(item.videoId)}
            onPress={onPlayEntry ? () => onPlayEntry(item) : undefined}
          />
        ) : (
          <ParentHistoryRow entry={item} />
        )
      }
    />
  );
}

function ChildHistoryRow({
  entry,
  progress,
  onPress,
}: {
  entry: WatchHistoryEntry;
  progress?: WatchProgress;
  onPress?: () => void;
}) {
  const session = `Sesja ${formatCompactDuration(entryTotalSeconds(entry))}`;
  const position = progress
    ? progress.completed
      ? 'W całości'
      : formatDurationRatio(progress.positionSeconds, progress.durationSeconds)
    : undefined;
  const timeLabel = position ? `${position} · ${session}` : session;
  const content = (
    <View style={styles.childRow}>
      {entry.thumbnailUrl ? (
        <Image source={{ uri: entry.thumbnailUrl }} style={styles.thumb} />
      ) : (
        <View style={[styles.thumb, styles.thumbEmpty]} />
      )}
      <View style={styles.entryText}>
        <Text numberOfLines={2} style={styles.entryTitle}>
          {entry.title}
        </Text>
        {entry.channelTitle ? (
          <Text numberOfLines={1} style={styles.entryChannel}>
            {entry.channelTitle}
          </Text>
        ) : null}
        <Text style={styles.entryTime}>{timeLabel}</Text>
      </View>
    </View>
  );

  if (!onPress) {
    return content;
  }
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={entry.title}
      onPress={onPress}
      style={({ pressed }) => (pressed ? styles.rowPressed : undefined)}
    >
      {content}
    </Pressable>
  );
}

function ParentHistoryRow({ entry }: { entry: WatchHistoryEntry }) {
  return (
    <View style={styles.parentRow}>
      <View style={styles.entryText}>
        <Text numberOfLines={2} style={styles.entryTitle}>
          {entry.title}
        </Text>
        {entry.channelTitle ? (
          <Text numberOfLines={1} style={styles.entryChannel}>
            {entry.channelTitle}
          </Text>
        ) : null}
      </View>
      <Text style={styles.entryTime}>
        Sesja {formatCompactDuration(entryTotalSeconds(entry))}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  content: { padding: spacing.lg, paddingBottom: spacing.xl * 2 },
  emptyContainer: { flexGrow: 1, justifyContent: 'center', padding: spacing.xl },
  empty: { color: colors.textMuted, textAlign: 'center', fontSize: 15, lineHeight: 22 },
  dayHeader: {
    paddingTop: spacing.lg,
    paddingBottom: spacing.sm,
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  dayTitle: { color: colors.text, fontSize: 18, fontWeight: '800' },
  dayTotal: { color: colors.textMuted, fontSize: 13, fontWeight: '700' },
  childRow: {
    flexDirection: 'row',
    gap: spacing.md,
    backgroundColor: colors.card,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  parentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.card,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  rowPressed: { opacity: 0.85 },
  thumb: { width: 104, height: 58, borderRadius: radius.sm, backgroundColor: colors.cardAlt },
  thumbEmpty: { borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border },
  entryText: { flex: 1, gap: 2 },
  entryTitle: { color: colors.text, fontSize: 15, fontWeight: '600' },
  entryChannel: { color: colors.textMuted, fontSize: 13 },
  entryTime: { color: colors.text, fontSize: 13, fontWeight: '700', marginTop: 2 },
});
