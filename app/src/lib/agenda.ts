/**
 * The agenda — the calendar as a list, one day under the next.
 *
 * §94 asks for five views and the calendar had four. Day, week and month are
 * grids, and the semester is bars; none of them answers "what is next, in
 * order" without the student scanning a grid for it. A list does, and on a
 * phone it is the view that reads at 320px without anything being cut.
 *
 * It draws nothing new. Every row comes from the same per-day selectors the
 * day view uses (`lib/select.ts`) and the same source chips (`lib/calsource.ts`),
 * so a thing that is on Tuesday in the day view is on Tuesday here, and a
 * chip that hides it there hides it here. A second way of deciding what is
 * on a day would be a second answer to the same question, and they would
 * disagree the first time one of them was fixed.
 *
 * Days with nothing on them are left out rather than drawn as empty headings:
 * the question a list answers is "what is coming", and fourteen headings with
 * "nothing" under ten of them buries the four that matter.
 */

import { dateToIso } from './date';
import { appointmentsOn, byTime, feedEventsOn, tasksOn } from './select';
import type { Appointment, DatedEvent, DatedItem, FeedEvent, PersonalTask } from './types';

/** How far ahead the agenda looks: two weeks, today included. */
export const AGENDA_DAYS = 14;

/** One thing on one day, in whichever record it came from. */
export type AgendaEntry =
  | { kind: 'appointment'; at: number | null; appointment: Appointment }
  | { kind: 'feed'; at: number | null; event: FeedEvent }
  | { kind: 'deadline'; at: null; item: DatedItem }
  | { kind: 'campus'; at: null; event: DatedEvent }
  | { kind: 'action'; at: null; task: PersonalTask };

export interface AgendaDay {
  /** ISO date, YYYY-MM-DD. */
  iso: string;
  date: Date;
  entries: AgendaEntry[];
}

export interface AgendaInput {
  items: DatedItem[];
  events: DatedEvent[];
  feed: FeedEvent[];
  tasks: PersonalTask[];
  appointments: Appointment[];
}

/**
 * The next `days` days from `from`, each with what is on it.
 *
 * Within a day, all-day entries come first, then things with an hour in hour
 * order — an
 * appointment at 9 and a connected-calendar entry at 11 interleave, because
 * that is the order the day happens in. Things without a parsed hour follow,
 * deadlines before campus events before your own tasks: a deadline's time is
 * the syllabus's words ("before class", "11:59 PM"), a task's is free text
 * that is never parsed (`PersonalTask.time`), and sorting either by guessing
 * at an hour would be the view inventing a precision the record does not have.
 *
 * Finished tasks are left out, as on the month's selected day: a list of
 * what is coming is not a list of what is done.
 */
export function agendaDays(input: AgendaInput, from: Date, days = AGENDA_DAYS): AgendaDay[] {
  const out: AgendaDay[] = [];
  for (let n = 0; n < days; n += 1) {
    const date = new Date(from.getFullYear(), from.getMonth(), from.getDate() + n);
    const iso = dateToIso(date);
    const timed: AgendaEntry[] = [
      ...appointmentsOn(input.appointments, date).map((a) => ({
        kind: 'appointment' as const,
        at: a.at,
        appointment: a,
      })),
      ...feedEventsOn(input.feed, date).map((e) => ({ kind: 'feed' as const, at: e.at, event: e })),
    ].sort(byTime);
    const untimed: AgendaEntry[] = [
      ...input.items
        .filter((i) => dateToIso(i.date) === iso)
        .map((i) => ({ kind: 'deadline' as const, at: null, item: i })),
      ...input.events
        .filter((e) => dateToIso(e.date) === iso)
        .map((e) => ({ kind: 'campus' as const, at: null, event: e })),
      ...tasksOn(input.tasks, date)
        .filter((t) => !t.done)
        .map((t) => ({ kind: 'action' as const, at: null, task: t })),
    ];
    // `byTime` puts an appointment or feed entry with no hour ("all day")
    // first, which is where the all-day band sits on every grid here.
    const entries = [...timed, ...untimed];
    if (entries.length > 0) out.push({ iso, date, entries });
  }
  return out;
}

/** How many things the agenda holds, for the count above it. */
export function agendaCount(days: AgendaDay[]): number {
  return days.reduce((sum, d) => sum + d.entries.length, 0);
}
