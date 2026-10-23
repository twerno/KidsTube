import type { Decision, Video } from '../src/domain/types';
import {
  decisionsForVideo,
  latestDecision,
  manualDecision,
  projectStatus,
  projectVideos,
  repeatProposalDecision,
  statusForOutcome,
} from '../src/domain/decisions';

const video = (id: string, status: Video['status'] = 'pending'): Video => ({
  id,
  title: id,
  status,
  source: 'rss',
  addedAt: 0,
});

const decision = (
  videoId: string,
  outcome: Decision['outcome'],
  at: number,
  source: Decision['source'] = 'manual',
): Decision => ({ videoId, outcome, source, at });

describe('statusForOutcome', () => {
  it('maps allow/reject onto allowed/blocked', () => {
    expect(statusForOutcome('allow')).toBe('allowed');
    expect(statusForOutcome('reject')).toBe('blocked');
  });
});

describe('latestDecision (last-wins)', () => {
  it('returns undefined without any decision', () => {
    expect(latestDecision([], 'v1')).toBeUndefined();
    expect(latestDecision([decision('other', 'allow', 1)], 'v1')).toBeUndefined();
  });

  it('picks the most recent entry for the video', () => {
    const log = [
      decision('v1', 'reject', 10),
      decision('other', 'allow', 99),
      decision('v1', 'allow', 20),
    ];
    expect(latestDecision(log, 'v1')?.outcome).toBe('allow');
    expect(latestDecision(log, 'v1')?.at).toBe(20);
  });

  it('later entry wins on equal timestamps (append order)', () => {
    const log = [decision('v1', 'reject', 5), decision('v1', 'allow', 5)];
    expect(latestDecision(log, 'v1')?.outcome).toBe('allow');
  });
});

describe('decisionsForVideo', () => {
  it('returns one video history newest first', () => {
    const log = [
      decision('v1', 'reject', 10),
      decision('v1', 'allow', 30),
      decision('v2', 'allow', 20),
    ];
    expect(decisionsForVideo(log, 'v1').map(d => d.at)).toEqual([30, 10]);
  });
});

describe('projectStatus / projectVideos', () => {
  it('falls back to the stored status when there is no decision', () => {
    expect(projectStatus(video('v1', 'allowed'), [])).toBe('allowed');
    expect(projectStatus(video('v1', 'pending'), [])).toBe('pending');
  });

  it('lets the latest decision override the stored status', () => {
    const log = [decision('v1', 'allow', 10), decision('v1', 'reject', 20)];
    expect(projectStatus(video('v1', 'allowed'), log)).toBe('blocked');
  });

  it('projects a whole list without mutating the input', () => {
    const videos = [video('v1', 'pending'), video('v2', 'allowed')];
    const log = [decision('v1', 'allow', 10)];
    const projected = projectVideos(videos, log);
    expect(projected.map(v => v.status)).toEqual(['allowed', 'allowed']);
    expect(videos[0].status).toBe('pending');
  });
});

describe('repeatProposalDecision', () => {
  it('does nothing for a first-time proposal', () => {
    expect(repeatProposalDecision([], 'v1', 100)).toBeUndefined();
  });

  it('repeats the latest outcome as an auto decision', () => {
    const log = [decision('v1', 'reject', 10)];
    const repeat = repeatProposalDecision(log, 'v1', 100);
    expect(repeat).toEqual({
      videoId: 'v1',
      outcome: 'reject',
      source: 'auto',
      at: 100,
      channelId: undefined,
    });
  });

  it('follows a changed decision (last-wins)', () => {
    const log = [decision('v1', 'reject', 10), decision('v1', 'allow', 20)];
    expect(repeatProposalDecision(log, 'v1', 100)?.outcome).toBe('allow');
  });

  it('carries the channel snapshot onto the repeat', () => {
    const log: Decision[] = [
      { videoId: 'v1', outcome: 'allow', source: 'manual', at: 10, channelId: 'UC1' },
    ];
    expect(repeatProposalDecision(log, 'v1', 100)?.channelId).toBe('UC1');
  });
});

describe('manualDecision', () => {
  it('snapshots the channel and uses the manual source', () => {
    expect(manualDecision({ id: 'v1', channelId: 'UC1' }, 'reject', 5)).toEqual({
      videoId: 'v1',
      outcome: 'reject',
      source: 'manual',
      at: 5,
      channelId: 'UC1',
    });
  });
});