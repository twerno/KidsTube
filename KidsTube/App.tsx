import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Alert, StatusBar, StyleSheet, Text, View } from 'react-native';
import { AsyncStorageRepository } from './src/data/asyncStorageRepository';
import type { Repository } from './src/data/repository';
import type {
  Channel,
  ChannelPolicy,
  ChannelProposal,
  Decision,
  DecisionOutcome,
  ExtraTimePool,
  PinGuardState,
  PinRecord,
  Schedule,
  Settings,
  Video,
  VideoStatus,
  WatchHistoryEntry,
  WatchMode,
  WatchProgress,
} from './src/domain/types';
import { proposalsForChild, videosForChild } from './src/domain/content';
import { isBlockedChannelVideo } from './src/domain/panel';
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
import {
  handleIncomingLink,
  shouldProcessIncomingLink,
  type IncomingLinkOrigin,
} from './src/services/incomingLink';
import { ENABLE_TEST_SEED, SEED_REPLACED_IDS, SEED_TEST_VIDEOS } from './src/dev/seed';
import {
  approveChannelProposal,
  rejectChannelProposal,
  retryChannelProposal,
} from './src/services/channelProposals';
import { consumeSharedText, getInitialLink, subscribeLinks } from './src/native/shareIntent';
import {
  isYouTubeLinkHandlerDefault,
  openYouTubeLinkSettings,
  setYouTubeLinkHandlerEnabled,
} from './src/native/youtubeLinkHandler';
import { hashPin, verifyPin } from './src/security/pin';
import { syncAllChannels, syncChannel } from './src/services/channelSync';
import {
  ensureChannelForApprovedVideo,
  ensureMutedChannelsForApprovedVideos,
} from './src/services/channelMuting';
import { isChannelMuted, withChannelMuted } from './src/domain/channels';
import { addByLink, type AddLinkResult } from './src/services/addByLink';
import { recordLog } from './src/services/logStore';
import { applyBackup, exportDatabase, pickDatabase } from './src/services/databaseBackup';
import { runCatalogImport, type CatalogRunState } from './src/services/youtubeCatalog';
import { emptyCatalogCheckpoint } from './src/domain/catalog';
import type { BackupFile } from './src/domain/backup';
import { APP_VERSION } from './src/version';
import { ChildHomeScreen } from './src/ui/ChildHomeScreen';
import { GateScreen } from './src/ui/GateScreen';
import { PinPrompt } from './src/ui/PinPrompt';
import { ParentPanel } from './src/ui/parent/ParentPanel';
import { PlayerScreen } from './src/ui/PlayerScreen';
import { colors } from './src/ui/theme';
import {
  SafeAreaProvider,
  initialWindowMetrics,
  useSafeAreaInsets,
} from 'react-native-safe-area-context';

type Route =
  | { name: 'child' }
  | { name: 'parent' }
  | { name: 'player'; video: Video; audioOnly: boolean; startAtSeconds: number; startDurationSeconds: number };

function createRepository(): Repository {
  return new AsyncStorageRepository();
}

// Fallback used when the native provider has not measured the window yet (and
// in tests), so the UI still renders instead of waiting on a first layout pass.
const FALLBACK_METRICS = {
  frame: { x: 0, y: 0, width: 0, height: 0 },
  insets: { top: 0, left: 0, right: 0, bottom: 0 },
};

export default function App() {
  return (
    <SafeAreaProvider initialMetrics={initialWindowMetrics ?? FALLBACK_METRICS}>
      <AppContent />
    </SafeAreaProvider>
  );
}

function AppContent() {
  // Android 15+ draws the app edge-to-edge, so the status bar and the
  // navigation bar overlap the layout. Every screen root gets these insets as
  // padding; otherwise the “Panel rodzica” / “Zamknij” buttons end up under the
  // status bar and are hard to hit.
  const insets = useSafeAreaInsets();
  const safeAreaPadding = {
    paddingTop: insets.top,
    paddingBottom: insets.bottom,
    paddingLeft: insets.left,
    paddingRight: insets.right,
  };

  const repoRef = useRef<Repository | null>(null);
  if (!repoRef.current) {
    repoRef.current = createRepository();
  }
  const repo = repoRef.current;

  const [ready, setReady] = useState(false);
  const [initError, setInitError] = useState<string | undefined>();
  const [settings, setSettings] = useState<Settings>({});
  const [channels, setChannels] = useState<Channel[]>([]);
  const [channelProposals, setChannelProposals] = useState<ChannelProposal[]>([]);
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
  const [pinRecord, setPinRecord] = useState<PinRecord | undefined>();
  const [extraTimePrompt, setExtraTimePrompt] = useState<
    { video?: Video; resume: boolean } | undefined
  >();
  // Refs keep per-second playback accounting synchronous (no read-before-write
  // races between usage and the extra pool) while the UI still gets state.
  const usedSecondsRef = useRef(0);
  const usageDateRef = useRef(dateKey(new Date()));
  const extraTimeRef = useRef<ExtraTimePool>(emptyExtraTime(dateKey(new Date())));

  // Incoming share/VIEW links are queued until settings and the repository are
  // ready (ADR 0014), then drained exactly once. VIEW links are deduplicated by
  // their raw URL so a cold start cannot process the same intent twice.
  const incomingQueueRef = useRef<{ raw: string; origin: IncomingLinkOrigin }[]>([]);
  const incomingReadyRef = useRef(false);
  const incomingProcessingRef = useRef(false);
  const seenViewLinksRef = useRef<Set<string>>(new Set());
  const processIncomingLinkRef = useRef<
    ((raw: string, origin: IncomingLinkOrigin) => Promise<void>) | null
  >(null);

  const drainIncomingQueue = useCallback(async () => {
    if (!incomingReadyRef.current || incomingProcessingRef.current) {
      return;
    }
    incomingProcessingRef.current = true;
    try {
      while (incomingQueueRef.current.length > 0) {
        const item = incomingQueueRef.current.shift();
        if (!item) {
          continue;
        }
        try {
          await processIncomingLinkRef.current?.(item.raw, item.origin);
        } catch (error) {
          console.log('[KidsTube:link] processing failed', String(error));
        }
      }
    } finally {
      incomingProcessingRef.current = false;
    }
  }, []);

  const enqueueIncomingLink = useCallback(
    (raw: string, origin: IncomingLinkOrigin) => {
      const trimmed = raw.trim();
      if (!trimmed) {
        return;
      }
      if (origin === 'view') {
        if (seenViewLinksRef.current.has(trimmed)) {
          return;
        }
        seenViewLinksRef.current.add(trimmed);
      }
      incomingQueueRef.current.push({ raw: trimmed, origin });
      drainIncomingQueue().catch(() => undefined);
    },
    [drainIncomingQueue],
  );

  const reload = useCallback(async () => {
    const today = dateKey(new Date());
    const [
      s,
      c,
      proposals,
      v,
      d,
      used,
      progress,
      history,
      storedExtra,
      storedGuard,
      storedPin,
    ] = await Promise.all([
      repo.getSettings(),
      repo.listChannels(),
      repo.listChannelProposals(),
      repo.listVideos(),
      repo.listDecisions(),
      repo.getUsage(today),
      repo.listWatchProgress(),
      repo.listWatchHistory(),
      repo.getExtraTime(),
      repo.getPinGuard(),
      repo.getPinRecord(),
    ]);
    const normalizedExtra = normalizeExtraTime(storedExtra, today);
    const normalizedGuard = normalizePinGuard(storedGuard, Date.now());
    usedSecondsRef.current = used;
    usageDateRef.current = today;
    extraTimeRef.current = normalizedExtra;
    setSettings(s);
    setChannels(c);
    setChannelProposals(proposals);
    setVideos(v);
    setDecisions(d);
    setUsedSecondsToday(used);
    setWatchProgress(progress);
    setWatchHistory(history);
    setExtraTime(normalizedExtra);
    setPinGuard(normalizedGuard);
    setPinRecord(storedPin);
    console.log(
      '[KidsTube:usage] loaded used=' +
        used +
        's limit=' +
        (s.schedule?.dailyLimitMinutes ?? 0) +
        'min schedule=' +
        JSON.stringify(s.schedule),
    );
  }, [repo]);

  // ADR 0006: RSS sync happens when the app opens and when the child pulls to
  // refresh (the parent's explicit “Synchronizuj” uses the same action).
  // Concurrent triggers — e.g. a pull right after a cold start — share one run,
  // so the feed is never swept twice in parallel.
  const syncPromiseRef = useRef<Promise<void> | null>(null);
  // Set while a backup restore is writing: sync must not race the replace.
  const restoringRef = useRef(false);
  const sync = useCallback(async (): Promise<void> => {
    if (restoringRef.current) {
      return;
    }
    if (syncPromiseRef.current) {
      return syncPromiseRef.current;
    }
    setRefreshing(true);
    const run = (async () => {
      try {
        const result = await syncAllChannels(repo);
        recordLog(
          'info',
          'sync',
          `kanały=${Object.keys(result.perChannel).length} nowe=${result.added.length}`,
        );
        await reload();
      } catch (error) {
        // Network failures are already swallowed per channel; anything left is
        // unexpected, but it must not leave the child stuck in a spinner.
        recordLog('error', 'sync', String(error));
        console.warn('[KidsTube:sync] failed', error);
      } finally {
        syncPromiseRef.current = null;
        setRefreshing(false);
      }
    })();
    syncPromiseRef.current = run;
    return run;
  }, [repo, reload]);

  useEffect(() => {
    let initialized = false;
    (async () => {
      try {
        await repo.init();
        initialized = true;
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
        // Approved films from channels that are not watched yet keep a muted
        // channel record for grouping (ADR 0015). Idempotent on every start.
        if ((await ensureMutedChannelsForApprovedVideos(repo)).length > 0) {
          await reload();
        }
      } catch (error) {
        setInitError(error instanceof Error ? error.message : String(error));
      } finally {
        incomingReadyRef.current = true;
        setReady(true);
        // Incoming links are drained first so a cold-start VIEW/share cannot
        // race the first sync on the same video collection. The sync then runs
        // exactly once per app start, after the cached library is on screen.
        drainIncomingQueue()
          .catch(() => undefined)
          .then(() => {
            if (initialized) {
              return sync();
            }
            return undefined;
          })
          .catch(() => undefined);
      }
    })();
  }, [repo, reload, drainIncomingQueue, sync]);

  // Visibility is projected from the decision history (ADR 0001); the stored
  // `Video.status` is only a cache. Everything downstream reads this list.
  const projectedVideos = useMemo(() => projectVideos(videos, decisions), [videos, decisions]);

  const childVideos = useMemo(
    () =>
      videosForChild(projectedVideos).filter(
        video => !isBlockedChannelVideo(video, channels, decisions),
      ),
    [projectedVideos, channels, decisions],
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
        console.log('[KidsTube:usage] +' + seconds + 's');
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
  // Both origins use the same pipeline (ADR 0013). A shared/intercepted film
  // never starts playback by itself; it is added or resolved and the child
  // opens it from the library when they want.
  const processIncomingLink = useCallback(
    async (raw: string, origin: IncomingLinkOrigin) => {
      // Read the setting from the repository, not from React state: on a cold
      // start the queue can drain before the first render that carries the
      // loaded settings (ADR 0014).
      const storedSettings = await repo.getSettings();
      if (!shouldProcessIncomingLink(origin, !!storedSettings.youtubeLinkHandlerEnabled)) {
        Alert.alert(
          'Otwieranie linków wyłączone',
          'KidsTube nie obsługuje teraz linków YouTube. Możesz włączyć tę opcję w panelu rodzica.',
        );
        return;
      }

      const link = extractYouTubeUrl(raw) ?? raw;
      const result = await handleIncomingLink(link, repo);
      switch (result.kind) {
        case 'allowed':
          await reload();
          Alert.alert(
            result.reason === 'known' ? 'Już w bibliotece' : 'Dodano do biblioteki',
            result.video.title,
          );
          break;
        case 'pending':
          await reload();
          Alert.alert('Dodano do zatwierdzenia', result.video.title);
          break;
        case 'blocked':
          await reload();
          Alert.alert('Zablokowane', 'Ten film znajduje się na czarnej liście.');
          break;
        case 'channel-known':
          Alert.alert('Kanał już dodany', result.channel.title);
          break;
        case 'channel-blocked':
          Alert.alert('Zablokowane', 'Ten kanał jest zablokowany w panelu rodzica.');
          break;
        case 'channel-proposal':
          await reload();
          Alert.alert('Kanał dodany do zatwierdzenia', result.proposal.title);
          break;
        case 'unknown':
          Alert.alert(
            'Nie rozpoznano linku',
            'KidsTube obsługuje linki do filmów i kanałów YouTube.',
          );
          break;
        default:
          break;
      }
    },
    [repo, reload],
  );

  // Keep the queue drainer pointed at the latest callback (settings change).
  useEffect(() => {
    processIncomingLinkRef.current = processIncomingLink;
    drainIncomingQueue().catch(() => undefined);
  }, [processIncomingLink, drainIncomingQueue]);

  // Subscribe before the repository is ready so links arriving during startup
  // are buffered instead of lost.
  useEffect(() => {
    return subscribeLinks(
      raw => enqueueIncomingLink(raw, 'share'),
      url => enqueueIncomingLink(url, 'view'),
    );
  }, [enqueueIncomingLink]);

  // Cold start: ACTION_SEND is read from the native store, VIEW from Linking.
  useEffect(() => {
    let active = true;
    (async () => {
      const [shared, initial] = await Promise.all([consumeSharedText(), getInitialLink()]);
      if (!active) {
        return;
      }
      if (shared) {
        enqueueIncomingLink(shared, 'share');
      }
      if (initial) {
        enqueueIncomingLink(initial, 'view');
      }
    })();
    return () => {
      active = false;
    };
  }, [enqueueIncomingLink]);

  // Sync the manifest component with the stored setting on every start/change
  // (ADR 0014). No record means disabled (DEFAULT_SETTINGS has false).
  useEffect(() => {
    if (!ready) {
      return;
    }
    setYouTubeLinkHandlerEnabled(!!settings.youtubeLinkHandlerEnabled).catch(() => undefined);
  }, [ready, settings.youtubeLinkHandlerEnabled]);

  // ---- Child proposes a video (ADR 0001: source 'propose') -----------------
  const proposeLink = useCallback(
    async (raw: string) => {
      const link = extractYouTubeUrl(raw) ?? raw;
      const parsed = parseYouTubeLink(link);
      if (parsed.kind === 'channel') {
        Alert.alert('To nie jest film', 'Wklej link do konkretnego filmu, nie kanału.');
        return;
      }

      const result = await handleIncomingLink(link, repo, undefined, Date.now(), 'propose');
      if (result.kind === 'allowed' || result.kind === 'blocked' || result.kind === 'pending') {
        // A repeat proposal resolves automatically to the latest decision and is
        // recorded as an `auto` entry (ADR 0001). First-time proposals stay pending.
        const auto = repeatProposalDecision(await repo.listDecisions(), result.video.id, Date.now());
        if (auto) {
          await repo.recordDecision(auto);
          await reload();
        }
      }
      switch (result.kind) {
        case 'allowed':
          Alert.alert('Dozwolony', 'Ten film jest już w Twojej bibliotece.');
          break;
        case 'blocked':
          Alert.alert('Zablokowane', 'Rodzic zablokował ten film.');
          break;
        case 'pending':
          await reload();
          Alert.alert('Dodano do zatwierdzenia', result.video.title);
          break;
        case 'channel-known':
        case 'channel-blocked':
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
    await repo.savePinRecord(record);
    const next = await repo.updateSettings({ configured: true });
    setPinRecord(record);
    setSettings(next);
    setPinSetup(false);
    recordLog('info', 'pin', 'kod rodzica zmieniony');
    // Changing the PIN from the panel returns to the panel (ADR 0016); the
    // first-run setup still lands in the child's world.
    setRoute(current => (current.name === 'parent' ? current : { name: 'child' }));
    return true;
  };

  // Shared PIN check for the parent panel and the extra-time prompt
  // (ADR 0012). The guard state is re-read from the repository so both entry
  // points share the same counter and lockout.
  const verifyParentPin = useCallback(
    async (pin: string): Promise<boolean> => {
      const record = pinRecord ?? (await repo.getPinRecord());
      if (!record) {
        return false;
      }
      const now = Date.now();
      const stored = normalizePinGuard(await repo.getPinGuard(), now);
      if (!canAttempt(stored, now)) {
        setPinGuard(stored);
        return false;
      }
      const ok = await verifyPin(pin, record);
      const next = ok ? recordSuccess() : recordFailure(stored, now);
      await repo.savePinGuard(next);
      setPinGuard(next);
      return ok;
    },
    [repo, pinRecord],
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

  // ---- Channel catalog import (ADR 0009) ----------------------------------

  const [catalogRun, setCatalogRun] = useState<CatalogRunState | undefined>();
  const catalogRunningRef = useRef(false);
  const catalogCancelRef = useRef(false);

  const startCatalog = useCallback(
    async (channel: Channel, restart = false) => {
      const base = channels.find(candidate => candidate.id === channel.id) ?? channel;
      if (catalogRunningRef.current) {
        return;
      }
      let stored = base;
      if (restart) {
        // Re-download the whole catalog from the first page. This is the
        // escape hatch when an earlier run was interrupted or when the parent
        // simply wants to sweep the channel again (ADR 0019).
        stored = { ...base, catalog: emptyCatalogCheckpoint() };
        await repo.upsertChannel(stored);
        recordLog('info', 'catalog', `restart ${stored.title}`);
      } else if (base.catalog?.done) {
        return;
      }
      catalogRunningRef.current = true;
      catalogCancelRef.current = false;
      setCatalogRun({
        channelId: stored.id,
        channelTitle: stored.title,
        imported: stored.catalog?.imported ?? 0,
        phase: 'running',
      });
      recordLog('info', 'catalog', `start ${stored.title}`);

      try {
        const result = await runCatalogImport(repo, stored, {
          onProgress: imported =>
            setCatalogRun(previous => (previous ? { ...previous, imported } : previous)),
          isCancelled: () => catalogCancelRef.current,
        });
        await reload();
        setCatalogRun(previous =>
          previous
            ? {
                ...previous,
                imported: result.imported,
                phase: result.done ? 'done' : result.cancelled ? 'cancelled' : 'error',
                message: result.error,
              }
            : previous,
        );
      } catch (error) {
        recordLog('error', 'catalog', String(error));
        setCatalogRun(previous =>
          previous ? { ...previous, phase: 'error', message: String(error) } : previous,
        );
      } finally {
        catalogRunningRef.current = false;
      }
    },
    [channels, repo, reload],
  );

  const cancelCatalog = useCallback(() => {
    catalogCancelRef.current = true;
    setCatalogRun(prev => (prev ? { ...prev, phase: 'cancelled' } : prev));
  }, []);

  const closeCatalog = useCallback(() => {
    if (!catalogRunningRef.current) {
      setCatalogRun(undefined);
    }
  }, []);

  const bulkDecide = useCallback(
    async (channel: Channel, outcome: DecisionOutcome): Promise<Video[]> => {
      const targets = projectedVideos.filter(
        video => video.channelId === channel.id && video.status === 'pending',
      );
      const at = Date.now();
      await repo.recordDecisions(
        targets.map((video, index) => manualDecision(video, outcome, at + index)),
      );
      recordLog('info', 'decision', `bulk ${outcome} ${channel.title}: ${targets.length}`);
      await reload();
      return targets;
    },
    [repo, projectedVideos, reload],
  );

  const retractMany = useCallback(
    async (targets: Video[]) => {
      const at = Date.now();
      await repo.recordDecisions(
        targets.map((video, index) => manualDecision(video, 'retract', at + index)),
      );
      recordLog('info', 'decision', `bulk retract: ${targets.length}`);
      await reload();
    },
    [repo, reload],
  );

  // ---- Database backup (ADR 0017) -----------------------------------------

  const exportBackup = useCallback(() => exportDatabase(repo, APP_VERSION), [repo]);
  const pickBackup = useCallback(() => pickDatabase(), []);

  const restoreBackup = useCallback(
    async (file: BackupFile) => {
      restoringRef.current = true;
      try {
        const outcome = await applyBackup(repo, file);
        if (!outcome.ok) {
          return outcome;
        }
        await reload();
        // The system component state is not part of the file (ADR 0014/0017).
        const stored = await repo.getSettings();
        await setYouTubeLinkHandlerEnabled(!!stored.youtubeLinkHandlerEnabled).catch(
          () => undefined,
        );
        // Close the panel: the restored settings and PIN take over.
        setRoute({ name: 'child' });
        return outcome;
      } finally {
        restoringRef.current = false;
      }
    },
    [repo, reload],
  );

  // ---- Parent actions ------------------------------------------------------

  const addLink = useCallback(
    async (link: string): Promise<AddLinkResult> => {
      const result = await addByLink(link, repo);
      if (result.ok) {
        await reload();
      }
      return result;
    },
    [repo, reload],
  );

  const changeChannelPolicy = async (channel: Channel, policy: ChannelPolicy) => {
    if (channel.policy === policy) {
      return;
    }
    const next: Channel = { ...channel, policy };
    await repo.upsertChannel(next);
    if (policy === 'auto_approve') {
      // Switching to auto-approve lets the channel's pending videos in; record
      // one manual decision each so the change is visible in the history.
      const toApprove = projectedVideos.filter(
        v => v.channelId === channel.id && v.status === 'pending',
      );
      for (const v of toApprove) {
        await repo.recordDecision(manualDecision(v, 'allow', Date.now()));
      }
      recordLog(
        'warn',
        'channel',
        `auto-akceptacja ${channel.title}: dopuszczono ${toApprove.length} oczekujących`,
      );
    }
    await reload();
  };

  const toggleChannelBlocked = async (channel: Channel) => {
    const status = channel.status === 'blocked' ? 'allowed' : 'blocked';
    await repo.upsertChannel({
      ...channel,
      status,
      // Blocking starts a new exception window: only a later manual approval
      // can bring one film back (ADR 0019).
      blockedAt: status === 'blocked' ? Date.now() : undefined,
    });
    recordLog('info', 'channel', `${channel.title}: ${status === 'blocked' ? 'zablokowany' : 'odblokowany'}`);
    await reload();
  };

  /**
   * “Zablokuj wszystkie filmy z kanału”: reject every film that is not blocked
   * yet (one decision per film, so the history stays append-only), then block
   * the channel and switch its RSS updates off (ADR 0019).
   */
  const blockAllChannelVideos = (channel: Channel) => {
    const films = projectedVideos.filter(
      video => video.channelId === channel.id && video.status !== 'blocked',
    );
    Alert.alert(
      'Zablokować kanał?',
      `Kanał „${channel.title}” zostanie zablokowany, ${films.length} ${
        films.length === 1 ? 'film zostanie odrzucony' : 'filmów zostanie odrzuconych'
      }, a aktualizacja RSS wyłączona.`,
      [
        { text: 'Anuluj', style: 'cancel' },
        {
          text: 'Zablokuj wszystko',
          style: 'destructive',
          onPress: () => {
            (async () => {
              const at = Date.now();
              await repo.recordDecisions(
                films.map((video, index) => manualDecision(video, 'reject', at + index + 1)),
              );
              await repo.upsertChannel({
                ...channel,
                status: 'blocked',
                muted: true,
                blockedAt: at,
              });
              recordLog(
                'warn',
                'channel',
                `blokada ${channel.title}: odrzucono ${films.length}`,
              );
              await reload();
            })().catch(() => undefined);
          },
        },
      ],
    );
  };

  const toggleChannelMuted = async (channel: Channel) => {
    const next = withChannelMuted(channel, !isChannelMuted(channel));
    await repo.upsertChannel(next);
    // Unmuting resumes the feed; fetch once right away (ADR 0015), unless the
    // channel is also blocked.
    if (!isChannelMuted(next) && next.status !== 'blocked') {
      setRefreshing(true);
      try {
        await syncChannel(repo, next);
      } finally {
        setRefreshing(false);
      }
    }
    await reload();
  };

  // ---- Channel proposals (ADR 0013) ----------------------------------------
  // Approving always creates a `manual` channel: one shared link is not enough
  // trust for auto-approval. Its RSS sync then queues current films for review.
  const onApproveChannelProposal = async (proposal: ChannelProposal) => {
    const result = await approveChannelProposal(repo, proposal);
    await reload();
    if (result.kind === 'added') {
      Alert.alert(
        'Dodano kanał',
        `Kanał „${result.channel.title}” jest w bibliotece. Filmy z kanału czekają na zatwierdzenie.`,
      );
    } else if (result.kind === 'unmuted') {
      Alert.alert(
        'Kanał odciszony',
        `Kanał „${result.channel.title}” znów pobiera listę filmów.`,
      );
    } else if (result.kind === 'already') {
      Alert.alert('Kanał już dodany', result.channel.title);
    } else {
      Alert.alert(
        'Nie udało się rozpoznać kanału',
        'Spróbuj ponownie później albo odrzuć propozycję.',
      );
    }
  };

  const onRejectChannelProposal = async (proposal: ChannelProposal) => {
    await rejectChannelProposal(repo, proposal);
    await reload();
  };

  const onRetryChannelProposal = async (proposal: ChannelProposal) => {
    const result = await retryChannelProposal(repo, proposal);
    await reload();
    if (result.kind === 'resolved') {
      Alert.alert('Kanał rozpoznany', 'Możesz teraz dodać go do biblioteki.');
    } else if (result.kind === 'already') {
      Alert.alert('Kanał już dodany', result.channel.title);
    } else {
      Alert.alert(
        'Nie udało się rozpoznać kanału',
        'Spróbuj ponownie później albo odrzuć propozycję.',
      );
    }
  };

  // ---- Optional VIEW handler (ADR 0014) ------------------------------------
  const changeYouTubeLinkHandler = async (enabled: boolean) => {
    // Turning the option off while KidsTube is the default means links will stop
    // opening here; we cannot change the system default from the app.
    const wasDefault = enabled ? false : await isYouTubeLinkHandlerDefault();
    const next = await repo.updateSettings({ youtubeLinkHandlerEnabled: enabled });
    setSettings(next);
    try {
      await setYouTubeLinkHandlerEnabled(enabled);
    } catch (error) {
      console.log('[KidsTube:link] native component update failed', String(error));
    }

    if (enabled) {
      Alert.alert(
        'Otwieranie linków YouTube',
        'KidsTube zgłosi się jako aplikacja do otwierania linków YouTube. Aby wybrać go jako domyślny, użyj ustawień systemowych. Udostępnianie linków działa niezależnie od tej opcji.',
        [
          {
            text: 'Ustawienia systemowe',
            onPress: () => {
              openYouTubeLinkSettings().catch(() => undefined);
            },
          },
          { text: 'OK', style: 'cancel' },
        ],
      );
    } else if (wasDefault) {
      Alert.alert(
        'Wyłączono otwieranie linków',
        'Linki YouTube nie będą już otwierane w KidsTube. Wybierz inną aplikację w ustawieniach systemowych.',
        [
          {
            text: 'Ustawienia systemowe',
            onPress: () => {
              openYouTubeLinkSettings().catch(() => undefined);
            },
          },
          { text: 'OK', style: 'cancel' },
        ],
      );
    }
  };

  const openLinkHandlingSettings = () => {
    openYouTubeLinkSettings().catch(() => undefined);
  };

  // A parent action becomes a `manual` decision in the append-only history.
  // Undo from the panel's 10-second bar: the decision is taken back with a
  // `retract` entry, so the history stays append-only (ADR 0016).
  const retractDecision = async (video: Video) => {
    recordLog('info', 'decision', `retract ${video.id} (${video.title})`);
    await repo.recordDecision(manualDecision(video, 'retract', Date.now()));
    await reload();
  };

  const setVideoStatus = async (video: Video, status: VideoStatus) => {
    const outcome: DecisionOutcome = status === 'allowed' ? 'allow' : 'reject';
    const at = Date.now();
    recordLog('info', 'decision', `${outcome} ${video.id} (${video.title})`);
    await repo.recordDecision(manualDecision(video, outcome, at));
    if (status === 'allowed') {
      // Approving a film from an unknown channel parks that channel as muted
      // (ADR 0015) so it can group its films without fetching RSS.
      await ensureChannelForApprovedVideo(repo, video, at);
    }
    await reload();
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

  if (!pinRecord || pinSetup) {
    return (
      <View style={[styles.root, safeAreaPadding]}>
        <StatusBar barStyle="light-content" />
        <GateScreen
          mode="setup"
          title={pinSetup ? 'Nowy kod rodzica' : 'Witaj w KidsTube'}
          subtitle="Ustaw kod, którym będziesz zatwierdzać filmy i wchodzić w panel rodzica."
          onSubmit={onSetupPin}
          onCancel={pinSetup ? () => setPinSetup(false) : undefined}
        />
      </View>
    );
  }

  if (parentGate) {
    return (
      <View style={[styles.root, safeAreaPadding]}>
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
      <View style={[styles.root, styles.playerRoot, safeAreaPadding]}>
        {/* Video is full-screen; audio mode is a normal portrait screen, so the
            status bar returns together with the navigation bar. */}
        <StatusBar barStyle="light-content" hidden={!route.audioOnly} />
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

  if (route.name === 'parent') {
    return (
      <View style={[styles.root, safeAreaPadding]}>
        <StatusBar barStyle="light-content" />
        <ParentPanel
          videos={projectedVideos}
          channels={channels}
          channelProposals={channelProposals}
          watchHistory={watchHistory}
          schedule={settings.schedule}
          extraTime={extraTime}
          usedSecondsToday={usedSecondsToday}
          refreshing={refreshing}
          youtubeLinkHandlerEnabled={!!settings.youtubeLinkHandlerEnabled}
          onClose={() => setRoute({ name: 'child' })}
          onRefresh={() => {
            sync().catch(() => undefined);
          }}
          onSetStatus={setVideoStatus}
          onRetract={retractDecision}
          onRetractMany={retractMany}
          catalogRun={catalogRun}
          onStartCatalog={startCatalog}
          onCancelCatalog={cancelCatalog}
          onCloseCatalog={closeCatalog}
          onBulkDecide={bulkDecide}
          onExportBackup={exportBackup}
          onPickBackup={pickBackup}
          onRestoreBackup={restoreBackup}
          onVerifyPin={verifyParentPin}
          pinLockedUntil={pinGuard.lockedUntil}
          onSelectPolicy={changeChannelPolicy}
          onToggleMuted={toggleChannelMuted}
          onToggleBlocked={toggleChannelBlocked}
          onBlockAllVideos={blockAllChannelVideos}
          decisions={decisions}
          onApproveChannel={onApproveChannelProposal}
          onRejectChannel={onRejectChannelProposal}
          onRetryChannel={onRetryChannelProposal}
          onAddLink={addLink}
          onResetUsage={resetUsageToday}
          onScheduleChange={changeSchedule}
          onChangePin={() => setPinSetup(true)}
          onYouTubeLinkHandlerChange={changeYouTubeLinkHandler}
          onOpenLinkHandlingSettings={openLinkHandlingSettings}
        />
      </View>
    );
  }

  return (
    <View style={[styles.root, safeAreaPadding]}>
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
  // The player is full-bleed: safe-area padding must read as letterboxing.
  playerRoot: { backgroundColor: colors.black },
  center: { flex: 1, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center' },
  errorText: { color: colors.danger, padding: 24, textAlign: 'center' },
});
