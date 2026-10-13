// Reconciliation cases. The operational response when a Semester projection conflicts with,
// lags behind, or cannot be confirmed against an authoritative institutional source.
// Contract: docs/operations/reconciliation.yaml.

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

const TRANSITIONS: Record<CaseState, readonly CaseState[]> = {
  detected: ['triaged'],
  triaged: ['awaiting_source', 'awaiting_institution', 'repair_proposed', 'escalated'],
  awaiting_source: ['triaged', 'repair_proposed', 'escalated'],
  awaiting_institution: ['triaged', 'escalated'],
  repair_proposed: ['repair_approved', 'escalated'],
  repair_approved: ['repaired'],
  repaired: ['reverified'],
  reverified: ['closed', 'triaged'],
  escalated: ['triaged'],
  closed: [],
};

export interface CaseEvent {
  from: CaseState;
  to: CaseState;
  at: string;
  by: string;
}

export interface ReconciliationCase {
  id: string;
  tenantId: string;
  capability: string;
  discrepancy: DiscrepancyClass;
  severity: 'critical' | 'high' | 'medium' | 'low';
  state: CaseState;
  ownerId: string;
  proposedRepair?: string;
  proposedBy?: string;
  approvedBy?: string;
  /** Evidence keys satisfied so far; closing needs every key in RESOLUTION_REQUIRED. */
  resolution: string[];
  history: CaseEvent[];
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

export function isRepairAllowed(discrepancy: DiscrepancyClass, repair: string): boolean {
  if (PROHIBITED_REPAIRS.includes(repair)) return false;
  return SAFE_REPAIRS[discrepancy]?.includes(repair) ?? false;
}

export function openCase(input: {
  id: string;
  tenantId: string;
  capability: string;
  discrepancy: DiscrepancyClass;
  severity: ReconciliationCase['severity'];
  ownerId: string;
}): ReconciliationCase {
  return { ...input, state: 'detected', resolution: [], history: [] };
}

/** Applies one state move. Every rule the contract states is checked here, not in the caller. */
export function moveCase(current: ReconciliationCase, to: CaseState, options: MoveOptions): CaseResult {
  if (!options.by.trim()) return { ok: false, reason: 'a named actor is required' };
  if (!TRANSITIONS[current.state].includes(to)) {
    return { ok: false, reason: `cannot move from ${current.state} to ${to}` };
  }

  let next: ReconciliationCase = {
    ...current,
    state: to,
    resolution: [...new Set([...current.resolution, ...(options.evidence ?? [])])],
    history: [...current.history, { from: current.state, to, at: options.at, by: options.by }],
  };

  if (to === 'repair_proposed') {
    const repair = options.repair ?? '';
    if (PROHIBITED_REPAIRS.includes(repair)) return { ok: false, reason: `prohibited repair: ${repair}` };
    if (!isRepairAllowed(current.discrepancy, repair)) {
      return { ok: false, reason: `${repair} is not a safe repair for ${current.discrepancy}; escalate instead` };
    }
    next = { ...next, proposedRepair: repair, proposedBy: options.by };
  }

  if (to === 'repair_approved') {
    if (options.by === current.proposedBy) {
      return { ok: false, reason: 'the proposer cannot approve their own repair' };
    }
    next = { ...next, approvedBy: options.by };
  }

  if (to === 'closed') {
    const missing = RESOLUTION_REQUIRED.filter((key) => !next.resolution.includes(key));
    if (missing.length > 0) return { ok: false, reason: `missing resolution evidence: ${missing.join(', ')}` };
  }

  return { ok: true, case: next };
}
