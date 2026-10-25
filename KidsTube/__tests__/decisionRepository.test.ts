import { MemoryRepository } from '../src/data/memoryRepository';
import { projectVideos } from '../src/domain/decisions';
import type { Video } from '../src/domain/types';

const video = (id: string, status: Video['status']): Video => ({
  id,
  title: id,
  status,
  source: 'rss',
  addedAt: 0,
});

describe('decision history in the repository', () => {
  it('appends decisions and projects video.status', async () => {
    const repo = new MemoryRepository({ videos: [video('v1', 'pending')] });
    await repo.init();

    await repo.recordDecision({ videoId: 'v1', outcome: 'allow', source: 'manual', at: 10 });
    await repo.recordDecision({ videoId: 'v1', outcome: 'reject', source: 'manual', at: 20 });

    // Append-only: both entries survive; the cached status follows the latest.
    expect((await repo.listDecisions()).map(d => d.outcome)).toEqual(['allow', 'reject']);
    expect((await repo.getVideo('v1'))?.status).toBe('blocked');
  });

  it('keeps history for videos that were removed', async () => {
    const repo = new MemoryRepository({ videos: [video('v1', 'pending')] });
    await repo.init();
    await repo.recordDecision({ videoId: 'v1', outcome: 'allow', source: 'manual', at: 10 });
    await repo.removeVideo('v1');

    expect(await repo.getVideo('v1')).toBeUndefined();
    expect(await repo.listDecisions()).toHaveLength(1);
  });

  it('history outlives a removed channel', async () => {
    const repo = new MemoryRepository({
      channels: [{ id: 'UC1', title: 'C', policy: 'manual', status: 'allowed', addedAt: 0 }],
      videos: [{ ...video('v1', 'allowed'), channelId: 'UC1' }],
    });
    await repo.init();
    await repo.recordDecision({
      videoId: 'v1',
      outcome: 'allow',
      source: 'manual',
      at: 10,
      channelId: 'UC1',
    });
    await repo.removeChannel('UC1');

    expect(await repo.listVideos()).toHaveLength(0);
    expect((await repo.listDecisions())[0].channelId).toBe('UC1');
  });

  it('projectVideos turns the log into visible statuses', async () => {
    const repo = new MemoryRepository({ videos: [video('v1', 'pending')] });
    await repo.init();
    await repo.recordDecision({ videoId: 'v1', outcome: 'allow', source: 'manual', at: 10 });

    const projected = projectVideos(await repo.listVideos(), await repo.listDecisions());
    expect(projected[0].status).toBe('allowed');
  });

  it('accumulates and resets daily watch time', async () => {
    const repo = new MemoryRepository();
    await repo.init();

    expect(await repo.getUsage('2026-10-23')).toBe(0);
    await repo.addUsageSeconds('2026-10-23', 30);
    await repo.addUsageSeconds('2026-10-23', 15);
    expect(await repo.getUsage('2026-10-23')).toBe(45);

    await repo.resetUsage('2026-10-23');
    expect(await repo.getUsage('2026-10-23')).toBe(0);
  });
});