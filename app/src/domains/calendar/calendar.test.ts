import { describe, expect, it } from 'vitest';
import { isoToDate } from '../../lib/date';
import type { Appointment, DatedItem, PersonalTask } from '../../lib/types';
import {
  clashes,
  entriesFromLegacy,
  entriesOn,
  entryFromAppointment,
  entryFromDeadline,
  entryFromTask,
  nextUp,
  type Entry,
} from './index';

const e = (over: Partial<Entry> & { id: string }): Entry => ({
  kind: 'appointment', title: over.id, day: '2026-09-09', startMin: null, endMin: null, courseId: null, source: 'entered', ...over,
});

describe('a day', () => {
  it('lists timed entries by start, then untimed ones in the order given', () => {
    const day = entriesOn(
      [e({ id: 'z', title: 'Zeta' }), e({ id: 'b', startMin: 600 }), e({ id: 'a', startMin: 540 }), e({ id: 'y', title: 'Alpha' }), e({ id: 'other', day: '2026-09-10', startMin: 1 })],
      '2026-09-09',
    );
    expect(day.map((x) => x.id)).toEqual(['a', 'b', 'z', 'y']);
  });

  it('finds overlapping blocks, but not blocks that merely touch, and never a deadline', () => {
    const entries = [
      e({ id: 'lecture', kind: 'class', startMin: 540, endMin: 600 }),
      e({ id: 'next', kind: 'class', startMin: 600, endMin: 660 }),
      e({ id: 'clash', startMin: 590, endMin: 630 }),
      e({ id: 'due', kind: 'deadline', startMin: 595, endMin: null }),
      e({ id: 'no-length', startMin: 540, endMin: null }),
    ];
    const pairs = clashes(entries).map((c) => [c.a.id, c.b.id].sort().join('+')).sort();
    // lecture/clash and clash/next overlap; lecture/next touch at 600; the deadline and the lengthless one are not blocks.
    expect(pairs).toEqual(['clash+lecture', 'clash+next']);
  });

  it('names the next timed thing still ahead, skipping tasks and anything already started', () => {
    const entries = [
      e({ id: 'past', startMin: 480 }),
      e({ id: 'task', kind: 'task', startMin: 700 }),
      e({ id: 'soon', startMin: 720 }),
      e({ id: 'later', startMin: 900 }),
    ];
    expect(nextUp(entries, '2026-09-09', 600)?.id).toBe('soon');
    expect(nextUp(entries, '2026-09-09', 720)?.id).toBe('soon');
    expect(nextUp(entries, '2026-09-09', 901)).toBeNull();
    expect(nextUp(entries, '2026-09-10', 0)).toBeNull();
  });
});

const dated = (over: Partial<DatedItem>): DatedItem => ({
  id: 'p1', c: 'econ', title: 'Problem set', kind: 'Problem set', month: 8, day: 9, dueTime: '9:00 AM', weight: '', where: '',
  detail: '', quote: '', source: '', date: isoToDate('2026-09-09'), dueShort: 'Today', dow: 'Wed', mon: 'Sep', isToday: true,
  isPast: false, daysAway: 0, dueAt: 540, ...over,
});

describe('the legacy shapes, mapped', () => {
  it('reads a syllabus deadline, with "no time" as null rather than 1440', () => {
    expect(entryFromDeadline(dated({}))).toMatchObject({ id: 'deadline:p1', day: '2026-09-09', startMin: 540, source: 'needs_review' });
    expect(entryFromDeadline(dated({ dueAt: 24 * 60 })).startMin).toBeNull();
    expect(entryFromDeadline(dated({ checked: { confirmed: true, page: 2 } })).source).toBe('imported');
  });

  const task = (over: Partial<PersonalTask>): PersonalTask => ({
    id: 't1', title: 'Laundry', date: '2026-09-09', time: '6:30 PM', note: '', done: false, created: 0, courseId: null, ...over,
  });

  it('puts a dated, unfinished task on the calendar and leaves someday, finished and malformed ones off', () => {
    expect(entryFromTask(task({}))).toMatchObject({ id: 'task:t1', kind: 'task', day: '2026-09-09', startMin: null });
    expect(entryFromTask(task({ date: null }))).toBeNull();
    expect(entryFromTask(task({ done: true }))).toBeNull();
    expect(entryFromTask(task({ date: '2026-02-30' }))).toBeNull();
  });

  const appt = (over: Partial<Appointment>): Appointment => ({
    id: 'a1', title: 'Dentist', date: '2026-09-09', at: 840, time: '2:00 PM', minutes: 45, where: '', note: '', created: 0, ...over,
  });

  it('gives an appointment an end only when it has a start and a length', () => {
    expect(entryFromAppointment(appt({}))).toMatchObject({ startMin: 840, endMin: 885 });
    expect(entryFromAppointment(appt({ minutes: undefined }))?.endMin).toBeNull();
    expect(entryFromAppointment(appt({ at: null }))).toMatchObject({ startMin: null, endMin: null });
    expect(entryFromAppointment(appt({ date: 'soon' }))).toBeNull();
  });

  it('drops what it cannot map instead of throwing', () => {
    const all = entriesFromLegacy({
      deadlines: [dated({})],
      tasks: [task({}), task({ id: 't2', date: null })],
      appointments: [appt({}), appt({ id: 'a2', date: 'nope' })],
    });
    expect(all.map((x) => x.id).sort()).toEqual(['appointment:a1', 'deadline:p1', 'task:t1']);
  });
});
