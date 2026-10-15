import { describe, expect, it } from 'vitest';
import type { FlagContext } from '../flags';
import {
  CAMPAIGN_FLAG, activationGate, canMove, checkAudience, describeAudience, reviewsOutstanding, visibleTo, type Campaign,
} from './campaign';
import { campaignUrl } from './utm';

const LINK = campaignUrl('https://semester.app/start', {
  source: 'email', medium: 'email', tenant: 'vu', cycle: 'fall2027', audience: 'admitted', objective: 'deposit',
});

const FLAG_ON: FlagContext = {
  environment: 'production', tenantId: 'vu', now: new Date('2026-10-01T12:00:00Z'), killSwitches: [],
  tenantPolicy: { [CAMPAIGN_FLAG]: { state: 'production', permittedRoles: [], permittedCohorts: [] } }, capabilities: ['tenant:configure'],
  // Synthetic gate fixture only; no campaign is activated or sent.
  activationReceipt: {
    decisionKey: 'activation:v1:test-campaign', requestId: 'test-campaign', tenantId: 'vu',
    capabilityId: 'CAP-059', operation: CAMPAIGN_FLAG, policyVersion: 'test-policy', configurationVersion: 1,
    issuedAt: '2026-10-01T12:00:00Z', expiresAt: '2026-10-01T12:15:00Z',
  },
};

const READY: Campaign = {
  campaignId: 'c1', tenantId: 'vu', name: 'Admitted — deposit reminder', objective: 'deposit', funnelStage: 7,
  audienceCriteria: [{ field: 'lifecycle_stage', op: 'eq', value: 'admitted' }, { field: 'entry_term', op: 'eq', value: 'fall2027' }],
  audienceCount: 1840, startDate: '2027-03-01', endDate: '2027-05-01', primaryCta: 'Submit your deposit',
  channels: ['email', 'sms'], owner: 'ana', approver: 'ben', privacyBasis: 'Consented recruitment communication',
  consentRequirements: ['email-v2', 'sms-v3'], frequencyCap: { max: 2, windowDays: 7 }, landingPage: LINK, campaignLinks: [LINK],
  successMetric: 'Admit-to-deposit rate', baseline: '31% (fall 2026)', claimsSubstantiated: true, optOutTested: true,
  conversionInstrumentationTested: true, escalationPath: 'admissions-ops@', reviewDate: '2027-05-15',
  approvals: [
    { kind: 'privacy', reviewer: 'cara', decision: 'approved', at: '2027-02-01' },
    { kind: 'accessibility', reviewer: 'dev', decision: 'approved', at: '2027-02-01' },
    { kind: 'brand', reviewer: 'eli', decision: 'approved', at: '2027-02-01' },
  ],
  status: 'approved',
};

describe('audience criteria', () => {
  it('refuses every education-record and sensitive field by name', () => {
    for (const field of ['gpa', 'financial_aid_status', 'disability', 'race', 'conduct', 'Pell_Eligible', 'poll_response']) {
      expect(checkAudience([{ field, op: 'eq', value: 'x' }]), field).toEqual([expect.objectContaining({ problem: 'prohibited' })]);
    }
  });

  it('refuses a field nobody has classified yet, rather than letting it through', () => {
    expect(checkAudience([{ field: 'zip_income_band', op: 'eq', value: 'x' }])).toEqual([{ field: 'zip_income_band', problem: 'unclassified' }]);
  });

  it('accepts declared and public fields and describes them plainly', () => {
    expect(checkAudience(READY.audienceCriteria)).toEqual([]);
    expect(describeAudience(READY.audienceCriteria)).toBe('lifecycle stage is admitted and entry term is fall2027');
    expect(describeAudience([{ field: 'program_interest', op: 'in', value: ['nursing', 'biology'] }])).toBe('program interest is one of nursing, biology');
  });
});

describe('the activation gate', () => {
  it('passes a campaign that meets the release gate', () => {
    expect(activationGate(READY, 'vu', FLAG_ON)).toEqual([]);
    expect(activationGate(READY, 'vu', { ...FLAG_ON, activationReceipt: null })).toContainEqual({ check: 'flag', step: 'activation_contract' });
  });

  it('refuses when the flag is off, naming the gate that refused', () => {
    expect(activationGate(READY, 'vu', { ...FLAG_ON, tenantPolicy: {} })).toContainEqual({ check: 'flag', step: 'tenant_entitlement' });
    expect(activationGate(READY, 'vu', { ...FLAG_ON, capabilities: [] })).toContainEqual({ check: 'flag', step: 'capability' });
  });

  it('refuses another school’s staff', () => {
    expect(activationGate(READY, 'other', { ...FLAG_ON, tenantId: 'other' })).toContainEqual({ check: 'tenant' });
    expect(visibleTo([READY, { ...READY, tenantId: 'other' }], 'vu')).toHaveLength(1);
  });

  it('refuses sensitive targeting even on an otherwise approved campaign', () => {
    const c = { ...READY, audienceCriteria: [...READY.audienceCriteria, { field: 'financial_aid_status', op: 'eq' as const, value: 'pending' }] };
    expect(activationGate(c, 'vu', FLAG_ON)).toContainEqual(expect.objectContaining({ check: 'audience' }));
  });

  it('refuses without consent requirements, a cap, an owner distinct from the approver, or tested opt-out', () => {
    const fails = activationGate({ ...READY, consentRequirements: [], frequencyCap: null, approver: 'ana', optOutTested: false }, 'vu', FLAG_ON);
    expect(fails).toEqual(expect.arrayContaining([
      { check: 'field', field: 'consentRequirements' }, { check: 'field', field: 'frequencyCap' },
      { check: 'field', field: 'approver' }, { check: 'field', field: 'optOutTested' },
    ]));
  });

  it('refuses a link without the UTM convention', () => {
    const bare = 'https://semester.app/start';
    expect(activationGate({ ...READY, campaignLinks: [bare] }, 'vu', FLAG_ON)).toContainEqual({ check: 'attribution', link: bare });
  });

  it('refuses a draft, and a review date before the campaign ends', () => {
    expect(activationGate({ ...READY, status: 'draft' }, 'vu', FLAG_ON)).toContainEqual({ check: 'status', status: 'draft' });
    expect(activationGate({ ...READY, reviewDate: '2027-04-01' }, 'vu', FLAG_ON)).toContainEqual({ check: 'dates' });
  });
});

describe('reviews and status', () => {
  it('needs all three reviews, the latest of each approved, none by the owner', () => {
    expect(reviewsOutstanding(READY)).toEqual([]);
    const reopened = [...READY.approvals, { kind: 'privacy' as const, reviewer: 'cara', decision: 'changes_requested' as const, at: '2027-02-02' }];
    expect(reviewsOutstanding({ ...READY, approvals: reopened })).toEqual(['privacy']);
    const self = READY.approvals.map((a) => (a.kind === 'brand' ? { ...a, reviewer: 'ana' } : a));
    expect(reviewsOutstanding({ ...READY, approvals: self })).toEqual(['brand']);
  });

  it('never moves straight from draft to active', () => {
    expect(canMove('draft', 'active')).toBe(false);
    expect(canMove('draft', 'in_review')).toBe(true);
    expect(canMove('retired', 'draft')).toBe(false);
  });
});
