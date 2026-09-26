import { describe, expect, it } from 'vitest';
import {
  EMPTY_GRADUATION,
  MAX_SCENARIOS,
  PRESETS,
  addScenario,
  after,
  compareLine,
  defaultNext,
  project,
  readGraduation,
  removeScenario,
  summary,
  type Plan,
} from './graduation';

const plan: Plan = {
  needed: 120,
  perTerm: 15,
  summer: 0,
  costPerTerm: 20000,
  summerCost: 5000,
  next: { season: 'Spring', year: 2027 },
};

describe('the calendar', () => {
  it('goes spring → summer → fall → next spring', () => {
    expect(after({ season: 'Spring', year: 2027 })).toEqual({ season: 'Summer', year: 2027 });
    expect(after({ season: 'Summer', year: 2027 })).toEqual({ season: 'Fall', year: 2027 });
    expect(after({ season: 'Fall', year: 2027 })).toEqual({ season: 'Spring', year: 2028 });
  });

  it('guesses the next term from the month', () => {
    expect(defaultNext(new Date(2026, 1, 1))).toEqual({ season: 'Summer', year: 2026 });
    expect(defaultNext(new Date(2026, 5, 1))).toEqual({ season: 'Fall', year: 2026 });
    expect(defaultNext(new Date(2026, 8, 26))).toEqual({ season: 'Spring', year: 2027 });
  });
});

describe('projecting a finish', () => {
  it('walks whole terms and skips summers with no load', () => {
    // 60 done, 60 left at 15 a term: Spring 27, Fall 27, Spring 28, Fall 28.
    const p = project(plan, 60);
    expect(p.finish).toEqual({ season: 'Fall', year: 2028 });
    expect(p).toMatchObject({ terms: 4, summers: 0, cost: 80000, remaining: 60 });
  });

  it('never reports a fraction of a term — 61 left is still five terms', () => {
    expect(project(plan, 59).terms).toBe(5);
  });

  it('counts summers only when the student takes them, and prices them separately', () => {
    const p = project({ ...plan, summer: 6 }, 60);
    // Sp27 15 · Su27 6 · Fa27 15 · Sp28 15 · Su28 6 → 57; Fa28 15 → 72.
    expect(p.finish).toEqual({ season: 'Fall', year: 2028 });
    expect(p).toMatchObject({ terms: 4, summers: 2, cost: 4 * 20000 + 2 * 5000 });
    // With enough summer load it finishes in a summer, a fall term earlier.
    // Sp27 75 · Su27 84 · Fa27 99 · Sp28 114 · Su28 123.
    const q = project({ ...plan, summer: 9 }, 60);
    expect(q.finish).toEqual({ season: 'Summer', year: 2028 });
    expect(q).toMatchObject({ terms: 3, summers: 2 });
  });

  it('says nothing about cost when none was entered', () => {
    expect(project({ ...plan, costPerTerm: 0 }, 60).cost).toBeNull();
  });

  it('reports no finish when the pace never gets there, rather than looping', () => {
    const p = project({ ...plan, perTerm: 0 }, 60);
    expect(p.finish).toBeNull();
    expect(p.cost).toBeNull();
  });

  it('treats a finished degree as nothing remaining', () => {
    expect(project(plan, 130)).toMatchObject({ finish: null, remaining: 0, terms: 0, cost: 0 });
  });
});

describe('comparing a change', () => {
  const base = project(plan, 60);

  it('says how many more terms and what they cost, without calling anybody late', () => {
    const minor = PRESETS.find((p) => p.id === 'minor')!.build(plan);
    const line = compareLine(base, project(plan, 60, minor));
    expect(line).toBe('Estimated finish: Fall 2029, 2 terms more than your current plan. About $40,000 more.');
    expect(line).not.toMatch(/late|behind|fail/i);
  });

  it('says fewer, and less, for a heavier load', () => {
    // 54 left: four terms at 15, three at 18.
    const heavy = PRESETS.find((p) => p.id === 'heavy')!.build(plan);
    expect(compareLine(project(plan, 66), project(plan, 66, heavy))).toBe(
      'Estimated finish: Spring 2028, 1 term fewer than your current plan. About $20,000 less.',
    );
  });

  it('explains when a scenario never reaches the total', () => {
    expect(compareLine(base, project(plan, 60, { extra: 0, perTerm: 0, summer: 0 }))).toMatch(/not reached/);
  });
});

describe('saved scenarios', () => {
  it('round-trips, and refuses bad numbers and duplicates', () => {
    const d = addScenario(EMPTY_GRADUATION, { name: 'Minor', extra: 18, perTerm: 15, summer: 0 }, 'a');
    expect(readGraduation(JSON.parse(JSON.stringify(d)))).toEqual(d);
    expect(() => readGraduation({ ...d, plan: { ...d.plan, needed: -1 } })).toThrow();
    expect(() => readGraduation({ ...d, plan: { ...d.plan, perTerm: Number.NaN } })).toThrow();
    expect(() => readGraduation({ ...d, scenarios: [...d.scenarios, ...d.scenarios] })).toThrow();
    expect(() => readGraduation({ ...d, plan: { ...d.plan, next: { season: 'Winter', year: 2027 } } })).toThrow();
  });

  it('caps the number of scenarios and removes by id', () => {
    let d = EMPTY_GRADUATION;
    for (let i = 0; i < MAX_SCENARIOS + 3; i++) d = addScenario(d, { name: `S${i}`, extra: 0, perTerm: 15, summer: 0 }, `id${i}`);
    expect(d.scenarios).toHaveLength(MAX_SCENARIOS);
    expect(removeScenario(d, 'id0').scenarios).toHaveLength(MAX_SCENARIOS - 1);
  });

  it('writes an advisor summary that calls itself an estimate', () => {
    const d = addScenario({ ...EMPTY_GRADUATION, plan }, { name: 'Summer courses', extra: 0, perTerm: 15, summer: 9 }, 'a');
    const text = summary(d, 60);
    expect(text.split('\n')[0]).toMatch(/estimates/);
    expect(text).toContain('Current plan: 15 hours a term → Fall 2028, about $80,000 remaining');
    expect(text).toContain(
      'Summer courses: Estimated finish: Summer 2028, 1 term fewer than your current plan. About $10,000 less.',
    );
  });
});
