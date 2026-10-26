/**
 * The three independent states required before registration readiness can be
 * presented as definitive.
 *
 * Connection values mirror
 * `docs/pilot/registration-readiness/connection-states.yaml`. Freshness and
 * evaluation remain separate so a reachable source cannot make stale or
 * inconclusive data look final.
 */
export const CONNECTION_STATES = [
  'confirmed',
  'pending',
  'updating',
  'stale',
  'blocked',
  'degraded',
  'reconcile',
  'resolved',
] as const;

export const FRESHNESS_STATES = ['current', 'updating', 'stale', 'unknown', 'failed'] as const;

export const EVALUATION_STATES = [
  'ready',
  'blocked',
  'needs_review',
  'unknown',
  'stale',
  'failed',
  'cancelled',
] as const;

export type ConnectionState = (typeof CONNECTION_STATES)[number];
export type FreshnessState = (typeof FRESHNESS_STATES)[number];
export type EvaluationState = (typeof EVALUATION_STATES)[number];

export interface SourceVerification {
  evaluation: EvaluationState;
  freshness: FreshnessState;
  connection: ConnectionState;
}

/**
 * Fail closed: only a ready evaluation from a current, confirmed source may be
 * shown as definitive. Every partial, stale, failed, or recovery state needs
 * review instead.
 */
export function isDefinitiveSourceVerification(result: SourceVerification): boolean {
  return result.evaluation === 'ready'
    && result.freshness === 'current'
    && result.connection === 'confirmed';
}
