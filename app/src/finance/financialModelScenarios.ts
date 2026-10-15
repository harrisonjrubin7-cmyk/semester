import { DEFAULT_ASSUMPTIONS, withOverrides } from './financialModelFields';
import type { Assumptions, Scenario, ScenarioId } from './financialModelTypes';
import { runModel } from './financialModelEngine';

/**
 * Twelve scenarios, each a patch on Base.
 *
 * Every patch is a planning assumption chosen to ask a question, not a
 * forecast of what will happen. Base is the defaults in
 * `financialModelFields.ts`: a lean, founder-led plan in which the paid-pilot
 * gate flips in month 7. None of these is an approved target.
 */
export const SCENARIOS: readonly Scenario[] = [
  {
    id: 'conservative',
    label: 'Conservative',
    description: 'Lower outreach, replies and closes, weaker conversion and retention, slower cycle. The case a cautious reviewer would run first.',
    patch: { outreachAccountsPerMonth: 12, replyRate: 0.12, pilotCloseRate: 0.3, pilotToAnnualConversion: 0.5, institutionRetention: 0.8, salesCycleMonths: 8, studentPremiumConversion: 0.02 },
  },
  { id: 'base', label: 'Base', description: 'The defaults: lean team, founder-led sales, paid pilots allowed from month 7.', patch: {} },
  {
    id: 'ambitious',
    label: 'Ambitious',
    description: 'More outreach and stronger stage rates, a faster cycle and an earlier gate. Needs sales capacity the plan does not yet have.',
    patch: { outreachAccountsPerMonth: 35, replyRate: 0.25, discoveryRate: 0.65, pilotCloseRate: 0.45, pilotToAnnualConversion: 0.7, institutionRetention: 0.9, expansionRate: 0.15, salesCycleMonths: 5, firstPaidPilotMonth: 5 },
  },
  {
    id: 'downside',
    label: 'Downside / delayed sales',
    description: 'The gate slips to month 12, closes are harder and customers pay slowly. Tests how long cash lasts when nothing closes on time.',
    patch: { firstPaidPilotMonth: 12, salesCycleMonths: 9, pilotCloseRate: 0.25, paymentTermsDays: 75 },
  },
  {
    id: 'longProcurement',
    label: 'Long procurement cycle',
    description: 'Twelve-month cycles, ninety-day payment terms and a later gate. Higher-ed procurement at its slowest.',
    patch: { salesCycleMonths: 12, paymentTermsDays: 90, firstPaidPilotMonth: 9 },
  },
  {
    id: 'pilotHeavy',
    label: 'Pilot-heavy',
    description: 'Many pilots sign but fewer convert. Revenue skews to pilot and implementation fees, with a thin recurring base.',
    patch: { outreachAccountsPerMonth: 30, pilotCloseRate: 0.5, pilotToAnnualConversion: 0.45, pilotFee: 25000 },
  },
  {
    id: 'annualHeavy',
    label: 'Annual-contract-heavy',
    description: 'Forty per cent of closes skip the pilot and sign annual, at the cost of a longer cycle for those deals.',
    patch: { directAnnualShare: 0.4, directAnnualExtraCycleMonths: 4, pilotToAnnualConversion: 0.7 },
  },
  {
    id: 'highAi',
    label: 'High AI usage',
    description: 'Students make about eleven times the base number of governed AI requests. Tests whether the pool, the overage price and the included margin hold.',
    patch: { aiRequestsPerActiveUserMonth: 700 },
  },
  {
    id: 'lowAdoption',
    label: 'Low student adoption',
    description: 'Half the invitations land and half of those activate; Premium conversion falls. Tests how much of the plan depends on students using the product.',
    patch: { studentInviteRate: 0.5, studentActivationRate: 0.25, studentPremiumConversion: 0.01 },
  },
  {
    id: 'highImplementation',
    label: 'High implementation cost',
    description: 'Implementations take twice the hours at a higher contractor rate, with no delivery head in year 1.',
    patch: { implementationHoursPerProject: 800, contractorHourlyCost: 120, headsDeliveryY1: 0 },
  },
  {
    id: 'lowConversion',
    label: 'Low conversion',
    description: 'Fewer pilots meet their success criteria and fewer proposals close. The plan the pilot evidence would disprove.',
    patch: { pilotToAnnualConversion: 0.3, pilotSuccessRate: 0.5, pilotCloseRate: 0.25 },
  },
  {
    id: 'highConversion',
    label: 'High conversion',
    description: 'Most successful pilots convert and most renew. The plan a strong value report would support.',
    patch: { pilotToAnnualConversion: 0.85, pilotSuccessRate: 0.85, institutionRetention: 0.92 },
  },
];

export const SCENARIO_IDS: readonly ScenarioId[] = SCENARIOS.map((s) => s.id);

export const scenarioById = (id: ScenarioId): Scenario => {
  const s = SCENARIOS.find((x) => x.id === id);
  if (!s) throw new Error(`Unknown scenario ${id}`);
  return s;
};

/** The assumptions a scenario runs on: Base, then the scenario's patch, then the founder's edits. */
export const assumptionsFor = (id: ScenarioId, edits: Partial<Assumptions> = {}): Assumptions =>
  withOverrides(DEFAULT_ASSUMPTIONS, scenarioById(id).patch, edits);

export interface ScenarioSummary {
  id: ScenarioId;
  label: string;
  arrEnd: number;
  revenueYear3: number;
  grossMarginYear3: number | null;
  cumulativeOperatingResult: number;
  lowestCash: number;
  peakFundingNeed: number;
  endingCash: number;
  breakEvenMonth: number | null;
  runwayMonths: number | null;
  cac: number | null;
  ltvToCac: number | null;
  warnings: string[];
}

/** Every scenario on the same editable base, side by side. */
export function summariseAll(edits: Partial<Assumptions> = {}): ScenarioSummary[] {
  return SCENARIOS.map((s) => {
    const r = runModel(assumptionsFor(s.id, edits));
    const last = r.months[r.months.length - 1];
    return {
      id: s.id,
      label: s.label,
      arrEnd: last.arr,
      revenueYear3: r.years[2].revenueCore,
      grossMarginYear3: r.years[2].grossMarginPct,
      cumulativeOperatingResult: r.years.reduce((t, y) => t + y.operatingResult, 0),
      lowestCash: r.lowestCash,
      peakFundingNeed: r.peakFundingNeed,
      endingCash: last.endingCash,
      breakEvenMonth: r.breakEven.month,
      runwayMonths: r.runwayMonths,
      cac: r.unit.cac,
      ltvToCac: r.unit.ltvToCac,
      warnings: r.warnings.map((w) => w.id),
    };
  });
}

export type SensitivityMetric = 'arrEnd' | 'endingCash' | 'grossMarginYear3' | 'aiNet';

export interface SensitivityGrid {
  rowLabel: string;
  colLabel: string;
  rows: number[];
  cols: number[];
  metric: SensitivityMetric;
  /** cells[row][col] */
  cells: (number | null)[][];
}

const metricOf = (a: Assumptions, metric: SensitivityMetric): number | null => {
  const r = runModel(a);
  const last = r.months[r.months.length - 1];
  switch (metric) {
    case 'arrEnd':
      return last.arr;
    case 'endingCash':
      return last.endingCash;
    case 'grossMarginYear3':
      return r.years[2].grossMarginPct;
    case 'aiNet':
      return r.months.reduce((t, m) => t + m.revenueAiOverage - m.cogsAi, 0);
  }
};

/** Pilot-to-annual conversion rate (rows) against sales-cycle length in months (columns). */
export function conversionVsCycle(base: Assumptions, metric: SensitivityMetric = 'arrEnd', rows = [0.2, 0.35, 0.5, 0.65, 0.8], cols = [3, 6, 9, 12, 15]): SensitivityGrid {
  return {
    rowLabel: 'Successful pilot to annual contract',
    colLabel: 'Sales cycle (months)',
    rows,
    cols,
    metric,
    cells: rows.map((conv) => cols.map((cycle) => metricOf({ ...base, pilotToAnnualConversion: conv, salesCycleMonths: cycle }, metric))),
  };
}

/** AI cost per request (rows) against AI overage price per 1,000 requests (columns). */
export function aiCostVsOverage(base: Assumptions, metric: SensitivityMetric = 'aiNet', rows = [0.005, 0.0146, 0.03, 0.06, 0.1], cols = [10, 20, 30, 45, 60]): SensitivityGrid {
  return {
    rowLabel: 'AI cost per request ($)',
    colLabel: 'Overage price per 1,000 requests ($)',
    rows,
    cols,
    metric,
    cells: rows.map((cost) => cols.map((price) => metricOf({ ...base, aiCostPerRequest: cost, aiOveragePricePer1000: price }, metric))),
  };
}
