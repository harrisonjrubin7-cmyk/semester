/**
 * The consequential workflows, as state machines rather than button handlers.
 *
 * A student cannot change a submitted assessment after the deadline; a grade
 * cannot be marked passed back before the gradebook acknowledged it; a
 * deletion cannot complete while a legal hold is unchecked. Each of those is
 * an illegal transition, and the reliable way to make one impossible is to
 * write down every legal one and refuse the rest — which is what
 * `transition` does, for every machine in `WORKFLOWS`.
 *
 * Two of this repository's machines already live where their storage is,
 * and are not repeated here: the two-phase university action in
 * `server/institution/journal.ts` (`ready → processing → completed | pending |
 * refused | uncertain`), and a tenant's go-live in
 * `app/src/lib/governance/rollout.ts`, whose states are the database's own
 * (`tenant_rollout.state`). This module holds the four the specification
 * names that had no machine at all, in the states it gives them.
 *
 * A machine here is a pure description. It has no storage and takes no
 * action; a caller checks `transition` before it writes, and writes the
 * state it was handed back. That is deliberate: a definition with no side
 * effects can be tested exhaustively, and `workflow.test.ts` does — every
 * pair of states, for every machine.
 *
 * See `docs/architecture/0009-workflow-state-machines.md`.
 */

export interface WorkflowDefinition<S extends string = string> {
  type: string;
  initial: S;
  /** States with no exits, where the workflow is done and stays done. */
  terminal: readonly S[];
  /** Every legal move. A state absent here, or with an empty list, has none. */
  transitions: Readonly<Record<S, readonly S[]>>;
  /** Moves that are an exception path: recovery, ambiguity, a hold. Named so a screen can say so. */
  exceptional: readonly (readonly [S, S])[];
}

export type TransitionVerdict<S extends string = string> =
  | { ok: true; state: S; exceptional: boolean }
  | { ok: false; reason: string };

/**
 * Whether `from → to` is a move this machine allows, and if so whether it is
 * one of its exception paths. Refuses a state the machine does not have as
 * firmly as a move it does not allow: the two look the same from a client
 * that guessed a state name.
 */
export function transition<S extends string>(def: WorkflowDefinition<S>, from: S, to: S): TransitionVerdict<S> {
  const known = def.transitions;
  if (!Object.prototype.hasOwnProperty.call(known, from)) return { ok: false, reason: `${def.type}: no state "${from}"` };
  if (!Object.prototype.hasOwnProperty.call(known, to)) return { ok: false, reason: `${def.type}: no state "${to}"` };
  if (def.terminal.includes(from)) return { ok: false, reason: `${def.type}: "${from}" is final` };
  if (!known[from].includes(to)) return { ok: false, reason: `${def.type}: "${from}" cannot become "${to}"` };
  return { ok: true, state: to, exceptional: def.exceptional.some(([a, b]) => a === from && b === to) };
}

/** Walk a path from a state, stopping at the first refusal. */
export function walk<S extends string>(def: WorkflowDefinition<S>, from: S, path: readonly S[]): TransitionVerdict<S> {
  let state = from;
  for (const next of path) {
    const verdict = transition(def, state, next);
    if (!verdict.ok) return verdict;
    state = verdict.state;
  }
  return { ok: true, state, exceptional: false };
}

export const ASSESSMENT_SUBMISSION_STATES = [
  'not_started', 'in_progress', 'autosaved', 'ready_to_submit', 'submission_requested',
  'finalized', 'receipt_issued', 'recovery_required', 'restored', 'ambiguous', 'reconciliation_required',
] as const;
export type AssessmentSubmissionState = (typeof ASSESSMENT_SUBMISSION_STATES)[number];

/**
 * A submission. The happy path runs down the left; the two exception paths
 * are a lost draft (`recovery_required → restored`, back to work) and a
 * submit whose outcome is unknown (`ambiguous → reconciliation_required`),
 * which can only end in `finalized` once somebody has established what the
 * school received — never in another submit.
 */
export const ASSESSMENT_SUBMISSION: WorkflowDefinition<AssessmentSubmissionState> = {
  type: 'assessment_submission',
  initial: 'not_started',
  terminal: ['receipt_issued'],
  transitions: {
    not_started: ['in_progress'],
    in_progress: ['autosaved', 'ready_to_submit', 'recovery_required'],
    autosaved: ['in_progress', 'ready_to_submit', 'recovery_required'],
    ready_to_submit: ['submission_requested', 'in_progress'],
    submission_requested: ['finalized', 'ambiguous'],
    ambiguous: ['reconciliation_required'],
    reconciliation_required: ['finalized'],
    finalized: ['receipt_issued'],
    receipt_issued: [],
    recovery_required: ['restored'],
    restored: ['in_progress'],
  },
  exceptional: [
    ['in_progress', 'recovery_required'], ['autosaved', 'recovery_required'],
    ['submission_requested', 'ambiguous'], ['ambiguous', 'reconciliation_required'],
  ],
};

export const SUPPORT_ACCESS_STATES = ['requested', 'active', 'declined', 'revoked', 'expired'] as const;
export type SupportAccessState = (typeof SUPPORT_ACCESS_STATES)[number];

/**
 * A student-created support grant (`support_access_grant`). It starts
 * `requested` only when the supporter proposed it; a student creating one
 * themselves starts it `active`. It ends by the student's hand (`revoked`)
 * or the clock's (`expired`), and neither end reopens.
 */
export const SUPPORT_ACCESS: WorkflowDefinition<SupportAccessState> = {
  type: 'support_access',
  initial: 'requested',
  terminal: ['declined', 'revoked', 'expired'],
  transitions: {
    requested: ['active', 'declined', 'expired'],
    active: ['revoked', 'expired'],
    declined: [],
    revoked: [],
    expired: [],
  },
  exceptional: [['requested', 'expired']],
};

export const DATA_DELETION_STATES = [
  'received', 'identity_verified', 'scope_confirmed', 'legal_hold_checked', 'export_prepared',
  'deletion_scheduled', 'deletion_completed', 'certificate_available', 'retained_with_explanation',
] as const;
export type DataDeletionState = (typeof DATA_DELETION_STATES)[number];

/**
 * A deletion request. The export is optional, which is why
 * `legal_hold_checked` may go straight to `deletion_scheduled`; the legal
 * hold is not, which is why nothing reaches `deletion_scheduled` without
 * passing through it. `retained_with_explanation` is the one honest end
 * other than a certificate.
 */
export const DATA_DELETION: WorkflowDefinition<DataDeletionState> = {
  type: 'data_deletion',
  initial: 'received',
  terminal: ['certificate_available', 'retained_with_explanation'],
  transitions: {
    received: ['identity_verified'],
    identity_verified: ['scope_confirmed'],
    scope_confirmed: ['legal_hold_checked'],
    legal_hold_checked: ['export_prepared', 'deletion_scheduled', 'retained_with_explanation'],
    export_prepared: ['deletion_scheduled'],
    deletion_scheduled: ['deletion_completed'],
    deletion_completed: ['certificate_available'],
    certificate_available: [],
    retained_with_explanation: [],
  },
  exceptional: [['legal_hold_checked', 'retained_with_explanation']],
};

export const GRADE_PASSBACK_STATES = [
  'draft', 'ready_for_validation', 'authorized', 'queued', 'sent', 'acknowledged', 'reconciled',
  'retry', 'ambiguous', 'reconciliation_required', 'corrected', 'manually_resolved',
] as const;
export type GradePassbackState = (typeof GRADE_PASSBACK_STATES)[number];

/**
 * A grade on its way to the institution's gradebook. `reconciled` is reached
 * only through `acknowledged`: a grade is not passed back because it was
 * sent, it is passed back because the gradebook said so. A send whose
 * answer never came is `ambiguous`, and like the journal's `uncertain` it
 * is resolved by asking, not by sending again.
 */
export const GRADE_PASSBACK: WorkflowDefinition<GradePassbackState> = {
  type: 'grade_passback',
  initial: 'draft',
  terminal: ['reconciled', 'corrected', 'manually_resolved'],
  transitions: {
    draft: ['ready_for_validation'],
    ready_for_validation: ['authorized', 'draft'],
    authorized: ['queued'],
    queued: ['sent', 'retry'],
    retry: ['queued'],
    sent: ['acknowledged', 'ambiguous'],
    acknowledged: ['reconciled'],
    ambiguous: ['reconciliation_required'],
    reconciliation_required: ['corrected', 'manually_resolved'],
    reconciled: [],
    corrected: [],
    manually_resolved: [],
  },
  exceptional: [
    ['queued', 'retry'], ['sent', 'ambiguous'], ['ambiguous', 'reconciliation_required'],
  ],
};

export const ORGANIZATION_RECOGNITION_STATES = [
  'draft', 'submitted', 'under_review', 'active', 'active_with_conditions', 'inactive', 'archived', 'dissolved',
] as const;
export type OrganizationRecognitionState = (typeof ORGANIZATION_RECOGNITION_STATES)[number];

/**
 * A student organization's standing with its institution. Recognition is
 * given by the institution (`under_review → active`) and never by the
 * organization itself, which is why `submitted` and `under_review` have no
 * exit to `active` except through the review. `active_with_conditions` is
 * the remediation state: the organization keeps operating while it fixes
 * what the review named, and either returns to `active` or falls to
 * `inactive`. An inactive or archived organization can be renewed — a club
 * that lost its officers over a summer is not a dissolved club — but
 * `dissolved` is final, and a new organization starts at `draft` again.
 * `app/src/community/lifecycle.ts` says who may make each move and what a
 * move must record.
 */
export const ORGANIZATION_RECOGNITION: WorkflowDefinition<OrganizationRecognitionState> = {
  type: 'organization_recognition',
  initial: 'draft',
  terminal: ['dissolved'],
  transitions: {
    draft: ['submitted', 'archived'],
    submitted: ['under_review', 'draft'],
    under_review: ['active', 'active_with_conditions', 'draft'],
    active: ['active_with_conditions', 'inactive', 'archived', 'dissolved'],
    active_with_conditions: ['active', 'inactive', 'archived', 'dissolved'],
    inactive: ['active', 'archived', 'dissolved'],
    archived: ['active', 'dissolved'],
    dissolved: [],
  },
  exceptional: [
    ['submitted', 'draft'], ['under_review', 'draft'], ['under_review', 'active_with_conditions'],
    ['active', 'active_with_conditions'], ['active', 'dissolved'], ['active_with_conditions', 'dissolved'],
  ],
};

export const WORKFLOWS = {
  assessment_submission: ASSESSMENT_SUBMISSION,
  support_access: SUPPORT_ACCESS,
  data_deletion: DATA_DELETION,
  grade_passback: GRADE_PASSBACK,
  organization_recognition: ORGANIZATION_RECOGNITION,
} as const;

export type WorkflowType = keyof typeof WORKFLOWS;
