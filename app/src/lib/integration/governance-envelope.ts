import { MAX_FRESHNESS_MINUTES } from './freshness.ts';
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
  retentionExpiresAt: string | null;
  consentPurpose: string | null;
  writeAuthority: 'source-system-only';
}

export function governanceEnvelope(adapter: AdapterDeclaration, mapping: EntityMapping, connectionId: string, now: Date, freshnessTargetMinutes = adapter.freshnessTargetMinutes): GovernanceEnvelope & { retentionExpiresAt: string } {
  if (!Number.isFinite(now.getTime()) || !Number.isFinite(adapter.retentionDays) || adapter.retentionDays <= 0 || adapter.retentionDays > 36500
    || !Number.isFinite(freshnessTargetMinutes) || freshnessTargetMinutes <= 0 || freshnessTargetMinutes > MAX_FRESHNESS_MINUTES) {
    throw new Error('Governed records require valid freshness and retention clocks.');
  }
  return {
    sourceStandard: `${adapter.id}@${adapter.version}`,
    sourceOwner: adapter.sourceOfTruth,
    permittedPurposes: [mapping.scope],
    aiEligibility: 'denied_by_default',
    retrievedAt: now.toISOString(),
    expiresAt: new Date(now.getTime() + freshnessTargetMinutes * 60_000).toISOString(),
    retentionPolicyId: `integration:${adapter.id}@${adapter.version}`,
    retentionExpiresAt: new Date(now.getTime() + adapter.retentionDays * 86_400_000).toISOString(),
    consentPurpose: mapping.personal && adapter.consentRequired ? `integration:${connectionId}` : null,
    writeAuthority: 'source-system-only',
  };
}

/** Legacy display strings are not provenance. Remap them from the provider. */
export function hasGovernanceEnvelope(raw: unknown): boolean {
  if (typeof raw !== 'string') return false;
  try {
    const e = JSON.parse(raw) as Partial<GovernanceEnvelope> | null;
    if (!e || typeof e !== 'object' || Array.isArray(e)) return false;
    const text = (v: unknown) => typeof v === 'string' && v.trim().length > 0;
    const clock = (v: unknown) => typeof v === 'string'
      && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/.test(v)
      && Number.isFinite(Date.parse(v))
      && new Date(`${v.slice(0, 10)}T00:00:00Z`).toISOString().slice(0, 10) === v.slice(0, 10);
    return text(e.sourceStandard) && text(e.sourceOwner) && text(e.retentionPolicyId)
      && Array.isArray(e.permittedPurposes) && e.permittedPurposes.length > 0 && e.permittedPurposes.every(text)
      && e.aiEligibility === 'denied_by_default' && e.writeAuthority === 'source-system-only'
      && clock(e.retrievedAt) && clock(e.expiresAt) && Date.parse(e.expiresAt!) > Date.parse(e.retrievedAt!)
      && ((e.retentionExpiresAt === null && e.retentionPolicyId === 'canonical:tenant-lifetime') || clock(e.retentionExpiresAt))
      && (e.consentPurpose === null || text(e.consentPurpose));
  } catch { return false; }
}
