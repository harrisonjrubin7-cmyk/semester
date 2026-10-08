import { describe, expect, it } from 'vitest';
import { aggregateGrades, leaderboard, weightedScore } from '@/lib/benchmark/scoring';
describe('weightedScore', () => {
  it('uses the default weights', () => { const s = weightedScore({ correctness: 5, codeQuality: 5, rendering: 5, stateManagement: 5, maintainability: 5, handoff: 5, sandboxFit: 5 }); expect(s).toMatchObject({ outOf5: 5, outOf100: 100, missing: [] }); });
  it('weights correctness at 25%', () => { expect(weightedScore({ correctness: 5, codeQuality: 0, rendering: 0, stateManagement: 0, maintainability: 0, handoff: 0, sandboxFit: 0 }).outOf100).toBe(25); });
  it('renormalises around missing grades and reports them', () => { const s = weightedScore({ correctness: 4 }); expect(s.outOf5).toBe(4); expect(s.missing).toContain('codeQuality'); });
  it('is null when nothing is graded', () => { expect(weightedScore({}).outOf5).toBeNull(); });
  it('honours task overrides incl. persistence weight', () => { expect(weightedScore({ correctness: 5, persistence: 0 }, { correctness: 0.5, persistence: 0.5, codeQuality: 0, rendering: 0, stateManagement: 0, maintainability: 0, handoff: 0, sandboxFit: 0 }).outOf5).toBe(2.5); });
  it('rejects out-of-range grades', () => { expect(() => weightedScore({ correctness: 6 })).toThrow(RangeError); });
});
describe('aggregate + leaderboard', () => {
  it('averages graders per criterion', () => { expect(aggregateGrades([{ correctness: 4 }, { correctness: 2 }]).outOf5).toBe(3); });
  it('ranks graded platforms above ungraded', () => { const l = leaderboard([{ key: 'v0', score: 4 }, { key: 'Canvas', score: null }, { key: 'Claude', score: 4.5 }]); expect(l.map((r) => r.key)).toEqual(['Claude', 'v0', 'Canvas']); });
});
