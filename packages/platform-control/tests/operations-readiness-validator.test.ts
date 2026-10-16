import assert from 'node:assert/strict';
import test from 'node:test';
import { loadRegistry } from '../scripts/registry-io.ts';
import type { CapabilityRecord, OperationsEvidenceItem, OperationsReadinessRecord, RegistrySnapshot } from '../types.ts';
import { REQUIRED_OPERATIONS_EVIDENCE, validateOperationsReadiness } from '../validators/operations-readiness-validator.ts';
import { validateRelease } from '../validators/release-validator.ts';

const maturity = {
  designed: true, schema: true, policies: true, api: true, user_interface: true, e2e_tested: true,
  staged: true, production_ready: true, tenant_activated: false, monitored: false,
};
const capability: CapabilityRecord = {
  key: 'registration.readiness', name: 'Registration readiness', domain: 'registration', workspace: 'student', phase: 'P0',
  owner: 'product-registration', risk: 'high', data_classification: 'restricted', roles: {}, systems: [], routes: [], commands: [], events: [], maturity, evidence: {},
};
const future = '2999-01-01T00:00:00.000Z';
const evidenceById: Record<(typeof REQUIRED_OPERATIONS_EVIDENCE)[number], string> = {
  'support.escalation_roster': 'docs/evidence/operations/2026-10-03-founder-readiness-tabletop.md',
  'monitoring.synthetic_checks': 'docs/evidence/operations/2026-10-03-public-production-smoke.md',
  'recovery.restore_drill': 'docs/evidence/restore/2026-09-30-logical-rehearsal.md',
  'recovery.incident_exercise': 'docs/evidence/operations/2026-10-03-founder-readiness-tabletop.md',
};
const proofs = (changes: Partial<OperationsEvidenceItem> = {}): OperationsEvidenceItem[] => REQUIRED_OPERATIONS_EVIDENCE.map((id) => ({
  id, status: 'passed', evidence: [evidenceById[id]], observed_at: '2026-10-15T00:00:00.000Z',
  environment: 'production:semester', revision: 'a'.repeat(40), expires_at: future, gap: '', ...changes,
}));
const record = (changes: Partial<OperationsReadinessRecord> = {}): OperationsReadinessRecord => ({
  key: 'operations.registration.readiness', capability: 'registration.readiness', owner: 'platform-operations', status: 'ready',
  roster: { primary_owner: 'primary', backup_owner: 'backup', support_hours: '24x7 pilot window', escalation_contacts_published: true },
  required: proofs(), gaps: [], ...changes,
});
const snapshot = (operationsReadiness: OperationsReadinessRecord[] = [record()]): RegistrySnapshot => ({
  capabilities: [capability], systems: [], roles: [], screens: [], workflows: [], integrations: [], controls: [], documents: [], tenants: [], backlog: [], operationsReadiness,
});

test('the shipped operations record is valid, explicit, and not ready', async () => {
  const registry = await loadRegistry();
  assert.deepEqual(validateOperationsReadiness(registry, new Date('2026-10-16T00:00:00Z')), []);
  assert.equal(registry.operationsReadiness?.[0]?.status, 'not_ready');
  assert.equal(registry.operationsReadiness?.[0]?.required.every(({ status }) => status === 'not_verified'), true);
});

test('current operated proof and a complete roster derive ready', () => {
  assert.deepEqual(validateOperationsReadiness(snapshot(), new Date('2026-10-16T00:00:00Z')), []);
});

test('expired proof fails closed and cannot be hand-marked ready', () => {
  const stale = record({ required: proofs({ expires_at: '2020-01-01T00:00:00Z' }) });
  const codes = validateOperationsReadiness(snapshot([stale]), new Date('2026-10-16T00:00:00Z')).map(({ code }) => code);
  assert.equal(codes.filter((code) => code === 'operations_evidence_stale').length, 4);
  assert.ok(codes.includes('operations_status_mismatch'));
});

test('a repository runbook cannot substitute for missing roster fields', () => {
  const incomplete = record({ roster: { primary_owner: 'primary', backup_owner: null, support_hours: null, escalation_contacts_published: false } });
  assert.deepEqual(validateOperationsReadiness(snapshot([incomplete])).map(({ code }) => code), ['operations_status_mismatch']);
});

test('required proof cannot drift or cite paths outside the repository', () => {
  const drift = record({ required: [{ ...proofs()[0]!, id: 'invented', evidence: ['/tmp/proof'] }, ...proofs().slice(1)] });
  const codes = validateOperationsReadiness(snapshot([drift])).map(({ code }) => code);
  assert.ok(codes.includes('operations_evidence_drift'));
  assert.ok(codes.includes('operations_evidence_path_invalid'));
});

test('a generic repository file cannot masquerade as operated evidence', () => {
  const generic = record({ required: proofs({ evidence: ['packages/platform-control/README.md'] }) });
  const codes = validateOperationsReadiness(snapshot([generic]), new Date('2026-10-16T00:00:00Z')).map(({ code }) => code);
  assert.equal(codes.filter((code) => code === 'operations_evidence_scope_invalid').length, 4);
  assert.ok(codes.includes('operations_status_mismatch'));
});

test('passed proof is bound to an observed target and exact revision', () => {
  const unbound = record({ required: proofs({ observed_at: '2999-01-02T00:00:00Z', environment: 'ci', revision: 'main' }) });
  const codes = validateOperationsReadiness(snapshot([unbound]), new Date('2026-10-16T00:00:00Z')).map(({ code }) => code);
  assert.equal(codes.filter((code) => code === 'operations_observation_invalid').length, 4);
  assert.equal(codes.filter((code) => code === 'operations_environment_invalid').length, 4);
  assert.equal(codes.filter((code) => code === 'operations_revision_invalid').length, 4);
  assert.ok(codes.includes('operations_status_mismatch'));
});

test('release stays closed when support and recovery operations are unready', async () => {
  const registry = await loadRegistry();
  const decision = validateRelease(registry);
  assert.equal(decision.allowed, false);
  assert.ok(decision.issues.some(({ code }) => code === 'support_recovery_not_ready'));
});

test('missing and malformed operations records are reported rather than thrown', () => {
  assert.deepEqual(validateOperationsReadiness(snapshot([])).map(({ code }) => code), ['operations_readiness_missing']);
  const malformed = { key: 'bad', capability: 'registration.readiness', required: null } as unknown as OperationsReadinessRecord;
  assert.deepEqual(validateOperationsReadiness(snapshot([malformed])).map(({ code }) => code), ['malformed_operations_readiness']);
});
