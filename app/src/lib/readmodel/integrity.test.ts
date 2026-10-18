import { describe, expect, it } from 'vitest';
import { canUseProjectionForOutcome, missingProjectionMetadata, type OutcomeCheck } from './integrity';

const check = (overrides: Partial<OutcomeCheck>): OutcomeCheck => ({
  freshnessState: 'current',
  projectionLagSeconds: 5,
  maximumLagSeconds: 60,
  outcomeType: 'consequential',
  ...overrides,
});

describe('canUseProjectionForOutcome', () => {
  it('lets informational views show anything, including stale data', () => {
    expect(canUseProjectionForOutcome(check({ freshnessState: 'failed', projectionLagSeconds: 9999, outcomeType: 'informational' }))).toBe(true);
  });

  it('allows a consequential outcome from a current projection within its lag bound', () => {
    expect(canUseProjectionForOutcome(check({}))).toBe(true);
    expect(canUseProjectionForOutcome(check({ projectionLagSeconds: 60 }))).toBe(true);
  });

  it('refuses a lag bound that is not a finite non-negative number', () => {
    expect(canUseProjectionForOutcome(check({ maximumLagSeconds: Number.POSITIVE_INFINITY }))).toBe(false);
    expect(canUseProjectionForOutcome(check({ maximumLagSeconds: -1 }))).toBe(false);
  });

  it('blocks a consequential outcome when the projection is not current', () => {
    for (const freshnessState of ['updating', 'stale', 'unknown', 'failed'] as const) {
      expect(canUseProjectionForOutcome(check({ freshnessState }))).toBe(false);
    }
  });

  it('blocks a derived outcome when lag exceeds the bound', () => {
    expect(canUseProjectionForOutcome(check({ outcomeType: 'derived', projectionLagSeconds: 61 }))).toBe(false);
  });

  it('refuses an outcome type it does not recognise, even from a current projection within its bound', () => {
    expect(canUseProjectionForOutcome(check({ outcomeType: 'advisory' as OutcomeCheck['outcomeType'] }))).toBe(false);
    expect(canUseProjectionForOutcome(check({ outcomeType: undefined as unknown as OutcomeCheck['outcomeType'] }))).toBe(false);
  });

  it('treats an unmeasured or impossible lag as unusable for an outcome', () => {
    expect(canUseProjectionForOutcome(check({ projectionLagSeconds: Number.NaN }))).toBe(false);
    expect(canUseProjectionForOutcome(check({ projectionLagSeconds: -1 }))).toBe(false);
    expect(canUseProjectionForOutcome(check({ projectionLagSeconds: Number.POSITIVE_INFINITY }))).toBe(false);
  });
});

describe('missingProjectionMetadata', () => {
  const complete = {
    projection_name: 'registration_readiness',
    source_event_id: 'evt-1',
    aggregate_version: 7,
    projected_at: '2026-10-01T09:00:00.000Z',
    source_observed_at: '2026-10-01T08:59:00.000Z',
    freshness_state: 'current' as const,
    tenant_id: 'named-institution',
    schema_version: 2,
  };

  it('accepts a fully labelled projection', () => {
    expect(missingProjectionMetadata(complete)).toEqual([]);
  });

  it('names each missing or blank key', () => {
    expect(missingProjectionMetadata({ ...complete, tenant_id: '  ', source_event_id: undefined })).toEqual([
      'source_event_id',
      'tenant_id',
    ]);
  });
});
