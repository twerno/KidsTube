import React, { useMemo } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Button } from '../components';
import { PanelHeader } from './PanelHeader';
import { PanelSummary } from './PanelSummary';
import { SECTION_TITLE, type SectionKey } from './sections';
import { colors, radius, spacing } from '../theme';
import { filmsLabel, channelsLabel } from '../../domain/plural';
import { libraryVideos, pendingVideos } from '../../domain/panel';
import type {
  Channel,
  ChannelProposal,
  Decision,
  ExtraTimePool,
  Schedule,
  Video,
  WatchHistoryEntry,
} from '../../domain/types';

interface IndexRow {
  key: SectionKey;
  label: string;
  subtitle: string;
}

export interface PanelIndexProps {
  videos: Video[];
  channels: Channel[];
  proposals: ChannelProposal[];
  decisions: Decision[];
  watchHistory: WatchHistoryEntry[];
  schedule?: Schedule;
  extraTime?: ExtraTimePool;
  usedSecondsToday: number;
  youtubeLinkHandlerEnabled: boolean;
  onOpen: (section: SectionKey) => void;
  onClose: () => void;
}

/** The panel index (ADR 0016): summary on top, sections below. */
export function PanelIndex({
  videos,
  channels,
  proposals,
  decisions,
  watchHistory,
  schedule,
  extraTime,
  usedSecondsToday,
  youtubeLinkHandlerEnabled,
  onOpen,
  onClose,
}: PanelIndexProps) {
  const rows = useMemo<IndexRow[]>(() => {
    const pending = pendingVideos(videos, channels);
    const library = libraryVideos(videos, channels, decisions);
    const libraryChannels = channels.filter(channel => channel.status !== 'blocked');
    const waiting = pending.length + proposals.length;
    const waitingHint =
      proposals.length > 0
        ? `${filmsLabel(pending.length)} · ${channelsLabel(proposals.length)}`
        : pending.length > 0
          ? filmsLabel(pending.length)
          : 'Nic nie czeka';

    return [
      {
        key: 'pending',
        label: waiting > 0 ? `${SECTION_TITLE.pending} (${waiting})` : SECTION_TITLE.pending,
        subtitle: waitingHint,
      },
      {
        key: 'library',
        label: SECTION_TITLE.library,
        subtitle: `${filmsLabel(library.length)} · ${channelsLabel(libraryChannels.length)}`,
      },
      {
        key: 'blocked',
        label: SECTION_TITLE.blocked,
        subtitle: 'Kanały i filmy poza biblioteką',
      },
      {
        key: 'add',
        label: SECTION_TITLE.add,
        subtitle: 'Wklej link do filmu lub kanału',
      },
      {
        key: 'history',
        label: SECTION_TITLE.history,
        subtitle: 'Sesje i podgląd materiałów',
      },
      {
        key: 'schedule',
        label: SECTION_TITLE.schedule,
        subtitle: 'Okno, limit i dodatkowy czas',
      },
      {
        key: 'pin',
        label: SECTION_TITLE.pin,
        subtitle: 'Kod chroni panel',
      },
      {
        key: 'links',
        label: SECTION_TITLE.links,
        subtitle: youtubeLinkHandlerEnabled ? 'Włączone' : 'Wyłączone',
      },
      {
        key: 'database',
        label: SECTION_TITLE.database,
        subtitle: 'Kopia zapasowa (JSON)',
      },
      {
        key: 'log',
        label: SECTION_TITLE.log,
        subtitle: 'Zdarzenia z tej sesji',
      },
    ];
  }, [videos, channels, proposals, decisions, youtubeLinkHandlerEnabled]);

  return (
    <View style={styles.container}>
      <PanelHeader
        title="Panel rodzica"
        right={<Button compact title="Zamknij" variant="secondary" onPress={onClose} />}
      />
      <ScrollView showsVerticalScrollIndicator persistentScrollbar contentContainerStyle={styles.content}>
        <PanelSummary
          schedule={schedule}
          usedSecondsToday={usedSecondsToday}
          extraTime={extraTime}
          entries={watchHistory}
        />

        <View style={styles.rows}>
          {rows.map(row => (
            <Pressable
              key={row.key}
              accessibilityRole="button"
              accessibilityLabel={row.label}
              onPress={() => onOpen(row.key)}
              style={({ pressed }) => [styles.row, pressed && styles.pressed]}
            >
              <View style={styles.rowText}>
                <Text style={styles.rowLabel}>{row.label}</Text>
                <Text style={styles.rowSubtitle}>{row.subtitle}</Text>
              </View>
              <Text style={styles.chevron}>›</Text>
            </Pressable>
          ))}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: spacing.lg, paddingBottom: spacing.xl * 2, gap: spacing.md },
  rows: { gap: spacing.sm },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.card,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
  },
  pressed: { opacity: 0.85 },
  rowText: { flex: 1, gap: 2 },
  rowLabel: { color: colors.text, fontSize: 16, fontWeight: '700' },
  rowSubtitle: { color: colors.textMuted, fontSize: 12 },
  chevron: { color: colors.textMuted, fontSize: 22, fontWeight: '700' },
});
