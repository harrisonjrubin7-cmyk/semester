/**
 * Time, as something a domain is handed rather than something it reaches for.
 *
 * `Date.now()` inside a rule is a rule nobody can test twice: the answer moves,
 * and so does the day the person thinks it is. The suite runs in three time
 * zones (`npm run test:zones`) because of exactly that. A domain therefore never
 * reads the clock; it is given one, and the only implementation that reads the
 * real one is `systemClock`, below, which the architecture test lets be the
 * single exception.
 *
 * `local()` is the person's wall clock — the day and minute they are living in —
 * because "due today" is a statement about their day, not about UTC.
 */

/** `YYYY-MM-DD`, the same shape `PersonalTask.date` is stored in. */
export type IsoDate = string;

export const ISO_DATE = /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/;

/** Whether `value` names a real calendar day, not merely a well-shaped string. */
export function isIsoDate(value: unknown): value is IsoDate {
  if (typeof value !== 'string' || !ISO_DATE.test(value)) return false;
  const [y, m, d] = value.split('-').map(Number);
  const probe = new Date(Date.UTC(y, m - 1, d));
  return probe.getUTCFullYear() === y && probe.getUTCMonth() === m - 1 && probe.getUTCDate() === d;
}

export interface LocalMoment {
  day: IsoDate;
  /** Minutes past local midnight, 0–1439. */
  minutes: number;
}

export interface Clock {
  /** Epoch milliseconds, for stamping when something happened. */
  now(): number;
  /** The person's own day and minute. */
  local(): LocalMoment;
}

const two = (n: number) => String(n).padStart(2, '0');

export const systemClock: Clock = {
  now: () => Date.now(),
  local() {
    const d = new Date();
    return { day: `${d.getFullYear()}-${two(d.getMonth() + 1)}-${two(d.getDate())}`, minutes: d.getHours() * 60 + d.getMinutes() };
  },
};

/** A clock that stands still, for tests and for rendering a day at a given moment. */
export function fixedClock(day: IsoDate, minutes = 0, at = 0): Clock {
  return { now: () => at, local: () => ({ day, minutes }) };
}

/** Add whole days to an ISO date, in calendar terms (no time zone is involved). */
export function addDays(day: IsoDate, days: number): IsoDate {
  const [y, m, d] = day.split('-').map(Number);
  const next = new Date(Date.UTC(y, m - 1, d + days));
  return `${next.getUTCFullYear()}-${two(next.getUTCMonth() + 1)}-${two(next.getUTCDate())}`;
}

/** Whole days from `a` to `b`; negative when `b` is earlier. */
export function daysBetween(a: IsoDate, b: IsoDate): number {
  const [ay, am, ad] = a.split('-').map(Number);
  const [by, bm, bd] = b.split('-').map(Number);
  return Math.round((Date.UTC(by, bm - 1, bd) - Date.UTC(ay, am - 1, ad)) / 86_400_000);
}
