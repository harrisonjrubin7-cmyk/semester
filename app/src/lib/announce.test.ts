import { describe, expect, it } from 'vitest';
import { SYSTEM, apply, brief, describe as say, readChanges, summary, type Change } from './announce';
import type { CourseModule, Item } from './types';

const item = (over: Partial<Item>): Item => ({
  id: 'i1',
  c: 'econ',
  title: 'Midterm 1',
  kind: 'Exam',
  month: 8,
  day: 30,
  dueTime: 'In class',
  weight: '25%',
  where: '',
  detail: '',
  quote: '',
  source: '',
  ...over,
});

const module_ = (items: Item[]): CourseModule =>
  ({
    course: {
      id: 'econ',
      code: 'ECON 1020',
      name: 'Principles of Macroeconomics',
      prof: 'P',
      email: 'p@x.edu',
      meets: 'MWF',
      room: 'R',
      credits: '3',
      source: '',
      grading: [],
    },
    items,
    schedule: [],
    guide: { code: 'ECON 1020', name: '', blurb: '', source: '', mastery: 0, audio: false, units: [], terms: [] },
    planMinutes: '',
    frameLabel: '',
  }) as CourseModule;

const reply = (changes: unknown[]) => JSON.stringify({ changes });

describe('what the model is told', () => {
  it('demands a quote for every change', () => {
    expect(SYSTEM).toMatch(/MUST quote the exact sentence/);
  });

  it('forbids calculating a date', () => {
    expect(SYSTEM).toMatch(/Never calculate, infer or assume/);
  });

  it('keeps it away from the grading scheme', () => {
    expect(SYSTEM).toMatch(/Do not propose changes to weightings/);
  });

  it('allows an announcement that changes nothing', () => {
    expect(SYSTEM).toMatch(/perfectly good answer/);
  });
});

describe('the brief', () => {
  it('hands over the deadlines with their ids', () => {
    const b = brief(module_([item({ id: 'abc' })]), 'The midterm has moved.');
    expect(b).toContain('id abc');
    expect(b).toContain('month 8 day 30');
  });

  it('says so plainly when a course has no deadlines', () => {
    expect(brief(module_([]), 'x')).toContain('(none)');
  });

  it('includes the announcement verbatim', () => {
    expect(brief(module_([]), '  Midterm moved to Oct 8.  ')).toContain('Midterm moved to Oct 8.');
  });
});

describe('reading the proposals back', () => {
  const mod = module_([item({ id: 'i1' }), item({ id: 'i2', title: 'Problem Set 5', kind: 'Problem set' })]);

  it('takes a well-formed move', () => {
    const out = readChanges(
      reply([{ op: 'move', itemId: 'i1', month: 9, day: 8, dueTime: 'In class', quote: 'The midterm is now October 8.' }]),
      mod,
    );
    expect(out).toEqual([
      {
        op: 'move',
        itemId: 'i1',
        title: '',
        month: 9,
        day: 8,
        dueTime: 'In class',
        quote: 'The midterm is now October 8.',
      },
    ]);
  });

  it('throws away a change with no quote', () => {
    expect(readChanges(reply([{ op: 'move', itemId: 'i1', month: 9, day: 8 }]), mod)).toEqual([]);
  });

  it('throws away a change to a deadline this course does not have', () => {
    expect(
      readChanges(reply([{ op: 'drop', itemId: 'nope', quote: 'Cancelled.' }]), mod),
    ).toEqual([]);
  });

  it('throws away a move with no date in it', () => {
    // "Moved to next week" is not a date, and the model is told to say so in
    // a title rather than to work one out.
    expect(
      readChanges(reply([{ op: 'move', itemId: 'i1', month: -1, day: -1, quote: 'Moved to next week.' }]), mod),
    ).toEqual([]);
  });

  it('throws away an addition with no title', () => {
    expect(
      readChanges(reply([{ op: 'add', month: 9, day: 8, quote: 'There will be a quiz.' }]), mod),
    ).toEqual([]);
  });

  it('throws away a month or a day that is not one', () => {
    const out = readChanges(
      reply([{ op: 'move', itemId: 'i1', month: 13, day: 40, quote: 'x y z.' }]),
      mod,
    );
    expect(out).toEqual([]);
  });

  it('throws away an operation it does not know', () => {
    expect(
      readChanges(reply([{ op: 'reweight', itemId: 'i1', quote: 'Now worth 30%.' }]), mod),
    ).toEqual([]);
  });

  it('takes an empty list as an answer', () => {
    expect(readChanges(reply([]), mod)).toEqual([]);
  });

  it('reads through a code fence', () => {
    const fenced = '```json\n' + reply([{ op: 'drop', itemId: 'i2', quote: 'PS5 is cancelled.' }]) + '\n```';
    expect(readChanges(fenced, mod)).toHaveLength(1);
  });

  it('says so when nothing came back at all', () => {
    expect(() => readChanges('', mod)).toThrow(/Nothing came back/);
  });

  it('says so when it came back malformed', () => {
    expect(() => readChanges('{ not json }', mod)).toThrow(/malformed/);
  });
});

describe('what a proposal says it will do', () => {
  const mod = module_([item({ id: 'i1' })]);

  it('names the deadline and the new date', () => {
    const c: Change = { op: 'move', itemId: 'i1', title: '', month: 9, day: 8, dueTime: '5pm', quote: 'q' };
    expect(say(c, mod)).toBe('Move Midterm 1 to Oct 8, 5pm');
  });

  it('reads a removal plainly', () => {
    const c: Change = { op: 'drop', itemId: 'i1', title: '', month: -1, day: -1, dueTime: '', quote: 'q' };
    expect(say(c, mod)).toBe('Remove Midterm 1');
  });

  it('reads an addition with its date', () => {
    const c: Change = { op: 'add', itemId: '', title: 'Pop quiz', month: 9, day: 8, dueTime: '', quote: 'q' };
    expect(say(c, mod)).toBe('Add Pop quiz, Oct 8');
  });
});

describe('applying them', () => {
  const mod = module_([item({ id: 'i1' }), item({ id: 'i2', title: 'PS5' })]);

  it('moves a deadline and keeps its id, so a tick survives', () => {
    const out = apply(mod, [
      { op: 'move', itemId: 'i1', title: '', month: 9, day: 8, dueTime: '', quote: 'q' },
    ]);
    const moved = out.items.find((i) => i.id === 'i1');
    expect([moved?.month, moved?.day]).toEqual([9, 8]);
    expect(moved?.dueTime).toBe('In class'); // unchanged, because none was stated
  });

  it('takes a new time when the announcement gives one', () => {
    const out = apply(mod, [
      { op: 'move', itemId: 'i1', title: '', month: 9, day: 8, dueTime: '11:59 PM', quote: 'q' },
    ]);
    expect(out.items.find((i) => i.id === 'i1')?.dueTime).toBe('11:59 PM');
  });

  it('removes one, and it takes its tick with it', () => {
    const out = apply(mod, [
      { op: 'drop', itemId: 'i2', title: '', month: -1, day: -1, dueTime: '', quote: 'q' },
    ]);
    expect(out.items.map((i) => i.id)).toEqual(['i1']);
  });

  it('adds one, quoting the announcement as its source', () => {
    const out = apply(mod, [
      {
        op: 'add',
        itemId: '',
        title: 'Pop quiz',
        month: 9,
        day: 8,
        dueTime: '',
        quote: 'There will be a quiz on the 8th.',
      },
    ]);
    const added = out.items.find((i) => i.title === 'Pop quiz');
    expect(added?.quote).toBe('There will be a quiz on the 8th.');
    expect(added?.source).toBe('Announcement');
    expect(added?.c).toBe('econ');
  });

  it('leaves the course itself alone', () => {
    const out = apply(mod, [
      { op: 'drop', itemId: 'i2', title: '', month: -1, day: -1, dueTime: '', quote: 'q' },
    ]);
    expect(out.course).toEqual(mod.course);
    expect(out.guide).toEqual(mod.guide);
  });

  it('applies nothing when nothing is accepted', () => {
    expect(apply(mod, []).items).toEqual(mod.items);
  });
});

describe('the summary', () => {
  const c = (op: Change['op']): Change => ({
    op,
    itemId: 'i1',
    title: 't',
    month: 9,
    day: 8,
    dueTime: '',
    quote: 'q',
  });

  it('counts them by kind', () => {
    expect(summary([c('move'), c('move'), c('drop')])).toBe('2 moved, 1 removed');
  });

  it('says plainly when there is nothing', () => {
    expect(summary([])).toBe('Nothing in that changes a deadline.');
  });
});
