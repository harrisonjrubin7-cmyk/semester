import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  FEATURE_COMPLETION_GATES,
  FEATURE_COMPLETION_RECORDS,
  completionSummary,
  renderFeatureCompletion,
  renderFeatureCompletionIndex,
  validateFeatureCompletion,
} from './featurecompletion';

const root = join(import.meta.dirname, '../../..');
const docsDir = join(root, 'docs/features');

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

  it('holds registration readiness below complete while interaction and operating evidence is missing', () => {
    const record = FEATURE_COMPLETION_RECORDS.find((item) => item.id === 'registration-readiness');
    expect(record).toBeDefined();
    expect(record?.gates).toHaveLength(18);
    expect(completionSummary(record!).complete).toBe(false);
    expect(completionSummary(record!).blockingGateIds).toEqual(
      expect.arrayContaining(['FC-14', 'FC-15', 'FC-17', 'FC-18']),
    );
  });

  it('binds the registration assessment to repository evidence without hiding gaps', () => {
    const record = FEATURE_COMPLETION_RECORDS[0];
    const summary = completionSummary(record);
    expect(summary).toMatchObject({ complete: false, met: 14, partial: 3, missing: 1, notApplicable: 0 });
    expect(validateFeatureCompletion()).toEqual([]);

    for (const gate of record.gates) {
      for (const evidence of gate.evidence) {
        expect(existsSync(join(root, evidence.path)), `${gate.id}: ${evidence.path}`).toBe(true);
      }
    }
  });

  it('renders an index and exact feature evidence pages', () => {
    const indexPath = join(docsDir, 'README.md');
    if (process.env.REGISTERS === 'write') {
      mkdirSync(docsDir, { recursive: true });
      writeFileSync(indexPath, renderFeatureCompletionIndex());
      for (const record of FEATURE_COMPLETION_RECORDS) {
        writeFileSync(join(docsDir, `${record.id}.md`), renderFeatureCompletion(record));
      }
    }

    expect(existsSync(indexPath), indexPath).toBe(true);
    expect(readFileSync(indexPath, 'utf8')).toBe(renderFeatureCompletionIndex());
    for (const record of FEATURE_COMPLETION_RECORDS) {
      const path = join(docsDir, `${record.id}.md`);
      expect(existsSync(path), path).toBe(true);
      expect(readFileSync(path, 'utf8')).toBe(renderFeatureCompletion(record));
    }
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
