import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Alert, StatusBar, StyleSheet, Text, View } from 'react-native';
import { AsyncStorageRepository } from './src/data/asyncStorageRepository';
import type { Repository } from './src/data/repository';
import type { Channel, Schedule, Settings, Video, VideoStatus } from './src/domain/types';
import { videosForChild } from './src/domain/content';
import { canPlay, dateKey, isAudioOnlyNow, normalizeSchedule } from './src/domain/schedule';
import { extractYouTubeUrl, parseYouTubeLink } from './src/domain/youtubeUrl';
import { handleIncomingLink } from './src/services/incomingLink';
import { ENABLE_TEST_SEED, SEED_TEST_VIDEOS } from './src/dev/seed';
import { consumeSharedText, getInitialLink, subscribeIncomingLinks } from './src/native/shareIntent';
import { hashPin, verifyPin } from './src/security/pin';
import { syncAllChannels, syncChannel, fetchChannelFeed } from './src/services/channelSync';
import { resolveChannelFromUrl } from './src/services/channelResolve';
import { fetchOEmbed } from './src/services/youtubeMetadata';
import { ChildHomeScreen } from './src/ui/ChildHomeScreen';
import { GateScreen } from './src/ui/GateScreen';
import { ParentScreen } from './src/ui/parent/ParentScreen';
import { PlayerScreen } from './src/ui/PlayerScreen';
import { colors } from './src/ui/theme';

type Route =
  | { name: 'child' }
  | { name: 'parent' }
  | { name: 'player'; video: Video; audioOnly: boolean };

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
  const [parentGate, setParentGate] = useState(false);
  const [pinSetup, setPinSetup] = useState(false);
  const [route, setRoute] = useState<Route>({ name: 'child' });
  const [refreshing, setRefreshing] = useState(false);

  const reload = useCallback(async () => {
    const [s, c, v] = await Promise.all([
      repo.getSettings(),
      repo.listChannels(),
      repo.listVideos(),
    ]);
    setSettings(s);
    setChannels(c);
    setVideos(v);
  }, [repo]);

  useEffect(() => {
    (async () => {
      try {
        await repo.init();
        if (ENABLE_TEST_SEED) {
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

  const childVideos = useMemo(
    () => videosForChild(videos).filter(v => !v.channelId || !blockedChannelIds.has(v.channelId)),
    [videos, blockedChannelIds],
  );

  // ---- Playback start & time controls --------------------------------------

  const startPlay = useCallback(
    async (video: Video) => {
      const schedule = normalizeSchedule(settings.schedule);
      const today = new Date();
      const used = await repo.getUsage(dateKey(today));
      const decision = canPlay(schedule, used, today);
      if (!decision.allowed) {
        Alert.alert(
          'Teraz nie można oglądać',
          decision.reason === 'daily-limit'
            ? 'Dzienny limit czasu został wykorzystany. Wróć jutro!'
            : 'Poza godzinami oglądania. Wróć w dozwolonym czasie.',
        );
        return;
      }
      setRoute({ name: 'player', video, audioOnly: isAudioOnlyNow(schedule, today) });
    },
    [repo, settings.schedule],
  );

  // Record playback seconds while the player is open.
  useEffect(() => {
    if (route.name !== 'player') {
      return undefined;
    }
    const startedAt = Date.now();
    return () => {
      const seconds = Math.round((Date.now() - startedAt) / 1000);
      if (seconds > 0) {
        repo.addUsageSeconds(dateKey(new Date(startedAt)), seconds).catch(() => undefined);
      }
    };
  }, [route, repo]);

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
    }
    return ok;
  };

  // ---- Parent actions ------------------------------------------------------

  const addChannelLink = async (link: string, autoApprove: boolean): Promise<string | undefined> => {
    const parsed = parseYouTubeLink(link);
    const policy = autoApprove ? 'auto_approve' : 'manual';
    console.log('[KidTube:addChannel]', link, 'parsed=', JSON.stringify(parsed));

    if (parsed.kind === 'video') {
      const meta = await fetchOEmbed(parsed.videoId);
      const video: Video = {
        id: parsed.videoId,
        title: meta?.title ?? parsed.videoId,
        thumbnailUrl: meta?.thumbnailUrl,
        status: autoApprove ? 'allowed' : 'pending',
        source: 'manual',
        addedAt: Date.now(),
      };
      await repo.upsertVideos([video]);
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
      const toApprove = videos.filter(v => v.channelId === channel.id && v.status === 'pending');
      for (const v of toApprove) {
        await repo.setVideoStatus(v.id, 'allowed');
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

  const setVideoStatus = async (video: Video, status: VideoStatus) => {
    await repo.setVideoStatus(video.id, status);
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
          onClose={() => setRoute({ name: 'child' })}
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
          videos={videos}
          onSetVideoStatus={setVideoStatus}
          refreshing={refreshing}
          onAddChannelLink={addChannelLink}
          onToggleChannelPolicy={toggleChannelPolicy}
          onBlockChannel={toggleChannelBlocked}
          onRemoveChannel={removeChannel}
          onSync={sync}
          onChangePin={() => setPinSetup(true)}
          onChildName={setChildName}
          schedule={settings.schedule}
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
        videos={childVideos}
        refreshing={refreshing}
        onRefresh={sync}
        onPlay={startPlay}
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
