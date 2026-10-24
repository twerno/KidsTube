import React from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import { Button } from '../components';
import { colors, radius, spacing } from '../theme';
import { formatPublishedDate } from '../../domain/dates';
import { SOURCE_LABEL, STATUS_LABEL } from './labels';
import type { Video, VideoStatus } from '../../domain/types';

const STATUS_COLOR: Record<VideoStatus, string> = {
  allowed: colors.success,
  pending: colors.warning,
  blocked: colors.danger,
};

export function StatusBadge({
  status,
  label,
  color,
}: {
  status: VideoStatus;
  label?: string;
  color?: string;
}) {
  const tone = color ?? STATUS_COLOR[status];
  return (
    <View style={[styles.badge, { borderColor: tone }]}>
      <Text style={[styles.badgeText, { color: tone }]}>{label ?? STATUS_LABEL[status]}</Text>
    </View>
  );
}

export interface VideoRowProps {
  video: Video;
  /** Parent decision; when absent the row is read-only apart from preview. */
  onSetStatus?: (video: Video, status: VideoStatus) => void;
  onPreview?: (video: Video) => void;
  /** Overrides the status badge (e.g. “wstrzymany” for a blocked channel). */
  statusLabel?: string;
  statusColor?: string;
  /** False hides the decision buttons but keeps the preview. */
  showActions?: boolean;
}

export function VideoRow({
  video,
  onSetStatus,
  onPreview,
  statusLabel,
  statusColor,
  showActions = true,
}: VideoRowProps) {
  const actions = showActions && onSetStatus;

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
            <StatusBadge status={video.status} label={statusLabel} color={statusColor} />
            <Text style={styles.source}>{SOURCE_LABEL[video.source]}</Text>
            {video.publishedAt ? (
              <Text style={styles.date}>{formatPublishedDate(video.publishedAt)}</Text>
            ) : null}
          </View>
        </View>
      </View>

      <View style={styles.actions}>
        {onPreview ? (
          <View style={styles.actionItem}>
            <Button compact title="Podgląd" variant="preview" onPress={() => onPreview(video)} />
          </View>
        ) : null}
        {actions && video.status === 'pending' ? (
          <>
            <View style={styles.actionItem}>
              <Button
                compact
                title="Odrzuć"
                variant="danger"
                onPress={() => onSetStatus(video, 'blocked')}
              />
            </View>
            <View style={styles.actionItem}>
              <Button
                compact
                title="Akceptuj"
                variant="primary"
                onPress={() => onSetStatus(video, 'allowed')}
              />
            </View>
          </>
        ) : null}
        {actions && video.status === 'allowed' ? (
          <View style={styles.actionItem}>
            <Button
              compact
              title="Cofnij zgodę"
              variant="danger"
              onPress={() => onSetStatus(video, 'blocked')}
            />
          </View>
        ) : null}
        {actions && video.status === 'blocked' ? (
          <View style={styles.actionItem}>
            <Button
              compact
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
  date: { color: colors.textMuted, fontSize: 12 },
  source: { color: colors.textMuted, fontSize: 11 },
  badge: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
  },
  badgeText: { fontSize: 11, fontWeight: '700' },
  actions: { flexDirection: 'row', gap: spacing.sm },
  actionItem: { flex: 1 },
});
