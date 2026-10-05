import { describe, expect, it } from 'vitest';
import { LABEL, MAX, QUESTIONS, SCALE, briefText, diagnose, maturity } from './navdiagnostic';

describe('the academic navigation diagnostic', () => {
  it('asks the seven questions the brief lists, on one four-step scale', () => {
    expect(QUESTIONS.map((q) => q.id)).toEqual(['lost', 'deadlines', 'estimates', 'office', 'access', 'ai', 'recover']);
    expect(SCALE.map((s) => s.value)).toEqual([0, 1, 2, 3]);
    expect(MAX).toBe(21);
  });

  it('scores the institution’s own answers and nothing else', () => {
    const r = diagnose({ lost: 3, deadlines: 3, estimates: 3, office: 3, access: 3, ai: 3, recover: 3 });
    expect(r.score).toBe(21);
    expect(r.maturity.level).toBe('Clear');
    expect(r.patterns).toEqual([]);
    expect(r.brief).toEqual([]);
    expect(r.label).toBe(LABEL);
  });

  it('names the lowest answers as friction patterns, at most three, with one action each', () => {
    const r = diagnose({ lost: 2, deadlines: 0, estimates: 1, office: 0, access: 3, ai: 2, recover: 1 });
    expect(r.score).toBe(9);
    expect(r.patterns.map((q) => q.id)).toEqual(['deadlines', 'office', 'estimates']);
    expect(r.brief).toHaveLength(3);
    expect(r.brief[0]).toMatch(/Publish each date once/);
    expect(r.maturity.level).toBe('Findable');
  });

  it('scales an unfinished assessment rather than calling silence a zero', () => {
    const r = diagnose({ lost: 3, deadlines: 3 });
    expect(r.answered).toBe(2);
    expect(r.score).toBe(6);
    expect(r.maturity.level).toBe('Clear');
    expect(diagnose({}).maturity.level).toBe('Fragmented');
  });

  it('draws the four levels at the stated shares', () => {
    expect(maturity(21).level).toBe('Clear');
    expect(maturity(13).level).toBe('Navigable');
    expect(maturity(7).level).toBe('Findable');
    expect(maturity(5).level).toBe('Fragmented');
  });

  it('writes a brief the reader copies, and labels it a self-assessment every time', () => {
    const text = briefText({ lost: 1, deadlines: 1, estimates: 1, office: 1, access: 1, ai: 1, recover: 1 });
    expect(text).toContain('Score: 7 of 21 (7 of 7 answered)');
    expect(text).toContain('Level: Findable');
    expect(text).toContain('1. ');
    expect(text).toContain(LABEL);
    expect(text).not.toMatch(/percentile|institutions like yours|certified/i);
  });
});
