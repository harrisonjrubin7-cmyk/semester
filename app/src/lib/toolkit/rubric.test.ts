import { describe, expect, it } from 'vitest';
import { DISCLAIMER, interpret } from './rubric';

describe('rubric interpreter', () => {
  const RUBRIC = `Evidence and Analysis — 30 points
Makes a clear claim. Supports it with relevant, credible evidence. Explains how each source supports the claim.
Addresses a limitation or counterargument.
Organization (10 pts)
Paragraphs follow a logical order.`;

  it('splits criteria and keeps the rubric’s own words as the checks', () => {
    const c = interpret(RUBRIC);
    expect(c.map((x) => x.name)).toEqual(['Evidence and Analysis', 'Organization']);
    expect(c[0].points).toBe(30);
    expect(c[0].checks).toContain('Makes a clear claim');
    expect(c[0].checks).toContain('Addresses a limitation or counterargument');
  });

  it('predicts nothing: no output mentions a score, grade or points earned', () => {
    const text = JSON.stringify(interpret(RUBRIC));
    expect(text).not.toMatch(/earn|predict|likely grade|you will get|score of/i);
    expect(DISCLAIMER).toMatch(/not a grade prediction/);
    expect(DISCLAIMER).toMatch(/not feedback from your instructor/);
  });
});
