/**
 * One pipeline for every incoming YouTube link (ADR 0013 / ADR 0014).
 *
 * Sharing and intercepted `VIEW` links take the same route: a film is resolved
 * against the library, channel policy and decision history; a channel becomes a
 * parent-only proposal. The pipeline never starts playback and never opens a
 * browser — adding/deciding content is a different intention than “play now”.
 */

import type { Channel, ChannelProposal, Video } from '../domain/types';
import { parseYouTubeLink, type ParsedYouTubeLink } from '../domain/youtubeUrl';
import { decideIncomingVideoStatus } from '../domain/content';
import { latestDecision, projectStatus, statusForOutcome } from '../domain/decisions';
import type { Repository } from '../data/repository';
import {
  channelPageUrl,
  proposalForChannelId,
  saveChannelProposal,
  unresolvedChannelProposal,
} from './channelProposals';
import { resolveChannelFromUrl } from './channelResolve';
import { fetchOEmbed, fetchPlayerMetadata, type FetchLike } from './youtubeMetadata';

export type IncomingLinkOrigin = 'share' | 'view';

/**
 * A `VIEW` link is only processed when the parent enabled the optional system
 * handler (ADR 0014). Sharing is always allowed, independently of that setting.
 */
export function shouldProcessIncomingLink(
  origin: IncomingLinkOrigin,
  handlerEnabled: boolean,
): boolean {
  return origin === 'share' || handlerEnabled;
}

export type IncomingLinkResult =
  /** The film is (already) visible in the library — no playback, no duplicate. */
  | { kind: 'allowed'; video: Video; reason: 'known' | 'decision' | 'policy' }
  | { kind: 'blocked'; video: Video }
  | { kind: 'pending'; video: Video }
  | { kind: 'channel-known'; channel: Channel }
  | { kind: 'channel-blocked'; channel: Channel }
  | { kind: 'channel-proposal'; proposal: ChannelProposal; created: boolean }
  | { kind: 'unknown'; raw: string };

/**
 * For an unknown video the record is created with `source`:
 *  - 'share'  — a link shared/intercepted from YouTube or the browser,
 *  - 'propose'— the child's “Zaproponuj film” button (stays pending unless a
 *               parent decision already exists; channel policy is for shares).
 */
export async function handleIncomingLink(
  raw: string,
  repo: Repository,
  fetchFn?: FetchLike,
  now: number = Date.now(),
  source: 'share' | 'propose' = 'share',
): Promise<IncomingLinkResult> {
  const parsed = parseYouTubeLink(raw);

  if (parsed.kind === 'video') {
    return handleVideo(parsed, repo, fetchFn, now, source);
  }

  if (parsed.kind === 'channel') {
    return handleChannel(parsed, repo, fetchFn, now);
  }

  return { kind: 'unknown', raw };
}

async function handleVideo(
  parsed: Extract<ParsedYouTubeLink, { kind: 'video' }>,
  repo: Repository,
  fetchFn: FetchLike | undefined,
  now: number,
  source: 'share' | 'propose',
): Promise<IncomingLinkResult> {
  const decisions = await repo.listDecisions();
  const existing = await repo.getVideo(parsed.videoId);

  if (existing) {
    const existingChannel = existing.channelId
      ? await repo.getChannel(existing.channelId)
      : undefined;
    const status =
      existingChannel?.status === 'blocked' ? 'blocked' : projectStatus(existing, decisions);
    const video = { ...existing, status };
    if (status === 'allowed') {
      return { kind: 'allowed', video, reason: 'known' };
    }
    if (status === 'blocked') {
      return { kind: 'blocked', video };
    }
    return { kind: 'pending', video };
  }

  const [meta, player] = await Promise.all([
    fetchOEmbed(parsed.videoId, fetchFn),
    fetchPlayerMetadata(parsed.videoId, fetchFn),
  ]);
  const channelId = player?.channelId;
  const channel = channelId ? await repo.getChannel(channelId) : undefined;
  const latest = latestDecision(decisions, parsed.videoId);

  // A child's proposal is not a channel-policy event: only a previous parent
  // decision (last-wins, even after deletion) can resolve it immediately.
  const status =
    source === 'propose'
      ? latest
        ? statusForOutcome(latest.outcome)
        : 'pending'
      : decideIncomingVideoStatus(channel, latest);

  const video: Video = {
    id: parsed.videoId,
    channelId,
    channelTitle: channel?.title ?? player?.channelTitle ?? meta?.authorName,
    title: meta?.title ?? parsed.videoId,
    thumbnailUrl: meta?.thumbnailUrl,
    publishedAt: player?.publishedAt,
    status,
    source,
    addedAt: now,
  };
  await repo.upsertVideos([video]);

  if (status === 'allowed') {
    return { kind: 'allowed', video, reason: latest ? 'decision' : 'policy' };
  }
  if (status === 'blocked') {
    return { kind: 'blocked', video };
  }
  return { kind: 'pending', video };
}

async function handleChannel(
  parsed: Extract<ParsedYouTubeLink, { kind: 'channel' }>,
  repo: Repository,
  fetchFn: FetchLike | undefined,
  now: number,
): Promise<IncomingLinkResult> {
  // A /channel/UC… link already carries the id; handle/slug links must be
  // resolved through InnerTube. Failure is not fatal — the parent can retry.
  let proposal: ChannelProposal | undefined;
  if (parsed.channelId) {
    const known = await repo.getChannel(parsed.channelId);
    if (known) {
      return known.status === 'blocked'
        ? { kind: 'channel-blocked', channel: known }
        : { kind: 'channel-known', channel: known };
    }
    proposal = await proposalForChannelId(parsed.channelId, parsed.raw, fetchFn, now);
  } else {
    const url = channelPageUrl(parsed.raw);
    const resolved = url ? await resolveChannelFromUrl(url, fetchFn) : undefined;
    if (resolved) {
      const known = await repo.getChannel(resolved.channelId);
      if (known) {
        return known.status === 'blocked'
          ? { kind: 'channel-blocked', channel: known }
          : { kind: 'channel-known', channel: known };
      }
      proposal = {
        id: resolved.channelId,
        channelId: resolved.channelId,
        rawUrl: parsed.raw,
        title: resolved.title,
        handle: resolved.handle ?? parsed.handle,
        resolved: true,
        addedAt: now,
      };
    } else {
      proposal = unresolvedChannelProposal(parsed.raw, now);
    }
  }

  const saved = await saveChannelProposal(repo, proposal);
  return { kind: 'channel-proposal', proposal: saved.proposal, created: saved.created };
}
