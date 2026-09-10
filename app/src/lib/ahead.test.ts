import { describe, expect, it } from 'vitest';
import { headline, pressure, showHours, studyAsked, week, type WeekInput } from './ahead';
import type { Catalog } from '../data/catalog';
import { blocksFor } from '../data/catalog';
import { lengthOf } from './select';
import type { Commitment } from './activities';
import { weeklyHours } from './activities';
import type { Appointment, Item } from './types';

const NOW = new Date(2026, 8, 3); // Thu 3 Sep 2026

const item = (id: string, month: number, day: number): Item =>
  ({
    id,
    c: 'econ',
    title: id,
    kind: 'Paper',
    month,
    day,
    dueTime: '11:59p',
    weight: '',
    where: '',
    detail: '',
    quote: '',
    source: '',
  }) as Item;

const catalog = (
  items: Item[],
  blocks: Record<number, { at: number; time: string; title: string; meta: string; days: number[] }[]> = {},
  modules: { planMinutes: string }[] = [],
): Catalog =>
  ({
    items,
    courses: [{ id: 'econ', code: 'ECON 1020' }],
    byId: { econ: { id: 'econ', code: 'ECON 1020' } },
    modules,
    short: { econ: 'ECON' },
    shortCodes: ['ECON'],
    empty: items.length === 0,
    lessons: {},
    figures: {},
    extraFigures: {},
    blocks,
  }) as unknown as Catalog;

const input = (over: Partial<WeekInput> = {}): WeekInput => ({
  catalog: catalog([]),
  from: NOW,
  done: {},
  commitments: [],
  appointments: [],
  ...over,
});

const commitment = (over: Partial<Commitment> = {}): Commitment => ({
  id: 'c',
  name: 'Practice',
  kind: 'clubsport',
  role: '',
  where: '',
  url: '',
  note: '',
  days: [4],
  at: 17 * 60,
  minutes: 90,
  hours: 0,
  active: true,
  created: 0,
  ...over,
});

/** A commitment with no fixed time — a shift job, stated as hours a week. */
const job = (over: Partial<Commitment> = {}): Commitment =>
  commitment({ id: 'job', name: 'Dining hall', kind: 'job', days: [], at: null, minutes: 0, hours: 10, ...over });

const round = (n: number): number => Math.round(n * 10) / 10;

const appointment = (date: string): Appointment => ({
  id: date,
  title: 'Dentist',
  date,
  at: 600,
  time: '10:00a',
  where: '',
  note: '',
  created: 0,
});

/**
 * A catalog whose course really meets, with the length its syllabus states.
 *
 * The `catalog` helper above gives `blocksFor` no modules, so every existing
 * test in this file has zero hours of class in it — which is why none of them
 * could see a class being counted at the wrong length.
 */
const meeting = (meets: string, days = [2, 4]): Catalog => {
  const course = { id: 'core', code: 'CORE 2500', meets };
  return {
    items: [],
    courses: [course],
    byId: { core: course },
    modules: [
      {
        course,
        schedule: [{ days, at: 795, time: '1:15p', title: 'CORE 2500', meta: 'Buttrick 101' }],
        exceptions: [],
      },
    ],
    short: { core: 'CORE' },
    shortCodes: ['CORE'],
    empty: false,
    lessons: {},
    figures: {},
    extraFigures: {},
    blocks: {},
  } as unknown as Catalog;
};

describe('how long a class is', () => {
  // Ninety minutes, so the figures survive rounding to a tenth and the test is
  // about the length rather than about the rounding. Thu 3 Sep starts the
  // window, so a Tue/Thu course meets twice in it.
  const NINETY = 'T/R · 1:00–2:30p';

  it('counts it at the length the syllabus states, not at a flat fifty', () => {
    const w = week(input({ catalog: meeting(NINETY) }));
    expect(w.days[0].classes).toBe(1.5);
    expect(w.promised).toBe(3);
  });

  it('still says fifty where the syllabus states no times', () => {
    // The honest fallback, and the only case the old flat number was right for.
    const w = week(input({ catalog: meeting('T/R · Alumni Hall 201') }));
    expect(w.days[0].classes).toBe(0.8);
  });

  it('agrees with the length the hour grid draws', () => {
    // `lengthOf` is what the grid and the Activities screen already use. This
    // screen having an answer of its own is what made the two disagree.
    const cat = meeting(NINETY);
    const drawn = blocksFor(cat, new Date(2026, 8, 3)).reduce((n, b) => n + lengthOf(cat, b), 0);
    expect(week(input({ catalog: cat })).days[0].classes).toBeCloseTo(drawn / 60, 5);
  });

  it('counts nothing for a class that is not happening', () => {
    const cat = meeting(NINETY);
    (cat.modules[0] as { exceptions: unknown[] }).exceptions = [
      { month: 8, day: 3, canceled: true },
    ];
    const w = week(input({ catalog: cat }));
    expect(w.days[0].classes).toBe(0);
    expect(w.promised).toBe(1.5);
  });
});

describe('week', () => {
  it('covers seven days from the day given, not from Monday', () => {
    // A Thursday look at a week that began three days ago is a week you can
    // no longer do anything about.
    const w = week(input());
    expect(w.days).toHaveLength(7);
    expect(w.days[0].name).toBe('Thu');
    expect(w.days[6].name).toBe('Wed');
  });

  it('counts deadlines inside the window and leaves out ones past it', () => {
    const w = week(input({ catalog: catalog([item('near', 8, 5), item('far', 8, 30)]) }));
    expect(w.due.map((i) => i.id)).toEqual(['near']);
  });

  it('leaves out what you have already ticked', () => {
    const w = week(input({ catalog: catalog([item('done', 8, 5)]), done: { done: true } }));
    expect(w.due).toEqual([]);
  });

  it('adds up the hours a commitment that meets weekly costs across the week', () => {
    // 90 minutes on Thursdays: one Thursday falls in a window starting Thu.
    const w = week(input({ commitments: [commitment()] }));
    expect(w.promised).toBeCloseTo(1.5, 5);
  });

  it('counts an appointment as an hour, and says so nowhere else', () => {
    const w = week(input({ appointments: [appointment('2026-09-05')] }));
    expect(w.promised).toBe(1);
  });

  it('names the heaviest day', () => {
    const w = week(input({ commitments: [commitment({ days: [6], minutes: 240 })] }));
    expect(w.heaviest?.name).toBe('Sat');
  });

  it('has no heaviest day when nothing is promised at all', () => {
    expect(week(input()).heaviest).toBe(null);
  });

  it('will not offer a day with a deadline on it as room', () => {
    const w = week(
      input({
        catalog: catalog([item('paper', 8, 4)]),
        commitments: [commitment({ days: [0, 1, 2, 3, 5, 6], minutes: 120 })],
      }),
    );
    // Friday the 4th is otherwise the emptiest, and it has the paper on it.
    expect(w.freest?.name).not.toBe('Fri');
  });

  it('leaves waking hours over rather than pretending a week is 168 usable', () => {
    const w = week(input({ commitments: [commitment()] }));
    expect(w.spare).toBeCloseTo(16 * 7 - 1.5, 5);
  });

  it('counts a job stated as hours a week, which meets on no day at all', () => {
    // The whole point of the hours field is a commitment with no fixed time.
    // Reading only what meets left ten hours of somebody's week out of the one
    // figure this screen exists to give.
    const w = week(input({ commitments: [job()] }));
    expect(w.promised).toBeCloseTo(10, 5);
  });

  it('puts a share of it on every day, because it belongs to no one of them', () => {
    const w = week(input({ commitments: [job()] }));
    expect(w.days.map((d) => d.commitments)).toEqual([1.4, 1.4, 1.4, 1.4, 1.4, 1.4, 1.4]);
  });

  it('adds a weekly job to what meets, rather than choosing between them', () => {
    // 90 minutes on the Thursday plus ten hours across the seven.
    const w = week(input({ commitments: [commitment(), job()] }));
    expect(w.promised).toBeCloseTo(11.5, 5);
    expect(w.days[0].commitments).toBe(round(1.5 + 10 / 7));
  });

  it('states the week as the seven days really add up to, not as seven roundings', () => {
    // A tenth lost seven times is 9.8 hours where the Activities screen says
    // ten, about a number the student typed in themselves.
    const w = week(input({ commitments: [job()] }));
    const summed = w.days.reduce((n, d) => n + d.promised, 0);
    expect(summed).toBeCloseTo(9.8, 5);
    expect(w.promised).toBeCloseTo(10, 5);
  });

  it('leaves less waking time over once a job is counted', () => {
    const w = week(input({ commitments: [job()] }));
    expect(w.spare).toBeCloseTo(16 * 7 - 10, 5);
  });

  it('promises the week the Activities screen promises, for every shape', () => {
    const shapes: Commitment[] = [
      commitment({ id: 'meets', days: [4], at: 17 * 60, minutes: 90, hours: 0 }),
      job({ id: 'weekly' }),
      commitment({ id: 'hour-no-days', days: [], at: 17 * 60, minutes: 90, hours: 5 }),
      commitment({ id: 'days-no-hour', days: [1, 3], at: null, minutes: 90, hours: 4 }),
    ];
    for (const c of shapes) {
      expect(week(input({ commitments: [c] })).promised).toBeCloseTo(weeklyHours([c]), 5);
    }
    expect(week(input({ commitments: shapes })).promised).toBeCloseTo(weeklyHours(shapes), 5);
  });

  it('takes no hours at all from a job you have paused', () => {
    const w = week(input({ commitments: [job({ active: false })] }));
    expect(w.promised).toBe(0);
  });
});

describe('studyAsked', () => {
  it('reads the time a syllabus asks for, weekly', () => {
    const out = studyAsked(catalog([], {}, [{ planMinutes: '60' }, { planMinutes: '30' }]));
    expect(out.hours).toBe(10.5);
    expect(out.stated).toBe(2);
    expect(out.total).toBe(2);
  });

  it('contributes nothing for a course that states nothing, and says how many', () => {
    const out = studyAsked(catalog([], {}, [{ planMinutes: '60' }, { planMinutes: '' }]));
    expect(out.hours).toBe(7);
    expect(out.stated).toBe(1);
    expect(out.total).toBe(2);
  });

  it('is zero rather than NaN with no courses', () => {
    expect(studyAsked(catalog([])).hours).toBe(0);
  });
});

describe('headline', () => {
  it('says plainly when the week is empty', () => {
    expect(headline(week(input()))).toContain('Nothing scheduled');
  });

  it('counts hours and deadlines side by side', () => {
    const w = week(input({ catalog: catalog([item('paper', 8, 5)]), commitments: [commitment()] }));
    expect(headline(w)).toContain('1.5 hours already promised');
    expect(headline(w)).toContain('1 deadline');
  });

  it('offers no readiness score, because the app cannot know how long a paper takes', () => {
    const w = week(input({ catalog: catalog([item('paper', 8, 5)]), commitments: [commitment()] }));
    expect(headline(w)).not.toMatch(/%|\bready\b|manageable|\bbusy\b|on track/i);
  });
});

describe('pressure', () => {
  it('names the heaviest day and a day with room', () => {
    const w = week(input({ commitments: [commitment({ days: [6], minutes: 240 })] }));
    const said = pressure(w);
    expect(said).toContain('Sat carries most of it');
    expect(said).toMatch(/is clear|has the most room/);
  });

  it('says nothing rather than something empty when there is nothing to say', () => {
    expect(pressure(week(input()))).toBe('');
  });

  it('gives no advice about what to do with the room', () => {
    const w = week(input({ commitments: [commitment({ days: [6], minutes: 240 })] }));
    expect(pressure(w)).not.toMatch(/should|try to|make sure|plan to/i);
  });
});

describe('showHours', () => {
  it('says hours the way a person does', () => {
    expect(showHours(0)).toBe('nothing');
    expect(showHours(0.5)).toBe('30 min');
    expect(showHours(1)).toBe('1 hour');
    expect(showHours(3.5)).toBe('3.5 hours');
    expect(showHours(4)).toBe('4 hours');
  });
});
