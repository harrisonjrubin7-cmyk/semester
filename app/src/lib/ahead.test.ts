import { describe, expect, it } from 'vitest';
import { headline, pressure, showHours, studyAsked, week, type WeekInput } from './ahead';
import type { Catalog } from '../data/catalog';
import type { Commitment } from './activities';
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
