import React, { useMemo } from 'react';
import { Pressable, StyleSheet, Switch, Text, View } from 'react-native';
import { Button, Card } from '../components';
import { Chip } from './Chip';
import { ChannelAvatar } from '../ChannelAvatar';
import { colors, radius, spacing } from '../theme';
import { filmsLabel } from '../../domain/plural';
import { isChannelMuted } from '../../domain/channels';
import { CHANNEL_POLICY_LABEL, CHANNEL_POLICY_OPTIONS } from './labels';
import type { Channel, ChannelPolicy, Video } from '../../domain/types';

function counts(videos: Video[], channelId: string) {
  const films = videos.filter(video => video.channelId === channelId);
  return {
    allowed: films.filter(video => video.status === 'allowed').length,
    pending: films.filter(video => video.status === 'pending').length,
    total: films.length,
    notBlocked: films.filter(video => video.status !== 'blocked').length,
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
  onSelectPolicy?: (channel: Channel, policy: ChannelPolicy) => void;
  onToggleMuted?: (channel: Channel) => void;
  onBlock: (channel: Channel) => void;
  /** “Zablokuj wszystkie filmy z kanału” (ADR 0019). */
  onBlockAllVideos?: (channel: Channel) => void;
  /** False in the archive, where only “Odblokuj” makes sense. */
  showManage?: boolean;
  /** Catalog import (ADR 0009); `restart` re-downloads from the first page. */
  onStartCatalog?: (channel: Channel, restart?: boolean) => void;
  catalogRunning?: boolean;
  /** Bulk decisions on all pending films of the channel (ADR 0009/0016). */
  onBulkDecide?: (channel: Channel, outcome: 'allow' | 'reject') => void;
}

/** The channel card: the same component inline in “Dodaj” and as a screen. */
export function ChannelDetails({
  channel,
  videos,
  onSelectPolicy,
  onToggleMuted,
  onBlock,
  onBlockAllVideos,
  showManage = true,
  onStartCatalog,
  catalogRunning = false,
  onBulkDecide,
}: ChannelDetailsProps) {
  const { allowed, pending, notBlocked } = useMemo(
    () => counts(videos, channel.id),
    [videos, channel.id],
  );

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

      {showManage && onToggleMuted ? (
        <View style={styles.switchRow}>
          <Text style={styles.switchLabel}>Aktualizuj kanał (RSS)</Text>
          <Switch
            value={!isChannelMuted(channel)}
            onValueChange={() => onToggleMuted(channel)}
            disabled={channel.status === 'blocked'}
          />
        </View>
      ) : null}

      {showManage && onSelectPolicy ? (
        <View style={styles.policy}>
          <Text style={styles.policyLabel}>Nowe filmy:</Text>
          <View style={styles.policyChips}>
            {CHANNEL_POLICY_OPTIONS.map(policy => (
              <Chip
                key={policy}
                compact
                label={CHANNEL_POLICY_LABEL[policy]}
                active={channel.policy === policy}
                onPress={() => onSelectPolicy(channel, policy)}
              />
            ))}
          </View>
          {channel.policy === 'quiet' ? (
            <Text style={styles.policyHint}>
              Nowe filmy są zapisywane w cache, ale nie trafiają do kolejki zatwierdzeń.
            </Text>
          ) : null}
          {channel.policy === 'auto_block' ? (
            <Text style={styles.policyHint}>
              Nowe filmy są od razu odrzucane. Zatwierdzenie pojedynczego filmu nadal jest możliwe.
            </Text>
          ) : null}
        </View>
      ) : null}

      {showManage && onStartCatalog ? (
        <View style={styles.catalog}>
          <Button
            title={
              channel.catalog?.done
                ? 'Pobierz ponownie'
                : channel.catalog && channel.catalog.imported > 0
                  ? 'Kontynuuj pobieranie'
                  : 'Pobierz wszystkie'
            }
            variant="secondary"
            onPress={() => onStartCatalog(channel, !!channel.catalog?.done)}
            disabled={catalogRunning}
            loading={catalogRunning}
          />
          {channel.catalog && !channel.catalog.done && channel.catalog.imported > 0 ? (
            <Button
              title="Pobierz od nowa"
              variant="ghost"
              compact
              onPress={() => onStartCatalog(channel, true)}
              disabled={catalogRunning}
            />
          ) : null}
          {channel.catalog && channel.catalog.imported > 0 ? (
            <Text style={styles.catalogInfo}>
              Wczytano {filmsLabel(channel.catalog.imported)}
            </Text>
          ) : null}
          {channel.catalog?.error ? (
            <Text style={styles.catalogError}>{channel.catalog.error}</Text>
          ) : null}
        </View>
      ) : null}

      {showManage && onBulkDecide && pending > 0 ? (
        <View style={styles.bulk}>
          <Button
            title={`Akceptuj wszystkie (${pending})`}
            onPress={() => onBulkDecide(channel, 'allow')}
            disabled={catalogRunning}
          />
          <Button
            title={`Odrzuć wszystkie (${pending})`}
            variant="danger"
            onPress={() => onBulkDecide(channel, 'reject')}
            disabled={catalogRunning}
          />
        </View>
      ) : null}

      <View style={styles.actions}>
        <Button
          title={channel.status === 'blocked' ? 'Odblokuj' : 'Zablokuj'}
          variant={channel.status === 'blocked' ? 'primary' : 'secondary'}
          onPress={() => onBlock(channel)}
        />
      </View>
      {showManage && onBlockAllVideos && channel.status !== 'blocked' ? (
        <Button
          title={`Zablokuj wszystkie filmy (${notBlocked})`}
          variant="danger"
          onPress={() => onBlockAllVideos(channel)}
        />
      ) : null}
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
  policy: { gap: spacing.xs },
  policyLabel: { color: colors.textMuted, fontSize: 13, fontWeight: '700' },
  policyChips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  policyHint: { color: colors.textMuted, fontSize: 12, lineHeight: 17 },
  actions: { flexDirection: 'row', justifyContent: 'flex-end' },
  catalog: { gap: spacing.xs },
  catalogInfo: { color: colors.textMuted, fontSize: 12 },
  catalogError: { color: colors.warning, fontSize: 12, lineHeight: 17 },
  bulk: { gap: spacing.sm },
});
