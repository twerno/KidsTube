import React from 'react';
import { FlatList, StyleSheet, Text } from 'react-native';
import { VideoRow } from './VideoRow';
import { colors, spacing } from '../theme';
import type { Video, VideoStatus } from '../../domain/types';

export function PendingTab({
  videos,
  onSetStatus,
}: {
  videos: Video[];
  onSetStatus: (video: Video, status: VideoStatus) => void;
}) {
  return (
    <FlatList
      data={videos}
      keyExtractor={item => item.id}
      contentContainerStyle={styles.content}
      ListEmptyComponent={
        <Text style={styles.empty}>Brak filmów oczekujących na akceptację.</Text>
      }
      renderItem={({ item }) => <VideoRow video={item} onSetStatus={onSetStatus} />}
    />
  );
}

const styles = StyleSheet.create({
  content: { padding: spacing.lg, paddingBottom: spacing.xl * 2 },
  empty: { color: colors.textMuted, textAlign: 'center', marginTop: spacing.xl, fontSize: 15 },
});
