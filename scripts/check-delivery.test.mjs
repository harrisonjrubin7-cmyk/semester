import assert from 'node:assert/strict';
import { test } from 'node:test';
import { check, loadRepo } from './check-delivery.mjs';

// Each control below is a deliberate break of one rule. The test fails if the checker stops catching it.
const clone = (x) => structuredClone(x);
const withIncrement = (repo, id, mutate) => {
  const r = clone(repo);
  const hit = r.increments.find((i) => i.data.id === id);
  mutate(hit.data);
  return r;
};

test('the committed delivery records pass with no errors', () => {
  const { errors } = check(loadRepo());
  assert.deepEqual(errors, []);
});

test('RDY-INC-003 is reported as blocked by unmet hard dependencies only when it is approved', () => {
  const repo = loadRepo();
  const { blockedBy, errors } = check(repo);
  assert.ok(blockedBy.get('RDY-INC-003')?.includes('source_authority_register'));
  assert.deepEqual(errors, []);
  const promoted = withIncrement(repo, 'RDY-INC-003', (d) => { d.state = 'approved_for_build'; });
  const result = check(promoted);
  assert.ok(result.errors.some((e) => /RDY-INC-003: approved_for_build blocked/.test(e)));
});

test('control: an increment approved for build with a null required field fails', () => {
  const repo = withIncrement(loadRepo(), 'RDY-INC-003', (d) => { d.state = 'approved_for_build'; d.release_evidence = null; });
  const { errors } = check(repo);
  assert.ok(errors.some((e) => /RDY-INC-003: approved_for_build requires .*release_evidence/.test(e)));
});

test('control: enabling an increment without a safe-off behavior fails', () => {
  const repo = withIncrement(loadRepo(), 'RDY-INC-003', (d) => {
    d.state = 'enabled';
    d.rollout_and_rollback_plan.safe_off = '';
  });
  const { errors } = check(repo);
  assert.ok(errors.some((e) => /RDY-INC-003: enabled without a safe-off/.test(e)));
});

test('control: a hard dependency that is not in the graph fails', () => {
  const repo = withIncrement(loadRepo(), 'RDY-INC-003', (d) => { d.hard_dependencies.push('no_such_component'); });
  const { errors } = check(repo);
  assert.ok(errors.some((e) => /hard dependency no_such_component is not in dependency-graph/.test(e)));
});

test('control: a cycle in the dependency graph fails', () => {
  const repo = loadRepo();
  repo.graph.edges.push({ from: 'hypercare_pilot_measurement', to: 'institution_activation', type: 'hard' });
  const { errors } = check(repo);
  assert.ok(errors.some((e) => /dependency-graph: cycle/.test(e)));
});

test('control: an artifact that claims approved but whose file is missing fails', () => {
  const repo = loadRepo();
  const art = repo.artifacts.find((a) => a.data.id === 'ART-RDY-011');
  art.data.state = 'approved';
  const { errors } = check(repo);
  assert.ok(errors.some((e) => /ART-RDY-011: state approved but .* does not exist/.test(e)));
});

test('control: an increment whose file name does not match its id fails', () => {
  const repo = loadRepo();
  repo.increments[0].path = 'registry/increments/RDY-INC-999.json';
  const { errors } = check(repo);
  assert.ok(errors.some((e) => /file name must match id/.test(e)));
});

test('control: a quality-gate set other than six gates fails', () => {
  const repo = loadRepo();
  repo.gates.gates.pop();
  const { errors } = check(repo);
  assert.ok(errors.some((e) => /expected 6 gates/.test(e)));
});
