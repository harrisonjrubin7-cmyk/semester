// Generated from app/src/lib/integration/governance-envelope.ts by app/scripts/edge-integration.ts. Do not edit;
// change the source and run `cd app && node scripts/edge-integration.ts`.

import type { AdapterDeclaration, EntityMapping } from './adapter.ts';

/** Server-generated metadata. Provider fields cannot grant AI or write authority. */
export interface GovernanceEnvelope {
  sourceStandard: string;
  sourceOwner: string;
  permittedPurposes: string[];
  aiEligibility: 'denied_by_default';
  retrievedAt: string;
  expiresAt: string;
  retentionPolicyId: string;
  retentionExpiresAt: string;
  consentPurpose: string | null;
  writeAuthority: 'source-system-only';
}

export function governanceEnvelope(adapter: AdapterDeclaration, mapping: EntityMapping, connectionId: string, now: Date): GovernanceEnvelope {
  if (!Number.isFinite(now.getTime()) || !Number.isFinite(adapter.retentionDays) || adapter.retentionDays <= 0
    || !Number.isFinite(adapter.freshnessTargetMinutes) || adapter.freshnessTargetMinutes <= 0) {
    throw new Error('Governed records require valid freshness and retention clocks.');
  }
  return {
    sourceStandard: `${adapter.id}@${adapter.version}`,
    sourceOwner: adapter.sourceOfTruth,
    permittedPurposes: [mapping.scope],
    aiEligibility: 'denied_by_default',
    retrievedAt: now.toISOString(),
    expiresAt: new Date(now.getTime() + adapter.freshnessTargetMinutes * 60_000).toISOString(),
    retentionPolicyId: `integration:${adapter.id}@${adapter.version}`,
    retentionExpiresAt: new Date(now.getTime() + adapter.retentionDays * 86_400_000).toISOString(),
    consentPurpose: mapping.personal && adapter.consentRequired ? `integration:${connectionId}` : null,
    writeAuthority: 'source-system-only',
  };
}
