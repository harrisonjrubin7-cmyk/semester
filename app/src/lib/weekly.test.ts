import { describe, expect, it } from 'vitest';
import {
  SYSTEM,
  behind,
  behindLine,
  brief,
  document,
  slippedLine,
  weekEnd,
  weekLabel,
  weekStart,
  type Ahead,
  type WeeklyInput,
} from './weekly';
import type { Catalog } from '../data/catalog';
import type { Item, PersonalTask } from './types';
import type { Sitting } from './sitting';

// Sunday 6 Sep 2026 is a week end; the week is Sun 6 – Sat 12.
const NOW = new Date(2026, 8, 12, 18, 0); // Sat 12 Sep 2026

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

const catalog = (items: Item[]): Catalog =>
  ({
    items,
    courses: [{ id: 'econ', code: 'ECON 1020' }],
    byId: { econ: { id: 'econ', code: 'ECON 1020' } },
    modules: [],
    short: { econ: 'ECON' },
    shortCodes: ['ECON'],
    empty: items.length === 0,
    lessons: {},
    figures: {},
    extraFigures: {},
    blocks: {},
  }) as unknown as Catalog;

const input = (over: Partial<WeeklyInput> = {}): WeeklyInput => ({
  catalog: catalog([]),
  now: NOW,
  done: {},
  tasks: [],
  sittings: [],
  reviews: {},
  ...over,
});

const sitting = (at: number, pct = 70): Sitting => ({
  id: `s${at}`,
  courseId: 'econ',
  title: 'paper',
  at,
  minutes: 30,
  got: 7,
  outOf: 10,
  pct,
  code: 'AAAA',
  missed: [],
});

const code = () => 'ECON 1020';

const ahead: Ahead = { promised: 12, due: [], heaviest: 'Tue', freest: 'Sun' };

describe('the week boundaries', () => {
  it('runs Sunday to Saturday, which is how a university week is spoken about', () => {
    const start = weekStart(NOW);
    expect(start.getDay()).toBe(0);
    expect(start.getDate()).toBe(6);
    expect(weekEnd(start).getDate()).toBe(13);
  });

  it('is already the start of the week on a Sunday', () => {
    expect(weekStart(new Date(2026, 8, 6, 9, 0)).getDate()).toBe(6);
  });

  it('labels the span rather than a single date', () => {
    expect(weekLabel(weekStart(NOW))).toMatch(/Sep 6.*Sep 12/);
  });
});

describe('behind', () => {
  it('separates what was ticked from what went by', () => {
    const b = behind(
      input({
        catalog: catalog([item('did', 8, 8), item('didnt', 8, 9)]),
        done: { did: true },
      }),
    );
    expect(b.done.map((i) => i.id)).toEqual(['did']);
    expect(b.slipped.map((i) => i.id)).toEqual(['didnt']);
  });

  it('leaves out a deadline from another week', () => {
    const b = behind(input({ catalog: catalog([item('lastweek', 8, 2)]) }));
    expect(b.done).toEqual([]);
    expect(b.slipped).toEqual([]);
  });

  it('does not call something still in the future slipped', () => {
    // Saturday the 12th looking at a deadline dated the 12th: not past yet.
    const b = behind(input({ catalog: catalog([item('today', 8, 12)]) }));
    expect(b.slipped).toEqual([]);
  });

  it('counts your own tasks dated in the week, both ways', () => {
    const tasks: PersonalTask[] = [
      { id: '1', title: 'a', date: '2026-09-08', time: '', note: '', done: true, created: 0, courseId: null },
      { id: '2', title: 'b', date: '2026-09-09', time: '', note: '', done: false, created: 0, courseId: null },
      { id: '3', title: 'c', date: '2026-09-01', time: '', note: '', done: true, created: 0, courseId: null },
    ];
    const b = behind(input({ tasks }));
    expect(b.tasksDone).toBe(1);
    expect(b.tasksOpen).toBe(1);
  });

  it('counts papers sat inside the week only', () => {
    const inside = new Date(2026, 8, 9).getTime();
    const before = new Date(2026, 8, 1).getTime();
    const b = behind(input({ sittings: [sitting(inside), sitting(before)] }));
    expect(b.papers).toHaveLength(1);
  });

  it('counts cards whose last answer fell in the week', () => {
    const reviews = {
      a: { right: 1, wrong: 0, streak: 1, ease: 2.5, interval: 1, seen: new Date(2026, 8, 9).getTime(), due: 0 },
      b: { right: 1, wrong: 0, streak: 1, ease: 2.5, interval: 1, seen: new Date(2026, 7, 20).getTime(), due: 0 },
    };
    expect(behind(input({ reviews })).cardsDrilled).toBe(1);
  });

  it('reports overdue across the whole semester, not just this week', () => {
    const b = behind(input({ catalog: catalog([item('old', 7, 20), item('recent', 8, 9)]) }));
    expect(b.overdue).toBe(2);
  });
});

describe('behindLine', () => {
  it('leads with what got done', () => {
    const b = behind(input({ catalog: catalog([item('did', 8, 8)]), done: { did: true } }));
    expect(behindLine(b)).toBe('1 finished.');
  });

  it('counts drilling and papers as things that happened', () => {
    const reviews = {
      a: { right: 1, wrong: 0, streak: 1, ease: 2.5, interval: 1, seen: new Date(2026, 8, 9).getTime(), due: 0 },
    };
    const b = behind(input({ reviews, sittings: [sitting(new Date(2026, 8, 10).getTime())] }));
    expect(behindLine(b)).toContain('1 cards drilled');
    expect(behindLine(b)).toContain('1 paper sat');
  });

  it('is plain about a week where nothing happened, and does not scold', () => {
    const b = behind(input({ catalog: catalog([item('nope', 8, 8)]) }));
    const said = behindLine(b);
    expect(said).toContain('1 went by');
    expect(said).not.toMatch(/should|failed|lazy|behind/i);
  });

  it('never scores the week', () => {
    const b = behind(input({ catalog: catalog([item('did', 8, 8)]), done: { did: true } }));
    expect(behindLine(b)).not.toMatch(/%|productiv|streak|score|rating/i);
  });
});

describe('slippedLine', () => {
  it('says nothing at all for a week with nothing due and nothing done', () => {
    expect(slippedLine(behind(input()))).toBe('');
  });

  it('confirms a clean week rather than staying silent', () => {
    const b = behind(input({ catalog: catalog([item('did', 8, 8)]), done: { did: true } }));
    expect(slippedLine(b)).toContain('Nothing from this week went by');
  });

  it('mentions the semester total only when it is bigger than this week', () => {
    const only = behind(input({ catalog: catalog([item('a', 8, 8)]) }));
    expect(slippedLine(only)).not.toMatch(/across the semester/);

    const more = behind(input({ catalog: catalog([item('a', 8, 8), item('old', 7, 20)]) }));
    expect(slippedLine(more)).toMatch(/across the semester/);
  });
});

describe('the system prompt', () => {
  it('forbids scoring the week, which is what makes a report get ignored', () => {
    expect(SYSTEM).toContain('Do not score the week');
    expect(SYSTEM).toContain('is a normal week');
  });

  it('asks for one thing to do first, not a list', () => {
    expect(SYSTEM).toContain('One thing.');
  });

  it('forbids inventing or restating a number', () => {
    expect(SYSTEM).toContain('never invent one');
    expect(SYSTEM).toContain('Never restate a number differently');
  });
});

describe('brief', () => {
  it('carries both halves, with the counts the model may not recompute', () => {
    const b = behind(input({ catalog: catalog([item('did', 8, 8)]), done: { did: true } }));
    const text = brief(b, ahead, code);
    expect(text).toContain('The week just gone');
    expect(text).toContain('The week coming');
    expect(text).toContain('Hours already promised: 12');
  });

  it('says "none" rather than leaving a gap', () => {
    const text = brief(behind(input()), { ...ahead, due: [] }, code);
    expect(text).toContain('Deadlines ticked: none');
    expect(text).toContain('Due: nothing');
  });
});

describe('document', () => {
  it('heads the report with the week it covers', () => {
    const b = behind(input());
    expect(document(b, ahead, code, '')).toContain(`# Week of ${b.label}`);
  });

  it('lists what finished and what is still open', () => {
    const b = behind(
      input({ catalog: catalog([item('did', 8, 8), item('didnt', 8, 9)]), done: { did: true } }),
    );
    const text = document(b, ahead, code, '');
    expect(text).toContain('**Finished**');
    expect(text).toContain('**Still open**');
  });

  it('leaves out a section that would be empty', () => {
    expect(document(behind(input()), ahead, code, '')).not.toContain('**Finished**');
  });

  it('includes what was read against it only when something was', () => {
    const b = behind(input());
    expect(document(b, ahead, code, '')).not.toContain('Read against it');
    expect(document(b, ahead, code, 'A sentence.')).toContain('Read against it');
  });
});
