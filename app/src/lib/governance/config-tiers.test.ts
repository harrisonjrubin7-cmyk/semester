import { describe, expect, it } from 'vitest';
import { APPROVAL_FLOW, classifyRequest, NEVER, nextStep, SETTINGS, TIER_REVIEWERS, type ApprovalStep, type Tier } from './config-tiers';

describe('configuration tiers', () => {
  it('registers every setting at a tier with a stated limit', () => {
    const keys = new Set<string>();
    for (const s of SETTINGS) {
      expect(keys.has(s.key), s.key).toBe(false);
      keys.add(s.key);
      expect(s.limit.trim(), s.key).not.toBe('');
    }
    for (const t of [1, 2, 3, 4, 5] as Tier[]) expect(SETTINGS.some((s) => s.tier === t), `tier ${t}`).toBe(true);
  });

  it('never lets a forbidden thing be a setting', () => {
    for (const n of NEVER) {
      expect(SETTINGS.some((s) => s.key === n.key), n.key).toBe(false);
      expect(classifyRequest(n.key).kind).toBe('never');
    }
  });

  it('sends policy and extension changes through privacy and security', () => {
    for (const t of [3, 5] as Tier[]) {
      expect(TIER_REVIEWERS[t]).toContain('privacy');
      expect(TIER_REVIEWERS[t]).toContain('security');
    }
    expect(TIER_REVIEWERS[4]).toContain('data_steward');
  });

  it('treats anything unregistered as a product request, not a configuration', () => {
    expect(classifyRequest('workflow.something_bespoke')).toEqual({ kind: 'product_request' });
    expect(classifyRequest('brand.logo')).toMatchObject({ kind: 'setting', tier: 1 });
  });

  it('does not launch until every step before launch is recorded, in order', () => {
    expect(nextStep(new Set())).toBe('request');
    const before = APPROVAL_FLOW.slice(0, APPROVAL_FLOW.indexOf('launch_with_monitoring'));
    const missingUat = new Set<ApprovalStep>(before.filter((s) => s !== 'uat'));
    expect(nextStep(missingUat)).toBe('uat');
    expect(nextStep(new Set<ApprovalStep>(before))).toBeNull();
  });
});
