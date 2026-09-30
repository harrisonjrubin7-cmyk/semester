import { describe, expect, it } from 'vitest';
import type { FlagContext } from '../flags';
import { SPONSOR_FLAG, placementProblems, sponsorReport, type SponsorPlacement, type TenantSponsorPolicy } from './sponsor';

const ON: FlagContext = {
  environment: 'production', tenantId: 'vu', now: new Date('2026-10-01T12:00:00Z'), killSwitches: [],
  tenantPolicy: { [SPONSOR_FLAG]: { state: 'production', permittedRoles: [], permittedCohorts: [] } }, capabilities: ['tenant:configure'],
  // Synthetic gate fixture only; no sponsor placement is activated.
  activationReceipt: {
    decisionKey: 'activation:v1:test-sponsor', requestId: 'test-sponsor', tenantId: 'vu',
    capabilityId: 'CAP-043', operation: SPONSOR_FLAG, policyVersion: 'test-policy', configurationVersion: 1,
    issuedAt: '2026-10-01T12:00:00Z', expiresAt: '2026-10-01T12:15:00Z',
  },
};
const POLICY: TenantSponsorPolicy = { enabled: true, categories: ['education_career'], surfaces: ['career_events'], segments: ['all_students'] };
const OK: SponsorPlacement = {
  tenantId: 'vu', sponsorName: 'Acme Internships', category: 'education_career', surface: 'career_events',
  targeting: { kind: 'contextual' }, label: 'Sponsored', whyShown: 'Shown on career events to everyone.',
  humanApprovedBy: 'trust-lead', auditScheduledFor: '2026-11-01', complaintRoute: '/report',
};

describe('sponsor placements', () => {
  it('allows a labelled, approved, contextual placement', () => {
    expect(placementProblems(OK, POLICY, ON)).toEqual([]);
    expect(placementProblems(OK, POLICY, { ...ON, activationReceipt: null })).toContain('flag_off');
  });

  it('is off without the flag, and when the school has disabled sponsorship', () => {
    expect(placementProblems(OK, POLICY, { ...ON, tenantPolicy: {} })).toContain('flag_off');
    expect(placementProblems(OK, { ...POLICY, enabled: false }, ON)).toContain('tenant_disabled');
  });

  it('never appears on an AI answer, advising, or an urgent academic flow, even if a school lists it', () => {
    for (const surface of ['ai_answer', 'advising', 'course_recommendation', 'financial_aid_deadline', 'add_drop']) {
      expect(placementProblems({ ...OK, surface }, { ...POLICY, surfaces: [surface] }, ON), surface).toContain('protected_surface');
    }
  });

  it('refuses prohibited categories regardless of school policy', () => {
    expect(placementProblems({ ...OK, category: 'predatory_lending' }, POLICY, ON)).toContain('prohibited_category');
    expect(placementProblems({ ...OK, category: 'wellness_nonclinical' }, POLICY, ON)).toContain('category_not_approved');
  });

  it('needs a visible label, an explanation, a human approval and an audit date', () => {
    const p = placementProblems({ ...OK, label: 'Featured', whyShown: '', humanApprovedBy: null, auditScheduledFor: null }, POLICY, ON);
    expect(p).toEqual(expect.arrayContaining(['unlabelled', 'no_explanation', 'no_human_approval', 'no_audit']));
  });

  it('allows only school-approved broad segments', () => {
    expect(placementProblems({ ...OK, targeting: { kind: 'segment', segment: 'first_gen' } }, POLICY, ON)).toContain('segment_not_approved');
  });

  it('reports only aggregates above a minimum cell', () => {
    expect(sponsorReport(1500, 12)).toEqual({ impressions: 1500, clicks: null });
  });
});
