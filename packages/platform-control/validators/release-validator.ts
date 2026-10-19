import type { RegistrySnapshot, ValidationIssue } from '../types.ts';

export interface ReleaseDecision {
  allowed: boolean;
  issues: ValidationIssue[];
  blockedCapabilities: string[];
  /** The inception definition of completion, as the parts of it a registry can count. */
  inception: { unverifiedJourneys: string[]; unverifiedAdapters: string[]; artifactsWithoutProducer: string[] };
}

/**
 * A release is allowed when every capability is production-ready *and* the
 * inception claims hold: every cross-OS journey is verified, every adapter is
 * sandbox-verified, and every artifact of the evidence pack has something
 * that produces it. Each failing claim is one issue, so the report says what
 * is missing rather than only that something is.
 */
export function validateRelease(snapshot: RegistrySnapshot): ReleaseDecision {
  const blockedCapabilities = snapshot.capabilities.filter(({ maturity }) => !maturity.production_ready).map(({ key }) => key);
  const issues: ValidationIssue[] = blockedCapabilities.map((key) => ({
    code: 'capability_not_production_ready',
    path: `capabilities.${key}.maturity.production_ready`,
    message: `${key} lacks production-ready evidence.`,
  }));
  const inception = snapshot.inception;
  const unverifiedJourneys = (inception?.journeys ?? []).filter((j) => j.status !== 'verified').map((j) => j.key).sort();
  const unverifiedAdapters = (inception?.adapters ?? []).filter((a) => !a.sandbox_verified).map((a) => a.key).sort();
  const artifactsWithoutProducer = (inception?.evidence_pack ?? []).filter((a) => a.producer === null).map((a) => a.artifact).sort();
  for (const key of unverifiedJourneys) issues.push({ code: 'journey_not_verified', path: `journeys.${key}.status`, message: `${key} has not passed end to end.` });
  for (const key of unverifiedAdapters) issues.push({ code: 'adapter_not_sandbox_verified', path: `adapters.${key}.sandbox_verified`, message: `${key} has no sandbox verification.` });
  for (const artifact of artifactsWithoutProducer) issues.push({ code: 'artifact_without_producer', path: `evidence_pack.${artifact}`, message: `Nothing in the repository produces ${artifact}.` });
  for (const capability of snapshot.capabilities) {
    const operations = snapshot.operationsReadiness?.find((record) => record?.capability === capability.key);
    if (!operations || operations.status !== 'ready') {
      issues.push({
        code: 'support_recovery_not_ready', path: `operationsReadiness.${capability.key}`,
        message: `${capability.key} lacks current support roster, synthetic-check, restore-drill, and incident-exercise evidence.`,
      });
    }
  }
  return { allowed: issues.length === 0, issues, blockedCapabilities, inception: { unverifiedJourneys, unverifiedAdapters, artifactsWithoutProducer } };
}
