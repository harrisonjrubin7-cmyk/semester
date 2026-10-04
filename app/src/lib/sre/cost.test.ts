import { describe, expect, it } from 'vitest';
import { ANOMALY_RATIO, COST_DRIVERS, isAnomalous, spendRatio, unitCost } from './cost';

describe('the anomaly rule', () => {
  it('is the ratio to the trailing mean, and fires only above 150%', () => {
    expect(spendRatio(150, [100, 100, 100, 100])).toBe(1.5);
    expect(isAnomalous(150, [100, 100, 100, 100])).toBe(false);
    expect(isAnomalous(151, [100, 100, 100, 100])).toBe(true);
    expect(ANOMALY_RATIO).toBe(1.5);
  });

  it('has no opinion without history: null, never zero, never anomalous', () => {
    expect(spendRatio(500, [])).toBeNull();
    expect(isAnomalous(500, [])).toBe(false);
    expect(spendRatio(500, [0, 0, 0, 0])).toBeNull();
  });

  it('a collapse in spend is a ratio under 1, not an anomaly', () => {
    expect(spendRatio(10, [100, 100])).toBeLessThan(1);
    expect(isAnomalous(10, [100, 100])).toBe(false);
  });

  it('refuses negative spend', () => {
    expect(() => spendRatio(-1, [1])).toThrow(RangeError);
    expect(() => spendRatio(1, [1, -1])).toThrow(RangeError);
  });
});

describe('unit cost', () => {
  it('divides spend by units, and says null — not infinity — when nothing was delivered', () => {
    expect(unitCost(120, 60)).toBe(2);
    expect(unitCost(120, 0)).toBeNull();
    expect(() => unitCost(-1, 1)).toThrow(RangeError);
  });
});

describe('the register', () => {
  it('has unique ids', () => {
    expect(new Set(COST_DRIVERS.map((d) => d.id)).size).toBe(COST_DRIVERS.length);
  });

  it('separates drivers that can be stopped from drivers that can only be watched', () => {
    const stoppable = COST_DRIVERS.filter((d) => d.guardrail !== null).map((d) => d.id).sort();
    const watched = COST_DRIVERS.filter((d) => d.guardrail === null).map((d) => d.id).sort();
    expect(stoppable).toEqual(['ai-gateway', 'ai-shared-key', 'email', 'payments']);
    expect(watched).toEqual(['ci-minutes', 'dast', 'database', 'edge-invocations', 'egress', 'storage']);
  });
});
