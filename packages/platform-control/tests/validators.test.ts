import assert from 'node:assert/strict';
import test from 'node:test';
import { loadRegistry } from '../scripts/registry-io.ts';
import { validateSnapshot } from '../scripts/validation.ts';
import { validateRelease } from '../validators/release-validator.ts';

test('the committed registry is internally consistent and every evidence path exists', async () => {
  assert.deepEqual(await validateSnapshot(await loadRegistry()), []);
});

test('release checking fails closed while production evidence is absent', async () => {
  const decision = validateRelease(await loadRegistry());
  assert.equal(decision.allowed, false);
  assert.deepEqual(decision.blockedCapabilities, ['registration.readiness']);
  assert.deepEqual(decision.blockedWorkspaces, [
    'public-web', 'student-os', 'faculty-os', 'advisor-os', 'registrar-os', 'finance-os', 'student-affairs-os',
    'institution-console', 'company-os', 'operations-os', 'applicant-portal', 'guardian-portal', 'alumni-portal',
    'employer-portal', 'partner-portal', 'developer-portal', 'community-marketplace',
  ]);
  assert.equal(decision.workspaceDecisions.length, 17);
  assert.ok(decision.workspaceDecisions.every(({ allowed, blockers }) => !allowed && blockers.length > 0));
});

test('a production-ready registration capability cannot hide an omitted finance, external or community leaf', async () => {
  const snapshot = await loadRegistry();
  snapshot.capabilities[0]!.maturity.production_ready = true;
  snapshot.workspaces = snapshot.workspaces!.filter(({ key }) => !['finance-os', 'guardian-portal', 'community-marketplace'].includes(key));
  const decision = validateRelease(snapshot);
  assert.equal(decision.allowed, false);
  assert.ok(decision.blockedWorkspaces.includes('finance-os'));
  assert.ok(decision.blockedWorkspaces.includes('guardian-portal'));
  assert.ok(decision.blockedWorkspaces.includes('community-marketplace'));
  assert.ok(decision.issues.some(({ code, path }) => code === 'missing_release_scope' && path === 'workspaces.finance-os'));
});

test('static booleans and non-empty reference strings cannot certify the full ecosystem', async () => {
  const snapshot = await loadRegistry();
  for (const capability of snapshot.capabilities) capability.maturity.production_ready = true;
  for (const workspace of snapshot.workspaces!) {
    workspace.operational_ready = true;
    workspace.activation = 'active';
    workspace.gaps = [];
    workspace.refs = { routes: ['static'], capabilities: ['static'], workflows: ['static'], code: ['static'], tests: ['static'], deployments: ['static'], activations: ['static'] };
  }
  snapshot.manifests![0]!.acceptance_cases = snapshot.manifests![0]!.acceptance_cases.map((entry) => ({
    ...entry, status: 'passed', gaps: [], controls: entry.controls.map((control) => ({ ...control, status: 'passed', evidence_refs: ['static'] })),
  }));
  const decision = validateRelease(snapshot);
  assert.equal(decision.allowed, false);
  assert.ok(decision.issues.some(({ code }) => code === 'evidence_validation_required'));
});

test('release reporting returns blockers instead of throwing on malformed nested workspace data', async () => {
  const snapshot = await loadRegistry();
  snapshot.workspaces![0]!.refs = null as never;
  snapshot.workspaces![0]!.gaps = null as never;
  snapshot.manifests![0]!.acceptance_cases[0]!.controls.push(null as never);
  const decision = validateRelease(snapshot);
  assert.equal(decision.allowed, false);
  assert.ok(decision.workspaceDecisions[0]!.blockers.some((blocker) => blocker.includes('malformed')));
  assert.ok(decision.acceptanceCases[0]!.blockers.some((blocker) => blocker.includes('malformed')));
});

test('release reporting handles null workspace and acceptance entries deterministically', async () => {
  const snapshot = await loadRegistry();
  snapshot.workspaces![0] = null as never;
  snapshot.manifests![0]!.acceptance_cases[0] = null as never;
  const decision = validateRelease(snapshot);
  assert.equal(decision.allowed, false);
  assert.ok(decision.issues.some(({ code }) => code === 'malformed_acceptance_case'));
});

test('the full-ecosystem acceptance registry has eight blocked cases with positive and negative controls', async () => {
  const snapshot = await loadRegistry();
  const cases = snapshot.manifests?.[0]?.acceptance_cases ?? [];
  assert.deepEqual(cases.map(({ id }) => id), ['XA-01', 'XA-02', 'XA-03', 'XA-04', 'XA-05', 'XA-06', 'XA-07', 'XA-08']);
  assert.ok(cases.every((entry) => entry.status === 'blocked'));
  assert.ok(cases.every((entry) => entry.controls.some(({ polarity }) => polarity === 'positive')));
  assert.ok(cases.every((entry) => entry.controls.some(({ polarity }) => polarity === 'negative')));
  assert.ok(cases.every((entry) => entry.controls.every(({ status }) => String(status) !== 'skipped')));
});

test('later maturity cannot bypass an earlier unproven stage', async () => {
  const snapshot = await loadRegistry();
  snapshot.capabilities[0]!.maturity.production_ready = true;
  const issues = await validateSnapshot(snapshot);
  assert.ok(issues.some(({ code, path }) => code === 'maturity_gap' && path.endsWith('production_ready')));
  assert.ok(issues.some(({ code, path }) => code === 'missing_stage_evidence' && path.endsWith('production_ready')));
});

test('a true maturity stage requires the evidence classes that prove that stage', async () => {
  const snapshot = await loadRegistry();
  snapshot.capabilities[0]!.evidence.schema = [
    { path: 'packages/institution/src/readiness.ts', kind: 'code' },
  ];
  const issues = await validateSnapshot(snapshot);
  assert.deepEqual(
    issues.filter(({ code, path }) => code === 'missing_evidence_kind' && path.endsWith('.schema')).map(({ message }) => message),
    ['True stage schema requires schema evidence.', 'True stage schema requires test evidence.'],
  );
});

test('malformed maturity evidence reports an issue instead of crashing validation', async () => {
  const snapshot = await loadRegistry();
  snapshot.capabilities[0]!.evidence.designed = ['not-an-evidence-object'] as never;
  const issues = await validateSnapshot(snapshot);
  assert.ok(issues.some(({ code, path }) => code === 'invalid_evidence_reference' && path.endsWith('.designed.0')));
});

test('the P0 board is complete, ordered, and remains fail-closed at launch', async () => {
  const snapshot = await loadRegistry();
  assert.equal(snapshot.backlog.length, 20);
  assert.deepEqual(snapshot.backlog.map(({ id }) => id), Array.from({ length: 20 }, (_, index) => `P0-${String(index + 1).padStart(3, '0')}`));
  assert.equal(snapshot.backlog.at(-1)?.state, 'blocked');
  assert.ok(snapshot.backlog.at(-1)?.blockers.some((blocker) => blocker.includes('Named-institution')));
});
