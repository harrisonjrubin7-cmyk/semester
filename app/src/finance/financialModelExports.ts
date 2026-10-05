import { FIELDS, GROUPS, START_MONTH } from './financialModelFields';
import { scenarioById, type ScenarioSummary } from './financialModelScenarios';
import { formatPct, formatPrice, formatUsdExact } from './financialModelFormat';
import type { Assumptions, ModelResult, MonthRow, ScenarioId } from './financialModelTypes';

/**
 * Exports of the current scenario: CSV, JSON, Markdown, an assumptions prompt
 * and a board-ready summary. All pure, so they are tested without a browser;
 * the screen only turns the returned strings into downloads.
 *
 * Every export says it is a forecast on planning assumptions and not an
 * approved budget, price book or target. The same words are in the JSON, so a
 * copied file cannot lose them.
 */

export const DISCLAIMER =
  'FORECAST built on planning assumptions. Not an approved budget, price book, forecast or target; not accounting, tax, legal, insurance or investment advice. [REVIEW: accounting] [REVIEW: tax] [REVIEW: counsel] before any external use.';

export const SCHEMA = 'semester.gtm-financial-model.v1';

// ── CSV ────────────────────────────────────────────────────────────────────

/** Quote a cell, and defuse spreadsheet formulas in any text that begins like one. */
export function csvCell(v: string | number | null): string {
  if (v === null) return '';
  if (typeof v === 'number') return Number.isFinite(v) ? String(v) : '';
  const guarded = /^[=+\-@\t\r]/.test(v) ? `'${v}` : v;
  return /[",\n\r]/.test(guarded) ? `"${guarded.replace(/"/g, '""')}"` : guarded;
}

const row = (cells: (string | number | null)[]) => cells.map(csvCell).join(',');
const usd = (n: number) => Math.round(n);
const cnt = (n: number) => Math.round(n * 1000) / 1000;
const pct = (n: number | null) => (n === null ? null : Math.round(n * 10000) / 10000);

type Col = { header: string; value: (r: MonthRow) => string | number | null };

const MONTH_COLUMNS: Col[] = [
  { header: 'month', value: (r) => r.month },
  { header: 'calendar_month', value: (r) => r.label },
  { header: 'model_year', value: (r) => r.year },
  { header: 'basis', value: (r) => r.basis },
  { header: 'accounts_contacted', value: (r) => cnt(r.contacted) },
  { header: 'pilots_signed', value: (r) => cnt(r.pilotsSigned) },
  { header: 'direct_annual_signed', value: (r) => cnt(r.directAnnualSigned) },
  { header: 'annual_starts', value: (r) => cnt(r.annualStarts) },
  { header: 'annual_customers', value: (r) => cnt(r.annualCustomers) },
  { header: 'active_students', value: (r) => cnt(r.activeStudentsTotal) },
  { header: 'premium_subscribers', value: (r) => cnt(r.premiumSubscribers) },
  { header: 'revenue_pilot_usd', value: (r) => usd(r.revenuePilot) },
  { header: 'revenue_implementation_usd', value: (r) => usd(r.revenueImplementation) },
  { header: 'revenue_platform_usd', value: (r) => usd(r.revenuePlatform) },
  { header: 'revenue_premium_support_usd', value: (r) => usd(r.revenueSupport) },
  { header: 'revenue_ai_overage_usd', value: (r) => usd(r.revenueAiOverage) },
  { header: 'revenue_student_premium_usd', value: (r) => usd(r.revenueStudentPremium) },
  { header: 'revenue_core_usd', value: (r) => usd(r.revenueCore) },
  { header: 'revenue_marketplace_usd_separate', value: (r) => usd(r.revenueMarketplace) },
  { header: 'cogs_total_usd', value: (r) => usd(r.cogsTotal) },
  { header: 'gross_profit_core_usd', value: (r) => usd(r.grossProfit) },
  { header: 'gross_margin_core', value: (r) => pct(r.grossMarginPct) },
  { header: 'opex_total_usd', value: (r) => usd(r.opexTotal) },
  { header: 'sales_and_marketing_usd', value: (r) => usd(r.salesAndMarketing) },
  { header: 'operating_result_usd', value: (r) => usd(r.operatingResult) },
  { header: 'required_obligations_usd', value: (r) => usd(r.obligations) },
  { header: 'billings_usd', value: (r) => usd(r.billings) },
  { header: 'collections_usd', value: (r) => usd(r.collections) },
  { header: 'net_cash_usd', value: (r) => usd(r.netCash) },
  { header: 'ending_cash_usd', value: (r) => usd(r.endingCash) },
  { header: 'deferred_revenue_usd', value: (r) => usd(r.deferredRevenue) },
  { header: 'mrr_usd', value: (r) => usd(r.mrr) },
  { header: 'arr_usd', value: (r) => usd(r.arr) },
  { header: 'implementation_demand_hours', value: (r) => Math.round(r.implementationDemandHours) },
  { header: 'delivery_capacity_hours', value: (r) => Math.round(r.deliveryCapacityHours) },
  { header: 'ai_requests', value: (r) => Math.round(r.aiRequests) },
];

/** The monthly table for the current scenario, one row per month, every row labelled with its scenario and basis. */
export function monthlyCsv(result: ModelResult, scenarioId: ScenarioId): string {
  const header = ['scenario', ...MONTH_COLUMNS.map((c) => c.header)];
  const lines = result.months.map((m) => row([scenarioId, ...MONTH_COLUMNS.map((c) => c.value(m))]));
  return [row(header), ...lines].join('\n') + '\n';
}

/** The assumptions behind it, with where each came from. */
export function assumptionsCsv(result: ModelResult, scenarioId: ScenarioId): string {
  const header = row(['scenario', 'key', 'label', 'group', 'unit', 'value', 'source', 'label_tag', 'note']);
  const lines = FIELDS.map((f) =>
    row([scenarioId, f.key, f.label, f.group, f.unit, result.assumptions[f.key], f.source, tagOf(f.source), f.note]),
  );
  return [header, ...lines].join('\n') + '\n';
}

/** Maps a field source to the documentation label vocabulary. */
export const tagOf = (source: string): string =>
  source === 'repo' ? 'ASSUMPTION (repository figure, needs confirmation)' : source === 'brief' ? 'ASSUMPTION (founder brief)' : source === 'placeholder' ? 'ASSUMPTION (PLACEHOLDER: replace with actual)' : 'ASSUMPTION';

// ── JSON ───────────────────────────────────────────────────────────────────

export function scenarioJson(result: ModelResult, scenarioId: ScenarioId, generatedAt: string): string {
  const sc = scenarioById(scenarioId);
  const doc = {
    schema: SCHEMA,
    generatedAt,
    basis: result.basis,
    disclaimer: DISCLAIMER,
    scenario: { id: sc.id, label: sc.label, description: sc.description, patch: sc.patch },
    startMonth: START_MONTH,
    assumptions: FIELDS.map((f) => ({ key: f.key, label: f.label, group: f.group, unit: f.unit, value: result.assumptions[f.key], source: f.source, label_tag: tagOf(f.source), note: f.note })),
    years: result.years,
    unitEconomics: result.unit,
    breakEven: result.breakEven,
    cash: { cashOutMonth: result.cashOutMonth, runwayMonths: result.runwayMonths, lowestCash: result.lowestCash },
    funnel: result.funnel,
    warnings: result.warnings,
    months: result.months,
  };
  return JSON.stringify(doc, null, 2) + '\n';
}

// ── Markdown ───────────────────────────────────────────────────────────────

const mdRow = (cells: (string | number)[]) => `| ${cells.join(' | ')} |`;
const mdTable = (head: string[], rows: (string | number)[][]) => [mdRow(head), mdRow(head.map(() => '---')), ...rows.map(mdRow)].join('\n');
const monthOrNone = (m: number | null) => (m === null ? 'not within 36 months' : `month ${m}`);
const whole = (n: number | null) => (n === null ? 'n/a' : formatUsdExact(n));

export function scenarioMarkdown(result: ModelResult, scenarioId: ScenarioId): string {
  const sc = scenarioById(scenarioId);
  const u = result.unit;
  const out: string[] = [
    `# Semester GTM financial model: ${sc.label}`,
    '',
    `> ${DISCLAIMER}`,
    '',
    `Every figure below is a **Forecast** (basis: ${result.basis}). No actuals are connected to this model.`,
    '',
    `Scenario: **${sc.label}**. ${sc.description}`,
    '',
    '## Annual summary (Forecast)',
    '',
    mdTable(
      ['Model year', 'Core revenue', 'Gross profit', 'Gross margin', 'Operating expense', 'Operating result', 'Ending cash', 'ARR at year end'],
      result.years.map((y) => [`Year ${y.year}`, whole(y.revenueCore), whole(y.grossProfit), formatPct(y.grossMarginPct), whole(y.opexTotal), whole(y.operatingResult), whole(y.endingCash), whole(y.arrEnd)]),
    ),
    '',
    'Marketplace and partner revenue is modelled separately and is excluded from core revenue and every metric below.',
    '',
    '## Unit economics (Forecast)',
    '',
    mdTable(
      ['Metric', 'Value', 'Definition'],
      [
        ['CAC', whole(u.cac), 'Sales and marketing spend / new annual customers acquired, over 36 months'],
        ['CAC payback', u.cacPaybackMonths === null ? `n/a (${u.paybackNote})` : `${u.cacPaybackMonths.toFixed(0)} months`, 'CAC / monthly gross profit per customer'],
        ['LTV', whole(u.ltv), 'Annual recurring revenue x gross margin / annual logo churn'],
        ['LTV : CAC', u.ltvToCac === null ? 'n/a' : `${u.ltvToCac.toFixed(1)}x`, 'LTV / CAC'],
        ['Gross retention', formatPct(u.grossRetention), 'Institution annual logo retention'],
        ['Net revenue retention', `${formatPct(u.netRevenueRetention)} (formula); ${formatPct(u.measuredNrr)} (measured in model)`, 'Retention x (1 + expansion); the measured figure reflects the premium-support minimum'],
        ['ARR per annual customer', whole(u.arrPerCustomer), 'Platform fee plus expected premium support'],
        ['Unit gross margin', formatPct(u.unitGrossMargin), 'Recurring revenue less variable cost to serve one institution'],
      ],
    ),
    '',
    '## Break-even and cash (Forecast)',
    '',
    mdTable(
      ['Measure', 'Result'],
      [
        ['Break-even (cumulative gross profit covers cumulative operating expense and required obligations)', `${monthOrNone(result.breakEven.month)}${result.breakEven.month !== null && !result.breakEven.sustained ? ' (not sustained to month 36)' : ''}`],
        ['First month with a non-negative operating result', monthOrNone(result.breakEven.operatingMonth)],
        ['Cash exhausted', monthOrNone(result.cashOutMonth)],
        ['Lowest cash balance', whole(result.lowestCash)],
        ['Funding needed to keep cash at or above zero', whole(result.peakFundingNeed)],
        ['Month-36 cash', whole(result.months[result.months.length - 1].endingCash)],
      ],
    ),
    '',
    '## Warnings',
    '',
    ...(result.warnings.length ? result.warnings.map((w) => `- **${w.severity.toUpperCase()}: ${w.title}.** ${w.detail}`) : ['- None.']),
    '',
    '## Assumptions',
    '',
    'Every assumption is a planning assumption. Placeholders must be replaced with actual figures before any decision relies on the output.',
    '',
  ];
  for (const g of GROUPS) {
    out.push(`### ${g}`, '', mdTable(['Assumption', 'Value', 'Label'], FIELDS.filter((f) => f.group === g).map((f) => [f.label, valueText(f.unit, result.assumptions[f.key]), tagOf(f.source)])), '');
  }
  out.push('## Professional review required', '', '- [REVIEW: accounting] revenue recognition, deferred revenue, payment terms.', '- [REVIEW: tax] sales tax on SaaS and services, entity and payroll tax.', '- [REVIEW: counsel] pricing, pilot paper and any customer-facing figure.', '- [REVIEW: insurance] coverage and premium assumptions.', '');
  return out.join('\n');
}

function valueText(unit: string, v: number): string {
  switch (unit) {
    case 'usd':
      // Prices keep their cents: $8.99 must never read as $9. Large sums read as whole dollars.
      return v < 0 ? `-${formatPrice(-v)}` : formatPrice(v);
    case 'pct':
      return formatPct(v, v * 100 % 1 === 0 ? 0 : 1);
    case 'flag':
      return v ? 'yes' : 'no';
    default:
      return String(v);
  }
}

// ── Assumptions as a prompt ────────────────────────────────────────────────

export function assumptionsPrompt(result: ModelResult, scenarioId: ScenarioId): string {
  const sc = scenarioById(scenarioId);
  const lines = FIELDS.map((f) => `- ${f.label}: ${valueText(f.unit, result.assumptions[f.key])} [${f.source}]`);
  return [
    'You are a SaaS finance analyst reviewing a planning model for Semester, an education-technology company selling a narrow institutional pilot (Registration Readiness Pilot) that converts to annual contracts, plus student subscriptions.',
    '',
    `Scenario: ${sc.label}. ${sc.description}`,
    '',
    'Ground rules: every figure is a planning assumption, not an approved price, budget or target. Do not present any output as a guarantee. Mark anything needing accounting, tax, legal or insurance review. The core business must be viable without marketplace revenue. A paid institutional pilot is not yet authorised (go/no-go: NO-GO), so revenue timing is hypothetical.',
    '',
    'Assumptions (source: brief = founder planning assumption, repo = repository figure that needs confirmation, placeholder = replace with actual, assumption = modelling choice):',
    ...lines,
    '',
    'Tasks:',
    '1. Identify the five assumptions whose error would change break-even or runway most, and say how to validate each in the first pilot.',
    '2. Flag any assumption that is internally inconsistent or outside typical ranges for higher-ed SaaS, and say what evidence would justify it.',
    '3. Recompute CAC, CAC payback, LTV and net revenue retention from the assumptions and compare with: CAC = sales and marketing spend / new customers acquired; CAC payback months = CAC / monthly gross profit per customer; LTV = annual recurring revenue x gross margin / annual logo churn.',
    '4. List the professional reviews required before these numbers leave the company.',
    '',
    `Model summary (Forecast): month-36 ARR ${whole(result.months[result.months.length - 1].arr)}; break-even ${monthOrNone(result.breakEven.month)}; cash exhausted ${monthOrNone(result.cashOutMonth)}.`,
    '',
  ].join('\n');
}

// ── Board summary ──────────────────────────────────────────────────────────

export function boardSummary(result: ModelResult, scenarioId: ScenarioId, all: readonly ScenarioSummary[]): string {
  const sc = scenarioById(scenarioId);
  const last = result.months[result.months.length - 1];
  const u = result.unit;
  const a: Assumptions = result.assumptions;
  return [
    `# Semester: GTM financial summary for the board (${sc.label})`,
    '',
    `> ${DISCLAIMER}`,
    '',
    '**Status: DRAFT, INTERNAL.** Nothing here is a forecast the company stands behind, a target, or a statement about a customer. Pilots, conversions and revenue are hypothetical until the paid-pilot gate in the go/no-go decision flips and a first pilot is measured.',
    '',
    '## What this says',
    '',
    `- Under the ${sc.label} scenario the model reaches **${whole(last.arr)} ARR in month 36** (Forecast), with ${monthOrNone(result.breakEven.month)} as break-even and cash ${result.cashOutMonth === null ? 'lasting the 36 months' : `exhausted in month ${result.cashOutMonth}`}.`,
    `- The lowest cash balance is **${whole(result.lowestCash)}** against an opening balance of ${whole(a.openingCash)} (a placeholder).`,
    `- CAC is ${whole(u.cac)} per annual customer and CAC payback is ${u.cacPaybackMonths === null ? 'undefined' : `${u.cacPaybackMonths.toFixed(0)} months`}; LTV : CAC is ${u.ltvToCac === null ? 'undefined' : `${u.ltvToCac.toFixed(1)}x`}. These rest on unvalidated rates.`,
    '',
    '## All scenarios (Forecast)',
    '',
    mdTable(
      ['Scenario', 'Month-36 ARR', 'Year-3 revenue', 'Year-3 gross margin', 'Lowest cash', 'Funding needed', 'Break-even', 'Runway'],
      all.map((s) => [s.label, whole(s.arrEnd), whole(s.revenueYear3), formatPct(s.grossMarginYear3), whole(s.lowestCash), whole(s.peakFundingNeed), s.breakEvenMonth === null ? 'none in 36 mo' : `month ${s.breakEvenMonth}`, s.runwayMonths === null ? '36+ mo' : `${s.runwayMonths} mo`]),
    ),
    '',
    '## Decisions this asks of the board',
    '',
    '1. Whether to fund the go/no-go blockers (independent security assessment, accessibility review, counsel, entity and insurance) shown as required obligations in the model.',
    '2. Which hypothesis to test first with the first design-partner engagement: pilot-to-annual conversion, sales cycle length, or implementation hours.',
    '3. Which open conflicts to settle: individual price (D-134, D-1154, brief), pilot length (26 weeks in code, 8 to 12 weeks in the brief), and whether to price a pilot at all.',
    '',
    '## Active warnings',
    '',
    ...(result.warnings.length ? result.warnings.map((w) => `- **${w.severity.toUpperCase()}: ${w.title}.** ${w.detail}`) : ['- None.']),
    '',
    '## Placeholders that must become actuals',
    '',
    ...FIELDS.filter((f) => f.source === 'placeholder').map((f) => `- ${f.label}: currently ${valueText(f.unit, a[f.key])}. ${f.note}`),
    '',
    '## Professional review required before external use',
    '',
    '- [REVIEW: accounting] revenue recognition, collections, runway.',
    '- [REVIEW: tax] SaaS and services tax, payroll tax, entity.',
    '- [REVIEW: counsel] pricing, pilot paper, any figure shown to a customer or investor.',
    '- [REVIEW: insurance] coverage assumptions.',
    '',
  ].join('\n');
}
