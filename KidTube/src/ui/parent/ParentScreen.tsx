import React, { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { Button } from '../components';
import { Chip } from './Chip';
import { PendingTab } from './PendingTab';
import { VideosTab } from './VideosTab';
import { ChannelsTab } from './ChannelsTab';
import { ScheduleTab } from './ScheduleTab';
import { SettingsTab } from './SettingsTab';
import { WatchHistoryList } from '../WatchHistoryList';
import { colors, spacing } from '../theme';
import type {
  Channel,
  ExtraTimePool,
  Schedule,
  Video,
  VideoStatus,
  WatchHistoryEntry,
} from '../../domain/types';

export interface ParentScreenProps {
  childName?: string;
  channels: Channel[];
  videos: Video[];
  /** The child's viewing history, read-only in the parent panel (ADR 0004a). */
  watchHistory: WatchHistoryEntry[];
  schedule?: Schedule;
  /** Today's extra-time pool (ADR 0011), for the effective remaining readout. */
  extraTime?: ExtraTimePool;
  /** Video seconds used today; shown to the parent for verification (ADR 0002). */
  usedSecondsToday?: number;
  onResetUsage: () => void;
  refreshing?: boolean;
  onAddChannelLink: (link: string, autoApprove: boolean) => Promise<string | undefined>;
  onToggleChannelPolicy: (channel: Channel) => void;
  onBlockChannel: (channel: Channel) => void;
  onRemoveChannel: (channel: Channel) => void;
  onSetVideoStatus: (video: Video, status: VideoStatus) => void;
  onPreviewVideo?: (video: Video) => void;
  onSync: () => void;
  onChangePin: () => void;
  onChildName: (name: string) => void;
  onScheduleChange: (schedule: Schedule) => void;
  onClose: () => void;
}

type TabKey = 'pending' | 'videos' | 'channels' | 'history' | 'schedule' | 'settings';

export function ParentScreen(props: ParentScreenProps) {
  const {
    childName,
    channels,
    videos,
    watchHistory,
    schedule,
    extraTime,
    usedSecondsToday,
    onResetUsage,
    refreshing,
    onAddChannelLink,
    onToggleChannelPolicy,
    onBlockChannel,
    onRemoveChannel,
    onSetVideoStatus,
    onPreviewVideo,
    onSync,
    onChangePin,
    onChildName,
    onScheduleChange,
    onClose,
  } = props;

  const [tab, setTab] = useState<TabKey>('pending');

  const pending = useMemo(
    () => videos.filter(v => v.status === 'pending'),
    [videos],
  );

  const tabs: { key: TabKey; label: string }[] = [
    { key: 'pending', label: `Do zatwierdzenia (${pending.length})` },
    { key: 'videos', label: `Filmy (${videos.length})` },
    { key: 'channels', label: `Kanały (${channels.length})` },
    { key: 'history', label: 'Historia oglądania' },
    { key: 'schedule', label: 'Czas' },
    { key: 'settings', label: 'Ustawienia' },
  ];

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Panel rodzica</Text>
        <Button title="Zamknij" variant="secondary" onPress={onClose} />
      </View>

      <View>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.tabs}
        >
          {tabs.map(item => (
            <Chip
              key={item.key}
              label={item.label}
              active={tab === item.key}
              onPress={() => setTab(item.key)}
            />
          ))}
        </ScrollView>
      </View>

      <View style={styles.body}>
        {tab === 'pending' ? (
          <PendingTab
            videos={pending}
            onSetStatus={onSetVideoStatus}
            onPreview={onPreviewVideo}
          />
        ) : null}
        {tab === 'videos' ? (
          <VideosTab
            videos={videos}
            channels={channels}
            onSetStatus={onSetVideoStatus}
            onPreview={onPreviewVideo}
          />
        ) : null}
        {tab === 'channels' ? (
          <ChannelsTab
            channels={channels}
            refreshing={refreshing}
            onAddChannelLink={onAddChannelLink}
            onToggleChannelPolicy={onToggleChannelPolicy}
            onBlockChannel={onBlockChannel}
            onRemoveChannel={onRemoveChannel}
            onSync={onSync}
          />
        ) : null}
        {tab === 'history' ? (
          <WatchHistoryList
            entries={watchHistory}
            showThumbnails={false}
            emptyText="Historia oglądania jest pusta."
          />
        ) : null}
        {tab === 'schedule' ? (
          <ScheduleTab
            schedule={schedule}
            usedSecondsToday={usedSecondsToday ?? 0}
            extraTime={extraTime}
            onResetUsage={onResetUsage}
            onScheduleChange={onScheduleChange}
          />
        ) : null}
        {tab === 'settings' ? (
          <SettingsTab
            childName={childName}
            refreshing={refreshing}
            onChildName={onChildName}
            onChangePin={onChangePin}
            onSync={onSync}
          />
        ) : null}
      </View>
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
  tabs: { gap: spacing.sm, paddingHorizontal: spacing.lg, paddingBottom: spacing.sm },
  body: { flex: 1 },
});
