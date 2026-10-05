import { START_MONTH } from './financialModelFields';
import { group } from './financialModelFormat';
import {
  MODEL_MONTHS,
  type Assumptions,
  type BreakEven,
  type FunnelStage,
  type ModelResult,
  type ModelWarning,
  type MonthRow,
  type UnitEconomics,
  type YearSummary,
} from './financialModelTypes';

/**
 * The 36-month engine. Pure and deterministic: no clock, no storage, no
 * randomness, so the same assumptions always give the same months and a
 * scenario can be exported, re-imported and compared.
 *
 * How it works, in the order it computes:
 *
 *  1. Funnel. Accounts contacted each month pass through the stage rates. A
 *     signed pilot lands `salesCycleMonths` after first contact, and never
 *     before `firstPaidPilotMonth`: a paid pilot is NO-GO today
 *     (GO-NO-GO-DECISION.md), so deals that are ready early wait for the gate
 *     rather than being booked.
 *  2. Cohorts. A pilot that succeeds and converts becomes an annual customer
 *     `pilotMonths + conversionLagMonths` after signing. Annual customers are
 *     tracked by start month; at each anniversary the cohort shrinks by
 *     retention and its enrolled scope grows by expansion.
 *  3. Recognition and billing are separate. Revenue is recognised over the
 *     service period; cash follows the invoice by the payment terms.
 *  4. Costs, cash, then the metrics the brief defines.
 *
 * Counts are expected values and therefore fractional (0.3 of a pilot is an
 * expected value, not a customer). The display layer rounds; the engine does
 * not, so totals add up.
 */

const N = MODEL_MONTHS;
/** Months in a contract year or a calendar year; named so month arithmetic is not mistaken for a clock. */
const MONTHS_PER_YEAR = 12;
const sum = (xs: readonly number[]) => xs.reduce((a, b) => a + b, 0);
const zeros = () => new Array<number>(N + 1).fill(0); // 1-indexed; index 0 unused
const yearOf = (m: number): 1 | 2 | 3 => (Math.floor((m - 1) / 12) + 1) as 1 | 2 | 3;

export function monthLabel(m: number): string {
  const [y, mo] = START_MONTH.split('-').map(Number);
  const idx = mo - 1 + (m - 1);
  const year = y + Math.floor(idx / MONTHS_PER_YEAR);
  const month = (idx % MONTHS_PER_YEAR) + 1;
  return `${year}-${String(month).padStart(2, '0')}`;
}

const headsFor = (a: Assumptions, role: 'Founders' | 'Engineering' | 'Sales' | 'Delivery' | 'Admin', year: 1 | 2 | 3): number =>
  a[`heads${role}Y${year}` as keyof Assumptions] as number;

/** Recurring revenue of one annual institution at a given contract year (0 = first). */
function contractFees(a: Assumptions, contractYear: number) {
  const scope = a.annualScopeStudents * (1 + a.expansionRate) ** contractYear;
  const platform = Math.max(a.platformAnnualMinimum, a.platformPricePerStudent * scope);
  const support = a.premiumSupportAttachRate * Math.max(a.premiumSupportMinimum, a.premiumSupportPct * platform);
  return { scope, platform, support, minimumBinds: a.platformPricePerStudent * scope < a.platformAnnualMinimum };
}

/** Overage requests per institution per month: usage above the pooled allowance, never negative. */
const overageRequestsPerStudentMonth = (a: Assumptions) =>
  Math.max(0, a.studentInviteRate * a.studentActivationRate * a.aiRequestsPerActiveUserMonth - a.aiPoolPerStudentYear / 12);

export function runModel(a: Assumptions): ModelResult {
  // ── 1. Funnel ────────────────────────────────────────────────────────────
  const rates = [a.replyRate, a.discoveryRate, a.qualificationRate, a.demoRate, a.pilotDesignRate, a.proposalRate];
  const toProposal = rates.reduce((x, y) => x * y, 1);
  const closeYield = toProposal * a.pilotCloseRate;

  const contacted = zeros();
  for (let m = 1; m <= N; m++) contacted[m] = a.outreachAccountsPerMonth;

  const pilotNatural = zeros();
  const directNatural = zeros();
  for (let s = 1; s <= N; s++) {
    const c = s - a.salesCycleMonths;
    if (c >= 1) pilotNatural[s] = contacted[c] * closeYield * (1 - a.directAnnualShare);
    const cd = s - a.salesCycleMonths - a.directAnnualExtraCycleMonths;
    if (cd >= 1) directNatural[s] = contacted[cd] * closeYield * a.directAnnualShare;
  }
  const gate = Math.min(Math.max(a.firstPaidPilotMonth, 1), N);
  const pilotSigned = zeros();
  const directSigned = zeros();
  if (a.pilotsPerMonthOverride > 0) {
    for (let s = gate; s <= N; s++) pilotSigned[s] = a.pilotsPerMonthOverride;
  } else {
    for (let s = 1; s <= N; s++) pilotSigned[s < gate ? gate : s] += pilotNatural[s];
  }
  for (let s = 1; s <= N; s++) directSigned[s < gate ? gate : s] += directNatural[s];

  // ── 2. Pilot and customer cohorts ────────────────────────────────────────
  const yieldToAnnual = a.pilotActivationRate * a.pilotSuccessRate * a.pilotToAnnualConversion;
  const conversions = zeros();
  for (let s = 1; s <= N; s++) {
    const start = s + a.pilotMonths + a.conversionLagMonths;
    if (start <= N) conversions[start] += pilotSigned[s] * yieldToAnnual;
  }
  const starts = zeros();
  for (let m = 1; m <= N; m++) starts[m] = conversions[m] + directSigned[m];

  const pilotsInWindow = zeros(); // signed pilots whose term covers month m
  const pilotsActive = zeros(); // activated pilots whose term covers month m
  const revPilot = zeros();
  const billPilot = zeros();
  const revImpl = zeros();
  const billImpl = zeros();
  const projectsStarting = zeros();
  for (let s = 1; s <= N; s++) {
    const p = pilotSigned[s];
    const d = directSigned[s];
    projectsStarting[s] = p + d;
    billPilot[s] += p * a.pilotFee;
    billImpl[s] += (p + d) * a.implementationFee;
    for (let j = 0; j < a.pilotMonths && s + j <= N; j++) {
      pilotsInWindow[s + j] += p;
      pilotsActive[s + j] += p * a.pilotActivationRate;
      revPilot[s + j] += (p * a.pilotFee) / a.pilotMonths;
    }
    for (let j = 0; j < a.implementationMonths && s + j <= N; j++) {
      revImpl[s + j] += ((p + d) * a.implementationFee) / a.implementationMonths;
    }
  }

  const annualCustomers = zeros();
  const customersChurned = zeros();
  const revPlatform = zeros();
  const revSupport = zeros();
  const billRecurring = zeros();
  const annualActiveStudents = zeros();
  const overageRequests = zeros();
  const arrInst = zeros();
  /** ARR at month m of customers whose cohort started on or before `cutoff`; for measured NRR. */
  const arrOfCohortsThrough = (m: number, cutoff: number) => {
    let total = 0;
    for (let s = 1; s <= Math.min(cutoff, m); s++) {
      if (starts[s] === 0) continue;
      const k = Math.floor((m - s) / 12);
      const fees = contractFees(a, k);
      total += starts[s] * a.institutionRetention ** k * (fees.platform + fees.support);
    }
    return total;
  };
  for (let s = 1; s <= N; s++) {
    if (starts[s] === 0) continue;
    for (let m = s; m <= N; m++) {
      const age = m - s;
      const k = Math.floor(age / 12);
      const alive = starts[s] * a.institutionRetention ** k;
      const fees = contractFees(a, k);
      annualCustomers[m] += alive;
      revPlatform[m] += (alive * fees.platform) / 12;
      revSupport[m] += (alive * fees.support) / 12;
      arrInst[m] += alive * (fees.platform + fees.support);
      annualActiveStudents[m] += alive * fees.scope * a.studentInviteRate * a.studentActivationRate;
      overageRequests[m] += alive * fees.scope * overageRequestsPerStudentMonth(a);
      if (age % MONTHS_PER_YEAR === 0) {
        billRecurring[m] += alive * (fees.platform + fees.support);
        if (k >= 1) customersChurned[m] += starts[s] * a.institutionRetention ** (k - 1) - alive;
      }
    }
  }
  const revAiOverage = overageRequests.map((r) => (r / 1000) * a.aiOveragePricePer1000);

  // ── 3. Students ──────────────────────────────────────────────────────────
  const pilotActiveStudents = pilotsActive.map((p) => p * a.pilotCohortStudents * a.studentInviteRate * a.studentActivationRate);
  const activeInst = zeros();
  for (let m = 1; m <= N; m++) activeInst[m] = annualActiveStudents[m] + pilotActiveStudents[m];
  const instSubs = zeros();
  const directSubs = zeros();
  for (let m = 1; m <= N; m++) {
    const fresh = Math.max(0, activeInst[m] - activeInst[m - 1]);
    instSubs[m] = (m > 1 ? instSubs[m - 1] : 0) * (1 - a.studentMonthlyChurn) + fresh * a.studentPremiumConversion;
    directSubs[m] = (m > 1 ? directSubs[m - 1] : 0) * (1 - a.studentMonthlyChurn) + a.directPremiumSignupsPerMonth;
  }
  const blendedPremiumMonthly = (1 - a.annualPlanShare) * a.studentPremiumMonthly + (a.annualPlanShare * a.studentPremiumAnnual) / 12;

  // ── 4. Implementation capacity ───────────────────────────────────────────
  const demandHours = zeros();
  for (let s = 1; s <= N; s++) {
    for (let j = 0; j < a.implementationMonths && s + j <= N; j++) {
      demandHours[s + j] += (projectsStarting[s] * a.implementationHoursPerProject) / a.implementationMonths;
    }
  }

  // ── 5. Month rows ────────────────────────────────────────────────────────
  const delay = Math.round(a.paymentTermsDays / 30);
  const obligationAt = (m: number) =>
    (a.obligationSecurityMonth === m ? a.obligationSecurityAmount : 0) +
    (a.obligationAccessibilityMonth === m ? a.obligationAccessibilityAmount : 0) +
    (a.obligationCounselMonth === m ? a.obligationCounselAmount : 0) +
    (a.obligationEntityInsuranceMonth === m ? a.obligationEntityInsuranceAmount : 0);

  const rows: MonthRow[] = [];
  let cash = a.openingCash;
  let cumGp = 0;
  let cumCosts = 0;
  let billedDeferrable = 0;
  let recognisedDeferrable = 0;
  const billingsInvoiced = zeros(); // invoiced amounts, collected after the payment terms
  for (let m = 1; m <= N; m++) billingsInvoiced[m] = billPilot[m] + billImpl[m] + billRecurring[m] + revAiOverage[m];

  const burnHistory: number[] = [];
  for (let m = 1; m <= N; m++) {
    const y = yearOf(m);
    const infl = (1 + a.wageInflation) ** (y - 1);

    const subs = instSubs[m] + directSubs[m];
    const activeTotal = activeInst[m] + directSubs[m];
    const revStudent = subs * blendedPremiumMonthly;
    const revMarket = a.marketplaceEnabled ? activeTotal * a.marketplaceGmvPerActiveUserMonth * a.marketplaceCommissionPct : 0;
    const revCore = revPilot[m] + revImpl[m] + revPlatform[m] + revSupport[m] + revAiOverage[m] + revStudent;

    const aiRequests = activeTotal * a.aiRequestsPerActiveUserMonth;
    const capacity = headsFor(a, 'Delivery', y) * a.deliveryHoursPerFtePerMonth;
    const overflow = Math.max(0, demandHours[m] - capacity);
    const cogsCloud = activeTotal * a.cloudCostPerActiveUserMonth;
    const cogsAi = aiRequests * a.aiCostPerRequest;
    const cogsSupport = (annualCustomers[m] + pilotsInWindow[m]) * a.supportCostPerCustomerMonth;
    const cogsImpl = overflow * a.contractorHourlyCost + projectsStarting[m] * a.implementationThirdPartyCost;
    const cogsPay = revStudent * a.studentPaymentFeePct;
    const cogsDelivery = headsFor(a, 'Delivery', y) * a.deliveryLoadedMonthly * infl;
    const cogs = cogsCloud + cogsAi + cogsSupport + cogsImpl + cogsPay + cogsDelivery;
    const gp = revCore - cogs;

    const founderPay = headsFor(a, 'Founders', y) * a.founderLoadedMonthly * infl;
    const salesPay = headsFor(a, 'Sales', y) * a.salesLoadedMonthly * infl;
    const payroll = founderPay + headsFor(a, 'Engineering', y) * a.engineeringLoadedMonthly * infl + salesPay + headsFor(a, 'Admin', y) * a.adminLoadedMonthly * infl;
    const opex =
      payroll + a.contractorMonthly + a.marketingMonthly + a.legalComplianceMonthly + a.insuranceMonthly +
      a.accountingMonthly + a.softwareMonthly + a.travelEventsMonthly + a.otherAdminMonthly;
    const sandm = a.marketingMonthly + a.travelEventsMonthly + salesPay + a.founderSalesShare * founderPay;
    const obligations = obligationAt(m);

    const collected = (m - delay >= 1 ? billingsInvoiced[m - delay] : 0) + revStudent + revMarket;
    const inflow = collected + (a.fundingMonth === m ? a.fundingAmount : 0);
    const out = cogs + opex + obligations;
    cash += inflow - out;
    const net = collected - out;
    burnHistory.push(net);
    const recent = burnHistory.slice(-3);
    const avgNet = sum(recent) / recent.length;
    const forward = cash <= 0 ? 0 : avgNet < 0 ? cash / -avgNet : null;

    billedDeferrable += billPilot[m] + billImpl[m] + billRecurring[m];
    recognisedDeferrable += revPilot[m] + revImpl[m] + revPlatform[m] + revSupport[m];
    cumGp += gp;
    cumCosts += opex + obligations;

    const mrr = arrInst[m] / 12 + revStudent;
    rows.push({
      month: m,
      label: monthLabel(m),
      year: y,
      basis: 'forecast',
      contacted: contacted[m],
      replies: contacted[m] * rates[0],
      discoveries: contacted[m] * rates[0] * rates[1],
      qualified: contacted[m] * rates[0] * rates[1] * rates[2],
      demos: contacted[m] * rates[0] * rates[1] * rates[2] * rates[3],
      designs: contacted[m] * rates[0] * rates[1] * rates[2] * rates[3] * rates[4],
      proposals: contacted[m] * toProposal,
      pilotsSigned: pilotSigned[m],
      directAnnualSigned: directSigned[m],
      pilotsActive: pilotsActive[m],
      annualStarts: starts[m],
      annualCustomers: annualCustomers[m],
      customersChurned: customersChurned[m],
      activeInstitutionalStudents: activeInst[m],
      premiumSubscribers: subs,
      activeStudentsTotal: activeTotal,
      aiRequests,
      aiOverageRequests: overageRequests[m],
      revenuePilot: revPilot[m],
      revenueImplementation: revImpl[m],
      revenuePlatform: revPlatform[m],
      revenueSupport: revSupport[m],
      revenueAiOverage: revAiOverage[m],
      revenueStudentPremium: revStudent,
      revenueCore: revCore,
      revenueMarketplace: revMarket,
      revenueTotal: revCore + revMarket,
      cogsCloud,
      cogsAi,
      cogsSupport,
      cogsImplementation: cogsImpl,
      cogsPayments: cogsPay,
      cogsDeliveryPayroll: cogsDelivery,
      cogsTotal: cogs,
      grossProfit: gp,
      grossMarginPct: revCore > 0 ? gp / revCore : null,
      opexPayroll: payroll,
      opexContractors: a.contractorMonthly,
      opexMarketing: a.marketingMonthly,
      opexLegalCompliance: a.legalComplianceMonthly,
      opexInsurance: a.insuranceMonthly,
      opexAccounting: a.accountingMonthly,
      opexSoftware: a.softwareMonthly,
      opexTravelEvents: a.travelEventsMonthly,
      opexOther: a.otherAdminMonthly,
      opexTotal: opex,
      salesAndMarketing: sandm,
      operatingResult: gp - opex,
      obligations,
      billings: billingsInvoiced[m] + revStudent + revMarket,
      collections: collected,
      cashOut: out,
      netCash: inflow - out,
      endingCash: cash,
      deferredRevenue: billedDeferrable - recognisedDeferrable,
      forwardRunwayMonths: forward,
      mrr,
      arr: mrr * 12,
      implementationDemandHours: demandHours[m],
      deliveryCapacityHours: capacity,
      contractorOverflowHours: overflow,
      cumulativeGrossProfit: cumGp,
      cumulativeOpexAndObligations: cumCosts,
    });
  }

  // ── 6. Summaries ─────────────────────────────────────────────────────────
  const inYear = (y: number) => rows.filter((r) => r.year === y);
  const years = [1, 2, 3].map((y) => {
    const rs = inYear(y);
    const last = rs[rs.length - 1];
    const core = sum(rs.map((r) => r.revenueCore));
    const gp = sum(rs.map((r) => r.grossProfit));
    const heads = (['Founders', 'Engineering', 'Sales', 'Delivery', 'Admin'] as const).reduce((t, role) => t + headsFor(a, role, y as 1 | 2 | 3), 0);
    const newCust = sum(rs.map((r) => r.annualStarts));
    const sm = sum(rs.map((r) => r.salesAndMarketing));
    return {
      year: y as 1 | 2 | 3,
      basis: 'forecast' as const,
      revenueCore: core,
      revenueMarketplace: sum(rs.map((r) => r.revenueMarketplace)),
      grossProfit: gp,
      grossMarginPct: core > 0 ? gp / core : null,
      opexTotal: sum(rs.map((r) => r.opexTotal)),
      operatingResult: sum(rs.map((r) => r.operatingResult)),
      endingCash: last.endingCash,
      arrEnd: last.arr,
      salesAndMarketing: sm,
      newAnnualCustomers: newCust,
      newPilots: sum(rs.map((r) => r.pilotsSigned)),
      headcount: heads,
      revenuePerEmployee: heads > 0 ? core / heads : null,
      cac: newCust > 0 ? sm / newCust : null,
      mix: {
        pilot: sum(rs.map((r) => r.revenuePilot)),
        implementation: sum(rs.map((r) => r.revenueImplementation)),
        platform: sum(rs.map((r) => r.revenuePlatform)),
        support: sum(rs.map((r) => r.revenueSupport)),
        aiOverage: sum(rs.map((r) => r.revenueAiOverage)),
        studentPremium: sum(rs.map((r) => r.revenueStudentPremium)),
        marketplace: sum(rs.map((r) => r.revenueMarketplace)),
      },
    } satisfies YearSummary;
  }) as [YearSummary, YearSummary, YearSummary];

  const unit = unitEconomics(a, rows, starts, arrOfCohortsThrough, yieldToAnnual);
  const breakEven = findBreakEven(rows);
  const cashOut = rows.find((r) => r.endingCash < 0)?.month ?? null;
  const funnel = cohortFunnel(a, contacted, rates);
  const result: ModelResult = {
    basis: 'forecast',
    assumptions: a,
    months: rows,
    years,
    unit,
    breakEven,
    cashOutMonth: cashOut,
    runwayMonths: cashOut === null ? null : cashOut - 1,
    lowestCash: Math.min(...rows.map((r) => r.endingCash)),
    peakFundingNeed: Math.max(0, -Math.min(...rows.map((r) => r.endingCash))),
    funnel,
    warnings: [],
  };
  result.warnings = warningsFor(result);
  return result;
}

function cohortFunnel(a: Assumptions, contacted: number[], rates: number[]): FunnelStage[] {
  const total = sum(contacted);
  const labels = ['Replies', 'Discovery calls', 'Qualified opportunities', 'Demos', 'Pilot design sessions', 'Proposals'];
  const stages: FunnelStage[] = [{ stage: 'Target accounts contacted', count: total, rate: null }];
  let running = total;
  rates.forEach((r, i) => {
    running *= r;
    stages.push({ stage: labels[i], count: running, rate: r });
  });
  const signed = running * a.pilotCloseRate;
  stages.push({ stage: 'Signed (pilot or direct annual)', count: signed, rate: a.pilotCloseRate });
  const pilots = signed * (1 - a.directAnnualShare);
  const activated = pilots * a.pilotActivationRate;
  stages.push({ stage: 'Activated pilots', count: activated, rate: a.pilotActivationRate });
  const success = activated * a.pilotSuccessRate;
  stages.push({ stage: 'Pilots meeting success criteria', count: success, rate: a.pilotSuccessRate });
  const converted = success * a.pilotToAnnualConversion + signed * a.directAnnualShare;
  stages.push({ stage: 'Annual contracts', count: converted, rate: success > 0 ? converted / success : null });
  return stages;
}

function unitEconomics(
  a: Assumptions,
  rows: MonthRow[],
  starts: number[],
  arrThrough: (m: number, cutoff: number) => number,
  pilotYield: number,
): UnitEconomics {
  const fees = contractFees(a, 0);
  const arrPerCustomer = fees.platform + fees.support;
  const activePerCustomer = fees.scope * a.studentInviteRate * a.studentActivationRate;
  const aiOverageYear = 12 * fees.scope * overageRequestsPerStudentMonth(a) * (a.aiOveragePricePer1000 / 1000);
  const recurringRevenueYear = arrPerCustomer + aiOverageYear;
  const variableCostMonth = activePerCustomer * (a.cloudCostPerActiveUserMonth + a.aiRequestsPerActiveUserMonth * a.aiCostPerRequest) + a.supportCostPerCustomerMonth;
  const monthlyGp = recurringRevenueYear / 12 - variableCostMonth;
  const unitGm = recurringRevenueYear > 0 ? monthlyGp / (recurringRevenueYear / 12) : null;

  const sm = sum(rows.map((r) => r.salesAndMarketing));
  const customers = sum(starts);
  const pilots = sum(rows.map((r) => r.pilotsSigned + r.directAnnualSigned));
  const cac = customers > 0 ? sm / customers : null;
  const churn = 1 - a.institutionRetention;

  let payback: number | null = null;
  let note = '';
  if (cac === null) note = 'No annual customer is acquired inside the 36 months, so CAC is undefined.';
  else if (monthlyGp <= 0) note = 'Monthly gross profit per customer is zero or negative, so the cost to acquire is never recovered.';
  else payback = cac / monthlyGp;

  const ltv = churn > 0 && unitGm !== null ? (arrPerCustomer * unitGm) / churn : null;
  const m36 = rows[N - 1].month;
  const base24 = arrThrough(24, 24);
  return {
    basis: 'forecast',
    arrPerCustomer,
    platformFeePerCustomer: fees.platform,
    supportFeePerCustomer: fees.support,
    aiOveragePerCustomerYear: aiOverageYear,
    minimumApplies: fees.minimumBinds,
    unitGrossMargin: unitGm,
    monthlyGrossProfitPerCustomer: unitGm === null ? null : monthlyGp,
    cac,
    cacPerPilot: pilots > 0 ? sm / pilots : null,
    cacPaybackMonths: payback,
    paybackNote: note,
    annualLogoChurn: churn,
    ltv,
    ltvToCac: ltv !== null && cac !== null && cac > 0 ? ltv / cac : null,
    grossRetention: a.institutionRetention,
    netRevenueRetention: a.institutionRetention * (1 + a.expansionRate),
    measuredNrr: base24 > 0 ? arrThrough(m36, 24) / base24 : null,
    pilotYield,
  };
}

function findBreakEven(rows: MonthRow[]): BreakEven {
  const covered = (r: MonthRow) => r.cumulativeGrossProfit >= r.cumulativeOpexAndObligations;
  const first = rows.find(covered);
  return {
    basis: 'forecast',
    month: first?.month ?? null,
    sustained: first !== undefined && covered(rows[rows.length - 1]),
    operatingMonth: rows.find((r) => r.operatingResult >= 0)?.month ?? null,
  };
}

function warningsFor(r: ModelResult): ModelWarning[] {
  const a = r.assumptions;
  const out: ModelWarning[] = [];
  const hasPilotRevenue = r.months.some((m) => m.pilotsSigned + m.directAnnualSigned > 0);

  if (hasPilotRevenue) {
    out.push({
      id: 'paid-pilot-gate',
      severity: 'critical',
      title: 'Paid-pilot revenue is not authorised today',
      detail: `GO-NO-GO-DECISION.md holds the paid institutional pilot at NO-GO/RED. Every pilot, implementation and annual-contract figure below assumes the gate flips by month ${a.firstPaidPilotMonth}. Treat institutional revenue as hypothetical until it does.`,
      month: a.firstPaidPilotMonth,
    });
  }

  const over = r.months.find((m) => m.contractorOverflowHours > 0);
  if (over) {
    const peak = Math.max(...r.months.map((m) => m.implementationDemandHours - m.deliveryCapacityHours));
    out.push({
      id: 'capacity',
      severity: 'warning',
      title: 'Implementation demand exceeds delivery-team capacity',
      detail: `From month ${over.month}, demand needs more hours than the delivery team supplies; the shortfall peaks at about ${Math.round(peak)} hours a month and is bought as contractor time. Add delivery heads, lengthen implementations, or slow signings.`,
      month: over.month,
    });
  }

  const low = r.years.filter((y) => y.grossMarginPct !== null && y.grossMarginPct < a.grossMarginThreshold);
  if (low.length > 0) {
    const last = r.years[2];
    out.push({
      id: 'margin',
      severity: last.grossMarginPct !== null && last.grossMarginPct < a.grossMarginThreshold ? 'warning' : 'info',
      title: 'Gross margin is below the threshold',
      detail: `Core gross margin is under ${Math.round(a.grossMarginThreshold * 100)}% in model year${low.length > 1 ? 's' : ''} ${low.map((y) => y.year).join(', ')}. Delivery payroll, implementation labour and AI cost are the usual causes.`,
    });
  }

  const burning = r.cashOutMonth !== null ? r.cashOutMonth - 1 : null;
  const finalForward = r.months[N - 1].forwardRunwayMonths;
  if ((burning !== null && burning < a.runwayThresholdMonths) || (burning === null && finalForward !== null && finalForward < a.runwayThresholdMonths)) {
    out.push({
      id: 'runway',
      severity: 'critical',
      title: `Cash runway is below ${a.runwayThresholdMonths} months`,
      detail:
        burning !== null
          ? `Cash is exhausted in month ${r.cashOutMonth}, after ${burning} funded month${burning === 1 ? '' : 's'}. The lowest balance is ${group(r.lowestCash)} dollars.`
          : `Cash lasts the horizon, but at the month-36 burn only about ${Math.round(finalForward ?? 0)} months remain.`,
      month: r.cashOutMonth ?? undefined,
    });
  }

  let cumAi = 0;
  let cumFunded = 0;
  let aiMonth: number | undefined;
  for (const m of r.months) {
    cumAi += m.cogsAi;
    cumFunded += m.revenueAiOverage + a.aiIncludedRevenueShare * (m.revenuePlatform + m.revenuePilot + m.revenueStudentPremium);
    if (aiMonth === undefined && cumAi > cumFunded && cumAi > 0) aiMonth = m.month;
  }
  if (aiMonth !== undefined) {
    out.push({
      id: 'ai',
      severity: 'warning',
      title: 'AI cost exceeds the revenue that funds it',
      detail: `From month ${aiMonth}, cumulative AI cost is above AI overage revenue plus the ${Math.round(a.aiIncludedRevenueShare * 100)}% of platform, pilot and Premium revenue treated as funding included AI. Raise the overage price, cap the pool, or cut requests per student.`,
      month: aiMonth,
    });
  }

  if (a.marketplaceEnabled) {
    const core = sum(r.months.map((m) => m.grossProfit - m.opexTotal - m.obligations));
    const market = sum(r.months.map((m) => m.revenueMarketplace));
    out.push({
      id: 'marketplace-dependence',
      severity: core < 0 && core + market >= 0 ? 'warning' : 'info',
      title: core < 0 && core + market >= 0 ? 'The plan only breaks even with marketplace revenue' : 'Marketplace revenue is modelled separately',
      detail: 'Core metrics, break-even and unit economics exclude marketplace and partner commission. The company must stay viable without it.',
    });
  }

  if (r.unit.minimumApplies) {
    out.push({
      id: 'minimum-binds',
      severity: 'info',
      title: 'The annual minimum sets the price',
      detail: `At ${group(a.annualScopeStudents)} enrolled students the per-student price is below the minimum, so the minimum is what an institution pays: an effective rate of about $${(a.platformAnnualMinimum / a.annualScopeStudents).toFixed(2)} per student.`,
    });
  }

  if (a.pilotMonths !== 6) {
    out.push({
      id: 'pilot-length',
      severity: 'info',
      title: 'Pilot length differs from the code rule',
      detail: 'pilotReadiness enforces 26 weeks (D-134). The brief assumes 8 to 12 weeks. This is an open founder decision; the model follows the input.',
    });
  }

  if (hasPilotRevenue && sum(r.months.map((m) => m.annualStarts)) < 0.5) {
    out.push({
      id: 'no-conversions',
      severity: 'warning',
      title: 'Almost no annual contracts start inside the horizon',
      detail: 'Recurring revenue stays near zero. A longer sales cycle, later gate or longer pilot pushes conversions past month 36.',
    });
  }

  return out;
}

export const sumRows = (rows: readonly MonthRow[], pick: (r: MonthRow) => number) => sum(rows.map(pick));
