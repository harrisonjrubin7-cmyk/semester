import assert from 'node:assert/strict';
import test from 'node:test';
import type { PlatformManifest, RegistrySnapshot, WorkspaceEvidenceEnvelope, WorkspaceRecord } from '../types.ts';
import { PILOT_RELEASE_SCOPES, WORKSPACE_FAMILIES, validateWorkspaceEvidence, validateWorkspaceRegistry } from '../validators/workspace-validator.ts';

const loop = {
  actor: 'Authorized actor', record: 'Scoped record', action: 'Permitted action', consequence_preview: 'Consequence preview',
  command: 'Durable command', event: 'Durable event', receipt: 'Audit receipt', support: 'Owned support', revoke_or_rollback: 'Revocation or rollback',
};
const familyFor = (key: string): string => key.endsWith('-portal') && !['developer-portal'].includes(key) ? 'external-portals' : key;
const workspace = (key: string, changes: Partial<WorkspaceRecord> = {}): WorkspaceRecord => ({
  key, name: key, family: familyFor(key), owner: 'accountable-owner', status: 'blocked', evidence: ['packages/platform-control/README.md'],
  audience: 'authorized-audience', data_classification: 'scoped-records', support_queue: `support.${key}`, pilot_required: true,
  operational_ready: false, activation: 'disabled', required_loop: loop,
  refs: { routes: [], capabilities: [], workflows: [], code: [], tests: [], deployments: [], activations: [] }, gaps: ['Implementation evidence is not complete.'],
  evidence_envelopes: [],
  ...changes,
});
const manifest: PlatformManifest = {
  key: 'semester', name: 'Semester ecosystem', owner: 'platform-governance', status: 'implemented', evidence: ['packages/platform-control/README.md'],
  canonical_domain: 'semesterintel.tech', workspace_families: [...WORKSPACE_FAMILIES], pilot_release_scopes: [...PILOT_RELEASE_SCOPES],
  acceptance_gate_ids: Array.from({ length: 18 }, (_, index) => `FC-${String(index + 1).padStart(2, '0')}`),
  acceptance_cases: Array.from({ length: 8 }, (_, index) => ({
    id: `XA-${String(index + 1).padStart(2, '0')}`, name: `Cross-workspace case ${index + 1}`,
    scopes: [
      ['public-web', 'applicant-portal', 'institution-console'], ['student-os', 'advisor-os'], ['faculty-os', 'student-os'],
      ['student-os', 'registrar-os', 'finance-os'], ['student-affairs-os', 'guardian-portal'], ['institution-console', 'company-os', 'operations-os'],
      ['developer-portal', 'partner-portal', 'employer-portal'], ['alumni-portal', 'community-marketplace', 'public-web'],
    ][index]!, capability_keys: [], system_keys: [], route_ids: [], status: 'blocked' as const,
    controls: [{ name: 'positive', polarity: 'positive' as const, status: 'missing' as const, evidence_refs: [] }, { name: 'denial', polarity: 'negative' as const, status: 'missing' as const, evidence_refs: [] }],
    gaps: ['Integration evidence is absent.'],
  })),
};
const snapshot = (workspaces = PILOT_RELEASE_SCOPES.map((key) => workspace(key)), manifests = [manifest]): RegistrySnapshot => ({
  capabilities: [], systems: [], roles: [], screens: [], workflows: [], integrations: [], controls: [], documents: [], tenants: [], backlog: [], manifests, workspaces,
});

test('accepts the complete roster while every unfinished scope stays blocked and disabled', () => {
  assert.deepEqual(validateWorkspaceRegistry(snapshot()), []);
});

test('rejects count drift, aliases that omit a scope, and the illustrative semester.com domain', () => {
  const badManifest = { ...manifest, canonical_domain: 'semester.com', workspace_families: [...WORKSPACE_FAMILIES, 'invented-workspace'], pilot_release_scopes: PILOT_RELEASE_SCOPES.slice(1) };
  const issues = validateWorkspaceRegistry(snapshot(PILOT_RELEASE_SCOPES.slice(1).map((key) => workspace(key)), [badManifest]));
  assert.deepEqual(issues.map(({ code }) => code), ['invalid_canonical_domain', 'workspace_family_drift', 'pilot_scope_drift', 'workspace_roster_drift', 'uncovered_workspace_family']);
});

test('rejects decorative readiness and activation without substantive evidence', () => {
  const ready = workspace('student-os', { operational_ready: true, status: 'verified', gaps: [] });
  const activated = workspace('finance-os', { activation: 'active' });
  const issues = validateWorkspaceRegistry(snapshot(PILOT_RELEASE_SCOPES.map((key) => key === 'student-os' ? ready : key === 'finance-os' ? activated : workspace(key))));
  assert.deepEqual(issues.filter(({ path }) => path.startsWith('workspaces.student-os')).map(({ code }) => code), [
    'unsupported_operational_claim', 'missing_operational_evidence', 'missing_operational_evidence', 'missing_operational_evidence',
    'missing_operational_evidence', 'missing_operational_evidence', 'missing_operational_evidence',
  ]);
  assert.deepEqual(issues.filter(({ path }) => path.startsWith('workspaces.finance-os')).map(({ code }) => code), [
    'unsupported_activation_claim', 'activation_without_readiness', 'activation_without_evidence', 'activation_without_deployment',
  ]);
});

test('does not accept placeholder strings as readiness or activation evidence', () => {
  const refs = { routes: ['placeholder'], capabilities: ['placeholder'], workflows: ['placeholder'], code: ['placeholder'], tests: ['placeholder'], deployments: ['placeholder'], activations: ['placeholder'] };
  const claimed = workspace('student-os', { status: 'verified', operational_ready: true, activation: 'active', gaps: [], refs });
  const issues = validateWorkspaceRegistry(snapshot(PILOT_RELEASE_SCOPES.map((key) => key === claimed.key ? claimed : workspace(key))));
  assert.deepEqual(issues.filter(({ path }) => path.startsWith('workspaces.student-os')).map(({ code }) => code), [
    'unsupported_operational_claim', 'unsupported_activation_claim',
  ]);
});

test('holds every release scope to its canonical grouped family', () => {
  const swappedStudent = workspace('student-os', { family: 'finance-os' });
  const swappedFinance = workspace('finance-os', { family: 'student-os' });
  const issues = validateWorkspaceRegistry(snapshot(PILOT_RELEASE_SCOPES.map((key) => key === 'student-os' ? swappedStudent : key === 'finance-os' ? swappedFinance : workspace(key))));
  assert.deepEqual(issues.map(({ code }) => code), ['workspace_family_mismatch', 'workspace_family_mismatch']);
});

test('rejects an unready record that hides its gaps or omits part of the required loop', () => {
  const hidden = workspace('registrar-os', { gaps: [], required_loop: { ...loop, receipt: '' } });
  const issues = validateWorkspaceRegistry(snapshot(PILOT_RELEASE_SCOPES.map((key) => key === hidden.key ? hidden : workspace(key))));
  assert.deepEqual(issues.map(({ code }) => code), ['incomplete_operational_loop', 'unready_without_gap']);
});

test('reports malformed nested registry data without throwing', () => {
  const malformed = { ...workspace('student-os'), required_loop: null, refs: null, gaps: null } as unknown as WorkspaceRecord;
  const issues = validateWorkspaceRegistry(snapshot(PILOT_RELEASE_SCOPES.map((key) => key === malformed.key ? malformed : workspace(key))));
  assert.deepEqual(issues.filter(({ path }) => path.startsWith('workspaces.student-os')).map(({ code }) => code), [
    'invalid_workspace_shape', 'invalid_workspace_shape', 'invalid_workspace_shape',
  ]);
});

test('rejects a malformed sole root manifest instead of skipping its contract', () => {
  for (const malformed of [null, 'semester']) {
    const issues = validateWorkspaceRegistry(snapshot(undefined, [malformed as unknown as PlatformManifest]));
    assert.deepEqual(issues.map(({ code }) => code), ['invalid_manifest_shape']);
  }
});

const artifact = 'packages/platform-control/README.md';
const revision = '8c3acf89891f5e0497f1628edbe370e16116431b';
const sha256 = 'a7814472c4db8f59ef332601c9745fcf7c7fdf1d52804d758abc9202ab267280';
const envelope = (changes: Partial<WorkspaceEvidenceEnvelope> = {}): WorkspaceEvidenceEnvelope => ({
  id: 'student-source', kind: 'source', scope: 'student-os', revision,
  artifact: { path: artifact, sha256 },
  bindings: { schema: 'workspace-evidence/v1', config: 'source-tree', policy: 'platform-control', environment: 'repository', tenant: 'synthetic-campus' },
  producer: { name: 'source-audit', run_id: 'run-001', started_at: '2026-10-10T12:00:00.000Z', completed_at: '2026-10-10T12:01:00.000Z' },
  observed_outcome: 'passed', reviewer: { name: 'independent-reviewer', reviewed_at: '2026-10-10T12:05:00.000Z' },
  ...changes,
});

test('accepts a non-empty source artifact bound to the target revision, scope, environment, producer and reviewer', async () => {
  const record = workspace('student-os', { evidence_envelopes: [envelope()], refs: { routes: [], capabilities: [], workflows: [], code: ['student-source'], tests: [], deployments: [], activations: [] } });
  const issues = await validateWorkspaceEvidence(snapshot(PILOT_RELEASE_SCOPES.map((key) => key === record.key ? record : workspace(key))), {
    targetRevision: revision, targetTenant: 'synthetic-campus', now: '2026-10-10T13:00:00.000Z',
    readArtifact: async () => 'source artifact\n',
  });
  assert.deepEqual(issues, []);
});

test('rejects wrong-revision, empty, failed, future, expired, unreviewed and wrong-environment evidence', async () => {
  const cases: Array<[string, WorkspaceEvidenceEnvelope]> = [
    ['wrong-revision', envelope({ id: 'wrong-revision', revision: '1111111111111111111111111111111111111111' })],
    ['failed', envelope({ id: 'failed', observed_outcome: 'failed' })],
    ['future', envelope({ id: 'future', producer: { ...envelope().producer, completed_at: '2026-10-10T14:00:00.000Z' } })],
    ['expired', envelope({ id: 'expired', expires_at: '2026-10-10T12:30:00.000Z' })],
    ['unreviewed', envelope({ id: 'unreviewed', reviewer: { name: '', reviewed_at: '' } })],
    ['wrong-environment', envelope({ id: 'wrong-environment', bindings: { ...envelope().bindings, environment: 'production' } })],
    ['empty', envelope({ id: 'empty' })],
  ];
  const record = workspace('student-os', {
    evidence_envelopes: cases.map(([, value]) => value),
    refs: { routes: [], capabilities: [], workflows: [], code: cases.map(([id]) => id), tests: [], deployments: [], activations: [] },
  });
  const issues = await validateWorkspaceEvidence(snapshot(PILOT_RELEASE_SCOPES.map((key) => key === record.key ? record : workspace(key))), {
    targetRevision: revision, now: '2026-10-10T13:00:00.000Z',
    readArtifact: async (_revision, _path, evidenceId) => evidenceId === 'empty' ? '' : 'source artifact\n',
  });
  for (const code of ['evidence_revision_mismatch', 'evidence_outcome_not_passed', 'future_evidence', 'expired_evidence', 'missing_evidence_reviewer', 'evidence_environment_mismatch', 'empty_evidence_artifact']) {
    assert.ok(issues.some((issue) => issue.code === code), `missing ${code}`);
  }
});

test('route references are authority ids and example semester.com locations cannot prove a live route', async () => {
  const routeEvidence = envelope({ id: 'route-source' });
  const record = workspace('student-os', { evidence_envelopes: [routeEvidence], refs: { routes: ['student.registration.readiness'], capabilities: [], workflows: [], code: ['route-source'], tests: [], deployments: [], activations: [] } });
  const scoped = snapshot(PILOT_RELEASE_SCOPES.map((key) => key === record.key ? record : workspace(key)));
  scoped.screens = [{ key: 'student.registration.readiness', name: 'Student readiness', owner: 'registration', status: 'implemented', evidence: [artifact], route: 'app.semester.com/registration/readiness' }];
  const issues = await validateWorkspaceEvidence(scoped, { targetRevision: revision, now: '2026-10-10T13:00:00.000Z', readArtifact: async () => 'source artifact\n' });
  assert.ok(issues.some(({ code, path }) => code === 'noncanonical_live_route' && path.endsWith('.refs.routes.0')));
});

test('wrong-tenant, wrong-hash and unresolved artifacts cannot satisfy a gate', async () => {
  const entries = [
    envelope({ id: 'wrong-tenant', bindings: { ...envelope().bindings, tenant: 'other-campus' } }),
    envelope({ id: 'wrong-hash', artifact: { path: artifact, sha256: '1'.repeat(64) } }),
    envelope({ id: 'unresolved', artifact: { path: 'missing-at-revision', sha256 } }),
  ];
  const record = workspace('student-os', { evidence_envelopes: entries, refs: { routes: [], capabilities: [], workflows: [], code: entries.map(({ id }) => id), tests: [], deployments: [], activations: [] } });
  const issues = await validateWorkspaceEvidence(snapshot(PILOT_RELEASE_SCOPES.map((key) => key === record.key ? record : workspace(key))), {
    targetRevision: revision, targetTenant: 'synthetic-campus', now: '2026-10-10T13:00:00.000Z',
    readArtifact: async (_revision, path) => path === 'missing-at-revision' ? null : 'source artifact\n',
  });
  for (const code of ['evidence_tenant_mismatch', 'evidence_hash_mismatch', 'empty_evidence_artifact']) assert.ok(issues.some((issue) => issue.code === code), `missing ${code}`);
});

test('acceptance cases must reuse registered capability, system and route authorities', () => {
  const invalidManifest: PlatformManifest = {
    ...manifest,
    acceptance_cases: manifest.acceptance_cases.map((entry, index) => index === 0 ? { ...entry, capability_keys: ['invented.capability'], system_keys: ['invented-system'], route_ids: ['invented.route'] } : entry),
  };
  const issues = validateWorkspaceRegistry(snapshot(undefined, [invalidManifest]));
  assert.ok(issues.some(({ code }) => code === 'unknown_acceptance_capability'));
  assert.ok(issues.some(({ code }) => code === 'unknown_acceptance_system'));
  assert.ok(issues.some(({ code }) => code === 'unknown_acceptance_route'));
});

test('acceptance route authorities must map to the canonical host and scenario ids cannot change scopes', () => {
  const scoped = snapshot();
  scoped.screens = [{ key: 'example.route', name: 'Example', owner: 'owner', status: 'implemented', evidence: [artifact], route: 'app.semester.com/example' }];
  scoped.manifests![0]!.acceptance_cases[0] = { ...scoped.manifests![0]!.acceptance_cases[0]!, route_ids: ['example.route'], scopes: ['student-os', 'registrar-os'] };
  const issues = validateWorkspaceRegistry(scoped);
  assert.ok(issues.some(({ code }) => code === 'noncanonical_acceptance_route'));
  assert.ok(issues.some(({ code }) => code === 'acceptance_case_scope_drift'));
});

test('operating evidence requires an explicit matching tenant and release environment target', async () => {
  const operating = envelope({
    id: 'operating', kind: 'operating', expires_at: '2026-10-11T13:00:00.000Z',
    bindings: { ...envelope().bindings, environment: 'staging' },
  });
  const record = workspace('student-os', { evidence_envelopes: [operating], refs: { routes: [], capabilities: [], workflows: [], code: [], tests: [], deployments: ['operating'], activations: [] } });
  const scoped = snapshot(PILOT_RELEASE_SCOPES.map((key) => key === record.key ? record : workspace(key)));
  const missingTarget = await validateWorkspaceEvidence(scoped, { targetRevision: revision, now: '2026-10-10T13:00:00.000Z', readArtifact: async () => 'source artifact\n' });
  assert.ok(missingTarget.some(({ code }) => code === 'missing_release_evidence_context'));
  const wrongEnvironment = await validateWorkspaceEvidence(scoped, { targetRevision: revision, targetTenant: 'synthetic-campus', targetEnvironment: 'production', now: '2026-10-10T13:00:00.000Z', readArtifact: async () => 'source artifact\n' });
  assert.ok(wrongEnvironment.some(({ code }) => code === 'evidence_environment_mismatch'));
});

test('every evidence kind requires a target tenant and acceptance controls require case, polarity, kind and scope binding', async () => {
  const unrelated = envelope({ id: 'unrelated', scope: 'student-os' });
  const student = workspace('student-os', { evidence_envelopes: [unrelated] });
  const scoped = snapshot(PILOT_RELEASE_SCOPES.map((key) => key === student.key ? student : workspace(key)));
  scoped.manifests![0]!.acceptance_cases[6] = {
    ...scoped.manifests![0]!.acceptance_cases[6]!, status: 'passed', gaps: [],
    controls: scoped.manifests![0]!.acceptance_cases[6]!.controls.map((control) => ({ ...control, status: 'passed', evidence_refs: ['unrelated'] })),
  };
  const missingTenant = await validateWorkspaceEvidence(scoped, { targetRevision: revision, targetEnvironment: 'production', now: '2026-10-10T13:00:00.000Z', readArtifact: async () => 'source artifact\n' });
  assert.ok(missingTenant.some(({ code }) => code === 'missing_release_evidence_context'));
  assert.ok(missingTenant.some(({ code }) => code === 'invalid_acceptance_evidence'));
});

test('passed acceptance controls must resolve to validated evidence, never arbitrary strings', async () => {
  const scoped = snapshot();
  scoped.manifests![0]!.acceptance_cases[0] = {
    ...scoped.manifests![0]!.acceptance_cases[0]!, status: 'passed', gaps: [],
    controls: scoped.manifests![0]!.acceptance_cases[0]!.controls.map((control) => ({ ...control, status: 'passed', evidence_refs: ['fabricated'] })),
  };
  const issues = await validateWorkspaceEvidence(scoped, { targetRevision: revision, targetTenant: 'synthetic-campus', targetEnvironment: 'production', now: '2026-10-10T13:00:00.000Z', readArtifact: async () => 'source artifact\n' });
  assert.ok(issues.some(({ code }) => code === 'invalid_acceptance_evidence'));
});

test('malformed evidence envelopes report issues instead of throwing', async () => {
  const record = workspace('student-os', { evidence_envelopes: [null as unknown as WorkspaceEvidenceEnvelope], refs: null as never });
  const scoped = snapshot(PILOT_RELEASE_SCOPES.map((key) => key === record.key ? record : workspace(key)));
  const issues = await validateWorkspaceEvidence(scoped, { targetRevision: revision, now: '2026-10-10T13:00:00.000Z', readArtifact: async () => null });
  assert.ok(issues.some(({ code }) => code === 'invalid_evidence_envelope'));
  assert.ok(issues.some(({ code }) => code === 'invalid_workspace_evidence_refs'));
});

test('workspace evidence validation handles a null workspace record', async () => {
  const scoped = snapshot();
  scoped.workspaces![0] = null as never;
  const issues = await validateWorkspaceEvidence(scoped, { targetRevision: revision, targetTenant: 'synthetic-campus', now: '2026-10-10T13:00:00.000Z', readArtifact: async () => null });
  assert.ok(issues.some(({ code }) => code === 'invalid_workspace_record'));
});
