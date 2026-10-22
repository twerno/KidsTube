import React from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import { Button } from '../components';
import { colors, radius, spacing } from '../theme';
import type { Video, VideoStatus } from '../../domain/types';

const STATUS_LABEL: Record<VideoStatus, string> = {
  allowed: 'Dozwolony',
  pending: 'Oczekuje',
  blocked: 'Zablokowany',
};

const STATUS_COLOR: Record<VideoStatus, string> = {
  allowed: colors.success,
  pending: colors.warning,
  blocked: colors.danger,
};

export function StatusBadge({ status }: { status: VideoStatus }) {
  return (
    <View style={[styles.badge, { borderColor: STATUS_COLOR[status] }]}>
      <Text style={[styles.badgeText, { color: STATUS_COLOR[status] }]}>{STATUS_LABEL[status]}</Text>
    </View>
  );
}

export function VideoRow({
  video,
  onSetStatus,
}: {
  video: Video;
  onSetStatus: (video: Video, status: VideoStatus) => void;
}) {
  return (
    <View style={styles.row}>
      <View style={styles.top}>
        {video.thumbnailUrl ? (
          <Image source={{ uri: video.thumbnailUrl }} style={styles.thumb} />
        ) : (
          <View style={[styles.thumb, styles.thumbEmpty]} />
        )}
        <View style={styles.info}>
          <Text numberOfLines={2} style={styles.title}>
            {video.title}
          </Text>
          <View style={styles.metaRow}>
            {video.channelTitle ? (
              <Text numberOfLines={1} style={styles.channel}>
                {video.channelTitle}
              </Text>
            ) : null}
            <StatusBadge status={video.status} />
          </View>
        </View>
      </View>

      <View style={styles.actions}>
        {video.status === 'pending' ? (
          <>
            <View style={styles.actionItem}>
              <Button title="Odrzuć" variant="danger" onPress={() => onSetStatus(video, 'blocked')} />
            </View>
            <View style={styles.actionItem}>
              <Button title="Akceptuj" variant="primary" onPress={() => onSetStatus(video, 'allowed')} />
            </View>
          </>
        ) : null}
        {video.status === 'allowed' ? (
          <View style={styles.actionItem}>
            <Button title="Cofnij zgodę" variant="danger" onPress={() => onSetStatus(video, 'blocked')} />
          </View>
        ) : null}
        {video.status === 'blocked' ? (
          <View style={styles.actionItem}>
            <Button
              title="Przywróć"
              variant="secondary"
              onPress={() => onSetStatus(video, 'allowed')}
            />
          </View>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    backgroundColor: colors.card,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    padding: spacing.md,
    marginBottom: spacing.sm,
    gap: spacing.sm,
  },
  top: { flexDirection: 'row', gap: spacing.md },
  thumb: { width: 104, height: 58, borderRadius: radius.sm, backgroundColor: colors.cardAlt },
  thumbEmpty: { borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border },
  info: { flex: 1, gap: spacing.xs },
  title: { color: colors.text, fontSize: 15, fontWeight: '600' },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, flexWrap: 'wrap' },
  channel: { color: colors.textMuted, fontSize: 13, flexShrink: 1 },
  badge: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
  },
  badgeText: { fontSize: 11, fontWeight: '700' },
  actions: { flexDirection: 'row', justifyContent: 'flex-end', gap: spacing.sm, flexWrap: 'wrap' },
  actionItem: { minWidth: 120 },
});
