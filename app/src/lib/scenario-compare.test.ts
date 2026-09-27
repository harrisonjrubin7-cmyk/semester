import { describe, expect, it } from 'vitest';
import { project, readGraduation, type Plan, type Scenario } from './graduation';
import { MORE_PRESETS, compareRows, comparisonText, limits } from './scenario-compare';
import { isCalm } from './today-center';

const plan: Plan = {
  needed: 120,
  perTerm: 15,
  summer: 0,
  costPerTerm: 20_000,
  summerCost: 5_000,
  next: { season: 'Spring', year: 2027 },
};
const scenario = (patch: Partial<Scenario> = {}): Scenario => ({ id: 's', name: 'Change', extra: 0, perTerm: 15, summer: 0, ...patch });
const preset = (id: string) => ({ id, ...MORE_PRESETS.find((p) => p.id === id)!.build(plan) });
const row = (s: Scenario, id: string) => compareRows(plan, 60, s).find((r) => r.id === id)!;

describe('study abroad in the projection', () => {
  it('takes the first term away at its own credits and cost, then carries on at home', () => {
    const home = project(plan, 60);
    const away = project(plan, 60, { extra: 0, perTerm: 15, summer: 0, abroad: { terms: 1, credits: 12, costPerTerm: 30_000 } });
    expect(home).toMatchObject({ terms: 4, finish: { season: 'Fall', year: 2028 }, cost: 80_000 });
    // 60 + 12 abroad + 15·3 = 117 < 120, so a fifth term: Spring 2029.
    expect(away).toMatchObject({ terms: 5, finish: { season: 'Spring', year: 2029 }, cost: 30_000 + 4 * 20_000 });
  });

  it('costs a term abroad as a term at home when no cost was entered for it', () => {
    const away = project(plan, 60, { extra: 0, perTerm: 15, summer: 0, abroad: { terms: 1, credits: 15, costPerTerm: null } });
    expect(away.cost).toBe(project(plan, 60).cost);
  });

  it('counts a term away that transfers nothing as a term that passes', () => {
    const away = project(plan, 60, { extra: 0, perTerm: 15, summer: 0, abroad: { terms: 1, credits: 0, costPerTerm: null } });
    expect(away.terms).toBe(5);
  });

  it('reads and refuses saved abroad plans and account ids', () => {
    const base = { plan, scenarios: [] as unknown[] };
    const ok = { ...base, scenarios: [{ ...scenario(), abroad: { terms: 1, credits: 12, costPerTerm: null }, cloudId: '0b8f5e6a-1c2d-4e3f-8a9b-0c1d2e3f4a5b' }] };
    expect(readGraduation(ok).scenarios[0].abroad).toEqual({ terms: 1, credits: 12, costPerTerm: null });
    expect(() => readGraduation({ ...base, scenarios: [{ ...scenario(), abroad: { terms: 9, credits: 12, costPerTerm: null } }] })).toThrow();
    expect(() => readGraduation({ ...base, scenarios: [{ ...scenario(), cloudId: 'not-an-id' }] })).toThrow();
  });
});

describe('the comparison rows', () => {
  it('writes each change out in words and a sign', () => {
    const minor = scenario({ extra: 18 });
    expect(row(minor, 'needed')).toMatchObject({ current: '120', proposed: '138', change: '+18 credits', changed: true });
    expect(row(minor, 'finish')).toMatchObject({ current: 'Fall 2028', proposed: 'Fall 2029', change: '+2 terms' });
    expect(row(minor, 'cost')).toMatchObject({ current: '$80,000', proposed: '$120,000', change: '+$40,000', changed: true });
    expect(row(scenario(), 'finish')).toMatchObject({ change: 'No change', changed: false });
  });

  it('answers "12 instead of 15"', () => {
    const r = row(preset('twelve'), 'load');
    expect(r).toMatchObject({ current: '15 a term', proposed: '12 a term', change: '−3 credits a term' });
    expect(row(preset('twelve'), 'terms').change).toBe('+1 term');
  });

  it('names a term abroad in the load row instead of calling it no change', () => {
    expect(row(preset('abroad'), 'load')).toMatchObject({ proposed: '15 a term; 12 abroad', change: '12 abroad for 1 term', changed: true });
    expect(row(scenario({ summer: 6 }), 'load').change).toBe('+6 credits each summer');
  });

  it('answers "one extra term" with its cost', () => {
    expect(row(preset('extra'), 'terms').change).toBe('+1 term');
    expect(row(preset('extra'), 'cost').change).toBe('+$20,000');
  });

  it('says a cost is not estimated rather than inventing one', () => {
    const r = compareRows({ ...plan, costPerTerm: 0 }, 60, scenario({ extra: 18 })).find((x) => x.id === 'cost')!;
    expect(r).toMatchObject({ change: 'Not estimated', changed: false });
  });
});

describe('what the table cannot see', () => {
  it('always names sequencing, and adds the notes a change makes likely', () => {
    expect(limits(plan, scenario())[0]).toMatch(/^Sequence:/);
    expect(limits(plan, scenario({ perTerm: 21 })).join(' ')).toMatch(/above many schools’ standard limit/);
    expect(limits(plan, scenario({ perTerm: 9 })).join(' ')).toMatch(/below the full-time line/);
    expect(limits(plan, preset('abroad')).join(' ')).toMatch(/Transfer credit/);
    expect(limits(plan, scenario()).join(' ')).toMatch(/not a bill and not an aid decision/);
  });

  it('promises nothing, and speaks calmly', () => {
    const text = comparisonText(plan, 60, scenario({ extra: 24, perTerm: 9 }));
    expect(text).toMatch(/estimates — planning guidance only/);
    expect(text).not.toMatch(/\b(guarantee|will graduate|you qualify|eligible for)\b/i);
    expect(isCalm(text)).toBe(true);
  });
});
