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

export type FeatureGateId = (typeof FEATURE_COMPLETION_GATES)[number]['id'];
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

const evidence = (path: string, shows: string): FeatureEvidence => ({ path, shows });
const result = (
  id: FeatureGateId,
  status: FeatureGateStatus,
  items: readonly FeatureEvidence[],
  gap = '',
): FeatureGateResult => ({ id, status, evidence: items, gap });

export const FEATURE_COMPLETION_RECORDS: readonly FeatureCompletionRecord[] = [{
  id: 'registration-readiness',
  name: 'Registration readiness',
  problem: 'Students need a source-aware, reversible way to prepare for registration without mistaking Semester for the registrar.',
  primaryActor: 'Student preparing for an institution registration window',
  owner: 'Product and registration operations',
  declaredComplete: false,
  truthBoundary: 'Repository evidence does not prove durable production persistence, live SIS data, an official registration write, institutional approval or student UAT.',
  gates: [
    result('FC-01', 'met', [evidence('docs/learning-university-systems/REGISTRATION-READINESS-SPEC.md', 'The student problem, inputs, output and non-authoritative boundary.')]),
    result('FC-02', 'met', [evidence('app/src/lib/rollout-capabilities.ts', 'CAP-050 Registration, its owner, dependencies, acceptance contract and external gate.')]),
    result('FC-03', 'met', [evidence('app/src/lib/systempassports.ts', 'The Registration passport with authority, records, commands, events, dependencies and activation gates.')]),
    result('FC-04', 'met', [evidence('packages/institution/src/readiness.ts', 'The source-aware projection keeps SIS facts authoritative and student choices non-authoritative.')]),
    result('FC-05', 'met', [evidence('docs/reference/schemas/events/registration.schema.json', 'The registration event payload contract and education-record classification boundary.')]),
    result('FC-06', 'partial', [evidence('supabase/migrations/20260929300000_registration_transaction.sql', 'Durable registration request, receipt and reconciliation records.')], 'The readiness aggregate still has no production Postgres persistence adapter or migration.'),
    result('FC-07', 'met', [evidence('app/server/institution/registration.ts', 'The server registration command and receipt contract.'), evidence('packages/institution/src/readiness-workflow.ts', 'The readiness transition and idempotency contract.')]),
    result('FC-08', 'met', [evidence('packages/institution/src/policy.ts', 'Relationship- and capability-scoped registration-readiness policy decisions.')]),
    result('FC-09', 'partial', [evidence('supabase/registration_transaction.check.sql', 'Tenant and authorization negatives for the durable registration transaction.')], 'Readiness evaluations and reconciliation assignments are not yet persisted behind tenant RLS.'),
    result('FC-10', 'met', [evidence('app/src/components/RegistrationReadiness.tsx', 'The student view renders status, source-aware next steps and non-authoritative language.')]),
    result('FC-11', 'partial', [evidence('packages/institution/src/readiness-workflow.ts', 'Idempotent transitions return minimal outbox descriptors and reconciliation work.')], 'The aggregate, receipt, audit row and outbox row are not yet committed atomically by a production repository.'),
    result('FC-12', 'partial', [evidence('docs/reference/registration-readiness-workflow.md', 'Named readiness audit and event evidence requirements.')], 'Durable audit persistence for readiness evaluation transitions is still specified rather than implemented.'),
    result('FC-13', 'met', [evidence('docs/reference/registration-readiness-workflow.md', 'The boundary between readiness projection, a future Postgres adapter and SIS authority.')]),
    result('FC-14', 'partial', [evidence('app/src/screens/registration.test.tsx', 'Registration route states and recovery behavior under test.')], 'The design archive still lacks one end-to-end proof covering every ready, loading, empty, error, forbidden, offline and stale state.'),
    result('FC-15', 'partial', [evidence('app/src/components/RegistrationReadiness.test.tsx', 'Component interaction and accessible text coverage.')], 'No representative student keyboard, mobile and assistive-technology UAT has been recorded.'),
    result('FC-16', 'met', [evidence('packages/institution/src/readiness-workflow.test.ts', 'Workflow state, retry, concurrency, receipt and event tests.'), evidence('app/server/institution/registration.test.ts', 'Server registration transaction tests.')]),
    result('FC-17', 'missing', [], 'No seeded end-to-end run proves the complete student-to-authoritative-handoff flow.'),
    result('FC-18', 'partial', [evidence('app/src/lib/institution-ops.ts', 'The registration_ready metric and registrar owner.'), evidence('app/src/lib/systempassports.ts', 'The operational owner, alerts, rollback boundary and disabled-by-default system flag contract.')], 'A feature-specific runbook, named pilot owner and verified tenant flag configuration are not present.'),
  ],
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

const gateTitle = (id: FeatureGateId): string =>
  FEATURE_COMPLETION_GATES.find((gate) => gate.id === id)?.title ?? id;

export function renderFeatureCompletion(record: FeatureCompletionRecord): string {
  const summary = completionSummary(record);
  const rows = record.gates.map((gate) => {
    const evidenceText = gate.evidence.length === 0
      ? 'None.'
      : gate.evidence.map((item) => `\`${item.path}\` — ${item.shows}`).join('<br>');
    return `| ${gate.id} | ${gateTitle(gate.id)} | ${gate.status} | ${evidenceText} | ${gate.gap || 'None.'} |`;
  });
  return `# ${record.name} feature completion

<!-- Rendered from app/src/lib/featurecompletion.ts by featurecompletion.test.ts. Edit the registry, then run npm run registers from app/. -->

> **Status:** ${summary.complete ? 'complete' : 'not complete'} · ${summary.met} met · ${summary.partial} partial · ${summary.missing} missing · ${summary.notApplicable} not applicable

This page is repository evidence, not a deployment, institution approval, live
integration, production activation or general-availability claim.

## Objective

- Problem: ${record.problem}
- Primary actor: ${record.primaryActor}
- Owner: ${record.owner}
- Declared complete: ${record.declaredComplete ? 'yes' : 'no'}

## Truth boundary

${record.truthBoundary}

## Eighteen-point gate

| Gate | Requirement | Status | Repository evidence | Remaining gap |
| --- | --- | --- | --- | --- |
${rows.join('\n')}

## Blocking gates

${summary.blockingGateIds.length === 0
    ? 'None in the repository contract. External release gates still apply.'
    : summary.blockingGateIds.map((id) => `- ${id}: ${gateTitle(id)}`).join('\n')}
`;
}

export function renderFeatureCompletionIndex(): string {
  const rows = FEATURE_COMPLETION_RECORDS.map((record) => {
    const summary = completionSummary(record);
    return `| [${record.name}](./${record.id}.md) | ${summary.complete ? 'complete' : 'not complete'} | ${summary.met} | ${summary.partial} | ${summary.missing} | ${summary.blockingGateIds.join(', ') || 'None'} |`;
  });
  return `# Feature completion evidence

<!-- Rendered from app/src/lib/featurecompletion.ts by featurecompletion.test.ts. Edit the registry, then run npm run registers from app/. -->

This register applies the PDF's eighteen-point completion contract to each
vertical slice. A feature is complete only when every applicable gate is met.
Prototype routes, documentation, local tests and repository scaffolding remain
separate from deployment, live integration, institutional approval and GA.

| Feature | Repository status | Met | Partial | Missing | Blocking gates |
| --- | --- | ---: | ---: | ---: | --- |
${rows.join('\n')}
`;
}
