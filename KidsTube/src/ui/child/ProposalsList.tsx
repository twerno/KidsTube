/**
 * Child's “Do zatwierdzenia” tab: only the child's own pending proposals
 * (ADR 0001/0004). No watch-state badge — nothing here has been played.
 */

import React from 'react';
import { FlatList, Image, StyleSheet, Text, View } from 'react-native';
import { colors, radius, spacing } from '../theme';
import { formatPublishedDate } from '../../domain/dates';
import type { Video } from '../../domain/types';

export function ProposalsList({ proposals }: { proposals: Video[] }) {
  return (
    <FlatList
      data={proposals}
      keyExtractor={item => item.id}
      contentContainerStyle={proposals.length === 0 ? styles.emptyContainer : styles.content}
      removeClippedSubviews={false}
      maintainVisibleContentPosition={{ minIndexForVisible: 0 }}
      ListEmptyComponent={
        <Text style={styles.empty}>
          Brak oczekujących propozycji. Dotknij „Zaproponuj film" i wklej link z YouTube.
        </Text>
      }
      renderItem={({ item }) => (
        <View style={styles.row}>
          {item.thumbnailUrl ? (
            <Image source={{ uri: item.thumbnailUrl }} style={styles.thumb} />
          ) : (
            <View style={[styles.thumb, styles.thumbEmpty]} />
          )}
          <View style={styles.rowText}>
            <Text numberOfLines={2} style={styles.videoTitle}>
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
            <Text style={styles.pendingNote}>Czeka na decyzję rodzica</Text>
          </View>
        </View>
      )}
    />
  );
}

const styles = StyleSheet.create({
  content: { padding: spacing.lg, gap: spacing.md },
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
  thumb: { width: 132, height: 74, backgroundColor: colors.cardAlt },
  thumbEmpty: { borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border },
  rowText: { flex: 1, padding: spacing.md, justifyContent: 'center' },
  videoTitle: { color: colors.text, fontSize: 15, fontWeight: '600' },
  channel: { color: colors.textMuted, fontSize: 13, marginTop: spacing.xs },
  date: { color: colors.textMuted, fontSize: 12, marginTop: 2 },
  pendingNote: { color: colors.warning, fontSize: 12, fontWeight: '600', marginTop: spacing.xs },
});
