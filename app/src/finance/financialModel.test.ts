import { describe, expect, it } from 'vitest';
import { runModel } from './financialModelEngine';
import {
  assumptionsCsv, assumptionsPrompt, boardSummary, csvCell, monthlyCsv, scenarioJson, scenarioMarkdown, DISCLAIMER, SCHEMA,
} from './financialModelExports';
import { DEFAULT_ASSUMPTIONS, FIELDS, hasErrors, validate, withOverrides } from './financialModelFields';
import { formatCount, formatPct, formatUsd, formatUsdExact } from './financialModelFormat';
import { SCENARIOS, SCENARIO_IDS, aiCostVsOverage, assumptionsFor, conversionVsCycle, scenarioById, summariseAll } from './financialModelScenarios';
import { MODEL_MONTHS, type Assumptions } from './financialModelTypes';

/**
 * The financial model, held by arithmetic done by hand.
 *
 * Where a formula is checked, the expected value is worked out here from the
 * inputs, not read back from the engine, so a wrong engine cannot agree with
 * itself. Each warning has a case that raises it and a case that does not:
 * a threshold test that never goes quiet proves nothing.
 */

const base = DEFAULT_ASSUMPTIONS;
const run = (patch: Partial<Assumptions> = {}) => runModel(withOverrides(base, patch));
const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);
const ids = (r: ReturnType<typeof run>) => r.warnings.map((w) => w.id);

/** A plan that reaches annual customers fast, so cohort and retention arithmetic can be checked. */
const FAST: Partial<Assumptions> = {
  firstPaidPilotMonth: 1, salesCycleMonths: 1, pilotMonths: 1, conversionLagMonths: 0, outreachAccountsPerMonth: 100,
  replyRate: 1, discoveryRate: 1, qualificationRate: 1, demoRate: 1, pilotDesignRate: 1, proposalRate: 1, pilotCloseRate: 0.1,
  pilotActivationRate: 1, pilotSuccessRate: 1, pilotToAnnualConversion: 1,
};

describe('the engine', () => {
  it('is deterministic: the same assumptions give the same months', () => {
    expect(run()).toEqual(run());
  });

  it('runs 36 months, labelled from the start month, and every row is a forecast', () => {
    const r = run();
    expect(r.months).toHaveLength(MODEL_MONTHS);
    expect(r.months[0].label).toBe('2026-11');
    expect(r.months[2].label).toBe('2027-01');
    expect(r.months[35].label).toBe('2029-10');
    expect(r.months.every((m) => m.basis === 'forecast')).toBe(true);
    expect(r.basis).toBe('forecast');
    expect(r.years.every((y) => y.basis === 'forecast')).toBe(true);
    expect(r.unit.basis).toBe('forecast');
    expect(r.breakEven.basis).toBe('forecast');
  });

  it('holds paid pilots until the gate month: nothing is signed or recognised before it', () => {
    const r = run({ firstPaidPilotMonth: 20 });
    expect(sum(r.months.slice(0, 19).map((m) => m.pilotsSigned))).toBe(0);
    expect(sum(r.months.slice(0, 19).map((m) => m.revenuePilot + m.revenueImplementation))).toBe(0);
    // Deals that were ready earlier wait and land in the gate month, so none are lost.
    const open = run({ firstPaidPilotMonth: 1 });
    const early = sum(open.months.slice(0, 19).map((m) => m.pilotsSigned));
    expect(r.months[19].pilotsSigned).toBeCloseTo(open.months[19].pilotsSigned + early, 9);
  });

  it('puts a pilot fee into revenue over the pilot term: six overlapping pilots at fee/6 each', () => {
    const r = run({ pilotsPerMonthOverride: 1, firstPaidPilotMonth: 1, pilotMonths: 6, pilotFee: 12000 });
    expect(r.months[5].revenuePilot).toBeCloseTo(12000, 6);
    expect(r.months[0].revenuePilot).toBeCloseTo(2000, 6);
  });
});

describe('pricing calculations (the brief\'s planning assumptions, worked by hand)', () => {
  const unit = (patch: Partial<Assumptions>) => run({ premiumSupportAttachRate: 1, ...patch }).unit;

  it('platform fee is the greater of $18 per enrolled student and the $30,000 minimum', () => {
    expect(unit({ annualScopeStudents: 1000 }).platformFeePerCustomer).toBe(30000); // 18,000 < minimum
    expect(unit({ annualScopeStudents: 1000 }).minimumApplies).toBe(true);
    expect(unit({ annualScopeStudents: 5000 }).platformFeePerCustomer).toBe(90000);
    expect(unit({ annualScopeStudents: 5000 }).minimumApplies).toBe(false);
    expect(unit({ annualScopeStudents: 20000 }).platformFeePerCustomer).toBe(360000);
    expect(unit({ annualScopeStudents: 1666 }).minimumApplies).toBe(true); // 18 x 1,666 = 29,988, still under
    expect(unit({ annualScopeStudents: 1667 }).minimumApplies).toBe(false); // 18 x 1,667 = 30,006 just clears it
    expect(unit({ annualScopeStudents: 1667 }).platformFeePerCustomer).toBeCloseTo(30006, 6);
  });

  it('premium support is 15% of the platform fee with a $15,000 minimum', () => {
    expect(unit({ annualScopeStudents: 1000 }).supportFeePerCustomer).toBe(15000); // 15% x 30,000 = 4,500
    expect(unit({ annualScopeStudents: 5000 }).supportFeePerCustomer).toBe(15000); // 15% x 90,000 = 13,500 < minimum
    expect(unit({ annualScopeStudents: 20000 }).supportFeePerCustomer).toBe(54000); // 15% x 360,000
  });

  it('weights premium support by the attach rate', () => {
    expect(unit({ annualScopeStudents: 5000, premiumSupportAttachRate: 0.3 }).supportFeePerCustomer).toBeCloseTo(4500, 9);
  });

  it('bills AI overage only above the 2,400-a-year pool, at $30 per 1,000', () => {
    // Everyone invited and active, 300 requests a month each against a 200-a-month pool: 100 over, per student per month.
    const over = unit({ annualScopeStudents: 1000, studentInviteRate: 1, studentActivationRate: 1, aiRequestsPerActiveUserMonth: 300 });
    expect(over.aiOveragePerCustomerYear).toBeCloseTo(12 * 1000 * 100 * 0.03, 6); // $36,000
    const under = unit({ annualScopeStudents: 1000, studentInviteRate: 1, studentActivationRate: 1, aiRequestsPerActiveUserMonth: 200 });
    expect(under.aiOveragePerCustomerYear).toBe(0);
  });
});

describe('the brief\'s formulas', () => {
  it('CAC is sales and marketing spend over annual customers acquired', () => {
    const r = run(FAST);
    const spend = sum(r.months.map((m) => m.salesAndMarketing));
    const won = sum(r.months.map((m) => m.annualStarts));
    expect(won).toBeGreaterThan(1);
    expect(r.unit.cac).toBeCloseTo(spend / won, 9);
    // Year-1 spend by hand: marketing 3,000 + travel 1,000 + half of one founder at 5,000 = 6,500 a month.
    expect(r.months[0].salesAndMarketing).toBeCloseTo(6500, 9);
  });

  it('CAC is undefined, not zero, when nothing is acquired', () => {
    const r = run({ outreachAccountsPerMonth: 0 });
    expect(r.unit.cac).toBeNull();
    expect(r.unit.cacPaybackMonths).toBeNull();
    expect(r.unit.paybackNote).toMatch(/undefined/);
  });

  it('CAC payback is CAC over monthly gross profit per customer', () => {
    const r = run(FAST);
    // By hand for Base prices: platform 45,000 + 0.3 x max(15,000, 6,750) = 49,500 a year.
    // Active per institution 2,500 x 0.7 x 0.5 = 875; variable cost 875 x (0.21 + 60 x 0.0146) + 500 = 1,450.25 a month.
    const monthlyGp = 49500 / 12 - (875 * (0.21 + 60 * 0.0146) + 500);
    expect(monthlyGp).toBeCloseTo(2674.75, 6);
    expect(r.unit.monthlyGrossProfitPerCustomer).toBeCloseTo(monthlyGp, 6);
    expect(r.unit.cacPaybackMonths).toBeCloseTo((r.unit.cac as number) / monthlyGp, 6);
  });

  it('says so when a customer never pays back', () => {
    const r = run({ ...FAST, supportCostPerCustomerMonth: 10000 });
    expect(r.unit.cacPaybackMonths).toBeNull();
    expect(r.unit.paybackNote).toMatch(/never recovered/);
  });

  it('LTV is ARR x gross margin / annual logo churn', () => {
    const u = run().unit;
    const gm = 2674.75 / (49500 / 12);
    expect(u.unitGrossMargin).toBeCloseTo(gm, 9);
    expect(u.ltv).toBeCloseTo((49500 * gm) / 0.15, 4);
    expect(u.ltvToCac).toBeCloseTo((u.ltv as number) / (u.cac as number), 9);
  });

  it('LTV is undefined at zero churn instead of infinite', () => {
    expect(run({ institutionRetention: 1 }).unit.ltv).toBeNull();
  });

  it('MRR is annual recurring revenue / 12 plus recurring monthly student revenue', () => {
    const r = run(FAST);
    const m = r.months[20];
    expect(m.annualCustomers).toBeGreaterThan(0);
    expect(m.mrr).toBeCloseTo(m.revenuePlatform + m.revenueSupport + m.revenueStudentPremium, 6);
    expect(m.arr).toBeCloseTo(m.mrr * 12, 6);
  });

  it('break-even is the first month cumulative gross profit covers cumulative operating expense and obligations', () => {
    const r = run({ ...FAST, pilotFee: 400000 });
    let gp = 0;
    let cost = 0;
    let expected: number | null = null;
    for (const m of r.months) {
      gp += m.grossProfit;
      cost += m.opexTotal + m.obligations;
      if (expected === null && gp >= cost) expected = m.month;
    }
    expect(expected).not.toBeNull();
    expect(r.breakEven.month).toBe(expected);
  });

  it('reports no break-even when costs are never covered', () => {
    expect(run({ outreachAccountsPerMonth: 0 }).breakEven.month).toBeNull();
    expect(run({ outreachAccountsPerMonth: 0 }).breakEven.sustained).toBe(false);
  });

  it('required obligations delay break-even', () => {
    const lean = run({ ...FAST, pilotFee: 400000, obligationSecurityAmount: 0, obligationAccessibilityAmount: 0, obligationCounselAmount: 0, obligationEntityInsuranceAmount: 0 });
    const heavy = run({ ...FAST, pilotFee: 400000 });
    expect(heavy.breakEven.month as number).toBeGreaterThanOrEqual(lean.breakEven.month as number);
  });

  it('gross retention is logo retention; net revenue retention adds expansion', () => {
    const u = run().unit;
    expect(u.grossRetention).toBe(0.85);
    expect(u.netRevenueRetention).toBeCloseTo(0.85 * 1.1, 12);
  });

  it('measured NRR equals the formula when the support minimum does not bind', () => {
    // Zero support minimum so support scales with the platform fee; scope 2,500 x $18 is above the platform minimum.
    const r = run({ ...FAST, premiumSupportMinimum: 0 });
    expect(r.unit.measuredNrr).toBeCloseTo(0.85 * 1.1, 9);
  });

  it('measured NRR falls short of the formula when the support minimum binds, because that fee does not expand', () => {
    const r = run(FAST);
    // One cohort aged a year: (45,000 x 1.1 + 4,500) / (45,000 + 4,500) x 0.85 = 0.9273. The measure blends cohorts of
    // different ages, so it sits within a few hundredths of a point of that, and below the formula's 0.935.
    expect(r.unit.measuredNrr).toBeCloseTo((0.85 * (49500 + 4500)) / 49500, 3);
    expect(r.unit.measuredNrr as number).toBeLessThan(r.unit.netRevenueRetention);
  });

  it('shrinks a cohort by retention at each anniversary and counts the loss as churn', () => {
    const r = run({ ...FAST, expansionRate: 0 });
    const first = r.months.findIndex((m) => m.annualStarts > 0);
    const s = r.months[first].annualStarts;
    // The first cohort is still whole in its first year; one year on it has lost 15%.
    expect(r.months[first + 11].annualCustomers).toBeGreaterThanOrEqual(s);
    expect(r.months[first + 12].customersChurned).toBeCloseTo(s * 0.15, 9);
  });
});

describe('cash and collections', () => {
  it('ending cash is opening cash plus funding plus every month\'s collections less cash out', () => {
    const r = run({ fundingAmount: 250000, fundingMonth: 9 });
    const expected = 100000 + 250000 + sum(r.months.map((m) => m.collections - m.cashOut));
    expect(r.months[35].endingCash).toBeCloseTo(expected, 6);
  });

  it('collects an invoice only after the payment terms: 60 days is two months', () => {
    const net30 = run({ ...FAST, paymentTermsDays: 30 });
    const net60 = run({ ...FAST, paymentTermsDays: 60 });
    expect(sum(net60.months.map((m) => m.collections))).toBeLessThan(sum(net30.months.map((m) => m.collections)));
    const firstBill = net60.months.findIndex((m) => m.billings > 0);
    expect(net60.months[firstBill].collections).toBeLessThan(net60.months[firstBill].billings);
    expect(net60.months[firstBill + 2].collections).toBeGreaterThan(0);
  });

  it('forward runway is cash over recent burn, zero once cash is gone, and absent when not burning', () => {
    const rich = run({ openingCash: 1_000_000 });
    // Month 1 has no collections and no funding, so its burn is just what went out.
    expect(rich.months[0].forwardRunwayMonths).toBeCloseTo(rich.months[0].endingCash / -rich.months[0].netCash, 9);
    expect(run({ openingCash: 0 }).months[0].forwardRunwayMonths).toBe(0);
    const earning = run({ ...FAST, pilotFee: 400000, openingCash: 1_000_000 });
    expect(earning.months.some((m) => m.forwardRunwayMonths === null)).toBe(true);
  });

  it('peak funding need is the deepest the balance goes below zero, and nothing when it never does', () => {
    const r = run();
    expect(r.peakFundingNeed).toBeCloseTo(-r.lowestCash, 6);
    expect(r.peakFundingNeed).toBeGreaterThan(0);
    expect(run({ openingCash: 100_000_000 }).peakFundingNeed).toBe(0);
    // Funding exactly equal to the need keeps cash at zero.
    const funded = run({ fundingAmount: Math.ceil(r.peakFundingNeed), fundingMonth: 1 });
    expect(funded.peakFundingNeed).toBe(0);
  });

  it('never lets deferred revenue go negative', () => {
    for (const s of SCENARIO_IDS) expect(runModel(assumptionsFor(s)).months.every((m) => m.deferredRevenue > -1e-6)).toBe(true);
  });

  it('keeps marketplace revenue out of core revenue, gross profit and break-even', () => {
    const off = run(FAST);
    const on = run({ ...FAST, marketplaceEnabled: 1, marketplaceGmvPerActiveUserMonth: 5 });
    expect(sum(off.months.map((m) => m.revenueMarketplace))).toBe(0);
    expect(sum(on.months.map((m) => m.revenueMarketplace))).toBeGreaterThan(0);
    expect(on.months.map((m) => m.revenueCore)).toEqual(off.months.map((m) => m.revenueCore));
    expect(on.months.map((m) => m.grossProfit)).toEqual(off.months.map((m) => m.grossProfit));
    expect(on.breakEven.month).toBe(off.breakEven.month);
    expect(on.months[35].revenueTotal).toBeCloseTo(on.months[35].revenueCore + on.months[35].revenueMarketplace, 9);
    // Commission is 12% of volume: active students x $5 x 0.12.
    expect(on.months[35].revenueMarketplace).toBeCloseTo(on.months[35].activeStudentsTotal * 5 * 0.12, 6);
  });
});

describe('warning thresholds (each has a case that raises it and one that does not)', () => {
  it('runway: raised when cash runs out inside the threshold, quiet when cash is ample', () => {
    const tight = run({ openingCash: 0 });
    expect(ids(tight)).toContain('runway');
    expect(tight.warnings.find((w) => w.id === 'runway')?.severity).toBe('critical');
    expect(ids(run({ openingCash: 100_000_000 }))).not.toContain('runway');
  });

  it('runway: the threshold is exclusive at the boundary', () => {
    const r = run();
    expect(r.runwayMonths).toBe(3);
    expect(ids(run({ runwayThresholdMonths: 3 }))).not.toContain('runway'); // 3 < 3 is false
    expect(ids(run({ runwayThresholdMonths: 4 }))).toContain('runway');
  });

  it('margin: raised when gross margin is under the threshold, quiet when it is above it', () => {
    expect(ids(run({ grossMarginThreshold: 0.99 }))).toContain('margin');
    expect(ids(run({ grossMarginThreshold: 0 }))).not.toContain('margin');
  });

  it('capacity: raised when implementation demand outruns the delivery team, quiet when it does not', () => {
    const short = run({ headsDeliveryY1: 0, headsDeliveryY2: 0, headsDeliveryY3: 0 });
    expect(ids(short)).toContain('capacity');
    expect(short.months.some((m) => m.contractorOverflowHours > 0)).toBe(true);
    const roomy = run({ headsDeliveryY1: 10, headsDeliveryY2: 10, headsDeliveryY3: 10 });
    expect(ids(roomy)).not.toContain('capacity');
    expect(roomy.months.every((m) => m.contractorOverflowHours === 0)).toBe(true);
  });

  it('capacity: overflow hours are bought at the contractor rate', () => {
    const r = run({ headsDeliveryY1: 0, contractorHourlyCost: 100, implementationThirdPartyCost: 0, supportCostPerCustomerMonth: 0 });
    const m = r.months.find((x) => x.contractorOverflowHours > 0);
    expect(m?.cogsImplementation).toBeCloseTo((m?.contractorOverflowHours ?? 0) * 100, 6);
  });

  it('AI: raised when AI cost outruns the revenue that funds it, quiet when it does not', () => {
    expect(ids(runModel(assumptionsFor('highAi')))).toContain('ai');
    expect(ids(run())).not.toContain('ai');
    expect(ids(run({ aiRequestsPerActiveUserMonth: 0 }))).not.toContain('ai');
  });

  it('AI: a high enough overage price covers the cost', () => {
    expect(ids(run({ ...assumptionsFor('highAi'), aiOveragePricePer1000: 1000 }))).not.toContain('ai');
  });

  it('paid-pilot gate: shown whenever pilots are modelled, absent when there are none', () => {
    expect(ids(run())).toContain('paid-pilot-gate');
    expect(run().warnings.find((w) => w.id === 'paid-pilot-gate')?.severity).toBe('critical');
    expect(ids(run({ outreachAccountsPerMonth: 0 }))).not.toContain('paid-pilot-gate');
  });

  it('marketplace: noted when on, silent when off', () => {
    expect(ids(run({ marketplaceEnabled: 1 }))).toContain('marketplace-dependence');
    expect(ids(run())).not.toContain('marketplace-dependence');
  });

  it('marketplace: warns when the plan only breaks even with it', () => {
    const r = run({ ...FAST, marketplaceEnabled: 1, marketplaceGmvPerActiveUserMonth: 100, marketplaceCommissionPct: 1, outreachAccountsPerMonth: 3 });
    const w = r.warnings.find((x) => x.id === 'marketplace-dependence');
    expect(w).toBeDefined();
    expect(['warning', 'info']).toContain(w?.severity);
  });

  it('minimum: noted when the annual minimum sets the price', () => {
    expect(ids(run({ annualScopeStudents: 1000 }))).toContain('minimum-binds');
    expect(ids(run())).not.toContain('minimum-binds');
  });

  it('pilot length: noted when it departs from the 26-week code rule', () => {
    expect(ids(run({ pilotMonths: 3 }))).toContain('pilot-length');
    expect(ids(run())).not.toContain('pilot-length');
  });
});

describe('scenarios', () => {
  it('are the twelve the brief names, each unique', () => {
    expect(SCENARIOS).toHaveLength(12);
    expect(new Set(SCENARIO_IDS).size).toBe(12);
    expect(SCENARIOS.map((s) => s.label)).toEqual([
      'Conservative', 'Base', 'Ambitious', 'Downside / delayed sales', 'Long procurement cycle', 'Pilot-heavy',
      'Annual-contract-heavy', 'High AI usage', 'Low student adoption', 'High implementation cost', 'Low conversion', 'High conversion',
    ]);
  });

  it('Base is the defaults; every other scenario changes something', () => {
    expect(assumptionsFor('base')).toEqual(base);
    for (const s of SCENARIOS.filter((x) => x.id !== 'base')) {
      expect(Object.keys(s.patch).length, s.id).toBeGreaterThan(0);
      expect(assumptionsFor(s.id), s.id).not.toEqual(base);
    }
  });

  it('every scenario patch names a real input within its bounds', () => {
    for (const s of SCENARIOS) {
      expect(hasErrors(validate(s.patch)), s.id).toBe(false);
      for (const k of Object.keys(s.patch)) expect(FIELDS.some((f) => f.key === k), `${s.id}.${k}`).toBe(true);
    }
  });

  it('switching scenario changes the results in the direction the scenario names', () => {
    const arr = (id: Parameters<typeof assumptionsFor>[0]) => runModel(assumptionsFor(id)).months[35].arr;
    expect(arr('highConversion')).toBeGreaterThan(arr('base'));
    expect(arr('lowConversion')).toBeLessThan(arr('base'));
    expect(arr('ambitious')).toBeGreaterThan(arr('base'));
    expect(arr('conservative')).toBeLessThan(arr('base'));
    expect(arr('downside')).toBeLessThan(arr('base'));
    expect(runModel(assumptionsFor('highImplementation')).lowestCash).toBeLessThan(runModel(assumptionsFor('base')).lowestCash);
    expect(runModel(assumptionsFor('highAi')).months.reduce((t, m) => t + m.cogsAi, 0)).toBeGreaterThan(runModel(assumptionsFor('base')).months.reduce((t, m) => t + m.cogsAi, 0));
    expect(runModel(assumptionsFor('lowAdoption')).months[35].activeStudentsTotal).toBeLessThan(runModel(assumptionsFor('base')).months[35].activeStudentsTotal);
    // Longer procurement pushes first cash later.
    const firstSigned = (id: Parameters<typeof assumptionsFor>[0]) => runModel(assumptionsFor(id)).months.findIndex((m) => m.pilotsSigned > 0);
    expect(firstSigned('longProcurement')).toBeGreaterThanOrEqual(firstSigned('base'));
  });

  it('pilot-heavy books more pilot revenue and annual-heavy books direct annual deals', () => {
    const pilots = (id: Parameters<typeof assumptionsFor>[0]) => sum(runModel(assumptionsFor(id)).months.map((m) => m.pilotsSigned));
    expect(pilots('pilotHeavy')).toBeGreaterThan(pilots('base'));
    expect(sum(runModel(assumptionsFor('annualHeavy')).months.map((m) => m.directAnnualSigned))).toBeGreaterThan(0);
    expect(sum(run().months.map((m) => m.directAnnualSigned))).toBe(0);
  });

  it('keeps a founder\'s edit on top of the scenario patch', () => {
    expect(assumptionsFor('conservative', { outreachAccountsPerMonth: 99 }).outreachAccountsPerMonth).toBe(99);
    expect(assumptionsFor('conservative').outreachAccountsPerMonth).toBe(12);
  });

  it('summarises all twelve on one base', () => {
    const all = summariseAll();
    expect(all.map((s) => s.id)).toEqual([...SCENARIO_IDS]);
    expect(scenarioById('base').label).toBe('Base');
  });

  // Scenario snapshots. Rounded so a floating-point wobble is not a change; a real change shows in the diff.
  it('snapshots every scenario\'s headline results', () => {
    const rounded = summariseAll().map((s) => ({
      id: s.id,
      arrEnd: Math.round(s.arrEnd / 100) * 100,
      revenueYear3: Math.round(s.revenueYear3 / 100) * 100,
      lowestCash: Math.round(s.lowestCash / 100) * 100,
      breakEvenMonth: s.breakEvenMonth,
      runwayMonths: s.runwayMonths,
    }));
    expect(rounded).toMatchInlineSnapshot(`
      [
        {
          "arrEnd": 21900,
          "breakEvenMonth": null,
          "id": "conservative",
          "lowestCash": -1208300,
          "revenueYear3": 83500,
          "runwayMonths": 3,
        },
        {
          "arrEnd": 109500,
          "breakEvenMonth": null,
          "id": "base",
          "lowestCash": -724100,
          "revenueYear3": 332400,
          "runwayMonths": 3,
        },
        {
          "arrEnd": 372400,
          "breakEvenMonth": 35,
          "id": "ambitious",
          "lowestCash": -171600,
          "revenueYear3": 947500,
          "runwayMonths": 3,
        },
        {
          "arrEnd": 60000,
          "breakEvenMonth": null,
          "id": "downside",
          "lowestCash": -1030400,
          "revenueYear3": 199200,
          "runwayMonths": 3,
        },
        {
          "arrEnd": 82400,
          "breakEvenMonth": null,
          "id": "longProcurement",
          "lowestCash": -908300,
          "revenueYear3": 304600,
          "runwayMonths": 3,
        },
        {
          "arrEnd": 154000,
          "breakEvenMonth": null,
          "id": "pilotHeavy",
          "lowestCash": -260600,
          "revenueYear3": 612600,
          "runwayMonths": 3,
        },
        {
          "arrEnd": 206100,
          "breakEvenMonth": null,
          "id": "annualHeavy",
          "lowestCash": -696000,
          "revenueYear3": 386100,
          "runwayMonths": 3,
        },
        {
          "arrEnd": 109500,
          "breakEvenMonth": null,
          "id": "highAi",
          "lowestCash": -884500,
          "revenueYear3": 400100,
          "runwayMonths": 3,
        },
        {
          "arrEnd": 107500,
          "breakEvenMonth": null,
          "id": "lowAdoption",
          "lowestCash": -709200,
          "revenueYear3": 330500,
          "runwayMonths": 3,
        },
        {
          "arrEnd": 109500,
          "breakEvenMonth": null,
          "id": "highImplementation",
          "lowestCash": -894800,
          "revenueYear3": 332400,
          "runwayMonths": 4,
        },
        {
          "arrEnd": 24500,
          "breakEvenMonth": null,
          "id": "lowConversion",
          "lowestCash": -1006100,
          "revenueYear3": 173700,
          "runwayMonths": 3,
        },
        {
          "arrEnd": 195600,
          "breakEvenMonth": null,
          "id": "highConversion",
          "lowestCash": -642800,
          "revenueYear3": 397000,
          "runwayMonths": 3,
        },
      ]
    `);
  });
});

describe('input validation', () => {
  it('refuses non-numbers, NaN and infinity', () => {
    for (const bad of ['12', null, undefined, Number.NaN, Number.POSITIVE_INFINITY, {}]) {
      const issues = validate({ platformPricePerStudent: bad as unknown });
      expect(issues.some((i) => i.severity === 'error'), String(bad)).toBe(true);
    }
  });

  it('refuses a negative price and a rate outside 0 to 1', () => {
    expect(hasErrors(validate({ platformPricePerStudent: -1 }))).toBe(true);
    expect(hasErrors(validate({ replyRate: 1.2 }))).toBe(true);
    expect(hasErrors(validate({ replyRate: -0.1 }))).toBe(true);
    expect(hasErrors(validate({ replyRate: 0.2, platformPricePerStudent: 18 }))).toBe(false);
  });

  it('refuses a fractional month count and a pilot cohort outside 10 to 200', () => {
    expect(hasErrors(validate({ salesCycleMonths: 6.5 }))).toBe(true);
    expect(hasErrors(validate({ pilotCohortStudents: 5 }))).toBe(true);
    expect(hasErrors(validate({ pilotCohortStudents: 250 }))).toBe(true);
    expect(hasErrors(validate({ pilotCohortStudents: 150 }))).toBe(false);
  });

  it('refuses a gate month or an obligation month outside the 36-month horizon', () => {
    expect(hasErrors(validate({ firstPaidPilotMonth: 37 }))).toBe(true);
    expect(hasErrors(validate({ obligationCounselMonth: 0 }))).toBe(true);
  });

  it('warns, without refusing, on an implementation fee outside the brief\'s range and on a pilot length other than 6 months', () => {
    const fee = validate({ implementationFee: 20000 });
    expect(hasErrors(fee)).toBe(false);
    expect(fee.some((i) => i.severity === 'warning')).toBe(true);
    expect(validate({ implementationFee: 60000 })).toEqual([]);
    expect(validate({ pilotMonths: 3 }).some((i) => i.severity === 'warning')).toBe(true);
    expect(validate({ pilotMonths: 6 })).toEqual([]);
  });

  it('accepts the defaults, and every default sits inside its own bounds', () => {
    expect(validate(base)).toEqual([]);
    for (const f of FIELDS) {
      expect(f.default, f.key).toBeGreaterThanOrEqual(f.min);
      expect(f.default, f.key).toBeLessThanOrEqual(f.max);
    }
  });

  it('has a field for every assumption and no field twice', () => {
    expect(new Set(FIELDS.map((f) => f.key)).size).toBe(FIELDS.length);
    expect(Object.keys(base).sort()).toEqual(FIELDS.map((f) => f.key).sort());
  });

  it('labels every default with where it came from, and calls the cash and price placeholders placeholders', () => {
    expect(FIELDS.every((f) => ['brief', 'repo', 'placeholder', 'assumption'].includes(f.source))).toBe(true);
    expect(FIELDS.find((f) => f.key === 'openingCash')?.source).toBe('placeholder');
    expect(FIELDS.find((f) => f.key === 'pilotFee')?.source).toBe('placeholder');
    expect(FIELDS.find((f) => f.key === 'platformPricePerStudent')?.source).toBe('brief');
  });

  it('holds the brief\'s planning assumptions as the defaults', () => {
    expect(base).toMatchObject({
      studentPremiumMonthly: 8.99, studentPremiumAnnual: 69, platformPricePerStudent: 18, platformAnnualMinimum: 30000,
      aiPoolPerStudentYear: 2400, aiOveragePricePer1000: 30, premiumSupportPct: 0.15, premiumSupportMinimum: 15000,
      marketplaceCommissionPct: 0.12, marketplaceEnabled: 0,
    });
    expect(base.implementationFee).toBeGreaterThanOrEqual(35000);
    expect(base.implementationFee).toBeLessThanOrEqual(150000);
  });
});

describe('currency formatting without false precision', () => {
  it('rounds to three significant figures', () => {
    expect(formatUsd(1234567)).toBe('$1.23M');
    expect(formatUsd(456789)).toBe('$457k');
    expect(formatUsd(12345)).toBe('$12.3k');
    expect(formatUsd(845)).toBe('$845');
    expect(formatUsd(100000)).toBe('$100k');
    expect(formatUsd(-1500)).toBe('-$1.5k');
    expect(formatUsd(0)).toBe('$0');
    expect(formatUsd(0.2)).toBe('$0');
  });

  it('rolls over a unit boundary instead of printing scientific notation', () => {
    expect(formatUsd(999999)).toBe('$1M');
    expect(formatUsd(999500)).toBe('$1M');
    expect(formatUsd(999400)).toBe('$999k');
  });

  it('reads missing and non-finite values as a dash', () => {
    expect(formatUsd(null)).toBe('–');
    expect(formatUsd(undefined)).toBe('–');
    expect(formatUsd(Number.NaN)).toBe('–');
    expect(formatPct(null)).toBe('–');
    expect(formatCount(null)).toBe('–');
  });

  it('shows whole dollars when exactness is asked for, and counts to one decimal', () => {
    expect(formatUsdExact(1234567.4)).toBe('$1,234,567');
    expect(formatUsdExact(-1234.6)).toBe('-$1,235');
    expect(formatCount(0.258)).toBe('0.3');
    expect(formatCount(12.6)).toBe('13');
    expect(formatCount(0.01)).toBe('0');
    expect(formatPct(0.153)).toBe('15%');
  });
});

describe('sensitivity matrices', () => {
  it('conversion rate against sales-cycle length: five by five, better with higher conversion and shorter cycles', () => {
    const g = conversionVsCycle(base, 'arrEnd');
    expect(g.rows).toHaveLength(5);
    expect(g.cols).toHaveLength(5);
    expect(g.cells).toHaveLength(5);
    expect(g.cells.every((r) => r.length === 5)).toBe(true);
    for (let c = 0; c < 5; c++) for (let r = 1; r < 5; r++) expect(g.cells[r][c] as number).toBeGreaterThanOrEqual(g.cells[r - 1][c] as number);
    for (let r = 0; r < 5; r++) for (let c = 1; c < 5; c++) expect(g.cells[r][c] as number).toBeLessThanOrEqual(g.cells[r][c - 1] as number);
    expect(g.cells[0][4] as number).toBeLessThan(g.cells[4][0] as number);
  });

  it('a cell equals a full run with the same two inputs', () => {
    const g = conversionVsCycle(base, 'arrEnd');
    expect(g.cells[2][1]).toBeCloseTo(runModel({ ...base, pilotToAnnualConversion: g.rows[2], salesCycleMonths: g.cols[1] }).months[35].arr, 6);
  });

  it('AI cost against overage price: dearer AI hurts, a higher overage price helps', () => {
    const hot = { ...base, aiRequestsPerActiveUserMonth: 700 };
    const g = aiCostVsOverage(hot, 'aiNet');
    for (let c = 0; c < 5; c++) for (let r = 1; r < 5; r++) expect(g.cells[r][c] as number).toBeLessThanOrEqual(g.cells[r - 1][c] as number);
    for (let r = 0; r < 5; r++) for (let c = 1; c < 5; c++) expect(g.cells[r][c] as number).toBeGreaterThanOrEqual(g.cells[r][c - 1] as number);
  });

  it('with no overage in play, the AI matrix is flat across price (the control)', () => {
    const g = aiCostVsOverage(base, 'aiNet');
    for (const row of g.cells) expect(new Set(row.map((v) => Math.round(v as number))).size).toBe(1);
  });
});

describe('exports', () => {
  const r = run();
  const lines = (s: string) => s.trimEnd().split('\n');

  it('CSV: a header and one row per month, every row naming its scenario and basis', () => {
    const csv = lines(monthlyCsv(r, 'base'));
    expect(csv).toHaveLength(37);
    const header = csv[0].split(',');
    expect(header[0]).toBe('scenario');
    const basis = header.indexOf('basis');
    expect(basis).toBeGreaterThan(0);
    for (const row of csv.slice(1)) {
      const cells = row.split(',');
      expect(cells).toHaveLength(header.length);
      expect(cells[0]).toBe('base');
      expect(cells[basis]).toBe('forecast');
    }
  });

  it('CSV: carries the same numbers as the model, to whole dollars', () => {
    const csv = lines(monthlyCsv(run(FAST), 'base'));
    const header = csv[0].split(',');
    const col = header.indexOf('ending_cash_usd');
    const model = run(FAST);
    expect(Number(csv[36].split(',')[col])).toBe(Math.round(model.months[35].endingCash));
    expect(header).toContain('revenue_marketplace_usd_separate');
  });

  it('CSV: a cell with a comma or quote is quoted, and one that opens like a formula is defused', () => {
    expect(csvCell('a,b')).toBe('"a,b"');
    expect(csvCell('say "hi"')).toBe('"say ""hi"""');
    expect(csvCell('=SUM(A1)')).toBe("'=SUM(A1)");
    expect(csvCell('+1')).toBe("'+1");
    expect(csvCell('@x')).toBe("'@x");
    expect(csvCell('plain')).toBe('plain');
    expect(csvCell(null)).toBe('');
    expect(csvCell(3.5)).toBe('3.5');
    expect(csvCell(Number.NaN)).toBe('');
  });

  it('assumptions CSV: one row per input, with its source and label', () => {
    const csv = lines(assumptionsCsv(r, 'base'));
    expect(csv).toHaveLength(FIELDS.length + 1);
    expect(csv.find((l) => l.includes('openingCash'))).toMatch(/PLACEHOLDER/);
  });

  it('JSON: parses, names its schema, basis and disclaimer, and carries 36 months', () => {
    const doc = JSON.parse(scenarioJson(r, 'base', '2026-10-05T00:00:00.000Z'));
    expect(doc.schema).toBe(SCHEMA);
    expect(doc.basis).toBe('forecast');
    expect(doc.disclaimer).toBe(DISCLAIMER);
    expect(doc.generatedAt).toBe('2026-10-05T00:00:00.000Z');
    expect(doc.scenario.id).toBe('base');
    expect(doc.months).toHaveLength(36);
    expect(doc.assumptions).toHaveLength(FIELDS.length);
    expect(doc.months.every((m: { basis: string }) => m.basis === 'forecast')).toBe(true);
  });

  it('Markdown: has the disclaimer, labels figures Forecast, and lists every assumption group', () => {
    const md = scenarioMarkdown(r, 'base');
    expect(md).toContain(DISCLAIMER);
    expect(md).toMatch(/\*\*Forecast\*\*/);
    for (const h of ['## Annual summary (Forecast)', '## Unit economics (Forecast)', '## Break-even and cash (Forecast)', '## Warnings', '## Assumptions', '## Professional review required']) expect(md).toContain(h);
    for (const g of ['Pricing', 'Funnel', 'Required obligations', 'Thresholds']) expect(md).toContain(`### ${g}`);
    expect(md).toContain('| CAC |');
    expect(md).toMatch(/\[REVIEW: tax\]/);
  });

  it('Markdown: reflects the scenario it was asked for', () => {
    const cons = scenarioMarkdown(runModel(assumptionsFor('conservative')), 'conservative');
    expect(cons).toContain('Conservative');
    expect(cons).not.toBe(scenarioMarkdown(r, 'base'));
  });

  it('prompt: carries the assumptions, the formulas and the ground rules', () => {
    const p = assumptionsPrompt(r, 'base');
    expect(p).toContain('Student Premium, monthly price: $8.99');
    expect(p).toContain('Pilot fee, per pilot: $20,000');
    expect(p).toContain('AI cost per governed request: $0.0146');
    expect(p).toContain('CAC = sales and marketing spend / new customers acquired');
    expect(p).toContain('CAC payback months = CAC / monthly gross profit per customer');
    expect(p).toContain('LTV = annual recurring revenue x gross margin / annual logo churn');
    expect(p).toMatch(/not an approved price/);
    expect(p).toMatch(/NO-GO/);
  });

  it('board summary: every scenario, the decisions asked, the placeholders and the review flags', () => {
    const md = boardSummary(r, 'base', summariseAll());
    for (const s of SCENARIOS) expect(md).toContain(s.label);
    expect(md).toContain(DISCLAIMER);
    expect(md).toMatch(/DRAFT, INTERNAL/);
    expect(md).toContain('## Decisions this asks of the board');
    expect(md).toContain('## Placeholders that must become actuals');
    expect(md).toMatch(/Opening cash/);
    expect(md).toMatch(/\[REVIEW: counsel\]/);
    expect(md).not.toMatch(/guarantee[sd]? (revenue|growth|returns)/i);
  });

  it('writes no secret-shaped or contact data into any export', () => {
    const all = [monthlyCsv(r, 'base'), assumptionsCsv(r, 'base'), scenarioJson(r, 'base', 'x'), scenarioMarkdown(r, 'base'), assumptionsPrompt(r, 'base'), boardSummary(r, 'base', summariseAll())].join('\n');
    expect(all).not.toMatch(/@[a-z0-9-]+\.[a-z]{2,}/i);
    expect(all).not.toMatch(/sk_(live|test)_|eyJ[A-Za-z0-9_-]{20,}|service_role/);
  });
});
