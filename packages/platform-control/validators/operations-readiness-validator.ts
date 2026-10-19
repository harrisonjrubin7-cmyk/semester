import { GATE_ITEM_STATUSES, type OperationsReadinessRecord, type RegistrySnapshot, type ValidationIssue } from '../types.ts';
import { isRepositoryPath } from './activation-gate-validator.ts';

export const REQUIRED_OPERATIONS_EVIDENCE = [
  'support.escalation_roster',
  'monitoring.synthetic_checks',
  'recovery.restore_drill',
  'recovery.incident_exercise',
] as const;

const OPERATED_EVIDENCE_ROOTS: Record<(typeof REQUIRED_OPERATIONS_EVIDENCE)[number], string> = {
  'support.escalation_roster': 'docs/evidence/operations/',
  'monitoring.synthetic_checks': 'docs/evidence/operations/',
  'recovery.restore_drill': 'docs/evidence/restore/',
  'recovery.incident_exercise': 'docs/evidence/operations/',
};

const NON_OPERATED_ENVIRONMENTS = new Set(['ci', 'development', 'local', 'repository', 'repository-only', 'unknown']);

function completeRoster(record: OperationsReadinessRecord): boolean {
  const roster = record.roster;
  return typeof roster?.primary_owner === 'string' && roster.primary_owner.trim() !== ''
    && typeof roster.backup_owner === 'string' && roster.backup_owner.trim() !== ''
    && typeof roster.support_hours === 'string' && roster.support_hours.trim() !== ''
    && roster.escalation_contacts_published === true;
}

export function validateOperationsReadiness(snapshot: RegistrySnapshot, now = new Date()): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const records = snapshot.operationsReadiness ?? [];
  const capabilities = new Set(snapshot.capabilities.map(({ key }) => key));
  if (capabilities.has('registration.readiness') && !records.some((record) => record?.capability === 'registration.readiness')) {
    issues.push({ code: 'operations_readiness_missing', path: 'operationsReadiness', message: 'registration.readiness has no support and recovery evidence record.' });
  }

  const seen = new Set<string>();
  for (const record of records) {
    if (typeof record !== 'object' || record === null || !Array.isArray(record.required)) {
      issues.push({ code: 'malformed_operations_readiness', path: 'operationsReadiness', message: 'Each operations-readiness record must contain a required evidence list.' });
      continue;
    }
    const path = `operationsReadiness.${record.key}`;
    if (!capabilities.has(record.capability)) issues.push({ code: 'operations_unknown_capability', path: `${path}.capability`, message: `Unknown capability ${record.capability}.` });
    if (seen.has(record.capability)) issues.push({ code: 'duplicate_operations_readiness', path, message: `More than one operations record targets ${record.capability}.` });
    seen.add(record.capability);
    if (typeof record.owner !== 'string' || record.owner.trim() === '') issues.push({ code: 'operations_owner_missing', path: `${path}.owner`, message: 'Operations evidence requires an accountable owner.' });

    const ids = record.required.map((item) => item?.id);
    const missing = REQUIRED_OPERATIONS_EVIDENCE.filter((id) => !ids.includes(id));
    const extra = ids.filter((id) => !(REQUIRED_OPERATIONS_EVIDENCE as readonly unknown[]).includes(id));
    const duplicated = ids.filter((id, index) => ids.indexOf(id) !== index);
    if (missing.length || extra.length || duplicated.length) {
      issues.push({ code: 'operations_evidence_drift', path: `${path}.required`, message: `Required operations evidence drifted. Missing: [${missing.join(', ')}]. Unknown: [${extra.join(', ')}]. Duplicated: [${duplicated.join(', ')}].` });
    }

    let allCurrent = record.required.length === REQUIRED_OPERATIONS_EVIDENCE.length;
    for (const item of record.required) {
      if (typeof item !== 'object' || item === null) {
        issues.push({ code: 'malformed_operations_readiness', path: `${path}.required`, message: 'Operations evidence items must be objects.' });
        allCurrent = false;
        continue;
      }
      const itemPath = `${path}.required.${item.id}`;
      if (!(GATE_ITEM_STATUSES as readonly string[]).includes(item.status)) issues.push({ code: 'invalid_operations_status', path: `${itemPath}.status`, message: `Unknown status ${String(item.status)}.` });
      const evidence = item.evidence;
      if (!Array.isArray(evidence)) {
        issues.push({ code: 'malformed_operations_evidence', path: `${itemPath}.evidence`, message: 'Evidence must be a list of repository paths.' });
        allCurrent = false;
      } else {
        if (item.status === 'passed' && evidence.length === 0) issues.push({ code: 'operations_passed_without_evidence', path: itemPath, message: 'Passed operations proof must cite retained evidence.' });
        for (const reference of evidence) if (!isRepositoryPath(reference)) issues.push({ code: 'operations_evidence_path_invalid', path: `${itemPath}.evidence`, message: `Evidence must be repository-relative, not ${JSON.stringify(reference)}.` });
      }
      const expectedRoot = OPERATED_EVIDENCE_ROOTS[item.id as (typeof REQUIRED_OPERATIONS_EVIDENCE)[number]];
      const evidenceScoped = Array.isArray(evidence) && typeof expectedRoot === 'string'
        && evidence.some((reference) => typeof reference === 'string' && reference.startsWith(expectedRoot));
      if (item.status === 'passed' && !evidenceScoped) {
        issues.push({ code: 'operations_evidence_scope_invalid', path: `${itemPath}.evidence`, message: `Passed ${item.id} proof must retain an operated artifact under ${expectedRoot ?? 'its governed evidence area'}.` });
      }

      const observed = typeof item.observed_at === 'string' ? new Date(item.observed_at) : null;
      const observationValid = observed !== null && !Number.isNaN(observed.valueOf()) && observed <= now;
      if (item.status === 'passed' && !observationValid) {
        issues.push({ code: 'operations_observation_invalid', path: `${itemPath}.observed_at`, message: 'Passed operated evidence must record a valid observation time that is not in the future.' });
      }
      const environment = typeof item.environment === 'string' ? item.environment.trim() : '';
      const environmentValid = environment !== '' && !NON_OPERATED_ENVIRONMENTS.has(environment.toLowerCase());
      if (item.status === 'passed' && !environmentValid) {
        issues.push({ code: 'operations_environment_invalid', path: `${itemPath}.environment`, message: 'Passed operated evidence must name the target environment; local, CI, and repository-only proof do not qualify.' });
      }
      const revisionValid = typeof item.revision === 'string' && /^[a-f0-9]{40}$/i.test(item.revision);
      if (item.status === 'passed' && !revisionValid) {
        issues.push({ code: 'operations_revision_invalid', path: `${itemPath}.revision`, message: 'Passed operated evidence must name the exact 40-character revision that was exercised.' });
      }
      const expiry = typeof item.expires_at === 'string' ? new Date(item.expires_at) : null;
      const expiryValid = expiry !== null && !Number.isNaN(expiry.valueOf()) && expiry > now
        && observed !== null && !Number.isNaN(observed.valueOf()) && observed <= expiry;
      const current = item.status === 'passed' && Array.isArray(evidence) && evidence.length > 0
        && evidenceScoped && observationValid && environmentValid && revisionValid
        && expiryValid;
      if (item.status === 'passed' && !expiryValid) issues.push({ code: 'operations_evidence_stale', path: `${itemPath}.expires_at`, message: 'Passed operated evidence must expire in the future and not before it was observed.' });
      if (item.status !== 'passed' && (typeof item.gap !== 'string' || item.gap.trim() === '')) issues.push({ code: 'operations_gap_missing', path: `${itemPath}.gap`, message: 'Unverified or failed operations proof must state its gap.' });
      allCurrent = allCurrent && current;
    }

    const rosterReady = completeRoster(record);
    const expected = allCurrent && rosterReady && Array.isArray(record.gaps) && record.gaps.length === 0 ? 'ready' : 'not_ready';
    if (record.status !== expected) issues.push({ code: 'operations_status_mismatch', path: `${path}.status`, message: `Operations status must be ${expected} from current proof and roster completeness.` });
    if (record.status !== 'ready' && (!Array.isArray(record.gaps) || record.gaps.length === 0)) issues.push({ code: 'operations_record_gap_missing', path: `${path}.gaps`, message: 'A not-ready operations record must retain its open gaps.' });
  }
  return issues;
}
