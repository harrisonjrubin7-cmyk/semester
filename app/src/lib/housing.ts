/**
 * Where you live, and the two sums the housing portal never does.
 *
 * StarRez holds a room assignment, a selection timeslot and a move-out rule.
 * It states each of them and stops, which is the same shape of omission as
 * the balance page: the facts are there and the arithmetic on them is left to
 * a student at eleven at night.
 *
 * Two sums are worth doing, and this file does both.
 *
 * ## Move-out, against the exam schedule
 *
 * Housing states move-out as a fixed date or as a number of hours after your
 * last exam. The app is the only thing on the phone that knows when your last
 * exam is, so it is the only thing that can turn "24 hours after your last
 * final" into a date — and then say how many exams stand between now and it.
 * Three exams in the four days before you have to be out of the building is
 * the December every first-year has, and it is knowable in September.
 *
 * ## The first walk of the day
 *
 * `lib/rooms.ts` measures the walk between two classes and `lib/gap.ts` uses
 * it. Neither can say anything about the first class of the day, because
 * until now the app had no reason to think you were anywhere before it — you
 * could have been in bed, in the library, or at breakfast. A residence hall
 * is the missing origin, and with it the app can say what time to leave.
 *
 * ## Entered, not fetched
 *
 * StarRez is behind single sign-on and publishes no interface a student can
 * use, so reading it would mean holding your university credentials — which
 * this app will never do. Your hall and your move-out rule are two fields you
 * fill in once a year.
 */

import { dateToIso, isoToDate, daysBetween } from './date';
import { buildingOf, matchPlace, walkMinutes, PACE } from './rooms';
import { metresBetween, type SavedPlace } from './place';

export interface Residence {
  id: string;
  /** The building, as housing names it — "Branscomb Vaughn". */
  hall: string;
  /** Room number, exactly as assigned. May be empty. */
  room: string;
  term: string;
  /** Move-out as a fixed date, ISO. Empty when it is stated against exams. */
  moveOut: string;
  /**
   * Hours after your last exam, where housing states it that way.
   *
   * Zero means not used. Twenty-four is the common one and is still a rule
   * rather than a date until something knows your exam schedule.
   */
  hoursAfterLastExam: number;
  created: number;
}

/** The residences filed against a term, newest first. */
export function forTerm(list: Residence[], term: string): Residence[] {
  return list.filter((r) => r.term === term).sort((a, b) => b.created - a.created);
}

/** Where you live this term, or null. */
export function current(list: Residence[], term: string): Residence | null {
  return forTerm(list, term)[0] ?? null;
}

/** "Branscomb Vaughn 214", or just the hall. */
export function homeLine(r: Residence | null): string {
  if (!r) return '';
  return r.room.trim() ? `${r.hall.trim()} ${r.room.trim()}` : r.hall.trim();
}

export interface MoveOut {
  date: Date;
  /** Whether housing named the date or the app worked it out from an exam. */
  from: 'stated' | 'exam';
  /** The exam it was counted from, where it was. */
  after: string;
}

/**
 * When you have to be out.
 *
 * A stated date wins over the rule, because a student who typed a date has
 * been told one and the rule is what you use when you have not. Counting from
 * an exam needs an exam: with no schedule the rule stays a rule, and the
 * screen says so rather than producing a date out of nothing.
 */
export function moveOutAt(
  r: Residence | null,
  lastExam: { title: string; date: Date } | null,
): MoveOut | null {
  if (!r) return null;
  if (r.moveOut.trim()) return { date: isoToDate(r.moveOut), from: 'stated', after: '' };
  if (r.hoursAfterLastExam > 0 && lastExam) {
    const date = new Date(lastExam.date.getTime() + r.hoursAfterLastExam * 3_600_000);
    return { date, from: 'exam', after: lastExam.title };
  }
  return null;
}

/** How the move-out date reads, and where it came from. */
export function moveOutLine(out: MoveOut | null, now: Date): string {
  if (!out) return 'No move-out date yet.';
  const days = daysBetween(now, out.date);
  const when =
    days < 0
      ? 'and it has been and gone'
      : days === 0
        ? 'which is today'
        : days === 1
          ? 'which is tomorrow'
          : `in ${days} days`;
  return out.from === 'stated'
    ? `Out by ${dateToIso(out.date)}, ${when}. That is the date housing gave you.`
    : `Out by ${dateToIso(out.date)}, ${when}. Counted from ${out.after}.`;
}

/**
 * How close a move-out has to be before it is worth a sentence.
 *
 * Three weeks is when exam dates and a move-out date start to be the same
 * problem. Before that they are two facts on two different screens, and
 * saying them together is just noise on the one screen you open first.
 */
const HORIZON = 21;

/**
 * What stands between now and the move-out date.
 *
 * The number people get wrong is not the date, it is how much is still owed
 * before it. Counted, never characterised — "a brutal week" is not something
 * the app is in a position to say about somebody it has never met.
 */
export function packLine(
  exams: { date: Date }[],
  out: MoveOut | null,
  now: Date,
  within = HORIZON,
): string {
  if (!out) return '';
  const days = daysBetween(now, out.date);
  // "6 exams in the 101 days before you have to be out" is arithmetic nobody
  // asked for. The sentence only means anything once the two are close enough
  // that one crowds the other, which is the last three weeks of term.
  if (days < 0 || days > within) return '';
  const between = exams.filter((e) => e.date >= now && e.date <= out.date).length;
  if (between === 0) return `Nothing else is due before you have to be out.`;
  return `${between} ${between === 1 ? 'exam' : 'exams'} in the ${days} ${days === 1 ? 'day' : 'days'} before you have to be out.`;
}

/**
 * The walk from where you live to where you have to be.
 *
 * Only where you have named both places on the map. A hall you have not saved
 * produces nothing rather than a guess, which is the same rule the rest of
 * the walking arithmetic follows.
 */
export function homeWalk(
  r: Residence | null,
  room: string,
  places: SavedPlace[],
): { minutes: number; known: boolean } {
  if (!r || !r.hall.trim() || !room.trim()) return { minutes: 0, known: false };
  const a = buildingOf(r.hall);
  const b = buildingOf(room);
  if (!a || !b) return { minutes: 0, known: false };
  if (a.toLowerCase() === b.toLowerCase()) return { minutes: 0, known: true };
  const pa = matchPlace(r.hall, places);
  const pb = matchPlace(room, places);
  if (!pa || !pb) return { minutes: 0, known: false };
  return { minutes: walkMinutes(metresBetween(pa, pb)), known: true };
}

/** Minutes past midnight to set off, given when it starts and how far it is. */
export function leaveAt(startsAt: number, walk: number): number {
  return Math.max(0, startsAt - walk);
}

/**
 * "Leave Branscomb by 8:56 for a 9:05 in Furman."
 *
 * Empty whenever any part of it would be invented — no residence, no saved
 * places, or a hall and a classroom the app cannot place.
 */
export function morningLine(
  r: Residence | null,
  next: { title: string; room: string; at: number } | null,
  places: SavedPlace[],
  clockOf: (minutes: number) => string,
): string {
  if (!r || !next) return '';
  const walk = homeWalk(r, next.room, places);
  if (!walk.known || walk.minutes === 0) return '';
  return `Leave ${buildingOf(r.hall)} by ${clockOf(leaveAt(next.at, walk.minutes))} for ${next.title} — ${walk.minutes} ${walk.minutes === 1 ? 'minute' : 'minutes'} at ${PACE} m a minute.`;
}

/** Whether a move-out is close enough to be worth saying on Today. */
export function moveOutSoon(out: MoveOut | null, now: Date, within = HORIZON): boolean {
  if (!out) return false;
  const days = daysBetween(now, out.date);
  return days >= 0 && days <= within;
}
