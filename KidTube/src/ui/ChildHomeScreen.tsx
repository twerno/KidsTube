import React, { useState } from 'react';
import {
  FlatList,
  Image,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { colors, radius, spacing } from './theme';
import { Button } from './components';
import { APP_VERSION } from '../version';
import type { Video } from '../domain/types';

export interface ChildHomeScreenProps {
  childName?: string;
  /** Only allowed videos — the feed. */
  videos: Video[];
  /** The child's own pending proposals (source: propose / share). */
  proposals: Video[];
  refreshing?: boolean;
  onRefresh?: () => void;
  onPlay: (video: Video) => void;
  /** Child pasting a YouTube link; becomes a pending proposal (ADR 0001). */
  onPropose: (link: string) => void;
  onOpenParent: () => void;
}

export function ChildHomeScreen({
  childName,
  videos,
  proposals,
  refreshing,
  onRefresh,
  onPlay,
  onPropose,
  onOpenParent,
}: ChildHomeScreenProps) {
  const [tab, setTab] = useState<'feed' | 'proposals'>('feed');
  const [proposing, setProposing] = useState(false);
  const [linkText, setLinkText] = useState('');

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

  const feedList = (
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
  );

  const proposalsList = (
    <FlatList
      data={proposals}
      keyExtractor={item => item.id}
      contentContainerStyle={proposals.length === 0 ? styles.emptyContainer : styles.listContent}
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
            <Text style={styles.pendingNote}>Czeka na decyzję rodzica</Text>
          </View>
        </View>
      )}
    />
  );

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>{childName ? `Cześć, ${childName}!` : 'Twoje filmy'}</Text>
        <Pressable onPress={onOpenParent} hitSlop={12} style={styles.parentButton}>
          <Text style={styles.parentButtonText}>Panel rodzica</Text>
          <Text style={styles.versionText}>v{APP_VERSION}</Text>
        </Pressable>
      </View>

      <View style={styles.tabs}>
        <Pressable
          accessibilityRole="button"
          onPress={() => setTab('feed')}
          style={[styles.tab, tab === 'feed' && styles.tabActive]}
        >
          <Text style={[styles.tabText, tab === 'feed' && styles.tabTextActive]}>Feed</Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          onPress={() => setTab('proposals')}
          style={[styles.tab, tab === 'proposals' && styles.tabActive]}
        >
          <Text style={[styles.tabText, tab === 'proposals' && styles.tabTextActive]}>
            {`Do zatwierdzenia${proposals.length > 0 ? ` (${proposals.length})` : ''}`}
          </Text>
        </Pressable>
      </View>

      {tab === 'proposals' ? (
        <View style={styles.proposeActionsRow}>
          <Button title="Zaproponuj film" variant="secondary" onPress={() => setProposing(true)} />
        </View>
      ) : null}

      {tab === 'feed' ? feedList : proposalsList}

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
  title: { color: colors.text, fontSize: 24, fontWeight: '800' },
  parentButton: { paddingVertical: spacing.xs, paddingHorizontal: spacing.sm, alignItems: 'flex-end' },
  parentButtonText: { color: colors.textMuted, fontSize: 13 },
  versionText: { color: colors.textMuted, fontSize: 10, opacity: 0.7, marginTop: 2 },
  tabs: {
    flexDirection: 'row',
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.sm,
  },
  tab: { paddingVertical: spacing.sm, paddingHorizontal: spacing.md, borderRadius: radius.lg },
  tabActive: { backgroundColor: colors.primary },
  tabText: { color: colors.textMuted, fontSize: 14, fontWeight: '700' },
  tabTextActive: { color: colors.black, fontWeight: '800' },
  proposeActionsRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    paddingHorizontal: spacing.lg,
  },
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
  thumbEmpty: { borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border },
  rowText: { flex: 1, padding: spacing.md, justifyContent: 'center' },
  videoTitle: { color: colors.text, fontSize: 15, fontWeight: '600' },
  channel: { color: colors.textMuted, fontSize: 13, marginTop: spacing.xs },
  pendingNote: { color: colors.warning, fontSize: 12, fontWeight: '600', marginTop: spacing.xs },
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