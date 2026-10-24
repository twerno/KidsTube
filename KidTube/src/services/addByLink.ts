/**
 * Adding content by link (ADR 0016, section “Dodaj film/kanał”).
 *
 * One entry point for a pasted/shared link: a film is always approved, a
 * channel is always created `manual` and unmuted. Nothing is half-written: if
 * the metadata or the feed cannot be fetched, the repository stays untouched and
 * the caller gets a short message plus technical details for the Log.
 */

import type { Channel, Video } from '../domain/types';
import { manualDecision } from '../domain/decisions';
import { parseYouTubeLink } from '../domain/youtubeUrl';
import type { Repository } from '../data/repository';
import { ensureChannelForApprovedVideo } from './channelMuting';
import { fetchChannelFeed, syncChannel } from './channelSync';
import { resolveChannelFromUrl } from './channelResolve';
import { fetchOEmbed, fetchPlayerMetadata, type FetchLike } from './youtubeMetadata';
import { recordLog } from './logStore';

export type AddLinkResult =
  | { ok: true; kind: 'video'; video: Video; channelBlocked: boolean }
  | { ok: true; kind: 'channel'; channel: Channel }
  | { ok: false; message: string; details: string };

function channelPageUrlFor(raw: string, parsed: ReturnType<typeof parseYouTubeLink>): string | undefined {
  if (/^https?:\/\//i.test(raw)) {
    return raw;
  }
  if (parsed.kind !== 'channel') {
    return undefined;
  }
  if (parsed.handle) {
    return `https://www.youtube.com/@${parsed.handle}`;
  }
  if (parsed.slug) {
    return `https://www.youtube.com/c/${parsed.slug}`;
  }
  if (parsed.channelId) {
    return `https://www.youtube.com/channel/${parsed.channelId}`;
  }
  return undefined;
}

export async function addByLink(
  rawLink: string,
  repo: Repository,
  fetchFn?: FetchLike,
  now: number = Date.now(),
): Promise<AddLinkResult> {
  const link = rawLink.trim();
  const parsed = parseYouTubeLink(link);
  recordLog('info', 'add', `start ${parsed.kind} ${link}`);

  if (parsed.kind === 'video') {
    return addVideo(parsed.videoId, repo, fetchFn, now);
  }
  if (parsed.kind === 'channel') {
    return addChannel(link, parsed, repo, fetchFn, now);
  }

  recordLog('warn', 'add', `nieznany link: ${link}`);
  return {
    ok: false,
    message: 'Nie rozpoznaję linku. Wklej link do filmu lub kanału.',
    details: `parse=none, link=${link}`,
  };
}

async function addVideo(
  videoId: string,
  repo: Repository,
  fetchFn: FetchLike | undefined,
  now: number,
): Promise<AddLinkResult> {
  const [meta, player] = await Promise.all([
    fetchOEmbed(videoId, fetchFn),
    fetchPlayerMetadata(videoId, fetchFn),
  ]);

  if (!meta?.title || !player?.channelId) {
    const details = `oembed=${meta ? 'ok' : 'brak'}, innertube=${player?.channelId ? 'ok' : 'brak'}, videoId=${videoId}`;
    recordLog('error', 'add', `film ${videoId}: brak metadanych (${details})`);
    return {
      ok: false,
      message: 'Nie udało się pobrać danych filmu. Spróbuj ponownie za chwilę.',
      details,
    };
  }

  const existingChannel = await repo.getChannel(player.channelId);
  const video: Video = {
    id: videoId,
    channelId: player.channelId,
    channelTitle: existingChannel?.title ?? player.channelTitle ?? meta.authorName,
    title: meta.title,
    thumbnailUrl: meta.thumbnailUrl,
    publishedAt: player.publishedAt,
    status: 'allowed',
    source: 'manual',
    addedAt: now,
  };

  await repo.upsertVideos([video]);
  // The parent added it by hand — that is a manual decision (ADR 0001), and an
  // unknown channel is parked as muted (ADR 0015).
  await repo.recordDecision(manualDecision(video, 'allow', now));
  await ensureChannelForApprovedVideo(repo, video, now);

  recordLog('info', 'add', `film ${videoId} dodany (kanał ${player.channelId})`);
  return {
    ok: true,
    kind: 'video',
    video,
    channelBlocked: existingChannel?.status === 'blocked',
  };
}

async function addChannel(
  link: string,
  parsed: Extract<ReturnType<typeof parseYouTubeLink>, { kind: 'channel' }>,
  repo: Repository,
  fetchFn: FetchLike | undefined,
  now: number,
): Promise<AddLinkResult> {
  let channelId = parsed.channelId;
  let resolvedTitle: string | undefined;
  let resolvedHandle: string | undefined;

  if (!channelId) {
    const pageUrl = channelPageUrlFor(link, parsed);
    const resolved = pageUrl ? await resolveChannelFromUrl(pageUrl, fetchFn) : undefined;
    if (!resolved) {
      const details = `resolve=brak, link=${link}`;
      recordLog('error', 'add', `kanał: nie rozpoznano (${details})`);
      return {
        ok: false,
        message: 'Nie udało się rozpoznać kanału. Wklej pełny link do kanału.',
        details,
      };
    }
    channelId = resolved.channelId;
    resolvedTitle = resolved.title;
    resolvedHandle = resolved.handle;
  }

  const existing = await repo.getChannel(channelId);
  const entries = await fetchChannelFeed(channelId, fetchFn);
  const title = existing?.title ?? resolvedTitle ?? entries[0]?.channelTitle;

  if (!title) {
    const details = `feed=0, resolve=${resolvedTitle ? 'ok' : 'brak'}, channelId=${channelId}`;
    recordLog('error', 'add', `kanał ${channelId}: brak danych (${details})`);
    return {
      ok: false,
      message: 'Nie udało się pobrać kanału. Spróbuj ponownie za chwilę.',
      details,
    };
  }

  const channel: Channel = {
    id: channelId,
    title,
    handle: existing?.handle ?? resolvedHandle ?? parsed.handle,
    thumbnailUrl: existing?.thumbnailUrl,
    // A hand-added channel is always `manual` when new; an existing channel
    // keeps the policy the parent already chose.
    policy: existing?.policy ?? 'manual',
    status: 'allowed',
    muted: false,
    addedAt: existing?.addedAt ?? now,
  };

  await repo.upsertChannel(channel);
  await syncChannel(repo, channel, fetchFn, now);

  recordLog('info', 'add', `kanał ${channelId} dodany (${entries.length} wpisów RSS)`);
  return { ok: true, kind: 'channel', channel };
}
