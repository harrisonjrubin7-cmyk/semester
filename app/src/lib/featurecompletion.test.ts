import { describe, expect, it } from 'vitest';
import {
  FEATURE_COMPLETION_GATES,
  FEATURE_COMPLETION_RECORDS,
  completionSummary,
  validateFeatureCompletion,
} from './featurecompletion';

const EXPECTED_GATES = [
  'Problem and primary actor defined',
  'Capability registry entry exists',
  'System passport updated',
  'Authority and system of record explicit',
  'Data classification explicit',
  'Schema and migration exist',
  'API contract exists',
  'Policy decision exists',
  'Tenant and RLS coverage exists',
  'Source and freshness metadata renders',
  'Workflow and outbox behavior exists where needed',
  'Audit events exist',
  'Integration boundary documented',
  'Complete state matrix exists',
  'Keyboard, mobile and accessibility behavior passes',
  'Unit and integration tests pass',
  'End-to-end flow passes with seeded data',
  'Runbook, metrics, owner and feature flag exist',
] as const;

describe('feature completion gate', () => {
  it('keeps the PDF contract as eighteen ordered, stable gates', () => {
    expect(FEATURE_COMPLETION_GATES.map((gate) => gate.id)).toEqual(
      Array.from({ length: 18 }, (_, index) => `FC-${String(index + 1).padStart(2, '0')}`),
    );
    expect(FEATURE_COMPLETION_GATES.map((gate) => gate.title)).toEqual(EXPECTED_GATES);
  });

  it('holds registration readiness below complete while durable and human evidence is missing', () => {
    const record = FEATURE_COMPLETION_RECORDS.find((item) => item.id === 'registration-readiness');
    expect(record).toBeDefined();
    expect(record?.gates).toHaveLength(18);
    expect(completionSummary(record!).complete).toBe(false);
    expect(completionSummary(record!).blockingGateIds).toEqual(
      expect.arrayContaining(['FC-06', 'FC-09', 'FC-17', 'FC-18']),
    );
  });

  it('rejects missing gates, unsupported met claims and a false complete claim', () => {
    const record = FEATURE_COMPLETION_RECORDS[0];
    const withoutGate = { ...record, gates: record.gates.slice(1) };
    expect(validateFeatureCompletion([withoutGate])).toContain(
      'registration-readiness: gate ids must match FC-01 through FC-18 in order',
    );

    const unsupported = {
      ...record,
      gates: record.gates.map((gate, index) => index === 0 ? { ...gate, status: 'met' as const, evidence: [] } : gate),
    };
    expect(validateFeatureCompletion([unsupported])).toContain(
      'registration-readiness/FC-01: met and partial gates require evidence',
    );

    const falselyComplete = { ...record, declaredComplete: true };
    expect(validateFeatureCompletion([falselyComplete])).toContain(
      'registration-readiness: declared complete with blocking gates',
    );
  });
});
