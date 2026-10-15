/**
 * Capacity planning as arithmetic anyone can re-run, not as a feeling.
 *
 * `docs/engineering-operations/CAPACITY-AND-SCALING-PLAN.md` says production
 * capacity is unproven and lists what must be proven. It does not say what a
 * registration morning *asks of the system*, which is the thing a load test
 * has to be sized from. This module does that half: given a cohort and a
 * peak event, it derives the demand on each shared resource — concurrent
 * requests, database connections, AI spend, notification fan-out — using
 * Little's law (in-flight = arrival rate × time in system) and nothing fancier.
 *
 * Three rules keep it honest, and they are the same rules the SLO drafts use.
 *
 * **Every number in `PROFILES` is a planning assumption, not a measurement.**
 * Nobody has measured how many requests a student makes in a registration
 * minute. They are written down so they can be argued with, replaced by field
 * data when it exists, and so a load test is sized from something.
 *
 * **A limit nobody has verified is `null`, and `null` never reads as "fits".**
 * Provider quotas move, plans differ, and a number copied from a pricing page
 * is how a capacity plan ends up certifying a ceiling that does not exist.
 * `fit()` returns `unknown_limit` rather than guess, and the scorecard counts
 * those as open work.
 *
 * **Peaks are not the average, and they stack.** Grade release lands on a
 * deadline week; a billing run lands on registration. `stack()` adds scenarios
 * so the question "what if two happen at once" has an answer in the same
 * units as the question "what if one does".
 *
 * Nothing here is a claim about production. See the Claim ceiling in
 * CAPACITY-AND-SCALING-PLAN.md: no supported user count, no headroom claim.
 */

export type ScenarioId =
  | 'registration_open'
  | 'deadline_spike'
  | 'grade_release'
  | 'billing_cycle'
  | 'ai_surge'
  | 'campus_emergency';

export interface Cohort {
  id: string;
  label: string;
  /** Accounts with access. */
  accounts: number;
}

/** The sizes capacity is planned at: the staged proof ladder in the capacity plan. */
export const COHORTS: readonly Cohort[] = [
  { id: 'beta', label: 'Invitation beta', accounts: 30 },
  { id: 'partner', label: 'Design partner cohort', accounts: 500 },
  { id: 'campus', label: 'One campus', accounts: 6_000 },
  { id: 'system', label: 'A university system', accounts: 30_000 },
];

export interface Scenario {
  id: ScenarioId;
  label: string;
  /** What actually happens, in the words of the person who lives it. */
  story: string;
  /** Share of accounts active in the busiest five-minute slice. */
  concurrentShare: number;
  /** Requests each concurrent account makes per minute at the peak. */
  requestsPerMinute: number;
  /** Seconds a request spends in the system, p95 target. */
  secondsInSystem: number;
  /** Database round trips behind one request. */
  queriesPerRequest: number;
  /** Seconds one query holds a connection. */
  secondsPerQuery: number;
  /** AI calls per concurrent account per minute (0 when the event has none). */
  aiCallsPerMinute: number;
  /** Notifications sent per account over the event. */
  notificationsPerAccount: number;
  /** Seconds in which those notifications should be delivered. */
  notificationWindowSeconds: number;
  /** Why the numbers are what they are — an assumption, labelled as one. */
  basis: string;
}

export const SCENARIOS: readonly Scenario[] = [
  {
    id: 'registration_open', label: 'Registration opens',
    story: 'At 7:00 a thousand students refresh the schedule builder and race for seats, and a seat that is gone must say so truthfully.',
    concurrentShare: 0.45, requestsPerMinute: 18, secondsInSystem: 0.8, queriesPerRequest: 4, secondsPerQuery: 0.02,
    aiCallsPerMinute: 0.2, notificationsPerAccount: 1, notificationWindowSeconds: 600,
    basis: 'Assumption. Synchronised start, repeated refresh, write contention on enrolment. The only scenario with a hard start time everyone knows.',
  },
  {
    id: 'deadline_spike', label: 'Deadline night',
    story: 'An assignment closes at 11:59 and half a course saves, uploads and submits in the last twenty minutes.',
    concurrentShare: 0.3, requestsPerMinute: 10, secondsInSystem: 1.2, queriesPerRequest: 5, secondsPerQuery: 0.02,
    aiCallsPerMinute: 0.6, notificationsPerAccount: 1, notificationWindowSeconds: 900,
    basis: 'Assumption. Draft autosave dominates writes; uploads are bigger but fewer. Losing a draft is the worst failure, so saves are sized, not averaged.',
  },
  {
    id: 'grade_release', label: 'Grades are released',
    story: 'A registrar flips a switch and every student in a term opens their grades inside a few minutes.',
    concurrentShare: 0.55, requestsPerMinute: 8, secondsInSystem: 0.6, queriesPerRequest: 6, secondsPerQuery: 0.015,
    aiCallsPerMinute: 0.1, notificationsPerAccount: 2, notificationWindowSeconds: 300,
    basis: 'Assumption. Read-heavy, highly cacheable per student but not shareable between students. Guardian notifications double the fan-out.',
  },
  {
    id: 'billing_cycle', label: 'Billing run and due date',
    story: 'Statements issue, then on the due date students pay and the processor retries webhooks that arrive late and twice.',
    concurrentShare: 0.12, requestsPerMinute: 6, secondsInSystem: 1.5, queriesPerRequest: 5, secondsPerQuery: 0.03,
    aiCallsPerMinute: 0, notificationsPerAccount: 1, notificationWindowSeconds: 3_600,
    basis: 'Assumption. Low request rate, high consequence: every payment event must be idempotent, so the cost is correctness under retry, not volume.',
  },
  {
    id: 'ai_surge', label: 'AI study surge',
    story: 'The night before an exam a fifth of the class asks the assistant to quiz them, all at once.',
    concurrentShare: 0.2, requestsPerMinute: 3, secondsInSystem: 4, queriesPerRequest: 3, secondsPerQuery: 0.02,
    aiCallsPerMinute: 2, notificationsPerAccount: 0, notificationWindowSeconds: 600,
    basis: 'Assumption. Long-lived requests hold a connection or worker for seconds, not milliseconds, and each carries a variable cost.',
  },
  {
    id: 'campus_emergency', label: 'Campus emergency',
    story: 'An alert goes out, and a large share of the campus opens the app within a minute to find out what to do.',
    concurrentShare: 0.6, requestsPerMinute: 12, secondsInSystem: 0.5, queriesPerRequest: 2, secondsPerQuery: 0.01,
    aiCallsPerMinute: 0, notificationsPerAccount: 1, notificationWindowSeconds: 60,
    basis: 'Assumption. The one scenario where degrading gracefully is not enough: the alert path must work when everything else is shed.',
  },
];

export interface Demand {
  scenario: ScenarioId;
  cohort: string;
  accounts: number;
  concurrentAccounts: number;
  /** Requests per second at the peak. */
  rps: number;
  /** Requests in flight at once (Little's law). */
  inFlight: number;
  /** Database connections held at once (Little's law on queries). */
  dbConnections: number;
  /** AI calls per minute at the peak. */
  aiCallsPerMinute: number;
  /** Notifications that must go out, and how fast. */
  notifications: number;
  notificationsPerSecond: number;
}

const ceil = (n: number) => Math.ceil(n - 1e-9);

export function demand(scenario: Scenario, cohort: Cohort): Demand {
  if (!Number.isInteger(cohort.accounts) || cohort.accounts <= 0) throw new RangeError(`${cohort.id}: accounts must be a positive whole number`);
  const concurrentAccounts = ceil(cohort.accounts * scenario.concurrentShare);
  const rps = (concurrentAccounts * scenario.requestsPerMinute) / 60;
  const inFlight = ceil(rps * scenario.secondsInSystem);
  const dbConnections = ceil(rps * scenario.queriesPerRequest * scenario.secondsPerQuery);
  const notifications = cohort.accounts * scenario.notificationsPerAccount;
  return {
    scenario: scenario.id,
    cohort: cohort.id,
    accounts: cohort.accounts,
    concurrentAccounts,
    rps: Math.round(rps * 100) / 100,
    inFlight,
    dbConnections,
    aiCallsPerMinute: Math.round(concurrentAccounts * scenario.aiCallsPerMinute * 100) / 100,
    notifications,
    notificationsPerSecond: Math.round((notifications / scenario.notificationWindowSeconds) * 100) / 100,
  };
}

/** Two events landing in the same window. Demands add; they do not average. */
export function stack(a: Demand, b: Demand): Demand {
  if (a.cohort !== b.cohort) throw new Error('Only the same cohort can stack: a peak is a share of one population');
  return {
    scenario: a.scenario,
    cohort: a.cohort,
    accounts: a.accounts,
    concurrentAccounts: Math.min(a.accounts, a.concurrentAccounts + b.concurrentAccounts),
    rps: Math.round((a.rps + b.rps) * 100) / 100,
    inFlight: a.inFlight + b.inFlight,
    dbConnections: a.dbConnections + b.dbConnections,
    aiCallsPerMinute: Math.round((a.aiCallsPerMinute + b.aiCallsPerMinute) * 100) / 100,
    notifications: a.notifications + b.notifications,
    notificationsPerSecond: Math.round((a.notificationsPerSecond + b.notificationsPerSecond) * 100) / 100,
  };
}

export type Resource = 'inFlight' | 'dbConnections' | 'aiCallsPerMinute' | 'notificationsPerSecond';

export interface Limit {
  resource: Resource;
  /** Where the ceiling lives: the thing that has to be checked to fill it in. */
  where: string;
  /** The verified ceiling, or null while nobody has read it from the provider. */
  value: number | null;
  /** How the number was learned, once it is. */
  evidence: string | null;
}

/**
 * The ceilings, and the honest state of each. These are the *questions* a
 * capacity review has to answer; they are `null` on purpose. Filling one in
 * means attaching the dated evidence the capacity plan asks for.
 */
export const LIMITS: readonly Limit[] = [
  { resource: 'inFlight', where: 'Edge Function and gateway concurrent-invocation ceiling on the production plan', value: null, evidence: null },
  { resource: 'dbConnections', where: 'Postgres max connections minus reserved, behind the pooler, on the production compute size', value: null, evidence: null },
  { resource: 'aiCallsPerMinute', where: 'The AI provider account rate limit, per model, on the production key', value: null, evidence: null },
  { resource: 'notificationsPerSecond', where: 'The push and email providers\' send rate on the production account', value: null, evidence: null },
];

export type Fit = 'fits' | 'tight' | 'exceeds' | 'unknown_limit';

/** Headroom the plan insists on: running at the ceiling is already an outage. */
export const TARGET_UTILISATION = 0.6;

export function fit(demandValue: number, limit: Limit): { fit: Fit; utilisation: number | null } {
  if (limit.value === null) return { fit: 'unknown_limit', utilisation: null };
  if (limit.value <= 0) throw new RangeError(`${limit.resource}: a verified limit must be positive`);
  const utilisation = demandValue / limit.value;
  if (utilisation > 1) return { fit: 'exceeds', utilisation };
  if (utilisation > TARGET_UTILISATION) return { fit: 'tight', utilisation };
  return { fit: 'fits', utilisation };
}

export interface PlanRow {
  demand: Demand;
  checks: Array<{ resource: Resource; need: number; fit: Fit; utilisation: number | null }>;
}

/** Every scenario at one cohort size, against whatever limits are known. */
export function plan(cohort: Cohort, limits: readonly Limit[] = LIMITS): PlanRow[] {
  return SCENARIOS.map((s) => {
    const d = demand(s, cohort);
    return {
      demand: d,
      checks: limits.map((l) => {
        const need = d[l.resource];
        return { resource: l.resource, need, ...fit(need, l) };
      }),
    };
  });
}

/**
 * AI spend at the peak, and whether the three caps are in the order
 * MONITORING.md insists on: per-account cap × accounts must sit under the
 * provider cap, or the cap that fires first is the wrong one.
 */
export interface AiCaps {
  /** Calls one account may make per month (MONTHLY_CALL_LIMIT on `claude`). */
  perAccountMonthlyCalls: number;
  /** Provider-side hard stop, in the currency the provider bills. Null while unset. */
  providerMonthlyCap: number | null;
  /** Expected cost of one call, from the provider's price and a measured token mix. Null while unmeasured. */
  costPerCall: number | null;
}

export function aiCapOrder(accounts: number, caps: AiCaps): 'ordered' | 'inverted' | 'unknown' {
  if (caps.providerMonthlyCap === null || caps.costPerCall === null) return 'unknown';
  const worstCase = accounts * caps.perAccountMonthlyCalls * caps.costPerCall;
  return worstCase <= caps.providerMonthlyCap ? 'ordered' : 'inverted';
}
