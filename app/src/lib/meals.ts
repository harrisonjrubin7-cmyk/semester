/**
 * Meal swipes and Commodore Cash, which run out in week eleven.
 *
 * CBORD GET shows a student a balance. It does not tell them what the balance
 * means, which is the only thing anybody actually wants to know: forty-one
 * swipes and twenty-three days left is 1.8 a day, and if you have been eating
 * 2.4 you run dry on the 14th of November. That arithmetic is four lines and
 * nobody does it in their head, so people find out by being declined at a
 * register in the last fortnight of term.
 *
 * ## Entered, never fetched — and this one is not a choice
 *
 * `get.cbord.com` is behind single sign-on and publishes no API a student can
 * use. There is nothing to read even in principle without holding somebody's
 * university credentials, which this app will never do. So the app links
 * straight to the balance page, and you type the two numbers back. That is
 * ten seconds once a week and it buys the whole of this file.
 *
 * The same reasoning as `lib/cost.ts` and `lib/registrar.ts`: where the app
 * cannot read a thing, it asks rather than inventing, and says which it is
 * doing.
 *
 * ## What it refuses to do
 *
 * No advice about eating. The app reports a rate and a date and stops — it
 * has no idea whether you are eating out, at home, or skipping meals because
 * of money, and a nudge about any of those would be both wrong and none of
 * its business.
 */

import { money, readMoney } from './cost';

export interface Balance {
  id: string;
  /** When you read these numbers off the site, epoch ms. */
  at: number;
  /** Meal swipes left on the board plan. -1 when the plan has none. */
  swipes: number;
  /** Commodore Cash, in cents. */
  cashCents: number;
  /** Meal money / dining dollars, in cents. -1 when the plan has none. */
  diningCents: number;
  term: string;
}

/** A swipe count somebody typed. Refuses rather than guessing at zero. */
export function readSwipes(text: string): number | null {
  const cleaned = text.trim().replace(/[,\s]/g, '');
  if (!cleaned) return null;
  if (!/^\d{1,4}$/.test(cleaned)) return null;
  return Number(cleaned);
}

export { money, readMoney };

/** Whole days between two dates, ignoring the time of day. */
function daysBetween(from: Date, to: Date): number {
  const a = new Date(from.getFullYear(), from.getMonth(), from.getDate()).getTime();
  const b = new Date(to.getFullYear(), to.getMonth(), to.getDate()).getTime();
  return Math.round((b - a) / 86_400_000);
}

export interface Pace {
  /** Days from now to the end of the term. */
  daysLeft: number;
  /** Swipes a day the remaining balance allows. */
  allowance: number;
  /** Swipes a day you have actually been using, from two readings. */
  rate: number;
  /** Whether there are two readings to compute a rate from. */
  known: boolean;
  /** The day the swipes run out at the current rate. Null when they do not. */
  dry: Date | null;
}

/**
 * What the balance means, given how long is left.
 *
 * The rate comes from two readings rather than from one: a single balance is
 * a fact about today and says nothing about consumption. Two readings a week
 * apart say everything, which is why the screen asks you to log rather than
 * to overwrite.
 */
export function pace(
  readings: Balance[],
  termEnds: Date | null,
  now: Date,
): Pace {
  const sorted = [...readings].sort((a, b) => a.at - b.at);
  const latest = sorted[sorted.length - 1];
  const daysLeft = termEnds ? Math.max(0, daysBetween(now, termEnds)) : 0;

  if (!latest || latest.swipes < 0) {
    return { daysLeft, allowance: 0, rate: 0, known: false, dry: null };
  }

  const allowance = daysLeft > 0 ? latest.swipes / daysLeft : 0;

  // Two readings far enough apart to mean something. A day apart is noise —
  // one heavy Saturday would read as a habit.
  const earlier = sorted.find(
    (r) => r !== latest && r.swipes >= 0 && daysBetween(new Date(r.at), new Date(latest.at)) >= 3,
  );
  if (!earlier) {
    return { daysLeft, allowance: round(allowance), rate: 0, known: false, dry: null };
  }

  const span = daysBetween(new Date(earlier.at), new Date(latest.at));
  const used = earlier.swipes - latest.swipes;
  if (span <= 0 || used <= 0) {
    return { daysLeft, allowance: round(allowance), rate: 0, known: false, dry: null };
  }

  const rate = used / span;
  const daysOfSwipes = Math.floor(latest.swipes / rate);
  const dry = new Date(now.getFullYear(), now.getMonth(), now.getDate() + daysOfSwipes);

  return {
    daysLeft,
    allowance: round(allowance),
    rate: round(rate),
    known: true,
    dry: termEnds && daysOfSwipes >= daysLeft ? null : dry,
  };
}

function round(n: number): number {
  return Math.round(n * 10) / 10;
}

/**
 * The sentence the balance earns.
 *
 * Two clauses: what you have per day, and what you have been using per day.
 * Where there is only one reading it says so and asks for another, rather
 * than presenting an allowance as though it were a forecast.
 */
export function paceLine(latest: Balance | undefined, p: Pace): string {
  if (!latest) return 'Nothing logged yet.';
  if (latest.swipes < 0) return 'No board plan logged — only the cash balances.';
  if (p.daysLeft === 0) {
    return `${latest.swipes} swipes left. Set the term's last day under Term deadlines and the app can say what that is a day.`;
  }
  const head = `${latest.swipes} swipes across ${p.daysLeft} days — ${p.allowance} a day.`;
  if (!p.known) {
    return `${head} Log the balance again in a few days and the app can say whether that is the rate you are actually eating at.`;
  }
  if (!p.dry) {
    return `${head} You have been using ${p.rate} a day, which lasts the term.`;
  }
  return `${head} You have been using ${p.rate} a day, which runs out on ${dayLabel(p.dry)}.`;
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export function dayLabel(d: Date): string {
  return `${MONTHS[d.getMonth()]} ${d.getDate()}`;
}

/** What the cash halves come to, said once. */
export function cashLine(latest: Balance | undefined): string {
  if (!latest) return '';
  const bits: string[] = [];
  if (latest.cashCents > 0) bits.push(`${money(latest.cashCents)} Commodore Cash`);
  if (latest.diningCents >= 0) bits.push(`${money(latest.diningCents)} meal money`);
  return bits.join(' · ');
}

/** One term's readings, newest first. */
export function forTerm(readings: Balance[], term: string): Balance[] {
  return readings.filter((r) => r.term === term).sort((a, b) => b.at - a.at);
}

/** How stale the latest reading is, so nobody plans against a fortnight ago. */
export function staleLine(latest: Balance | undefined, now: Date): string {
  if (!latest) return '';
  const days = daysBetween(new Date(latest.at), now);
  if (days <= 0) return 'Read today.';
  if (days === 1) return 'Read yesterday.';
  if (days <= 7) return `Read ${days} days ago.`;
  return `Read ${days} days ago — worth checking the site again before planning against it.`;
}
