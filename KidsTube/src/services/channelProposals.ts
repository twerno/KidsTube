/**
 * Channel proposals (ADR 0013): a channel link shared by anyone lands here as a
 * parent-only pending item. It is not a `Channel` yet — it does not sync RSS,
 * never reaches the child and never enters the video decision history. Only the
 * parent can turn it into a `manual` channel (which then starts its RSS sync) or
 * reject it.
 */

import type { Channel, ChannelProposal } from '../domain/types';
import { isChannelMuted } from '../domain/channels';
import { parseYouTubeLink } from '../domain/youtubeUrl';
import type { Repository } from '../data/repository';
import { resolveChannelFromUrl } from './channelResolve';
import { fetchChannelFeed, syncChannel } from './channelSync';
import type { FetchLike } from './youtubeMetadata';

/** Stable key used before/without a resolved channel id. */
export function rawChannelProposalKey(rawUrl: string): string {
  return `raw:${rawUrl.trim()}`;
}

/**
 * Turn any supported channel link/handle/slug into an https URL that the
 * InnerTube resolver understands. A bare `@handle` arrives from sharing as
 * `@handle`, not a URL.
 */
export function channelPageUrl(rawUrl: string): string | undefined {
  const raw = rawUrl.trim();
  if (!raw) {
    return undefined;
  }
  if (/^https?:\/\//i.test(raw)) {
    return raw;
  }
  const parsed = parseYouTubeLink(raw);
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

/** Build a resolved proposal from a channel id and (optional) fetched metadata. */
export async function proposalForChannelId(
  channelId: string,
  rawUrl: string,
  fetchFn?: FetchLike,
  now: number = Date.now(),
  handle?: string,
): Promise<ChannelProposal> {
  const entries = await fetchChannelFeed(channelId, fetchFn);
  return {
    id: channelId,
    channelId,
    rawUrl,
    title: entries[0]?.channelTitle ?? channelId,
    handle,
    resolved: true,
    addedAt: now,
  };
}

/** A proposal for a link InnerTube could not resolve; the parent may retry it. */
export function unresolvedChannelProposal(rawUrl: string, now: number = Date.now()): ChannelProposal {
  return {
    id: rawChannelProposalKey(rawUrl),
    rawUrl,
    title: rawUrl,
    resolved: false,
    addedAt: now,
  };
}

/**
 * Persist a proposal, deduplicated by channel id when resolved, otherwise by
 * the raw link (ADR 0013). When an unresolved proposal is resolved later, the
 * old raw-keyed record is replaced by the channel-id one.
 */
export async function saveChannelProposal(
  repo: Repository,
  proposal: ChannelProposal,
): Promise<{ proposal: ChannelProposal; created: boolean }> {
  const proposals = await repo.listChannelProposals();
  const existing = proposal.channelId
    ? proposals.find(p => p.channelId === proposal.channelId)
    : proposals.find(p => !p.channelId && (p.id === proposal.id || p.rawUrl === proposal.rawUrl));

  if (!existing) {
    await repo.upsertChannelProposal(proposal);
    return { proposal, created: true };
  }

  // Keep the original submission time, but enrich an unresolved duplicate once
  // we finally know its channel id.
  if (proposal.channelId && !existing.channelId) {
    const merged: ChannelProposal = { ...proposal, addedAt: existing.addedAt };
    if (existing.id !== merged.id) {
      await repo.removeChannelProposal(existing.id);
    }
    await repo.upsertChannelProposal(merged);
    return { proposal: merged, created: false };
  }

  return { proposal: existing, created: false };
}

/**
 * Resolve a raw channel link on demand (parent's “Spróbuj ponownie”). Resolved
 * proposals are returned untouched.
 */
export async function resolveChannelProposal(
  proposal: ChannelProposal,
  fetchFn?: FetchLike,
): Promise<ChannelProposal | undefined> {
  if (proposal.channelId && proposal.resolved) {
    return proposal;
  }
  const url = channelPageUrl(proposal.rawUrl);
  if (!url) {
    return undefined;
  }
  const resolved = await resolveChannelFromUrl(url, fetchFn);
  if (!resolved) {
    return undefined;
  }
  return {
    ...proposal,
    id: resolved.channelId,
    channelId: resolved.channelId,
    title: resolved.title,
    handle: resolved.handle ?? proposal.handle,
    resolved: true,
  };
}

export type ApproveChannelProposalResult =
  | { kind: 'added'; channel: Channel }
  | { kind: 'already'; channel: Channel }
  /** The channel existed but was muted; an explicit add unmutes it (ADR 0015). */
  | { kind: 'unmuted'; channel: Channel }
  | { kind: 'unresolved' };

/**
 * Parent action “Dodaj kanał”: creates a `manual`, allowed channel and starts
 * its RSS sync. Existing videos of a manual channel become pending (ADR 0001),
 * never auto-approved — one shared link is not enough trust (ADR 0013).
 */
export async function approveChannelProposal(
  repo: Repository,
  proposal: ChannelProposal,
  fetchFn?: FetchLike,
  now: number = Date.now(),
): Promise<ApproveChannelProposalResult> {
  const resolved = await resolveChannelProposal(proposal, fetchFn);
  if (!resolved?.channelId) {
    return { kind: 'unresolved' };
  }

  const known = await repo.getChannel(resolved.channelId);
  await repo.removeChannelProposal(proposal.id);
  if (proposal.id !== resolved.id) {
    await repo.removeChannelProposal(resolved.id);
  }
  if (known) {
    if (!isChannelMuted(known)) {
      return { kind: 'already', channel: known };
    }
    // Explicitly adding a muted channel is an act of subscribing to it again.
    const channel: Channel = { ...known, muted: false };
    await repo.upsertChannel(channel);
    if (channel.status !== 'blocked') {
      await syncChannel(repo, channel, fetchFn, now);
    }
    return { kind: 'unmuted', channel };
  }

  const channel: Channel = {
    id: resolved.channelId,
    title: resolved.title,
    handle: resolved.handle,
    thumbnailUrl: resolved.thumbnailUrl,
    policy: 'manual',
    status: 'allowed',
    muted: false,
    addedAt: now,
  };
  await repo.upsertChannel(channel);
  await syncChannel(repo, channel, fetchFn, now);
  return { kind: 'added', channel };
}

export type RetryChannelProposalResult =
  | { kind: 'resolved'; proposal: ChannelProposal }
  | { kind: 'already'; channel: Channel }
  | { kind: 'unresolved' };

/** Parent action “Spróbuj ponownie” for an unresolved proposal. */
export async function retryChannelProposal(
  repo: Repository,
  proposal: ChannelProposal,
  fetchFn?: FetchLike,
): Promise<RetryChannelProposalResult> {
  const resolved = await resolveChannelProposal(proposal, fetchFn);
  if (!resolved?.channelId) {
    return { kind: 'unresolved' };
  }

  const known = await repo.getChannel(resolved.channelId);
  if (known) {
    await repo.removeChannelProposal(proposal.id);
    if (proposal.id !== resolved.id) {
      await repo.removeChannelProposal(resolved.id);
    }
    return { kind: 'already', channel: known };
  }

  const proposals = await repo.listChannelProposals();
  const duplicate = proposals.find(
    p => p.id !== proposal.id && p.channelId === resolved.channelId,
  );
  await repo.removeChannelProposal(proposal.id);
  if (!duplicate) {
    await repo.upsertChannelProposal(resolved);
  }
  return { kind: 'resolved', proposal: duplicate ?? resolved };
}

/** Parent action “Odrzuć”: removes the proposal, leaves no decision behind. */
export async function rejectChannelProposal(
  repo: Repository,
  proposal: ChannelProposal,
): Promise<void> {
  await repo.removeChannelProposal(proposal.id);
}
