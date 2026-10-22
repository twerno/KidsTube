/**
 * Temporary test seed. Set ENABLE_TEST_SEED to false to disable.
 *
 * Seeded videos are only inserted when missing, so a parent decision (e.g.
 * blocking them) is never overwritten.
 */

import type { Video } from '../domain/types';

export const ENABLE_TEST_SEED = true;

export const SEED_TEST_VIDEOS: Video[] = [
  {
    id: 'oQVHSNb8HLU',
    channelTitle: 'shinmiri2',
    title: 'GWENT | TRAPS DEVOTION TREANT MANTIS',
    thumbnailUrl: 'https://i.ytimg.com/vi/oQVHSNb8HLU/hqdefault.jpg',
    status: 'allowed',
    source: 'manual',
    addedAt: 1_700_000_000_000,
  },
];
