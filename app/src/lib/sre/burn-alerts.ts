/**
 * Turning a burn rate into a decision: page somebody, open a ticket, or do
 * nothing — and, when the numbers are too small to mean anything, say so.
 *
 * `governance/error-budgets.ts` already answers "how much budget is left" and
 * "how fast is it going". It stops at a number. A number does not wake anyone
 * and does not open a ticket, and one threshold on one window is the shape of
 * alert that is either late (long window) or noisy (short window). This module
 * is the policy that sits on top: multi-window, multi-burn-rate, the way the
 * Google SRE workbook lays it out, with one adaptation this product needs.
 *
 * **Both windows must agree.** A rule fires only when a long window shows the
 * budget really is going and a short window shows it is still going. The long
 * window keeps a brief blip from paging; the short one stops an alert from
 * staying red for an hour after the fault is fixed.
 *
 * **Small denominators are not evidence.** Semester's first audience is ten to
 * thirty people. Against a 99.95% objective, one failed save in two hundred is
 * a burn of ten, and it is also one person having a bad minute. So a window
 * that has fewer eligible events than `MIN_EVENTS` cannot fire anything and
 * reads `insufficient_data` — never "fine". The synthetic probe covers that
 * gap (alerts.ts routes it there); a low-traffic journey is watched by a
 * robot that acts like a student, not by arithmetic on three events.
 *
 * Nothing here reads a clock, a network or a database. Counts go in, a verdict
 * comes out, so the same counts always give the same verdict and the alert
 * tests in `burn-alerts.test.ts` are ordinary table tests.
 */

import { burnRate } from '../governance/error-budgets';

/** The window every SLO in `error-budgets.ts` is written against. */
export const BUDGET_PERIOD_HOURS = 30 * 24;

export type WindowKey = '5m' | '30m' | '1h' | '2h' | '6h' | '1d' | '3d';

export const WINDOW_HOURS: Record<WindowKey, number> = {
  '5m': 5 / 60,
  '30m': 0.5,
  '1h': 1,
  '2h': 2,
  '6h': 6,
  '1d': 24,
  '3d': 72,
};

export type Route = 'page' | 'ticket';

export interface BurnRule {
  id: string;
  route: Route;
  /** Burn rate, as a multiple of the sustainable rate, that both windows must reach. */
  burn: number;
  long: WindowKey;
  short: WindowKey;
}

/**
 * Four rules, two that wake somebody and two that do not.
 *
 * The fraction of a thirty-day budget each one spends before it fires is
 * `burn × long ÷ 720 h`, and `budgetSpentAtFire()` computes it, because the
 * point of choosing these four is those four fractions: 2%, 5%, 10%, 10%.
 */
export const BURN_RULES: readonly BurnRule[] = [
  { id: 'fast', route: 'page', burn: 14.4, long: '1h', short: '5m' },
  { id: 'steady', route: 'page', burn: 6, long: '6h', short: '30m' },
  { id: 'slow', route: 'ticket', burn: 3, long: '1d', short: '2h' },
  { id: 'leak', route: 'ticket', burn: 1, long: '3d', short: '6h' },
];

/** The share of the monthly budget gone by the time a rule can fire. */
export function budgetSpentAtFire(rule: BurnRule): number {
  return (rule.burn * WINDOW_HOURS[rule.long]) / BUDGET_PERIOD_HOURS;
}

/**
 * Fewest eligible events a window needs before it is allowed to fire a rule.
 * Per-window rather than global: five minutes of a busy journey holds more
 * events than three days of a quiet one, and the floor is about how much a
 * single event can move the ratio.
 */
export const MIN_EVENTS = 20;

export interface WindowCounts {
  eligible: number;
  bad: number;
}

export type WindowCountsByKey = Partial<Record<WindowKey, WindowCounts>>;

export type RuleVerdict = 'firing' | 'quiet' | 'insufficient_data';

export interface RuleResult {
  rule: BurnRule;
  verdict: RuleVerdict;
  longBurn: number | null;
  shortBurn: number | null;
}

export interface BurnDecision {
  /** The strictest route any firing rule asks for; null when nothing fires. */
  route: Route | null;
  /** True only when every rule had enough data to speak. */
  complete: boolean;
  results: RuleResult[];
}

function checked(key: WindowKey, c: WindowCounts): WindowCounts {
  if (!Number.isInteger(c.eligible) || !Number.isInteger(c.bad) || c.eligible < 0 || c.bad < 0 || c.bad > c.eligible) {
    throw new RangeError(`${key}: counts must be whole, non-negative, and bad cannot exceed eligible`);
  }
  return c;
}

function readWindow(counts: WindowCountsByKey, key: WindowKey): WindowCounts | null {
  const c = counts[key];
  if (!c) return null;
  return checked(key, c);
}

/** One rule against one set of window counts. */
export function evaluateRule(rule: BurnRule, counts: WindowCountsByKey, slo: number): RuleResult {
  const long = readWindow(counts, rule.long);
  const short = readWindow(counts, rule.short);
  const enough = (c: WindowCounts | null): c is WindowCounts => c !== null && c.eligible >= MIN_EVENTS;
  if (!enough(long) || !enough(short)) {
    return {
      rule,
      verdict: 'insufficient_data',
      longBurn: long && long.eligible > 0 ? burnRate(long.eligible, long.bad, slo) : null,
      shortBurn: short && short.eligible > 0 ? burnRate(short.eligible, short.bad, slo) : null,
    };
  }
  const longBurn = burnRate(long.eligible, long.bad, slo);
  const shortBurn = burnRate(short.eligible, short.bad, slo);
  return {
    rule,
    verdict: longBurn >= rule.burn && shortBurn >= rule.burn ? 'firing' : 'quiet',
    longBurn,
    shortBurn,
  };
}

/**
 * Every rule, and the one decision they add up to. `complete` is the honest
 * half: a journey that is `quiet` because nobody used it is not the same as a
 * journey that is `quiet` because it was measured and is fine, and the
 * scorecard needs to be able to tell them apart.
 */
export function decide(counts: WindowCountsByKey, slo: number, rules: readonly BurnRule[] = BURN_RULES): BurnDecision {
  const results = rules.map((r) => evaluateRule(r, counts, slo));
  const firing = results.filter((r) => r.verdict === 'firing');
  const route: Route | null = firing.some((r) => r.rule.route === 'page') ? 'page' : firing.length ? 'ticket' : null;
  return { route, complete: results.every((r) => r.verdict !== 'insufficient_data'), results };
}
