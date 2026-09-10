/**
 * The university bill, and the aid that is supposed to cover it.
 *
 * The costs beside this file are the ones a student chooses: a textbook, an
 * access code, a lab fee. They are the small half. The large half is the
 * statement the university sends — tuition, fees, a room, a meal plan — and
 * the awards set against it, and that half is where the expensive mistakes
 * are. They are not arithmetic mistakes about cents. They are these four:
 *
 * 1. **Work-study counted as covering the bill.** It does not. A grant and a
 *    loan are credited against the statement before anybody pays anything;
 *    work-study is a job, paid to you in fortnightly instalments for hours
 *    you have worked. A student who subtracts it from what they owe is short
 *    by that amount on the due date, and finds out as a late fee.
 * 2. **Pending aid counted as confirmed.** An award conditional on a tax
 *    document is not money yet. Summing it into one "you owe" figure is
 *    exactly the thing this app refuses to do elsewhere — see `§ Two figures`.
 * 3. **A loan read as aid rather than as debt.** It does credit the bill, and
 *    it is also borrowed. Both are true and the screen says both.
 * 4. **A payment plan divided in the head.** Five instalments on $18,432.17
 *    is not a number anybody gets right, and the rounding matters: four parts
 *    of $3,686.43 leaves five cents unpaid and a balance that will not close.
 *
 * ## Entered, never fetched
 *
 * The same reasoning as `lib/cost.ts`, `lib/meals.ts` and `lib/registrar.ts`,
 * and here it is not a preference. A student account sits behind single sign-on
 * and publishes no API a student can use on their own; reading it would mean
 * holding somebody's university credentials, which this app will never do.
 * So the app links to the statement and holds the figures you read off it, and
 * does the arithmetic the statement does not.
 *
 * Nothing here is a payment. The app shows what is owed and when, and opens
 * the university's own payment page — it does not touch money, hold a card, or
 * store an account number.
 *
 * ## Two figures, never one
 *
 * `owed` reports what is owed on confirmed aid alone, and separately what
 * would be owed if the pending awards land. It never averages them into one
 * number, because the first is a bill and the second is a hope, and a screen
 * that blends them is the thing that makes a student trust neither.
 *
 * ## Cents, as integers
 *
 * Money is held in cents and never as a float, for the reason written out in
 * `lib/cost.ts`: a total out by a cent for no visible reason is what makes
 * somebody stop trusting every other number on the screen. `split` is built
 * around that promise — the instalments it returns sum to the balance exactly,
 * every time, for every number of parts.
 */

import { money, readMoney } from './cost';
import { dateToIso, daysBetween, isoToDate } from './date';

export type ChargeKind = 'tuition' | 'fees' | 'housing' | 'dining' | 'health' | 'other';
export type AidKind = 'grant' | 'scholarship' | 'loan' | 'work' | 'other';

export interface ChargeKindInfo {
  id: ChargeKind;
  label: string;
}

export const CHARGE_KINDS: ChargeKindInfo[] = [
  { id: 'tuition', label: 'Tuition' },
  { id: 'fees', label: 'Fees' },
  { id: 'housing', label: 'Housing' },
  { id: 'dining', label: 'Meal plan' },
  { id: 'health', label: 'Health insurance' },
  { id: 'other', label: 'Something else' },
];

export interface AidKindInfo {
  id: AidKind;
  label: string;
  /**
   * Whether it is credited against the statement, or paid to you.
   *
   * The whole point of this flag. Work-study is the one that is false, and it
   * is the one students subtract from the bill and should not.
   */
  credits: boolean;
  /** Whether it has to be paid back. */
  repaid: boolean;
}

export const AID_KINDS: AidKindInfo[] = [
  { id: 'grant', label: 'Grant', credits: true, repaid: false },
  { id: 'scholarship', label: 'Scholarship', credits: true, repaid: false },
  { id: 'loan', label: 'Loan', credits: true, repaid: true },
  { id: 'work', label: 'Work-study', credits: false, repaid: false },
  { id: 'other', label: 'Something else', credits: true, repaid: false },
];

export function chargeKindOf(id: string): ChargeKindInfo {
  return CHARGE_KINDS.find((k) => k.id === id) ?? CHARGE_KINDS[CHARGE_KINDS.length - 1];
}

export function aidKindOf(id: string): AidKindInfo {
  return AID_KINDS.find((k) => k.id === id) ?? AID_KINDS[AID_KINDS.length - 1];
}

/** A line off the statement. */
export interface Charge {
  id: string;
  term: string;
  /** What it is — "Tuition, 15 hours" or "Student activity fee". */
  what: string;
  kind: ChargeKind;
  /** Cents. Always an integer. */
  cents: number;
  at: number;
}

/** A line off the award letter. */
export interface Aid {
  id: string;
  term: string;
  what: string;
  kind: AidKind;
  cents: number;
  /**
   * Still conditional — on a tax document, a verification, a signature.
   *
   * Held rather than inferred. The app cannot know whether an award has
   * cleared, and guessing in either direction is worse than asking once.
   */
  pending: boolean;
  at: number;
}

/** Something you have actually paid, against this term. */
export interface Payment {
  id: string;
  term: string;
  what: string;
  cents: number;
  /** ISO date it was paid. */
  on: string;
  at: number;
}

/**
 * A payment plan, as the instalments the app derives rather than as dates
 * typed one at a time.
 *
 * `parts` of 0 or 1 means paying in full on `first`, which is the common case
 * and not a plan at all — the screen still holds the date, because the date is
 * the part with a late fee attached to it.
 */
export interface Plan {
  /** How many instalments. 1 means pay in full. */
  parts: number;
  /** ISO date the first instalment is due. Empty means not filled in. */
  first: string;
  /** Months between instalments. One is what every plan the author has seen uses. */
  everyMonths: number;
}

export function blankPlan(): Plan {
  return { parts: 1, first: '', everyMonths: 1 };
}

export interface Owed {
  /** Everything the university has charged, in cents. */
  chargesCents: number;
  /** Confirmed aid that is credited against the statement. */
  creditedCents: number;
  /** Aid that would be credited, but has not been confirmed yet. */
  pendingCents: number;
  /**
   * Work-study and anything else paid to you rather than to the statement.
   *
   * Reported so it is visible, and deliberately absent from every subtraction
   * below. Money you will earn is not money the bursar has.
   */
  earnedCents: number;
  /** How much of the credited aid is borrowed. A subset of `creditedCents`. */
  borrowedCents: number;
  /** Charges less confirmed credited aid. The bill as it stands today. */
  owedCents: number;
  /** What would be left if every pending award lands. Never averaged with the above. */
  bestCaseCents: number;
  /** How many lines the figures rest on. */
  charges: number;
  awards: number;
  /** Awards still conditional, so the screen can name them rather than total them. */
  unconfirmed: Aid[];
}

/** One term's worth of anything that carries a `term`. */
export function forTerm<T extends { term: string }>(rows: T[], term: string): T[] {
  return rows.filter((r) => r.term === term);
}

/**
 * What is owed, on confirmed aid and on hopeful aid, kept apart.
 *
 * A negative `owedCents` is a credit balance and means a refund is coming,
 * which is a real and common state — a student on full aid plus a loan is
 * owed money rather than owing it — so it is not clamped to zero here. The
 * clamping belongs to whatever asks "how much do I pay", not to the figure.
 */
export function owed(charges: Charge[], aid: Aid[]): Owed {
  const chargesCents = charges.reduce((n, c) => n + c.cents, 0);
  const credited = aid.filter((a) => aidKindOf(a.kind).credits);
  const creditedCents = credited.filter((a) => !a.pending).reduce((n, a) => n + a.cents, 0);
  const pendingCents = credited.filter((a) => a.pending).reduce((n, a) => n + a.cents, 0);
  const earnedCents = aid
    .filter((a) => !aidKindOf(a.kind).credits)
    .reduce((n, a) => n + a.cents, 0);
  const borrowedCents = credited
    .filter((a) => !a.pending && aidKindOf(a.kind).repaid)
    .reduce((n, a) => n + a.cents, 0);

  return {
    chargesCents,
    creditedCents,
    pendingCents,
    earnedCents,
    borrowedCents,
    owedCents: chargesCents - creditedCents,
    bestCaseCents: chargesCents - creditedCents - pendingCents,
    charges: charges.length,
    awards: aid.length,
    unconfirmed: credited.filter((a) => a.pending),
  };
}

/**
 * A balance divided into whole cents that add back up to it.
 *
 * The remainder goes on the earliest instalments rather than the last, so the
 * odd cent is paid early and the final instalment is never the one that is
 * larger than the rest. $18,432.17 over five parts is three of $3,686.44 and
 * two of $3,686.43, and those five add to $18,432.17 exactly — which is the
 * promise, and the reason this is a function with a test rather than a
 * division written at a call site.
 *
 * A balance of zero or less returns nothing: there is nothing to schedule, and
 * a plan of five instalments of $0.00 is noise on a screen.
 */
export function split(cents: number, parts: number): number[] {
  const n = Math.max(1, Math.floor(parts));
  if (cents <= 0) return [];
  const base = Math.floor(cents / n);
  const extra = cents - base * n;
  return Array.from({ length: n }, (_, i) => base + (i < extra ? 1 : 0));
}

/**
 * The same date, `n` months later, clamped to the end of the month.
 *
 * `setMonth` alone rolls over: the 31st of January plus one month is the 3rd of
 * March, which would quietly move an instalment past its due date. A plan
 * starting on the 31st has its later instalments on the 28th, 29th or 30th,
 * which is what every payment plan does.
 */
export function addMonths(iso: string, n: number): string {
  const d = isoToDate(iso);
  const day = d.getDate();
  const moved = new Date(d.getFullYear(), d.getMonth() + n, 1);
  const lastDay = new Date(moved.getFullYear(), moved.getMonth() + 1, 0).getDate();
  moved.setDate(Math.min(day, lastDay));
  return dateToIso(moved);
}

export interface Instalment {
  /** 1-based, because it is shown to a person: "3 of 5". */
  n: number;
  cents: number;
  /** ISO date. */
  due: string;
}

/**
 * The plan, as dated instalments.
 *
 * Returns nothing without a first date, rather than assuming one. A schedule
 * counted from today would be wrong on every screen it appeared on, and the
 * app does not show a date it has invented — the reasoning that keeps the
 * registrar's dates out of this codebase applies hardest to the dates with a
 * late fee attached.
 */
export function schedule(cents: number, plan: Plan): Instalment[] {
  if (!plan.first) return [];
  const every = Math.max(1, Math.floor(plan.everyMonths));
  return split(cents, plan.parts).map((part, i) => ({
    n: i + 1,
    cents: part,
    due: i === 0 ? plan.first : addMonths(plan.first, i * every),
  }));
}

export function paid(payments: Payment[]): number {
  return payments.reduce((n, p) => n + p.cents, 0);
}

export interface Next {
  instalment: Instalment;
  /** What is still outstanding on it, after payments so far. */
  shortCents: number;
  /** Whole days from now until it is due. Negative means it has passed. */
  daysAway: number;
  overdue: boolean;
}

/**
 * The next instalment that is not settled, and how short it is.
 *
 * Payments are applied to the earliest instalment first and spill forward,
 * rather than being matched to instalments by amount or by date. A student who
 * pays a round $4,000 against a $3,686.44 instalment has settled it and put
 * $313.56 against the next one, and any other rule would leave that $313.56
 * invisible until the plan ended.
 */
export function nextDue(instalments: Instalment[], payments: Payment[], now: Date): Next | null {
  let left = paid(payments);
  for (const instalment of instalments) {
    if (left >= instalment.cents) {
      left -= instalment.cents;
      continue;
    }
    const daysAway = daysBetween(now, isoToDate(instalment.due));
    return {
      instalment,
      shortCents: instalment.cents - left,
      daysAway,
      overdue: daysAway < 0,
    };
  }
  return null;
}

/**
 * What is owed, in a sentence.
 *
 * Reads the credit case out loud rather than as a minus sign on a figure:
 * "$1,240.00 is coming back to you" is understood and "−$1,240.00 owed" is
 * misread as a debt by at least some of the people who see it.
 */
export function line(o: Owed): string {
  if (o.charges === 0 && o.awards === 0) return 'Nothing off your statement yet.';
  if (o.charges === 0) return `${money(o.creditedCents)} in aid, and no charges entered yet.`;
  if (o.owedCents === 0) return `${money(o.chargesCents)} charged, covered to the cent.`;
  if (o.owedCents < 0) {
    return `${money(-o.owedCents)} more aid than charges — that comes back to you as a refund.`;
  }
  if (o.creditedCents === 0) return `${money(o.owedCents)} owed, with no aid entered against it.`;
  return `${money(o.owedCents)} owed — ${money(o.chargesCents)} charged, ${money(o.creditedCents)} covered.`;
}

/**
 * The things worth doing about it, or nothing.
 *
 * Each entry is a sentence a person can act on today. The pending-aid one is
 * first because it is the only one with a deadline somebody else controls.
 */
export function todo(o: Owed, next: Next | null): string[] {
  const out: string[] = [];

  if (o.unconfirmed.length > 0) {
    const n = o.unconfirmed.length;
    out.push(
      `${n} ${n === 1 ? 'award is' : 'awards are'} still unconfirmed, ${money(o.pendingCents)} of them. Until ${n === 1 ? 'it lands' : 'they land'} you owe ${money(o.owedCents)}, not ${money(Math.max(0, o.bestCaseCents))}.`,
    );
  }

  if (o.earnedCents > 0) {
    out.push(
      `${money(o.earnedCents)} of that award is work-study. It is paid to you for hours worked, so it is not credited against this statement and is not in the figure above.`,
    );
  }

  if (o.borrowedCents > 0) {
    out.push(`${money(o.borrowedCents)} of what covers the bill is borrowed and is paid back later.`);
  }

  if (next) {
    if (next.overdue) {
      const late = -next.daysAway;
      out.push(
        `Instalment ${next.instalment.n} was due ${late === 1 ? 'yesterday' : `${late} days ago`} and ${money(next.shortCents)} of it is outstanding. An unpaid balance is what puts a hold on next term's registration.`,
      );
    } else if (next.daysAway === 0) {
      out.push(`Instalment ${next.instalment.n} — ${money(next.shortCents)} — is due today.`);
    } else {
      out.push(
        `Instalment ${next.instalment.n} — ${money(next.shortCents)} — is due in ${next.daysAway} ${next.daysAway === 1 ? 'day' : 'days'}.`,
      );
    }
  }

  return out;
}

/**
 * Everything the app holds about money, as the three lists and the plan.
 *
 * Structural, so the store satisfies it without this file importing the state
 * shape — the same arrangement as `atRiskToday`'s arguments. What it buys is
 * that the screen, the Today card and the reminder all read one function, so
 * "what is owed" cannot come out differently on three surfaces.
 */
export interface Held {
  charges: Charge[];
  aid: Aid[];
  payments: Payment[];
  plans: Record<string, Plan>;
}

export interface Standing {
  owed: Owed;
  instalments: Instalment[];
  next: Next | null;
  /** What has been paid against this term. */
  paidCents: number;
  /** Whether anything at all has been entered for this term. */
  any: boolean;
}

/** One term's whole picture, from the lists to the next payment. */
export function billFor(held: Held, term: string, now: Date): Standing {
  const charges = forTerm(held.charges, term);
  const awards = forTerm(held.aid, term);
  const payments = forTerm(held.payments, term);
  const plan = held.plans[term] ?? blankPlan();
  const o = owed(charges, awards);
  // Clamped here and nowhere else: `owed` reports a credit balance honestly as
  // a negative, and a schedule of negative instalments is not a thing.
  const instalments = schedule(Math.max(0, o.owedCents), plan);
  return {
    owed: o,
    instalments,
    next: nextDue(instalments, payments, now),
    paidCents: paid(payments),
    any: charges.length > 0 || awards.length > 0 || payments.length > 0,
  };
}

/**
 * The next instalment, for the reminder and for Today — or nothing.
 *
 * Nothing where there is no date, nothing where the balance is settled, and
 * nothing where the student has entered no bill at all. Each of those is a
 * screen that should stay quiet rather than show a zero.
 */
export function nextPayment(
  held: Held,
  term: string,
  now: Date,
): { due: string; cents: number } | null {
  const next = billFor(held, term, now).next;
  return next ? { due: next.instalment.due, cents: next.shortCents } : null;
}

export { money, readMoney };
