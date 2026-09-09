import { readDue } from './duetime';
import { num, rows, str } from './stored';
import type { Appointment } from './types';

/**
 * A stored appointment list, with the one field the grids do arithmetic on.
 *
 * `state/shape.ts` reads every one of its lists with `Array.isArray(v) ? v : []`
 * — a cast, not a check — so an appointment arrives exactly as storage holds
 * it. That is fine for the fields that are only drawn, and not for `at`, which
 * is a number three screens compute a layout from.
 *
 * What it cost, measured, with one appointment carrying no `at`: the calendar's
 * hour grid took `Math.min(8 * 60, ...starts)`, got NaN, and lost its entire
 * axis — no hour lines, and every block in the day, classes included, drawn at
 * `top: NaN`. `components/HourGrid.tsx` now refuses to let one block do that,
 * which is the containment; this is the repair, so the appointment lands on its
 * own hour instead of being left off the grid.
 *
 * The hour is taken from `time` when the number is missing, because the record
 * carries both and the words are the half a person typed — "6:30p" says half
 * past six whether or not the build that saved it also stored 390. `readDue`
 * reads exactly this shape and already carries the same warning at its top,
 * about a `dueTime` that was typed as a string and was not one.
 *
 * `at` genuinely absent and unreadable stays absent-shaped as -1: sorted to the
 * front of its day, off the hour grid, still drawn in every list. An
 * appointment invented at midnight would be a fact the app made up.
 */
export function readAppointments(raw: unknown): Appointment[] {
  return rows<Appointment>(raw, 'ap').map((a) => {
    const time = str(a.time);
    return {
      ...a,
      id: a.id as string,
      title: str(a.title),
      // The calendar's month grid reads this straight into `isoToDate`, which
      // splits it. Blank rather than absent, so the `if (t.date)` the same
      // function already applies to your own tasks works here too.
      date: str(a.date),
      at: num(a.at, readDue(time) ?? -1),
      time,
      where: str(a.where),
      note: str(a.note),
      created: num(a.created),
    } as Appointment;
  });
}
