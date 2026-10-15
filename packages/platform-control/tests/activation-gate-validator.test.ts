import assert from 'node:assert/strict';
import { symlink, unlink } from 'node:fs/promises';
import { resolve } from 'node:path';
import test from 'node:test';
import { loadRegistry, repositoryRoot } from '../scripts/registry-io.ts';
import { validateEvidence, validateSnapshot } from '../scripts/validation.ts';
import type { ActivationGate, ActivationGateItem, CapabilityRecord, RegistrySnapshot } from '../types.ts';
import { GATE_APPROVERS, REQUIRED_GATE_ITEMS, validateActivationGates } from '../validators/activation-gate-validator.ts';

const maturity = {
  designed: true, schema: true, policies: true, api: false, user_interface: false, e2e_tested: false,
  staged: false, production_ready: false, tenant_activated: false, monitored: false,
};
const capability = (changes: Partial<CapabilityRecord> = {}): CapabilityRecord => ({
  key: 'registration.readiness', name: 'Registration readiness', domain: 'registration', workspace: 'student', phase: 'P0',
  owner: 'product-registration', risk: 'high', data_classification: 'restricted', roles: {}, systems: [], routes: [],
  commands: [], events: [], maturity: { ...maturity }, evidence: {}, ...changes,
});
const items = (overrides: Record<string, Partial<ActivationGateItem>> = {}): ActivationGateItem[] => REQUIRED_GATE_ITEMS.map((id) => ({
  id, area: id.split('.')[0], status: 'not_verified', evidence: [], gap: 'Not verified.', ...overrides[id],
}));
const allPassed = (): ActivationGateItem[] => items(Object.fromEntries(REQUIRED_GATE_ITEMS.map((id) => [id, {
  status: 'passed' as const, evidence: ['packages/institution/src/policy.test.ts'],
}])));
const gate = (changes: Partial<ActivationGate> = {}): ActivationGate => ({
  key: 'activation.registration.readiness', capability: 'registration.readiness', name: 'Gate', owner: 'product-registration',
  status: 'not_ready', decision: { record: null, approvers: [...GATE_APPROVERS] }, required: items(), ...changes,
});
const snapshot = (activationGates: ActivationGate[], capabilities = [capability()]): RegistrySnapshot => ({
  capabilities, systems: [], roles: [], screens: [], workflows: [], integrations: [], controls: [], documents: [], tenants: [],
  backlog: [], activationGates,
});
const codes = (value: RegistrySnapshot): string[] => validateActivationGates(value).map(({ code }) => code);

test('the shipped registration-readiness gate is valid and not ready', async () => {
  const registry = await loadRegistry();
  assert.deepEqual(validateActivationGates(registry), []);
  const [shipped] = registry.activationGates ?? [];
  assert.equal(shipped.status, 'not_ready');
  assert.equal(shipped.required.filter(({ status }) => status === 'passed').length, 1);
});

test('ready requires every item passed and a decision record; the status cannot be set by hand', () => {
  assert.deepEqual(codes(snapshot([gate({ status: 'ready', required: allPassed() })])), ['gate_status_mismatch']);
  assert.deepEqual(codes(snapshot([gate({ status: 'ready', decision: { record: 'docs/decisions/D-1.md', approvers: [...GATE_APPROVERS] } })])), ['gate_status_mismatch']);
  const decided = gate({ status: 'ready', decision: { record: 'docs/decisions/D-1.md', approvers: [...GATE_APPROVERS] }, required: allPassed() });
  assert.deepEqual(codes(snapshot([decided], [capability({ maturity: { ...maturity, tenant_activated: true } })])), []);
});

test('rejects item drift in either direction and duplicated items', () => {
  assert.deepEqual(codes(snapshot([gate({ required: items().slice(1) })])), ['activation_gate_item_drift']);
  const extra = [...items(), { id: 'product.invented', area: 'product', status: 'not_verified' as const, evidence: [], gap: 'x' }];
  assert.deepEqual(codes(snapshot([gate({ required: extra })])), ['activation_gate_item_drift']);
  const duplicated = [...items(), items()[0]];
  assert.deepEqual(codes(snapshot([gate({ required: duplicated })])), ['activation_gate_item_drift']);
});

test('rejects unknown item statuses and passed items that cite no evidence', () => {
  const invalid = items({ 'product.receipt_tested': { status: 'maybe' as ActivationGateItem['status'] } });
  assert.deepEqual(codes(snapshot([gate({ required: invalid })])), ['invalid_gate_item_status']);
  const bare = items({ 'authority_and_policy.policy_tests_passing': { status: 'passed', evidence: [] } });
  assert.deepEqual(codes(snapshot([gate({ required: bare })])), ['gate_item_passed_without_evidence']);
});

test('tenant activation requires a ready gate for that capability', () => {
  const activated = [capability({ maturity: { ...maturity, tenant_activated: true } })];
  assert.deepEqual(codes(snapshot([gate()], activated)), ['activation_without_gate']);
  assert.ok(codes(snapshot([], activated)).includes('activation_without_gate'));
});

test('the registration-readiness gate must exist even before activation', () => {
  assert.ok(codes(snapshot([])).includes('activation_gate_missing'));
});

test('a null checklist item is reported, not thrown', () => {
  const nullItem = { ...gate(), required: [null] } as unknown as ActivationGate;
  assert.deepEqual(codes(snapshot([nullItem])), ['malformed_activation_gate']);
});

test('a null gate entry is reported through full snapshot validation, not thrown', async () => {
  const issues = await validateSnapshot(snapshot([null as unknown as ActivationGate]));
  assert.ok(issues.some(({ code }) => code === 'malformed_activation_gate'));
});

test('gate evidence that is a symlink to a file outside the repository is rejected', async () => {
  const link = 'packages/platform-control/tests/.outside-link-fixture';
  await symlink('/etc/passwd', resolve(repositoryRoot, link));
  try {
    const bad = gate({ required: items({ 'trust.student_copy_approved': { status: 'passed', evidence: [link] } }) });
    const issues = await validateEvidence(snapshot([bad]));
    assert.ok(issues.some(({ code }) => code === 'gate_evidence_outside_repository'));
  } finally {
    await unlink(resolve(repositoryRoot, link));
  }
});

test('rejects approver drift and gates that reference unknown capabilities', () => {
  assert.deepEqual(codes(snapshot([gate({ decision: { record: null, approvers: ['product'] } })])), ['gate_approvers_drift']);
  const unknown = codes(snapshot([gate({ capability: 'not.a.capability' })]));
  assert.ok(unknown.includes('gate_capability_unsupported') && unknown.includes('gate_unknown_capability'));
});

test('gate evidence paths must exist in the repository', async () => {
  const bad = gate({ required: items({ 'trust.student_copy_approved': { status: 'passed', evidence: ['packages/none/does-not-exist.md'] } }) });
  const issues = await validateEvidence(snapshot([bad]));
  assert.deepEqual(issues.map(({ code, path }) => [code, path]), [['missing_evidence_path', 'packages/none/does-not-exist.md']]);
});

test('a recorded activation decision must resolve to repository evidence', async () => {
  const bad = gate({
    status: 'ready',
    required: allPassed(),
    decision: { record: 'docs/decisions/does-not-exist.md', approvers: [...GATE_APPROVERS] },
  });
  const issues = await validateEvidence(snapshot([bad]));
  assert.deepEqual(issues.map(({ code, path }) => [code, path]), [['missing_evidence_path', 'docs/decisions/does-not-exist.md']]);
});

test('malformed registry records are reported, not thrown', () => {
  const noList = { ...gate(), required: null } as unknown as ActivationGate;
  assert.deepEqual(codes(snapshot([noList])), ['malformed_activation_gate']);
  const noDecision = { ...gate(), decision: undefined } as unknown as ActivationGate;
  assert.ok(codes(snapshot([noDecision])).includes('gate_approvers_drift'));
});

test('evidence must be a repository-relative path that stays inside the repository', () => {
  for (const reference of ['', '   ', '/etc/passwd', '../outside.md', 'packages/../../outside.md']) {
    const bad = gate({ required: items({ 'trust.student_copy_approved': { status: 'passed', evidence: [reference] } }) });
    assert.ok(codes(snapshot([bad])).includes('gate_evidence_path_invalid'), `expected ${JSON.stringify(reference)} to be rejected`);
  }
});

test('gate evidence must name a file, not a directory', async () => {
  for (const reference of ['.', 'packages']) {
    const bad = gate({ required: items({ 'trust.student_copy_approved': { status: 'passed', evidence: [reference] } }) });
    const issues = await validateEvidence(snapshot([bad]));
    assert.ok(issues.some(({ code }) => code === 'gate_evidence_not_file'), `expected ${reference} to be rejected as a directory`);
  }
});

test('decision records must be repository-contained paths', () => {
  const outside = gate({ status: 'ready', required: allPassed(), decision: { record: '/etc/passwd', approvers: [...GATE_APPROVERS] } });
  assert.ok(codes(snapshot([outside])).includes('gate_decision_path_invalid'));
});

test('malformed gates are reported by full snapshot validation, not thrown', async () => {
  const noList = { ...gate(), required: null } as unknown as ActivationGate;
  const issues = await validateSnapshot(snapshot([noList]));
  assert.ok(issues.some(({ code }) => code === 'malformed_activation_gate'));
});

test('a gate may only validate the registration-readiness checklist', () => {
  const other = gate({ key: 'activation.other', capability: 'other.capability', required: allPassed() });
  const issues = codes(snapshot([other], [capability(), capability({ key: 'other.capability' })]));
  assert.ok(issues.includes('gate_capability_unsupported'));
});

test('an activation gate must name an owner', () => {
  assert.ok(codes(snapshot([gate({ owner: '  ' })])).includes('gate_owner_missing'));
});

test('one activation gate per capability', () => {
  assert.deepEqual(codes(snapshot([gate(), gate({ key: 'activation.second' })])), ['duplicate_activation_gate']);
});

test('every unverified or failed item states its gap', () => {
  const noGap = items({ 'product.receipt_tested': { gap: '   ' } });
  assert.deepEqual(codes(snapshot([gate({ required: noGap })])), ['gate_item_missing_gap']);
});

test('approvers compare as a multiset, so a join cannot fabricate a role', () => {
  const joined = ['Semester_product_owner|Semester_security_or_operations_owner', 'institution_operational_owner'];
  assert.deepEqual(codes(snapshot([gate({ decision: { record: null, approvers: joined } })])), ['gate_approvers_drift']);
  const duplicated = [GATE_APPROVERS[0], GATE_APPROVERS[0], GATE_APPROVERS[1]];
  assert.deepEqual(codes(snapshot([gate({ decision: { record: null, approvers: duplicated } })])), ['gate_approvers_drift']);
});
