import { describe, expect, it } from 'vitest';
import { FLAGS } from '../flags';
import { charterProblems, CHARTERS } from './charters';

describe('product charters', () => {
  it('charters every module and ops flag, and nothing that is not a flag', () => {
    const need = FLAGS.filter((f) => f.type === 'module' || f.type === 'ops').map((f) => f.key);
    for (const k of need) expect(CHARTERS.some((c) => c.flag === k), k).toBe(true);
    for (const c of CHARTERS) expect(FLAGS.some((f) => f.key === c.flag), c.flag).toBe(true);
  });

  it('has no empty fields, and reviews no later than the flag it governs', () => {
    for (const c of CHARTERS) {
      expect(charterProblems(c, '2026-09-27'), c.flag).toEqual([]);
      const f = FLAGS.find((x) => x.key === c.flag)!;
      expect(c.reviewAt <= f.reviewAt, c.flag).toBe(true);
    }
  });

  it('flags a lapsed review and a build decision the scorecard did not support (controls)', () => {
    const c = CHARTERS[0];
    expect(charterProblems(c, '2027-01-01').join()).toMatch(/has passed/);
    expect(charterProblems({ ...c, route: 'partner_or_decline' }, '2026-09-27').join()).toMatch(/decided build/);
    expect(charterProblems({ ...c, nonGoals: [] }, '2026-09-27').join()).toMatch(/non-goals/);
  });
});
