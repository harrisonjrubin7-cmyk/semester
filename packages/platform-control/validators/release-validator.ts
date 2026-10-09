import type { RegistrySnapshot, ValidationIssue } from '../types.ts';

export interface ReleaseDecision { allowed: boolean; issues: ValidationIssue[]; blockedCapabilities: string[] }

export function validateRelease(snapshot: RegistrySnapshot): ReleaseDecision {
  const blockedCapabilities = snapshot.capabilities.filter(({ maturity }) => !maturity.production_ready).map(({ key }) => key);
  const issues = blockedCapabilities.map((key) => ({
    code: 'capability_not_production_ready',
    path: `capabilities.${key}.maturity.production_ready`,
    message: `${key} lacks production-ready evidence.`,
  }));
  return { allowed: issues.length === 0, issues, blockedCapabilities };
}
