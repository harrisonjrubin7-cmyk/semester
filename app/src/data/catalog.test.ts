import { describe, expect, it } from 'vitest';
import { buildCatalog, blocksFor } from './catalog';
import type { CourseModule } from '../lib/types';
import { decorateItem } from '../lib/date';

/**
 * The catalogue is the one place a year is decided.
 *
 * Every screen downstream reads `item.date` and knows nothing about terms,
 * which only works if the stamping here is right — so this is where the
 * multi-term behaviour is pinned down rather than in each of the nine screens
 * that would otherwise have to be checked by hand.
 */

const mod = (over: Partial<CourseModule['course']> & { month: number; day: number }): CourseModule => {
  const { month, day, ...course } = over;
  return {
    course: {
      id: course.id ?? 'c1',
      code: course.code ?? 'TEST 100',
      name: 'A course',
      prof: 'P',
      email: 'p@x.edu',
      meets: 'MW',
      room: 'R',
      credits: '3',
      source: '',
      grading: [],
      ...course,
    },
    items: [
      {
        id: 'i1',
        c: course.id ?? 'c1',
        title: 'A paper',
        kind: 'Essay',
        month,
        day,
        dueTime: '11:59 PM',
        weight: '20%',
        where: '',
        detail: '',
        quote: '',
        source: '',
      },
    ],
    schedule: [],
    guide: { code: 'TEST 100', name: '', blurb: '', source: '', mastery: 0, audio: false, units: [], terms: [] },
    planMinutes: '',
    frameLabel: '',
  };
};

const yearOf = (m: CourseModule) => {
  const [item] = buildCatalog([m]).items;
  return decorateItem(item, new Date(2026, 8, 3)).date.getFullYear();
};

describe('which year an item lands in', () => {
  it('takes the year from a fall term', () => {
    expect(yearOf(mod({ term: '2026FA', month: 9, day: 20 }))).toBe(2026);
  });

  it('takes the year from a spring term, which is not this one', () => {
    expect(yearOf(mod({ term: '2027SP', month: 1, day: 10 }))).toBe(2027);
  });

  it('rolls a winter session over the new year', () => {
    // December is the term's year …
    expect(yearOf(mod({ term: '2026WI', month: 11, day: 20 }))).toBe(2026);
    // … and the January that follows it is the next one.
    expect(yearOf(mod({ term: '2026WI', month: 0, day: 8 }))).toBe(2027);
  });

  it('files a course saved before terms existed under Fall 2026', () => {
    expect(yearOf(mod({ month: 9, day: 20 }))).toBe(2026);
  });

  it('leaves a year already stamped on an item alone', () => {
    const m = mod({ term: '2027SP', month: 1, day: 10 });
    m.items[0].year = 2030;
    expect(yearOf(m)).toBe(2030);
  });
});

describe('exceptions follow the same year', () => {
  it('cancels the right day in a spring term', () => {
    const m = mod({ term: '2027SP', month: 1, day: 10 });
    m.schedule = [{ days: [3], at: 540, time: '9:00a', title: 'Class', meta: '' }];
    m.exceptions = [{ month: 1, day: 10, canceled: true, meta: 'Away' }];
    const cat = buildCatalog([m]);

    // 10 February 2027 is a Wednesday.
    expect(blocksFor(cat, new Date(2027, 1, 10))[0].canceled).toBe(true);
    // The same day number a year earlier is not.
    expect(blocksFor(cat, new Date(2026, 1, 10))[0]?.canceled).toBeUndefined();
  });
});
