import type { RegistrySnapshot, ValidationIssue } from '../types.ts';

export interface ReleaseDecision { allowed: boolean; issues: ValidationIssue[]; blockedCapabilities: string[] }

export function validateRelease(snapshot: RegistrySnapshot): ReleaseDecision {
  const blockedCapabilities = snapshot.capabilities.filter(({ maturity }) => !maturity.production_ready).map(({ key }) => key);
  const issues: ValidationIssue[] = blockedCapabilities.map((key) => ({
    code: 'capability_not_production_ready',
    path: `capabilities.${key}.maturity.production_ready`,
    message: `${key} lacks production-ready evidence.`,
  }));
  for (const capability of snapshot.capabilities) {
    const operations = snapshot.operationsReadiness?.find((record) => record?.capability === capability.key);
    if (!operations || operations.status !== 'ready') {
      issues.push({
        code: 'support_recovery_not_ready', path: `operationsReadiness.${capability.key}`,
        message: `${capability.key} lacks current support roster, synthetic-check, restore-drill, and incident-exercise evidence.`,
      });
    }
  }
  return { allowed: issues.length === 0, issues, blockedCapabilities };
}
