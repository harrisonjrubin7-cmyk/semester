import { describe, expect, it } from 'vitest';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { allowedFailures, budgetState, burnRate, FRONTEND_TARGETS, JOURNEYS, POLICY, review, URGENT_BURN } from './error-budgets';

const root = resolve(__dirname, '../../../..');

describe('the worked plan-save example', () => {
  // 100,000 eligible saves in thirty days at 99.95%.
  it('allows fifty bad saves', () => {
    expect(allowedFailures(100_000, 99.95)).toBe(50);
  });

  it('puts forty bad saves at risk, and freezes nonessential changes to the flow', () => {
    const r = review({ journey: 'plan_save', eligible: 100_000, bad: 40 });
    expect(r.state).toBe('at_risk');
    expect(r.release).toBe(POLICY.at_risk.release);
    expect(r.urgent).toBe(false);
  });

  it('calls a 0.5% failure rate against a 0.05% budget a tenfold burn, and urgent before the objective is missed', () => {
    // Failing 0.5% of saves against a 0.05% allowance.
    expect(burnRate(10_000, 50, 99.95)).toBe(10);
    // The window so far is only on watch — a third of its budget left — but
    // the last hour failed 5 of 1,000 saves.
    const r = review({ journey: 'plan_save', eligible: 60_000, bad: 20, recent: { eligible: 1_000, bad: 5 } });
    expect(r.state).toBe('watch');
    expect(r.urgent).toBe(true);
    expect(r.burn).toBeGreaterThanOrEqual(URGENT_BURN);
  });
});

describe('budget states', () => {
  // allowed = 100 at 99.9% over 100,000.
  const at = (bad: number) => budgetState(100_000, bad, 99.9);

  it('reads each boundary the way the policy table words it', () => {
    expect(at(0)).toBe('healthy');
    expect(at(49)).toBe('healthy'); // 51% left: more than half
    expect(at(50)).toBe('watch'); // exactly half left is not "more than 50%"
    expect(at(75)).toBe('watch'); // 25% left
    expect(at(76)).toBe('at_risk');
    expect(at(90)).toBe('at_risk'); // 10% left
    expect(at(91)).toBe('exhausted');
    expect(at(100)).toBe('exhausted'); // spent, not yet missed
    expect(at(101)).toBe('breached');
  });

  it('says there is no data rather than calling an empty window healthy', () => {
    expect(budgetState(0, 0, 99.9)).toBe('no_data');
    expect(review({ journey: 'search', eligible: 0, bad: 0 }).release).toBeNull();
  });

  it('breaches on the first bad event when the window is too small to allow any', () => {
    expect(allowedFailures(1_000, 99.99)).toBe(0);
    expect(budgetState(1_000, 0, 99.99)).toBe('healthy');
    expect(budgetState(1_000, 1, 99.99)).toBe('breached');
  });

  it('does not lose a failure to floating point', () => {
    // 0.1 * 3 style drift: 99.9 * 100 is 9990.000000000002 in binary.
    for (const j of JOURNEYS) {
      const allowed = allowedFailures(1_000_000, j.slo);
      expect(allowed, j.id).toBe(Math.round(1_000_000 * (100 - j.slo) / 100));
    }
  });

  it('refuses an objective it cannot represent exactly', () => {
    expect(() => allowedFailures(100, 99.955)).toThrow(RangeError);
    expect(() => allowedFailures(100, 100)).toThrow(RangeError);
    // A fraction written where a percentage belongs is caught, not read as 0.9995%.
    expect(() => allowedFailures(100, 0.9995)).toThrow(RangeError);
  });

  it('refuses counts that cannot be true', () => {
    expect(() => review({ journey: 'plan_save', eligible: 10, bad: 11 })).toThrow(RangeError);
    expect(() => review({ journey: 'plan_save', eligible: 10.5, bad: 0 })).toThrow(RangeError);
    expect(() => review({ journey: 'nope', eligible: 10, bad: 0 })).toThrow();
    expect(() => review({ journey: 'plan_save', eligible: 10, bad: 0, recent: { eligible: 1, bad: 2 } })).toThrow(RangeError);
  });
});

describe('the registry', () => {
  it('names each journey once, and every objective is a real percentage', () => {
    expect(new Set(JOURNEYS.map((j) => j.id)).size).toBe(JOURNEYS.length);
    for (const j of JOURNEYS) expect(() => allowedFailures(1, j.slo), j.id).not.toThrow();
  });

  it('covers every journey the platform brief names, and says which figures nobody has adopted', () => {
    const ids = JOURNEYS.map((j) => j.id);
    for (const id of ['sign_in', 'today_load', 'calendar_view', 'course_access', 'assignment_draft_save', 'grade_retrieval', 'ask_semester', 'registration_submit', 'billing_statement_payment', 'communication_delivery', 'integration_sync']) {
      expect(ids, id).toContain(id);
    }
    expect(JOURNEYS.filter((j) => j.proposed)).toHaveLength(7);
    expect(JOURNEYS.filter((j) => !j.proposed)).toHaveLength(8);
  });

  it('gives each proposed journey its own bad events, and a registration refusal with a reason is not one of them', () => {
    for (const j of JOURNEYS.filter((x) => x.proposed)) {
      expect(j.bad?.length, j.id).toBeGreaterThan(1);
      expect(new Set(j.bad).size, `${j.id} repeats a bad event`).toBe(j.bad!.length);
    }
    const reg = JOURNEYS.find((j) => j.id === 'registration_submit')!;
    expect(reg.good).toMatch(/refused with a reason/);
    expect(reg.bad).not.toContain('Is refused');
    expect(reg.bad).toContain('Refuses without a reason the student can read');
  });

  it('reviews a proposed journey like an adopted one', () => {
    // 99.95% over 100,000 allows 50; 40 bad leaves a fifth of it.
    const r = review({ journey: 'registration_submit', eligible: 100_000, bad: 40 });
    expect(r.state).toBe('at_risk');
    expect(review({ journey: 'integration_sync', eligible: 10_000, bad: 51 }).state).toBe('breached'); // 99.5% allows 50
  });

  it('reads burn from the window when no recent lookback is given', () => {
    const r = review({ journey: 'plan_save', eligible: 100_000, bad: 40 });
    expect(r.burn).toBeCloseTo(0.8);
  });

  it('gives a breach the incident process, not a release rule', () => {
    const r = review({ journey: 'sign_in', eligible: 10_000, bad: 6 });
    expect(r.state).toBe('breached');
    expect(r.urgent).toBe(true);
    expect(r.release).toMatch(/incident/i);
  });

  it('cites only guard tests that exist', () => {
    const cited = FRONTEND_TARGETS.filter((t) => t.guard);
    expect(cited.length).toBeGreaterThan(0);
    for (const t of cited) expect(existsSync(resolve(root, t.guard!)), t.guard!).toBe(true);
    // Control: the check can fail.
    expect(existsSync(resolve(root, 'app/src/a11y/nothing-here.test.ts'))).toBe(false);
  });
});
