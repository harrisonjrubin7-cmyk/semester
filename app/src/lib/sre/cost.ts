/**
 * Cost as a reliability signal.
 *
 * The one alert MONITORING.md allows to wake somebody is AI spend, because it
 * is the only failure that costs real money while nobody watches. This
 * register generalises that: every cost driver has a unit, an owner, and a
 * *guardrail* — a control that stops spend, not an alert that reports it.
 * "An alert tells you it happened, a cap stops it" is the rule.
 *
 * Budgets are `null` until the owner sets them. A driver with no budget is
 * listed as open work by the scorecard rather than silently treated as
 * unbounded-and-fine. No price is written here: provider prices change and a
 * copied price is how a plan certifies a number that was true last year.
 */

import type { Role } from './catalog';

export interface CostDriver {
  id: string;
  name: string;
  /** What is counted, so a bill can be divided by it. */
  unit: string;
  component: string;
  role: Role;
  /** Monthly ceiling in whole currency units; null while unset. */
  budgetMonthly: number | null;
  /** The control that stops the spend. Null means only an alert exists. */
  guardrail: string | null;
  /** True when the driver scales with a student's own action rather than with time. */
  usageDriven: boolean;
}

export const COST_DRIVERS: readonly CostDriver[] = [
  { id: 'ai-shared-key', name: 'AI provider, shared key (claude function)', unit: 'model call', component: 'fn:claude', role: 'ai', budgetMonthly: null, guardrail: 'Per-account MONTHLY_CALL_LIMIT (default 60) plus kill.ai_generation; provider-side cap is a setting nobody has verified', usageDriven: true },
  { id: 'ai-gateway', name: 'AI provider, institution gateway', unit: 'request (cents estimated)', component: 'openai', role: 'ai', budgetMonthly: null, guardrail: 'SEMESTER_AI_MAX_REQUEST_CENTS per request; monthly enforcement not traced', usageDriven: true },
  { id: 'database', name: 'Postgres compute and storage', unit: 'compute-hour, GB-month', component: 'supabase-db', role: 'data', budgetMonthly: null, guardrail: null, usageDriven: false },
  { id: 'edge-invocations', name: 'Edge function invocations', unit: 'million invocations', component: 'supabase-edge-runtime', role: 'platform', budgetMonthly: null, guardrail: null, usageDriven: true },
  { id: 'egress', name: 'Bandwidth and egress', unit: 'GB', component: 'supabase-db', role: 'platform', budgetMonthly: null, guardrail: null, usageDriven: true },
  { id: 'storage', name: 'Object storage (uploads, exports, trust packet)', unit: 'GB-month', component: 'supabase-db', role: 'data', budgetMonthly: null, guardrail: null, usageDriven: true },
  { id: 'email', name: 'Transactional email', unit: 'message', component: 'resend', role: 'support', budgetMonthly: null, guardrail: 'Outbox gives up after eight attempts', usageDriven: true },
  { id: 'ci-minutes', name: 'CI minutes (CI, probes, scans)', unit: 'runner-minute', component: 'pipeline:ci', role: 'platform', budgetMonthly: null, guardrail: null, usageDriven: false },
  { id: 'payments', name: 'Payment processing fees', unit: 'transaction', component: 'stripe', role: 'billing', budgetMonthly: null, guardrail: 'Checkout is code-held off until live billing is enabled', usageDriven: true },
  { id: 'dast', name: 'Dynamic security scanning', unit: 'scan', component: 'pipeline:hawkscan', role: 'security', budgetMonthly: null, guardrail: null, usageDriven: false },
];

/**
 * A spend reading against its trailing history. Returns the ratio to the
 * mean of `trailing`, or null when there is nothing to compare against —
 * never 0, which would read as "spend collapsed".
 */
export function spendRatio(current: number, trailing: readonly number[]): number | null {
  if (current < 0 || trailing.some((t) => t < 0)) throw new RangeError('Spend cannot be negative');
  if (trailing.length === 0) return null;
  const mean = trailing.reduce((a, b) => a + b, 0) / trailing.length;
  return mean === 0 ? null : current / mean;
}

export const ANOMALY_RATIO = 1.5;

export function isAnomalous(current: number, trailing: readonly number[]): boolean {
  const r = spendRatio(current, trailing);
  return r !== null && r > ANOMALY_RATIO;
}

/** Unit cost, so a bill becomes "per active student" and "per successful outcome". */
export function unitCost(spend: number, units: number): number | null {
  if (spend < 0 || units < 0) throw new RangeError('Spend and units cannot be negative');
  return units === 0 ? null : spend / units;
}
