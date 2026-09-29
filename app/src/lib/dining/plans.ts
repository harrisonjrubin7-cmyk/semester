/**
 * Meal plans: how many swipes a student has, over what window, and what
 * happens to what is left.
 *
 * Three shapes, which is what the plans schools actually sell come to:
 *
 * - **weekly** — N swipes a plan week. With `swipeRollover: 'none'` an unused
 *   swipe is gone when the week turns; with `'within_term'` it carries into the
 *   next week and is lost only at the end of the term.
 * - **term** — a block of N for the whole term, no weekly limit.
 * - **none** — dining dollars only.
 *
 * Dining dollars are integer cents in the ledger. At the end of a term they
 * either carry to the next plan or are forfeited, by the plan's rule; this
 * file says which and how much, and the partner system does it.
 *
 * The week begins at local midnight on `weekStartsOn` in the plan's time zone.
 */
import { balance, entriesFor, type Ledger } from './ledger';
import { no, yes, type Decision } from './decision';
import { addDays, daysFrom, localParts, weekStartOf } from './time';

export type SwipeAllowance =
  | { kind: 'weekly'; perWeek: number }
  | { kind: 'term'; perTerm: number }
  | { kind: 'none' };

export type SwipeRollover = 'none' | 'within_term';
export type DollarsRollover = 'forfeit' | 'carry';

export interface MealPlan {
  id: string;
  tenantId: string;
  studentId: string;
  term: string;
  /** First and last local dates the plan covers, inclusive. */
  startsOn: string;
  endsOn: string;
  timeZone: string;
  /** 0 = Sunday … 6 = Saturday. */
  weekStartsOn: number;
  swipes: SwipeAllowance;
  swipeRollover: SwipeRollover;
  diningCentsRollover: DollarsRollover;
}

/** The plan in force for a student at an instant, if any. */
export function activePlan(plans: readonly MealPlan[], tenantId: string, studentId: string, now: number): Decision<MealPlan> {
  const mine = plans.filter((p) => p.tenantId === tenantId && p.studentId === studentId);
  if (mine.length === 0) return no('no_plan', 'No meal plan is on record for this account.');
  const plan = mine.find((p) => {
    const today = localParts(now, p.timeZone).date;
    return today >= p.startsOn && today <= p.endsOn;
  });
  if (!plan) return no('no_plan', 'No meal plan covers today.');
  return yes(plan, `The ${plan.term} plan covers today.`);
}

export interface SwipeWindow {
  /** Local dates, inclusive start, exclusive end. */
  from: string;
  to: string;
  entitled: number;
  used: number;
  available: number;
}

/**
 * The swipes a plan allows right now, from the plan and the ledger. `used`
 * is the net of swipe entries whose `appliesAt` falls in the window, so a
 * refund that carries its debit's time lands in the debit's week.
 */
export function swipesAvailable(plan: MealPlan, ledger: Ledger, now: number): Decision<SwipeWindow> {
  const today = localParts(now, plan.timeZone).date;
  if (today < plan.startsOn || today > plan.endsOn) return no('no_plan', 'The plan does not cover today.');
  const termEnd = addDays(plan.endsOn, 1);
  const account = { tenantId: plan.tenantId, studentId: plan.studentId, term: plan.term, kind: 'swipe' as const };

  let from: string;
  let to: string;
  let entitled: number;
  switch (plan.swipes.kind) {
    case 'none':
      return no('swipes_exhausted', 'This plan has no meal swipes.');
    case 'term':
      from = plan.startsOn;
      to = termEnd;
      entitled = plan.swipes.perTerm;
      break;
    case 'weekly': {
      const week = weekStartOf(today, plan.weekStartsOn);
      if (plan.swipeRollover === 'within_term') {
        const firstWeek = weekStartOf(plan.startsOn, plan.weekStartsOn);
        const weeks = daysFrom(firstWeek, week) / 7 + 1;
        from = plan.startsOn;
        entitled = plan.swipes.perWeek * weeks;
      } else {
        from = week < plan.startsOn ? plan.startsOn : week;
        entitled = plan.swipes.perWeek;
      }
      const weekEnd = addDays(week, 7);
      to = weekEnd < termEnd ? weekEnd : termEnd;
      break;
    }
  }

  let net = 0;
  for (const e of entriesFor(ledger, account)) {
    const d = localParts(e.appliesAt, plan.timeZone).date;
    if (d >= from && d < to) net += e.delta;
  }
  const used = 0 - net;
  const available = Math.max(0, entitled - used);
  if (available === 0) {
    return no('swipes_exhausted', `All ${entitled} swipes for ${from} to ${addDays(to, -1)} are used.`);
  }
  return yes({ from, to, entitled, used, available }, `${available} of ${entitled} swipes left until ${addDays(to, -1)}.`);
}

export interface TermEnd {
  balanceCents: number;
  carriedCents: number;
  forfeitedCents: number;
}

/** What happens to a plan's dining dollars when its term ends. */
export function diningDollarsAtTermEnd(plan: MealPlan, ledger: Ledger): TermEnd {
  const cents = balance(ledger, { tenantId: plan.tenantId, studentId: plan.studentId, term: plan.term, kind: 'dining_cents' });
  const left = Math.max(0, cents);
  return plan.diningCentsRollover === 'carry'
    ? { balanceCents: cents, carriedCents: left, forfeitedCents: 0 }
    : { balanceCents: cents, carriedCents: 0, forfeitedCents: left };
}
