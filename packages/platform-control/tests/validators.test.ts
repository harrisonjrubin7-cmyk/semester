import assert from 'node:assert/strict';
import test from 'node:test';
import { loadRegistry } from '../scripts/registry-io.ts';
import { validateSnapshot } from '../scripts/validation.ts';
import { validateRelease } from '../validators/release-validator.ts';
import { buildExecutionPlan, validateBacklog } from '../validators/backlog-validator.ts';

test('the committed registry is internally consistent and every evidence path exists', async () => {
  assert.deepEqual(await validateSnapshot(await loadRegistry()), []);
});

test('release checking fails closed while production evidence is absent', async () => {
  const decision = validateRelease(await loadRegistry());
  assert.equal(decision.allowed, false);
  assert.deepEqual(decision.blockedCapabilities, ['registration.readiness']);
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
  assert.equal(snapshot.backlog[0]?.state, 'verified');
  assert.equal(snapshot.backlog[0]?.blockers.length, 0);
  assert.equal(snapshot.backlog.at(-1)?.state, 'blocked');
  assert.ok(snapshot.backlog.at(-1)?.blockers.some((blocker) => blocker.includes('Named-institution')));
});

test('the execution plan distinguishes executable work from sequencing debt and dependency waits', async () => {
  const snapshot = await loadRegistry();
  const plan = buildExecutionPlan(snapshot.backlog);
  assert.equal(plan.find(({ id }) => id === 'P0-001')?.execution_status, 'verified');
  assert.equal(plan.find(({ id }) => id === 'P0-002')?.execution_status, 'active');
  assert.deepEqual(plan.find(({ id }) => id === 'P0-012')?.open_dependencies, ['P0-010', 'P0-011']);
  assert.equal(plan.find(({ id }) => id === 'P0-012')?.execution_status, 'waiting');
  assert.equal(plan.find(({ id }) => id === 'P0-020')?.execution_status, 'blocked');
});

test('a verified backlog item cannot depend on unfinished work', async () => {
  const snapshot = await loadRegistry();
  snapshot.backlog[0]!.state = 'in_progress';
  snapshot.backlog[1]!.state = 'verified';
  snapshot.backlog[1]!.evidence = ['package.json'];
  const issues = validateBacklog(snapshot);
  assert.ok(issues.some(({ code, path }) => code === 'verified_with_open_dependency' && path === 'backlog.P0-002.depends_on'));
});

test('verified backlog work cannot retain an open blocker', async () => {
  const snapshot = await loadRegistry();
  snapshot.backlog[0]!.blockers = ['This work is not actually complete.'];
  const issues = validateBacklog(snapshot);
  assert.ok(issues.some(({ code, path }) => code === 'verified_with_blockers' && path === 'backlog.P0-001'));
});
