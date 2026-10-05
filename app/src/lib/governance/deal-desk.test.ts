import { describe, expect, it } from 'vitest';
import { review, type Deal } from './deal-desk';

const base: Deal = {
  tier: 'campus', listAcvCents: 10_000_000, discount: 0.05, years: 1,
  implementationFeeCents: 1_500_000, aiOverageDefined: true,
};

describe('deal desk', () => {
  it('escalates approvals with the discount', () => {
    expect(review(base).approvers).toEqual(['sales_lead', 'implementation']);
    expect(review({ ...base, discount: 0.15 }).approvers).toContain('finance');
    expect(review({ ...base, discount: 0.25 }).approvers).toContain('ceo');
    expect(review({ ...base, discount: 0.5 }).refused.join()).toMatch(/highest approval level/);
  });

  it('refuses free forever, a missing overage policy, a fee under the floor and an over-long pilot', () => {
    const r = review({ ...base, freeForever: true, aiOverageDefined: false, implementationFeeCents: 0, pilotMonths: 12, pilotCreditShare: 0.8 });
    expect(r.refused).toHaveLength(5);
  });

  it('lets a capped pilot credit carry a fee waiver, and nothing else', () => {
    const pilot = { ...base, implementationFeeCents: 0, pilotMonths: 4 };
    expect(review({ ...pilot, pilotCreditShare: 0.2 }).refused).toEqual([]);
    expect(review(pilot).refused.join()).toMatch(/below the floor/);
    expect(review({ ...pilot, pilotCreditShare: 0.05 }).refused.join()).toMatch(/below the floor/);
    expect(review({ ...pilot, pilotCreditShare: 0.8 }).refused).toHaveLength(2);
  });

  it('caps the multi-year step and checks the minimum on the net value', () => {
    expect(review({ ...base, discount: 0, years: 3 }).netAcvCents).toBe(9_400_000);
    expect(review({ ...base, discount: 0, years: 10 }).netAcvCents).toBe(9_100_000);
    expect(review({ ...base, discount: 0.3 }).refused.join()).toMatch(/below the campus minimum/);
  });

  it('brings in product, legal and security for custom work, paper and data scope', () => {
    const r = review({ ...base, customWork: true, nonstandardTerms: true, scopeChangesData: true, accessProgram: 'nonprofit' });
    expect(r.approvers).toEqual(expect.arrayContaining(['product', 'legal', 'security_privacy', 'finance']));
  });
});
