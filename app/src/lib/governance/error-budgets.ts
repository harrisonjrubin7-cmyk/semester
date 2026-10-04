/**
 * Service-level objectives for the journeys a student actually takes, and the
 * error budget each one leaves — written as data so a release review can
 * compute the answer instead of arguing it.
 *
 * `docs/SERVICE-RELIABILITY-AND-SUPPORT-OPERATIONS.md` decided that
 * `slo_definitions` and `error_budgets` are documentation plus checks rather
 * than tables. This is that documentation's machine half;
 * `docs/operating-model/SLOS-AND-ERROR-BUDGETS.md` is the prose half and
 * `docs.test.ts` holds the two together.
 *
 * Two rules shape the file.
 *
 * **An objective names a student outcome, not a server.** "The API is up" can
 * be true while nobody can save a plan. Each journey says what counts as an
 * eligible attempt, what counts as a good one, and which failures are bad —
 * and a failure Semester caused stays bad even when a third-party system was
 * involved in the workflow.
 *
 * **A budget that does not change a release is only a dashboard number.** So
 * `review()` does not stop at a percentage: it returns the release rule the
 * state imposes on the affected journey, and flags a burn rate high enough to
 * need an incident review before the monthly objective is formally missed.
 *
 * These are targets. Nothing here is a claim that Semester meets them: there is
 * no measured availability history yet (PROCUREMENT_CHECKLIST.md, "Uptime
 * SLA"), and nothing here reads the network, the database or the clock. The
 * counts are passed in, so the same counts always give the same verdict.
 */

export interface Journey {
  id: string;
  /** The student outcome, in the student's words. */
  name: string;
  /**
   * The objective as a percentage with at most two decimals (99.95, not
   * 0.9995). Kept as the human-written figure so the arithmetic below can
   * work in whole parts per ten thousand and never round a budget wrongly.
   */
  slo: number;
  /** What a good event is — the outcome that must hold. */
  good: string;
  /** Why this journey gets this objective. */
  why: string;
  /**
   * A figure written by the repository's authors that no owner has yet
   * approved. It is computed and reviewed like any other, but it is a target
   * somebody still has to adopt, and the doc lists it apart from the adopted
   * ones so it is never quoted as a commitment.
   */
  proposed?: true;
  /**
   * The bad events specific to this journey, for the ones that are not
   * durable writes (`BAD_WRITE_OUTCOMES` is the list for those). Absent means
   * the shared write list applies.
   */
  bad?: readonly string[];
}

export const JOURNEYS: readonly Journey[] = [
  { id: 'sign_in', name: 'Sign in', slo: 99.95, good: 'The student reaches their own workspace', why: 'Students cannot use the product without access' },
  { id: 'today_load', name: 'Today dashboard load', slo: 99.9, good: 'Today renders its meaningful content', why: 'The primary daily journey' },
  { id: 'plan_save', name: 'Plan save', slo: 99.95, good: 'The plan is durably stored and can be retrieved by the same authorized user', why: 'Lost planning work breaks trust' },
  { id: 'advisor_agenda_save', name: 'Advisor agenda save', slo: 99.95, good: 'The agenda is durably stored and retrievable', why: 'An important advising workflow' },
  { id: 'search', name: 'Search', slo: 99.9, good: 'Valid results within the latency target', why: 'Finding support and course information is core' },
  { id: 'ask_semester', name: 'Ask Semester', slo: 99.5, good: 'A policy-compliant answer or a safe fallback', why: 'AI must fail safely, not block core work' },
  { id: 'assignment_draft_save', name: 'Assignment draft save', slo: 99.99, good: 'The draft is durably stored during a committed window', why: 'Losing student work is high impact' },
  { id: 'privacy_request_intake', name: 'Data export or delete request intake', slo: 99.99, good: 'The request is accepted and tracked', why: 'A privacy workflow must not fail' },

  // Proposed. The brief for the platform named these journeys and this file had
  // no objective for them. The figures follow one rule, not a measurement:
  // money, records and anything that can disclose another person's data sit at
  // 99.95; a read the student relies on daily at 99.9; a journey that depends on
  // a system Semester does not run at 99.5, where the part Semester owns is
  // still counted. Each needs an owner to adopt or change it.
  {
    id: 'calendar_view', name: 'Calendar load', slo: 99.9, proposed: true,
    good: 'The calendar shows the student’s own events and tasks for the range viewed, each with its source and as-of time',
    why: 'Where a student checks what is due, so a wrong or stale view is a missed deadline',
    bad: ['Returns an error', 'Times out', 'Shows data older than its stated as-of time as though it were current', 'Shows an event at the wrong date or time', 'Shows another person’s events'],
  },
  {
    id: 'course_access', name: 'Course access', slo: 99.9, proposed: true,
    good: 'An enrolled student opens their course and its current-term materials, and a student who is not enrolled does not',
    why: 'Coursework is unreachable without it, and admitting the wrong person is worse than an outage',
    bad: ['Returns an error', 'Times out', 'Refuses a student who is enrolled', 'Admits a student who is not enrolled', 'Omits materials that exist for the term'],
  },
  {
    id: 'grade_retrieval', name: 'Grade retrieval', slo: 99.95, proposed: true,
    good: 'A released grade is shown for the right student and course with its as-of time, or the student is told the source is unavailable',
    why: 'A wrong or unreleased grade is a record error, and silence is worse than saying the source is down',
    bad: ['Returns an error', 'Times out', 'Shows a grade that has not been released', 'Shows the wrong student’s or the wrong course’s grade', 'Shows a stale grade as though it were current'],
  },
  {
    id: 'registration_submit', name: 'Registration submission', slo: 99.95, proposed: true,
    good: 'A registration command is accepted or refused with a reason the student can read, exactly once, and the student sees which',
    why: 'An official write on a deadline: a lost or doubled registration cannot be undone by retrying',
    bad: ['Returns an error', 'Times out', 'Is lost', 'Is applied to the wrong section', 'Is applied twice', 'Is left pending with no reconciliation', 'Refuses without a reason the student can read'],
  },
  {
    id: 'billing_statement_payment', name: 'Billing statement and payment', slo: 99.95, proposed: true,
    good: 'The student sees an accurate balance with its as-of time, and a payment they submit is recorded exactly once',
    why: 'Money: a wrong balance or a doubled charge is a financial error with a deadline attached',
    bad: ['Returns an error', 'Times out', 'Shows a balance that does not match the ledger', 'Records a payment twice', 'Loses a payment that the processor accepted', 'Leaves a payment unconfirmed with no reconciliation'],
  },
  {
    id: 'communication_delivery', name: 'Communication delivery', slo: 99.9, proposed: true,
    good: 'A notification or announcement reaches the recipient’s chosen channel within its latency target, or the sender is told it failed',
    why: 'Deadlines and changes reach students only if the message does',
    bad: ['Is lost with no failure shown to the sender', 'Reaches the wrong recipient', 'Reaches a recipient who opted out of it', 'Is delivered twice', 'Arrives after its latency target'],
  },
  {
    id: 'integration_sync', name: 'Connected-source sync', slo: 99.5, proposed: true,
    good: 'A scheduled sync completes and reconciles, or the student sees it degraded with the time of the last good sync, and native features keep working',
    why: 'Connected systems are not Semester’s to run, so this is looser, but a silent failure is never acceptable',
    bad: ['Fails with no degraded state shown', 'Writes to the wrong record', 'Imports a duplicate', 'Is left unreconciled past its window', 'Stops a native feature from working'],
  },
];

/**
 * The bad events every durable-write journey counts. An error is the obvious
 * one; the others are the ways a write can look successful and not be.
 */
export const BAD_WRITE_OUTCOMES = [
  'Returns an error',
  'Times out',
  'Is lost',
  'Is written to the wrong record',
  'Creates an unintended duplicate',
  'Cannot be confirmed or reconciled',
] as const;

/** The one kind of event a journey may exclude, and it must be written down. */
export const PERMITTED_EXCLUSION = 'The student intentionally cancelled the operation';

export type BudgetState = 'no_data' | 'healthy' | 'watch' | 'at_risk' | 'exhausted' | 'breached';

export const POLICY: Record<Exclude<BudgetState, 'no_data'>, { label: string; remaining: string; release: string; action: string }> = {
  healthy: { label: 'Healthy', remaining: 'More than 50%', release: 'Normal releases', action: 'Review weekly' },
  watch: { label: 'Watch', remaining: '25%–50%', release: 'Limit risky changes to the affected journey', action: 'Add reliability work to the sprint' },
  at_risk: { label: 'At risk', remaining: '10%–25%', release: 'Freeze nonessential changes to the affected flow', action: 'Mitigation plan and leadership review' },
  exhausted: { label: 'Exhausted', remaining: 'Less than 10%', release: 'Freeze noncritical releases affecting the service', action: 'Corrective action before release resumes' },
  breached: { label: 'Breached', remaining: 'Objective missed', release: 'Follow the incident and SLA process', action: 'Postmortem, customer communication if material, remediation' },
};

/**
 * A burn rate at or above this many times the sustainable rate needs an
 * incident review now, whether or not the window's objective is yet missed.
 */
export const URGENT_BURN = 10;

/** The objective in parts per ten thousand: 99.95 → 9995. */
function partsOf(slo: number): number {
  const parts = Math.round(slo * 100);
  if (parts <= 0 || parts >= 10000 || Math.abs(parts - slo * 100) > 1e-6) {
    throw new RangeError(`An objective is a percentage between 0 and 100 with at most two decimals, not ${slo}`);
  }
  return parts;
}

/** How many bad events the window may hold before the objective is missed. */
export function allowedFailures(eligible: number, slo: number): number {
  return Math.floor((eligible * (10000 - partsOf(slo))) / 10000);
}

/**
 * How fast the budget is being spent, as a multiple of the rate that would
 * spend exactly all of it over the window. 1 is sustainable; 10 empties a
 * thirty-day budget in three days.
 */
export function burnRate(eligible: number, bad: number, slo: number): number {
  if (eligible === 0) return 0;
  return (bad * 10000) / (eligible * (10000 - partsOf(slo)));
}

export function budgetState(eligible: number, bad: number, slo: number): BudgetState {
  if (eligible === 0) return 'no_data';
  const allowed = allowedFailures(eligible, slo);
  if (bad > allowed) return 'breached';
  if (allowed === 0) return 'healthy';
  const remaining = (allowed - bad) / allowed;
  if (remaining > 0.5) return 'healthy';
  if (remaining >= 0.25) return 'watch';
  if (remaining >= 0.1) return 'at_risk';
  return 'exhausted';
}

export interface Measurement {
  journey: string;
  /** Eligible attempts in the window. */
  eligible: number;
  /** Bad events in the window. */
  bad: number;
  /**
   * The same counts over a short recent lookback — the last hour, say. Burn
   * is read from here when it is given, because burn over the whole window
   * can only reach ten once the window is already breached: the point of
   * measuring it is to see the fire while most of the budget is still there.
   */
  recent?: { eligible: number; bad: number };
}

export interface JourneyReview {
  journey: Journey;
  state: BudgetState;
  allowed: number;
  bad: number;
  burn: number;
  /** The release rule the state imposes; null while there is no data. */
  release: string | null;
  urgent: boolean;
}

/** One journey's verdict, with the release rule it carries. */
export function review(m: Measurement): JourneyReview {
  const journey = JOURNEYS.find((j) => j.id === m.journey);
  if (!journey) throw new Error(`No journey called ${m.journey}`);
  for (const c of m.recent ? [m, m.recent] : [m]) {
    if (!Number.isInteger(c.eligible) || !Number.isInteger(c.bad) || c.eligible < 0 || c.bad < 0 || c.bad > c.eligible) {
      throw new RangeError(`${m.journey}: counts must be whole, non-negative, and bad cannot exceed eligible`);
    }
  }
  const state = budgetState(m.eligible, m.bad, journey.slo);
  const burn = m.recent ? burnRate(m.recent.eligible, m.recent.bad, journey.slo) : burnRate(m.eligible, m.bad, journey.slo);
  return {
    journey,
    state,
    allowed: m.eligible === 0 ? 0 : allowedFailures(m.eligible, journey.slo),
    bad: m.bad,
    burn,
    release: state === 'no_data' ? null : POLICY[state].release,
    urgent: state === 'breached' || burn >= URGENT_BURN,
  };
}

/**
 * The frontend half: what a student feels before any server is slow. Each
 * target says whether anything in the repository measures it yet. Most of
 * the field metrics are not measured — there is deliberately no aggregate of
 * real devices (LAUNCH-HARDENING-REPORT.md, Performance) — and the doc says
 * so rather than printing a target as though it were a reading.
 */
export interface FrontendTarget {
  metric: string;
  target: string;
  failure: string;
  /** A test in this repository that guards the property structurally, if one exists. */
  guard: string | null;
}

export const FRONTEND_TARGETS: readonly FrontendTarget[] = [
  { metric: 'Largest Contentful Paint, p75', target: '≤ 2.5 s', failure: 'The student waits too long for the main content', guard: null },
  { metric: 'Interaction to Next Paint, p75', target: '≤ 200 ms', failure: 'Buttons and tabs feel unresponsive', guard: null },
  { metric: 'Cumulative Layout Shift, p75', target: '≤ 0.10', failure: 'Cards jump and the student taps the wrong target', guard: null },
  { metric: 'Route transition', target: '≤ 500 ms or an immediate skeleton', failure: 'Navigation feels stalled', guard: null },
  { metric: 'JS error-free sessions', target: '≥ 99.5%', failure: 'A route fails after its first render', guard: null },
  { metric: 'Focus visible', target: '100% of focusable controls', failure: 'Keyboard users cannot see where they are', guard: 'app/src/a11y/focus.test.ts' },
  { metric: 'Drag alternative', target: '100% of draggable items', failure: 'A pointer that cannot hold still cannot move anything', guard: 'app/src/a11y/dragging.test.ts' },
  { metric: 'Layout-overflow rate on critical routes', target: '0%', failure: 'Horizontal scroll or clipped controls on a phone', guard: null },
  { metric: 'Focus-obscured rate', target: '0%', failure: 'A sticky header or composer hides the focused control', guard: null },
  { metric: 'Offline draft recovery', target: '100% of critical drafts', failure: 'Work disappears after a network interruption', guard: null },
];
