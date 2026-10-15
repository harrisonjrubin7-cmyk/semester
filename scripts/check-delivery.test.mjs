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
  art.data.location = 'docs/none/INC-READINESS-001.yaml';
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
  assert.ok(errors.some((e) => /expected GATE-01..GATE-06; missing \[GATE-06\]/.test(e)));
});

test('control: a renamed quality gate with the same count fails', () => {
  const repo = loadRepo();
  repo.gates.gates[5].id = 'GATE-07';
  const { errors } = check(repo);
  assert.ok(errors.some((e) => /missing \[GATE-06\]; unexpected \[GATE-07\]/.test(e)));
});

test('control: a hard dependency retired by its owner does not satisfy approval', () => {
  const repo = loadRepo();
  const { hard_dependencies: deps } = repo.increments.find((i) => i.data.id === 'RDY-INC-003').data;
  for (const id of deps) repo.graph.nodes.find((n) => n.id === id).status = 'retired';
  const promoted = withIncrement(repo, 'RDY-INC-003', (d) => { d.state = 'approved_for_build'; });
  const { errors } = check(promoted);
  assert.ok(errors.some((e) => /RDY-INC-003: approved_for_build blocked; hard dependencies below approved_for_build: .*source_authority_register/.test(e)));
});

test('control: an approved increment with no hard_dependencies declaration fails', () => {
  const repo = withIncrement(loadRepo(), 'RDY-INC-003', (d) => { d.state = 'approved_for_build'; delete d.hard_dependencies; });
  const { errors } = check(repo);
  assert.ok(errors.some((e) => /RDY-INC-003: approved_for_build requires hard_dependencies to be declared as an array/.test(e)));
});

test('control: an approved increment with a placeholder reference fails; a shaped one only warns', () => {
  const placeholder = (state) => withIncrement(loadRepo(), 'RDY-INC-003', (d) => { d.state = state; d.workflow_definition = 'TBD-placeholder'; });
  const approved = check(placeholder('approved_for_build'));
  assert.ok(approved.errors.some((e) => /RDY-INC-003: workflow_definition TBD-placeholder is neither a file path nor a registry artifact id/.test(e)));
  const shaped = check(placeholder('shaped'));
  assert.ok(shaped.warnings.some((e) => /RDY-INC-003: workflow_definition TBD-placeholder/.test(e)));
});

test('control: an approved increment citing a file path that does not exist fails', () => {
  const repo = withIncrement(loadRepo(), 'RDY-INC-003', (d) => { d.state = 'approved_for_build'; d.data_contract = 'supabase/migrations/no_such_file.sql'; });
  const { errors } = check(repo);
  assert.ok(errors.some((e) => /data_contract supabase\/migrations\/no_such_file.sql does not exist on disk/.test(e)));
});

test('control: an approved artifact whose review date has passed fails', () => {
  const repo = loadRepo();
  const art = repo.artifacts.find((a) => a.data.id === 'ART-RDY-011');
  art.data.state = 'approved';
  art.data.review.next_due = '2020-01-01';
  art.data.location = 'docs/pilot/registration-readiness/INC-READINESS-001.yaml';
  repo.today = '2026-10-15';
  const { errors } = check(repo);
  assert.ok(errors.some((e) => /ART-RDY-011: approved but its review was due 2020-01-01/.test(e)));
});

test('control: a finance artifact marked present without evidence on disk fails', () => {
  const repo = loadRepo();
  repo.finance.minimum_artifacts.find((a) => a.id === 'ledger_schema').evidence = 'supabase/migrations/none.sql';
  const { errors } = check(repo);
  assert.ok(errors.some((e) => /finance: ledger_schema is marked present but its evidence supabase\/migrations\/none.sql does not exist/.test(e)));
});
