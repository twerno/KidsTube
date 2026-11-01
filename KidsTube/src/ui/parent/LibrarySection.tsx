import React, { useEffect, useMemo, useState } from 'react';
import { FlatList, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { Button, Field } from '../components';
import { Chip } from './Chip';
import { ChannelBar, type ChannelBarEntry } from './ChannelBar';
import { ChannelRow } from './ChannelCard';
import { EmptyState } from './EmptyState';
import { VideoRow } from './VideoRow';
import { colors, spacing } from '../theme';
import {
  UNKNOWN_CHANNEL_KEY,
  channelBarEntries,
  channelKeyOf,
  libraryVideos,
  normalizeChannelFilter,
} from '../../domain/panel';
import { filmsLabel } from '../../domain/plural';
import type { Channel, Decision, Video, VideoStatus } from '../../domain/types';

const ALL_ENTRY = '__all__';

type LibraryView = 'films' | 'channels';

export interface LibrarySectionProps {
  videos: Video[];
  channels: Channel[];
  decisions: Decision[];
  refreshing: boolean;
  onRefresh: () => void;
  onSetStatus: (video: Video, status: VideoStatus) => void;
  onPreview: (video: Video) => void;
  onEditChannel: (channelId: string) => void;
  onOpenChannel: (channelId: string) => void;
}

/** “Biblioteka”: what the child can actually see (ADR 0016). */
export function LibrarySection({
  videos,
  channels,
  decisions,
  refreshing,
  onRefresh,
  onSetStatus,
  onPreview,
  onEditChannel,
  onOpenChannel,
}: LibrarySectionProps) {
  const [view, setView] = useState<LibraryView>('films');
  const [channelKey, setChannelKey] = useState<string | null>(null);
  const [query, setQuery] = useState('');

  const films = useMemo(
    () => libraryVideos(videos, channels, decisions),
    [videos, channels, decisions],
  );
  const bars = useMemo(() => channelBarEntries(films, channels), [films, channels]);
  const activeChannel = normalizeChannelFilter(bars, channelKey);

  useEffect(() => {
    if (activeChannel !== channelKey) {
      setChannelKey(activeChannel);
    }
  }, [activeChannel, channelKey]);

  const barEntries = useMemo<ChannelBarEntry[]>(
    () => [
      { key: ALL_ENTRY, title: 'Wszystkie', count: films.length, observed: true, isAll: true },
      ...bars,
    ],
    [bars, films.length],
  );

  const visibleFilms = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return films
      .filter(video => activeChannel === null || channelKeyOf(video) === activeChannel)
      .filter(video => {
        if (!needle) {
          return true;
        }
        return `${video.title} ${video.channelTitle ?? ''}`.toLowerCase().includes(needle);
      })
      .sort((a, b) => (b.publishedAt ?? b.addedAt) - (a.publishedAt ?? a.addedAt));
  }, [films, activeChannel, query]);

  const allowedChannels = useMemo(
    () =>
      channels
        .filter(channel => channel.status !== 'blocked')
        .sort((a, b) => a.title.localeCompare(b.title)),
    [channels],
  );

  const refreshControl = (
    <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />
  );

  const header = (
    <View style={styles.header}>
      <View style={styles.chips}>
        <Chip label="Filmy" active={view === 'films'} onPress={() => setView('films')} />
        <Chip label="Kanały" active={view === 'channels'} onPress={() => setView('channels')} />
      </View>

      {view === 'films' ? (
        <>
          <ChannelBar
            entries={barEntries}
            selected={activeChannel}
            onSelect={setChannelKey}
          />
          <Field
            value={query}
            onChangeText={setQuery}
            placeholder="Szukaj po tytule lub kanale…"
            autoCorrect={false}
          />
          <View style={styles.summaryRow}>
            <Text style={styles.summary}>
              {filmsLabel(visibleFilms.length)}
              {activeChannel ? ' w tym kanale' : ' w bibliotece'}
            </Text>
            {activeChannel && activeChannel !== UNKNOWN_CHANNEL_KEY ? (
              <Button
                compact
                title="Edytuj kanał"
                variant="secondary"
                onPress={() => onEditChannel(activeChannel)}
              />
            ) : null}
          </View>
        </>
      ) : null}
    </View>
  );

  if (view === 'channels') {
    return (
      <FlatList
      showsVerticalScrollIndicator
      persistentScrollbar
        data={allowedChannels}
        keyExtractor={item => item.id}
        contentContainerStyle={styles.content}
        removeClippedSubviews={false}
        refreshControl={refreshControl}
        ListHeaderComponent={header}
        ListEmptyComponent={<EmptyState>Brak kanałów w bibliotece.</EmptyState>}
        renderItem={({ item }: { item: Channel }) => (
          <ChannelRow
            channel={item}
            videos={videos}
            onPress={() => onOpenChannel(item.id)}
          />
        )}
      />
    );
  }

  return (
    <FlatList
      showsVerticalScrollIndicator
      persistentScrollbar
      data={visibleFilms}
      keyExtractor={item => item.id}
      contentContainerStyle={styles.content}
      removeClippedSubviews={false}
      refreshControl={refreshControl}
      ListHeaderComponent={header}
      ListEmptyComponent={
        <EmptyState>
          {films.length === 0 ? 'Brak filmów w bibliotece.' : 'Brak filmów w tym filtrze.'}
        </EmptyState>
      }
      renderItem={({ item }: { item: Video }) => (
        <VideoRow video={item} onSetStatus={onSetStatus} onPreview={onPreview} />
      )}
    />
  );
}

const styles = StyleSheet.create({
  content: { padding: spacing.lg, paddingBottom: spacing.xl * 2 },
  header: { gap: spacing.md, marginBottom: spacing.sm },
  chips: { flexDirection: 'row', gap: spacing.sm },
  summaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  summary: { color: colors.textMuted, fontSize: 13 },
});
