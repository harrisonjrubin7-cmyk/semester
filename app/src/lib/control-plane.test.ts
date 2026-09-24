import { describe, expect, it } from 'vitest';
import { controlPlaneView, supportSignals, type ControlPlaneInput } from './control-plane';

const fixture = (patch: Partial<ControlPlaneInput> = {}): ControlPlaneInput => ({
  tenantId: 'northstar',
  viewedTenantId: 'northstar',
  previewRole: 'student',
  featureState: 'sandbox',
  gatewayStatus: 'sandbox tested',
  verifiedCapabilities: [],
  approvedSourceCount: 2,
  activeConsentCount: 4,
  auditEventCount: 12,
  ...patch,
});

describe('university control plane authorization', () => {
  it('lets a verified tenant administrator edit only their tenant policy', () => {
    expect(
      controlPlaneView(fixture({
        verifiedCapabilities: [{ tenantId: 'northstar', capability: 'tenant_admin', verified: true }],
      })).canEdit,
    ).toBe(true);
    expect(
      controlPlaneView(fixture({
        tenantId: 'cedar',
        verifiedCapabilities: [{ tenantId: 'cedar', capability: 'tenant_admin', verified: true }],
      })).canEdit,
    ).toBe(false);
  });

  it('treats a selected preview persona as demonstration, not authorization', () => {
    expect(controlPlaneView(fixture({ previewRole: 'admin', verifiedCapabilities: [] })).canEdit).toBe(false);
  });

  it('uses only the approved institutional status vocabulary', () => {
    expect(controlPlaneView(fixture()).sections.map((section) => section.status)).toEqual(
      expect.arrayContaining(['contract only', 'sandbox tested', 'awaiting authorization']),
    );
  });
});

describe('transparent support signals', () => {
  it('explains support signals and excludes protected-trait and emotion inputs', () => {
    const signals = supportSignals([
      {
        tenantId: 'northstar',
        personId: 'student-1',
        consent: true,
        missedRequiredItems: 2,
        daysSinceCourseActivity: 9,
        masteryTrend: 'down',
        protectedTraits: { race: 'not-for-use', gender: 'not-for-use' },
        emotion: 'anxious',
      },
    ]);
    expect(signals[0].reasons.length).toBeGreaterThan(0);
    expect(JSON.stringify(signals)).not.toMatch(/race|gender|emotion|sentiment/i);
  });
});
