import { describe, expect, it } from 'vitest';
import { JOURNEYS } from '../governance/error-budgets';
import { BURN_RULES, MIN_EVENTS, budgetSpentAtFire, decide, evaluateRule, type WindowCountsByKey } from './burn-alerts';

/*
 * The alert tests. An alert that has never fired in a test is a guess about an
 * alert. Each case below is a *story* — what the journey is doing — and the
 * route the policy must choose for it. They run against the 99.95% objective
 * (plan save), where the sustainable failure rate is 5 in 10,000.
 */
const SLO = 99.95;
const busy = (bad: number, eligible = 100_000): { eligible: number; bad: number } => ({ eligible, bad });

/** A steady failure rate across every window, as a share of `eligible`. */
function steady(rate: number): WindowCountsByKey {
  const at = (eligible: number) => ({ eligible, bad: Math.round(eligible * rate) });
  return {
    '5m': at(2_000), '30m': at(12_000), '1h': at(24_000), '2h': at(48_000),
    '6h': at(144_000), '1d': at(576_000), '3d': at(1_728_000),
  };
}

describe('burn rules: what each one costs before it fires', () => {
  it('the four rules spend 2%, 5%, 10% and 10% of a month before they can fire', () => {
    const spent = Object.fromEntries(BURN_RULES.map((r) => [r.id, Math.round(budgetSpentAtFire(r) * 1000) / 10]));
    expect(spent).toEqual({ fast: 2, steady: 5, slow: 10, leak: 10 });
  });

  it('exactly two rules page and two open tickets; a page rule is never slower than a ticket rule', () => {
    expect(BURN_RULES.filter((r) => r.route === 'page').map((r) => r.id)).toEqual(['fast', 'steady']);
    expect(BURN_RULES.filter((r) => r.route === 'ticket').map((r) => r.id)).toEqual(['slow', 'leak']);
    const pageBurns = BURN_RULES.filter((r) => r.route === 'page').map((r) => r.burn);
    const ticketBurns = BURN_RULES.filter((r) => r.route === 'ticket').map((r) => r.burn);
    expect(Math.min(...pageBurns)).toBeGreaterThan(Math.max(...ticketBurns));
  });
});

describe('alert stories, on a journey with enough traffic to measure', () => {
  it('a total outage pages — the fast rule, within the first hour', () => {
    const d = decide(steady(1), SLO);
    expect(d.route).toBe('page');
    expect(d.results.find((r) => r.rule.id === 'fast')?.verdict).toBe('firing');
  });

  it('a 1% failure rate (burn 20) pages', () => {
    expect(decide(steady(0.01), SLO).route).toBe('page');
  });

  it('a 0.4% failure rate (burn 8) pages on the steady rule, not the fast one', () => {
    const d = decide(steady(0.004), SLO);
    expect(d.route).toBe('page');
    expect(d.results.find((r) => r.rule.id === 'fast')?.verdict).toBe('quiet');
    expect(d.results.find((r) => r.rule.id === 'steady')?.verdict).toBe('firing');
  });

  it('a 0.2% failure rate (burn 4) opens a ticket and wakes nobody', () => {
    const d = decide(steady(0.002), SLO);
    expect(d.route).toBe('ticket');
    expect(d.results.filter((r) => r.verdict === 'firing').map((r) => r.rule.id)).toEqual(['slow', 'leak']);
  });

  it('a 0.07% failure rate (burn 1.4) opens only the slow-leak ticket', () => {
    const d = decide(steady(0.0007), SLO);
    expect(d.route).toBe('ticket');
    expect(d.results.filter((r) => r.verdict === 'firing').map((r) => r.rule.id)).toEqual(['leak']);
  });

  it('a failure rate at the objective itself (burn 1.0 exactly on the sustainable line) still tickets: leak fires at >= 1', () => {
    expect(decide(steady(0.0005), SLO).route).toBe('ticket');
  });

  it('a healthy journey (burn 0.2) fires nothing', () => {
    const d = decide(steady(0.0001), SLO);
    expect(d.route).toBeNull();
    expect(d.complete).toBe(true);
  });
});

describe('both windows must agree', () => {
  it('a long burn with a recovered short window does not page: the fault is already fixed', () => {
    const counts = steady(0.01);
    counts['5m'] = busy(0, 2_000);
    const fast = evaluateRule(BURN_RULES[0], counts, SLO);
    expect(fast.longBurn).toBeGreaterThan(14.4);
    expect(fast.shortBurn).toBe(0);
    expect(fast.verdict).toBe('quiet');
  });

  it('a short spike inside a clean hour does not page: a blip is not an incident', () => {
    const counts = steady(0.0001);
    counts['5m'] = busy(400, 2_000);
    expect(evaluateRule(BURN_RULES[0], counts, SLO).verdict).toBe('quiet');
  });
});

describe('small denominators are not evidence', () => {
  it('three failures out of four attempts does not page — it says insufficient_data', () => {
    const counts: WindowCountsByKey = { '5m': busy(3, 4), '1h': busy(3, 4) };
    const r = evaluateRule(BURN_RULES[0], counts, SLO);
    expect(r.verdict).toBe('insufficient_data');
    expect(r.longBurn).toBeGreaterThan(14.4);
  });

  it('the floor is MIN_EVENTS: one event under it is silent, exactly at it can speak', () => {
    const under = { '1h': busy(MIN_EVENTS - 1, MIN_EVENTS - 1), '5m': busy(MIN_EVENTS - 1, MIN_EVENTS - 1) };
    const at = { '1h': busy(MIN_EVENTS, MIN_EVENTS), '5m': busy(MIN_EVENTS, MIN_EVENTS) };
    expect(evaluateRule(BURN_RULES[0], under, SLO).verdict).toBe('insufficient_data');
    expect(evaluateRule(BURN_RULES[0], at, SLO).verdict).toBe('firing');
  });

  it('a window nobody reported is no data, never quiet-and-fine', () => {
    const d = decide({}, SLO);
    expect(d.route).toBeNull();
    expect(d.complete).toBe(false);
    expect(d.results.every((r) => r.verdict === 'insufficient_data')).toBe(true);
  });

  it('a quiet journey with a clean record is quiet but still incomplete if the long windows are empty', () => {
    const d = decide({ '5m': busy(0, 30), '1h': busy(0, 300), '30m': busy(0, 150), '6h': busy(0, 900) }, SLO);
    expect(d.route).toBeNull();
    expect(d.complete).toBe(false);
  });
});

describe('inputs are validated, not trusted', () => {
  it('bad cannot exceed eligible, and counts are whole numbers', () => {
    expect(() => decide({ '1h': { eligible: 10, bad: 11 } }, SLO)).toThrow(RangeError);
    expect(() => decide({ '1h': { eligible: 10.5, bad: 1 } }, SLO)).toThrow(RangeError);
    expect(() => decide({ '1h': { eligible: -1, bad: 0 } }, SLO)).toThrow(RangeError);
  });

  it('an objective written as a fraction is refused (same guard as the budget maths)', () => {
    expect(() => decide(steady(0.01), 0.9995)).toThrow(RangeError);
  });
});

describe('every journey can be alerted on', () => {
  it('a total outage pages on every journey, whatever its objective', () => {
    for (const j of JOURNEYS) expect(decide(steady(1), j.slo).route, j.id).toBe('page');
  });

  it('a loose objective tolerates what a strict one cannot: 0.3% failing pages plan save but not Ask Semester', () => {
    const plan = JOURNEYS.find((j) => j.id === 'plan_save')!;
    const ask = JOURNEYS.find((j) => j.id === 'ask_semester')!;
    expect(decide(steady(0.003), plan.slo).route).toBe('page');
    expect(decide(steady(0.003), ask.slo).route).toBeNull();
  });
});
