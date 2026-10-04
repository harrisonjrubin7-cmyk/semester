/**
 * Every alert Semester intends to have, and how much of it is real.
 *
 * `OBSERVABILITY-PLAN.md` says "a dashboard without a staffed recipient is not
 * an operated alert" and lists what an actionable signal needs: an owner, a
 * severity, a threshold, a route, a runbook, a test cadence. This register is
 * that list as data, one row per alert, and the scorecard counts the rows.
 *
 * The `state` field is the honest part. An alert is not "done" because a row
 * exists:
 *
 *   defined         — the condition is written down; nothing evaluates it
 *   manual          — a person evaluates it on a schedule (MONITORING.md's weekly ten minutes)
 *   wired           — a machine evaluates it (CI, the hourly probe, a test)
 *   delivery_tested — a safe, deliberate trigger reached a named human who acknowledged it
 *
 * Today nothing is `delivery_tested`: there is no pager, no rota and no second
 * recipient (ON-CALL-AND-ESCALATION-POLICY.md). The test that guards this file
 * refuses a `delivery_tested` row without an evidence file that exists, so the
 * state cannot be promoted by editing a word.
 */

import { JOURNEYS } from '../governance/error-budgets';

export type AlertState = 'defined' | 'manual' | 'wired' | 'delivery_tested';
export type Severity = 'page' | 'ticket';

/** How the condition is detected, which decides what "tested" means. */
export type Source = 'burn' | 'synthetic' | 'threshold' | 'absence' | 'integrity' | 'ci';

export interface Alert {
  id: string;
  /** What is true when it fires, as the responder reads it. */
  condition: string;
  source: Source;
  severity: Severity;
  /** The component whose owner answers. */
  component: string;
  runbook: string;
  state: AlertState;
  /** For `delivery_tested`: the dated evidence file. Null otherwise. */
  evidence: string | null;
}

/** Which component carries each journey's burn alert, and the runbook that answers it. */
const JOURNEY_ROUTE: Record<string, { component: string; runbook: string }> = {
  sign_in: { component: 'supabase-auth', runbook: 'RB-02' },
  today_load: { component: 'web-app', runbook: 'RB-01' },
  plan_save: { component: 'supabase-db', runbook: 'RB-03' },
  advisor_agenda_save: { component: 'supabase-db', runbook: 'RB-03' },
  search: { component: 'web-app', runbook: 'RB-01' },
  ask_semester: { component: 'fn:claude', runbook: 'RB-05' },
  assignment_draft_save: { component: 'supabase-db', runbook: 'RB-03' },
  privacy_request_intake: { component: 'fn:delete-account', runbook: 'RB-04' },
};

/**
 * One burn alert per journey. Each is two rules on the same SLI (a page and a
 * ticket, see burn-alerts.ts), so the row names the *route the worst rule
 * asks for* — a journey can page. All are `defined`: no accepted event stream
 * supplies eligible and bad counts yet (SLO-SLI-DRAFT.md), and a burn alert on
 * an unmeasured SLI is a promise, not a monitor.
 */
const burnAlerts: Alert[] = JOURNEYS.map((j) => ({
  id: `burn:${j.id}`,
  condition: `${j.name}: error budget burning at 14.4× over 1 h and 5 m, or 6× over 6 h and 30 m (page); 3× over 1 d, or 1× over 3 d (ticket)`,
  source: 'burn' as const,
  severity: 'page' as const,
  component: JOURNEY_ROUTE[j.id].component,
  runbook: JOURNEY_ROUTE[j.id].runbook,
  state: 'defined' as const,
  evidence: null,
}));

const A = (
  id: string, source: Source, severity: Severity, component: string, runbook: string, state: AlertState, condition: string,
): Alert => ({ id, condition, source, severity, component, runbook, state, evidence: null });

export const ALERTS: readonly Alert[] = [
  ...burnAlerts,

  // Synthetic: a robot that behaves like a student, because small journeys cannot be watched by arithmetic.
  A('probe:public-failed', 'synthetic', 'page', 'pipeline:production-smoke', 'RB-01', 'wired', 'The hourly probe of the deployed bundle or the database REST API fails'),
  A('probe:half-configured', 'synthetic', 'ticket', 'pipeline:production-smoke', 'RB-01', 'wired', 'Only one of the two institutional production URLs is configured, so the institutional probe fails loudly instead of claiming health'),
  A('probe:no-recent-run', 'absence', 'ticket', 'pipeline:production-smoke', 'RB-01', 'defined', 'No probe result recorded in the last three hours (the scheduler skipped, or the record job lost its branch)'),

  // Delivery: the failures that have already happened silently.
  A('deploy:schema-failed', 'absence', 'page', 'pipeline:schema-deploy', 'RB-09', 'manual', 'The `main` branch record in the Supabase dashboard reads MIGRATIONS_FAILED, or ledger.snapshot disagrees with the migrations directory'),
  A('deploy:ledger-drift', 'ci', 'ticket', 'pipeline:schema-deploy', 'RB-09', 'wired', 'migrationorder.test.ts finds a migration numbered below the ledger watermark'),
  A('deploy:ci-red-on-main', 'ci', 'ticket', 'pipeline:ci', 'RB-08', 'wired', 'The CI run on main fails, which also holds the Pages and function deploys'),
  A('deploy:functions-failed', 'ci', 'ticket', 'pipeline:functions', 'RB-08', 'defined', 'The function deploy workflow fails, or functions.snapshot disagrees with what was last deployed'),
  A('deploy:stale-release', 'ci', 'ticket', 'pipeline:pages', 'RB-08', 'wired', 'A deploy was refused because main moved on, and nobody re-ran it'),

  // Scheduled work.
  A('job:absent', 'absence', 'ticket', 'job:push', 'RB-10', 'manual', 'supabase/health.sql block 6: a scheduled job is missing, or has not run within twice its period'),
  A('job:integrity-failed', 'integrity', 'page', 'job:console-audit-integrity', 'RB-10', 'defined', 'console_audit_verify() or the ledger chain verification reports a break'),

  // Queues.
  A('queue:push-backlog', 'threshold', 'ticket', 'queue:push_queue', 'RB-07', 'defined', 'Oldest unsent push_queue row older than 30 minutes'),
  A('queue:dead-letter', 'threshold', 'ticket', 'queue:support_notification_outbox', 'RB-07', 'defined', 'Any row dead-lettered in support_notification_outbox, or any new integration dead-letter event'),
  A('queue:emergency-lag', 'threshold', 'page', 'fn:push', 'RB-11', 'defined', 'An emergency notification not delivered to 95% of recipients within 60 seconds of dispatch'),

  // Money.
  A('billing:webhook-lag', 'threshold', 'page', 'fn:billing-webhook', 'RB-06', 'defined', 'A paid Stripe event unprocessed after 15 minutes, or signature failures above the baseline'),

  // AI and cost.
  A('ai:spend-half-cap', 'threshold', 'page', 'fn:claude', 'RB-05', 'defined', 'Provider usage reaches half the provider spend cap (MONITORING.md: the one alert allowed to wake somebody)'),
  A('ai:kill-switch-engaged', 'threshold', 'ticket', 'fn:claude', 'RB-05', 'defined', 'kill.ai_generation is engaged, or its table is unreadable (which counts as engaged)'),
  A('cost:anomaly', 'threshold', 'ticket', 'supabase-db', 'RB-15', 'defined', 'Any cost driver in cost.ts above 150% of its trailing four-week mean'),

  // Data and security.
  A('security:rls-gap', 'integrity', 'page', 'supabase-db', 'RB-03', 'manual', 'supabase/health.sql blocks 4 or 5 return rows, or ensure_rls_present is not 1'),
  A('security:auth-failure-rise', 'threshold', 'ticket', 'supabase-auth', 'RB-02', 'manual', 'Auth log failures rise on one provider over a week (usually a redirect URL, occasionally an attack)'),
  A('security:secret-exposed', 'ci', 'page', 'pipeline:ci', 'RB-13', 'wired', 'gitleaks finds a secret-shaped value, or a provider reports a leaked key'),

  // Integrations.
  A('connector:stale', 'threshold', 'ticket', 'fn:integration-tick', 'RB-14', 'defined', 'A connection is staler than its contracted freshness window (governance/data-contracts.ts)'),

  // Recovery.
  A('recovery:restore-overdue', 'absence', 'ticket', 'supabase-db', 'RB-12', 'defined', 'No successful provider-backed restore drill inside the class drill cadence'),

  // Capacity.
  A('capacity:db-connections', 'threshold', 'page', 'supabase-db', 'RB-15', 'defined', 'Database connections above 60% of the verified ceiling (capacity.ts TARGET_UTILISATION)'),

  // Edge function health, read by a person until it can be read by a machine.
  A('edge:error-shape', 'threshold', 'ticket', 'supabase-edge-runtime', 'RB-04', 'manual', 'Dashboard → Logs → Edge Functions shows one error repeating over seven days'),
];

export const alertsFor = (component: string): Alert[] => ALERTS.filter((a) => a.component === component);
