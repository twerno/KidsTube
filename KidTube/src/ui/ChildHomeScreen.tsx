import React from 'react';
import {
  FlatList,
  Image,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { colors, radius, spacing } from './theme';
import { APP_VERSION } from '../version';
import type { Video } from '../domain/types';

export interface ChildHomeScreenProps {
  childName?: string;
  videos: Video[];
  refreshing?: boolean;
  onRefresh?: () => void;
  onPlay: (video: Video) => void;
  onOpenParent: () => void;
}

export function ChildHomeScreen({
  childName,
  videos,
  refreshing,
  onRefresh,
  onPlay,
  onOpenParent,
}: ChildHomeScreenProps) {
  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>{childName ? `Cześć, ${childName}!` : 'Twoje filmy'}</Text>
        <Pressable onPress={onOpenParent} hitSlop={12} style={styles.parentButton}>
          <Text style={styles.parentButtonText}>Panel rodzica</Text>
          <Text style={styles.versionText}>v{APP_VERSION}</Text>
        </Pressable>
      </View>

      <FlatList
        data={videos}
        keyExtractor={item => item.id}
        contentContainerStyle={videos.length === 0 ? styles.emptyContainer : styles.listContent}
        refreshControl={
          onRefresh ? <RefreshControl refreshing={!!refreshing} onRefresh={onRefresh} /> : undefined
        }
        ListEmptyComponent={
          <Text style={styles.empty}>
            Brak zatwierdzonych filmów. Rodzic może dodać kanał lub film w panelu.
          </Text>
        }
        renderItem={({ item }) => (
          <Pressable
            accessibilityRole="button"
            onPress={() => onPlay(item)}
            style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
          >
            <Image source={{ uri: item.thumbnailUrl }} style={styles.thumb} />
            <View style={styles.rowText}>
              <Text numberOfLines={2} style={styles.videoTitle}>
                {item.title}
              </Text>
              {item.channelTitle ? (
                <Text numberOfLines={1} style={styles.channel}>
                  {item.channelTitle}
                </Text>
              ) : null}
            </View>
          </Pressable>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.md,
  },
  title: { color: colors.text, fontSize: 24, fontWeight: '800' },
  parentButton: { paddingVertical: spacing.xs, paddingHorizontal: spacing.sm, alignItems: 'flex-end' },
  parentButtonText: { color: colors.textMuted, fontSize: 13 },
  versionText: { color: colors.textMuted, fontSize: 10, opacity: 0.7, marginTop: 2 },
  listContent: { padding: spacing.lg, gap: spacing.md },
  emptyContainer: { flexGrow: 1, justifyContent: 'center', padding: spacing.xl },
  empty: { color: colors.textMuted, textAlign: 'center', fontSize: 15, lineHeight: 22 },
  row: {
    flexDirection: 'row',
    backgroundColor: colors.card,
    borderRadius: radius.md,
    overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  rowPressed: { opacity: 0.85 },
  thumb: { width: 132, height: 74, backgroundColor: colors.cardAlt },
  rowText: { flex: 1, padding: spacing.md, justifyContent: 'center' },
  videoTitle: { color: colors.text, fontSize: 15, fontWeight: '600' },
  channel: { color: colors.textMuted, fontSize: 13, marginTop: spacing.xs },
});
