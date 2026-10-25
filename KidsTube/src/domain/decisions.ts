/**
 * Decision history (ADR 0001) — pure rules.
 *
 * Every decision is appended to a log; the **latest** entry for a video is the
 * source of truth (last-wins). `Video.status` stays around as a cached
 * projection so the rest of the app keeps working with a single field, but it is
 * always derivable from the log (falling back to the stored status when no
 * decision exists yet, e.g. an auto-approved upload).
 */

import type { Decision, DecisionOutcome, Video, VideoStatus } from './types';

/** Map a decision outcome onto the projected `Video.status`. */
export function statusForOutcome(outcome: DecisionOutcome): VideoStatus {
  if (outcome === 'allow') {
    return 'allowed';
  }
  if (outcome === 'reject') {
    return 'blocked';
  }
  // `retract` takes the decision back: the film is undecided again.
  return 'pending';
}

/** The most recent decision for a video. Later entries win on equal timestamps. */
export function latestDecision(decisions: Decision[], videoId: string): Decision | undefined {
  let latest: Decision | undefined;
  for (const decision of decisions) {
    if (decision.videoId !== videoId) {
      continue;
    }
    if (!latest || decision.at >= latest.at) {
      latest = decision;
    }
  }
  return latest;
}

/** History for a single video, newest first. */
export function decisionsForVideo(decisions: Decision[], videoId: string): Decision[] {
  return decisions
    .filter(decision => decision.videoId === videoId)
    .sort((a, b) => b.at - a.at);
}

/**
 * Visibility of a video: the latest decision wins, otherwise the stored status
 * (an auto-approved video has no decision — its sync timestamp is the moment).
 */
export function projectStatus(video: Video, decisions: Decision[]): VideoStatus {
  const latest = latestDecision(decisions, video.id);
  return latest ? statusForOutcome(latest.outcome) : video.status;
}

/** Apply the projection to a whole list. */
export function projectVideos(videos: Video[], decisions: Decision[]): Video[] {
  return videos.map(video => ({ ...video, status: projectStatus(video, decisions) }));
}

/**
 * A repeat proposal resolves automatically to the latest decision (ADR 0001).
 * Returns the `auto` decision to append, or undefined when the video has no
 * prior decision (a first-time proposal simply stays pending).
 */
export function repeatProposalDecision(
  decisions: Decision[],
  videoId: string,
  now: number,
): Decision | undefined {
  const latest = latestDecision(decisions, videoId);
  // A retracted decision means “undecided”: a repeat proposal must not
  // auto-resolve to it, it simply stays pending (ADR 0016).
  if (!latest || latest.outcome === 'retract') {
    return undefined;
  }
  return {
    videoId,
    outcome: latest.outcome,
    source: 'auto',
    at: now,
    channelId: latest.channelId,
  };
}

/** Build a parent-made decision for a video. */
export function manualDecision(
  video: Pick<Video, 'id' | 'channelId'>,
  outcome: DecisionOutcome,
  now: number,
): Decision {
  return {
    videoId: video.id,
    outcome,
    source: 'manual',
    at: now,
    channelId: video.channelId,
  };
}
