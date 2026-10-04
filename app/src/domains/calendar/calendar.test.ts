import { describe, expect, it } from 'vitest';
import { appointmentsOn } from '../../lib/select';
import { isoToDate } from '../../lib/date';
import type { Appointment, DatedItem } from '../../lib/types';
import { fail, ok } from '../../kernel';
import { agendaFor, conflictsIn, getAgenda, isRealDay, type CalendarSource, type Entry, type Guard } from './index';
import { appointmentSource, deadlineSource } from './adapters';

const entry = (over: Partial<Entry> = {}): Entry => ({ id: 'e', title: 'T', kind: 'appointment', on: '2026-10-08', startMin: 600, durationMin: 60, provenance: 'student_entered', ...over });
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

  it('keeps only the day asked for', async () => {
    const got = await deadlineSource(() => [item({ id: 'a' }), item({ id: 'b', date: isoToDate('2026-10-09') })]).entriesOn('2026-10-08');
    expect(got.map((e) => e.id)).toEqual(['deadline:a']);
  });
});
