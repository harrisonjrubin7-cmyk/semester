import { describe, expect, it } from 'vitest';
import {
  EVENING_SYSTEM,
  MORNING_SYSTEM,
  committedToday,
  nameNote,
  dayKey,
  evening,
  eveningBrief,
  eveningLine,
  morning,
  morningBrief,
  morningLine,
  type DayInput,
} from './brief';
import type { Catalog } from '../data/catalog';
import type { Commitment } from './activities';
import type { Item, PersonalTask } from './types';

const NOW = new Date(2026, 8, 3, 9, 0); // Thu 3 Sep 2026

const item = (id: string, month: number, day: number, over: Partial<Item> = {}): Item =>
  ({
    id,
    c: 'econ',
    title: id,
    kind: 'Paper',
    month,
    day,
    dueTime: '11:59p',
    weight: '10%',
    where: 'Brightspace',
    detail: '',
    quote: '',
    source: '',
    ...over,
  }) as Item;

const catalog = (items: Item[], schedule: Record<number, { at: number; time: string; title: string; meta: string; days: number[]; canceled?: boolean }[]> = {}): Catalog =>
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
    blocks: schedule,
  }) as unknown as Catalog;

const input = (over: Partial<DayInput> = {}): DayInput => ({
  catalog: catalog([]),
  now: NOW,
  done: {},
  tasks: [],
  appointments: [],
  commitments: [],
  reviews: {},
  ...over,
});

const code = () => 'ECON 1020';

describe('dayKey', () => {
  it('is the local date, not a UTC one', () => {
    // new Date().toISOString() on the 3rd at 9pm in Nashville says the 4th.
    expect(dayKey(new Date(2026, 8, 3, 21, 30))).toBe('2026-09-03');
  });
});

describe('morning', () => {
  it('lists what is due today and not yet ticked', () => {
    const m = morning(input({ catalog: catalog([item('paper', 8, 3), item('later', 8, 20)]) }));
    expect(m.dueToday.map((i) => i.id)).toEqual(['paper']);
  });

  it('leaves out what you have already ticked', () => {
    const m = morning(
      input({ catalog: catalog([item('paper', 8, 3)]), done: { paper: true } }),
    );
    expect(m.dueToday).toEqual([]);
  });

  it('names the next deadline after today', () => {
    const m = morning(input({ catalog: catalog([item('a', 8, 3), item('b', 8, 8), item('c', 8, 20)]) }));
    expect(m.next?.id).toBe('b');
  });

  it('counts what went by unticked', () => {
    const m = morning(input({ catalog: catalog([item('gone', 8, 1), item('done', 8, 1)]), done: { done: true } }));
    expect(m.overdue).toBe(1);
  });

  it('picks up your own dated tasks, including ones already late', () => {
    const tasks: PersonalTask[] = [
      { id: '1', title: 'Email advisor', date: '2026-09-03', time: '', note: '', done: false, created: 0, courseId: null },
      { id: '2', title: 'Older', date: '2026-09-01', time: '', note: '', done: false, created: 0, courseId: null },
      { id: '3', title: 'Later', date: '2026-09-30', time: '', note: '', done: false, created: 0, courseId: null },
      { id: '4', title: 'Finished', date: '2026-09-03', time: '', note: '', done: true, created: 0, courseId: null },
    ];
    const m = morning(input({ tasks }));
    expect(m.tasks.map((t) => t.id).sort()).toEqual(['1', '2']);
  });

  it('lists a commitment that meets today, not one that does not', () => {
    const meets: Commitment = {
      id: 'c', name: 'Practice', kind: 'clubsport', role: '', where: '', url: '', note: '',
      days: [4], at: 17 * 60, minutes: 90, hours: 0, active: true, created: 0,
    };
    const other: Commitment = { ...meets, id: 'd', name: 'Tuesdays', days: [2] };
    const m = morning(input({ commitments: [meets, other] }));
    expect(m.commitments.map((c) => c.title)).toEqual(['Practice']);
  });
});

describe('evening', () => {
  it('separates what you ticked from what was due and is not', () => {
    const e = evening(
      input({
        catalog: catalog([item('did', 8, 3), item('didnt', 8, 3)]),
        done: { did: true },
      }),
    );
    expect(e.ticked.map((i) => i.id)).toEqual(['did']);
    expect(e.missed.map((i) => i.id)).toEqual(['didnt']);
  });

  it('looks at tomorrow, so the last thing read at night is the first thing needed', () => {
    const e = evening(input({ catalog: catalog([item('tmrw', 8, 4), item('far', 8, 20)]) }));
    expect(e.tomorrow.map((i) => i.id)).toEqual(['tmrw']);
  });

  it('does not put an already-ticked deadline in tomorrow', () => {
    const e = evening(input({ catalog: catalog([item('tmrw', 8, 4)]), done: { tmrw: true } }));
    expect(e.tomorrow).toEqual([]);
  });

  it('counts your own tasks both ways', () => {
    const tasks: PersonalTask[] = [
      { id: '1', title: 'a', date: null, time: '', note: '', done: true, created: 0, courseId: null },
      { id: '2', title: 'b', date: null, time: '', note: '', done: false, created: 0, courseId: null },
    ];
    const e = evening(input({ tasks }));
    expect(e.tasksDone).toBe(1);
    expect(e.tasksLeft).toBe(1);
  });
});

describe('morningLine', () => {
  it('says the shape of the day in one line', () => {
    const m = morning(input({ catalog: catalog([item('a', 8, 3)]) }));
    expect(morningLine(m)).toContain('1 due');
  });

  it('offers the empty day as a chance to clear what went by', () => {
    const m = morning(input({ catalog: catalog([item('old', 8, 1)]) }));
    expect(morningLine(m)).toContain('1 that went by');
  });

  it('is simply calm when there is nothing at all', () => {
    expect(morningLine(morning(input()))).toBe('Nothing due and no classes today.');
  });
});

describe('eveningLine', () => {
  it('leads with what got done', () => {
    const e = evening(input({ catalog: catalog([item('did', 8, 3)]), done: { did: true } }));
    expect(eveningLine(e)).toBe('1 finished today.');
  });

  it('says plainly when nothing was ticked, without scolding', () => {
    const e = evening(input({ catalog: catalog([item('nope', 8, 3)]) }));
    const said = eveningLine(e);
    expect(said).toContain('Nothing ticked');
    expect(said).not.toMatch(/should|failed|behind/i);
  });
});

describe('the briefs handed to Claude', () => {
  it('say plainly when a list is empty rather than leaving a gap', () => {
    expect(morningBrief(morning(input()), code)).toContain('nothing');
    expect(eveningBrief(evening(input()), code)).toContain('nothing');
  });

  it('carry the counts the model is forbidden to recompute', () => {
    const m = morning(input({ catalog: catalog([item('paper', 8, 3)]) }));
    expect(morningBrief(m, code)).toContain('ECON 1020 paper');
    expect(morningBrief(m, code)).toContain('Overdue and unticked: 0');
  });
});

describe('the system prompts', () => {
  it('forbid inventing or restating a number', () => {
    for (const s of [MORNING_SYSTEM, EVENING_SYSTEM]) {
      expect(s).toContain('never invent one');
      expect(s).toContain('Never restate a number differently');
    }
  });

  it('ban the pep talk, which is what makes a daily report get ignored', () => {
    expect(MORNING_SYSTEM).toContain('No pep talk');
  });

  it('tell the evening not to scold a day with nothing ticked', () => {
    expect(EVENING_SYSTEM).toContain('not a failure');
  });
});

describe('committedToday', () => {
  const fixed: Commitment = {
    id: 'c', name: 'Practice', kind: 'clubsport', role: '', where: '', url: '', note: '',
    days: [4], at: 17 * 60, minutes: 90, hours: 0, active: true, created: 0,
  };

  it('adds up what actually meets today', () => {
    expect(committedToday([fixed], NOW)).toBe(1.5);
  });

  it('spreads a weekly figure across the week when nothing meets', () => {
    const loose: Commitment = { ...fixed, id: 'j', days: [], at: null, hours: 7 };
    expect(committedToday([loose], NOW)).toBeCloseTo(1, 5);
  });

  it('is zero when there is nothing', () => {
    expect(committedToday([], NOW)).toBe(0);
  });
});

describe('whether the brief knows your name', () => {
  it('tells the model to use it, sparingly', () => {
    expect(nameNote('Harrison')).toMatch(/Address them as Harrison/);
    expect(nameNote('  Harrison  ')).toContain('Harrison');
    expect(nameNote('Harrison')).toMatch(/at most once/);
  });

  it('says plainly that there is no name rather than leaving a gap', () => {
    // A model given a second-person report and no name will sometimes invent
    // an address for it, and being called the wrong name by your own study
    // app is a small and memorable thing to be annoyed by.
    expect(nameNote('')).toMatch(/Do not invent one/);
    expect(nameNote('   ')).toMatch(/Do not invent one/);
  });
});
