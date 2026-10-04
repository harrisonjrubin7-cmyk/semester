import { dateToIso, isoToDate } from '../../../lib/date';
import { appointmentLength, appointmentsOn } from '../../../lib/select';
import type { Appointment, DatedItem } from '../../../lib/types';
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
