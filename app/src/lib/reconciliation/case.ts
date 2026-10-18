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

export const CASE_SEVERITIES = ['critical', 'high', 'medium', 'low'] as const;
export type CaseSeverity = (typeof CASE_SEVERITIES)[number];

export interface ReconciliationCase {
  id: string;
  tenantId: string;
  capability: string;
  discrepancy: DiscrepancyClass;
  severity: CaseSeverity;
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
  // Refused at creation: a case that could never move again, or never close, is not produced.
  if (!isIsoTimestamp(input.detectedAt)) throw new Error('detectedAt must be an ISO timestamp');
  // A class outside the contract would strand the case: every later move rejects it as unknown.
  if (!isDiscrepancyClass(input.discrepancy)) throw new Error('discrepancy is not a known class');
  if (!(CASE_SEVERITIES as readonly string[]).includes(input.severity)) throw new Error('severity is not a known level');
  const required = { id: input.id, tenantId: input.tenantId, capability: input.capability, ownerId: input.ownerId, sourceSystem: input.sourceSystem, cohortId: input.cohortId };
  for (const [name, value] of Object.entries(required)) {
    if (typeof value !== 'string' || value.trim() === '') throw new Error(`${name} is required`);
  }
  return { ...input, state: 'detected', resolution: [], history: [], priorCycles: [] };
}

/** Applies one state move. Every rule the contract states is checked here, not in the caller. */
export function moveCase(current: ReconciliationCase, to: CaseState, options: MoveOptions): CaseResult {
  if (typeof options.by !== 'string' || options.by.trim() === '') return { ok: false, reason: 'a named actor is required' };
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

  // History only moves forward: every stored entry, in order, must sit between detection and the next move.
  if (!isIsoTimestamp(options.at)) return { ok: false, reason: 'at must be an ISO timestamp' };
  if (!isIsoTimestamp(current.detectedAt)) return { ok: false, reason: 'case history has an invalid timestamp' };
  let floor = current.detectedAt;
  for (const entry of current.history) {
    if (!isIsoTimestamp(entry.at) || Date.parse(entry.at) < Date.parse(floor)) {
      return { ok: false, reason: 'case history is out of order or has an invalid timestamp' };
    }
    floor = entry.at;
  }
  if (Date.parse(options.at) < Date.parse(floor)) {
    return { ok: false, reason: 'transition time precedes the case history' };
  }

  // Approval records no evidence: the approver decides the repair, and evidence gathered for it must come after execution.
  const recorded = to === 'repair_approved' ? [] : (options.evidence ?? []);
  let resolution = [...new Set([...current.resolution, ...recorded])];
  // Repair execution and escalation each start a fresh evidence window: nothing gathered before them can satisfy the close.
  if (to === 'repaired') resolution = [...new Set(recorded)];
  if (to === 'escalated') resolution = [];
  let next: ReconciliationCase = {
    ...current,
    state: to,
    resolution,
    history: [...current.history, { from: current.state, to, at: options.at, by: options.by }],
  };

  if (current.state === 'reverified' && to === 'triaged') next = startNewCycle(next, options.at);

  if (to === 'repair_proposed') {
    const repair = options.repair ?? '';
    if (PROHIBITED_REPAIRS.includes(repair)) return { ok: false, reason: `prohibited repair: ${repair}` };
    if (!isRepairAllowed(current.discrepancy, repair)) {
      return { ok: false, reason: `${repair} is not a safe repair for ${current.discrepancy}; escalate instead` };
    }
    // Evidence gathered before a repair belongs to no repair cycle, so proposing one clears it: only evidence
    // collected after the repair can close the case.
    next = { ...next, resolution: [], proposedRepair: repair, proposedBy: options.by };
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
    // The accountable owner closes the case; evidence keys alone do not authorise another actor.
    if (actorKey(options.by) !== actorKey(current.ownerId)) {
      return { ok: false, reason: 'only the case owner can close a case' };
    }
    const missing = RESOLUTION_REQUIRED.filter((key) => !next.resolution.includes(key));
    if (missing.length > 0) return { ok: false, reason: `missing resolution evidence: ${missing.join(', ')}` };
    // A class with a safe repair closes only through that repair: the stored repair, proposer and approver must all be
    // present, valid and held by different people, so evidence keys alone cannot close a case that skipped approval.
    // Only the latest transition counts: a record cannot close on evidence fields alone, without the move that produced them.
    const last = current.history[current.history.length - 1];
    if (SAFE_REPAIRS[current.discrepancy] !== undefined) {
      const approved =
        isRepairAllowed(current.discrepancy, current.proposedRepair ?? '') &&
        (current.proposedBy?.trim() ?? '') !== '' &&
        (current.approvedBy?.trim() ?? '') !== '' &&
        actorKey(current.approvedBy ?? '') !== actorKey(current.proposedBy ?? '') &&
        current.history.some((entry) => entry.to === 'repair_approved') &&
        last?.from === 'repaired' &&
        last.to === 'reverified';
      if (!approved) return { ok: false, reason: 'a safe-repair case closes only with its approved repair on record' };
    } else {
      // A class with no safe repair reaches re-verification only by escalation, and an earlier escalation from a failed
      // cycle must not license a close.
      const escalated = last?.from === 'escalated' && last.to === 'reverified';
      if (!escalated) return { ok: false, reason: 'a class without a safe repair closes only after escalation and re-verification' };
    }
  }

  return { ok: true, case: next };
}
