import { describe, expect, it } from 'vitest';
import {
  appendEntry, itemGrade, percentOver, reviseRubric, scoreRubric, validateRubric,
  type GradeEntry, type Ledger, type Level, type Rubric, type RubricCriterion,
} from './rubricengine';

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

const entry = (over: Partial<GradeEntry>): GradeEntry => ({
  id: 'e1', studentId: 's1', itemId: 'hw1', kind: 'graded', points: 8, outOf: 10, by: 'Dr. Lee', at: '2026-10-01T10:00:00Z', ...over,
});
const build = (...es: GradeEntry[]): Ledger => es.reduce<Ledger>((l, e) => {
  const r = appendEntry(l, e);
  if (!r.ok) throw new Error(`${e.id}: ${r.why}`);
  return r.value;
}, []);
const refused = (l: Ledger, e: GradeEntry) => { const r = appendEntry(l, e); return r.ok ? 'ACCEPTED' : r.why; };

describe('the grade ledger', () => {
  it('keeps every entry, so an override changes the grade and the history stays', () => {
    const l = build(entry({}), entry({ id: 'e2', kind: 'override', points: 9, reason: 'Regrade after appeal', at: '2026-10-02T10:00:00Z' }));
    expect(itemGrade(l, 's1', 'hw1')).toEqual({ status: 'graded', points: 9, outOf: 10, overridden: true, entries: 2 });
    expect(l).toHaveLength(2);
  });

  it('needs a reason for an override, a regrade and an excusal, and a name on every entry', () => {
    const l = build(entry({}));
    expect(refused(l, entry({ id: 'e2', kind: 'override', points: 9 }))).toMatch(/needs a reason/);
    expect(refused(l, entry({ id: 'e2', points: 9 }))).toMatch(/regrade needs a reason/);
    expect(refused(l, entry({ id: 'e2', kind: 'excused', points: null, reason: ' ' }))).toMatch(/needs a reason/);
    expect(refused([], entry({ by: ' ' }))).toMatch(/name of who/);
  });

  it('refuses points outside the maximum, an override with no grade, and an edit of an existing entry', () => {
    expect(refused([], entry({ points: 11 }))).toMatch(/0 to 10/);
    expect(refused([], entry({ points: -1 }))).toMatch(/0 to 10/);
    expect(refused([], entry({ kind: 'override', points: 5, reason: 'x' }))).toMatch(/no grade to override/);
    expect(refused(build(entry({})), entry({ points: 1, reason: 'again' }))).toMatch(/already exists/);
  });

  it('will not date an entry before the one it follows, or change the maximum of a graded item', () => {
    const l = build(entry({}));
    expect(refused(l, entry({ id: 'e2', points: 7, reason: 'r', at: '2026-09-01T00:00:00Z' }))).toMatch(/before the one it follows/);
    expect(refused(l, entry({ id: 'e2', points: 7, reason: 'r', outOf: 20, at: '2026-10-02T00:00:00Z' }))).toMatch(/maximum/);
  });

  it('excuses work out of the denominator, and lifting the excusal brings the grade back', () => {
    const items = ['hw1', 'hw2'];
    const l = build(
      entry({}),
      entry({ id: 'e2', itemId: 'hw2', points: 0 }),
      entry({ id: 'e3', itemId: 'hw2', kind: 'excused', points: null, reason: 'Documented illness', at: '2026-10-03T00:00:00Z' }),
    );
    expect(itemGrade(l, 's1', 'hw2')?.status).toBe('excused');
    expect(percentOver(l, 's1', items)).toBeCloseTo(0.8);
    const lifted = build(...l, entry({ id: 'e4', itemId: 'hw2', kind: 'unexcused', points: null, reason: 'Documentation withdrawn', at: '2026-10-04T00:00:00Z' }));
    expect(itemGrade(lifted, 's1', 'hw2')).toMatchObject({ status: 'graded', points: 0 });
    expect(percentOver(lifted, 's1', items)).toBeCloseTo(8 / 20);
  });

  it('is not a zero: excused is not missing, and refuses a double excusal or lifting what was never excused', () => {
    const ex = entry({ kind: 'excused', points: null, reason: 'Illness' });
    expect(itemGrade(build(ex), 's1', 'hw1')).toMatchObject({ status: 'excused', points: null });
    expect(percentOver(build(ex), 's1', ['hw1'])).toBeNull();
    expect(refused(build(ex), entry({ id: 'e2', kind: 'excused', points: null, reason: 'again', at: '2026-10-02T00:00:00Z' }))).toMatch(/already excused/);
    expect(refused(build(entry({})), entry({ id: 'e2', kind: 'unexcused', points: null, reason: 'x', at: '2026-10-02T00:00:00Z' }))).toMatch(/not excused/);
  });

  it('gives nothing for an item with no entry, and never mutates the ledger it is given', () => {
    const l = build(entry({}));
    const before = JSON.stringify(l);
    appendEntry(l, entry({ id: 'e2', points: 5, reason: 'r', at: '2026-10-02T00:00:00Z' }));
    expect(JSON.stringify(l)).toBe(before);
    expect(itemGrade(l, 's1', 'nope')).toBeUndefined();
  });
});
