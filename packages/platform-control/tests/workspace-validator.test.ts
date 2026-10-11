import assert from 'node:assert/strict';
import test from 'node:test';
import type { PlatformManifest, RegistrySnapshot, WorkspaceRecord } from '../types.ts';
import { PILOT_RELEASE_SCOPES, WORKSPACE_FAMILIES, validateWorkspaceRegistry } from '../validators/workspace-validator.ts';

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
  ...changes,
});
const manifest: PlatformManifest = {
  key: 'semester', name: 'Semester ecosystem', owner: 'platform-governance', status: 'implemented', evidence: ['packages/platform-control/README.md'],
  canonical_domain: 'semesterintel.tech', workspace_families: [...WORKSPACE_FAMILIES], pilot_release_scopes: [...PILOT_RELEASE_SCOPES],
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
