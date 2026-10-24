import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Alert, StatusBar, StyleSheet, Text, View } from 'react-native';
import { AsyncStorageRepository } from './src/data/asyncStorageRepository';
import type { Repository } from './src/data/repository';
import type {
  Channel,
  Decision,
  DecisionOutcome,
  ExtraTimePool,
  PinGuardState,
  Schedule,
  Settings,
  Video,
  VideoStatus,
  WatchHistoryEntry,
  WatchMode,
  WatchProgress,
} from './src/domain/types';
import { proposalsForChild, videosForChild } from './src/domain/content';
import { manualDecision, projectVideos, repeatProposalDecision } from './src/domain/decisions';
import {
  INITIAL_CHILD_NAV,
  goBackChild,
  openChildChannel as openChildChannelInNav,
  selectChildTab as selectChildTabInNav,
  type ChildNavState,
  type ChildTab,
} from './src/domain/childNavigation';
import { mergeWatchStretch } from './src/domain/watchHistory';
import { markCompleted, resumeSeconds, updateProgress } from './src/domain/watchState';
import {
  canPlay,
  consumeVideoSeconds,
  dateKey,
  emptyExtraTime,
  grantExtraTime,
  hasTimeGate,
  normalizeExtraTime,
  normalizeSchedule,
  remainingSecondsToday,
} from './src/domain/schedule';
import {
  EMPTY_PIN_GUARD,
  canAttempt,
  normalizePinGuard,
  recordFailure,
  recordSuccess,
} from './src/domain/pinGuard';
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
import { PinPrompt } from './src/ui/PinPrompt';
import { ParentScreen } from './src/ui/parent/ParentScreen';
import { PlayerScreen } from './src/ui/PlayerScreen';
import { PreviewScreen } from './src/ui/parent/PreviewScreen';
import { SOURCE_LABEL } from './src/ui/parent/PendingTab';
import { colors } from './src/ui/theme';

type Route =
  | { name: 'child' }
  | { name: 'parent' }
  | { name: 'player'; video: Video; audioOnly: boolean; startAtSeconds: number; startDurationSeconds: number }
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
  const [watchProgress, setWatchProgress] = useState<WatchProgress[]>([]);
  const [watchHistory, setWatchHistory] = useState<WatchHistoryEntry[]>([]);
  const [childNav, setChildNav] = useState<ChildNavState>(INITIAL_CHILD_NAV);
  const [extraTime, setExtraTime] = useState<ExtraTimePool>(() =>
    emptyExtraTime(dateKey(new Date())),
  );
  const [pinGuard, setPinGuard] = useState<PinGuardState>(EMPTY_PIN_GUARD);
  const [extraTimePrompt, setExtraTimePrompt] = useState<
    { video?: Video; resume: boolean } | undefined
  >();
  // Refs keep per-second playback accounting synchronous (no read-before-write
  // races between usage and the extra pool) while the UI still gets state.
  const usedSecondsRef = useRef(0);
  const usageDateRef = useRef(dateKey(new Date()));
  const extraTimeRef = useRef<ExtraTimePool>(emptyExtraTime(dateKey(new Date())));

  const reload = useCallback(async () => {
    const today = dateKey(new Date());
    const [s, c, v, d, used, progress, history, storedExtra, storedGuard] =
      await Promise.all([
        repo.getSettings(),
        repo.listChannels(),
        repo.listVideos(),
        repo.listDecisions(),
        repo.getUsage(today),
        repo.listWatchProgress(),
        repo.listWatchHistory(),
        repo.getExtraTime(),
        repo.getPinGuard(),
      ]);
    const normalizedExtra = normalizeExtraTime(storedExtra, today);
    const normalizedGuard = normalizePinGuard(storedGuard, Date.now());
    usedSecondsRef.current = used;
    usageDateRef.current = today;
    extraTimeRef.current = normalizedExtra;
    setSettings(s);
    setChannels(c);
    setVideos(v);
    setDecisions(d);
    setUsedSecondsToday(used);
    setWatchProgress(progress);
    setWatchHistory(history);
    setExtraTime(normalizedExtra);
    setPinGuard(normalizedGuard);
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
    () =>
      remainingSecondsToday(
        normalizeSchedule(settings.schedule),
        usedSecondsToday,
        extraTime,
      ),
    [settings.schedule, usedSecondsToday, extraTime],
  );

  const canAddExtraTime = useMemo(
    () => hasTimeGate(normalizeSchedule(settings.schedule)),
    [settings.schedule],
  );

  // Watching progress per video (ADR 0004): feeds the “stan obejrzenia” badge
  // and the resume position.
  const watchProgressById = useMemo(
    () => new Map(watchProgress.map(progress => [progress.videoId, progress])),
    [watchProgress],
  );

  // ---- Child navigation (ADR 0004a) ---------------------------------------
  // The path lives here (not in ChildHomeScreen) so opening the player does not
  // lose the context: back returns to the channel or feed the child left.
  const selectChildTab = useCallback((tab: ChildTab) => {
    setChildNav(state => selectChildTabInNav(state, tab));
  }, []);

  const openChildChannel = useCallback((channel: Channel) => {
    setChildNav(state => openChildChannelInNav(state, channel));
  }, []);

  const backChild = useCallback(() => {
    setChildNav(state => goBackChild(state));
  }, []);

  // ---- Playback start & time controls (ADR 0002) ---------------------------

  // Opening a video resumes where the child stopped (ADR 0004).
  const openPlayer = useCallback(
    (video: Video, audioOnly: boolean) => {
      const progress = watchProgressById.get(video.id);
      setRoute({
        name: 'player',
        video,
        audioOnly,
        startAtSeconds: resumeSeconds(progress),
        startDurationSeconds: progress?.durationSeconds ?? 0,
      });
    },
    [watchProgressById],
  );

  // Extra time is a parent action: PIN first, then choose the amount
  // (ADR 0011/0012). `resume` tells the grant handler whether the player is
  // already showing this film (then the player resumes itself).
  const requestExtraTime = useCallback(
    (video?: Video) => {
      const resume = route.name === 'player' && route.video.id === video?.id;
      setExtraTimePrompt({ video, resume });
    },
    [route],
  );

  // Video is gated by the window and the daily budget; audio never is.
  const startPlay = useCallback(
    async (video: Video) => {
      const schedule = normalizeSchedule(settings.schedule);
      const today = new Date();
      const used = await repo.getUsage(dateKey(today));
      const extra = normalizeExtraTime(extraTimeRef.current, dateKey(today));
      const decision = canPlay(schedule, 'video', used, today, extra);
      if (!decision.allowed) {
        Alert.alert(
          'Teraz nie można oglądać',
          decision.reason === 'daily-limit'
            ? 'Dzienny limit czasu został wykorzystany. Możesz jeszcze posłuchać z wyłączonym obrazem.'
            : 'Poza godzinami oglądania. Możesz jeszcze posłuchać z wyłączonym obrazem.',
          [
            { text: 'Wróć', style: 'cancel' },
            { text: 'Tylko dźwięk', isPreferred: true, onPress: () => openPlayer(video, true) },
            ...(canAddExtraTime
              ? [{ text: 'Dodaj czas', onPress: () => requestExtraTime(video) }]
              : []),
          ],
        );
        return;
      }
      openPlayer(video, false);
    },
    [repo, settings.schedule, openPlayer, canAddExtraTime, requestExtraTime],
  );

  // History is a snapshot: only materials still in the child's library can be
  // opened again. Removed/blocked videos keep their history entry but do not
  // lead anywhere.
  const playHistoryEntry = useCallback(
    (entry: WatchHistoryEntry) => {
      const video = childVideos.find(candidate => candidate.id === entry.videoId);
      if (!video) {
        Alert.alert(
          'Film niedostępny',
          'Ten film nie jest już dostępny w bibliotece dziecka.',
        );
        return;
      }
      startPlay(video);
    },
    [childVideos, startPlay],
  );

  // The player reports actual playback seconds in increments (ADR 0003: the
  // daily budget counts real play time, not time on the player screen). Audio
  // never consumes the budget (ADR 0002) but is recorded in the viewing history
  // with its mode (ADR 0004).
  const recordPlayed = useCallback(
    async (video: Video, seconds: number, mode: WatchMode) => {
      if (seconds <= 0) {
        return;
      }
      const now = new Date();
      const today = dateKey(now);
      if (mode === 'video') {
        if (usageDateRef.current !== today) {
          usageDateRef.current = today;
          usedSecondsRef.current = 0;
        }
        const currentPool = normalizeExtraTime(extraTimeRef.current, today);
        const nextPool = consumeVideoSeconds(
          normalizeSchedule(settings.schedule),
          now,
          usedSecondsRef.current,
          currentPool,
          seconds,
        );
        usedSecondsRef.current += seconds;
        extraTimeRef.current = nextPool;
        setUsedSecondsToday(usedSecondsRef.current);
        setExtraTime(nextPool);
        console.log('[KidTube:usage] +' + seconds + 's');
        repo.addUsageSeconds(today, seconds).catch(() => undefined);
        if (nextPool.remainingSeconds !== currentPool.remainingSeconds) {
          repo.saveExtraTime(nextPool).catch(() => undefined);
        }
      }
      const entry = mergeWatchStretch(await repo.getWatchHistoryEntry(video.id, today), {
        video,
        dateKey: today,
        mode,
        seconds,
        at: Date.now(),
      });
      await repo.saveWatchHistory(entry);
    },
    [repo, settings.schedule],
  );

  // Store the resume position (ADR 0004). The player throttles this to a few
  // seconds while playing and reports once more when it unmounts.
  const recordProgress = useCallback(
    async (video: Video, positionSeconds: number, durationSeconds: number) => {
      const next = updateProgress(
        await repo.getWatchProgress(video.id),
        video.id,
        positionSeconds,
        Date.now(),
        durationSeconds,
      );
      await repo.saveWatchProgress(next);
      setWatchProgress(previous => [...previous.filter(p => p.videoId !== video.id), next]);
    },
    [repo],
  );

  // Reaching the end marks the video as fully watched (ADR 0004).
  const recordCompleted = useCallback(
    async (video: Video) => {
      const now = Date.now();
      const existing = (await repo.getWatchProgress(video.id)) ?? {
        videoId: video.id,
        positionSeconds: 0,
        completed: false,
        lastWatchedAt: now,
      };
      const next = markCompleted(existing, now);
      await repo.saveWatchProgress(next);
      setWatchProgress(previous => [...previous.filter(p => p.videoId !== video.id), next]);
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

  // Shared PIN check for the parent panel and the extra-time prompt
  // (ADR 0012). The guard state is re-read from the repository so both entry
  // points share the same counter and lockout.
  const verifyParentPin = useCallback(
    async (pin: string): Promise<boolean> => {
      if (!settings.pinHash || !settings.pinSalt || !settings.pinIterations) {
        return false;
      }
      const now = Date.now();
      const stored = normalizePinGuard(await repo.getPinGuard(), now);
      if (!canAttempt(stored, now)) {
        setPinGuard(stored);
        return false;
      }
      const ok = await verifyPin(pin, {
        hash: settings.pinHash,
        salt: settings.pinSalt,
        iterations: settings.pinIterations,
      });
      const next = ok ? recordSuccess() : recordFailure(stored, now);
      await repo.savePinGuard(next);
      setPinGuard(next);
      return ok;
    },
    [repo, settings.pinHash, settings.pinSalt, settings.pinIterations],
  );

  const onUnlock = async (pin: string) => {
    const ok = await verifyParentPin(pin);
    if (ok) {
      setParentGate(false);
      setRoute({ name: 'parent' });
      // Refresh the daily-budget readout shown in the parent panel (ADR 0002).
      reload().catch(() => undefined);
    }
    return ok;
  };

  const grantExtraTimeAmount = async (
    pending: { video?: Video; resume: boolean },
    amountSeconds: number,
  ) => {
    const today = dateKey(new Date());
    const current = normalizeExtraTime(extraTimeRef.current, today);
    const next = grantExtraTime(current, today, amountSeconds);
    extraTimeRef.current = next;
    setExtraTime(next);
    await repo.saveExtraTime(next);
    if (pending.video && !pending.resume) {
      openPlayer(pending.video, false);
    }
  };

  // PIN passed: close the PIN prompt, then ask how much extra time to grant.
  const submitExtraTime = async (pin: string) => {
    const ok = await verifyParentPin(pin);
    if (!ok) {
      return false;
    }
    const pending = extraTimePrompt;
    setExtraTimePrompt(undefined);
    if (!pending) {
      return true;
    }
    Alert.alert(
      'Ile dodatkowego czasu?',
      'Wybierz ilość czasu wideo na dziś.',
      [
        {
          text: '+15 minut',
          onPress: () => {
            grantExtraTimeAmount(pending, 15 * 60).catch(() => undefined);
          },
        },
        {
          text: '+1 godzina',
          onPress: () => {
            grantExtraTimeAmount(pending, 60 * 60).catch(() => undefined);
          },
        },
        { text: 'Anuluj', style: 'cancel' },
      ],
    );
    return true;
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
    const today = dateKey(new Date());
    await repo.resetUsage(today);
    const pool = emptyExtraTime(today);
    usedSecondsRef.current = 0;
    usageDateRef.current = today;
    extraTimeRef.current = pool;
    setExtraTime(pool);
    await repo.saveExtraTime(pool);
    await reload();
  };

  const changeSchedule = async (schedule: Schedule) => {
    const next = await repo.updateSettings({ schedule });
    setSettings(next);
  };

  // ---- Render --------------------------------------------------------------

  const extraTimePinPrompt = extraTimePrompt ? (
    <PinPrompt
      visible
      title="Dodaj więcej czasu"
      subtitle="Najpierw potwierdź kodem rodzica. Potem wybierzesz, ile czasu dodać."
      lockedUntil={pinGuard.lockedUntil}
      onSubmit={submitExtraTime}
      onCancel={() => setExtraTimePrompt(undefined)}
    />
  ) : null;


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
          lockedUntil={pinGuard.lockedUntil}
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
          startAtSeconds={route.startAtSeconds}
          startDurationSeconds={route.startDurationSeconds}
          onAudioOnlyChange={audioOnly =>
            setRoute({
              name: 'player',
              video: route.video,
              audioOnly,
              startAtSeconds: route.startAtSeconds,
              startDurationSeconds: route.startDurationSeconds,
            })
          }
          onPlayedSeconds={(seconds, mode) => recordPlayed(route.video, seconds, mode)}
          onProgress={(position, duration) => recordProgress(route.video, position, duration)}
          onCompleted={() => recordCompleted(route.video)}
          remainingVideoSeconds={remainingVideoSeconds}
          canAddExtraTime={canAddExtraTime}
          onAddExtraTime={() => requestExtraTime(route.video)}
          onClose={() => {
            setRoute({ name: 'child' });
            // Refresh today's used time after a playback session.
            reload().catch(() => undefined);
          }}
        />
        {extraTimePinPrompt}
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
          watchHistory={watchHistory}
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
          extraTime={extraTime}
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
        watchProgress={watchProgress}
        channels={channels}
        watchHistory={watchHistory}
        proposals={childProposals}
        nav={childNav}
        refreshing={refreshing}
        onRefresh={sync}
        onPlay={startPlay}
        onPropose={proposeLink}
        onOpenParent={() => setParentGate(true)}
        onSelectTab={selectChildTab}
        onOpenChannel={openChildChannel}
        onPlayHistoryEntry={playHistoryEntry}
        canAddExtraTime={canAddExtraTime}
        onAddExtraTime={() => requestExtraTime()}
        onBack={backChild}
      />
      {extraTimePinPrompt}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  center: { flex: 1, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center' },
  errorText: { color: colors.danger, padding: 24, textAlign: 'center' },
});
