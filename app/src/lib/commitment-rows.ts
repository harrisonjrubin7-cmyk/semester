import { blocksFor, type Catalog } from '../data/catalog';
import { clock, dateToIso } from './date';
import { readDue } from './duetime';
import { appointmentsOn, tasksOn } from './select';
import { itemSource, type CommitmentRow } from './today-center';
import type { Appointment, DatedItem, PersonalTask } from './types';

/** How far ahead the commitment rows look. "In 9 days" is the furthest the brief's example reaches. */
export const HORIZON_DAYS = 10;

/** Everything the rows are built from, as plain values, so the builder has no store and no clock of its own. */
export interface CommitmentInputs {
  readonly catalog: Catalog;
  readonly now: Date;
  /** The ids of the courses the student has. */
  readonly ownIds: readonly string[];
  /** Whether the shipped sample is still the student's semester (its classes are not theirs until they say so). */
  readonly sample: boolean;
  readonly tasks: PersonalTask[];
  readonly appointments: Appointment[];
  readonly done: Record<string, boolean>;
  /** The deadlines in scope, as `ownedScope` leaves them. */
  readonly upcoming: DatedItem[];
}

/**
 * The Action Center's commitment rows: what is on over the next {@link HORIZON_DAYS}
 * days, as drawn.
 *
 * This is the body `components/TodayActionCenter.tsx` used to build inline, moved
 * and not changed, so that the domain-backed rows (`composition/commitments.ts`)
 * can be held to it case by case. It is the legacy side of that parity, and goes
 * when the screen stops using it.
 */
export function legacyCommitmentRows({ catalog, now, ownIds, sample, tasks, appointments, done, upcoming }: CommitmentInputs, horizonDays: number = HORIZON_DAYS): CommitmentRow[] {
  const out: CommitmentRow[] = [];
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const end = new Date(start.getFullYear(), start.getMonth(), start.getDate() + horizonDays);
  for (const item of upcoming) {
    if (done[item.id] || item.date < start || item.date >= end) continue;
    out.push({
      id: `course:${item.id}`,
      at: item.date.getTime() + Math.min(item.dueAt, 24 * 60 - 1) * 60_000,
      title: item.title,
      meta: catalog.byId[item.c]?.code || 'Course deadline',
      kind: 'deadline',
      group: item.c,
      source: itemSource(item),
      itemId: item.id,
    });
  }
  for (let offset = 0; offset < horizonDays; offset += 1) {
    const date = new Date(start.getFullYear(), start.getMonth(), start.getDate() + offset);
    for (const task of tasksOn(tasks, date).filter((t) => !t.done)) {
      out.push({
        id: `task:${task.id}`,
        at: date.getTime() + (readDue(task.time) ?? 24 * 60 - 1) * 60_000,
        title: task.title,
        meta: 'Your action',
        kind: 'task',
        source: 'student_entered',
      });
    }
    for (const appointment of appointmentsOn(appointments, date)) {
      out.push({
        id: `appointment:${appointment.id}:${dateToIso(date)}`,
        at: date.getTime() + (appointment.at ?? 0) * 60_000,
        title: appointment.title,
        meta: appointment.where || 'Your appointment',
        kind: 'appointment',
        source: 'student_entered',
      });
    }
    // Classes only for today and tomorrow: a timetable repeated for ten
    // days would push every deadline off the list.
    if (offset > 1) continue;
    // The sample's classes are not the student's classes until they say so.
    const theirs = (b: { c?: string | null }) => !sample || !b.c || ownIds.includes(b.c);
    for (const block of blocksFor(catalog, date).filter((b) => !b.optional && !b.canceled && theirs(b))) {
      out.push({
        id: `class:${dateToIso(date)}:${block.c}:${block.at}`,
        at: date.getTime() + block.at * 60_000,
        title: block.title,
        meta: `Class · ${clock(block.at)}`,
        kind: 'class',
        group: block.c || undefined,
      });
    }
  }
  return out;
}
