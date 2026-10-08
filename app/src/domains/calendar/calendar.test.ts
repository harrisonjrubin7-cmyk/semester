import { describe, expect, it } from 'vitest';
import { appointmentsOn, tasksOn } from '../../lib/select';
import { readDue } from '../../lib/duetime';
import { isoToDate } from '../../lib/date';
import type { Appointment, DatedItem, PersonalTask } from '../../lib/types';
import { fail, ok } from '../../kernel';
import { agendaFor, conflictsIn, getAgenda, isRealDay, type CalendarSource, type Entry, type Guard } from './index';
import { appointmentSource, classSource, deadlineSource, taskSource } from './adapters';
import { buildCatalog, blocksFor } from '../../data/catalog';
import { loadSeed } from '../../data/seed';
import { lengthOf } from '../../lib/select';
import type { Block } from '../../lib/types';

const entry = (over: Partial<Entry> = {}): Entry => ({ id: 'e', title: 'T', kind: 'appointment', on: '2026-10-08', startMin: 600, durationMin: 60, provenance: 'student_entered', done: false, ...over });
const allow: Guard = () => ok(undefined);

describe('calendar: ordering a day', () => {
  it('puts all-day first, then by the hour, and breaks ties the same way every time', () => {
    const entries = [
      entry({ id: 'b', title: 'B', startMin: 600 }),
      entry({ id: 'a', title: 'A', startMin: 600 }),
      entry({ id: 'd', title: 'Due', kind: 'deadline', startMin: 600, durationMin: 0 }),
      entry({ id: 'c', title: 'Class', kind: 'class', startMin: 600 }),
      entry({ id: 'x', title: 'All day', startMin: null, durationMin: 0 }),
      entry({ id: 'y', title: 'Other day', on: '2026-10-09' }),
    ];
    expect(agendaFor(entries, '2026-10-08').map((e) => e.id)).toEqual(['x', 'c', 'a', 'b', 'd']);
    expect(agendaFor([...entries].reverse(), '2026-10-08').map((e) => e.id)).toEqual(['x', 'c', 'a', 'b', 'd']);
  });
});

describe('calendar: conflicts', () => {
  it('finds minutes shared by two timed entries', () => {
    const got = conflictsIn([entry({ id: 'a', startMin: 600, durationMin: 90 }), entry({ id: 'b', startMin: 660, durationMin: 60 })]);
    expect(got.map((c) => [c.first.id, c.second.id])).toEqual([['a', 'b']]);
  });

  it('does not call back-to-back a conflict, nor an all-day entry or a deadline one', () => {
    expect(conflictsIn([entry({ id: 'a', startMin: 600, durationMin: 60 }), entry({ id: 'b', startMin: 660, durationMin: 60 })])).toEqual([]);
    expect(conflictsIn([entry({ id: 'a', startMin: 600, durationMin: 60 }), entry({ id: 'b', startMin: null, durationMin: 0 })])).toEqual([]);
    expect(conflictsIn([entry({ id: 'a', startMin: 600, durationMin: 60 }), entry({ id: 'b', kind: 'deadline', startMin: 630, durationMin: 0 })])).toEqual([]);
  });

  it('finds every pair in a pile-up, not just neighbours', () => {
    const three = [entry({ id: 'a', startMin: 600, durationMin: 120 }), entry({ id: 'b', startMin: 610, durationMin: 30 }), entry({ id: 'c', startMin: 620, durationMin: 30 })];
    expect(conflictsIn(three).map((c) => `${c.first.id}${c.second.id}`)).toEqual(['ab', 'ac', 'bc']);
  });
});

describe('calendar: real days', () => {
  it('accepts a real day and refuses a made-up one, including 29 February in the wrong year', () => {
    expect(isRealDay('2026-10-08')).toBe(true);
    expect(isRealDay('2028-02-29')).toBe(true);
    for (const bad of ['2026-02-29', '2026-13-01', '2026-10-32', '2026-10-8', 'tomorrow', '']) expect(isRealDay(bad), bad).toBe(false);
  });
});

describe('calendar: the use case', () => {
  const mine: CalendarSource = { name: 'Mine', entriesOn: async () => [entry({ id: 'mine', startMin: 600 })] };
  const feed: CalendarSource = { name: 'Campus feed', entriesOn: async () => [entry({ id: 'feed', startMin: 630, durationMin: 60 })] };
  const broken: CalendarSource = { name: 'Campus feed', entriesOn: async () => { throw new Error('503'); } };

  it('merges every source, orders the day and reports the conflict', async () => {
    const r = await getAgenda({ sources: [mine, feed], guard: allow })('2026-10-08');
    expect(r.ok && r.value.entries.map((e) => e.id)).toEqual(['mine', 'feed']);
    expect(r.ok && r.value.conflicts).toHaveLength(1);
    expect(r.ok && r.value.unavailable).toEqual([]);
  });

  // Native first, connected when available: a feed that is down leaves the
  // student's own day intact and says what is missing, rather than failing.
  it('draws the day from what it can read and names what it could not', async () => {
    const r = await getAgenda({ sources: [mine, broken], guard: allow })('2026-10-08');
    expect(r.ok && r.value.entries.map((e) => e.id)).toEqual(['mine']);
    expect(r.ok && r.value.unavailable).toEqual(['Campus feed']);
  });

  it('refuses a day that is not one, and a request the guard refuses, before reading anything', async () => {
    let read = 0;
    const counting: CalendarSource = { name: 'c', entriesOn: async () => { read++; return []; } };
    const bad = await getAgenda({ sources: [counting], guard: allow })('2026-02-30');
    expect(bad.ok || bad.error).toMatchObject({ kind: 'validation', code: 'calendar.bad_day' });
    const denied = await getAgenda({ sources: [counting], guard: () => fail('forbidden', 'policy.not_owner', 'no') })('2026-10-08');
    expect(denied.ok || denied.error.code).toBe('policy.not_owner');
    expect(read).toBe(0);
  });
});

// ── the legacy adapters, held to the functions they borrow ─────────────────

const appt = (over: Partial<Appointment>): Appointment => ({ id: 'a1', title: 'Shift', date: '2026-10-05', at: 540, time: '9:00a', where: '', note: '', created: 0, ...over });

describe('calendar: appointments over lib/select.appointmentsOn', () => {
  const list = [
    appt({ id: 'once', title: 'Dentist', date: '2026-10-08', at: 840, minutes: 30 }),
    appt({ id: 'shift', title: 'Shift', date: '2026-10-01', at: 540, minutes: 240, repeat: { every: 'weekly', until: '2026-12-31' } }),
    appt({ id: 'allday', title: 'Family visit', date: '2026-10-08', at: null, time: 'All day' }),
    appt({ id: 'elsewhere', title: 'Not today', date: '2026-10-09' }),
  ];

  it('gives the same appointments, in the same order, as the legacy day — repeats expanded', async () => {
    const legacyIds = appointmentsOn(list, isoToDate('2026-10-08')).map((a) => a.id);
    const entries = await appointmentSource(() => list).entriesOn('2026-10-08');
    expect(entries.map((e) => e.id.replace(/^appointment:|@.*$/g, ''))).toEqual(legacyIds);
    expect(legacyIds).toEqual(['allday', 'shift', 'once']);
  });

  it('reads an absent length as an hour and an all-day entry as occupying none', async () => {
    const entries = await appointmentSource(() => [appt({ id: 'no-length', date: '2026-10-08', at: 600 }), appt({ id: 'allday', date: '2026-10-08', at: null })]).entriesOn('2026-10-08');
    expect(entries.map((e) => [e.startMin, e.durationMin])).toEqual([[null, 0], [600, 60]]);
  });

  it('names an occurrence by its day, so a repeat is a different entry each week', async () => {
    const [a] = await appointmentSource(() => list).entriesOn('2026-10-08');
    const [b] = await appointmentSource(() => list).entriesOn('2026-10-15');
    expect(a.id).not.toBe(b.id);
  });
});

describe('calendar: deadlines', () => {
  const item = (over: Record<string, unknown>) => ({ id: 'i1', title: 'Essay 2', date: isoToDate('2026-10-08'), dueAt: 24 * 60, checked: undefined, ...over }) as unknown as DatedItem;

  it('reads "no hour" as all-day, a clock time as that minute, and neither as occupying time', async () => {
    const got = await deadlineSource(() => [item({ id: 'a' }), item({ id: 'b', dueAt: 23 * 60 + 59 })]).entriesOn('2026-10-08');
    expect(got.map((e) => [e.startMin, e.durationMin])).toEqual([[null, 0], [1439, 0]]);
  });

  it('trusts only a deadline that was checked against its syllabus, as Today does', async () => {
    const got = await deadlineSource(() => [item({ id: 'a', checked: { confirmed: true } }), item({ id: 'b' })]).entriesOn('2026-10-08');
    expect(got.map((e) => e.provenance)).toEqual(['imported', 'needs_review']);
  });

  it('carries the student\u2019s own tick, and keeps the deadline on the calendar', async () => {
    const got = await deadlineSource(() => [item({ id: 'a' }), item({ id: 'b' })], (id) => id === 'a').entriesOn('2026-10-08');
    expect(got.map((e) => [e.id, e.done])).toEqual([['deadline:a', true], ['deadline:b', false]]);
  });

  it('keeps only the day asked for', async () => {
    const got = await deadlineSource(() => [item({ id: 'a' }), item({ id: 'b', date: isoToDate('2026-10-09') })]).entriesOn('2026-10-08');
    expect(got.map((e) => e.id)).toEqual(['deadline:a']);
  });
});

describe('calendar: class meetings over the legacy timetable', () => {
  const block = (over: Partial<Block> = {}): Block => ({ time: '9:00a', at: 540, title: 'ECON 1010', meta: 'Room 4', c: 'econ', ...over });

  it('names a class the way the Action Center always has, so a snooze or a link keeps its meaning', async () => {
    const [e] = await classSource(() => [{ block: block(), minutes: 75 }]).entriesOn('2026-09-29');
    expect(e).toMatchObject({ id: 'class:2026-09-29:econ:540', kind: 'class', startMin: 540, durationMin: 75, provenance: 'imported', done: false });
  });

  it('leaves out an optional session and a cancelled one, as Today does', async () => {
    const got = await classSource(() => [{ block: block({ at: 540 }), minutes: 50 }, { block: block({ at: 600, optional: true }), minutes: 50 }, { block: block({ at: 660, canceled: true }), minutes: 50 }]).entriesOn('2026-09-29');
    expect(got.map((e) => e.startMin)).toEqual([540]);
  });

  it('asks the legacy timetable for the day it was asked about, as a local date', async () => {
    const asked: string[] = [];
    await classSource((d) => { asked.push(`${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`); return []; }).entriesOn('2026-09-29');
    expect(asked).toEqual(['2026-9-29']);
  });

  // The real timetable: the shipped sample semester, a Tuesday with classes.
  it('gives the same classes, at the same minutes and lengths, as blocksFor on the seeded semester', async () => {
    const cat = buildCatalog(await loadSeed());
    const date = new Date(2026, 8, 29);
    const legacy = blocksFor(cat, date).filter((b) => !b.optional && !b.canceled);
    expect(legacy.length, 'the control: that Tuesday has classes').toBeGreaterThan(0);
    const got = await classSource((d) => blocksFor(cat, d).map((b) => ({ block: b, minutes: lengthOf(cat, b) }))).entriesOn('2026-09-29');
    expect(got.map((e) => e.id)).toEqual(legacy.map((b) => `class:2026-09-29:${b.c}:${b.at}`));
    expect(got.map((e) => e.durationMin)).toEqual(legacy.map((b) => lengthOf(cat, b)));
  });
});

describe('calendar: tasks over lib/select.tasksOn', () => {
  const ptask = (over: Partial<PersonalTask>): PersonalTask => ({ id: 't', title: 'T', date: '2026-10-08', time: '', note: '', done: false, created: 0, courseId: null, ...over });

  it('is exactly the tasks the legacy selector finds for the day, finished ones included and marked', async () => {
    const list = [ptask({ id: 'a' }), ptask({ id: 'b', done: true }), ptask({ id: 'c', date: '2026-10-09' }), ptask({ id: 'd', date: null })];
    const entries = await taskSource(() => list).entriesOn('2026-10-08');
    expect(entries.map((e) => [e.id, e.done])).toEqual([['task:a', false], ['task:b', true]]);
    expect(entries.map((e) => e.id)).toEqual(tasksOn(list, isoToDate('2026-10-08')).map((t) => `task:${t.id}`));
  });

  it('reads the time the way the rest of the app does, and calls wording with no clock all-day', async () => {
    const list = [ptask({ id: 'a', time: '6:30 PM' }), ptask({ id: 'b', time: '9 AM' }), ptask({ id: 'c', time: 'before work' }), ptask({ id: 'd', time: '' })];
    const entries = await taskSource(() => list).entriesOn('2026-10-08');
    expect(entries.map((e) => e.startMin)).toEqual(list.map((t) => readDue(t.time)));
    expect(entries.find((e) => e.id === 'task:a')?.startMin).toBe(18 * 60 + 30);
    expect(entries.filter((e) => e.startMin === null).map((e) => e.id)).toEqual(['task:c', 'task:d']);
  });

  it('is an instant that belongs to the student, so it occupies no minutes and says who made it', async () => {
    const [e] = await taskSource(() => [ptask({ time: '4 PM' })]).entriesOn('2026-10-08');
    expect(e).toMatchObject({ kind: 'task', durationMin: 0, provenance: 'student_entered', on: '2026-10-08' });
    expect(conflictsIn([e, { ...e, id: 'task:x' }])).toEqual([]);
  });

  it('puts a repeating task on its one stored day and no other: ticking is what moves it', async () => {
    const weekly = ptask({ id: 'w', repeat: { every: 'weekly', until: '2026-12-31' } });
    expect((await taskSource(() => [weekly]).entriesOn('2026-10-08')).map((e) => e.id)).toEqual(['task:w']);
    expect(await taskSource(() => [weekly]).entriesOn('2026-10-15')).toEqual([]);
  });

  it('reads the list afresh each call, as the other sources do', async () => {
    let list = [ptask({ id: 'a' })];
    const source = taskSource(() => list);
    expect((await source.entriesOn('2026-10-08')).length).toBe(1);
    list = [];
    expect((await source.entriesOn('2026-10-08')).length).toBe(0);
  });
});
