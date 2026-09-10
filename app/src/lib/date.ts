import type { DatedEvent, DatedItem, CampusEvent, Item } from './types';
import { dueMinutes } from './duetime';

/**
 * The year the app shipped configured for.
 *
 * Every date used to be read against this, which made the whole app a Fall
 * 2026 app. It is now only a fallback, for an item saved before courses
 * carried a term — see `lib/term.ts`, and `LEGACY_TERM` there, which is the
 * same claim said the other way round.
 */
export const SEMESTER_YEAR = 2026;

export const MONTHS = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
];

export const DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export const DOW_INITIALS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

/**
 * YYYY-MM-DD in local time.
 *
 * Deliberately not `toISOString()`, which converts to UTC first and so lands on
 * the wrong day for anyone west of Greenwich after their evening.
 */
/**
 * A date, or nothing — where `new Date(y, m, d)` would invent one.
 *
 * `new Date(2026, 1, 31)` does not refuse 31 February. It silently returns
 * 3 March, and every check of the form "is the day between 1 and 31" passes
 * it through: 31 is a day in October and is not one in April, and a bare
 * range test cannot tell the difference.
 *
 * That matters most for the one input here that comes from a server the
 * student does not control and is refetched without them asking. A malformed
 * `DTSTART` in a subscribed calendar, measured one at a time against the real
 * parser:
 *
 *     20260231  ->  3 March 2026          20260001  ->  1 December 2025
 *     20261345  ->  14 February 2027      20260900  ->  31 August 2026
 *     00000101  ->  1 January 1900        T990000Z  ->  the 18th, at 3:00a
 *
 * Each was drawn beside the real classes, in the same colour, with nothing to
 * say it was invented — and because the feed is refetched, a bad row comes
 * back on the next refresh rather than being a one-off somebody can correct.
 *
 * The check is to build the date and read it back through its own getters. A
 * range test cannot be written correctly without a month-length table, and a
 * month-length table has to know about leap years, which is the arithmetic
 * `Date` already does.
 *
 * `utc` reads it back through the UTC getters instead, for a stamp that said
 * `Z`. Reading a UTC stamp back locally would refuse every correct feed either
 * side of Greenwich.
 *
 * The two-digit-year trap is caught here too, and it is the one a range test
 * cannot reach at all: `new Date(26, 0, 1)` is 1926, because `Date` maps 0–99
 * into the 1900s. The year is compared to what was asked for, so 0026 is
 * refused rather than quietly becoming 1926.
 */
export function realDate(
  year: number,
  month: number,
  day: number,
  time?: { hours: number; minutes: number; seconds: number },
  utc = false,
): Date | null {
  const { hours = 0, minutes = 0, seconds = 0 } = time ?? {};
  if (![year, month, day, hours, minutes, seconds].every(Number.isInteger)) return null;
  const d = utc
    ? new Date(Date.UTC(year, month - 1, day, hours, minutes, seconds))
    : new Date(year, month - 1, day, hours, minutes, seconds);
  if (Number.isNaN(d.getTime())) return null;
  const got = utc
    ? [d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate(), d.getUTCHours(), d.getUTCMinutes(), d.getUTCSeconds()]
    : [d.getFullYear(), d.getMonth() + 1, d.getDate(), d.getHours(), d.getMinutes(), d.getSeconds()];
  const asked = [year, month, day, hours, minutes, seconds];
  /*
   * A date with no time on it is not asking about any hour, and must not be
   * refused because the hour it happened to be built at was skipped.
   *
   * Havana springs forward at midnight: on 8 March 2026 the clock goes from
   * 23:59 to 01:00, so `new Date(2026, 2, 8)` is one in the morning and its
   * `getHours()` is 1. Comparing all six fields refused that date — a real
   * day, on the one day a year its own timezone skips the hour this builds
   * at. Santiago does the same on 6 September. `lib/capture.ts` then read
   * "March 8" as the *next* year, because this year's had been declared not
   * to exist.
   *
   * The calendar fields are still exact, so the date is still checked: only
   * the clock is left out of a question that never mentioned one. A stated
   * time keeps all six, because a caller asking about 00:30 on a night the
   * clock skipped it is owed the answer that the hour did not happen.
   *
   * Neither zone the suite runs in has a midnight transition — Chicago moves
   * at two and Kiritimati does not move — so `realdate.test.ts` names a third
   * for this, and asserts the zone took before asserting anything about it.
   */
  const fields = time ? 6 : 3;
  return got.slice(0, fields).every((n, i) => n === asked[i]) ? d : null;
}

/**
 * Whether a month and a day are a day that exists, with no year to go on.
 *
 * Six files store a date as `{ month, day }` and let the term decide the year
 * later, so `realDate` cannot be used on them — and all six checked the day
 * was between 1 and 31. 31 is a day in October and is not one in April, and a
 * bare range test cannot tell the difference: "April 31" was accepted, and
 * `new Date(2026, 3, 31)` then drew it as 1 May, under a heading, in a list,
 * beside the dates that were real.
 *
 * February is 29 here rather than 28. The year genuinely is not known yet —
 * `readTerm` settles it downstream — and refusing 29 February outright would
 * throw away a real date in every leap year to catch a wrong one in three
 * years out of four. The permissive bound is the right way round: this is the
 * check that a day *can* exist, and `realDate` is the check that it does.
 *
 * `month` is 0-based, as every caller of this already holds it.
 */
export function realMonthDay(month: number, day: number): boolean {
  if (!Number.isInteger(month) || !Number.isInteger(day)) return false;
  if (month < 0 || month > 11) return false;
  const LENGTHS = [31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  return day >= 1 && day <= LENGTHS[month];
}

export function dateToIso(d: Date): string {
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${m}-${day}`;
}

/** The inverse — parsed as a local date, not UTC midnight. */
export function isoToDate(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, (m ?? 1) - 1, d ?? 1);
}

/**
 * The same date, `days` later — or earlier, for a negative number.
 *
 * Done by round-tripping through a Date rather than by arithmetic on the
 * string, so month ends, leap days and the year boundary are the calendar's
 * problem and not this function's. Adding a day to 2026-02-28 has exactly one
 * right answer and it is not 2026-02-29.
 */
export function shiftIso(iso: string, days: number): string {
  const d = isoToDate(iso);
  d.setDate(d.getDate() + days);
  return dateToIso(d);
}

/** Midnight on the day `d` falls in — the unit every comparison here works in. */
export function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

/**
 * The same midnight, as a timestamp, for the callers that hold one.
 *
 * `lib/everything.ts` and `state/slices/navigate.ts` had written this out,
 * identically, because the version above takes and returns a `Date` and they
 * hold numbers. They record and compare the *day* a screen was last opened,
 * so a screen opened twice in one evening counts once — and two copies of
 * "what day is this timestamp on" is two places for a timezone to be got
 * wrong, in code whose whole job is a local calendar day.
 */
export function dayOf(at: number): number {
  return startOfDay(new Date(at)).getTime();
}

/**
 * How far a date moved, in words: "7 days later", "1 day earlier".
 *
 * One sentence, two callers. `lib/reconcile.ts` compares the app against a
 * subscribed calendar and `lib/rediff.ts` compares one syllabus against the
 * next, and each had written this out against its own `Moved` — same words,
 * same singular, same sign convention, two functions. The two `Moved` types
 * are genuinely different records and stay that way; the phrase is not.
 *
 * Positive is later. A caller with the sign the other way round should negate
 * it rather than teach this two conventions.
 */
export function movedLine(days: number): string {
  const size = Math.abs(days);
  const unit = size === 1 ? 'day' : 'days';
  return days > 0 ? `${size} ${unit} later` : `${size} ${unit} earlier`;
}

export function sameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

/** Whole days from `from` to `to`, ignoring time of day. Negative = past. */
export function daysBetween(from: Date, to: Date): number {
  const ms = startOfDay(to).getTime() - startOfDay(from).getTime();
  return Math.round(ms / 86_400_000);
}

/** "Fri Sep 4" */
export function longLabel(d: Date): string {
  return `${DOW[d.getDay()]} ${MONTHS[d.getMonth()]} ${d.getDate()}`;
}

/**
 * The relative due label the Today screen and item rows show.
 *
 * The prototype hard-coded these strings against Thursday Sep 3. Here they are
 * derived, so "Today" always means today. An 11:59 PM deadline that lands today
 * reads "Tonight", which is how the design worded it.
 */
export function dueLabel(date: Date, now: Date, dueTime: string): string {
  const away = daysBetween(now, date);
  if (away === 0) return /11:59|midnight/i.test(dueTime) ? 'Tonight' : 'Today';
  if (away === 1) return 'Tomorrow';
  if (away === -1) return 'Yesterday';
  if (away < 0) return longLabel(date);
  return longLabel(date);
}

export function decorateItem(item: Item, now: Date): DatedItem {
  // The year is stamped on at catalogue-build time from the course's term.
  // An item from before terms existed has none and reads as Fall 2026, which
  // is what its dates actually are.
  const date = new Date(item.year ?? SEMESTER_YEAR, item.month, item.day);
  const away = daysBetween(now, date);
  return {
    ...item,
    date,
    dueShort: dueLabel(date, now, item.dueTime),
    dow: DOW[date.getDay()],
    mon: MONTHS[date.getMonth()],
    isToday: away === 0,
    isPast: away < 0,
    daysAway: away,
    // The clock inside "Before class, 1:15p", where there is one. Untimed
    // wordings sort to the end of their day rather than the start — see
    // `lib/duetime.ts`.
    dueAt: dueMinutes(item.dueTime),
  };
}

export function decorateEvent(event: CampusEvent, now: Date): DatedEvent {
  const date = new Date(SEMESTER_YEAR, event.month, event.day);
  return {
    ...event,
    date,
    mon: MONTHS[date.getMonth()],
    dow: DOW[date.getDay()],
    isPast: daysBetween(now, date) < 0,
  };
}

/** "in 1 hr 19 min" — the countdown on the next-class card. */
export function untilLabel(minutes: number): string {
  if (minutes <= 0) return 'now';
  if (minutes < 60) return `in ${minutes} min`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m === 0 ? `in ${h} hr` : `in ${h} hr ${m} min`;
}

export function minutesNow(now: Date): number {
  return now.getHours() * 60 + now.getMinutes();
}

/** "9:05a" / "11:00a" / "2:45p" — the prototype's clock format. */
export function clock(minutes: number): string {
  const h24 = Math.floor(minutes / 60);
  const m = minutes % 60;
  const h = h24 % 12 === 0 ? 12 : h24 % 12;
  return `${h}:${String(m).padStart(2, '0')}${h24 < 12 ? 'a' : 'p'}`;
}

/** The days of a month grid, Sunday-first, padded to whole weeks. */
export function monthGrid(year: number, month: number): (number | null)[] {
  const lead = new Date(year, month, 1).getDay();
  const length = new Date(year, month + 1, 0).getDate();
  const cells: (number | null)[] = [];
  for (let i = 0; i < lead; i++) cells.push(null);
  for (let d = 1; d <= length; d++) cells.push(d);
  while (cells.length % 7 !== 0) cells.push(null);
  return cells;
}
