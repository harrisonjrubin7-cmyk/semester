import { describe, expect, it } from 'vitest';
import { buildCatalog, blocksFor, weakestUnit } from './catalog';
import { blankCourse } from '../lib/edit';
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

/*
 * A course typed in by hand crashed its own study guide.
 *
 * `blankCourse` gives it a real guide with no units — deliberately, so that
 * every study screen can read `guide.units` without a null check of its own.
 * `weakestUnit` did not hold up the other end: with no units it still
 * answered `{ index: 0, unit: guide.units[0] }`, and `units[0]` of an empty
 * array is `undefined`. `screens/Guide.tsx` read `.name` off that, so adding
 * a course by hand and opening Study put the error screen in front of
 * somebody who had done nothing wrong.
 *
 * The fix is in the type rather than at the call site — the next caller would
 * have had the same crash waiting for it — so this holds the type.
 */
describe('the weakest unit of a guide with none', () => {
  it('is null rather than a unit that is not there', () => {
    const { guide } = blankCourse('HIST 1500');
    expect(guide.units).toEqual([]);
    expect(weakestUnit(guide)).toBeNull();
  });

  it('still names the coldest unit when there are units', () => {
    // Guards the null above: a function that answered null always would pass
    // the first test and be useless.
    const guide = {
      ...blankCourse('HIST 1500').guide,
      units: [
        { name: 'Warm', mastery: 80, cards: [] },
        { name: 'Cold', mastery: 12, cards: [] },
        { name: 'Middling', mastery: 44, cards: [] },
      ],
    } as Parameters<typeof weakestUnit>[0];
    expect(weakestUnit(guide)?.unit.name).toBe('Cold');
    expect(weakestUnit(guide)?.index).toBe(1);
  });

  it('takes the first of a tie, so the answer does not wander', () => {
    const guide = {
      ...blankCourse('HIST 1500').guide,
      units: [
        { name: 'One', mastery: 30, cards: [] },
        { name: 'Two', mastery: 30, cards: [] },
      ],
    } as Parameters<typeof weakestUnit>[0];
    expect(weakestUnit(guide)?.index).toBe(0);
  });
});

/**
 * A term stops teaching, which the weekly pattern had no way to know.
 *
 * The syllabi give days and times and no term dates, so a Fall course was
 * drawn on every Monday, Wednesday and Friday there has ever been. Walked in
 * a browser: on 10 February 2027, with only the four Fall 2026 courses
 * loaded, Today said "5 minutes until ECON 1020", the next-class card counted
 * down to it, and the map offered to walk you there.
 *
 * It is worse than a stale card once somebody has two terms in the app, which
 * is the thing `lib/term.ts` exists to allow: last autumn's four courses
 * would sit on the rail beside this spring's, every week, for good.
 */
describe('a term stops teaching', () => {
  // MWF 9:05, with the one deadline the helper gives, in September.
  const fall = (): CourseModule => {
    const m = mod({ term: '2026FA', month: 8, day: 4 });
    m.schedule = [{ days: [1, 3, 5], at: 545, time: '9:05a', title: 'Lecture', meta: '' }];
    return m;
  };
  const on = (m: CourseModule, d: Date) => blocksFor(buildCatalog([m]), d);

  it('draws the pattern inside the term', () => {
    // Wednesday 30 September 2026.
    expect(on(fall(), new Date(2026, 8, 30))).toHaveLength(1);
  });

  it('draws it in the first weeks, before the first deadline', () => {
    // Monday 31 August 2026 — term has started, nothing is due yet. A window
    // that began at the first deadline would blank the rail for the week
    // that matters most.
    expect(on(fall(), new Date(2026, 7, 31))).toHaveLength(1);
  });

  it('draws it through finals, in the month the next season starts', () => {
    // Wednesday 16 December 2026. `isPast` calls Fall over on 1 December,
    // which is why it is not the rule this uses.
    expect(on(fall(), new Date(2026, 11, 16))).toHaveLength(1);
  });

  it('stops once the term is over', () => {
    // Wednesday 10 February 2027 — the day the browser walk found.
    expect(on(fall(), new Date(2027, 1, 10))).toEqual([]);
    // And a year on, on the same weekday.
    expect(on(fall(), new Date(2027, 8, 29))).toEqual([]);
  });

  it('does not draw it before the term begins', () => {
    // Wednesday 1 July 2026.
    expect(on(fall(), new Date(2026, 6, 1))).toEqual([]);
  });

  it('follows a syllabus whose last date is outside the season', () => {
    // A Fall course with an exam on 6 January. The season window ends on 31
    // December; the syllabus wins, and the classes on the day of the exam
    // are still drawn.
    const m = fall();
    m.items.push({ ...m.items[0], id: 'i2', title: 'Deferred final', month: 0, day: 6 });
    // Wednesday 6 January 2027.
    expect(on(m, new Date(2027, 0, 6))).toHaveLength(1);
    // And it still stops after that.
    expect(on(m, new Date(2027, 1, 10))).toEqual([]);
  });

  it('keeps two terms apart', () => {
    const spring = mod({ id: 'c2', code: 'TEST 200', term: '2027SP', month: 2, day: 3 });
    spring.schedule = [{ days: [1, 3, 5], at: 600, time: '10:00a', title: 'Seminar', meta: '' }];
    const cat = buildCatalog([fall(), spring]);
    // Wednesday 10 February 2027: this spring's class, and not last autumn's.
    expect(blocksFor(cat, new Date(2027, 1, 10)).map((b) => b.title)).toEqual(['Seminar']);
    // Wednesday 30 September 2026: last autumn's, and not this spring's.
    expect(blocksFor(cat, new Date(2026, 8, 30)).map((b) => b.title)).toEqual(['Lecture']);
  });

  it('still draws a dated exception, which is a day somebody wrote down', () => {
    // An extra session needs no window to justify it — see `teachingSpan`.
    const m = fall();
    m.exceptions = [
      { month: 8, day: 30, extra: { time: '4:00p', at: 960, title: 'Review session', meta: '' } },
    ];
    const titles = on(m, new Date(2026, 8, 30)).map((b) => b.title);
    expect(titles).toContain('Review session');
  });
});

