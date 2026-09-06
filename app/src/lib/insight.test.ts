import { describe, expect, it } from 'vitest';
import { MOST, hours, insightLines, insights, topInsights, type InsightInput } from './insight';
import type { Catalog } from '../data/catalog';
import type { Item } from './types';
import type { Sitting } from './sitting';
import type { Spent } from './pace';

// Saturday 12 September 2026, late afternoon.
const NOW = new Date(2026, 8, 12, 16, 0);
const DAY = 86_400_000;

const item = (id: string, month: number, day: number, c = 'econ'): Item =>
  ({
    id,
    c,
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

const COURSES = [
  { id: 'econ', code: 'ECON 1020' },
  { id: 'psci', code: 'PSCI 1104' },
];

const catalog = (items: Item[], courses = COURSES): Catalog =>
  ({
    items,
    courses,
    byId: Object.fromEntries(courses.map((c) => [c.id, c])),
    modules: [],
    short: { econ: 'ECON', psci: 'PSCI' },
    shortCodes: ['ECON', 'PSCI'],
    empty: items.length === 0,
    lessons: {},
    figures: {},
    extraFigures: {},
    blocks: {},
  }) as unknown as Catalog;

const input = (over: Partial<InsightInput> = {}): InsightInput => ({
  catalog: catalog([]),
  now: NOW,
  done: {},
  spent: [],
  sittings: [],
  reviews: {},
  code: (id) => COURSES.find((c) => c.id === id)?.code ?? id,
  ...over,
});

const spent = (kind: string, minutes: number, guess: number | undefined, i: number): Spent => ({
  id: `sp${i}`,
  courseId: 'econ',
  kind,
  minutes,
  ...(guess === undefined ? {} : { guess }),
  at: NOW.getTime() - i * DAY,
});

const sitting = (pct: number, i: number, courseId = 'econ'): Sitting =>
  ({
    id: `si${i}`,
    courseId,
    title: 'paper',
    at: NOW.getTime() - i * DAY,
    minutes: 30,
    got: pct,
    outOf: 100,
    pct,
    code: '',
  }) as Sitting;

describe('nothing is said without evidence', () => {
  it('says nothing at all for an empty account', () => {
    expect(insights(input())).toEqual([]);
  });

  it('says nothing when a single deadline is overdue', () => {
    // One late thing is a bad week, not a slipping course.
    const items = [item('ps1', 8, 1)];
    expect(insights(input({ catalog: catalog(items) }))).toEqual([]);
  });

  it('every finding says what it rests on', () => {
    const items = [item('ps1', 8, 1), item('ps2', 8, 2), item('ps3', 8, 3)];
    const found = insights(input({ catalog: catalog(items) }));
    expect(found.length).toBeGreaterThan(0);
    for (const f of found) {
      expect(f.from.trim()).not.toBe('');
      expect(f.title.trim()).not.toBe('');
      expect(f.body.trim()).not.toBe('');
    }
  });

  it('never scores the week', () => {
    const items = [item('ps1', 8, 1), item('ps2', 8, 2)];
    const found = insights(
      input({ catalog: catalog(items), sittings: [sitting(40, 1), sitting(45, 2)] }),
    );
    const words = found.map((f) => `${f.title} ${f.body}`).join(' ').toLowerCase();
    expect(words).not.toMatch(/productiv|streak|score|grade for|out of 10|rating/);
    expect(words).not.toMatch(/!/);
  });
});

describe('a course slipping', () => {
  it('names it once two things are past their date', () => {
    const items = [item('ps1', 8, 1), item('ps2', 8, 4)];
    const found = insights(input({ catalog: catalog(items) }));
    const slip = found.find((f) => f.id === 'slipping-econ');
    expect(slip?.title).toBe('ECON 1020 has 2 things past their date.');
    expect(slip?.body).toContain('ps1'); // the oldest, not the newest
    expect(slip?.from).toBe('2 deadlines, counted against today');
    expect(slip?.action?.screen).toBe('behind');
  });

  it('does not count what has been ticked', () => {
    const items = [item('ps1', 8, 1), item('ps2', 8, 4)];
    const found = insights(input({ catalog: catalog(items), done: { ps1: true } }));
    expect(found.find((f) => f.id === 'slipping-econ')).toBeUndefined();
  });
});

describe('a crowded stretch', () => {
  it('finds three deadlines inside three days and names the earliest', () => {
    const items = [item('a', 8, 20), item('b', 8, 21), item('c', 8, 22, 'psci')];
    const found = insights(input({ catalog: catalog(items) }));
    const crowd = found.find((f) => f.id.startsWith('crowded-'));
    expect(crowd?.title).toContain('3 things are due inside three days');
    expect(crowd?.body).toContain('a is first');
    expect(crowd?.from).toContain('ECON 1020');
    expect(crowd?.from).toContain('PSCI 1104');
  });

  it('is silent when the same three are spread over a fortnight', () => {
    const items = [item('a', 8, 20), item('b', 8, 26), item('c', 9, 2)];
    const found = insights(input({ catalog: catalog(items) }));
    expect(found.find((f) => f.id.startsWith('crowded-'))).toBeUndefined();
  });
});

describe('work that takes longer than you plan for', () => {
  it('speaks once three reports carry a guess and the gap is real', () => {
    const rows = [
      spent('Problem Set 1', 180, 60, 1),
      spent('Problem Set 2', 200, 90, 2),
      spent('Problem Set 3', 190, 60, 3),
    ];
    const found = insights(input({ spent: rows }));
    const under = found.find((f) => f.id === 'under-problem set');
    expect(under?.title).toContain('Problem set takes you about 3 hours');
    expect(under?.title).toBe('Problem set takes you about 3 hours, not an hour.');
    expect(under?.from).toBe('the middle of 3 of your own reports');
  });

  it('stays quiet on two reports, however wrong they were', () => {
    const rows = [spent('Reading 1', 300, 30, 1), spent('Reading 2', 280, 30, 2)];
    expect(insights(input({ spent: rows }))).toEqual([]);
  });

  it('stays quiet when the guesses were close enough', () => {
    const rows = [
      spent('Reading 1', 62, 60, 1),
      spent('Reading 2', 58, 60, 2),
      spent('Reading 3', 65, 60, 3),
    ];
    expect(insights(input({ spent: rows }))).toEqual([]);
  });

  it('ignores reports made without a guess', () => {
    const rows = [
      spent('Essay 1', 400, undefined, 1),
      spent('Essay 2', 380, undefined, 2),
      spent('Essay 3', 420, undefined, 3),
    ];
    expect(insights(input({ spent: rows }))).toEqual([]);
  });
});

describe('a course gone cold', () => {
  const ahead = [item('later', 9, 20), item('laterp', 9, 21, 'psci')];

  it('names it only when other courses were being worked on', () => {
    const found = insights(
      input({
        catalog: catalog(ahead),
        // PSCI worked on this week; ECON untouched.
        sittings: [sitting(80, 1, 'psci')],
      }),
    );
    const cold = found.find((f) => f.id === 'cold-econ');
    expect(cold?.title).toBe('ECON 1020 has had nothing for a fortnight.');
    expect(cold?.from).toContain('1 other course was worked on');
    expect(found.find((f) => f.id === 'cold-psci')).toBeUndefined();
  });

  it('says nothing when nobody was working — that is a fortnight, not neglect', () => {
    const found = insights(input({ catalog: catalog(ahead) }));
    expect(found.filter((f) => f.id.startsWith('cold-'))).toEqual([]);
  });

  it('says nothing about a course with nothing left to do', () => {
    // ECON's only deadline is in the past, so its quiet is it being finished.
    const items = [item('gone', 7, 20), item('laterp', 9, 21, 'psci')];
    const found = insights(
      input({ catalog: catalog(items), done: { gone: true }, sittings: [sitting(80, 1, 'psci')] }),
    );
    expect(found.find((f) => f.id === 'cold-econ')).toBeUndefined();
  });

  it('counts a drilled card as contact, read out of the card key', () => {
    const found = insights(
      input({
        catalog: catalog(ahead),
        sittings: [sitting(80, 1, 'psci')],
        reviews: { 'econ:what is elasticity': { seen: NOW.getTime() - DAY } },
      }),
    );
    expect(found.find((f) => f.id === 'cold-econ')).toBeUndefined();
  });
});

describe('papers coming back low', () => {
  it('needs two papers before it calls an average an average', () => {
    expect(insights(input({ sittings: [sitting(40, 1)] })).filter((f) => f.id.startsWith('weak-'))).toEqual([]);
  });

  it('names the course and points at the misses', () => {
    const found = insights(input({ sittings: [sitting(52, 1), sitting(48, 2)] }));
    const weak = found.find((f) => f.id === 'weak-econ');
    expect(weak?.title).toBe('ECON 1020 papers sit around 50%.');
    expect(weak?.from).toBe('2 papers you sat');
    expect(weak?.action?.screen).toBe('drill');
  });

  it('is silent about papers that are going fine', () => {
    const found = insights(input({ sittings: [sitting(88, 1), sitting(91, 2)] }));
    expect(found.filter((f) => f.id.startsWith('weak-'))).toEqual([]);
  });
});

describe('ranking and the cap', () => {
  it('puts overdue work above a study habit', () => {
    const items = [item('ps1', 8, 1), item('ps2', 8, 2), item('later', 9, 20, 'psci')];
    const found = insights(
      input({ catalog: catalog(items), sittings: [sitting(50, 1, 'psci'), sitting(55, 2, 'psci')] }),
    );
    expect(found[0].id).toBe('slipping-econ');
  });

  it('hands back at most three', () => {
    const items = [
      item('ps1', 8, 1), item('ps2', 8, 2),
      item('q1', 8, 3, 'psci'), item('q2', 8, 4, 'psci'),
      item('a', 8, 20), item('b', 8, 21), item('c', 8, 22),
    ];
    const found = topInsights(
      input({
        catalog: catalog(items),
        sittings: [sitting(40, 1), sitting(45, 2)],
        spent: [spent('Reading 1', 200, 60, 1), spent('Reading 2', 210, 60, 2), spent('Reading 3', 190, 60, 3)],
      }),
    );
    expect(found).toHaveLength(MOST);
    expect(new Set(found.map((f) => f.id)).size).toBe(MOST);
  });
});

describe('the document lines', () => {
  it('are empty when there is nothing to say', () => {
    expect(insightLines([])).toEqual([]);
  });

  it('carry the evidence into the Markdown', () => {
    const items = [item('ps1', 8, 1), item('ps2', 8, 2)];
    const lines = insightLines(insights(input({ catalog: catalog(items) })));
    expect(lines[0]).toBe('## What stands out');
    expect(lines.join('\n')).toContain('*Based on 2 deadlines, counted against today.*');
  });
});

describe('hours', () => {
  it('says minutes below the hour and hours above it', () => {
    expect(hours(45)).toBe('45 minutes');
    expect(hours(60)).toBe('an hour');
    expect(hours(90)).toBe('1.5 hours');
    expect(hours(180)).toBe('3 hours');
    expect(hours(200)).toBe('3.5 hours');
  });
});
