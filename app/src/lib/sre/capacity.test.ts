import { describe, expect, it } from 'vitest';
import {
  COHORTS, LIMITS, SCENARIOS, TARGET_UTILISATION, aiCapOrder, demand, fit, plan, stack, type Limit,
} from './capacity';

const cohort = (id: string) => COHORTS.find((c) => c.id === id)!;
const scenario = (id: string) => SCENARIOS.find((s) => s.id === id)!;

describe('Little\'s law, worked by hand', () => {
  it('registration at one campus: 6,000 accounts, 45% concurrent, 18 requests a minute each', () => {
    const d = demand(scenario('registration_open'), cohort('campus'));
    // 6,000 × 0.45 = 2,700 concurrent; 2,700 × 18 / 60 = 810 requests a second.
    expect(d.concurrentAccounts).toBe(2_700);
    expect(d.rps).toBe(810);
    // in flight = 810 × 0.8 s = 648; connections = 810 × 4 queries × 0.02 s = 64.8 → 65.
    expect(d.inFlight).toBe(648);
    expect(d.dbConnections).toBe(65);
    // AI at 0.2 calls/min × 2,700 = 540 a minute.
    expect(d.aiCallsPerMinute).toBe(540);
  });

  it('emergency fan-out is measured against its own window: 6,000 alerts in 60 s is 100 a second', () => {
    const d = demand(scenario('campus_emergency'), cohort('campus'));
    expect(d.notifications).toBe(6_000);
    expect(d.notificationsPerSecond).toBe(100);
  });

  it('demand rises with the cohort and never falls', () => {
    for (const s of SCENARIOS) {
      const sizes = COHORTS.map((c) => demand(s, c));
      for (let i = 1; i < sizes.length; i++) {
        expect(sizes[i].rps, `${s.id} rps`).toBeGreaterThanOrEqual(sizes[i - 1].rps);
        expect(sizes[i].dbConnections, `${s.id} db`).toBeGreaterThanOrEqual(sizes[i - 1].dbConnections);
      }
    }
  });

  it('refuses a cohort that is not a positive whole number of accounts', () => {
    expect(() => demand(scenario('deadline_spike'), { id: 'x', label: 'x', accounts: 0 })).toThrow(RangeError);
    expect(() => demand(scenario('deadline_spike'), { id: 'x', label: 'x', accounts: 10.5 })).toThrow(RangeError);
  });
});

describe('peaks stack', () => {
  it('grade release on deadline night costs more than either alone, in every resource', () => {
    const a = demand(scenario('grade_release'), cohort('campus'));
    const b = demand(scenario('deadline_spike'), cohort('campus'));
    const both = stack(a, b);
    expect(both.rps).toBeGreaterThan(Math.max(a.rps, b.rps));
    expect(both.inFlight).toBe(a.inFlight + b.inFlight);
    expect(both.dbConnections).toBe(a.dbConnections + b.dbConnections);
  });

  it('concurrent accounts never exceed the accounts that exist', () => {
    const a = demand(scenario('campus_emergency'), cohort('beta'));
    const b = demand(scenario('registration_open'), cohort('beta'));
    expect(stack(a, b).concurrentAccounts).toBeLessThanOrEqual(cohort('beta').accounts);
  });

  it('different cohorts cannot stack: a peak is a share of one population', () => {
    expect(() => stack(demand(scenario('ai_surge'), cohort('beta')), demand(scenario('ai_surge'), cohort('campus')))).toThrow();
  });
});

describe('an unknown limit is never "fits"', () => {
  const unknown: Limit = { resource: 'dbConnections', where: 'x', value: null, evidence: null };
  it('null reads as unknown_limit however small the demand', () => {
    expect(fit(0, unknown)).toEqual({ fit: 'unknown_limit', utilisation: null });
    expect(fit(1, unknown).fit).toBe('unknown_limit');
  });

  it('every ceiling in the register is unverified today, so a full plan certifies nothing', () => {
    expect(LIMITS.every((l) => l.value === null)).toBe(true);
    for (const cohortRow of COHORTS) {
      for (const row of plan(cohortRow)) for (const c of row.checks) expect(c.fit).toBe('unknown_limit');
    }
  });

  it('a limit with a value is read as fits, tight or exceeds around the target utilisation', () => {
    const l: Limit = { resource: 'dbConnections', where: 'x', value: 100, evidence: 'dated reading' };
    expect(fit(TARGET_UTILISATION * 100, l).fit).toBe('fits');
    expect(fit(TARGET_UTILISATION * 100 + 1, l).fit).toBe('tight');
    expect(fit(100, l).fit).toBe('tight');
    expect(fit(101, l).fit).toBe('exceeds');
  });

  it('a verified limit must be positive', () => {
    expect(() => fit(1, { ...unknown, value: 0 })).toThrow(RangeError);
  });
});

describe('the three AI caps must be in the right order', () => {
  it('per-account cap × accounts × cost must sit under the provider cap', () => {
    const base = { perAccountMonthlyCalls: 60, costPerCall: 0.02 };
    expect(aiCapOrder(500, { ...base, providerMonthlyCap: 1_000 })).toBe('ordered'); // 500×60×0.02 = 600
    expect(aiCapOrder(500, { ...base, providerMonthlyCap: 500 })).toBe('inverted');
  });

  it('is unknown, not ordered, while the provider cap or the cost per call is unset', () => {
    expect(aiCapOrder(500, { perAccountMonthlyCalls: 60, providerMonthlyCap: null, costPerCall: 0.02 })).toBe('unknown');
    expect(aiCapOrder(500, { perAccountMonthlyCalls: 60, providerMonthlyCap: 1_000, costPerCall: null })).toBe('unknown');
  });
});

describe('every scenario is a stated assumption', () => {
  it('names its basis as an assumption, so nobody quotes it as a measurement', () => {
    for (const s of SCENARIOS) expect(s.basis, s.id).toMatch(/^Assumption\./);
  });

  it('keeps shares and rates in sane ranges', () => {
    for (const s of SCENARIOS) {
      expect(s.concurrentShare, s.id).toBeGreaterThan(0);
      expect(s.concurrentShare, s.id).toBeLessThanOrEqual(1);
      expect(s.requestsPerMinute, s.id).toBeGreaterThan(0);
      expect(s.notificationWindowSeconds, s.id).toBeGreaterThan(0);
    }
  });
});
