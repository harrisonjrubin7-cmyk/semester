import { dateToIso, isoToDate } from '../../../lib/date';
import { appointmentLength, appointmentsOn } from '../../../lib/select';
import type { Appointment, Block, DatedItem } from '../../../lib/types';
import type { Entry } from '../domain/agenda';
import type { CalendarSource } from '../application/get-agenda';

/**
 * The student's own appointments, through the function the calendar screen
 * uses to expand a repeating one into the day being drawn. Expanding a rule is
 * legacy knowledge (`lib/repeat.ts`); the domain gets plain occurrences.
 *
 * `minutes` absent reads as an hour, as it does everywhere else in the app —
 * `appointmentLength` is that rule, borrowed rather than copied.
 */
export function appointmentSource(read: () => Appointment[]): CalendarSource {
  return {
    name: 'Your appointments',
    entriesOn: async (on) =>
      appointmentsOn(read(), isoToDate(on)).map((a): Entry => ({
        id: `appointment:${a.id}@${on}`,
        title: a.title,
        kind: 'appointment',
        on,
        startMin: a.at,
        durationMin: a.at === null ? 0 : appointmentLength(a),
        provenance: 'student_entered',
        done: false,
      })),
  };
}

/**
 * Course deadlines. `dueAt` is 24×60 when the wording names no hour
 * ("In class"), which the legacy shape uses as "after everything"; here that
 * is an all-day entry. A deadline is an instant: it occupies no minutes.
 * `isDone` is the student's own tick; the deadline stays on the calendar.
 */
export function deadlineSource(read: () => DatedItem[], isDone: (id: string) => boolean = () => false): CalendarSource {
  return {
    name: 'Course deadlines',
    entriesOn: async (on) =>
      read()
        .filter((i) => dateToIso(i.date) === on)
        .map((i): Entry => ({
          id: `deadline:${i.id}`,
          title: i.title,
          kind: 'deadline',
          on,
          startMin: i.dueAt < 24 * 60 ? i.dueAt : null,
          durationMin: 0,
          provenance: i.checked?.confirmed ? 'imported' : 'needs_review',
          done: isDone(i.id),
        })),
  };
}

/** A class meeting as the legacy catalogue yields it for one day, with how long it runs. */
export interface ClassMeeting {
  readonly block: Block;
  readonly minutes: number;
}

/**
 * Class meetings, from the timetable the syllabus produced.
 *
 * The id is the one the Action Center has always given a class on a day
 * (`class:<day>:<course>:<minute>`), so a snooze, a deep link or a comparison
 * made against the old rows still means the same thing.
 *
 * An optional session and a cancelled one are not on the day — the rule the
 * Action Center applies — so they are not entries. That is Today's reading of
 * "a class"; the calendar screen draws a cancelled one struck through, which
 * an `Entry` cannot yet say. The host decides *whose* classes these are (the
 * sample's are not the student's until they say so) before they get here.
 */
export function classSource(read: (date: Date) => readonly ClassMeeting[]): CalendarSource {
  return {
    name: 'Your classes',
    entriesOn: async (on) =>
      read(isoToDate(on))
        .filter(({ block }) => !block.optional && !block.canceled)
        .map(({ block, minutes }): Entry => ({
          id: `class:${on}:${block.c}:${block.at}`,
          title: block.title,
          kind: 'class',
          on,
          startMin: block.at,
          durationMin: minutes,
          provenance: 'imported',
          done: false,
        })),
  };
}
