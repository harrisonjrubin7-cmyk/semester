/**
 * KPI formulas (GTM plan §11.4) and the directional benchmarks (§11.3).
 *
 * Each ratio returns null when its denominator is zero: an empty cohort has no
 * rate, and a 0% on a dashboard would read as a result. Every definition
 * carries its numerator, denominator and caveat so an export can include the
 * methodology beside the number (acceptance criterion §16.4).
 */

export type MetricKey =
  | 'qualified_inquiry_rate'
  | 'inquiry_to_application_rate'
  | 'application_completion_rate'
  | 'yield_rate'
  | 'cost_per_inquiry'
  | 'cost_per_application'
  | 'cost_per_enrolled_student'
  | 'email_ctr'
  | 'click_to_open_rate'
  | 'student_activation_rate'
  | 'first_meaningful_action_rate'
  | 'workflow_completion_rate'
  | 'pilot_conversion_rate'
  | 'customer_acquisition_cost'
  | 'cac_payback_months'
  | 'net_revenue_retention';

export interface MetricDefinition {
  key: MetricKey;
  label: string;
  numerator: string;
  denominator: string;
  unit: 'ratio' | 'currency' | 'months';
  caveat?: string;
}

const d = (
  key: MetricKey, label: string, numerator: string, denominator: string,
  unit: MetricDefinition['unit'] = 'ratio', caveat?: string,
): MetricDefinition => ({ key, label, numerator, denominator, unit, caveat });

export const METRICS: Record<MetricKey, MetricDefinition> = {
  qualified_inquiry_rate: d('qualified_inquiry_rate', 'Qualified inquiry rate', 'qualified inquiries', 'unique reachable prospects'),
  inquiry_to_application_rate: d('inquiry_to_application_rate', 'Inquiry-to-application rate', 'submitted applications', 'qualified inquiries'),
  application_completion_rate: d('application_completion_rate', 'Application completion rate', 'submitted applications', 'application starts'),
  yield_rate: d('yield_rate', 'Yield rate', 'enrolled students', 'admitted students', 'ratio',
    'Interpret with selectivity and program mix.'),
  cost_per_inquiry: d('cost_per_inquiry', 'Cost per inquiry', 'attributable campaign spend', 'inquiries', 'currency'),
  cost_per_application: d('cost_per_application', 'Cost per application', 'attributable campaign spend', 'submitted applications', 'currency'),
  cost_per_enrolled_student: d('cost_per_enrolled_student', 'Cost per enrolled student', 'total attributable marketing investment',
    'enrolled students', 'currency', 'Compare to your own baseline; external averages are directional only.'),
  email_ctr: d('email_ctr', 'Email click-through rate', 'unique clicks', 'delivered emails'),
  click_to_open_rate: d('click_to_open_rate', 'Click-to-open rate', 'unique clicks', 'unique opens', 'ratio',
    'Mail privacy protection inflates opens; prefer clicks and conversions.'),
  student_activation_rate: d('student_activation_rate', 'Student activation rate', 'activated accounts', 'eligible invited students'),
  first_meaningful_action_rate: d('first_meaningful_action_rate', 'First meaningful action rate', 'users completing the defined value event', 'activated users'),
  workflow_completion_rate: d('workflow_completion_rate', 'Workflow completion rate', 'completed workflows', 'users who began the workflow'),
  pilot_conversion_rate: d('pilot_conversion_rate', 'Pilot conversion rate', 'pilots converted to a paid annual contract', 'completed pilots'),
  customer_acquisition_cost: d('customer_acquisition_cost', 'Customer acquisition cost', 'sales and marketing cost attributable to new customers', 'new customers', 'currency'),
  cac_payback_months: d('cac_payback_months', 'CAC payback', 'customer acquisition cost', 'monthly gross profit from the new customer', 'months'),
  net_revenue_retention: d('net_revenue_retention', 'Net revenue retention', 'starting recurring revenue + expansion − contraction − churn', 'starting recurring revenue'),
};

/** numerator / denominator, or null when there is nothing to divide by. */
export function ratio(numerator: number, denominator: number): number | null {
  if (!Number.isFinite(numerator) || !Number.isFinite(denominator) || denominator <= 0 || numerator < 0) return null;
  return numerator / denominator;
}

export function netRevenueRetention(start: number, expansion: number, contraction: number, churn: number): number | null {
  return ratio(start + expansion - contraction - churn, start);
}

/**
 * Directional external references (§11.3). Deliberately not targets: they are
 * shown beside a tenant's own baseline, never instead of it.
 */
export interface Benchmark {
  metric: string;
  low: number;
  high: number;
  note: string;
}

export const DIRECTIONAL_BENCHMARKS: readonly Benchmark[] = [
  { metric: 'Email open rate', low: 0.35, high: 0.39, note: 'Inflated by mail privacy protection; do not optimise to it.' },
  { metric: 'Email CTR', low: 0.03, high: 0.07, note: 'About 3% average; higher for segmented, well-timed sends.' },
  { metric: 'Email click-to-open rate', low: 0.10, high: 0.15, note: 'Useful once deliverability is stable.' },
  { metric: 'Email unsubscribe rate', low: 0, high: 0.001, note: 'Above ~0.1% calls for a frequency, relevance and consent review.' },
  { metric: 'Inquiry-to-application', low: 0.15, high: 0.25, note: 'Varies with source quality and institution type.' },
  { metric: 'Application-to-admission', low: 0.50, high: 0.70, note: 'Depends mainly on selectivity.' },
  { metric: 'Admit-to-enrollment (yield)', low: 0.20, high: 0.40, note: 'Broad national reference near 28%.' },
  { metric: 'Inquiry-to-enrollment', low: 0.02, high: 0.02, note: 'Only meaningful with full-funnel attribution.' },
];

/** The one cost reference in the plan, labelled as what it is. */
export const EXTERNAL_COST_PER_ENROLLED_REFERENCE = {
  value: 2849,
  label: 'One sector report’s average cost per enrolled student (directional, not a target)',
} as const;

/**
 * The high-opt-out alert from §15 phase 4. The plan's reference is ~0.1% and
 * says anything higher "requires frequency/relevance/consent review", so the
 * alert asks for that review above it. Below `minDelivered` sends one opt-out
 * is noise, not a rate.
 */
export function optOutAlert(optOuts: number, delivered: number, minDelivered = 1000): boolean {
  if (delivered < minDelivered) return false;
  const rate = ratio(optOuts, delivered);
  return rate !== null && rate > 0.001;
}

/**
 * Methodology export: a flat record per metric that a CSV can carry beside the
 * figures, including the attribution model the dashboard used (§11.6).
 */
export function methodology(keys: readonly MetricKey[], attributionModel: 'first_touch' | 'last_touch' | 'multi_touch') {
  return keys.map((k) => ({
    metric: METRICS[k].label,
    formula: `${METRICS[k].numerator} / ${METRICS[k].denominator}`,
    unit: METRICS[k].unit,
    attribution_model: attributionModel,
    caveat: METRICS[k].caveat ?? '',
    causal_claim: 'none — correlational unless a holdout or experiment is named',
  }));
}
