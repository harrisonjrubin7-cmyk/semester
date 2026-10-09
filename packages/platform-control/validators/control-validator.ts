import type { RegistryRecord, RegistrySnapshot, ValidationIssue } from '../types.ts';

export function validateRegistryRecords(snapshot: RegistrySnapshot): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const groups: Array<[string, RegistryRecord[]]> = [
    ['systems', snapshot.systems], ['roles', snapshot.roles], ['screens', snapshot.screens],
    ['integrations', snapshot.integrations], ['controls', snapshot.controls], ['documents', snapshot.documents], ['tenants', snapshot.tenants],
  ];
  for (const [group, records] of groups) {
    const seen = new Set<string>();
    for (const record of records) {
      const path = `${group}.${record.key}`;
      if (seen.has(record.key)) issues.push({ code: 'duplicate_key', path, message: `${record.key} is duplicated in ${group}.` });
      if (!record.owner.trim()) issues.push({ code: 'missing_owner', path, message: 'Registry record requires an owner.' });
      if (record.evidence.length === 0) issues.push({ code: 'missing_evidence', path, message: 'Registry record requires at least one evidence path.' });
      seen.add(record.key);
    }
  }
  return issues;
}
