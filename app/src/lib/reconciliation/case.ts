// Reconciliation cases. The operational response when a Semester projection conflicts with,
// lags behind, or cannot be confirmed against an authoritative institutional source.
// Contract: docs/operations/reconciliation.yaml.

import { isIsoTimestamp } from '../assurance/timestamps';

export const CASE_STATES = [
  'detected',
  'triaged',
  'awaiting_source',
  'awaiting_institution',
  'repair_proposed',
  'repair_approved',
  'repaired',
  'reverified',
  'closed',
  'escalated',
] as const;
export type CaseState = (typeof CASE_STATES)[number];

export const DISCREPANCY_CLASSES = [
  'stale_source',
  'missing_authoritative_record',
  'mapping_error',
  'schema_change',
  'duplicate_delivery',
  'ordering_conflict',
  'policy_version_mismatch',
  'institution_override',
  'unknown',
] as const;
export type DiscrepancyClass = (typeof DISCREPANCY_CLASSES)[number];

/**
 * Repairs the contract names as safe for each class. A class with no entry has no
 * pre-approved repair, so its only route is escalation.
 */
export const SAFE_REPAIRS: Partial<Record<DiscrepancyClass, readonly string[]>> = {
  stale_source: ['refresh_source_snapshot', 'rerun_derived_evaluation', 'retain_prior_receipt_with_supersession_link'],
  mapping_error: ['quarantine_invalid_payload', 'correct_versioned_mapping', 'replay_from_known_safe_checkpoint', 'reverify_affected_records'],
  institution_override: ['preserve_institution_record', 'mark_semester_projection_superseded', 'notify_affected_workflow_owner'],
};

export const PROHIBITED_REPAIRS: readonly string[] = [
  'overwrite_authoritative_record',
  'backdate_audit_event',
  'delete_discrepancy',
  'rerun_consequential_command_without_idempotency',
];

/** Evidence every case must hold before it may close. */
export const RESOLUTION_REQUIRED: readonly string[] = [
  'source_refresh_verified',
  'affected_scope_rechecked',
  'audit_linked',
  'student_outcome_recomputed_or_reviewed',
  'case_owner_closed',
];

/**
 * escalated -> reverified is the route for a class with no safe repair: the institution
 * resolves or accepts the discrepancy, staff re-verify it, and closing still needs every
 * key in RESOLUTION_REQUIRED.
 */
const TRANSITIONS: Record<CaseState, readonly CaseState[]> = {
  detected: ['triaged'],
  triaged: ['awaiting_source', 'awaiting_institution', 'repair_proposed', 'escalated'],
  awaiting_source: ['triaged', 'repair_proposed', 'escalated'],
  awaiting_institution: ['triaged', 'escalated'],
  repair_proposed: ['repair_approved', 'escalated'],
  repair_approved: ['repaired'],
  repaired: ['reverified'],
  reverified: ['closed', 'triaged'],
  escalated: ['triaged', 'reverified'],
  closed: [],
};

export interface CaseEvent {
  from: CaseState;
  to: CaseState;
  at: string;
  by: string;
}

/** One repair cycle that ended in a failed re-verification. Kept so operators can see what was tried. */
export interface RepairAttempt {
  repair?: string;
  proposedBy?: string;
  approvedBy?: string;
  resolution: string[];
  endedAt: string;
}

export interface ReconciliationCase {
  id: string;
  tenantId: string;
  capability: string;
  discrepancy: DiscrepancyClass;
  severity: 'critical' | 'high' | 'medium' | 'low';
  state: CaseState;
  ownerId: string;
  /** When the discrepancy was detected; the basis for case age. The caller passes ISO 8601. */
  detectedAt: string;
  sourceSystem: string;
  cohortId: string;
  proposedRepair?: string;
  proposedBy?: string;
  approvedBy?: string;
  /** Evidence keys satisfied so far; closing needs every key in RESOLUTION_REQUIRED. */
  resolution: string[];
  history: CaseEvent[];
  /** Earlier cycles that failed re-verification, oldest first. The active cycle is in the fields above. */
  priorCycles: RepairAttempt[];
}

export type CaseResult = { ok: true; case: ReconciliationCase } | { ok: false; reason: string };

export interface MoveOptions {
  by: string;
  at: string;
  /** Required when moving to repair_proposed. */
  repair?: string;
  /** Evidence keys to record on this move. */
  evidence?: readonly string[];
}

/** A stored class that is not in the enum is refused, not looked up: `constructor` resolves through Object.prototype. */
const isDiscrepancyClass = (value: string): value is DiscrepancyClass =>
  (DISCREPANCY_CLASSES as readonly string[]).includes(value);

export function isRepairAllowed(discrepancy: DiscrepancyClass, repair: string): boolean {
  if (!isDiscrepancyClass(discrepancy)) return false;
  if (PROHIBITED_REPAIRS.includes(repair)) return false;
  return SAFE_REPAIRS[discrepancy]?.includes(repair) ?? false;
}

/** Actors are compared as people, not strings: "Ana" and " ana " are the same proposer. */
const actorKey = (actor: string): string => actor.trim().toLowerCase();

/**
 * A failed re-verification starts a new repair cycle: earlier evidence and approvals do not carry over,
 * but the attempt that failed is archived first so the case still says what was tried.
 */
function startNewCycle(c: ReconciliationCase, endedAt: string): ReconciliationCase {
  const attempt: RepairAttempt = {
    repair: c.proposedRepair,
    proposedBy: c.proposedBy,
    approvedBy: c.approvedBy,
    resolution: c.resolution,
    endedAt,
  };
  const next: ReconciliationCase = { ...c, resolution: [], priorCycles: [...c.priorCycles, attempt] };
  delete next.proposedRepair;
  delete next.proposedBy;
  delete next.approvedBy;
  return next;
}

export function openCase(input: {
  id: string;
  tenantId: string;
  capability: string;
  discrepancy: DiscrepancyClass;
  severity: ReconciliationCase['severity'];
  ownerId: string;
  detectedAt: string;
  sourceSystem: string;
  cohortId: string;
}): ReconciliationCase {
  return { ...input, state: 'detected', resolution: [], history: [], priorCycles: [] };
}

/** Applies one state move. Every rule the contract states is checked here, not in the caller. */
export function moveCase(current: ReconciliationCase, to: CaseState, options: MoveOptions): CaseResult {
  if (!options.by.trim()) return { ok: false, reason: 'a named actor is required' };
  // Checked before the table lookup: a persisted case with an unknown state must refuse, not throw.
  if (!(CASE_STATES as readonly string[]).includes(current.state)) {
    return { ok: false, reason: `unknown state: ${current.state}` };
  }
  if (!isDiscrepancyClass(current.discrepancy)) {
    return { ok: false, reason: `unknown discrepancy: ${current.discrepancy}` };
  }
  if (!TRANSITIONS[current.state].includes(to)) {
    return { ok: false, reason: `cannot move from ${current.state} to ${to}` };
  }
  if (current.state === 'escalated' && to === 'reverified' && SAFE_REPAIRS[current.discrepancy] !== undefined) {
    return { ok: false, reason: `${current.discrepancy} has a safe repair; repair it rather than re-verify an escalation` };
  }

  // History only moves forward: a move may not be earlier than detection or the move before it.
  if (!isIsoTimestamp(options.at)) return { ok: false, reason: 'at must be an ISO timestamp' };
  const floor = current.history.length > 0 ? current.history[current.history.length - 1].at : current.detectedAt;
  if (!isIsoTimestamp(floor)) return { ok: false, reason: 'case history has an invalid timestamp' };
  if (Date.parse(options.at) < Date.parse(floor)) {
    return { ok: false, reason: 'transition time precedes the case history' };
  }

  let next: ReconciliationCase = {
    ...current,
    state: to,
    resolution: [...new Set([...current.resolution, ...(options.evidence ?? [])])],
    history: [...current.history, { from: current.state, to, at: options.at, by: options.by }],
  };

  if (current.state === 'reverified' && to === 'triaged') next = startNewCycle(next, options.at);

  if (to === 'repair_proposed') {
    const repair = options.repair ?? '';
    if (PROHIBITED_REPAIRS.includes(repair)) return { ok: false, reason: `prohibited repair: ${repair}` };
    if (!isRepairAllowed(current.discrepancy, repair)) {
      return { ok: false, reason: `${repair} is not a safe repair for ${current.discrepancy}; escalate instead` };
    }
    next = { ...next, proposedRepair: repair, proposedBy: options.by };
  }

  if (to === 'repair_approved') {
    // Fail closed: without a recorded proposer there is no separation of duties to check.
    if (current.proposedBy === undefined || current.proposedBy.trim() === '') {
      return { ok: false, reason: 'the repair has no recorded proposer' };
    }
    if (actorKey(options.by) === actorKey(current.proposedBy)) {
      return { ok: false, reason: 'the proposer cannot approve their own repair' };
    }
    // Approval re-checks the stored repair: a malformed case must not be approved for a repair never proposed.
    const proposed = current.proposedRepair ?? '';
    if (proposed.trim() === '' || !isRepairAllowed(current.discrepancy, proposed)) {
      return { ok: false, reason: 'the proposed repair is missing or not allowed for this discrepancy' };
    }
    next = { ...next, approvedBy: options.by };
  }

  if (to === 'closed') {
    const missing = RESOLUTION_REQUIRED.filter((key) => !next.resolution.includes(key));
    if (missing.length > 0) return { ok: false, reason: `missing resolution evidence: ${missing.join(', ')}` };
  }

  return { ok: true, case: next };
}
