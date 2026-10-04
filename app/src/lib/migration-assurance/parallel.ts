/**
 * The parallel run: the incumbent and Semester doing the same work, compared.
 *
 * Validation says the data moved correctly. A parallel run says the *outcomes*
 * agree when real work is done on it: the same students register, the same
 * grades post, the same statements come out, the same people can open the same
 * documents. It is the only check that exercises the business rules sitting on
 * top of the data, and it can only happen when the work happens, so the plan is
 * a calendar question first: a registration comparison needs a registration
 * period, a billing comparison needs a billing cycle, a grade comparison needs
 * grade submission. `earliestExit` computes the soonest date the plan can be
 * honest, and says plainly when the calendar has no such event.
 *
 * A comparison is clean only if every outcome field agrees. A difference can be
 * *explained* — a rounding policy the institution chose, a rule the old system
 * got wrong and the registrar corrected — but only by a recorded decision with
 * a reason and a name. An unexplained difference is a failure, however small.
 */
import { DOMAINS } from './domains.ts';
import type { DomainId } from './types.ts';

export type CriticalEvent =
  | 'identity_change' | 'grade_submission' | 'transcript_request' | 'registration_window' | 'add_drop_period'
  | 'billing_cycle' | 'payment_posting' | 'access_review' | 'schedule_publication' | 'term_start' | 'move_in'
  | 'application_deadline' | 'document_request';

export interface Workflow {
  id: string;
  domain: DomainId;
  label: string;
  /** The real event the comparison must include at least once to mean anything. */
  event: CriticalEvent;
  /** What is compared, by name. */
  outcomes: readonly string[];
}

export const WORKFLOWS: readonly Workflow[] = [
  { id: 'identity.lifecycle', domain: 'identity', label: 'Join, leave and role change', event: 'identity_change', outcomes: ['can_sign_in', 'roles', 'directory_visibility'] },
  { id: 'academic_records.grade_posting', domain: 'academic_records', label: 'Grade submission and posting', event: 'grade_submission', outcomes: ['posted_grade', 'term_gpa', 'cumulative_gpa', 'standing'] },
  { id: 'academic_records.transcript', domain: 'academic_records', label: 'Transcript request', event: 'transcript_request', outcomes: ['lines', 'cumulative_gpa', 'credits_earned'] },
  { id: 'courses.schedule', domain: 'courses', label: 'Schedule of classes publication', event: 'schedule_publication', outcomes: ['sections_published', 'meeting_patterns', 'capacity'] },
  { id: 'learning_content.open', domain: 'learning_content', label: 'Course sites open for the term', event: 'term_start', outcomes: ['outline', 'files_by_hash', 'due_dates'] },
  { id: 'enrollments.registration', domain: 'enrollments', label: 'Registration period', event: 'registration_window', outcomes: ['schedule', 'credit_load', 'seats_remaining', 'waitlist_position', 'holds_applied'] },
  { id: 'enrollments.add_drop', domain: 'enrollments', label: 'Add and drop', event: 'add_drop_period', outcomes: ['schedule', 'credit_load', 'tuition_effect'] },
  { id: 'finance.billing', domain: 'finance', label: 'Billing cycle', event: 'billing_cycle', outcomes: ['statement_total_cents', 'due_date', 'late_fee_cents', 'plan_installment_cents'] },
  { id: 'finance.payments', domain: 'finance', label: 'Payment posting', event: 'payment_posting', outcomes: ['balance_cents', 'receipt'] },
  { id: 'family.access', domain: 'family', label: 'Guardian access review', event: 'access_review', outcomes: ['visible_scopes', 'consent_active'] },
  { id: 'campus_services.housing', domain: 'campus_services', label: 'Housing move-in', event: 'move_in', outcomes: ['room', 'occupancy', 'meal_plan'] },
  { id: 'career.applications', domain: 'career', label: 'Application deadline', event: 'application_deadline', outcomes: ['application_status', 'alumni_visibility'] },
  { id: 'documents.request', domain: 'documents', label: 'Document retrieval', event: 'document_request', outcomes: ['bytes_hash', 'who_can_open', 'hold'] },
];

export type Outcome = string | number | boolean | null;

export interface Observation {
  workflow: string;
  /** A counter, increasing. */
  cycle: number;
  observedAt: string;
  /** Which calendar event this cycle exercised, if any. */
  event?: CriticalEvent;
  incumbent: Readonly<Record<string, Outcome>>;
  semester: Readonly<Record<string, Outcome>>;
}

/** A difference somebody decided is acceptable, with their name and reason. */
export interface Explained {
  workflow: string;
  field: string;
  reason: string;
  approvedBy: string;
}

/** Clean cycles in a row that a workflow must end on. Stricter where a wrong record is a harm. */
export const MIN_CLEAN: Readonly<Record<'high' | 'standard', number>> = { high: 3, standard: 2 };

export interface Difference {
  workflow: string;
  cycle: number;
  field: string;
  explained: boolean;
}

function differences(o: Observation, explained: readonly Explained[], tolerance: number): Difference[] {
  const fields = new Set([...Object.keys(o.incumbent), ...Object.keys(o.semester)]);
  const out: Difference[] = [];
  for (const field of fields) {
    const a = o.incumbent[field];
    const b = o.semester[field];
    const equal = typeof a === 'number' && typeof b === 'number' ? Math.abs(a - b) <= tolerance : a === b;
    if (equal) continue;
    const ok = explained.some((x) => x.workflow === o.workflow && x.field === field && x.approvedBy.trim() !== '' && x.reason.trim().length >= 20);
    out.push({ workflow: o.workflow, cycle: o.cycle, field, explained: ok });
  }
  return out;
}

export interface WorkflowVerdict {
  workflow: string;
  domain: string;
  accepted: boolean;
  cleanTail: number;
  needed: number;
  exercisedEvent: boolean;
  unexplained: Difference[];
  reasons: string[];
}

export interface ParallelVerdict {
  accepted: boolean;
  workflows: WorkflowVerdict[];
  reasons: string[];
}

export interface ParallelInput {
  domains: readonly DomainId[];
  observations: readonly Observation[];
  explained: readonly Explained[];
  /** Open Sev-1 and Sev-2 incidents on the parallel environment. */
  openIncidents: number;
}

/**
 * Whether the parallel run can be accepted.
 *
 * Per workflow: it ends on enough clean cycles in a row, and at least one of
 * those cycles exercised the real event the workflow exists for. A month of
 * matching Tuesday traffic proves nothing about registration day. Numeric
 * tolerance is zero in a high-stakes domain: a cent is a cent.
 */
export function evaluateParallel(input: ParallelInput): ParallelVerdict {
  const verdicts = WORKFLOWS.filter((w) => input.domains.includes(w.domain)).map((w): WorkflowVerdict => {
    const stakes = DOMAINS.find((d) => d.id === w.domain)!.stakes;
    const mine = input.observations.filter((o) => o.workflow === w.id).sort((a, b) => a.cycle - b.cycle);
    const diffs = mine.map((o) => ({ o, d: differences(o, input.explained, stakes === 'high' ? 0 : 0.005) }));
    let tail = 0;
    for (let i = diffs.length - 1; i >= 0 && diffs[i].d.every((x) => x.explained); i -= 1) tail += 1;
    const tailObs = diffs.slice(diffs.length - tail).map((x) => x.o);
    const needed = MIN_CLEAN[stakes];
    const exercised = tailObs.some((o) => o.event === w.event);
    const reasons: string[] = [];
    if (mine.length === 0) reasons.push('no observations');
    if (tail < needed) reasons.push(`${tail} clean cycle${tail === 1 ? '' : 's'} in a row; ${needed} needed`);
    if (!exercised) reasons.push(`no clean cycle exercised ${w.event}`);
    const latest = diffs.at(-1);
    const live = latest ? latest.d.filter((x) => !x.explained) : [];
    if (live.length) reasons.push(`the latest cycle differs on ${live.map((x) => x.field).join(', ')} with no recorded explanation`);
    return { workflow: w.id, domain: w.domain, accepted: reasons.length === 0, cleanTail: tail, needed, exercisedEvent: exercised, unexplained: live, reasons };
  });
  const reasons = verdicts.filter((v) => !v.accepted).map((v) => `${v.workflow}: ${v.reasons.join('; ')}`);
  if (input.openIncidents > 0) reasons.push(`${input.openIncidents} Sev-1 or Sev-2 incident${input.openIncidents === 1 ? ' is' : 's are'} open`);
  return { accepted: reasons.length === 0, workflows: verdicts, reasons };
}

export interface Exit {
  /** The soonest date the plan can honestly end; null when the calendar cannot support it. */
  date: string | null;
  blockers: string[];
}

/**
 * The soonest the parallel run can end.
 *
 * Needs enough cycles *and* the real event for each workflow in scope. A
 * calendar with no future registration period means a registration comparison
 * cannot be done, and the answer is "not before there is one", never a date
 * that quietly skips it.
 */
export function earliestExit(input: { domains: readonly DomainId[]; start: string; cycleDays: number; calendar: Readonly<Partial<Record<CriticalEvent, readonly string[]>>> }): Exit {
  const start = Date.parse(input.start);
  const blockers: string[] = [];
  let latest = start;
  for (const w of WORKFLOWS.filter((x) => input.domains.includes(x.domain))) {
    const stakes = DOMAINS.find((d) => d.id === w.domain)!.stakes;
    const cycles = start + MIN_CLEAN[stakes] * input.cycleDays * 86_400_000;
    const event = (input.calendar[w.event] ?? []).map((d) => Date.parse(d)).filter((t) => t >= start).sort((a, b) => a - b)[0];
    if (event === undefined) {
      blockers.push(`${w.id}: the calendar has no ${w.event} on or after ${input.start}`);
      continue;
    }
    latest = Math.max(latest, cycles, event + input.cycleDays * 86_400_000 * (MIN_CLEAN[stakes] - 1));
  }
  return { date: blockers.length ? null : new Date(latest).toISOString().slice(0, 10), blockers };
}
