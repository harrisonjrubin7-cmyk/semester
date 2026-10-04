/**
 * Time, as something a domain is handed rather than something it reaches for.
 *
 * `Date.now()` or `new Date()` appears in 176 legacy files (`npm run census:arch`).
 * Every one is a test that has to fake the global clock, and a rule that
 * cannot be checked in another time zone without `test:zones` re-running the
 * world. A domain that takes a `Clock` is a pure function of its inputs; the
 * composition root hands it `systemClock`, a test hands it `fixedClock`.
 *
 * Two questions, because they are not one: `now()` is an instant, and
 * `today()` is *the student's* calendar day — the one their deadlines are
 * written in. Deriving the second from the first needs a time zone, and the
 * rest of this app (`lib/date.ts`) answers it with the device's local one, so
 * that is what `systemClock` does.
 */
export interface Clock {
  /** Milliseconds since the epoch. */
  now(): number;
  /** The student's current calendar day, `YYYY-MM-DD`. */
  today(): string;
}

const pad = (n: number): string => String(n).padStart(2, '0');

/** The local calendar day of an instant, `YYYY-MM-DD`. */
export const localDay = (at: number): string => {
  const d = new Date(at);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};

export const systemClock: Clock = { now: () => Date.now(), today: () => localDay(Date.now()) };

/**
 * A clock stopped at `minutes` past local midnight on `day`.
 *
 * Built from a *day* rather than an instant so a test that says "Tuesday the
 * 8th" means Tuesday the 8th in Chicago and in Kiritimati alike — which is what
 * `npm run test:zones` checks, and what an instant written as a UTC literal
 * would quietly fail.
 */
export function fixedClock(day: string, minutes = 12 * 60): Clock {
  const [y, m, d] = day.split('-').map(Number);
  const at = new Date(y, m - 1, d, 0, minutes).getTime();
  return { now: () => at, today: () => day };
}
