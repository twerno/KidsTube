import { groupVideosByDate, groupVideosByLastWatched } from '../src/domain/videoGroups';
import type { Video } from '../src/domain/types';

const MONTHS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];

const at = (year: number, month: number, day: number): number =>
  new Date(year, month - 1, day, 12, 0, 0).getTime();

const video = (id: string, publishedAt?: number): Video => ({
  id,
  title: id,
  status: 'allowed',
  source: 'rss',
  addedAt: 0,
  publishedAt,
});

describe('video date grouping (ADR 0020 / 0024)', () => {
  const now = new Date(2026, 9, 15, 12, 0, 0); // Thursday, 15 October 2026

  it('puts films into this week and this month, then one band per older month', () => {
    const groups = groupVideosByDate(
      [
        video('week', at(2026, 10, 14)),
        video('month', at(2026, 10, 5)),
        video('september', at(2026, 9, 20)),
        video('august', at(2026, 8, 1)),
        video('december-2025', at(2025, 12, 20)),
      ],
      now,
    );

    expect(groups.map(group => group.key)).toEqual([
      'week',
      'month',
      'month:2026-09',
      'month:2026-08',
      'month:2025-12',
    ]);
    expect(groups.map(group => group.title)).toEqual([
      'W tym tygodniu',
      'W tym miesiącu',
      'We wrześniu',
      'W sierpniu',
      'W grudniu 2025',
    ]);
    expect(groups.map(group => group.videos.map(item => item.id))).toEqual([
      ['week'],
      ['month'],
      ['september'],
      ['august'],
      ['december-2025'],
    ]);
  });

  it('adds the year only to months from another year', () => {
    const groups = groupVideosByDate(
      [
        video('january', at(2026, 1, 5)),
        video('december', at(2025, 12, 5)),
        video('november', at(2025, 11, 5)),
      ],
      now,
    );
    expect(groups.map(group => group.title)).toEqual([
      'W styczniu',
      'W grudniu 2025',
      'W listopadzie 2025',
    ]);
  });

  it('uses the right preposition for every month', () => {
    const titles = groupVideosByDate(
      MONTHS.map(month => video(`m${month}`, at(2025, month, 5))),
      now,
    ).map(group => group.title);

    expect(titles).toEqual([
      'W grudniu 2025',
      'W listopadzie 2025',
      'W październiku 2025',
      'We wrześniu 2025',
      'W sierpniu 2025',
      'W lipcu 2025',
      'W czerwcu 2025',
      'W maju 2025',
      'W kwietniu 2025',
      'W marcu 2025',
      'W lutym 2025',
      'W styczniu 2025',
    ]);
  });

  it('orders within a band by publication date and omits empty bands', () => {
    const groups = groupVideosByDate(
      [video('older', at(2026, 8, 10)), video('newer', at(2026, 8, 20))],
      now,
    );
    expect(groups).toHaveLength(1);
    expect(groups[0].videos.map(item => item.id)).toEqual(['newer', 'older']);
  });

  it('sends entries without a publication date to “Bez daty”, never by import time', () => {
    const importedNow: Video = {
      ...video('imported-now'),
      publishedAt: undefined,
      addedAt: now.getTime(),
    };
    const groups = groupVideosByDate(
      [video('dated', at(2026, 10, 14)), video('empty'), importedNow],
      now,
    );
    expect(groups.map(group => group.key)).toEqual(['week', 'unknown']);
    expect(groups[1].title).toBe('Bez daty');
    // Sorting inside the unknown group may use import time; the group itself
    // never pretends the film belongs to this week/month.
    expect(groups[1].videos.map(item => item.id)).toEqual(['imported-now', 'empty']);
  });
});

describe('“Kontynuuj oglądanie” day bands (ADR 0023)', () => {
  const now = new Date(2026, 9, 15, 12, 0, 0); // Thursday, 15 October 2026
  const film = (id: string): Video => ({
    id,
    title: id,
    status: 'allowed',
    source: 'rss',
    addedAt: 0,
    publishedAt: at(2020, 1, 1),
  });
  const progress = (videoId: string, watchedAt: Date, positionSeconds = 60) => ({
    videoId,
    positionSeconds,
    completed: false,
    lastWatchedAt: watchedAt.getTime(),
  });

  it('bands films by the day of the last playback, newest day first', () => {
    const groups = groupVideosByLastWatched(
      [film('old'), film('today-early'), film('today-late'), film('yesterday')],
      [
        progress('old', new Date(2026, 9, 10, 8, 0, 0)),
        progress('today-early', new Date(2026, 9, 15, 8, 0, 0)),
        progress('today-late', new Date(2026, 9, 15, 18, 0, 0)),
        progress('yesterday', new Date(2026, 9, 14, 20, 0, 0)),
      ],
      now.getTime(),
    );

    expect(groups.map(group => group.title)).toEqual(['Dziś', 'Wczoraj', '10 października 2026']);
    expect(groups[0].videos.map(item => item.id)).toEqual(['today-late', 'today-early']);
    expect(groups[1].videos.map(item => item.id)).toEqual(['yesterday']);
    // Publication date plays no part in the bands.
    expect(groups[2].videos.map(item => item.id)).toEqual(['old']);
  });

  it('drops films without a stored playback', () => {
    const groups = groupVideosByLastWatched(
      [film('known'), film('unknown')],
      [progress('known', new Date(2026, 9, 15, 8, 0, 0))],
      now.getTime(),
    );
    expect(groups.flatMap(group => group.videos.map(item => item.id))).toEqual(['known']);
  });
});
