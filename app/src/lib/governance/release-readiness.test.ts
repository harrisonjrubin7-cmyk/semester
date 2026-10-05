import { describe, expect, it } from 'vitest';
import { DIMENSIONS, FLOOR, promote, STAGES, THRESHOLD, total, type Scores } from './release-readiness';

const all = (n: number): Scores => Object.fromEntries(DIMENSIONS.map((d) => [d.key, n])) as Scores;

describe('the weights', () => {
  it('sum to one hundred, so a total reads as a percentage', () => {
    expect(DIMENSIONS.reduce((s, d) => s + d.weight, 0)).toBe(100);
  });

  it('weigh each dimension as the table says', () => {
    expect(total(all(100))).toBe(100);
    expect(total({ ...all(0), user_value: 100 })).toBe(20);
    expect(total({ ...all(0), supportability: 100 })).toBe(5);
  });

  it('refuse a score outside 0–100', () => {
    expect(() => total({ ...all(90), usability: 101 })).toThrow(RangeError);
    expect(() => total({ ...all(90), usability: Number.NaN })).toThrow(RangeError);
  });

  it('ask more of high-stakes work at every stage past internal', () => {
    for (const s of STAGES.slice(1)) expect(THRESHOLD[s.key].highStakes, s.key).toBeGreaterThan(THRESHOLD[s.key].standard);
  });
});

describe('promotion', () => {
  it('lets an 85 reach pilot, and not an 84', () => {
    expect(promote('design_partner', 'pilot', all(85)).allowed).toBe(true);
    const p = promote('design_partner', 'pilot', all(84));
    expect(p.allowed).toBe(false);
    expect(p.reasons).toEqual(['Total 84 is under the 85 this stage needs']);
  });

  it('holds assessment and grade work to the higher bar', () => {
    expect(promote('design_partner', 'pilot', all(88), { highStakes: true }).allowed).toBe(false);
    expect(promote('design_partner', 'pilot', all(90), { highStakes: true }).allowed).toBe(true);
  });

  it('does not let a high total buy a weak dimension', () => {
    const s = { ...all(100), accessibility: FLOOR - 1 };
    expect(total(s)).toBeGreaterThanOrEqual(THRESHOLD.pilot.standard);
    const p = promote('design_partner', 'pilot', s);
    expect(p.allowed).toBe(false);
    expect(p.reasons).toEqual([`Accessibility is ${FLOOR - 1}, under the floor of ${FLOOR}`]);
    // Control: at the floor exactly, it passes.
    expect(promote('design_partner', 'pilot', { ...all(100), accessibility: FLOOR }).allowed).toBe(true);
  });

  it('climbs one rung at a time', () => {
    const p = promote('internal', 'pilot', all(100));
    expect(p.allowed).toBe(false);
    expect(p.reasons[0]).toMatch(/one rung at a time/);
    expect(promote('ga', 'pilot', all(100)).allowed).toBe(false);
    expect(promote('internal', 'design_partner', all(100)).allowed).toBe(true);
  });

  it('reports every reason, not the first', () => {
    const p = promote('internal', 'ga', { ...all(50) });
    expect(p.reasons.length).toBe(1 + DIMENSIONS.length + 1);
  });
});
