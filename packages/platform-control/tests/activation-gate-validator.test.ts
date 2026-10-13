import assert from 'node:assert/strict';
import test from 'node:test';
import { loadRegistry } from '../scripts/registry-io.ts';
import { validateEvidence } from '../scripts/validation.ts';
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
  assert.deepEqual(codes(snapshot([], activated)), ['activation_without_gate']);
});

test('rejects approver drift and gates that reference unknown capabilities', () => {
  assert.deepEqual(codes(snapshot([gate({ decision: { record: null, approvers: ['product'] } })])), ['gate_approvers_drift']);
  assert.deepEqual(codes(snapshot([gate({ capability: 'not.a.capability' })])), ['gate_unknown_capability']);
});

test('gate evidence paths must exist in the repository', async () => {
  const bad = gate({ required: items({ 'trust.student_copy_approved': { status: 'passed', evidence: ['packages/none/does-not-exist.md'] } }) });
  const issues = await validateEvidence(snapshot([bad]));
  assert.deepEqual(issues.map(({ code, path }) => [code, path]), [['missing_evidence_path', 'packages/none/does-not-exist.md']]);
});
