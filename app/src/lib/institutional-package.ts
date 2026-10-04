/**
 * The single institutional offer and the evidence-gated path that delivers it.
 *
 * This is intentionally one package rather than a menu of disconnected
 * modules. An institution can narrow the first pilot cohort, but it does not
 * have to assemble identity, integrations, migration, training and support as
 * separate purchases. Narrowing scope never skips a safety or authority gate.
 */

export const INSTITUTIONAL_PACKAGE = {
  name: 'Semester Institutional',
  promise: 'One proposed institutional agreement for a student action layer and the controlled work required before any broader migration.',
  includes: [
    'Accessible course, assessment, feedback and gradebook capabilities, off until separately approved for the institution',
    'Student planning, consented advisor agendas, registration readiness, support, community and pathways',
    'Institution-managed resources, policies, service routing and student communications',
    'Student-controlled credential wallet and privacy-thresholded institutional analytics',
    'Approved institutional connections only after implementation, target conformance and customer acceptance',
    'Policy controls, audit evidence, privacy controls and authorized official-system write workflows',
    'Implementation, data mapping, rehearsals, migration, training, cutover and hypercare',
    'Open export, rollback planning and an evidence-based expansion or exit decision',
  ],
} as const;

export const ROLLOUT_PHASES = [
  {
    id: 'contract',
    name: 'Agree',
    outcome: 'One order defines the pilot cohort, target operating model, responsibilities, data purpose, success measures and full migration path.',
    requiredEvidence: ['agreement_signed', 'data_terms_approved', 'sponsors_named', 'pilot_scope_approved'],
  },
  {
    id: 'pilot',
    name: 'Pilot',
    outcome: 'A bounded cohort uses Semester in a sandbox or read-only mode while the institution validates experience, accessibility and support.',
    requiredEvidence: ['sandbox_accepted', 'accessibility_reviewed', 'support_path_ready'],
  },
  {
    id: 'integrate',
    name: 'Integrate',
    outcome: 'Only implemented and approved connections pass tenant-scoped conformance, reconciliation and customer acceptance before use; OneRoster remains planned, not included today.',
    requiredEvidence: ['sso_verified', 'lti_verified', 'source_mapping_approved'],
  },
  {
    id: 'parallel',
    name: 'Run in parallel',
    outcome: 'Semester and the legacy LMS/gradebook run side by side; rosters, assignments and grades are reconciled without changing authority.',
    requiredEvidence: ['parallel_run_complete', 'grade_reconciliation_signed', 'faculty_acceptance_signed'],
  },
  {
    id: 'migrate',
    name: 'Migrate',
    outcome: 'Approved course, roster, assessment and grade history is imported from rehearsed mappings with exception review and rollback evidence.',
    requiredEvidence: ['migration_rehearsed', 'migration_approved', 'rollback_rehearsed'],
  },
  {
    id: 'cutover',
    name: 'Cut over',
    outcome: 'Authorized leaders make Semester the LMS and gradebook of record inside a controlled window with a named rollback decision.',
    requiredEvidence: ['cutover_approved', 'faculty_trained', 'student_communications_ready', 'hypercare_owner_named'],
  },
  {
    id: 'expand',
    name: 'Expand',
    outcome: 'The institution expands only after reviewing outcomes, incidents, accessibility, support load and data quality against the pilot baseline.',
    requiredEvidence: ['outcome_review_signed', 'open_risks_accepted', 'expansion_approved'],
  },
] as const;

export type RolloutPhase = (typeof ROLLOUT_PHASES)[number];
export type RolloutPhaseId = RolloutPhase['id'];
export type RolloutEvidence = RolloutPhase['requiredEvidence'][number];

export interface PhaseReadiness {
  phase: RolloutPhase;
  ready: boolean;
  missing: readonly RolloutEvidence[];
}

/** Missing evidence is never treated as approval. */
export function rolloutReadiness(evidence: ReadonlySet<string>): readonly PhaseReadiness[] {
  return ROLLOUT_PHASES.map((phase) => {
    const missing = phase.requiredEvidence.filter((item) => !evidence.has(item));
    return { phase, ready: missing.length === 0, missing };
  });
}

/** The first phase that still owes evidence; null means the rollout is complete. */
export function nextRolloutPhase(evidence: ReadonlySet<string>): RolloutPhase | null {
  return rolloutReadiness(evidence).find((item) => !item.ready)?.phase ?? null;
}
