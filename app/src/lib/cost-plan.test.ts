import { describe, expect, it } from 'vitest';
import { readCostLines, staleness, totalSource, totals, type CostLine } from './cost-plan';
import { readGraduation } from './graduation';

const line = (patch: Partial<CostLine> = {}): CostLine => ({ id: 'a', label: 'Tuition', amount: 18_000, per: 'term', source: 'student_entered', ...patch });

describe('cost lines', () => {
  it('totals by term and by summer', () => {
    expect(totals([line(), line({ id: 'b', label: 'Housing', amount: 6_000 }), line({ id: 'c', per: 'summer', amount: 4_000 })]))
      .toEqual({ perTerm: 24_000, summer: 4_000 });
  });

  it('lets a total claim only its weakest source', () => {
    expect(totalSource([line({ source: 'imported' }), line({ id: 'b', source: 'imported' })])).toBe('imported');
    expect(totalSource([line({ source: 'imported' }), line({ id: 'b' })])).toBe('student_entered');
    expect(totalSource([])).toBeNull();
  });

  it('never accepts "institution verified" for a figure copied by hand', () => {
    expect(() => readCostLines([line({ source: 'institution_verified' as never })])).toThrow();
    expect(() => readCostLines([line({ source: 'estimated' as never })])).toThrow();
  });

  it('keeps where and when an imported figure was copied, and refuses a bad date', () => {
    const got = readCostLines([line({ source: 'imported', from: 'Tuition page 2026–27', on: '2026-08-15' })]);
    expect(got[0]).toMatchObject({ from: 'Tuition page 2026–27', on: '2026-08-15' });
    expect(() => readCostLines([line({ on: 'last year' })])).toThrow();
    expect(() => readCostLines([line(), line()])).toThrow();
  });

  it('flags an imported figure more than a year old', () => {
    const now = new Date(2027, 9, 1);
    expect(staleness(line({ source: 'imported', on: '2026-08-15' }), now)).toMatch(/over a year ago/);
    expect(staleness(line({ source: 'imported', on: '2027-08-15' }), now)).toBeNull();
    expect(staleness(line({ on: '2020-01-01' }), now)).toBeNull();
  });

  it('rides along in a saved graduation plan, and an old plan without it still reads', () => {
    const plan = { needed: 120, perTerm: 15, summer: 0, costPerTerm: 18_000, summerCost: 0, next: { season: 'Spring', year: 2027 } };
    expect(readGraduation({ plan, scenarios: [] }).plan.costLines).toBeUndefined();
    expect(readGraduation({ plan: { ...plan, costLines: [line()] }, scenarios: [] }).plan.costLines).toHaveLength(1);
    expect(() => readGraduation({ plan: { ...plan, costLines: [{ nope: true }] }, scenarios: [] })).toThrow();
  });
});
