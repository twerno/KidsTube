/** Child's “Kanały” tab: channel avatars, names and film counts (ADR 0004a). */

import React from 'react';
import { FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { ChannelAvatar } from '../ChannelAvatar';
import { colors, radius, spacing } from '../theme';
import { filmsLabel } from '../../domain/plural';
import type { ChildChannelEntry } from '../../domain/content';
import type { Channel } from '../../domain/types';

export function ChannelsList({
  entries,
  onOpenChannel,
  refreshing,
  onRefresh,
}: {
  entries: ChildChannelEntry[];
  onOpenChannel: (channel: Channel) => void;
  refreshing?: boolean;
  onRefresh?: () => void;
}) {
  return (
    <FlatList
      showsVerticalScrollIndicator
      persistentScrollbar
      data={entries}
      keyExtractor={item => item.channel.id}
      contentContainerStyle={entries.length === 0 ? styles.emptyContainer : styles.content}
      removeClippedSubviews={false}
      refreshControl={
        onRefresh ? <RefreshControl refreshing={!!refreshing} onRefresh={onRefresh} /> : undefined
      }
      ListEmptyComponent={
        <Text style={styles.empty}>
          Brak kanałów z zatwierdzonymi filmami. Rodzic może dodać kanał w panelu.
        </Text>
      }
      renderItem={({ item }: { item: ChildChannelEntry }) => (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`${item.channel.title}, ${filmsLabel(item.videoCount)}`}
          onPress={() => onOpenChannel(item.channel)}
          style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
        >
          <ChannelAvatar
            title={item.channel.title}
            thumbnailUrl={item.channel.thumbnailUrl}
            size={56}
          />
          <View style={styles.text}>
            <Text numberOfLines={1} style={styles.title}>
              {item.channel.title}
            </Text>
            <Text style={styles.count}>{filmsLabel(item.videoCount)}</Text>
          </View>
          <Text style={styles.chevron}>›</Text>
        </Pressable>
      )}
    />
  );
}

const styles = StyleSheet.create({
  content: { padding: spacing.lg, gap: spacing.sm },
  emptyContainer: { flexGrow: 1, justifyContent: 'center', padding: spacing.xl },
  empty: { color: colors.textMuted, textAlign: 'center', fontSize: 15, lineHeight: 22 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.card,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    padding: spacing.md,
  },
  rowPressed: { opacity: 0.85 },
  text: { flex: 1, gap: 2 },
  title: { color: colors.text, fontSize: 16, fontWeight: '700' },
  count: { color: colors.textMuted, fontSize: 13 },
  chevron: { color: colors.textMuted, fontSize: 28, lineHeight: 28, paddingHorizontal: spacing.xs },
});
