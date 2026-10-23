import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Alert, StatusBar, StyleSheet, Text, View } from 'react-native';
import { AsyncStorageRepository } from './src/data/asyncStorageRepository';
import type { Repository } from './src/data/repository';
import type { Channel, Decision, DecisionOutcome, Schedule, Settings, Video, VideoStatus } from './src/domain/types';
import { proposalsForChild, videosForChild } from './src/domain/content';
import { manualDecision, projectVideos, repeatProposalDecision } from './src/domain/decisions';
import { canPlay, dateKey, normalizeSchedule, remainingSecondsToday } from './src/domain/schedule';
import { extractYouTubeUrl, parseYouTubeLink } from './src/domain/youtubeUrl';
import { handleIncomingLink } from './src/services/incomingLink';
import { ENABLE_TEST_SEED, SEED_REPLACED_IDS, SEED_TEST_VIDEOS } from './src/dev/seed';
import { consumeSharedText, getInitialLink, subscribeIncomingLinks } from './src/native/shareIntent';
import { hashPin, verifyPin } from './src/security/pin';
import { syncAllChannels, syncChannel, fetchChannelFeed } from './src/services/channelSync';
import { resolveChannelFromUrl } from './src/services/channelResolve';
import { fetchOEmbed, fetchPublishDate } from './src/services/youtubeMetadata';
import { ChildHomeScreen } from './src/ui/ChildHomeScreen';
import { GateScreen } from './src/ui/GateScreen';
import { ParentScreen } from './src/ui/parent/ParentScreen';
import { PlayerScreen } from './src/ui/PlayerScreen';
import { PreviewScreen } from './src/ui/parent/PreviewScreen';
import { SOURCE_LABEL } from './src/ui/parent/PendingTab';
import { colors } from './src/ui/theme';

type Route =
  | { name: 'child' }
  | { name: 'parent' }
  | { name: 'player'; video: Video; audioOnly: boolean }
  | { name: 'preview'; video: Video };

function createRepository(): Repository {
  return new AsyncStorageRepository();
}

export default function App() {
  const repoRef = useRef<Repository | null>(null);
  if (!repoRef.current) {
    repoRef.current = createRepository();
  }
  const repo = repoRef.current;

  const [ready, setReady] = useState(false);
  const [initError, setInitError] = useState<string | undefined>();
  const [settings, setSettings] = useState<Settings>({});
  const [channels, setChannels] = useState<Channel[]>([]);
  const [videos, setVideos] = useState<Video[]>([]);
  const [decisions, setDecisions] = useState<Decision[]>([]);
  const [parentGate, setParentGate] = useState(false);
  const [pinSetup, setPinSetup] = useState(false);
  const [route, setRoute] = useState<Route>({ name: 'child' });
  const [refreshing, setRefreshing] = useState(false);
  const [usedSecondsToday, setUsedSecondsToday] = useState(0);

  const reload = useCallback(async () => {
    const [s, c, v, d, used] = await Promise.all([
      repo.getSettings(),
      repo.listChannels(),
      repo.listVideos(),
      repo.listDecisions(),
      repo.getUsage(dateKey(new Date())),
    ]);
    setSettings(s);
    setChannels(c);
    setVideos(v);
    setDecisions(d);
    setUsedSecondsToday(used);
    console.log(
      '[KidTube:usage] loaded used=' +
        used +
        's limit=' +
        (s.schedule?.dailyLimitMinutes ?? 0) +
        'min schedule=' +
        JSON.stringify(s.schedule),
    );
  }, [repo]);

  useEffect(() => {
    (async () => {
      try {
        await repo.init();
        if (ENABLE_TEST_SEED) {
          for (const id of SEED_REPLACED_IDS) {
            if (await repo.getVideo(id)) {
              await repo.removeVideo(id);
            }
          }
          for (const video of SEED_TEST_VIDEOS) {
            if (!(await repo.getVideo(video.id))) {
              await repo.upsertVideos([video]);
            }
          }
        }
        await reload();
      } catch (error) {
        setInitError(error instanceof Error ? error.message : String(error));
      } finally {
        setReady(true);
      }
    })();
  }, [repo, reload]);

  const blockedChannelIds = useMemo(
    () => new Set(channels.filter(c => c.status === 'blocked').map(c => c.id)),
    [channels],
  );

  // Visibility is projected from the decision history (ADR 0001); the stored
  // `Video.status` is only a cache. Everything downstream reads this list.
  const projectedVideos = useMemo(() => projectVideos(videos, decisions), [videos, decisions]);

  const childVideos = useMemo(
    () =>
      videosForChild(projectedVideos, decisions).filter(
        v => !v.channelId || !blockedChannelIds.has(v.channelId),
      ),
    [projectedVideos, decisions, blockedChannelIds],
  );

  const childProposals = useMemo(() => proposalsForChild(projectedVideos), [projectedVideos]);

  // Minutes left in today's video budget, shown to the child (ADR 0002/0004).
  const remainingVideoSeconds = useMemo(
    () => remainingSecondsToday(normalizeSchedule(settings.schedule), usedSecondsToday),
    [settings.schedule, usedSecondsToday],
  );

  // ---- Playback start & time controls (ADR 0002) ---------------------------

  const openPlayer = useCallback((video: Video, audioOnly: boolean) => {
    setRoute({ name: 'player', video, audioOnly });
  }, []);

  // Video is gated by the window and the daily budget; audio never is.
  const startPlay = useCallback(
    async (video: Video) => {
      const schedule = normalizeSchedule(settings.schedule);
      const today = new Date();
      const used = await repo.getUsage(dateKey(today));
      const decision = canPlay(schedule, 'video', used, today);
      if (!decision.allowed) {
        Alert.alert(
          'Teraz nie można oglądać',
          decision.reason === 'daily-limit'
            ? 'Dzienny limit czasu został wykorzystany. Możesz jeszcze posłuchać z wyłączonym obrazem.'
            : 'Poza godzinami oglądania. Możesz jeszcze posłuchać z wyłączonym obrazem.',
          [
            { text: 'Wróć', style: 'cancel' },
            { text: 'Tylko dźwięk', isPreferred: true, onPress: () => openPlayer(video, true) },
          ],
        );
        return;
      }
      openPlayer(video, false);
    },
    [repo, settings.schedule, openPlayer],
  );

  // The player reports actual playback seconds in increments (ADR 0003: the
  // daily budget counts real play time, not time on the player screen). Audio
  // never reports, so it never consumes the budget (ADR 0002).
  const recordPlayedSeconds = useCallback(
    (seconds: number) => {
      if (seconds <= 0) {
        return;
      }
      console.log('[KidTube:usage] +' + seconds + 's');
      setUsedSecondsToday(previous => previous + seconds);
      repo.addUsageSeconds(dateKey(new Date()), seconds).catch(() => undefined);
    },
    [repo],
  );

  // ---- Incoming links (share / VIEW intent) --------------------------------
  const processIncomingLink = useCallback(
    async (raw: string) => {
      const link = extractYouTubeUrl(raw) ?? raw;
      const result = await handleIncomingLink(link, repo);
      switch (result.kind) {
        case 'play':
          await startPlay(result.video);
          break;
        case 'pending':
          await reload();
          Alert.alert('Dodano do zatwierdzenia', result.video.title);
          break;
        case 'blocked':
          Alert.alert('Zablokowane', 'Ten film znajduje się na czarnej liście.');
          break;
        case 'channel':
          Alert.alert('Kanał już obserwowany', result.channel.title);
          break;
        case 'channel-proposal':
          Alert.alert(
            'Nowy kanał',
            'Aby dodać ten kanał, użyj przycisku „Udostępnij” w aplikacji YouTube albo wklej link w panelu rodzica.',
          );
          break;
        default:
          break;
      }
    },
    [repo, reload, startPlay],
  );

  useEffect(() => {
    if (!ready) {
      return undefined;
    }
    let active = true;
    (async () => {
      const shared = (await consumeSharedText()) ?? (await getInitialLink());
      if (active && shared) {
        await processIncomingLink(shared);
      }
    })();
    const unsubscribe = subscribeIncomingLinks(raw => {
      processIncomingLink(raw).catch(() => undefined);
    });
    return () => {
      active = false;
      unsubscribe();
    };
  }, [ready, processIncomingLink]);

  // ---- Child proposes a video (ADR 0001: source 'propose') -----------------
  const proposeLink = useCallback(
    async (raw: string) => {
      const link = extractYouTubeUrl(raw) ?? raw;
      const result = await handleIncomingLink(link, repo, undefined, Date.now(), 'propose');
      if (result.kind === 'play' || result.kind === 'blocked' || result.kind === 'pending') {
        // A repeat proposal resolves automatically to the latest decision and is
        // recorded as an `auto` entry (ADR 0001). First-time proposals stay pending.
        const auto = repeatProposalDecision(await repo.listDecisions(), result.video.id, Date.now());
        if (auto) {
          await repo.recordDecision(auto);
          await reload();
        }
      }
      switch (result.kind) {
        case 'play':
          Alert.alert('Dozwolony', 'Ten film jest już w Twojej bibliotece.');
          break;
        case 'blocked':
          Alert.alert('Zablokowane', 'Rodzic zablokował ten film.');
          break;
        case 'pending':
          await reload();
          Alert.alert('Dodano do zatwierdzenia', result.video.title);
          break;
        case 'channel':
        case 'channel-proposal':
          Alert.alert('To nie jest film', 'Wklej link do konkretnego filmu, nie kanału.');
          break;
        default:
          Alert.alert('Nie rozpoznano', 'Sprawdź, czy link jest poprawny.');
          break;
      }
    },
    [repo, reload],
  );

  // ---- Gate handling -------------------------------------------------------

  const onSetupPin = async (pin: string) => {
    const record = await hashPin(pin);
    const next = await repo.updateSettings({
      pinHash: record.hash,
      pinSalt: record.salt,
      pinIterations: record.iterations,
      configured: true,
    });
    setSettings(next);
    setPinSetup(false);
    setRoute({ name: 'child' });
    return true;
  };

  const onUnlock = async (pin: string) => {
    if (!settings.pinHash || !settings.pinSalt || !settings.pinIterations) {
      return false;
    }
    const ok = await verifyPin(pin, {
      hash: settings.pinHash,
      salt: settings.pinSalt,
      iterations: settings.pinIterations,
    });
    if (ok) {
      setParentGate(false);
      setRoute({ name: 'parent' });
      // Refresh the daily-budget readout shown in the parent panel (ADR 0002).
      reload().catch(() => undefined);
    }
    return ok;
  };

  // ---- Parent actions ------------------------------------------------------

  const addChannelLink = async (link: string, autoApprove: boolean): Promise<string | undefined> => {
    const parsed = parseYouTubeLink(link);
    const policy = autoApprove ? 'auto_approve' : 'manual';
    console.log('[KidTube:addChannel]', link, 'parsed=', JSON.stringify(parsed));

    if (parsed.kind === 'video') {
      const [meta, publishedAt] = await Promise.all([
        fetchOEmbed(parsed.videoId),
        fetchPublishDate(parsed.videoId),
      ]);
      const video: Video = {
        id: parsed.videoId,
        title: meta?.title ?? parsed.videoId,
        thumbnailUrl: meta?.thumbnailUrl,
        publishedAt,
        status: autoApprove ? 'allowed' : 'pending',
        source: 'manual',
        addedAt: Date.now(),
      };
      await repo.upsertVideos([video]);
      if (autoApprove) {
        // The parent approved it by hand — record that as a manual decision.
        await repo.recordDecision(manualDecision(video, 'allow', video.addedAt));
      }
      await reload();
      return undefined;
    }

    if (parsed.kind === 'channel' && parsed.channelId) {
      const entries = await fetchChannelFeed(parsed.channelId);
      const title = entries[0]?.channelTitle ?? parsed.channelId;
      const channel: Channel = {
        id: parsed.channelId,
        title,
        policy,
        status: 'allowed',
        addedAt: Date.now(),
      };
      await repo.upsertChannel(channel);
      await syncChannel(repo, channel);
      await reload();
      return undefined;
    }

    if (parsed.kind === 'channel') {
      const pageUrl = /^https?:\/\//i.test(parsed.raw)
        ? parsed.raw
        : parsed.handle
          ? `https://www.youtube.com/@${parsed.handle}`
          : `https://www.youtube.com/c/${parsed.slug ?? ''}`;
      const resolved = await resolveChannelFromUrl(pageUrl);
      console.log('[KidTube:addChannel] resolved=', JSON.stringify(resolved));
      if (!resolved) {
        return 'Nie udało się rozpoznać kanału z tego linku. Spróbuj wkleić pełny link do kanału z YouTube.';
      }
      const channel: Channel = {
        id: resolved.channelId,
        title: resolved.title,
        handle: resolved.handle,
        policy,
        status: 'allowed',
        addedAt: Date.now(),
      };
      await repo.upsertChannel(channel);
      await syncChannel(repo, channel);
      await reload();
      return undefined;
    }

    return 'Nie rozpoznaję tego linku.';
  };

  const toggleChannelPolicy = async (channel: Channel) => {
    const next: Channel = {
      ...channel,
      policy: channel.policy === 'auto_approve' ? 'manual' : 'auto_approve',
    };
    await repo.upsertChannel(next);
    if (next.policy === 'auto_approve') {
      // Switching to auto-approve lets the channel's pending videos in; record
      // one manual decision each so the change is visible in the history.
      const toApprove = projectedVideos.filter(
        v => v.channelId === channel.id && v.status === 'pending',
      );
      for (const v of toApprove) {
        await repo.recordDecision(manualDecision(v, 'allow', Date.now()));
      }
    }
    await reload();
  };

  const toggleChannelBlocked = async (channel: Channel) => {
    await repo.upsertChannel({
      ...channel,
      status: channel.status === 'blocked' ? 'allowed' : 'blocked',
    });
    await reload();
  };

  const removeChannel = async (channel: Channel) => {
    await repo.removeChannel(channel.id);
    await reload();
  };

  // A parent action becomes a `manual` decision in the append-only history.
  const setVideoStatus = async (video: Video, status: VideoStatus) => {
    const outcome: DecisionOutcome = status === 'allowed' ? 'allow' : 'reject';
    await repo.recordDecision(manualDecision(video, outcome, Date.now()));
    await reload();
  };

  const sync = async () => {
    setRefreshing(true);
    try {
      await syncAllChannels(repo);
      await reload();
    } finally {
      setRefreshing(false);
    }
  };

  const setChildName = async (childName: string) => {
    const next = await repo.updateSettings({ childName });
    setSettings(next);
  };

  const resetUsageToday = async () => {
    await repo.resetUsage(dateKey(new Date()));
    await reload();
  };

  const changeSchedule = async (schedule: Schedule) => {
    const next = await repo.updateSettings({ schedule });
    setSettings(next);
  };

  // ---- Render --------------------------------------------------------------

  if (initError) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorText}>Błąd inicjalizacji: {initError}</Text>
      </View>
    );
  }

  if (!ready) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  if (!settings.pinHash || pinSetup) {
    return (
      <View style={styles.root}>
        <StatusBar barStyle="light-content" />
        <GateScreen
          mode="setup"
          title={pinSetup ? 'Nowy kod rodzica' : 'Witaj w KidTube'}
          subtitle="Ustaw kod, którym będziesz zatwierdzać filmy i wchodzić w panel rodzica."
          onSubmit={onSetupPin}
          onCancel={pinSetup ? () => setPinSetup(false) : undefined}
        />
      </View>
    );
  }

  if (parentGate) {
    return (
      <View style={styles.root}>
        <StatusBar barStyle="light-content" />
        <GateScreen
          mode="unlock"
          title="Panel rodzica"
          onSubmit={onUnlock}
          onCancel={() => setParentGate(false)}
        />
      </View>
    );
  }

  if (route.name === 'player') {
    return (
      <View style={styles.root}>
        <StatusBar barStyle="light-content" hidden />
        <PlayerScreen
          video={route.video}
          audioOnly={route.audioOnly}
          onAudioOnlyChange={audioOnly => setRoute({ name: 'player', video: route.video, audioOnly })}
          onPlayedSeconds={recordPlayedSeconds}
          remainingVideoSeconds={remainingVideoSeconds}
          onClose={() => {
            setRoute({ name: 'child' });
            // Refresh today's used time after a playback session.
            reload().catch(() => undefined);
          }}
        />
      </View>
    );
  }

  if (route.name === 'preview') {
    return (
      <View style={styles.root}>
        <StatusBar barStyle="light-content" hidden />
        <PreviewScreen
          video={route.video}
          sourceLabel={SOURCE_LABEL[route.video.source]}
          onClose={() => setRoute({ name: 'parent' })}
          onDecide={async (video, status) => {
            await setVideoStatus(video, status);
            setRoute({ name: 'parent' });
          }}
        />
      </View>
    );
  }

  if (route.name === 'parent') {
    return (
      <View style={styles.root}>
        <StatusBar barStyle="light-content" />
        <ParentScreen
          childName={settings.childName}
          channels={channels}
          videos={projectedVideos}
          onSetVideoStatus={setVideoStatus}
          onPreviewVideo={video => setRoute({ name: 'preview', video })}
          refreshing={refreshing}
          onAddChannelLink={addChannelLink}
          onToggleChannelPolicy={toggleChannelPolicy}
          onBlockChannel={toggleChannelBlocked}
          onRemoveChannel={removeChannel}
          onSync={sync}
          onChangePin={() => setPinSetup(true)}
          onChildName={setChildName}
          schedule={settings.schedule}
          usedSecondsToday={usedSecondsToday}
          onResetUsage={resetUsageToday}
          onScheduleChange={changeSchedule}
          onClose={() => setRoute({ name: 'child' })}
        />
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <StatusBar barStyle="light-content" />
      <ChildHomeScreen
        childName={settings.childName}
        remainingVideoSeconds={remainingVideoSeconds}
        videos={childVideos}
        proposals={childProposals}
        refreshing={refreshing}
        onRefresh={sync}
        onPlay={startPlay}
        onPropose={proposeLink}
        onOpenParent={() => setParentGate(true)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  center: { flex: 1, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center' },
  errorText: { color: colors.danger, padding: 24, textAlign: 'center' },
});
