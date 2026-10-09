/**
 * The repository contract for the PDF's eighteen-point feature completion
 * gate. A row records evidence; it never turns implementation evidence into a
 * deployment, institution-approval or live-activation claim.
 */

export const FEATURE_COMPLETION_GATES = [
  { id: 'FC-01', title: 'Problem and primary actor defined' },
  { id: 'FC-02', title: 'Capability registry entry exists' },
  { id: 'FC-03', title: 'System passport updated' },
  { id: 'FC-04', title: 'Authority and system of record explicit' },
  { id: 'FC-05', title: 'Data classification explicit' },
  { id: 'FC-06', title: 'Schema and migration exist' },
  { id: 'FC-07', title: 'API contract exists' },
  { id: 'FC-08', title: 'Policy decision exists' },
  { id: 'FC-09', title: 'Tenant and RLS coverage exists' },
  { id: 'FC-10', title: 'Source and freshness metadata renders' },
  { id: 'FC-11', title: 'Workflow and outbox behavior exists where needed' },
  { id: 'FC-12', title: 'Audit events exist' },
  { id: 'FC-13', title: 'Integration boundary documented' },
  { id: 'FC-14', title: 'Complete state matrix exists' },
  { id: 'FC-15', title: 'Keyboard, mobile and accessibility behavior passes' },
  { id: 'FC-16', title: 'Unit and integration tests pass' },
  { id: 'FC-17', title: 'End-to-end flow passes with seeded data' },
  { id: 'FC-18', title: 'Runbook, metrics, owner and feature flag exist' },
] as const;

export type FeatureGateId = (typeof FEATURE_COMPLETION_GATES)[number][0];
export type FeatureGateStatus = 'met' | 'partial' | 'missing' | 'not-applicable';

export interface FeatureEvidence {
  path: string;
  shows: string;
}

export interface FeatureGateResult {
  id: FeatureGateId;
  status: FeatureGateStatus;
  evidence: readonly FeatureEvidence[];
  gap: string;
}

export interface FeatureCompletionRecord {
  id: string;
  name: string;
  problem: string;
  primaryActor: string;
  owner: string;
  declaredComplete: boolean;
  truthBoundary: string;
  gates: readonly FeatureGateResult[];
}

const missingGates = (): readonly FeatureGateResult[] => FEATURE_COMPLETION_GATES.map((gate) => ({
  id: gate.id,
  status: 'missing',
  evidence: [],
  gap: 'Evidence has not been bound to this gate.',
}));

export const FEATURE_COMPLETION_RECORDS: readonly FeatureCompletionRecord[] = [{
  id: 'registration-readiness',
  name: 'Registration readiness',
  problem: 'Students need a source-aware, reversible way to prepare for registration without mistaking Semester for the registrar.',
  primaryActor: 'Student preparing for an institution registration window',
  owner: 'Product and registration operations',
  declaredComplete: false,
  truthBoundary: 'Repository evidence does not prove durable production persistence, live SIS data, an official registration write, institutional approval or student UAT.',
  gates: missingGates(),
}];

export function completionSummary(record: FeatureCompletionRecord): {
  complete: boolean;
  met: number;
  partial: number;
  missing: number;
  notApplicable: number;
  blockingGateIds: FeatureGateId[];
} {
  const count = (status: FeatureGateStatus) => record.gates.filter((gate) => gate.status === status).length;
  const blockingGateIds = record.gates
    .filter((gate) => gate.status === 'partial' || gate.status === 'missing')
    .map((gate) => gate.id);
  return {
    complete: blockingGateIds.length === 0 && record.gates.length === FEATURE_COMPLETION_GATES.length,
    met: count('met'),
    partial: count('partial'),
    missing: count('missing'),
    notApplicable: count('not-applicable'),
    blockingGateIds,
  };
}

export function validateFeatureCompletion(
  records: readonly FeatureCompletionRecord[] = FEATURE_COMPLETION_RECORDS,
): string[] {
  const problems: string[] = [];
  const expectedIds = FEATURE_COMPLETION_GATES.map((gate) => gate.id);
  const recordIds = new Set<string>();

  for (const record of records) {
    if (recordIds.has(record.id)) problems.push(`${record.id}: duplicate feature id`);
    recordIds.add(record.id);
    if (record.gates.map((gate) => gate.id).join('|') !== expectedIds.join('|')) {
      problems.push(`${record.id}: gate ids must match FC-01 through FC-18 in order`);
    }
    for (const gate of record.gates) {
      if ((gate.status === 'met' || gate.status === 'partial') && gate.evidence.length === 0) {
        problems.push(`${record.id}/${gate.id}: met and partial gates require evidence`);
      }
      if ((gate.status === 'partial' || gate.status === 'missing' || gate.status === 'not-applicable') && !gate.gap.trim()) {
        problems.push(`${record.id}/${gate.id}: non-met gates require an explanation`);
      }
    }
    if (record.declaredComplete && !completionSummary(record).complete) {
      problems.push(`${record.id}: declared complete with blocking gates`);
    }
  }
  return problems;
}
