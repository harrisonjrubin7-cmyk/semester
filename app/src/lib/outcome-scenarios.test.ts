import { describe, expect, it } from 'vitest';
import { key, standing } from './grades';
import { CAUTION, outcomeAt, requiredFor, scenarios } from './outcome-scenarios';
import type { Course } from './types';

const course = (grading: { what: string; pct: string }[]) => ({ id: 'econ', grading } as unknown as Course);
const econ = course([
  { what: 'Problem sets', pct: '30%' },
  { what: 'Midterm', pct: '30%' },
  { what: 'Final', pct: '40%' },
]);
const posted = { [key('econ', 0)]: '90', [key('econ', 1)]: '80' };

describe('scenarios', () => {
  const s = standing(econ, posted);

  it('builds each outcome from banked points plus the assumed average', () => {
    // earned 27 + 24 = 51; 40 left.
    const r = scenarios(s);
    if (!r.ok) throw new Error('refused');
    expect(r.rows.map((x) => x.outcome)).toEqual([81, 85, 87.8]);
    expect(r.confirmedShare).toBe(60);
    expect(r.confirmed).toBe(85);
  });

  it('carries the caution with every result', () => {
    const r = scenarios(s);
    expect(r.ok && r.caution).toBe(CAUTION);
    expect(CAUTION).toMatch(/not an official course grade/);
  });

  it('refuses when the weights do not add to 100, instead of computing anyway', () => {
    const odd = standing(course([{ what: 'A', pct: '30%' }, { what: 'B', pct: '30%' }]), { [key('econ', 0)]: '90' });
    expect(scenarios(odd)).toMatchObject({ ok: false, refusal: 'weights_incomplete' });
  });

  it('refuses with nothing scored, and with nothing left', () => {
    expect(scenarios(standing(econ, {}))).toMatchObject({ ok: false, refusal: 'nothing_scored' });
    const all = { ...posted, [key('econ', 2)]: '70' };
    expect(scenarios(standing(econ, all))).toMatchObject({ ok: false, refusal: 'nothing_left' });
  });

  it('clamps an absurd average and never goes below zero', () => {
    expect(outcomeAt(s, 500)).toBe(outcomeAt(s, 100));
    expect(outcomeAt(s, -5)).toBe(outcomeAt(s, 0));
  });
});

describe('requiredFor', () => {
  const s = standing(econ, posted);
  it('says what the remaining work must average', () => {
    const r = requiredFor(s, 85);
    // (85 - 51) / 40 = 85%
    expect(r).toMatchObject({ ok: true, required: 85 });
  });
  it('says so plainly when the target is out of reach', () => {
    const r = requiredFor(s, 99);
    expect(r.ok && r.line).toMatch(/more than 100%/);
  });
  it('shares the refusals', () => {
    expect(requiredFor(standing(econ, {}), 85)).toMatchObject({ ok: false });
  });
  it('never uses judgment words', () => {
    const r = requiredFor(s, 85);
    expect(JSON.stringify([r, scenarios(s)])).not.toMatch(/\b(fail|at risk|behind|danger)\b/i);
  });
});
