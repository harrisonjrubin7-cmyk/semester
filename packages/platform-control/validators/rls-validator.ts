import type { RegistrySnapshot, ValidationIssue } from '../types.ts';

export function validateRlsCoverage(snapshot: RegistrySnapshot): ValidationIssue[] {
  const protectedCapabilities = snapshot.capabilities.filter(({ data_classification }) => data_classification === 'confidential' || data_classification === 'restricted');
  const isolationControl = snapshot.controls.find(({ key }) => key === 'control.tenant-isolation');
  if (protectedCapabilities.length === 0) return [];
  if (!isolationControl || isolationControl.status !== 'implemented' || isolationControl.evidence.length < 2) {
    return [{ code: 'missing_tenant_isolation_control', path: 'controls.control.tenant-isolation', message: 'Confidential or restricted capabilities require implemented tenant-isolation evidence.' }];
  }
  return [];
}
