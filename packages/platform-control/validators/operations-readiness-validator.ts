import { GATE_ITEM_STATUSES, type OperationsReadinessRecord, type RegistrySnapshot, type ValidationIssue } from '../types.ts';
import { isRepositoryPath } from './activation-gate-validator.ts';

export const REQUIRED_OPERATIONS_EVIDENCE = [
  'support.escalation_roster',
  'monitoring.synthetic_checks',
  'recovery.restore_drill',
  'recovery.incident_exercise',
] as const;

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
      const expiry = typeof item.expires_at === 'string' ? new Date(item.expires_at) : null;
      const current = item.status === 'passed' && Array.isArray(evidence) && evidence.length > 0
        && expiry !== null && !Number.isNaN(expiry.valueOf()) && expiry > now;
      if (item.status === 'passed' && !current) issues.push({ code: 'operations_evidence_stale', path: `${itemPath}.expires_at`, message: 'Passed operated evidence must have a valid future expiry.' });
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
