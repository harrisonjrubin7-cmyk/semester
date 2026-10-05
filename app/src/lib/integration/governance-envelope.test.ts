import { describe, expect, it } from 'vitest';
import { governanceEnvelope, hasGovernanceEnvelope } from './governance-envelope';
import { MOCK_LMS, MOCK_ASSIGNMENT, memoryStore, mockBatch } from './mock-adapter';
import { ingest } from './pipeline';
import { validateDeclaration } from './adapter';

const now = new Date('2026-10-01T15:00:00Z');
describe('canonical governance metadata', () => {
  it('binds purpose and owner to the declaration with bounded freshness and retention', () => {
    const e = governanceEnvelope(MOCK_LMS, MOCK_LMS.entities[1], 'conn_1', now);
    expect(e.permittedPurposes).toEqual([MOCK_LMS.entities[1].scope]);
    expect(e.sourceOwner).toBe(MOCK_LMS.sourceOfTruth);
    expect(Date.parse(e.expiresAt) - now.getTime()).toBe(MOCK_LMS.freshnessTargetMinutes * 60_000);
    expect(Date.parse(e.retentionExpiresAt) - now.getTime()).toBe(MOCK_LMS.retentionDays * 86_400_000);
    expect(e.aiEligibility).toBe('denied_by_default');
    expect(e.writeAuthority).toBe('source-system-only');
    expect(governanceEnvelope(MOCK_LMS, { ...MOCK_LMS.entities[1], personal: true }, 'conn_1', now).consentPurpose).toBe('integration:conn_1');
  });

  it('recognizes only complete provenance with valid ISO clocks as refreshable', () => {
    const e = governanceEnvelope(MOCK_LMS, MOCK_LMS.entities[1], 'conn_1', now);
    expect(hasGovernanceEnvelope(JSON.stringify(e))).toBe(true);
    expect(hasGovernanceEnvelope(JSON.stringify({ ...e, retentionPolicyId: 'canonical:tenant-lifetime', retentionExpiresAt: null }))).toBe(true);
    for (const raw of [undefined, 'legacy', '{}', 'null', '[]', JSON.stringify({ ...e, retrievedAt: '1' }),
      JSON.stringify({ ...e, retrievedAt: '2026-02-30T12:00:00Z' }), JSON.stringify({ ...e, permittedPurposes: [] }),
      JSON.stringify({ ...e, expiresAt: e.retrievedAt }), JSON.stringify({ ...e, retentionExpiresAt: null })]) expect(hasGovernanceEnvelope(raw)).toBe(false);
  });

  it('does not let a provider inject authorization or unrestricted AI eligibility', async () => {
    const r = await ingest({ adapter: MOCK_LMS, connection: { tenantId: 'vu', publicId: 'conn_1', status: 'healthy', approved: true,
      approvedScopes: MOCK_LMS.scopes, classificationCeiling: 'T1' },
      batch: mockBatch([{ ...MOCK_ASSIGNMENT, fields: { ...MOCK_ASSIGNMENT.fields, aiEligibility: 'allowed', writeAuthority: 'ai', permittedPurposes: ['all'] } }]),
      store: memoryStore(), killSwitchEngaged: false, now });
    expect(r.status).toBe('succeeded');
    expect(r.references[0].governance.aiEligibility).toBe('denied_by_default');
    expect(r.references[0].governance.permittedPurposes).toEqual([MOCK_LMS.entities[1].scope]);
    expect(r.references[0].values).not.toHaveProperty('aiEligibility');
  });

  it('refuses unknown retention clocks before accepting a batch', async () => {
    for (const retentionDays of [0, -1, Infinity, NaN]) expect(validateDeclaration({ ...MOCK_LMS, retentionDays }).join()).toContain('retention');
    expect(() => governanceEnvelope({ ...MOCK_LMS, retentionDays: 0 }, MOCK_LMS.entities[1], 'c', now)).toThrow();
    expect(() => governanceEnvelope(MOCK_LMS, MOCK_LMS.entities[1], 'c', now, 525601)).toThrow();
    const r = await ingest({ adapter: { ...MOCK_LMS, retentionDays: 0 }, connection: { tenantId: 'vu', publicId: 'conn_1', status: 'healthy', approved: true, approvedScopes: MOCK_LMS.scopes, classificationCeiling: 'T1' },
      batch: mockBatch([MOCK_ASSIGNMENT]), store: memoryStore(), killSwitchEngaged: false, now });
    expect(r.status).toBe('refused');
    expect(r.references).toEqual([]);
  });
});
