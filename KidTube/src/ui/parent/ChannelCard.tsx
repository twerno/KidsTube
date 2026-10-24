import React, { useMemo } from 'react';
import { Pressable, StyleSheet, Switch, Text, View } from 'react-native';
import { Button, Card } from '../components';
import { ChannelAvatar } from '../ChannelAvatar';
import { colors, radius, spacing } from '../theme';
import { filmsLabel } from '../../domain/plural';
import { isChannelMuted } from '../../domain/channels';
import type { Channel, Video } from '../../domain/types';

function counts(videos: Video[], channelId: string) {
  const films = videos.filter(video => video.channelId === channelId);
  return {
    allowed: films.filter(video => video.status === 'allowed').length,
    pending: films.filter(video => video.status === 'pending').length,
  };
}

/** One row of the channel list; tapping it opens the channel screen. */
export function ChannelRow({ channel, videos, onPress }: { channel: Channel; videos: Video[]; onPress: () => void }) {
  const { allowed, pending } = useMemo(() => counts(videos, channel.id), [videos, channel.id]);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={channel.title}
      onPress={onPress}
      style={({ pressed }) => [styles.row, pressed && styles.pressed]}
    >
      <ChannelAvatar title={channel.title} thumbnailUrl={channel.thumbnailUrl} size={44} />
      <View style={styles.rowText}>
        <Text numberOfLines={1} style={styles.rowTitle}>
          {channel.title}
        </Text>
        <Text numberOfLines={1} style={styles.rowMeta}>
          {filmsLabel(allowed)} w bibliotece
          {pending > 0 ? ` · ${filmsLabel(pending)} czeka` : ''}
        </Text>
      </View>
      {channel.status === 'blocked' ? <Text style={styles.blockedBadge}>zablokowany</Text> : null}
      {isChannelMuted(channel) ? (
        <Text style={styles.mutedBadge}>wyciszony</Text>
      ) : null}
      <Text style={styles.chevron}>›</Text>
    </Pressable>
  );
}

export interface ChannelDetailsProps {
  channel: Channel;
  /** All videos of this channel, for the counts. */
  videos: Video[];
  onTogglePolicy?: (channel: Channel) => void;
  onToggleMuted?: (channel: Channel) => void;
  onBlock: (channel: Channel) => void;
  /** False in the archive, where only “Odblokuj” makes sense. */
  showManage?: boolean;
}

/** The channel card: the same component inline in “Dodaj” and as a screen. */
export function ChannelDetails({
  channel,
  videos,
  onTogglePolicy,
  onToggleMuted,
  onBlock,
  showManage = true,
}: ChannelDetailsProps) {
  const { allowed, pending } = useMemo(() => counts(videos, channel.id), [videos, channel.id]);

  return (
    <Card style={styles.card}>
      <View style={styles.header}>
        <ChannelAvatar title={channel.title} thumbnailUrl={channel.thumbnailUrl} size={44} />
        <View style={styles.headerText}>
          <Text numberOfLines={2} style={styles.title}>
            {channel.title}
          </Text>
          <Text numberOfLines={1} style={styles.handle}>
            {channel.handle ? `@${channel.handle}` : channel.id}
          </Text>
        </View>
      </View>

      <Text style={styles.counts}>
        Dozwolone: {filmsLabel(allowed)} · Oczekujące: {filmsLabel(pending)}
      </Text>

      {showManage && onTogglePolicy && onToggleMuted ? (
        <>
          <View style={styles.switchRow}>
            <Text style={styles.switchLabel}>Auto-akceptacja nowych filmów</Text>
            <Switch
              value={channel.policy === 'auto_approve'}
              onValueChange={() => onTogglePolicy?.(channel)}
              disabled={channel.status === 'blocked'}
            />
          </View>
          <View style={styles.switchRow}>
            <Text style={styles.switchLabel}>Wyciszony — bez pobierania RSS</Text>
            <Switch
              value={isChannelMuted(channel)}
              onValueChange={() => onToggleMuted?.(channel)}
            />
          </View>
        </>
      ) : null}

      <View style={styles.actions}>
        <Button
          title={channel.status === 'blocked' ? 'Odblokuj' : 'Zablokuj'}
          variant={channel.status === 'blocked' ? 'primary' : 'secondary'}
          onPress={() => onBlock(channel)}
        />
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  row: {
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
  pressed: { opacity: 0.85 },
  rowText: { flex: 1, gap: 2 },
  rowTitle: { color: colors.text, fontSize: 15, fontWeight: '700' },
  rowMeta: { color: colors.textMuted, fontSize: 12 },
  blockedBadge: { color: colors.danger, fontSize: 11, fontWeight: '700' },
  mutedBadge: { color: colors.warning, fontSize: 11, fontWeight: '700' },
  chevron: { color: colors.textMuted, fontSize: 20, fontWeight: '700' },
  card: { gap: spacing.md },
  header: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  headerText: { flex: 1, gap: 2 },
  title: { color: colors.text, fontSize: 17, fontWeight: '800' },
  handle: { color: colors.textMuted, fontSize: 12 },
  counts: { color: colors.textMuted, fontSize: 13 },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  switchLabel: { color: colors.text, flex: 1, fontSize: 14 },
  actions: { flexDirection: 'row', justifyContent: 'flex-end' },
});
