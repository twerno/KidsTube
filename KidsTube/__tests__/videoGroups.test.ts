import { groupVideosByDate } from '../src/domain/videoGroups';
import type { Video } from '../src/domain/types';

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

describe('video date grouping (ADR 0020)', () => {
  const now = new Date(2026, 9, 15, 12, 0, 0); // Thursday, 15 October 2026

  it('puts films into this week, this month, previous month and older', () => {
    const groups = groupVideosByDate(
      [
        video('older', at(2026, 8, 1)),
        video('week', at(2026, 10, 14)),
        video('previous', at(2026, 9, 20)),
        video('month', at(2026, 10, 5)),
      ],
      now,
    );

    expect(groups.map(group => group.key)).toEqual([
      'week',
      'month',
      'previousMonth',
      'older',
    ]);
    expect(groups.map(group => group.videos.map(item => item.id))).toEqual([
      ['week'],
      ['month'],
      ['previous'],
      ['older'],
    ]);
    expect(groups.map(group => group.title)).toEqual([
      'W tym tygodniu',
      'W tym miesiącu',
      'We wrześniu',
      'Starsze',
    ]);
  });

  it('uses the previous month name and adds the year when it differs', () => {
    const groups = groupVideosByDate([video('december', at(2025, 12, 20))], new Date(2026, 0, 5));
    expect(groups[0]).toMatchObject({ key: 'previousMonth', title: 'We grudniu 2025' });
  });

  it('orders within a group by publication date and omits empty groups', () => {
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
    expect(groups[1].videos.map(item => item.id)).toEqual(['empty', 'imported-now']);
  });
});
