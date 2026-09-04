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

/** Midnight on the day `d` falls in — the unit every comparison here works in. */
export function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
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

export function monthName(month: number): string {
  return MONTHS[month];
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
