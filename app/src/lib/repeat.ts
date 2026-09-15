/**
 * Something that happens again.
 *
 * The one thing every calendar has had since 1990 and this one did not. A
 * Tuesday shift, a Wednesday society meeting, a standing hour with a tutor —
 * each of them was fifteen separate appointments, added one at a time, and
 * moving the shift an hour later meant editing fifteen rows. Measured against
 * the four courses this app ships with: a term is roughly sixty
 * appointments a student would have to type to record four standing
 * commitments.
 *
 * ## It always ends
 *
 * `until` is not optional. Google and Outlook both allow a series that never
 * stops, and both are right to: their calendars are the rest of your life.
 * This one is a semester, and a rule with no end is the one that is still
 * putting a shift on a Tuesday two years after the job finished — a mess
 * nobody notices until it is large. So a repeat names its last day, and the
 * screen defaults that to the end of the term.
 *
 * ## An occurrence is not a row
 *
 * A repeat is a rule on one stored appointment, expanded when a day is drawn.
 * Nothing writes fifteen rows to the store, and that is what makes moving the
 * shift an hour a single edit. The cost is the case every calendar has to
 * answer: what happens when you change *one* Tuesday. The answer here is
 * `except` — a list of dates the rule skips — plus, for a move, an ordinary
 * one-off appointment at the new time. That is what "this event" means in
 * Google's own dialog, and it keeps the store honest: what is on the screen
 * is either the rule or a row, never a half-detached third thing.
 */

import { isoToDate, shiftIso } from './date';

export type Every = 'daily' | 'weekdays' | 'weekly' | 'fortnightly' | 'monthly';

export interface Repeat {
  every: Every;
  /**
   * The last day an occurrence may fall on, inclusive.
   *
   * Required, for the reason at the top of this file. Empty or malformed is
   * read as "no occurrences after the first", which is the safe direction: a
   * broken rule shows one appointment rather than one a day for ever.
   */
  until: string;
  /**
   * Dates the rule skips — an occurrence deleted, or moved out of the series.
   *
   * ISO dates, and the same date twice is harmless. Absent on a series
   * nothing has been taken out of, which is most of them.
   */
  except?: string[];
}

export const EVERY: { id: Every; label: string; says: string }[] = [
  { id: 'daily', label: 'Every day', says: 'Including the weekend' },
  { id: 'weekdays', label: 'Every weekday', says: 'Monday to Friday' },
  { id: 'weekly', label: 'Every week', says: 'The same day each week' },
  { id: 'fortnightly', label: 'Every other week', says: 'Alternate weeks' },
  { id: 'monthly', label: 'Every month', says: 'The same date each month' },
];

export function everyNamed(id: Every): { id: Every; label: string; says: string } {
  return EVERY.find((e) => e.id === id) ?? EVERY[2];
}

/**
 * How far a repeat is allowed to run when the rule says nothing sensible.
 *
 * Two years of days. `occurrences` walks a day at a time, so this is what
 * stops a hand-edited backup with `until: "9999-12-31"` on a daily rule from
 * building a three-million-entry array on the main thread. It is far past any
 * answer this app has a use for, and being over it is a rule to fix rather
 * than a screen to hang.
 */
const FURTHEST = 730;

/** Whether an ISO date is one this can work with at all. */
function real(iso: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(iso) && !Number.isNaN(isoToDate(iso).getTime());
}

/**
 * Whether a series that began on `from` lands on `iso`.
 *
 * The first day always counts, rule or no rule — an appointment is on the day
 * you put it on, and a weekly repeat starting on a Tuesday that did not itself
 * happen on that Tuesday would be a rule that ate the thing it was describing.
 */
export function occursOn(from: string, repeat: Repeat | undefined, iso: string): boolean {
  if (iso === from) return true;
  if (!repeat || !real(from) || !real(iso)) return false;
  if (iso < from) return false;
  if (!real(repeat.until) || iso > repeat.until) return false;
  if (repeat.except?.includes(iso)) return false;

  const start = isoToDate(from);
  const day = isoToDate(iso);
  const days = Math.round((day.getTime() - start.getTime()) / 86_400_000);

  switch (repeat.every) {
    case 'daily':
      return true;
    case 'weekdays': {
      const dow = day.getDay();
      return dow !== 0 && dow !== 6;
    }
    case 'weekly':
      return days % 7 === 0;
    case 'fortnightly':
      return days % 14 === 0;
    /*
     * The same date each month, and a month that has no such date is skipped
     * rather than rolled forward.
     *
     * A rule made on the 31st landing on the 3rd of March is the shape of
     * wrong that nobody reads as a bug in the rule — they read it as the app
     * inventing an appointment. Skipping says less and says it truthfully.
     */
    case 'monthly':
      return day.getDate() === start.getDate();
    default:
      return false;
  }
}

/**
 * Every date in a window the series lands on, in order.
 *
 * Walks a day at a time rather than stepping by the rule, because four of the
 * five rules are not a fixed stride — `weekdays` skips two days out of seven
 * and `monthly` skips whole months — and a stride per rule is five pieces of
 * arithmetic where one loop does. The window is bounded by {@link FURTHEST},
 * and a calendar never asks for more than a few months at a time.
 */
export function occurrences(
  from: string,
  repeat: Repeat | undefined,
  fromIso: string,
  toIso: string,
): string[] {
  if (!real(from) || !real(fromIso) || !real(toIso) || toIso < fromIso) return [];
  const out: string[] = [];
  let at = fromIso < from ? from : fromIso;
  for (let n = 0; n <= FURTHEST && at <= toIso; n += 1) {
    if (occursOn(from, repeat, at)) out.push(at);
    at = shiftIso(at, 1);
  }
  return out;
}

/**
 * The next day the series lands on strictly after `iso`, or undefined when it
 * has run out.
 *
 * What a repeating *task* needs and a repeating appointment never did. An
 * appointment is drawn on whichever day is on screen, so the views ask
 * "does it land here"; a task sits on one date at a time and moves forward
 * when it is ticked, so it has to ask "and then when".
 *
 * Bounded by {@link FURTHEST} through `occurrences`, and `until` bounds it
 * sooner in every real case — a rule always names its last day.
 */
export function nextAfter(
  from: string,
  repeat: Repeat | undefined,
  iso: string,
): string | undefined {
  if (!repeat || !real(from) || !real(iso)) return undefined;
  // From the day after, to the day the rule stops. Both ends come out of the
  // rule rather than from a window a caller has to guess at.
  const [next] = occurrences(from, repeat, shiftIso(iso, 1), repeat.until);
  return next;
}

/** How many times it happens between two dates, which is what a count line says. */
export function howMany(from: string, repeat: Repeat | undefined, toIso: string): number {
  return occurrences(from, repeat, from, toIso).length;
}

/*
 * Written out rather than read off `lib/date.ts`'s `MONTHS`, which holds the
 * three-letter forms the grids use. A sentence wants the whole word.
 */
const MONTH_NAMES = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

/** The rule as a sentence — "Every week until 12 December". */
export function describe(repeat: Repeat | undefined): string {
  if (!repeat) return 'Once';
  const said = everyNamed(repeat.every).label;
  if (!real(repeat.until)) return said;
  const d = isoToDate(repeat.until);
  return `${said} until ${d.getDate()} ${MONTH_NAMES[d.getMonth()]}`;
}

/**
 * The same rule as an iCalendar `RRULE`, so a series exported from here
 * arrives in Google Calendar as one repeating event rather than as sixty.
 *
 * `UNTIL` is a date value rather than a UTC timestamp, which is the form that
 * agrees with a `DTSTART` written as a local wall clock — mixing the two is
 * the commonest way an exported series ends on the wrong day, and in the
 * direction that drops the last occurrence.
 *
 * `BYDAY=MO,TU,WE,TH,FR` rather than `FREQ=DAILY;INTERVAL=1` with a filter:
 * the weekday rule is a weekly one in iCalendar's vocabulary, and writing it
 * as a daily rule produces an event every day in every client.
 */
export function rrule(repeat: Repeat | undefined): string {
  if (!repeat || !real(repeat.until)) return '';
  const until = repeat.until.replace(/-/g, '');
  switch (repeat.every) {
    case 'daily':
      return `FREQ=DAILY;UNTIL=${until}`;
    case 'weekdays':
      return `FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR;UNTIL=${until}`;
    case 'weekly':
      return `FREQ=WEEKLY;UNTIL=${until}`;
    case 'fortnightly':
      return `FREQ=WEEKLY;INTERVAL=2;UNTIL=${until}`;
    case 'monthly':
      return `FREQ=MONTHLY;UNTIL=${until}`;
    default:
      return '';
  }
}

/** The same series with one date taken out of it. */
export function skip(repeat: Repeat | undefined, iso: string): Repeat | undefined {
  if (!repeat) return repeat;
  const was = repeat.except ?? [];
  return was.includes(iso) ? repeat : { ...repeat, except: [...was, iso].sort() };
}

/**
 * A sensible last day for a new repeat: the end of the term, or a term's
 * length from the day it starts when nothing knows about a term.
 *
 * Offered rather than imposed — the screen fills the field with it and the
 * person can change it. A default that is roughly right is what makes a
 * required field feel like a default rather than a question.
 */
export function defaultUntil(from: string, termEnds?: string): string {
  if (termEnds && real(termEnds) && termEnds > from) return termEnds;
  return real(from) ? shiftIso(from, 16 * 7) : from;
}
