import { describe, expect, it } from 'vitest';
import { MIN_COHORT } from '../institution-ops';
import { arrayOf, assertProperty, int, record, runProperty } from '../verify/property';
import { compareOutcomes, type Comparison, type GroupOutcome } from './disparity';

/**
 * Comparing groups, held to the rules that stop a small group being recovered.
 *
 * Generated tables cover the cases nobody writes down: a group of exactly the
 * floor, a group where everyone acted, a group where nobody did. Each rule is
 * then run against a version with the one defect it exists to catch.
 */

type Compare = (g: readonly GroupOutcome[]) => Comparison;

const table = arrayOf(record({ eligible: int(0, 60), acted: int(0, 60) }), 5);
const named = (t: { eligible: number; acted: number }[]): GroupOutcome[] => t.map((g, i) => ({ group: `g${i}`, ...g }));
const cleared = (g: GroupOutcome) => Number.isInteger(g.eligible) && g.acted <= g.eligible && g.eligible >= MIN_COHORT && g.acted >= MIN_COHORT && g.eligible - g.acted >= MIN_COHORT;

const rules = (compare: Compare) => ({
  shownMeansAllThreeCountsClear: (t: { eligible: number; acted: number }[]) => {
    const groups = named(t);
    return compare(groups).rows.every((r) => r.rate === null || cleared(groups.find((g) => g.group === r.group)!));
  },
  gapNeedsEveryGroupShown: (t: { eligible: number; acted: number }[]) => {
    const c = compare(named(t));
    return c.gap === null || (c.rows.length >= 2 && c.rows.every((r) => r.rate !== null));
  },
  orderDoesNotMatter: (t: { eligible: number; acted: number }[]) => {
    const groups = named(t);
    return JSON.stringify(compare(groups)) === JSON.stringify(compare([...groups].reverse()));
  },
  rateIsTheRate: (t: { eligible: number; acted: number }[]) => {
    const groups = named(t);
    return compare(groups).rows.every((r) => r.rate === null || r.rate === groups.find((g) => g.group === r.group)!.acted / groups.find((g) => g.group === r.group)!.eligible);
  },
});
const real = rules(compareOutcomes);
const DEEP = { runs: 3000 };

describe('compareOutcomes', () => {
  it('shows a rate only when the group, those who acted and those who did not all clear the floor', () => assertProperty('three counts', table, real.shownMeansAllThreeCountsClear, DEEP));
  it('computes a gap only when every group is shown', () => assertProperty('no gap by subtraction', table, real.gapNeedsEveryGroupShown, DEEP));
  it('does not depend on the order the groups arrive in', () => assertProperty('order', table, real.orderDoesNotMatter, DEEP));
  it('reports the rate it was given', () => assertProperty('rate', table, real.rateIsTheRate, DEEP));

  it('shows and compares when the counts are large, so the rules above are not vacuous', () => {
    let gaps = 0; let withheld = 0;
    runProperty(table, (t) => { const c = compareOutcomes(named(t)); if (c.gap) gaps++; if (c.rows.some((r) => r.why === 'small')) withheld++; }, { runs: 2000 });
    expect(gaps).toBeGreaterThan(0);
    expect(withheld).toBeGreaterThan(0);
  });

  it('computes the gap between the highest and lowest group', () => {
    const c = compareOutcomes([
      { group: 'a', eligible: 100, acted: 80 },
      { group: 'b', eligible: 50, acted: 20 },
    ]);
    expect(c.gap).toMatchObject({ highest: 'a', lowest: 'b' });
    expect(c.gap!.points).toBeCloseTo(40, 10);
    expect(c.gap!.ratio).toBeCloseTo(2, 10);
  });

  it('withholds a group at exactly the floor minus one, and shows one at the floor', () => {
    const at = (n: number) => compareOutcomes([{ group: 'a', eligible: 3 * MIN_COHORT, acted: n }, { group: 'b', eligible: 40, acted: 20 }]);
    expect(at(MIN_COHORT - 1).rows[0]).toMatchObject({ rate: null, why: 'small' });
    expect(at(MIN_COHORT).rows[0]!.rate).not.toBeNull();
  });

  it('treats impossible counts as invalid, never as a rate', () => {
    for (const g of [{ eligible: 10, acted: 11 }, { eligible: -1, acted: 0 }, { eligible: 12.5, acted: 11 }, { eligible: Number.NaN, acted: 1 }]) {
      expect(compareOutcomes([{ group: 'x', ...g }, { group: 'y', eligible: 40, acted: 20 }]).rows[0]).toMatchObject({ rate: null, why: 'invalid' });
    }
  });

  it('says nothing about cause, and makes no comparison of one group', () => {
    expect(compareOutcomes([{ group: 'a', eligible: 40, acted: 20 }]).gap).toBeNull();
    const c = compareOutcomes([{ group: 'a', eligible: 40, acted: 20 }, { group: 'b', eligible: 40, acted: 10 }]);
    expect(c.note).toMatch(/not a finding of unfairness/);
  });
});

describe('each rule finds the defect it exists to catch', () => {
  const found = (out: { ok: boolean }) => expect(out.ok, 'the property did not notice the planted defect').toBe(false);

  it('a floor applied to the group and not to those who acted', () => {
    // 3 of 12 acted: 25%, from which anyone who knows the 12 knows the 3.
    found(runProperty(table, rules((g) => compareOutcomes(g, 3)).shownMeansAllThreeCountsClear, DEEP));
  });

  it('a gap computed from whichever groups happen to be shown', () => {
    const leaky: Compare = (g) => {
      const c = compareOutcomes(g);
      if (c.gap) return c;
      const s = c.rows.filter((r): r is typeof r & { rate: number } => r.rate !== null);
      if (s.length < 2) return c;
      const hi = s.reduce((a, b) => (b.rate > a.rate ? b : a));
      const lo = s.reduce((a, b) => (b.rate < a.rate ? b : a));
      return { ...c, gap: { highest: hi.group, lowest: lo.group, points: (hi.rate - lo.rate) * 100, ratio: hi.rate / lo.rate } };
    };
    found(runProperty(table, rules(leaky).gapNeedsEveryGroupShown, DEEP));
  });

  it('rows in the order they arrived', () => {
    const arrival: Compare = (g) => {
      const c = compareOutcomes(g);
      return { ...c, rows: g.map((x) => c.rows.find((r) => r.group === x.group)!) };
    };
    found(runProperty(table, rules(arrival).orderDoesNotMatter, DEEP));
  });

  it('a rate that is rounded, so the counts are hidden but the rate is not the rate', () => {
    const rounded: Compare = (g) => {
      const c = compareOutcomes(g);
      return { ...c, rows: c.rows.map((r) => (r.rate === null ? r : { ...r, rate: Math.round(r.rate * 10) / 10 })) };
    };
    found(runProperty(table, rules(rounded).rateIsTheRate, DEEP));
  });
});
