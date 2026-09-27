import { describe, expect, it } from 'vitest';
import { assess, CRITERIA, MAX_SCORE, RUBRIC, type Criterion, type Score } from './scorecard';

const all = (s: Score) => Object.fromEntries(CRITERIA.map((c) => [c, s])) as Record<Criterion, Score>;

describe('governance scorecard', () => {
  it('has eleven criteria, each with a meaning for 0 through 3, out of 33', () => {
    expect(CRITERIA).toHaveLength(11);
    expect(MAX_SCORE).toBe(33);
    for (const c of CRITERIA) expect(RUBRIC[c].every((s) => s.trim().length > 0), c).toBe(true);
  });

  it('routes by the published thresholds', () => {
    expect(assess(all(3)).route).toBe('core'); // 33
    expect(assess({ ...all(3), cost: 2, adoption: 2, operations: 2, reusability: 2, integration: 2, security: 2 }).route).toBe('core'); // 27
    expect(assess({ ...all(2), cost: 3, adoption: 3, operations: 3, reusability: 3, integration: 3 }).route).toBe('core'); // 27
    expect(assess({ ...all(2), cost: 3, adoption: 3, operations: 3, reusability: 3 }).route).toBe('module'); // 26
    expect(assess(all(2)).route).toBe('module'); // 22
    expect(assess({ ...all(2), cost: 1, adoption: 1 }).route).toBe('pilot'); // 20
    expect(assess({ ...all(1), cost: 2, adoption: 2, operations: 2, reusability: 2 }).route).toBe('pilot'); // 15
    expect(assess({ ...all(1), cost: 2, adoption: 2, operations: 2 }).route).toBe('partner_or_decline'); // 14
  });

  it('lets one zero override any total — irreversibility is not bought with enthusiasm', () => {
    const a = assess({ ...all(3), rollback: 0 });
    expect(a.total).toBe(30);
    expect(a.route).toBe('reject_or_redesign');
    expect(a.blockers).toEqual(['rollback']);
  });

  it('refuses to assess an incomplete card rather than read a blank as a pass', () => {
    const { adoption: _skip, ...rest } = all(3);
    const a = assess(rest);
    expect(a.missing).toEqual(['adoption']);
    expect(a.route).toBe('reject_or_redesign');
  });

  it('names the ones that need governance', () => {
    expect(assess({ ...all(2), privacy: 1 }).needsGovernance).toEqual(['privacy']);
  });
});
