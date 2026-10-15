import { describe, expect, it } from 'vitest';
import { rank, type Choice } from '../lib/actions';
import { isoToDate } from '../lib/date';
import { todayActions } from '../lib/today-actions';
import type { Appointment, DatedItem, PersonalTask } from '../lib/types';
import { MemorySink, counterIds, fixedClock } from '../kernel';
import type { ClassMeeting } from '../domains/calendar/adapters';
import { composeDomains, type LegacyHost } from './domains';

/**
 * The slice, end to end: identity → policy → tasks, calendar → Today, over
 * fixtures shaped like the legacy store, with nothing mocked but the clock.
 */

const clock = fixedClock('2026-10-08');
const ptask = (over: Partial<PersonalTask>): PersonalTask => ({ id: 't', title: 'T', date: null, time: '', note: '', done: false, created: 0, courseId: null, ...over });
const appt = (over: Partial<Appointment>): Appointment => ({ id: 'a', title: 'A', date: '2026-10-08', at: 600, time: '', where: '', note: '', created: 0, ...over });
const due = (id: string, daysAway: number): DatedItem =>
  ({ id, title: `Essay ${id}`, date: isoToDate('2026-10-08'), dueShort: 'Today', dueAt: 17 * 60, daysAway, checked: { confirmed: true } }) as unknown as DatedItem;

function host(over: Partial<{ tasks: PersonalTask[]; appointments: Appointment[]; deadlines: DatedItem[]; choices: Record<string, Choice>; user: string | null; classes: ClassMeeting[] }> = {}) {
  let tasks = over.tasks ?? [];
  const h: LegacyHost = {
    identity: () => ({ role: 'student', userId: over.user ?? null, schoolId: null, grants: [] }),
    tasks: { read: () => tasks, update: (f) => void (tasks = f(tasks)) },
    taskCommands: {
      add: (t) => void (tasks = [...tasks, { ...t, id: `n${tasks.length}`, created: 0, done: false }]),
      move: (id, date, time) => void (tasks = tasks.map((t) => (t.id === id ? { ...t, date, ...(time === undefined ? {} : { time }) } : t))),
      remove: (id) => void (tasks = tasks.filter((t) => t.id !== id)),
    },
    appointments: () => over.appointments ?? [],
    deadlines: () => over.deadlines ?? [],
    isDone: () => false,
    classes: () => over.classes ?? [],
    ranking: () => ({
      input: { path: { state: 'moving', heading: '', detail: '', creditLine: '', covered: 1, total: 1, percent: 100, unresolved: 0, firstUnresolved: null, source: '' }, upcoming: over.deadlines ?? [], done: {}, reviewDue: 0, catalogEmpty: false },
      choices: over.choices ?? {},
    }),
  };
  return { h, tasks: () => tasks };
}

const world = (over?: Parameters<typeof host>[0]) => {
  const w = host(over);
  const events = new MemorySink();
  return { ...w, events, domains: composeDomains(w.h, { clock, ids: counterIds('req'), events }) };
};

describe('the composed slice', () => {
  const fixtures = {
    tasks: [ptask({ id: 'late', title: 'Reading', date: '2026-10-06' }), ptask({ id: 'now', title: 'Problem set', date: '2026-10-08' }), ptask({ id: 'later', date: '2026-10-20' })],
    appointments: [appt({ id: 'lab', title: 'Lab', at: 600, minutes: 120 }), appt({ id: 'office', title: 'Office hours', at: 660, minutes: 30 })],
    deadlines: [due('e1', 0)],
  };

  it('assembles Today from tasks, two calendars and the legacy ranking, and flags the clash', async () => {
    const { domains } = world(fixtures);
    const r = await domains.today.view();
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.value.on).toBe('2026-10-08');
    expect(r.value.overdue.map((t) => t.id)).toEqual(['late']);
    expect(r.value.dueToday.map((t) => t.id)).toEqual(['now']);
    expect(r.value.schedule.map((e) => e.id)).toEqual(['appointment:lab@2026-10-08', 'appointment:office@2026-10-08', 'deadline:e1']);
    expect(r.value.conflicts.map((c) => [c.first.title, c.second.title])).toEqual([['Lab', 'Office hours']]);
    expect(r.value.quiet).toBe(false);
  });

  it('puts first what the legacy Action Center puts first, for the same state', async () => {
    const { h, domains } = world(fixtures);
    const direct = rank(todayActions(h.ranking().input), {}, clock.now());
    const r = await domains.today.view();
    expect(r.ok && r.value.mostImportant?.id).toBe(direct.mostImportant?.action.id);
    expect(r.ok && r.value.next.map((n) => n.id)).toEqual(direct.next.map((n) => n.action.id));
    expect(direct.mostImportant).not.toBeNull();
  });

  it('shows the effect of ticking a task on the next read of Today, through the legacy store', async () => {
    const { domains, tasks, events } = world(fixtures);
    expect(await domains.tasks.complete('late')).toEqual({ ok: true, value: { taskId: 'late', outcome: 'done', rolledTo: null } });
    expect(tasks().find((t) => t.id === 'late')?.done).toBe(true);
    const r = await domains.today.view();
    expect(r.ok && r.value.overdue).toEqual([]);
    expect(events.events.map((e) => e.type)).toEqual(['tasks.completed']);
  });

  it('works signed out, and signed in: Semester is usable either way (ADR 0001)', async () => {
    for (const user of [null, 'u1']) {
      const { domains } = world({ ...fixtures, user });
      expect((await domains.today.view()).ok, String(user)).toBe(true);
      expect((await domains.tasks.complete('now')).ok, String(user)).toBe(true);
    }
  });

  it('is quiet on an empty day, and says so', async () => {
    const r = await world().domains.today.view();
    expect(r.ok && r.value.quiet).toBe(true);
  });

  it('reads who is signed in each time, so signing out mid-session is seen', async () => {
    let user: string | null = 'u1';
    const w = host();
    const d = composeDomains({ ...w.h, identity: () => ({ role: 'student', userId: user, schoolId: null, grants: [] }) }, { clock, ids: counterIds('req'), events: new MemorySink() });
    expect(d.subject().signedIn).toBe(true);
    user = null;
    expect(d.subject().signedIn).toBe(false);
  });
});
