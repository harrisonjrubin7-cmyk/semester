import { describe, expect, it } from 'vitest';
import { DIRECTIONAL_BENCHMARKS, METRICS, methodology, netRevenueRetention, optOutAlert, ratio } from './kpi';

describe('KPI formulas', () => {
  it('has no rate for an empty cohort instead of a misleading zero', () => {
    expect(ratio(0, 0)).toBeNull();
    expect(ratio(5, 0)).toBeNull();
    expect(ratio(-1, 10)).toBeNull();
    expect(ratio(0, 10)).toBe(0);
    expect(ratio(28, 100)).toBeCloseTo(0.28);
  });

  it('computes net revenue retention as the plan defines it', () => {
    expect(netRevenueRetention(100_000, 20_000, 5_000, 10_000)).toBeCloseTo(1.05);
    expect(netRevenueRetention(0, 10, 0, 0)).toBeNull();
  });

  it('defines every metric with a numerator and denominator for export', () => {
    for (const m of Object.values(METRICS)) {
      expect(m.numerator.length, m.key).toBeGreaterThan(0);
      expect(m.denominator.length, m.key).toBeGreaterThan(0);
    }
    const rows = methodology(['click_to_open_rate', 'cost_per_enrolled_student'], 'multi_touch');
    expect(rows[0].caveat).toMatch(/privacy/);
    expect(rows.every((r) => r.attribution_model === 'multi_touch' && /none/.test(r.causal_claim))).toBe(true);
  });

  it('keeps benchmarks as ranges with a note, never a single target', () => {
    for (const b of DIRECTIONAL_BENCHMARKS) {
      expect(b.low).toBeLessThanOrEqual(b.high);
      expect(b.note.length, b.metric).toBeGreaterThan(0);
    }
  });

  it('asks for a review above the ~0.1% unsubscribe reference, and not on tiny sends', () => {
    expect(optOutAlert(1, 999)).toBe(false);
    expect(optOutAlert(1, 1000)).toBe(false);
    expect(optOutAlert(2, 1000)).toBe(true);
  });
});
