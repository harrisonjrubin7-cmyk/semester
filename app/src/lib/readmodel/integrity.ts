// Read-model integrity. A projection is a rebuildable view, not an authoritative record:
// its freshness and lag decide what the interface may claim.
// Contract: docs/architecture/read-model-integrity.yaml.

import { isIsoTimestamp } from '../assurance/timestamps';

export const FRESHNESS_STATES = ['current', 'updating', 'stale', 'unknown', 'failed'] as const;
export type FreshnessState = (typeof FRESHNESS_STATES)[number];

export type OutcomeType = 'informational' | 'derived' | 'consequential';

export interface ProjectionMetadata {
  projection_name: string;
  source_event_id: string;
  aggregate_version: number;
  projected_at: string;
  source_observed_at: string;
  freshness_state: FreshnessState;
  tenant_id: string;
  schema_version: number;
}

export const REQUIRED_PROJECTION_METADATA: readonly (keyof ProjectionMetadata)[] = [
  'projection_name',
  'source_event_id',
  'aggregate_version',
  'projected_at',
  'source_observed_at',
  'freshness_state',
  'tenant_id',
  'schema_version',
];

/** A version is a non-negative whole number; NaN, Infinity and fractions would make ordering meaningless. */
const isVersion = (value: unknown): boolean => Number.isSafeInteger(value) && (value as number) >= 0;

/**
 * Metadata keys a projection is missing, blank, or malformed for its type. An empty list means the projection is
 * labelled with values the freshness gate can rely on.
 */
export function missingProjectionMetadata(meta: Partial<ProjectionMetadata>): string[] {
  return REQUIRED_PROJECTION_METADATA.filter((key) => {
    const value: unknown = meta[key];
    if (value === undefined || value === null) return true;
    if (typeof value === 'string' && value.trim() === '') return true;
    switch (key) {
      case 'aggregate_version':
      case 'schema_version':
        return !isVersion(value);
      case 'projected_at':
      case 'source_observed_at':
        return typeof value !== 'string' || !isIsoTimestamp(value);
      case 'freshness_state':
        return !(FRESHNESS_STATES as readonly unknown[]).includes(value);
      case 'projection_name':
      case 'source_event_id':
      case 'tenant_id':
        return typeof value !== 'string';
      default:
        return false;
    }
  });
}

export interface OutcomeCheck {
  freshnessState: FreshnessState;
  projectionLagSeconds: number;
  maximumLagSeconds: number;
  outcomeType: OutcomeType;
}

/**
 * Whether a projection may support an outcome. Informational views always may. Anything
 * derived or consequential needs a current projection within its lag bound; a lag that is
 * not a finite non-negative number is treated as unknown, so it cannot support an outcome.
 */
export function canUseProjectionForOutcome(input: OutcomeCheck): boolean {
  if (input.outcomeType === 'informational') return true;
  // Only the two outcome types the contract names may use a projection; anything else fails closed.
  if (input.outcomeType !== 'derived' && input.outcomeType !== 'consequential') return false;

  if (input.freshnessState !== 'current') return false;
  if (!Number.isFinite(input.projectionLagSeconds) || input.projectionLagSeconds < 0) return false;
  // An infinite or negative bound would let any lag through, so a bad bound fails closed too.
  if (!Number.isFinite(input.maximumLagSeconds) || input.maximumLagSeconds < 0) return false;
  return input.projectionLagSeconds <= input.maximumLagSeconds;
}
