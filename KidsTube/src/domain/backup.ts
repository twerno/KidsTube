/**
 * Backup file format (ADR 0017): one JSON document with an explicit envelope.
 *
 * The export always writes the latest supported `schemaVersion`. The import
 * validates the whole document before anything is written: envelopes, types,
 * enum values, ranges, identifier uniqueness and the completeness of the PIN
 * set. **Orphans are allowed** — a decision or a history entry may outlive its
 * film, and a film may have no channel record; that is normal after cleanup.
 */

import type {
  Channel,
  ChannelPolicy,
  ChannelProposal,
  ChannelStatus,
  DatabaseSnapshot,
  Decision,
  DecisionOutcome,
  DecisionSource,
  ExtraTimePool,
  Schedule,
  Settings,
  TimeWindow,
  Video,
  VideoSource,
  VideoStatus,
  WatchHistoryEntry,
  WatchProgress,
} from './types';

export const BACKUP_FORMAT = 'kidstube-db';
export const BACKUP_SCHEMA_VERSION = 1;

export interface BackupFile {
  format: typeof BACKUP_FORMAT;
  schemaVersion: number;
  /** ISO 8601, UTC. */
  exportedAt: string;
  /** Informational only, for diagnostics. */
  appVersion: string;
  data: DatabaseSnapshot;
}

export type BackupParseResult = { ok: true; file: BackupFile } | { ok: false; error: string };

export class BackupError extends Error { }

function fail(path: string, expected: string): never {
  throw new BackupError(`${path}: ${expected}`);
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function asObject(value: unknown, path: string): Record<string, unknown> {
  if (!isObject(value)) {
    fail(path, 'oczekiwano obiektu');
  }
  return value;
}

function asArray(value: unknown, path: string): unknown[] {
  if (!Array.isArray(value)) {
    fail(path, 'oczekiwano tablicy');
  }
  return value;
}

function asString(value: unknown, path: string): string {
  if (typeof value !== 'string') {
    fail(path, 'oczekiwano tekstu');
  }
  return value;
}

function asNonEmptyString(value: unknown, path: string): string {
  const text = asString(value, path);
  if (!text.trim()) {
    fail(path, 'tekst nie może być pusty');
  }
  return text;
}

function asBoolean(value: unknown, path: string): boolean {
  if (typeof value !== 'boolean') {
    fail(path, 'oczekiwano true/false');
  }
  return value;
}

interface NumberOptions {
  min?: number;
  max?: number;
  integer?: boolean;
}

function asNumber(value: unknown, path: string, options: NumberOptions = {}): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    fail(path, 'oczekiwano liczby');
  }
  if (options.integer && !Number.isInteger(value)) {
    fail(path, 'oczekiwano liczby całkowitej');
  }
  if (options.min !== undefined && value < options.min) {
    fail(path, `liczba mniejsza niż ${options.min}`);
  }
  if (options.max !== undefined && value > options.max) {
    fail(path, `liczba większa niż ${options.max}`);
  }
  return value;
}

function asEnum<T extends string>(value: unknown, allowed: readonly T[], path: string): T {
  const text = asString(value, path);
  if (!(allowed as readonly string[]).includes(text)) {
    fail(path, `nieznana wartość „${text}”`);
  }
  return text as T;
}

function asDateKey(value: unknown, path: string): string {
  const text = asString(value, path);
  const match = text.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) {
    fail(path, 'oczekiwano daty RRRR-MM-DD');
  }
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (month < 1 || month > 12 || day < 1 || day > 31) {
    fail(path, 'niepoprawna data');
  }
  return text;
}

const VIDEO_STATUSES: readonly VideoStatus[] = ['allowed', 'pending', 'blocked'];
const VIDEO_SOURCES: readonly VideoSource[] = ['rss', 'manual', 'share', 'propose'];
const CHANNEL_POLICIES: readonly ChannelPolicy[] = ['auto_approve', 'manual'];
const CHANNEL_STATUSES: readonly ChannelStatus[] = ['allowed', 'blocked'];
const DECISION_OUTCOMES: readonly DecisionOutcome[] = ['allow', 'reject', 'retract'];
const DECISION_SOURCES: readonly DecisionSource[] = ['manual', 'auto'];

function parseSchedule(value: unknown, path: string): Schedule {
  const raw = asObject(value, path);
  const schedule: Schedule = { enabled: asBoolean(raw.enabled, `${path}.enabled`) };
  if (raw.window !== undefined) {
    const window = asObject(raw.window, `${path}.window`);
    const parsed: TimeWindow = {
      startMinute: asNumber(window.startMinute, `${path}.window.startMinute`, {
        integer: true,
        min: 0,
        max: 1440,
      }),
      endMinute: asNumber(window.endMinute, `${path}.window.endMinute`, {
        integer: true,
        min: 0,
        max: 1440,
      }),
    };
    schedule.window = parsed;
  }
  if (raw.dailyLimitMinutes !== undefined) {
    schedule.dailyLimitMinutes = asNumber(raw.dailyLimitMinutes, `${path}.dailyLimitMinutes`, {
      integer: true,
      min: 0,
    });
  }
  return schedule;
}

function parseSettings(value: unknown): Settings {
  const raw = asObject(value, 'data.settings');
  const settings: Settings = {};

  // The parent PIN is device-local and never part of a backup: any PIN fields in
  // a file are ignored like other unknown fields (ADR 0017).
  if (raw.childName !== undefined) {
    settings.childName = asString(raw.childName, 'data.settings.childName');
  }
  if (raw.configured !== undefined) {
    settings.configured = asBoolean(raw.configured, 'data.settings.configured');
  }
  if (raw.schedule !== undefined) {
    settings.schedule = parseSchedule(raw.schedule, 'data.settings.schedule');
  }
  if (raw.youtubeLinkHandlerEnabled !== undefined) {
    settings.youtubeLinkHandlerEnabled = asBoolean(
      raw.youtubeLinkHandlerEnabled,
      'data.settings.youtubeLinkHandlerEnabled',
    );
  }
  return settings;
}

function parseChannels(value: unknown): Channel[] {
  const items = asArray(value, 'data.channels');
  const seen = new Set<string>();
  return items.map((item, index) => {
    const path = `data.channels[${index}]`;
    const raw = asObject(item, path);
    const channel: Channel = {
      id: asNonEmptyString(raw.id, `${path}.id`),
      title: asString(raw.title, `${path}.title`),
      policy: asEnum(raw.policy, CHANNEL_POLICIES, `${path}.policy`),
      status: asEnum(raw.status, CHANNEL_STATUSES, `${path}.status`),
      addedAt: asNumber(raw.addedAt, `${path}.addedAt`, { min: 0 }),
    };
    if (raw.handle !== undefined) {
      channel.handle = asString(raw.handle, `${path}.handle`);
    }
    if (raw.thumbnailUrl !== undefined) {
      channel.thumbnailUrl = asString(raw.thumbnailUrl, `${path}.thumbnailUrl`);
    }
    if (raw.muted !== undefined) {
      channel.muted = asBoolean(raw.muted, `${path}.muted`);
    }
    if (raw.catalog !== undefined) {
      const catalogPath = `${path}.catalog`;
      const catalog = asObject(raw.catalog, catalogPath);
      const checkpoint = {
        imported: asNumber(catalog.imported, `${catalogPath}.imported`, {
          integer: true,
          min: 0,
        }),
        done: asBoolean(catalog.done, `${catalogPath}.done`),
      } as Channel['catalog'];
      if (catalog.resumeToken !== undefined) {
        checkpoint!.resumeToken = asString(catalog.resumeToken, `${catalogPath}.resumeToken`);
      }
      if (catalog.error !== undefined) {
        checkpoint!.error = asString(catalog.error, `${catalogPath}.error`);
      }
      channel.catalog = checkpoint;
    }
    if (seen.has(channel.id)) {
      fail(`${path}.id`, `zduplikowany identyfikator kanału „${channel.id}”`);
    }
    seen.add(channel.id);
    return channel;
  });
}

function parseChannelProposals(value: unknown): ChannelProposal[] {
  const items = asArray(value, 'data.channelProposals');
  const seen = new Set<string>();
  return items.map((item, index) => {
    const path = `data.channelProposals[${index}]`;
    const raw = asObject(item, path);
    const proposal: ChannelProposal = {
      id: asNonEmptyString(raw.id, `${path}.id`),
      rawUrl: asString(raw.rawUrl, `${path}.rawUrl`),
      title: asString(raw.title, `${path}.title`),
      resolved: asBoolean(raw.resolved, `${path}.resolved`),
      addedAt: asNumber(raw.addedAt, `${path}.addedAt`, { min: 0 }),
    };
    if (raw.channelId !== undefined) {
      proposal.channelId = asString(raw.channelId, `${path}.channelId`);
    }
    if (raw.handle !== undefined) {
      proposal.handle = asString(raw.handle, `${path}.handle`);
    }
    if (raw.thumbnailUrl !== undefined) {
      proposal.thumbnailUrl = asString(raw.thumbnailUrl, `${path}.thumbnailUrl`);
    }
    if (seen.has(proposal.id)) {
      fail(`${path}.id`, `zduplikowany identyfikator propozycji „${proposal.id}”`);
    }
    seen.add(proposal.id);
    return proposal;
  });
}

function parseVideos(value: unknown): Video[] {
  const items = asArray(value, 'data.videos');
  const seen = new Set<string>();
  return items.map((item, index) => {
    const path = `data.videos[${index}]`;
    const raw = asObject(item, path);
    const video: Video = {
      id: asNonEmptyString(raw.id, `${path}.id`),
      title: asString(raw.title, `${path}.title`),
      status: asEnum(raw.status, VIDEO_STATUSES, `${path}.status`),
      source: asEnum(raw.source, VIDEO_SOURCES, `${path}.source`),
      addedAt: asNumber(raw.addedAt, `${path}.addedAt`, { min: 0 }),
    };
    if (raw.channelId !== undefined) {
      video.channelId = asString(raw.channelId, `${path}.channelId`);
    }
    if (raw.channelTitle !== undefined) {
      video.channelTitle = asString(raw.channelTitle, `${path}.channelTitle`);
    }
    if (raw.publishedAt !== undefined) {
      video.publishedAt = asNumber(raw.publishedAt, `${path}.publishedAt`, { min: 0 });
    }
    if (raw.thumbnailUrl !== undefined) {
      video.thumbnailUrl = asString(raw.thumbnailUrl, `${path}.thumbnailUrl`);
    }
    if (seen.has(video.id)) {
      fail(`${path}.id`, `zduplikowany identyfikator filmu „${video.id}”`);
    }
    seen.add(video.id);
    return video;
  });
}

function parseDecisions(value: unknown): Decision[] {
  const items = asArray(value, 'data.decisions');
  // Duplicates for one film are normal: the history is append-only, and the
  // order matters for last-wins. Only the order is preserved, never sorted.
  return items.map((item, index) => {
    const path = `data.decisions[${index}]`;
    const raw = asObject(item, path);
    const decision: Decision = {
      videoId: asNonEmptyString(raw.videoId, `${path}.videoId`),
      outcome: asEnum(raw.outcome, DECISION_OUTCOMES, `${path}.outcome`),
      source: asEnum(raw.source, DECISION_SOURCES, `${path}.source`),
      at: asNumber(raw.at, `${path}.at`, { min: 0 }),
    };
    if (raw.channelId !== undefined) {
      decision.channelId = asString(raw.channelId, `${path}.channelId`);
    }
    return decision;
  });
}

function parseUsage(value: unknown): Record<string, number> {
  const raw = asObject(value, 'data.usage');
  const usage: Record<string, number> = {};
  for (const [key, seconds] of Object.entries(raw)) {
    asDateKey(key, `data.usage[${key}]`);
    usage[key] = asNumber(seconds, `data.usage[${key}]`, { min: 0 });
  }
  return usage;
}

function parseWatchProgress(value: unknown): WatchProgress[] {
  const items = asArray(value, 'data.watchProgress');
  const seen = new Set<string>();
  return items.map((item, index) => {
    const path = `data.watchProgress[${index}]`;
    const raw = asObject(item, path);
    const progress: WatchProgress = {
      videoId: asNonEmptyString(raw.videoId, `${path}.videoId`),
      positionSeconds: asNumber(raw.positionSeconds, `${path}.positionSeconds`, { min: 0 }),
      completed: asBoolean(raw.completed, `${path}.completed`),
      lastWatchedAt: asNumber(raw.lastWatchedAt, `${path}.lastWatchedAt`, { min: 0 }),
    };
    if (raw.durationSeconds !== undefined) {
      progress.durationSeconds = asNumber(raw.durationSeconds, `${path}.durationSeconds`, {
        min: 0,
      });
    }
    if (seen.has(progress.videoId)) {
      fail(`${path}.videoId`, `zduplikowany postęp dla filmu „${progress.videoId}”`);
    }
    seen.add(progress.videoId);
    return progress;
  });
}

function parseWatchHistory(value: unknown): WatchHistoryEntry[] {
  const items = asArray(value, 'data.watchHistory');
  const seen = new Set<string>();
  return items.map((item, index) => {
    const path = `data.watchHistory[${index}]`;
    const raw = asObject(item, path);
    const entry: WatchHistoryEntry = {
      videoId: asNonEmptyString(raw.videoId, `${path}.videoId`),
      dateKey: asDateKey(raw.dateKey, `${path}.dateKey`),
      title: asString(raw.title, `${path}.title`),
      firstWatchedAt: asNumber(raw.firstWatchedAt, `${path}.firstWatchedAt`, { min: 0 }),
      lastWatchedAt: asNumber(raw.lastWatchedAt, `${path}.lastWatchedAt`, { min: 0 }),
      audioSeconds: asNumber(raw.audioSeconds, `${path}.audioSeconds`, { min: 0 }),
      videoSeconds: asNumber(raw.videoSeconds, `${path}.videoSeconds`, { min: 0 }),
    };
    if (raw.channelTitle !== undefined) {
      entry.channelTitle = asString(raw.channelTitle, `${path}.channelTitle`);
    }
    if (raw.thumbnailUrl !== undefined) {
      entry.thumbnailUrl = asString(raw.thumbnailUrl, `${path}.thumbnailUrl`);
    }
    const key = `${entry.videoId}:${entry.dateKey}`;
    if (seen.has(key)) {
      fail(`${path}`, `zduplikowany wpis historii dla „${entry.videoId}” i ${entry.dateKey}`);
    }
    seen.add(key);
    return entry;
  });
}

function parseExtraTime(value: unknown): ExtraTimePool | null {
  if (value === null || value === undefined) {
    return null;
  }
  const path = 'data.extraTime';
  const raw = asObject(value, path);
  return {
    dateKey: asDateKey(raw.dateKey, `${path}.dateKey`),
    grantedSeconds: asNumber(raw.grantedSeconds, `${path}.grantedSeconds`, { min: 0 }),
    remainingSeconds: asNumber(raw.remainingSeconds, `${path}.remainingSeconds`, { min: 0 }),
  };
}

function parseSnapshot(value: unknown): DatabaseSnapshot {
  const raw = asObject(value, 'data');
  for (const key of [
    'settings',
    'channels',
    'channelProposals',
    'videos',
    'decisions',
    'usage',
    'watchProgress',
    'watchHistory',
    'extraTime',
  ]) {
    if (!(key in raw)) {
      fail(`data.${key}`, 'brak wymaganej kolekcji');
    }
  }
  return {
    settings: parseSettings(raw.settings),
    channels: parseChannels(raw.channels),
    channelProposals: parseChannelProposals(raw.channelProposals),
    videos: parseVideos(raw.videos),
    decisions: parseDecisions(raw.decisions),
    usage: parseUsage(raw.usage),
    watchProgress: parseWatchProgress(raw.watchProgress),
    watchHistory: parseWatchHistory(raw.watchHistory),
    extraTime: parseExtraTime(raw.extraTime),
  };
}

/** Settings without the PIN derivatives: the code never leaves the device. */
function withoutPin(settings: Settings): Settings {
  const copy: Settings = { ...settings };
  delete copy.pinHash;
  delete copy.pinSalt;
  delete copy.pinIterations;
  return copy;
}

/** Build the export document. The caller serialises it to JSON. */
export function buildBackup(
  snapshot: DatabaseSnapshot,
  appVersion: string,
  exportedAt: Date = new Date(),
): BackupFile {
  return {
    format: BACKUP_FORMAT,
    schemaVersion: BACKUP_SCHEMA_VERSION,
    exportedAt: exportedAt.toISOString(),
    appVersion,
    data: { ...snapshot, settings: withoutPin(snapshot.settings) },
  };
}

/**
 * Validate and normalise a backup document. Unknown fields in the known schema
 * version are ignored; a newer schema version is rejected.
 */
export function parseBackup(raw: string): BackupParseResult {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return { ok: false, error: 'Plik nie jest poprawnym JSON-em.' };
  }
  if (!isObject(parsed)) {
    return { ok: false, error: 'Plik nie zawiera obiektu kopii.' };
  }
  try {
    return parseEnvelope(parsed);
  } catch (error) {
    if (error instanceof BackupError) {
      return { ok: false, error: `Plik kopii jest niepoprawny (${error.message}).` };
    }
    return { ok: false, error: 'Nie udało się odczytać pliku kopii.' };
  }
}

function parseEnvelope(raw: Record<string, unknown>): BackupParseResult {
  if (raw.format !== BACKUP_FORMAT) {
    return { ok: false, error: 'To nie jest plik kopii KidsTube.' };
  }
  const schemaVersion = asNumber(raw.schemaVersion, 'schemaVersion', { integer: true, min: 1 });
  if (schemaVersion > BACKUP_SCHEMA_VERSION) {
    return {
      ok: false,
      error: 'Plik pochodzi z nowszej wersji KidsTube. Zaktualizuj aplikację.',
    };
  }
  if (schemaVersion !== BACKUP_SCHEMA_VERSION) {
    return { ok: false, error: 'Nieznana wersja formatu kopii.' };
  }
  const exportedAt = asString(raw.exportedAt, 'exportedAt');
  if (Number.isNaN(Date.parse(exportedAt))) {
    fail('exportedAt', 'oczekiwano daty ISO 8601');
  }
  const appVersion = asString(raw.appVersion, 'appVersion');
  return {
    ok: true,
    file: {
      format: BACKUP_FORMAT,
      schemaVersion,
      exportedAt,
      appVersion,
      data: parseSnapshot(raw.data),
    },
  };
}
