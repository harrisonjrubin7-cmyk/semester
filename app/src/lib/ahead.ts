/**
 * The coming week, in hours, before it starts.
 *
 * Everything this needs was already here — the timetable, the commitments,
 * the deadlines, the appointments — and it was only ever shown a day at a
 * time. A day at a time is the wrong resolution for the question people
 * actually get wrong, which is not "what is on today" but "is this week
 * survivable, and if not, which evening was I going to lose".
 *
 * ## Hours, not a score
 *
 * There is no readiness percentage here and there will not be one. The
 * honest output is a count of hours you have already promised and a count of
 * things due, side by side, with the arithmetic visible. A single number
 * combining them would need a weight for how long a paper takes, which the app
 * does not know and cannot find out, and it would be believed.
 *
 * The one estimate is study time, and it is an estimate the student sets: a
 * course's own `planMinutes`, which comes from its syllabus. Where a course
 * does not state one it contributes nothing rather than a guess.
 */

import type { Appointment, DatedItem } from './types';
import type { Catalog } from '../data/catalog';
import { blocksFor } from '../data/catalog';
import type { Commitment } from './activities';
import { blocksOn } from './activities';
import { decorateItem } from './date';
import type { DoneMap } from './standing';

export interface Day {
  date: Date;
  /** Weekday, short. */
  name: string;
  /** Hours of class. */
  classes: number;
  /** Hours of commitments that meet on this day. */
  commitments: number;
  /** Hours of your own appointments. */
  appointments: number;
  /** Deadlines falling on this day and not yet ticked. */
  due: DatedItem[];
  /** Every promised hour on this day. */
  promised: number;
}

export interface Week {
  days: Day[];
  /** Hours already promised across the week. */
  promised: number;
  /** Deadlines in the week, soonest first. */
  due: DatedItem[];
  /** The busiest day, by promised hours. */
  heaviest: Day | null;
  /** The day with the most room, ignoring days with a deadline on them. */
  freest: Day | null;
  /** Waking hours in a week, less what is promised. */
  spare: number;
}

/** Hours a person is actually awake and available in a week. */
const WAKING = 16 * 7;

const SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function minutesOfBlocks(blocks: { time: string; minutes?: number }[]): number {
  // A class block states a time and not a length; fifty minutes is the
  // ordinary teaching hour and the honest approximation for one.
  return blocks.reduce((n, b) => n + (b.minutes ?? 50), 0);
}

function round(n: number): number {
  return Math.round(n * 10) / 10;
}

export interface WeekInput {
  catalog: Catalog;
  from: Date;
  done: DoneMap;
  commitments: Commitment[];
  appointments: Appointment[];
}

/**
 * Seven days from `from`, counted.
 *
 * Starts from the day given rather than from Monday, because the question is
 * "the next seven days" and a Thursday-afternoon look at a week that begins
 * three days ago is a week you cannot do anything about.
 */
export function week(input: WeekInput): Week {
  const { catalog, from, done } = input;
  const start = new Date(from.getFullYear(), from.getMonth(), from.getDate());
  const end = new Date(start.getFullYear(), start.getMonth(), start.getDate() + 7);

  const dated = catalog.items
    .map((i) => decorateItem(i, from))
    .filter((i) => !done[i.id] && i.date >= start && i.date < end)
    .sort((a, b) => a.date.getTime() - b.date.getTime());

  const days: Day[] = [];
  for (let n = 0; n < 7; n++) {
    const date = new Date(start.getFullYear(), start.getMonth(), start.getDate() + n);
    const classes = minutesOfBlocks(blocksFor(catalog, date).filter((b) => !b.canceled)) / 60;
    const commitments = minutesOfBlocks(blocksOn(input.commitments, date)) / 60;

    const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(
      date.getDate(),
    ).padStart(2, '0')}`;
    // An appointment has a start and no end, same as a class. An hour is the
    // ordinary length of one and the same honest approximation.
    const appointments = input.appointments.filter((a) => a.date === key).length;

    const due = dated.filter(
      (i) =>
        i.date.getFullYear() === date.getFullYear() &&
        i.date.getMonth() === date.getMonth() &&
        i.date.getDate() === date.getDate(),
    );

    days.push({
      date,
      name: SHORT[date.getDay()],
      classes: round(classes),
      commitments: round(commitments),
      appointments,
      due,
      promised: round(classes + commitments + appointments),
    });
  }

  const promised = round(days.reduce((n, d) => n + d.promised, 0));

  const heaviest = days.reduce<Day | null>(
    (best, d) => (best === null || d.promised > best.promised ? d : best),
    null,
  );
  // The freest day is only useful if you could actually work on it, so a day
  // that already has a deadline on it is not offered as room.
  const open = days.filter((d) => d.due.length === 0);
  const freest = open.reduce<Day | null>(
    (best, d) => (best === null || d.promised < best.promised ? d : best),
    null,
  );

  return {
    days,
    promised,
    due: dated,
    heaviest: heaviest && heaviest.promised > 0 ? heaviest : null,
    freest,
    spare: round(WAKING - promised),
  };
}

/**
 * Study time the syllabi themselves ask for, over a week.
 *
 * Read from each course's `planMinutes` — the time-box the Study screen
 * already uses for tonight's plan — rather than invented. A course that
 * states nothing contributes nothing, and the caller is told how many did so
 * the figure is never mistaken for the whole picture.
 */
export function studyAsked(catalog: Catalog): { hours: number; stated: number; total: number } {
  let minutes = 0;
  let stated = 0;
  for (const mod of catalog.modules) {
    const n = Number.parseInt(mod.planMinutes ?? '', 10);
    if (Number.isFinite(n) && n > 0) {
      minutes += n;
      stated++;
    }
  }
  // planMinutes is a nightly box, so a week of it is seven.
  return { hours: round((minutes * 7) / 60), stated, total: catalog.modules.length };
}

/** The headline. Counts, never a verdict on whether you will cope. */
export function headline(w: Week): string {
  if (w.promised === 0 && w.due.length === 0) {
    return 'Nothing scheduled and nothing due in the next seven days.';
  }
  const bits: string[] = [];
  if (w.promised > 0) bits.push(`${showHours(w.promised)} already promised`);
  if (w.due.length > 0) {
    bits.push(`${w.due.length} ${w.due.length === 1 ? 'deadline' : 'deadlines'}`);
  }
  return `${bits.join(', ')} in the next seven days.`;
}

/**
 * Where the pressure is, in a sentence.
 *
 * Two claims and both are arithmetic: the day carrying most, and the day with
 * room that has nothing due on it. No advice about what to do with either —
 * the app does not know how long your paper takes and saying so would be
 * inventing the only number that matters.
 */
export function pressure(w: Week): string {
  // Nothing promised anywhere means every day is clear, and singling one out
  // reads as though the others are not.
  if (w.promised === 0) return '';
  const parts: string[] = [];
  if (w.heaviest) {
    parts.push(`${w.heaviest.name} carries most of it, at ${showHours(w.heaviest.promised)}`);
  }
  if (w.freest && w.freest !== w.heaviest) {
    parts.push(
      w.freest.promised === 0
        ? `${w.freest.name} is clear`
        : `${w.freest.name} has the most room, at ${showHours(w.freest.promised)}`,
    );
  }
  return parts.length ? `${parts.join('; ')}.` : '';
}

/** Hours, said the way a person says them. */
export function showHours(n: number): string {
  if (n === 0) return 'nothing';
  if (n < 1) return `${Math.round(n * 60)} min`;
  const rounded = Math.round(n * 10) / 10;
  const whole = Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
  return `${whole} ${rounded === 1 ? 'hour' : 'hours'}`;
}
