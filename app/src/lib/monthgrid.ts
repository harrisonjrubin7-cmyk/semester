/**
 * Making the month grid mean something to somebody who cannot see it.
 *
 * The grid is forty-two buttons. To a screen reader they were called "1",
 * "2", "3" — no month, no weekday, no indication that a day held anything, and
 * no way to move between them but Tab, forty-two times. The colour of a dot
 * carried every fact the grid knew, and colour is exactly the channel that
 * does not survive being read aloud.
 *
 * So this file turns each cell into a sentence, and turns the arrow keys into
 * movement. Both are arithmetic rather than markup, which is why they are here
 * and testable rather than inline in the screen.
 *
 * ## The sentence
 *
 * "Tuesday 8 September. Today. 2 deadlines, 1 campus event."
 *
 * Weekday first because that is what somebody is looking for when they move
 * across a row. Then the standing of the day — today, or the one selected —
 * because it is the thing a sighted user gets from a border and a background.
 * Then what is on it, counted by kind and named in words rather than left to
 * a coloured square.
 *
 * ## Movement
 *
 * Arrows move within the month and stop at its edges rather than rolling into
 * the next one. Rolling over is the more familiar behaviour in a desktop date
 * picker, and it is the wrong one here: this grid is a month view rather than
 * a date field, the month is the thing being read, and silently leaving it
 * mid-row would be disorienting in exactly the case this is written for. Page
 * Up and Page Down change month, which is the deliberate version of the same
 * move.
 */

// The grid's words are the app's words: `lib/date.ts` owns both lists.
import { DAY_NAMES, MONTH_NAMES } from './date';

/** One thing sitting on a day, as the month grid already models it. */
export interface Mark {
  kind: string;
}

/**
 * What each kind of mark is called out loud, singular and plural.
 *
 * The grid draws these as coloured squares, circles and outlines, and the
 * legend under it explains the shapes. This is that legend in words, for
 * somebody who is getting neither.
 */
const SAYS: Record<string, [string, string]> = {
  due: ['deadline', 'deadlines'],
  mine: ['task of your own', 'tasks of your own'],
  appt: ['appointment', 'appointments'],
  event: ['campus event', 'campus events'],
  feed: ['course event', 'course events'],
  class: ['class', 'classes'],
};

/** "2 deadlines, 1 campus event" — or empty when the day holds nothing. */
export function marksLine(marks: Mark[]): string {
  const counts = new Map<string, number>();
  for (const m of marks) counts.set(m.kind, (counts.get(m.kind) ?? 0) + 1);

  const parts: string[] = [];
  // Fixed order rather than insertion order, so two days with the same
  // contents always read the same way round. Anything the grid learns to draw
  // later and this file has not been told about follows, under its own name:
  // a mark nobody can see and nobody is told about is the bug this whole file
  // exists to fix, and it should not come back by omission.
  const known = ['due', 'class', 'appt', 'mine', 'event', 'feed'];
  const order = [...known, ...[...counts.keys()].filter((k) => !known.includes(k)).sort()];

  for (const kind of order) {
    const n = counts.get(kind);
    if (!n) continue;
    const [one, many] = SAYS[kind] ?? [kind, kind];
    parts.push(`${n} ${n === 1 ? one : many}`);
  }
  return parts.join(', ');
}

/**
 * How many dots a phone-width cell draws before the numeral takes over.
 *
 * Three rather than the four it was, because the count now has to fit beside
 * them: at 402px a cell is about 57px wide, three 4px dots and their gaps are
 * 16px, and a two-digit numeral at `--type-xs` is about 13. Four dots and a
 * numeral do not fit on one line and wrapped the cell taller than its row.
 */
export const DOTS = 3;

/**
 * The numeral beside the dots, or null when there should not be one.
 *
 * The complaint this answers is that a day full of work and a day with one
 * reading drew the same unlabelled smear of colour. They did, and worse than
 * that: the cell drew at most four dots and said nothing about the rest, so
 * every day with four things or more was identical to every other. A week
 * with a nine-deadline Thursday in it looked exactly like a week without one.
 *
 * `dayLabel` has always said the whole of it out loud — "2 deadlines, 1
 * campus event" — so this is not new information, it is the same information
 * on the channel the sighted reader is actually using. That asymmetry is
 * worth naming: the screen reader has had the better version of this cell for
 * as long as `dayLabel` has existed.
 *
 * Null at zero and at one. Zero has nothing to count, and a "1" next to a
 * single dot is a numeral that tells you what you can already see — the dots
 * are the count while there are few enough of them to take in at a glance,
 * and the numeral is for when they stop being.
 */
export function dayCount(marks: Mark[]): number | null {
  return marks.length > 1 ? marks.length : null;
}

export interface DayStanding {
  /** The day is today. */
  today?: boolean;
  /** The day is the one currently open below the grid. */
  selected?: boolean;
}

/**
 * The whole sentence for one cell.
 *
 * `date` is a real Date so the weekday is derived rather than passed in and
 * able to disagree with it.
 */
export function dayLabel(date: Date, marks: Mark[], standing: DayStanding = {}): string {
  const head = `${DAY_NAMES[date.getDay()]} ${date.getDate()} ${MONTH_NAMES[date.getMonth()]}`;
  const bits = [head];
  // Today and selected are both true on most visits, and saying both is not
  // repetitive — one is where the calendar is, the other is where you are.
  if (standing.today) bits.push('Today');
  if (standing.selected) bits.push('Selected');
  const on = marksLine(marks);
  bits.push(on || 'Nothing on');
  return `${bits.join('. ')}.`;
}

/** How the month changes when movement runs off the end of it. */
export type Step = 'prev' | 'next' | null;

export interface Move {
  /** The day to land on, 1-based. Null means the month itself should change. */
  day: number | null;
  step: Step;
}

/**
 * Where an arrow key goes from `day`.
 *
 * Returns the day rather than moving anything, so the screen owns focus and
 * this owns the arithmetic. `null` for a key that is not movement, so the
 * caller knows not to swallow it.
 */
export function moveBy(
  key: string,
  day: number,
  daysInMonth: number,
  /**
   * Which weekday the 1st falls on, 0 for Sunday.
   *
   * Home and End move to the ends of the *row*, and a row only lines up with
   * days 1, 8, 15 when the month happens to begin on a Sunday. Without this
   * the first row is short and Home from the 6th walked back to the 1st —
   * across the fold, into the wrong week.
   */
  startsOn: number,
): Move | null {
  const clamp = (n: number): Move => ({ day: Math.min(daysInMonth, Math.max(1, n)), step: null });
  const weekday = (startsOn + day - 1) % 7;

  switch (key) {
    case 'ArrowLeft':
      return clamp(day - 1);
    case 'ArrowRight':
      return clamp(day + 1);
    case 'ArrowUp':
      return clamp(day - 7);
    case 'ArrowDown':
      return clamp(day + 7);
    // The row this day sits in, not the month — Home and End are row keys in
    // every grid pattern, and a whole month is what Page Up and Page Down do.
    case 'Home':
      return clamp(day - weekday);
    case 'End':
      return clamp(day + (6 - weekday));
    case 'PageUp':
      return { day: null, step: 'prev' };
    case 'PageDown':
      return { day: null, step: 'next' };
    default:
      return null;
  }
}

/** "September 2026", for the announcement when the month changes. */
export function monthLabel(year: number, month: number): string {
  return `${MONTH_NAMES[month]} ${year}`;
}
