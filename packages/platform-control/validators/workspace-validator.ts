import type { RegistrySnapshot, ValidationIssue, WorkspaceRecord } from '../types.ts';

export const WORKSPACE_FAMILIES = [
  'public-web', 'student-os', 'faculty-os', 'advisor-os', 'registrar-os', 'finance-os',
  'student-affairs-os', 'institution-console', 'company-os', 'operations-os',
  'external-portals', 'developer-portal', 'community-marketplace',
] as const;

export const PILOT_RELEASE_SCOPES = [
  'public-web', 'student-os', 'faculty-os', 'advisor-os', 'registrar-os', 'finance-os',
  'student-affairs-os', 'institution-console', 'company-os', 'operations-os',
  'applicant-portal', 'guardian-portal', 'alumni-portal', 'employer-portal', 'partner-portal',
  'developer-portal', 'community-marketplace',
] as const;

export const SCOPE_FAMILY: Readonly<Record<(typeof PILOT_RELEASE_SCOPES)[number], (typeof WORKSPACE_FAMILIES)[number]>> = {
  'public-web': 'public-web', 'student-os': 'student-os', 'faculty-os': 'faculty-os', 'advisor-os': 'advisor-os',
  'registrar-os': 'registrar-os', 'finance-os': 'finance-os', 'student-affairs-os': 'student-affairs-os',
  'institution-console': 'institution-console', 'company-os': 'company-os', 'operations-os': 'operations-os',
  'applicant-portal': 'external-portals', 'guardian-portal': 'external-portals', 'alumni-portal': 'external-portals',
  'employer-portal': 'external-portals', 'partner-portal': 'external-portals', 'developer-portal': 'developer-portal',
  'community-marketplace': 'community-marketplace',
};

const REF_GROUPS = ['routes', 'capabilities', 'workflows', 'code', 'tests', 'deployments', 'activations'] as const;
const LOOP_FIELDS = ['actor', 'record', 'action', 'consequence_preview', 'command', 'event', 'receipt', 'support', 'revoke_or_rollback'] as const;

function compareOrdinal(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function duplicates(values: string[]): string[] {
  const seen = new Set<string>();
  const repeated = new Set<string>();
  for (const value of values) (seen.has(value) ? repeated : seen).add(value);
  return [...repeated].sort(compareOrdinal);
}

function sameMembers(actual: string[], expected: readonly string[]): boolean {
  return actual.length === expected.length
    && [...actual].sort(compareOrdinal).every((value, index) => value === [...expected].sort(compareOrdinal)[index]);
}

function object(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function strings(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === 'string');
}

function validateWorkspace(record: WorkspaceRecord): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  if (!object(record)) return [{ code: 'invalid_workspace_record', path: 'workspaces', message: 'Workspace record must be an object.' }];
  const key = typeof record.key === 'string' ? record.key : '<invalid>';
  const path = `workspaces.${key}`;
  if (key === '<invalid>') issues.push({ code: 'invalid_workspace_shape', path: `${path}.key`, message: 'key must be a string.' });
  if (!WORKSPACE_FAMILIES.includes(record.family as typeof WORKSPACE_FAMILIES[number])) {
    issues.push({ code: 'unknown_workspace_family', path: `${path}.family`, message: `Unknown workspace family ${record.family}.` });
  }
  const expectedFamily = SCOPE_FAMILY[key as keyof typeof SCOPE_FAMILY];
  if (expectedFamily && record.family !== expectedFamily) {
    issues.push({ code: 'workspace_family_mismatch', path: `${path}.family`, message: `${key} belongs to ${expectedFamily}, not ${record.family}.` });
  }
  for (const field of ['audience', 'owner', 'data_classification', 'support_queue'] as const) {
    if (typeof record[field] !== 'string' || !record[field].trim()) issues.push({ code: 'missing_workspace_owner_context', path: `${path}.${field}`, message: `${field} is required.` });
  }
  if (!object(record.required_loop)) {
    issues.push({ code: 'invalid_workspace_shape', path: `${path}.required_loop`, message: 'required_loop must be an object.' });
  } else {
    for (const field of LOOP_FIELDS) {
      if (typeof record.required_loop[field] !== 'string' || !record.required_loop[field].trim()) issues.push({ code: 'incomplete_operational_loop', path: `${path}.required_loop.${field}`, message: `${field} is required.` });
    }
  }
  if (!record.pilot_required) issues.push({ code: 'pilot_scope_omission', path: `${path}.pilot_required`, message: 'Every declared pilot release scope is required.' });
  if (record.status === 'verified' && !record.operational_ready) {
    issues.push({ code: 'verified_without_operational_loop', path: `${path}.status`, message: 'A verified workspace must be operationally ready.' });
  }
  if (!object(record.refs) || REF_GROUPS.some((group) => !strings(record.refs[group]))) {
    issues.push({ code: 'invalid_workspace_shape', path: `${path}.refs`, message: 'Every evidence reference group must be a string array.' });
  }
  if (!strings(record.gaps)) issues.push({ code: 'invalid_workspace_shape', path: `${path}.gaps`, message: 'gaps must be a string array.' });
  if (record.operational_ready) {
    // Schema version one records scope and honest gaps only. It deliberately cannot certify readiness
    // until scoped evidence records (with artifact identity, environment, review, and expiry) exist.
    issues.push({ code: 'unsupported_operational_claim', path: `${path}.operational_ready`, message: 'This registry version cannot certify operational readiness.' });
    if (object(record.refs)) for (const group of REF_GROUPS.filter((group) => group !== 'activations')) {
      if (!strings(record.refs[group]) || record.refs[group].length === 0) issues.push({ code: 'missing_operational_evidence', path: `${path}.refs.${group}`, message: `Operational readiness requires ${group} evidence.` });
    }
    if (strings(record.gaps) && record.gaps.length > 0) issues.push({ code: 'ready_with_open_gaps', path: `${path}.gaps`, message: 'Operational readiness cannot have open gaps.' });
  } else if (strings(record.gaps) && record.gaps.length === 0) {
    issues.push({ code: 'unready_without_gap', path: `${path}.gaps`, message: 'An unready workspace must name its blocking gaps.' });
  }
  if (record.activation !== 'disabled') {
    issues.push({ code: 'unsupported_activation_claim', path: `${path}.activation`, message: 'This registry version cannot certify an approved or active scope.' });
    if (!record.operational_ready) issues.push({ code: 'activation_without_readiness', path: `${path}.activation`, message: 'Activation requires operational readiness.' });
    if (!object(record.refs) || !strings(record.refs.activations) || record.refs.activations.length === 0) issues.push({ code: 'activation_without_evidence', path: `${path}.refs.activations`, message: 'Activation requires scoped approval evidence.' });
    if (!object(record.refs) || !strings(record.refs.deployments) || record.refs.deployments.length === 0) issues.push({ code: 'activation_without_deployment', path: `${path}.refs.deployments`, message: 'Activation requires deployment evidence.' });
  }
  return issues;
}

export function validateWorkspaceRegistry(snapshot: RegistrySnapshot): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const manifests = snapshot.manifests ?? [];
  const workspaces = snapshot.workspaces ?? [];
  if (manifests.length !== 1) {
    issues.push({ code: 'invalid_manifest_count', path: 'manifests', message: 'Exactly one root Semester manifest is required.' });
  }
  const manifest = manifests[0];
  if (manifests.length === 1 && !object(manifest)) {
    issues.push({ code: 'invalid_manifest_shape', path: 'manifests.semester', message: 'Root manifest must be an object.' });
  } else if (manifest && object(manifest)) {
    if (manifest.canonical_domain !== 'semesterintel.tech') issues.push({ code: 'invalid_canonical_domain', path: 'manifests.semester.canonical_domain', message: 'Canonical domain must be semesterintel.tech.' });
    if (!strings(manifest.workspace_families) || !sameMembers(manifest.workspace_families, WORKSPACE_FAMILIES)) issues.push({ code: 'workspace_family_drift', path: 'manifests.semester.workspace_families', message: 'Manifest must contain the canonical 13 grouped workspace families.' });
    if (!strings(manifest.pilot_release_scopes) || !sameMembers(manifest.pilot_release_scopes, PILOT_RELEASE_SCOPES)) issues.push({ code: 'pilot_scope_drift', path: 'manifests.semester.pilot_release_scopes', message: 'Manifest must contain the canonical 17 pilot release scopes.' });
  }
  const keys = workspaces.map((record) => object(record) && typeof record.key === 'string' ? record.key : '<invalid>');
  for (const key of duplicates(keys)) issues.push({ code: 'duplicate_workspace', path: `workspaces.${key}`, message: `Duplicate workspace ${key}.` });
  if (!sameMembers(keys, PILOT_RELEASE_SCOPES)) issues.push({ code: 'workspace_roster_drift', path: 'workspaces', message: 'Workspace records must cover all 17 pilot release scopes exactly once.' });
  const coveredFamilies = new Set(workspaces.map((record) => object(record) && typeof record.family === 'string' ? record.family : '<invalid>'));
  for (const family of WORKSPACE_FAMILIES) if (!coveredFamilies.has(family)) issues.push({ code: 'uncovered_workspace_family', path: `workspaces.${family}`, message: `No release scope covers ${family}.` });
  for (const record of [...workspaces].sort((left, right) => compareOrdinal(object(left) && typeof left.key === 'string' ? left.key : '', object(right) && typeof right.key === 'string' ? right.key : ''))) issues.push(...validateWorkspace(record));
  return issues;
}
