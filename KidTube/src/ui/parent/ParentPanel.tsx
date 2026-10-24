import React, { useCallback, useEffect, useRef, useState } from 'react';
import { BackHandler, StyleSheet, View } from 'react-native';
import { WatchHistoryList } from '../WatchHistoryList';
import { AddSection } from './AddSection';
import { BlockedSection } from './BlockedSection';
import { DatabaseSection } from './DatabaseSection';
import { DecisionToast } from './DecisionToast';
import { ChannelScreen } from './ChannelScreen';
import { EmptyState } from './EmptyState';
import { LibrarySection } from './LibrarySection';
import { LinksSection } from './LinksSection';
import { LogSection } from './LogSection';
import { PanelHeader } from './PanelHeader';
import { PanelIndex } from './PanelIndex';
import { PendingSection } from './PendingSection';
import { PreviewScreen, type PreviewAction } from './PreviewScreen';
import { ScheduleSection } from './ScheduleSection';
import { SECTION_TITLE, type SectionKey } from './sections';
import { isBlockedChannelVideo } from '../../domain/panel';
import type { AddLinkResult } from '../../services/addByLink';
import type { ExportOutcome, PickOutcome, RestoreOutcome } from '../../services/databaseBackup';
import type { BackupFile } from '../../domain/backup';
import type {
  Channel,
  ChannelProposal,
  ExtraTimePool,
  Schedule,
  Video,
  VideoStatus,
  WatchHistoryEntry,
} from '../../domain/types';

type PanelScreen =
  | { name: 'index' }
  | { name: 'section'; section: SectionKey }
  | { name: 'channel'; channelId: string }
  | { name: 'preview'; video: Video; actions: PreviewAction; note?: string };

export interface ParentPanelProps {
  videos: Video[];
  channels: Channel[];
  channelProposals: ChannelProposal[];
  watchHistory: WatchHistoryEntry[];
  schedule?: Schedule;
  extraTime?: ExtraTimePool;
  usedSecondsToday: number;
  refreshing: boolean;
  youtubeLinkHandlerEnabled: boolean;
  onClose: () => void;
  onRefresh: () => void;
  onSetStatus: (video: Video, status: VideoStatus) => void;
  onRetract: (video: Video) => void;
  onExportBackup: () => Promise<ExportOutcome>;
  onPickBackup: () => Promise<PickOutcome>;
  onRestoreBackup: (file: BackupFile) => Promise<RestoreOutcome>;
  onVerifyPin: (pin: string) => Promise<boolean>;
  pinLockedUntil?: number;
  onTogglePolicy: (channel: Channel) => void;
  onToggleMuted: (channel: Channel) => void;
  onToggleBlocked: (channel: Channel) => void;
  onApproveChannel: (proposal: ChannelProposal) => void;
  onRejectChannel: (proposal: ChannelProposal) => void;
  onRetryChannel: (proposal: ChannelProposal) => void;
  onAddLink: (link: string) => Promise<AddLinkResult>;
  onResetUsage: () => void;
  onScheduleChange: (schedule: Schedule) => void;
  onChangePin: () => void;
  onYouTubeLinkHandlerChange: (enabled: boolean) => void;
  onOpenLinkHandlingSettings: () => void;
}

function SectionFrame({
  title,
  onBack,
  children,
}: {
  title: string;
  onBack: () => void;
  children: React.ReactNode;
}) {
  return (
    <View style={styles.screen}>
      <PanelHeader title={title} onBack={onBack} />
      {children}
    </View>
  );
}

/**
 * Parent panel container (ADR 0016): an explicit stack of screens with a back
 * address. Every screen stays mounted while covered, so filters and list
 * position survive a trip to a channel card or a preview.
 */
export function ParentPanel(props: ParentPanelProps) {
  const {
    videos,
    channels,
    channelProposals,
    watchHistory,
    schedule,
    extraTime,
    usedSecondsToday,
    refreshing,
    youtubeLinkHandlerEnabled,
    onClose,
    onRefresh,
    onSetStatus,
    onRetract,
    onExportBackup,
    onPickBackup,
    onRestoreBackup,
    onVerifyPin,
    pinLockedUntil,
    onTogglePolicy,
    onToggleMuted,
    onToggleBlocked,
    onApproveChannel,
    onRejectChannel,
    onRetryChannel,
    onAddLink,
    onResetUsage,
    onScheduleChange,
    onChangePin,
    onYouTubeLinkHandlerChange,
    onOpenLinkHandlingSettings,
  } = props;

  const [stack, setStack] = useState<PanelScreen[]>([{ name: 'index' }]);
  const stackRef = useRef(stack);
  stackRef.current = stack;

  // The decision bar lives for 10 seconds and only covers decisions taken in the
  // panel (ADR 0016).
  const [toast, setToast] = useState<
    { video: Video; status: VideoStatus; previous: VideoStatus; id: number } | undefined
  >();

  useEffect(() => {
    if (!toast) {
      return undefined;
    }
    const timer = setTimeout(() => setToast(undefined), 10_000);
    return () => clearTimeout(timer);
  }, [toast]);

  const decide = useCallback(
    (video: Video, status: VideoStatus) => {
      const previous = video.status;
      onSetStatus(video, status);
      setToast({ video, status, previous, id: Date.now() });
    },
    [onSetStatus],
  );

  const undoDecision = useCallback(() => {
    if (!toast) {
      return;
    }
    if (toast.previous === 'pending') {
      onRetract(toast.video);
    } else {
      onSetStatus(toast.video, toast.previous);
    }
    setToast(undefined);
  }, [toast, onRetract, onSetStatus]);

  const push = useCallback((screen: PanelScreen) => {
    setStack(current => [...current, screen]);
  }, []);

  const pop = useCallback(() => {
    setStack(current => (current.length > 1 ? current.slice(0, -1) : current));
  }, []);

  // Hardware back follows the same path as the on-screen arrow; at the index it
  // closes the panel (today the panel had no BackHandler at all).
  const closeTop = useCallback(() => {
    if (stackRef.current.length > 1) {
      setStack(current => current.slice(0, -1));
      return;
    }
    onClose();
  }, [onClose]);

  useEffect(() => {
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      closeTop();
      return true;
    });
    return () => subscription.remove();
  }, [closeTop]);

  const openSection = useCallback(
    (section: SectionKey) => {
      if (section === 'pin') {
        onChangePin();
        return;
      }
      push({ name: 'section', section });
    },
    [onChangePin, push],
  );

  const openChannel = useCallback(
    (channelId: string) => push({ name: 'channel', channelId }),
    [push],
  );

  const openPreview = useCallback(
    (video: Video) => {
      const blockedChannel = isBlockedChannelVideo(video, channels);
      // Films of a blocked channel are restored with “Odblokuj” on the channel
      // card, never with a per-film decision (ADR 0016).
      const actions: PreviewAction = blockedChannel
        ? 'none'
        : video.status === 'pending'
          ? 'pending'
          : video.status === 'allowed'
            ? 'allowed'
            : 'blocked';
      push({
        name: 'preview',
        video,
        actions,
        note: blockedChannel ? 'kanał zablokowany' : undefined,
      });
    },
    [channels, push],
  );

  const openHistoryPreview = useCallback(
    (entry: WatchHistoryEntry) => {
      const known = videos.find(video => video.id === entry.videoId);
      if (known) {
        openPreview(known);
        return;
      }
      push({
        name: 'preview',
        video: {
          id: entry.videoId,
          title: entry.title,
          channelTitle: entry.channelTitle,
          thumbnailUrl: entry.thumbnailUrl,
          status: 'blocked',
          source: 'rss',
          addedAt: entry.firstWatchedAt,
        },
        actions: 'none',
        note: 'nie ma już w bibliotece',
      });
    },
    [videos, openPreview, push],
  );

  const decideFromPreview = useCallback(
    (video: Video, status: VideoStatus) => {
      decide(video, status);
      pop();
    },
    [decide, pop],
  );

  const renderSection = (section: SectionKey, active: boolean) => {
    switch (section) {
      case 'pending':
        return (
          <PendingSection
            videos={videos}
            channels={channels}
            proposals={channelProposals}
            refreshing={refreshing}
            onRefresh={onRefresh}
            onSetStatus={decide}
            onPreview={openPreview}
            onApproveChannel={onApproveChannel}
            onRejectChannel={onRejectChannel}
            onRetryChannel={onRetryChannel}
          />
        );
      case 'library':
        return (
          <LibrarySection
            videos={videos}
            channels={channels}
            refreshing={refreshing}
            onRefresh={onRefresh}
            onSetStatus={decide}
            onPreview={openPreview}
            onEditChannel={openChannel}
            onOpenChannel={openChannel}
          />
        );
      case 'blocked':
        return (
          <BlockedSection
            videos={videos}
            channels={channels}
            onPreview={openPreview}
            onSetStatus={decide}
            onToggleBlocked={onToggleBlocked}
          />
        );
      case 'add':
        return (
          <AddSection
            active={active}
            videos={videos}
            channels={channels}
            onAddLink={onAddLink}
            onSetStatus={decide}
            onPreview={openPreview}
            onTogglePolicy={onTogglePolicy}
            onToggleMuted={onToggleMuted}
            onToggleBlocked={onToggleBlocked}
          />
        );
      case 'history':
        return (
          <WatchHistoryList
            entries={watchHistory}
            showThumbnails={false}
            onPreviewEntry={openHistoryPreview}
            emptyText="Historia oglądania jest pusta."
          />
        );
      case 'schedule':
        return (
          <ScheduleSection
            schedule={schedule}
            usedSecondsToday={usedSecondsToday}
            extraTime={extraTime}
            onResetUsage={onResetUsage}
            onScheduleChange={onScheduleChange}
          />
        );
      case 'links':
        return (
          <LinksSection
            youtubeLinkHandlerEnabled={youtubeLinkHandlerEnabled}
            onYouTubeLinkHandlerChange={onYouTubeLinkHandlerChange}
            onOpenLinkHandlingSettings={onOpenLinkHandlingSettings}
          />
        );
      case 'database':
        return (
          <DatabaseSection
            onExport={onExportBackup}
            onPick={onPickBackup}
            onRestore={onRestoreBackup}
            onVerifyPin={onVerifyPin}
            lockedUntil={pinLockedUntil}
          />
        );
      case 'log':
        return <LogSection />;
      default:
        return null;
    }
  };

  const screenKey = (screen: PanelScreen, index: number): string => {
    switch (screen.name) {
      case 'index':
        return `${index}:index`;
      case 'section':
        return `${index}:section:${screen.section}`;
      case 'channel':
        return `${index}:channel:${screen.channelId}`;
      case 'preview':
        return `${index}:preview:${screen.video.id}`;
    }
  };

  const renderScreen = (screen: PanelScreen, active: boolean) => {
    switch (screen.name) {
      case 'index':
        return (
          <PanelIndex
            videos={videos}
            channels={channels}
            proposals={channelProposals}
            watchHistory={watchHistory}
            schedule={schedule}
            extraTime={extraTime}
            usedSecondsToday={usedSecondsToday}
            youtubeLinkHandlerEnabled={youtubeLinkHandlerEnabled}
            onOpen={openSection}
            onClose={onClose}
          />
        );

      case 'section':
        return (
          <SectionFrame title={SECTION_TITLE[screen.section]} onBack={closeTop}>
            {renderSection(screen.section, active)}
          </SectionFrame>
        );

      case 'channel': {
        const channel = channels.find(candidate => candidate.id === screen.channelId);
        return (
          <SectionFrame title={channel?.title ?? 'Kanał'} onBack={closeTop}>
            {channel ? (
              <ChannelScreen
                channel={channel}
                videos={videos}
                onSetStatus={decide}
                onPreview={openPreview}
                onTogglePolicy={onTogglePolicy}
                onToggleMuted={onToggleMuted}
                onBlock={onToggleBlocked}
              />
            ) : (
              <EmptyState>Ten kanał nie istnieje już w bibliotece.</EmptyState>
            )}
          </SectionFrame>
        );
      }

      case 'preview':
        return (
          <PreviewScreen
            video={screen.video}
            actions={screen.actions}
            note={screen.note}
            onDecide={decideFromPreview}
            onClose={closeTop}
          />
        );
    }
  };

  return (
    <View style={styles.container}>
      {stack.map((screen, index) => {
        const active = index === stack.length - 1;
        return (
          <View
            key={screenKey(screen, index)}
            style={[styles.frame, !active && styles.hidden]}
            pointerEvents={active ? 'auto' : 'none'}
          >
            {renderScreen(screen, active)}
          </View>
        );
      })}
      {toast ? (
        <DecisionToast video={toast.video} status={toast.status} onUndo={undoDecision} />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  frame: { flex: 1 },
  hidden: { display: 'none' },
  screen: { flex: 1 },
});
