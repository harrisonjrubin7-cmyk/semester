// Source-state contract for registration readiness (pilot baseline, slice SLICE-READINESS-003).
// Vocabulary follows docs/pilot/registration-readiness/source-state.yaml. A stale or unknown
// source must never produce a definitive "ready" for a student.

export const CONNECTION_STATES = ['confirmed', 'pending', 'updating', 'stale', 'blocked', 'degraded', 'reconcile', 'resolved'] as const;
export const FRESHNESS_STATES = ['current', 'updating', 'stale', 'unknown', 'failed'] as const;
export const EVALUATION_STATES = ['ready', 'blocked', 'needs_review', 'unknown', 'stale', 'failed', 'cancelled'] as const;

export type ConnectionState = (typeof CONNECTION_STATES)[number];
export type FreshnessState = (typeof FRESHNESS_STATES)[number];
export type EvaluationState = (typeof EVALUATION_STATES)[number];

export interface SourceResult {
  evaluation: EvaluationState;
  freshness: FreshnessState;
  connection: ConnectionState;
}

/** True only when a readiness result may be shown to a student as definitive. */
export function mayShowDefinitiveReadiness(result: SourceResult): boolean {
  return result.evaluation === 'ready' && result.freshness === 'current' && result.connection === 'confirmed';
}
