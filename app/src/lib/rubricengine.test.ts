import { describe, expect, it } from 'vitest';
import { reviseRubric, scoreRubric, validateRubric, type Level, type Rubric, type RubricCriterion } from './rubricengine';

const lv = (id: string, points: number, descriptor = `${id} work`): Level => ({ id, label: id, points, descriptor });
const crit = (id: string, outcomeIds: string[], top = 4): RubricCriterion => ({
  id, name: id, outcomeIds, levels: [lv('low', 1), lv('mid', top - 1), lv('high', top)],
});
const rubric: Rubric = { id: 'essay', version: 1, criteria: [crit('thesis', ['O1'], 4), crit('evidence', ['O1', 'O2'], 6)] };

describe('a rubric with levels and outcomes', () => {
  it('scores from the level chosen for each criterion, and rolls points up to outcomes', () => {
    const r = scoreRubric(rubric, { rubricVersion: 1, levels: { thesis: 'high', evidence: 'mid' } });
    expect(r.ok && r.value.total).toBe(4 + 5);
    expect(r.ok && r.value.max).toBe(4 + 6);
    expect(r.ok && r.value.outcomes).toEqual({ O1: { points: 9, max: 10 }, O2: { points: 5, max: 6 } });
  });

  it('refuses a criterion left unscored, an unknown criterion, an unknown level, and another version', () => {
    const why = (levels: Record<string, string>, rubricVersion = 1) => {
      const r = scoreRubric(rubric, { rubricVersion, levels });
      return r.ok ? 'ACCEPTED' : r.why;
    };
    expect(why({ thesis: 'high' })).toMatch(/evidence has no level chosen/);
    expect(why({ thesis: 'high', evidence: 'mid', extra: 'x' })).toMatch(/not in this rubric/);
    expect(why({ thesis: 'top', evidence: 'mid' })).toMatch(/no level top/);
    expect(why({ thesis: 'high', evidence: 'mid' }, 2)).toMatch(/version 2, but the rubric is at version 1/);
  });

  it('refuses a rubric with an empty box, one level, a repeated id or negative points', () => {
    const bad = (c: RubricCriterion) => validateRubric({ ...rubric, criteria: [c] });
    expect(bad({ ...crit('a', []), levels: [lv('x', 1, '  '), lv('y', 2)] }).ok).toBe(false);
    expect(bad({ ...crit('a', []), levels: [lv('x', 1)] }).ok).toBe(false);
    expect(bad({ ...crit('a', []), levels: [lv('x', 1), lv('x', 2)] }).ok).toBe(false);
    expect(bad({ ...crit('a', []), levels: [lv('x', -1), lv('y', 2)] }).ok).toBe(false);
    expect(validateRubric({ ...rubric, criteria: [] }).ok).toBe(false);
    expect(validateRubric(rubric).ok).toBe(true);
  });

  it('revises into a new version, so a mark made on the old one no longer scores', () => {
    const v2 = reviseRubric(rubric, [crit('thesis', ['O1'], 5)]);
    expect(v2.ok && v2.value.version).toBe(2);
    if (!v2.ok) throw new Error(v2.why);
    expect(scoreRubric(v2.value, { rubricVersion: 1, levels: { thesis: 'high' } }).ok).toBe(false);
    expect(scoreRubric(v2.value, { rubricVersion: 2, levels: { thesis: 'high' } }).ok).toBe(true);
    expect(rubric.version).toBe(1);
  });
});
