/**
 * The days a look-ahead covers, as calendar days.
 *
 * Pure date arithmetic on `YYYY-MM-DD`, done in UTC so a time zone, or a clock
 * change on one of the days, cannot move a day: the 10th is the day after the
 * 9th in Chicago and in Kiritimati alike. "Today" is the caller's, from a `Clock`.
 */

const pad = (n: number): string => String(n).padStart(2, '0');

/** `day` moved by `by` days (negative goes back), across months, years and leap days. */
export function addDays(day: string, by: number): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(day);
  if (!m) throw new Error(`"${day}" is not a day`);
  const moved = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]) + by));
  return `${moved.getUTCFullYear()}-${pad(moved.getUTCMonth() + 1)}-${pad(moved.getUTCDate())}`;
}

/** How far ahead a look-ahead may reach. A month is more than any screen asks for, and bounds the work a caller can request. */
export const MAX_HORIZON_DAYS = 31;

/** `from` and the `count - 1` days after it, in order. */
export function daysFrom(from: string, count: number): string[] {
  return Array.from({ length: count }, (_, i) => addDays(from, i));
}
