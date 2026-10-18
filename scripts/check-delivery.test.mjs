import assert from 'node:assert/strict';
import { test } from 'node:test';
import { symlinkSync, unlinkSync } from 'node:fs';
import { join } from 'node:path';
import { check, loadRepo } from './check-delivery.mjs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

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

test('control: two artifacts sharing one id fail', () => {
  const repo = loadRepo();
  repo.artifacts.push({ path: 'registry/artifacts/ART-RDY-011.json', data: clone(repo.artifacts[0].data) });
  const { errors } = check(repo);
  assert.ok(errors.some((e) => /ART-RDY-011: duplicate artifact id/.test(e)));
});

test('control: an approved increment citing a draft artifact by its path fails', () => {
  const repo = withIncrement(loadRepo(), 'RDY-INC-003', (d) => {
    d.state = 'approved_for_build';
    d.operational_runbook = 'docs/pilot/registration-readiness/INC-READINESS-001.yaml';
  });
  const { errors } = check(repo);
  assert.ok(errors.some((e) => /operational_runbook docs\/pilot\/registration-readiness\/INC-READINESS-001\.yaml is registered artifact ART-RDY-011, currently draft/.test(e)));
});

test('control: an approved increment with an undefined release train fails', () => {
  const repo = withIncrement(loadRepo(), 'RDY-INC-003', (d) => { d.state = 'approved_for_build'; d.release_train = 'readines'; });
  const { errors } = check(repo);
  assert.ok(errors.some((e) => /RDY-INC-003: release_train readines is not a defined release train/.test(e)));
});

test('control: an empty approver holder is reported like the UNASSIGNED sentinel', () => {
  const repo = loadRepo();
  repo.decisions.decisions[0].approver_holder = null;
  const { warnings } = check(repo);
  assert.ok(warnings.some((w) => /decision-rights: .* has no named approver/.test(w)));
});

test('control: an approved increment that still carries open gaps fails', () => {
  const repo = withIncrement(loadRepo(), 'RDY-INC-003', (d) => { d.state = 'approved_for_build'; });
  const { errors } = check(repo);
  assert.ok(errors.some((e) => /RDY-INC-003: 4 open gap\(s\); approved_for_build cannot carry open gaps/.test(e)));
});

test('control: a finance baseline missing a required control fails', () => {
  const repo = loadRepo();
  repo.finance.minimum_artifacts = repo.finance.minimum_artifacts.filter((a) => a.id !== 'ledger_schema');
  const { errors } = check(repo);
  assert.ok(errors.some((e) => /finance: minimum artifacts missing \[ledger_schema\]/.test(e)));
});

test('control: an approved artifact with an impossible review date fails', () => {
  const repo = loadRepo();
  const art = repo.artifacts.find((a) => a.data.id === 'ART-RDY-011');
  art.data.state = 'approved';
  art.data.location = 'docs/pilot/registration-readiness/INC-READINESS-001.yaml';
  art.data.review.next_due = '9999-99-99';
  const { errors } = check(repo);
  assert.ok(errors.some((e) => /ART-RDY-011: approved but next_due is not a valid calendar date/.test(e)));
});

test('control: an approved increment with an unknown capability key fails', () => {
  const repo = withIncrement(loadRepo(), 'RDY-INC-003', (d) => { d.state = 'approved_for_build'; d.capability_key = 'registration.typo'; });
  const { errors } = check(repo);
  assert.ok(errors.some((e) => /capability_key registration.typo is not in packages\/platform-control/.test(e)));
});

test('control: an approved increment with a non-string reference value fails', () => {
  const repo = withIncrement(loadRepo(), 'RDY-INC-003', (d) => { d.state = 'approved_for_build'; d.operational_runbook = { bogus: true }; });
  const { errors } = check(repo);
  assert.ok(errors.some((e) => /RDY-INC-003: operational_runbook \[object Object\]|RDY-INC-003: operational_runbook must be a string reference/.test(e)));
});

test('control: an approved increment whose reference escapes the repository fails', () => {
  const repo = withIncrement(loadRepo(), 'RDY-INC-003', (d) => { d.state = 'approved_for_build'; d.data_contract = '../../etc/passwd'; });
  const { errors } = check(repo);
  assert.ok(errors.some((e) => /RDY-INC-003: data_contract \.\.\/\.\.\/etc\/passwd is outside the repository/.test(e)));
});

test('control: a finance control with an unknown status fails', () => {
  const repo = loadRepo();
  repo.finance.minimum_artifacts.find((a) => a.id === 'finance_component_passport').status = 'complete_typo';
  const { errors } = check(repo);
  assert.ok(errors.some((e) => /finance: finance_component_passport has unknown status complete_typo/.test(e)));
});

test('control: an approved artifact without an accountable owner fails', () => {
  const repo = loadRepo();
  const art = repo.artifacts.find((a) => a.data.id === 'ART-RDY-011');
  art.data.state = 'approved';
  art.data.review.next_due = '2099-01-01';
  delete art.data.owners;
  art.data.location = 'docs/pilot/registration-readiness/INC-READINESS-001.yaml';
  const { errors } = check(repo);
  assert.ok(errors.some((e) => /ART-RDY-011: approved without an accountable owner/.test(e)));
});

test('control: an approved artifact with an unresolved dependency fails', () => {
  const repo = loadRepo();
  const art = repo.artifacts.find((a) => a.data.id === 'ART-RDY-011');
  art.data.state = 'approved';
  art.data.review.next_due = '2099-01-01';
  art.data.location = 'docs/pilot/registration-readiness/INC-READINESS-001.yaml';
  const { errors } = check(repo);
  assert.ok(errors.some((e) => /ART-RDY-011: approved with unresolved dependency source-authority-register/.test(e)));
});

test('control: an expansion scorecard missing a required hard stop fails', () => {
  const repo = loadRepo();
  repo.scorecard.hard_stops = repo.scorecard.hard_stops.filter((s) => s !== 'confirmed_unauthorized_access');
  const { errors } = check(repo);
  assert.ok(errors.some((e) => /missing required hard stops \[confirmed_unauthorized_access\]/.test(e)));
});

test('control: an approved increment citing a directory as evidence fails', () => {
  const repo = withIncrement(loadRepo(), 'RDY-INC-003', (d) => { d.state = 'approved_for_build'; d.data_contract = 'docs/'; });
  const { errors } = check(repo);
  assert.ok(errors.some((e) => /RDY-INC-003: data_contract docs\/ is not a regular file/.test(e)));
});

test('control: a non-canonical path to a draft artifact still counts as that artifact', () => {
  const repo = withIncrement(loadRepo(), 'RDY-INC-003', (d) => {
    d.state = 'approved_for_build';
    d.operational_runbook = './docs/pilot/registration-readiness/INC-READINESS-001.yaml';
  });
  const { errors } = check(repo);
  assert.ok(errors.some((e) => /is registered artifact ART-RDY-011, currently draft/.test(e)));
});

test('control: an approved artifact whose accountable owner is the UNASSIGNED sentinel fails', () => {
  const repo = loadRepo();
  const art = repo.artifacts.find((a) => a.data.id === 'ART-RDY-011');
  art.data.state = 'approved';
  art.data.review.next_due = '2099-01-01';
  art.data.owners.accountable = 'UNASSIGNED';
  art.data.location = 'docs/pilot/registration-readiness/INC-READINESS-001.yaml';
  const { errors } = check(repo);
  assert.ok(errors.some((e) => /ART-RDY-011: approved without an accountable owner/.test(e)));
});

test('control: an artifact that depends on itself fails', () => {
  const repo = loadRepo();
  const art = repo.artifacts.find((a) => a.data.id === 'ART-RDY-011');
  art.data.state = 'approved';
  art.data.review.next_due = '2099-01-01';
  art.data.location = 'docs/pilot/registration-readiness/INC-READINESS-001.yaml';
  art.data.dependencies = ['ART-RDY-011'];
  const { errors } = check(repo);
  assert.ok(errors.some((e) => /ART-RDY-011: approved artifact depends on itself/.test(e)));
});

test('control: a quality gate missing a required check fails', () => {
  const repo = loadRepo();
  repo.gates.gates[1].checks = repo.gates.gates[1].checks.filter((c) => c !== 'RLS_policy_tested');
  const { errors } = check(repo);
  assert.ok(errors.some((e) => /GATE-02 missing required checks \[RLS_policy_tested\]/.test(e)));
});

test('control: a gated state without a hard-dependency threshold fails', () => {
  const repo = loadRepo();
  delete repo.model.hard_dependency_minimum_state.approved_for_build;
  const { errors } = check(repo);
  assert.ok(errors.some((e) => /hard_dependency_minimum_state is missing approved_for_build/.test(e)));
});

test('control: two artifacts registered at one location fail', () => {
  const repo = loadRepo();
  const original = repo.artifacts.find((a) => a.data.id === 'ART-RDY-011');
  const copy = clone(original);
  copy.data.id = 'ART-RDY-099';
  copy.path = 'registry/artifacts/ART-RDY-099.json';
  repo.artifacts.push(copy);
  const { errors } = check(repo);
  assert.ok(errors.some((e) => /ART-RDY-099: location .* is also registered by ART-RDY-011/.test(e)));
});

test('control: a safe-off behavior that is a placeholder fails once enabled', () => {
  const repo = withIncrement(loadRepo(), 'RDY-INC-003', (d) => {
    d.state = 'enabled';
    d.rollout_and_rollback_plan.safe_off = ' unassigned ';
  });
  const { errors } = check(repo);
  assert.ok(errors.some((e) => /RDY-INC-003: enabled without a safe-off/.test(e)));
});

test('control: an approved increment whose required field is a placeholder sentinel fails', () => {
  const repo = withIncrement(loadRepo(), 'RDY-INC-003', (d) => {
    d.state = 'approved_for_build';
    d.accountable_owner = 'UNASSIGNED';
  });
  const { errors } = check(repo);
  assert.ok(errors.some((e) => /RDY-INC-003: approved_for_build requires .*accountable_owner/.test(e)));
});

test('control: a dependency threshold naming a state that does not exist fails', () => {
  const repo = loadRepo();
  repo.model.hard_dependency_minimum_state.approved_for_build = 'approved_for_bulid';
  const { errors } = check(repo);
  assert.ok(errors.some((e) => /hard_dependency_minimum_state\.approved_for_build approved_for_bulid is not a delivery state/.test(e)));
});

test('control: dropping a pinned required field from the operating model fails', () => {
  const repo = loadRepo();
  repo.model.every_increment_requires = repo.model.every_increment_requires.filter((k) => k !== 'UI_states');
  const { errors } = check(repo);
  assert.ok(errors.some((e) => /every_increment_requires must list the pinned required fields/.test(e)));
});

test('control: an artifact whose location is a directory fails', () => {
  const repo = loadRepo();
  const art = repo.artifacts.find((a) => a.data.id === 'ART-RDY-011');
  art.data.location = 'docs/pilot/registration-readiness/accessibility';
  const { errors } = check(repo);
  assert.ok(errors.some((e) => /ART-RDY-011: state draft but .* is not a regular file/.test(e)));
});

test('control: reordering the delivery states fails', () => {
  const repo = loadRepo();
  const s = repo.model.delivery_states;
  [s[2], s[7]] = [s[7], s[2]];
  const { errors } = check(repo);
  assert.ok(errors.some((e) => /delivery_states must be the pinned order/.test(e)));
});

test('control: an emptied increment registry fails, and a removed baseline record fails', () => {
  const emptied = loadRepo();
  emptied.increments = [];
  assert.ok(check(emptied).errors.some((e) => /registry\/increments: registry is missing or holds no records/.test(e)));
  const dropped = loadRepo();
  dropped.artifacts = dropped.artifacts.filter((a) => a.data.id !== 'ART-RDY-011');
  assert.ok(check(dropped).errors.some((e) => /required record ART-RDY-011 is missing/.test(e)));
});

test('control: a release-approved increment whose rollout plan has no answers fails', () => {
  const repo = withIncrement(loadRepo(), 'RDY-INC-003', (d) => {
    d.state = 'approved_for_release';
    d.rollout_and_rollback_plan = { bogus: true };
  });
  const { errors } = check(repo);
  assert.ok(errors.some((e) => /RDY-INC-003: approved_for_release requires rollout_and_rollback_plan\.feature_flag/.test(e)));
});

test('control: deleting a specification-defined increment card fails', () => {
  const repo = loadRepo();
  repo.increments = repo.increments.filter((i) => i.data.id !== 'RDY-INC-005');
  const { errors } = check(repo);
  assert.ok(errors.some((e) => /required record RDY-INC-005 is missing/.test(e)));
});

test('control: deleting a specification-defined risk fails', () => {
  const repo = loadRepo();
  repo.risks.risks = repo.risks.risks.filter((r) => r.id !== 'RSK-002');
  const { errors } = check(repo);
  assert.ok(errors.some((e) => /required risk RSK-002 is missing/.test(e)));
});

test('control: deleting a specification-defined decision row fails', () => {
  const repo = loadRepo();
  repo.decisions.decisions = repo.decisions.decisions.filter((d) => d.decision !== 'Emergency disable');
  const { errors } = check(repo);
  assert.ok(errors.some((e) => /required decision "Emergency disable" is missing/.test(e)));
});

test('control: a present finance control pointing at a directory fails', () => {
  const repo = loadRepo();
  const control = repo.finance.minimum_artifacts.find((a) => a.status === 'present');
  control.evidence = 'docs/';
  const { errors } = check(repo);
  assert.ok(errors.some((e) => /is marked present but its evidence docs\/ does not exist/.test(e)));
});

test('control: a release-approved rollout plan with boolean answers fails', () => {
  const repo = withIncrement(loadRepo(), 'RDY-INC-003', (d) => {
    d.state = 'approved_for_release';
    d.rollout_and_rollback_plan = { feature_flag: false, safe_off: false, rollback: false };
  });
  const { errors } = check(repo);
  assert.ok(errors.some((e) => /requires rollout_and_rollback_plan\.feature_flag/.test(e)));
});

test('control: a whitespace-only rollout answer fails at release approval', () => {
  const repo = withIncrement(loadRepo(), 'RDY-INC-003', (d) => {
    d.state = 'approved_for_release';
    d.rollout_and_rollback_plan = { feature_flag: '   ', safe_off: 'Read-only guidance.', rollback: 'Disable flag.' };
  });
  const { errors } = check(repo);
  assert.ok(errors.some((e) => /RDY-INC-003: approved_for_release requires rollout_and_rollback_plan\.feature_flag/.test(e)));
});

test('control: a boolean in a required increment field fails at approval', () => {
  const repo = withIncrement(loadRepo(), 'RDY-INC-003', (d) => {
    d.state = 'approved_for_build';
    d.problem_statement = false;
  });
  const { errors } = check(repo);
  assert.ok(errors.some((e) => /RDY-INC-003: approved_for_build requires .*problem_statement/.test(e)));
});

test('control: a root-level evidence file resolves as a path, not an artifact id', () => {
  const repo = withIncrement(loadRepo(), 'RDY-INC-003', (d) => { d.operational_runbook = 'GO-NO-GO-DECISION.md'; });
  const { warnings } = check(repo);
  assert.ok(!warnings.some((w) => /operational_runbook GO-NO-GO-DECISION.md is neither/.test(w)));
});

test('control: a symlink inside the repository that points outside it is not evidence', () => {
  const link = join(ROOT, '.delivery-test-link');
  symlinkSync(process.execPath, link);
  try {
    const repo = loadRepo();
    const control = repo.finance.minimum_artifacts.find((a) => a.status === 'present');
    control.evidence = '.delivery-test-link';
    const { errors } = check(repo);
    assert.ok(errors.some((e) => /is marked present but its evidence .delivery-test-link does not exist/.test(e)));
  } finally {
    unlinkSync(link);
  }
});

test('control: removing a required dependency from ART-RDY-011 fails', () => {
  const repo = loadRepo();
  const art = repo.artifacts.find((a) => a.data.id === 'ART-RDY-011');
  art.data.dependencies = art.data.dependencies.filter((d) => d !== 'alert-routing');
  const { errors } = check(repo);
  assert.ok(errors.some((e) => /ART-RDY-011: dependency alert-routing must stay declared/.test(e)));
});

test('control: an absolute path to a repository file is not evidence', () => {
  const repo = loadRepo();
  const control = repo.finance.minimum_artifacts.find((a) => a.status === 'present');
  control.evidence = join(ROOT, 'GO-NO-GO-DECISION.md');
  const { errors } = check(repo);
  assert.ok(errors.some((e) => /is marked present but its evidence .*GO-NO-GO-DECISION\.md does not exist/.test(e)));
});

test('control: an in-repository alias of a draft artifact is matched to that artifact', () => {
  const alias = join(ROOT, '.delivery-alias-test');
  const target = 'docs/pilot/registration-readiness/INC-READINESS-001.yaml';
  symlinkSync(join(ROOT, target), alias);
  try {
    const repo = withIncrement(loadRepo(), 'RDY-INC-003', (d) => {
      d.state = 'approved_for_build';
      d.operational_runbook = target;
    });
    repo.artifacts.find((a) => a.data.id === 'ART-RDY-011').data.location = '.delivery-alias-test';
    const { errors } = check(repo);
    assert.ok(errors.some((e) => /is registered artifact ART-RDY-011, currently draft/.test(e)));
  } finally {
    unlinkSync(alias);
  }
});
