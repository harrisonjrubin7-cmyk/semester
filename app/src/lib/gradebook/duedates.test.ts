import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * The due-date client's contract with `20261021130000_gradebook_due_dates.sql`:
 * which RPC, which argument names, which columns become which fields; that a
 * school without the migration reads as "not set up" rather than an error;
 * that a stale version is told apart from any other refusal; and which row
 * applies to a student, said in words.
 */

interface Reply {
  data?: unknown;
  error?: { message: string; code?: string } | null;
}

const calls: { name: string; args?: unknown }[] = [];
const replies = new Map<string, Reply>();

vi.mock('../cloud', () => ({
  cloudConfigured: true,
  cloud: async () => ({
    rpc: (name: string, args?: unknown) => {
      calls.push({ name, args });
      return Promise.resolve(replies.get(name) ?? { data: null, error: null });
    },
  }),
}));

import { ServiceError, settled } from '../attempt';
import { StaleRequest } from './requests';
import {
  DUE_NOT_SET_UP_SAID,
  dueFor,
  dueLine,
  dueProblem,
  extensionsOn,
  fromInstant,
  itemDates,
  loadDueDates,
  readDueRow,
  setDue,
  toInstant,
  whenSaid,
  type DueRow,
} from './duedates';

beforeEach(() => {
  calls.length = 0;
  replies.clear();
});

const ITEM = {
  item_id: 'essay', title: 'Essay 2', student_id: null, item_due: '2026-11-07T05:59:00+00:00', due_version: 1,
  granted_due: null, request_id: null, effective_due: '2026-11-07T05:59:00+00:00', extended: false,
};
const MAYA = {
  ...ITEM, student_id: 'maya', granted_due: '2026-11-12', request_id: 'r1', effective_due: '2026-11-13T11:59:59+00:00', extended: true,
};
const QUIZ = { ...ITEM, item_id: 'quiz', title: 'Quiz 1', item_due: null, due_version: 0, effective_due: null };

describe('loading', () => {
  it('calls gradebook_due_dates with the course and term, and reads each column', async () => {
    replies.set('gradebook_due_dates', { data: [ITEM, MAYA, QUIZ], error: null });
    const got = await loadDueDates('HIST 2100', '2026FA');
    expect(calls).toEqual([{ name: 'gradebook_due_dates', args: { want_course: 'HIST 2100', want_term: '2026FA' } }]);
    expect(got.available).toBe(true);
    expect(got.rows[1]).toEqual<DueRow>({
      itemId: 'essay', title: 'Essay 2', studentId: 'maya', itemDue: '2026-11-07T05:59:00+00:00', version: 1,
      grantedDue: '2026-11-12', requestId: 'r1', effectiveDue: '2026-11-13T11:59:59+00:00', extended: true,
    });
    expect(got.rows[2].itemDue).toBeNull();
  });

  it.each(['42883', 'PGRST202', '42703'])('reads a missing function or column (%s) as not set up, not as an error', async (code) => {
    replies.set('gradebook_due_dates', { data: null, error: { message: 'nope', code } });
    expect(await loadDueDates('HIST 2100', '2026FA')).toEqual({ available: false, rows: [] });
  });

  it('throws any other failure', async () => {
    replies.set('gradebook_due_dates', { data: null, error: { message: 'semester: boom', code: 'P0001' } });
    await expect(loadDueDates('HIST 2100', '2026FA')).rejects.toBeInstanceOf(ServiceError);
  });
});

describe('setting', () => {
  it('sends the item, the instant, the version read and the key, and reads the receipt', async () => {
    replies.set('gradebook_set_due', { data: { item: 'essay', due: '2026-11-20T23:59:00+00:00', version: 2 }, error: null });
    const r = await setDue('essay', '2026-11-20T23:59:00.000Z', 1, 'due-key-123');
    expect(calls).toEqual([{ name: 'gradebook_set_due', args: { want_item: 'essay', want_due: '2026-11-20T23:59:00.000Z', want_expect: 1, want_key: 'due-key-123' } }]);
    expect(r).toEqual({ item: 'essay', due: '2026-11-20T23:59:00+00:00', version: 2 });
  });

  it('sends null to clear the date', async () => {
    replies.set('gradebook_set_due', { data: { item: 'essay', due: null, version: 3 }, error: null });
    expect((await setDue('essay', null, 2, 'due-key-456')).due).toBeNull();
    expect((calls[0].args as { want_due: unknown }).want_due).toBeNull();
  });

  it('tells a stale version (40001) apart, as a settled refusal', async () => {
    replies.set('gradebook_set_due', { data: null, error: { message: 'semester: this item’s due date changed since you read it', code: '40001' } });
    const e = await setDue('essay', null, 0, 'due-key-789').catch((x: unknown) => x);
    expect(e).toBeInstanceOf(StaleRequest);
    expect(settled(e)).toBe(true);
  });

  it('says not set up, settled, when the function is missing', async () => {
    replies.set('gradebook_set_due', { data: null, error: { message: 'missing', code: 'PGRST202' } });
    const e = await setDue('essay', null, 0, 'due-key-000').catch((x: unknown) => x);
    expect((e as Error).message).toBe(DUE_NOT_SET_UP_SAID);
    expect(settled(e)).toBe(true);
  });

  it('keeps any other refusal as the server said it', async () => {
    replies.set('gradebook_set_due', { data: null, error: { message: 'semester: that needs grades:release on this course in 2026FA', code: '42501' } });
    const e = await setDue('essay', null, 0, 'due-key-111').catch((x: unknown) => x);
    expect(e).not.toBeInstanceOf(StaleRequest);
    expect((e as Error).message).toContain('grades:release');
  });
});

describe('which date applies, in words', () => {
  const rows = [ITEM, MAYA, QUIZ].map(readDueRow);

  it('gives a student their extension’s row, and anybody else the item’s', () => {
    expect(dueFor(rows, 'essay', 'maya')?.extended).toBe(true);
    expect(dueFor(rows, 'essay', 'ben')?.studentId).toBeNull();
    expect(dueFor(rows, 'nope', 'maya')).toBeUndefined();
    expect([...itemDates(rows).keys()]).toEqual(['essay', 'quiz']);
    expect(extensionsOn(rows, 'essay').map((r) => r.studentId)).toEqual(['maya']);
    expect(extensionsOn(rows, 'quiz')).toEqual([]);
  });

  it('says "Extended to" with the original date under it, and never relies on colour', () => {
    const line = dueLine(dueFor(rows, 'essay', 'maya'));
    expect(line.date).toMatch(/^Extended to .*Nov.*12.*2026/);
    expect(line.label).toMatch(/^Originally due .*Nov/);
    const plain = dueLine(dueFor(rows, 'essay', 'ben'));
    expect(plain.date).toMatch(/Nov/);
    expect(plain.label).toBeNull();
    expect(dueLine(dueFor(rows, 'quiz', 'maya')).date).toBe('No due date set');
    expect(dueLine(undefined).date).toBe('No due date set');
    expect(whenSaid('not a date')).toBe('No due date set');
  });

  it('a granted row that is not later than the item’s date reads as the item’s date', () => {
    const r = readDueRow({ ...MAYA, extended: false });
    expect(dueLine(r).date).not.toMatch(/Extended/);
  });

  it('an item with no date of its own says so under the extension', () => {
    const r = readDueRow({ ...MAYA, item_due: null });
    expect(dueLine(r).label).toBe('The item has no due date of its own');
  });
});

describe('the instructor’s form', () => {
  it('round-trips a local day and time through an instant', () => {
    const iso = toInstant('2026-11-20', '17:30')!;
    expect(fromInstant(iso)).toEqual({ day: '2026-11-20', time: '17:30' });
    expect(fromInstant(null)).toEqual({ day: '', time: '23:59' });
    expect(toInstant('2026-02-30', '17:30')).toBeNull();
    expect(toInstant('2026-11-20', '25:00')).toBeNull();
  });

  it('names what is missing before a call', () => {
    expect(dueProblem('', '23:59')).toBe('Choose the day it is due.');
    expect(dueProblem('2026-11-20', '')).toBe('Choose the time it is due.');
    expect(dueProblem('1999-12-31', '23:59')).toBe('Choose a day between 2000 and 2099.');
    expect(dueProblem('2026-11-20', '23:59')).toBeNull();
  });
});
