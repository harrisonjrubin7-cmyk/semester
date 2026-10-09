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
});

test('later maturity cannot bypass an earlier unproven stage', async () => {
  const snapshot = await loadRegistry();
  snapshot.capabilities[0]!.maturity.production_ready = true;
  const issues = await validateSnapshot(snapshot);
  assert.ok(issues.some(({ code, path }) => code === 'maturity_gap' && path.endsWith('production_ready')));
  assert.ok(issues.some(({ code, path }) => code === 'missing_stage_evidence' && path.endsWith('production_ready')));
});
