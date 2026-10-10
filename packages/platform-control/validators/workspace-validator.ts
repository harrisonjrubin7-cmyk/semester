import { createHash } from 'node:crypto';
import type { RegistrySnapshot, ValidationIssue, WorkspaceEvidenceEnvelope, WorkspaceEvidenceRefs, WorkspaceRecord } from '../types.ts';

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
const EVIDENCE_BINDING_FIELDS = ['schema', 'config', 'policy', 'environment', 'tenant'] as const;
const ACCEPTANCE_CASE_IDS = ['XA-01', 'XA-02', 'XA-03', 'XA-04', 'XA-05', 'XA-06', 'XA-07', 'XA-08'] as const;
const COMPLETION_GATE_IDS = Array.from({ length: 18 }, (_, index) => `FC-${String(index + 1).padStart(2, '0')}`);
const ACCEPTANCE_CASE_SCOPES: Record<string, readonly string[]> = {
  'XA-01': ['public-web', 'applicant-portal', 'institution-console'],
  'XA-02': ['student-os', 'advisor-os'],
  'XA-03': ['faculty-os', 'student-os'],
  'XA-04': ['student-os', 'registrar-os', 'finance-os'],
  'XA-05': ['student-affairs-os', 'guardian-portal'],
  'XA-06': ['institution-console', 'company-os', 'operations-os'],
  'XA-07': ['developer-portal', 'partner-portal', 'employer-portal'],
  'XA-08': ['alumni-portal', 'community-marketplace', 'public-web'],
};

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

function validDate(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0 && Number.isFinite(Date.parse(value));
}

function validateAcceptanceCases(snapshot: RegistrySnapshot): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const capabilityKeys = new Set(snapshot.capabilities.map(({ key }) => key));
  const systemKeys = new Set(snapshot.systems.map(({ key }) => key));
  const routes = new Map(snapshot.screens.map((screen) => [screen.key, screen]));
  const manifest = snapshot.manifests?.[0];
  if (!manifest || !object(manifest)) return issues;
  if (!strings(manifest.acceptance_gate_ids) || !sameMembers(manifest.acceptance_gate_ids, COMPLETION_GATE_IDS)) {
    issues.push({ code: 'completion_gate_drift', path: 'manifests.semester.acceptance_gate_ids', message: 'Acceptance uses FC-01 through FC-18 exactly once.' });
  }
  if (!Array.isArray(manifest.acceptance_cases)) {
    issues.push({ code: 'invalid_acceptance_registry', path: 'manifests.semester.acceptance_cases', message: 'Acceptance cases must be an array.' });
    return issues;
  }
  const ids = manifest.acceptance_cases.map((entry) => object(entry) && typeof entry.id === 'string' ? entry.id : '<invalid>');
  if (!sameMembers(ids, ACCEPTANCE_CASE_IDS)) issues.push({ code: 'acceptance_case_roster_drift', path: 'manifests.semester.acceptance_cases', message: 'Exactly XA-01 through XA-08 must be registered.' });
  for (const entry of manifest.acceptance_cases) {
    if (!object(entry)) continue;
    const id = typeof entry.id === 'string' ? entry.id : '<invalid>';
    const path = `manifests.semester.acceptance_cases.${id}`;
    if (!strings(entry.scopes) || entry.scopes.length < 2 || entry.scopes.some((scope) => !PILOT_RELEASE_SCOPES.includes(scope as typeof PILOT_RELEASE_SCOPES[number]))) {
      issues.push({ code: 'invalid_acceptance_scope', path: `${path}.scopes`, message: 'A cross-workspace case must name at least two canonical release scopes.' });
    }
    const expectedScopes = ACCEPTANCE_CASE_SCOPES[id];
    if (expectedScopes && (!strings(entry.scopes) || !sameMembers(entry.scopes, expectedScopes))) issues.push({ code: 'acceptance_case_scope_drift', path: `${path}.scopes`, message: `${id} must retain its canonical cross-workspace scope.` });
    if (!Array.isArray(entry.controls) || !entry.controls.some((control) => object(control) && control.polarity === 'positive') || !entry.controls.some((control) => object(control) && control.polarity === 'negative')) {
      issues.push({ code: 'missing_acceptance_control', path: `${path}.controls`, message: 'Every case requires positive and negative controls.' });
    }
    if (strings(entry.capability_keys)) for (const key of entry.capability_keys) if (!capabilityKeys.has(key)) issues.push({ code: 'unknown_acceptance_capability', path: `${path}.capability_keys`, message: `${key} is not a registered capability authority.` });
    if (strings(entry.system_keys)) for (const key of entry.system_keys) if (!systemKeys.has(key)) issues.push({ code: 'unknown_acceptance_system', path: `${path}.system_keys`, message: `${key} is not a registered system authority.` });
    if (strings(entry.route_ids)) for (const key of entry.route_ids) {
      const route = routes.get(key);
      if (!route) issues.push({ code: 'unknown_acceptance_route', path: `${path}.route_ids`, message: `${key} is not a registered route authority.` });
      else if (typeof route.route !== 'string' || !route.route.startsWith('semesterintel.tech/')) issues.push({ code: 'noncanonical_acceptance_route', path: `${path}.route_ids`, message: `${key} does not map to the canonical live host.` });
    }
    if (entry.status === 'passed') {
      const controls = Array.isArray(entry.controls) ? entry.controls : [];
      if (controls.length === 0 || controls.some((control) => !object(control) || control.status !== 'passed' || !strings(control.evidence_refs) || control.evidence_refs.length === 0)) {
        issues.push({ code: 'unproven_acceptance_pass', path: `${path}.status`, message: 'A passed case requires passed positive and negative controls with evidence.' });
      }
      if (!strings(entry.gaps) || entry.gaps.length > 0) issues.push({ code: 'acceptance_pass_with_gap', path: `${path}.gaps`, message: 'A passed case cannot retain gaps.' });
    }
  }
  return issues;
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
  if (record.evidence_envelopes !== undefined && !Array.isArray(record.evidence_envelopes)) issues.push({ code: 'invalid_workspace_shape', path: `${path}.evidence_envelopes`, message: 'evidence_envelopes must be an array when present.' });
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
  issues.push(...validateAcceptanceCases(snapshot));
  return issues;
}

export interface WorkspaceEvidenceValidationContext {
  targetRevision: string;
  targetTenant?: string;
  targetEnvironment?: 'staging' | 'production';
  targetSchema?: string;
  targetConfig?: string;
  targetPolicy?: string;
  now: string;
  readArtifact: (revision: string, path: string, evidenceId: string) => Promise<string | Uint8Array | null>;
}

const evidenceGroupKind = { code: 'source', tests: 'test', deployments: 'operating', activations: 'operating' } as const;

export async function validateWorkspaceEvidence(snapshot: RegistrySnapshot, context: WorkspaceEvidenceValidationContext): Promise<ValidationIssue[]> {
  const issues: ValidationIssue[] = [];
  const screens = new Map(snapshot.screens.map((screen) => [screen.key, screen]));
  const capabilityKeys = new Set(snapshot.capabilities.map(({ key }) => key));
  const workflowKeys = new Set(snapshot.workflows.map(({ key }) => key));
  const allEvidenceIds = new Set<string>();
  const validEvidenceIds = new Set<string>();
  const validEvidenceById = new Map<string, WorkspaceEvidenceEnvelope>();
  const now = Date.parse(context.now);
  for (const rawRecord of snapshot.workspaces ?? []) {
    if (!object(rawRecord)) { issues.push({ code: 'invalid_workspace_record', path: 'workspaces', message: 'Workspace record must be an object.' }); continue; }
    const record = rawRecord as unknown as WorkspaceRecord;
    const root = `workspaces.${record.key}`;
    const envelopes = Array.isArray(record.evidence_envelopes) ? record.evidence_envelopes : [];
    const refs = object(record.refs) && REF_GROUPS.every((group) => strings(record.refs[group])) ? record.refs as unknown as WorkspaceEvidenceRefs : null;
    if (!refs) issues.push({ code: 'invalid_workspace_evidence_refs', path: `${root}.refs`, message: 'Workspace evidence refs must contain string arrays.' });
    const byId = new Map<string, WorkspaceEvidenceEnvelope>();
    const validIds = new Set<string>();
    for (let index = 0; index < envelopes.length; index += 1) {
      const rawEvidence: unknown = envelopes[index];
      if (!object(rawEvidence)) { issues.push({ code: 'invalid_evidence_envelope', path: `${root}.evidence_envelopes.${index}`, message: 'Evidence envelope must be an object.' }); continue; }
      const evidence = rawEvidence as unknown as WorkspaceEvidenceEnvelope;
      const path = `${root}.evidence_envelopes.${evidence.id || index}`;
      let valid = true;
      if (!evidence.id || byId.has(evidence.id) || allEvidenceIds.has(evidence.id)) { issues.push({ code: 'duplicate_evidence_id', path: `${path}.id`, message: 'Evidence ids must be non-empty and globally unique.' }); valid = false; }
      else { byId.set(evidence.id, evidence); allEvidenceIds.add(evidence.id); }
      if (evidence.scope !== record.key) { issues.push({ code: 'evidence_scope_mismatch', path: `${path}.scope`, message: `Evidence is bound to ${evidence.scope}, not ${record.key}.` }); valid = false; }
      if (!/^[0-9a-f]{40}$/i.test(evidence.revision) || evidence.revision !== context.targetRevision) { issues.push({ code: 'evidence_revision_mismatch', path: `${path}.revision`, message: 'Evidence revision does not match the release target.' }); valid = false; }
      if (!object(evidence.artifact) || typeof evidence.artifact.path !== 'string' || !evidence.artifact.path.trim() || !/^[0-9a-f]{64}$/i.test(evidence.artifact.sha256)) {
        issues.push({ code: 'invalid_evidence_artifact', path: `${path}.artifact`, message: 'Evidence requires a repository-relative path and SHA-256.' }); valid = false;
      }
      if (!object(evidence.bindings) || EVIDENCE_BINDING_FIELDS.some((field) => typeof evidence.bindings[field] !== 'string' || !evidence.bindings[field].trim())) {
        issues.push({ code: 'missing_evidence_binding', path: `${path}.bindings`, message: 'Evidence must bind schema, config, policy, environment, and tenant.' }); valid = false;
      } else {
        const environments: Record<string, string[]> = { source: ['repository'], test: ['ci', 'staging'], operating: ['staging', 'production'] };
        if (!environments[evidence.kind]?.includes(evidence.bindings.environment)) { issues.push({ code: 'evidence_environment_mismatch', path: `${path}.bindings.environment`, message: `${evidence.kind} evidence cannot use ${evidence.bindings.environment}.` }); valid = false; }
        if (!context.targetTenant) { issues.push({ code: 'missing_release_evidence_context', path: `${path}.bindings.tenant`, message: 'Evidence validation requires an explicit target tenant.' }); valid = false; }
        else if (evidence.bindings.tenant !== context.targetTenant) { issues.push({ code: 'evidence_tenant_mismatch', path: `${path}.bindings.tenant`, message: 'Evidence tenant does not match the release target.' }); valid = false; }
        if (evidence.bindings.schema !== (context.targetSchema ?? 'workspace-evidence/v1') || evidence.bindings.config !== (context.targetConfig ?? 'source-tree') || evidence.bindings.policy !== (context.targetPolicy ?? 'platform-control')) { issues.push({ code: 'evidence_binding_mismatch', path: `${path}.bindings`, message: 'Evidence schema, config, or policy does not match the release target.' }); valid = false; }
        if (evidence.kind === 'operating' && (!context.targetTenant || !context.targetEnvironment)) { issues.push({ code: 'missing_release_evidence_context', path: `${path}.bindings`, message: 'Operating evidence requires an explicit target tenant and release environment.' }); valid = false; }
        if (evidence.kind === 'operating' && context.targetEnvironment && evidence.bindings.environment !== context.targetEnvironment) { issues.push({ code: 'evidence_environment_mismatch', path: `${path}.bindings.environment`, message: 'Operating evidence environment does not match the release target.' }); valid = false; }
      }
      if (!object(evidence.producer) || typeof evidence.producer.name !== 'string' || !evidence.producer.name.trim() || typeof evidence.producer.run_id !== 'string' || !evidence.producer.run_id.trim() || !validDate(evidence.producer.started_at) || !validDate(evidence.producer.completed_at)) {
        issues.push({ code: 'missing_evidence_producer', path: `${path}.producer`, message: 'Evidence requires a named producer, run id, and run timestamps.' }); valid = false;
      } else if (Date.parse(evidence.producer.started_at) > Date.parse(evidence.producer.completed_at) || Date.parse(evidence.producer.completed_at) > now) {
        issues.push({ code: 'future_evidence', path: `${path}.producer.completed_at`, message: 'Evidence run timestamps must be ordered and cannot be in the future.' }); valid = false;
      }
      if (evidence.observed_outcome !== 'passed') { issues.push({ code: 'evidence_outcome_not_passed', path: `${path}.observed_outcome`, message: 'Failed or blocked observations cannot satisfy a gate.' }); valid = false; }
      if (!object(evidence.reviewer) || typeof evidence.reviewer.name !== 'string' || !evidence.reviewer.name.trim() || !validDate(evidence.reviewer.reviewed_at)) {
        issues.push({ code: 'missing_evidence_reviewer', path: `${path}.reviewer`, message: 'Gate evidence requires a named reviewer and review time.' }); valid = false;
      } else if (Date.parse(evidence.reviewer.reviewed_at) > now) {
        issues.push({ code: 'future_evidence', path: `${path}.reviewer.reviewed_at`, message: 'Evidence review cannot be in the future.' }); valid = false;
      }
      if (evidence.expires_at !== undefined && (!validDate(evidence.expires_at) || Date.parse(evidence.expires_at) <= now)) { issues.push({ code: 'expired_evidence', path: `${path}.expires_at`, message: 'Evidence is expired or has an invalid expiry.' }); valid = false; }
      if (evidence.kind === 'operating' && evidence.expires_at === undefined) { issues.push({ code: 'missing_evidence_expiry', path: `${path}.expires_at`, message: 'Operating evidence requires an expiry.' }); valid = false; }
      if (object(evidence.artifact) && typeof evidence.artifact.path === 'string' && typeof evidence.artifact.sha256 === 'string') {
        const artifact = await context.readArtifact(evidence.revision, evidence.artifact.path, evidence.id);
        if (artifact === null || artifact.length === 0) { issues.push({ code: 'empty_evidence_artifact', path: `${path}.artifact.path`, message: 'Evidence artifact is absent or empty at the named revision.' }); valid = false; }
        else {
          const digest = createHash('sha256').update(artifact).digest('hex');
          if (digest !== evidence.artifact.sha256.toLowerCase()) { issues.push({ code: 'evidence_hash_mismatch', path: `${path}.artifact.sha256`, message: 'Artifact bytes do not match the bound SHA-256.' }); valid = false; }
        }
      }
      if (valid) { validIds.add(evidence.id); validEvidenceIds.add(evidence.id); validEvidenceById.set(evidence.id, evidence); }
    }
    for (const group of Object.keys(evidenceGroupKind) as Array<keyof typeof evidenceGroupKind>) for (let index = 0; index < (refs?.[group].length ?? 0); index += 1) {
      const id = refs![group][index]!;
      const evidence = byId.get(id);
      if (!evidence) issues.push({ code: 'missing_evidence_envelope', path: `${root}.refs.${group}.${index}`, message: `${id} is not a registered evidence envelope.` });
      else if (evidence.kind !== evidenceGroupKind[group]) issues.push({ code: 'evidence_kind_mismatch', path: `${root}.refs.${group}.${index}`, message: `${group} requires ${evidenceGroupKind[group]} evidence.` });
      else if (!validIds.has(id)) issues.push({ code: 'invalid_gate_evidence', path: `${root}.refs.${group}.${index}`, message: `${id} failed evidence validation.` });
    }
    for (let index = 0; index < (refs?.routes.length ?? 0); index += 1) {
      const id = refs!.routes[index]!;
      const screen = screens.get(id);
      if (!screen) issues.push({ code: 'unknown_route_authority', path: `${root}.refs.routes.${index}`, message: `${id} is not a registered route id.` });
      else if (typeof screen.route !== 'string' || !screen.route.startsWith('semesterintel.tech/')) issues.push({ code: 'noncanonical_live_route', path: `${root}.refs.routes.${index}`, message: `${id} does not map to the canonical live host.` });
    }
    for (let index = 0; index < (refs?.capabilities.length ?? 0); index += 1) if (!capabilityKeys.has(refs!.capabilities[index]!)) issues.push({ code: 'unknown_capability_authority', path: `${root}.refs.capabilities.${index}`, message: 'Capability authority is not registered.' });
    for (let index = 0; index < (refs?.workflows.length ?? 0); index += 1) if (!workflowKeys.has(refs!.workflows[index]!)) issues.push({ code: 'unknown_workflow_authority', path: `${root}.refs.workflows.${index}`, message: 'Workflow authority is not registered.' });
  }
  for (const rawEntry of snapshot.manifests?.[0]?.acceptance_cases ?? []) {
    if (!object(rawEntry) || rawEntry.status !== 'passed' || !Array.isArray(rawEntry.controls) || !strings(rawEntry.scopes)) continue;
    for (const [index, rawControl] of rawEntry.controls.entries()) {
      if (!object(rawControl)) { issues.push({ code: 'invalid_acceptance_evidence', path: `manifests.semester.acceptance_cases.${rawEntry.id}.controls.${index}`, message: 'Acceptance control must be an object.' }); continue; }
      const evidenceRefs = strings(rawControl.evidence_refs) ? rawControl.evidence_refs : [];
      const evidence = evidenceRefs.map((id) => validEvidenceById.get(id));
      const coveredScopes = new Set(evidence.filter((value): value is WorkspaceEvidenceEnvelope => value !== undefined).map(({ scope }) => scope));
      const semanticMismatch = evidence.some((value) => !value || value.kind === 'source' || value.acceptance_case_id !== rawEntry.id || value.acceptance_control !== rawControl.polarity || !rawEntry.scopes.includes(value.scope));
      if (rawControl.status !== 'passed' || evidenceRefs.length === 0 || evidenceRefs.some((id) => !validEvidenceIds.has(id)) || semanticMismatch || rawEntry.scopes.some((scope) => !coveredScopes.has(scope))) {
        issues.push({ code: 'invalid_acceptance_evidence', path: `manifests.semester.acceptance_cases.${rawEntry.id}.controls.${index}`, message: 'Passed controls require validated test or operating evidence bound to this case, polarity, tenant, and every scenario scope.' });
      }
    }
  }
  return issues;
}
