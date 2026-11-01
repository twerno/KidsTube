import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  BackHandler,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { colors, radius, spacing } from './theme';
import { Button } from './components';
import { APP_VERSION } from '../version';
import { ChannelAvatar } from './ChannelAvatar';
import { VideoGrid } from './child/VideoGrid';
import { ChannelsList } from './child/ChannelsList';
import { ProposalsList } from './child/ProposalsList';
import { WatchHistoryList } from './WatchHistoryList';
import {
  channelsForChild,
  continueWatchingVideos,
  videosForChannel,
} from '../domain/content';
import {
  activeChildTab,
  canGoBackChild,
  currentChildView,
  type ChildNavState,
  type ChildTab,
} from '../domain/childNavigation';
import { filmsLabel } from '../domain/plural';
import type { Channel, Video, WatchHistoryEntry, WatchProgress } from '../domain/types';

export interface ChildHomeScreenProps {
  childName?: string;
  /** Seconds left in today's video budget; undefined when there is no limit. */
  remainingVideoSeconds?: number;
  /** Only allowed videos — the child's library. */
  videos: Video[];
  /** Per-video watching progress, for the “stan obejrzenia” badge (ADR 0004). */
  watchProgress?: WatchProgress[];
  channels: Channel[];
  watchHistory: WatchHistoryEntry[];
  /** The child's own pending proposals (source: propose / share). */
  proposals: Video[];
  /** Contextual path kept in App, so the player returns to its origin (ADR 0004a). */
  nav: ChildNavState;
  refreshing?: boolean;
  onRefresh?: () => void;
  onPlay: (video: Video) => void;
  /** Child pasting a YouTube link; becomes a pending proposal (ADR 0001). */
  onPropose: (link: string) => void;
  onOpenParent: () => void;
  onSelectTab: (tab: ChildTab) => void;
  onOpenChannel: (channel: Channel) => void;
  /** Extra-time action is available only when the schedule has a gate (ADR 0011). */
  canAddExtraTime?: boolean;
  onAddExtraTime?: () => void;
  /** Child history entry → player (when the film is still in the library). */
  onPlayHistoryEntry: (entry: WatchHistoryEntry) => void;
  onBack: () => void;
}

export function ChildHomeScreen({
  childName,
  remainingVideoSeconds,
  videos,
  watchProgress,
  channels,
  watchHistory,
  proposals,
  nav,
  refreshing,
  onRefresh,
  onPlay,
  onPropose,
  onOpenParent,
  onSelectTab,
  onOpenChannel,
  canAddExtraTime,
  onAddExtraTime,
  onPlayHistoryEntry,
  onBack,
}: ChildHomeScreenProps) {
  const [proposing, setProposing] = useState(false);
  const [linkText, setLinkText] = useState('');
  const [query, setQuery] = useState('');

  const view = currentChildView(nav);
  const activeTab = activeChildTab(nav);
  const channelId = view.kind === 'channel' ? view.channelId : undefined;

  const childChannels = useMemo(() => channelsForChild(channels, videos), [channels, videos]);
  const channelVideos = useMemo(
    () => (channelId ? videosForChannel(videos, channelId) : []),
    [videos, channelId],
  );
  const continueVideos = useMemo(
    () => continueWatchingVideos(videos, watchProgress ?? []),
    [videos, watchProgress],
  );
  const needle = query.trim().toLowerCase();
  const matchesQuery = useCallback(
    (video: Video) =>
      !needle ||
      `${video.title} ${video.channelTitle ?? ''}`.toLowerCase().includes(needle),
    [needle],
  );
  const feedVideos = useMemo(() => videos.filter(matchesQuery), [videos, matchesQuery]);
  const visibleChannelVideos = useMemo(
    () => channelVideos.filter(matchesQuery),
    [channelVideos, matchesQuery],
  );
  const visibleContinueVideos = useMemo(
    () => continueVideos.filter(matchesQuery),
    [continueVideos, matchesQuery],
  );
  const currentChannel = useMemo(
    () => (channelId ? channels.find(channel => channel.id === channelId) : undefined),
    [channels, channelId],
  );

  // Hardware back follows the same contextual path; at a tab root the OS
  // handles it (and closes the app), so we do not intercept.
  useEffect(() => {
    if (!canGoBackChild(nav)) {
      return undefined;
    }
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      onBack();
      return true;
    });
    return () => subscription.remove();
  }, [nav, onBack]);

  const submitProposal = () => {
    const trimmed = linkText.trim();
    if (trimmed) {
      onPropose(trimmed);
    }
    setLinkText('');
    setProposing(false);
  };

  const closeDraft = () => {
    setLinkText('');
    setProposing(false);
  };

  const tabs: { key: ChildTab; label: string }[] = [
    { key: 'feed', label: 'Feed' },
    { key: 'continue', label: 'Kontynuuj' },
    { key: 'channels', label: 'Kanały' },
    {
      key: 'proposals',
      label: `Do zatwierdzenia${proposals.length > 0 ? ` (${proposals.length})` : ''}`,
    },
    { key: 'history', label: 'Historia' },
  ];

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Text style={styles.title}>{childName ? `Cześć, ${childName}!` : 'Twoje filmy'}</Text>
          {remainingVideoSeconds !== undefined ? (
            remainingVideoSeconds > 0 ? (
              <Text style={styles.budget}>
                ⏳ Zostało {Math.ceil(remainingVideoSeconds / 60)} min na dziś
              </Text>
            ) : (
              <Text style={styles.budgetEmpty}>
                Brak czasu wideo na dziś — możesz słuchać z wyłączonym obrazem
              </Text>
            )
          ) : null}
          {canAddExtraTime && onAddExtraTime ? (
            <Pressable onPress={onAddExtraTime} hitSlop={8} style={styles.extraTimeButton}>
              <Text style={styles.extraTimeText}>＋ Dodaj więcej czasu</Text>
            </Pressable>
          ) : null}
        </View>
        <Pressable onPress={onOpenParent} hitSlop={12} style={styles.parentButton}>
          <Text style={styles.parentButtonText}>Panel rodzica</Text>
          <Text style={styles.versionText}>v{APP_VERSION}</Text>
        </Pressable>
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.tabsBar}
        contentContainerStyle={styles.tabs}
      >
        {tabs.map(item => {
          const active = activeTab === item.key;
          return (
            <Pressable
              key={item.key}
              accessibilityRole="button"
              accessibilityState={{ selected: active }}
              onPress={() => {
                setQuery('');
                onSelectTab(item.key);
              }}
              style={[styles.tab, active && styles.tabActive]}
            >
              <Text style={[styles.tabText, active && styles.tabTextActive]}>{item.label}</Text>
            </Pressable>
          );
        })}
      </ScrollView>

      {view.kind === 'channel' ? (
        <View style={styles.channelHeader}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Wróć do kanałów"
            onPress={onBack}
            hitSlop={12}
            style={styles.backButton}
          >
            <Text style={styles.backText}>‹ Kanały</Text>
          </Pressable>
          <ChannelAvatar
            title={view.channelTitle}
            thumbnailUrl={currentChannel?.thumbnailUrl}
            size={40}
          />
          <View style={styles.channelHeaderText}>
            <Text numberOfLines={1} style={styles.channelHeaderTitle}>
              {view.channelTitle}
            </Text>
            <Text style={styles.channelHeaderCount}>{filmsLabel(channelVideos.length)}</Text>
          </View>
        </View>
      ) : null}

      {view.kind === 'proposals' ? (
        <View style={styles.proposeActionsRow}>
          <Button title="Zaproponuj film" variant="secondary" onPress={() => setProposing(true)} />
        </View>
      ) : null}

      {view.kind === 'feed' || view.kind === 'channel' || view.kind === 'continue' ? (
        <View style={styles.searchRow}>
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Szukaj po tytule lub kanale…"
            placeholderTextColor={colors.textMuted}
            style={styles.searchInput}
            autoCapitalize="none"
            autoCorrect={false}
            returnKeyType="search"
            accessibilityLabel="Szukaj filmów"
          />
          {query ? (
            <Pressable onPress={() => setQuery('')} hitSlop={10} style={styles.searchClear}>
              <Text style={styles.searchClearText}>✕</Text>
            </Pressable>
          ) : null}
        </View>
      ) : null}

      {view.kind === 'feed' ? (
        <VideoGrid
          videos={feedVideos}
          watchProgress={watchProgress}
          onPlay={onPlay}
          refreshing={refreshing}
          onRefresh={onRefresh}
          emptyText={
            needle
              ? 'Żaden film nie pasuje do wyszukiwania.'
              : 'Brak zatwierdzonych filmów. Rodzic może dodać kanał lub film w panelu.'
          }
        />
      ) : null}

      {view.kind === 'continue' ? (
        <VideoGrid
          videos={visibleContinueVideos}
          watchProgress={watchProgress}
          onPlay={onPlay}
          refreshing={refreshing}
          onRefresh={onRefresh}
          emptyText={
            needle
              ? 'Żaden rozpoczęty film nie pasuje do wyszukiwania.'
              : 'Brak rozpoczętych filmów. Filmy, których nie obejrzałeś do końca, pojawią się tutaj.'
          }
        />
      ) : null}

      {view.kind === 'channels' ? (
        <ChannelsList
          entries={childChannels}
          onOpenChannel={onOpenChannel}
          refreshing={refreshing}
          onRefresh={onRefresh}
        />
      ) : null}

      {view.kind === 'channel' ? (
        <VideoGrid
          videos={visibleChannelVideos}
          watchProgress={watchProgress}
          onPlay={onPlay}
          refreshing={refreshing}
          onRefresh={onRefresh}
          emptyText={
            needle
              ? 'Żaden film w tym kanale nie pasuje do wyszukiwania.'
              : 'Ten kanał nie ma jeszcze zatwierdzonych filmów.'
          }
        />
      ) : null}

      {view.kind === 'proposals' ? <ProposalsList proposals={proposals} /> : null}

      {view.kind === 'history' ? (
        <WatchHistoryList
          entries={watchHistory}
          showThumbnails
          watchProgress={watchProgress}
          onPlayEntry={onPlayHistoryEntry}
          emptyText="Historia jest pusta. Odtworzone filmy pojawią się tutaj."
        />
      ) : null}

      {proposing ? (
        <View style={styles.proposeBackdrop}>
          <View style={styles.proposeSheet}>
            <Text style={styles.proposeTitle}>Zaproponuj film</Text>
            <Text style={styles.proposeHint}>
              Wklej link do filmu z YouTube. Rodzic zdecyduje, czy może go obejrzeć.
            </Text>
            <TextInput
              placeholderTextColor={colors.textMuted}
              value={linkText}
              onChangeText={setLinkText}
              placeholder="https://youtube.com/watch?v=…"
              style={styles.proposeInput}
              autoCapitalize="none"
              autoCorrect={false}
            />
            <View style={styles.proposeActions}>
              <Button title="Anuluj" variant="ghost" onPress={closeDraft} />
              <Button title="Dodaj" disabled={!linkText.trim()} onPress={submitProposal} />
            </View>
          </View>
        </View>
      ) : null}
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
  headerLeft: { flex: 1, paddingRight: spacing.md },
  title: { color: colors.text, fontSize: 24, fontWeight: '800' },
  budget: { color: colors.textMuted, fontSize: 13, fontWeight: '600', marginTop: spacing.xs },
  budgetEmpty: { color: colors.warning, fontSize: 13, fontWeight: '600', marginTop: spacing.xs },
  extraTimeButton: { alignSelf: 'flex-start', marginTop: spacing.xs },
  extraTimeText: { color: colors.primary, fontSize: 13, fontWeight: '700' },
  parentButton: { paddingVertical: spacing.xs, paddingHorizontal: spacing.sm, alignItems: 'flex-end' },
  parentButtonText: { color: colors.textMuted, fontSize: 13 },
  versionText: { color: colors.textMuted, fontSize: 10, opacity: 0.7, marginTop: 2 },
  tabsBar: { flexGrow: 0, flexShrink: 0 },
  tabs: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.sm,
  },
  tab: { paddingVertical: spacing.sm, paddingHorizontal: spacing.md, borderRadius: radius.lg },
  tabActive: { backgroundColor: colors.primary },
  tabText: { color: colors.textMuted, fontSize: 14, fontWeight: '700' },
  tabTextActive: { color: colors.black, fontWeight: '800' },
  channelHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.sm,
  },
  backButton: { paddingVertical: spacing.xs, paddingRight: spacing.xs },
  backText: { color: colors.primary, fontSize: 15, fontWeight: '700' },
  channelHeaderText: { flex: 1, gap: 1 },
  channelHeaderTitle: { color: colors.text, fontSize: 17, fontWeight: '800' },
  channelHeaderCount: { color: colors.textMuted, fontSize: 12 },
  proposeActionsRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    paddingHorizontal: spacing.lg,
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginHorizontal: spacing.lg,
    marginBottom: spacing.sm,
  },
  searchInput: {
    flex: 1,
    backgroundColor: colors.cardAlt,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    color: colors.text,
    fontSize: 15,
  },
  searchClear: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  searchClearText: { color: colors.textMuted, fontSize: 16, fontWeight: '700' },
  proposeBackdrop: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(0, 0, 0, 0.45)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  proposeSheet: {
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    padding: spacing.lg,
    width: '88%',
    gap: spacing.md,
  },
  proposeTitle: { color: colors.text, fontSize: 18, fontWeight: '800' },
  proposeHint: { color: colors.textMuted, fontSize: 13, lineHeight: 18 },
  proposeInput: {
    backgroundColor: colors.cardAlt,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    color: colors.text,
    fontSize: 15,
  },
  proposeActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: spacing.md },
});
