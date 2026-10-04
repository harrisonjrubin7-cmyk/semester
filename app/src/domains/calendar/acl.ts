import { isIsoDate } from '../kernel';
import { dateToIso } from '../../lib/date';
import { NO_TIME } from '../../lib/duetime';
import type { Appointment, DatedItem, PersonalTask } from '../../lib/types';
import type { Entry } from './model';

/**
 * Anti-corruption layer: each legacy calendar shape, as an `Entry`.
 *
 * Every function here is total and drops what it does not understand rather
 * than throwing, because a malformed row in somebody's saved semester must
 * show up as one missing entry, not as a blank Today. A legacy value that cannot
 * be mapped returns `null`, and `entriesFromLegacy` leaves it out.
 */

/** `DatedItem.dueAt` is minutes past midnight, or {@link NO_TIME} (1440) for wording like "In class". */
export function entryFromDeadline(item: DatedItem): Entry {
  return {
    id: `deadline:${item.id}`,
    kind: 'deadline',
    title: item.title,
    day: dateToIso(item.date),
    startMin: item.dueAt >= NO_TIME ? null : item.dueAt,
    endMin: null,
    courseId: item.c,
    // The same reading `lib/today-center.ts` makes: confirmed against the syllabus or it needs review.
    source: item.checked?.confirmed === true ? 'imported' : 'needs_review',
  };
}

/** A task is on the calendar only when it has a day; "someday" tasks are not calendar entries. */
export function entryFromTask(task: PersonalTask): Entry | null {
  if (task.done || task.date === null || !isIsoDate(task.date)) return null;
  return {
    id: `task:${task.id}`,
    kind: 'task',
    title: task.title,
    day: task.date,
    // `PersonalTask.time` is free text and "never parsed" (see its type); so is it here.
    startMin: null,
    endMin: null,
    courseId: task.courseId,
    source: 'entered',
  };
}

export function entryFromAppointment(a: Appointment): Entry | null {
  if (!isIsoDate(a.date)) return null;
  const start = a.at;
  return {
    id: `appointment:${a.id}`,
    kind: 'appointment',
    title: a.title,
    day: a.date,
    startMin: start,
    endMin: start !== null && a.minutes !== undefined && a.minutes > 0 ? start + a.minutes : null,
    courseId: null,
    source: 'entered',
  };
}

export interface LegacyCalendar {
  deadlines: readonly DatedItem[];
  tasks: readonly PersonalTask[];
  appointments: readonly Appointment[];
}

export function entriesFromLegacy(legacy: LegacyCalendar): Entry[] {
  return [
    ...legacy.deadlines.map(entryFromDeadline),
    ...legacy.tasks.map(entryFromTask),
    ...legacy.appointments.map(entryFromAppointment),
  ].filter((e): e is Entry => e !== null);
}
