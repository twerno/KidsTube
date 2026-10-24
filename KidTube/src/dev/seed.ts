/**
 * Temporary test seed. Set ENABLE_TEST_SEED to false to disable.
 *
 * Seeded videos are only inserted when missing, so a parent decision (e.g.
 * blocking them) is never overwritten.
 */

import type { Video } from '../domain/types';

export const ENABLE_TEST_SEED = true;

/** Ids from earlier test seeds — removed on startup so the seed can be swapped. */
export const SEED_REPLACED_IDS: string[] = ['oQVHSNb8HLU', 'ssr2cTC2bhs'];

export const SEED_TEST_VIDEOS: Video[] = [
  {
    id: 'ssr2cTC2bhs',
    channelId: 'UCZhWZdKjn0e3ctyVZxsMkKQ',
    channelTitle: 'shinmiri2',
    title: 'GWENT | SHUPE ALE ARTIFACTS | BC POLL IN DESCRIPTION',
    thumbnailUrl: 'https://i.ytimg.com/vi/ssr2cTC2bhs/hqdefault.jpg',
    publishedAt: Date.parse('2026-10-22T01:34:20-07:00'),
    status: 'allowed',
    source: 'manual',
    addedAt: 1_700_000_000_000,
  },
];
