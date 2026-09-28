import { describe, expect, it } from 'vitest';
import { KILL_SWITCHES } from '../flags';
import {
  AI_RELEASE_GATE, GATE_IDS, KILL_SWITCH, LIFECYCLE, NIST_FUNCTIONS, PROHIBITED_STARTING_SCOPE, renewalDue, standing,
} from './ai-lifecycle';

const through = (last: number, extra: string[] = []) => {
  const items = new Set<string>(extra);
  for (const g of LIFECYCLE.slice(0, last + 1)) {
    for (const e of g.evidence) items.add(e);
    if (g.id === 'G3') for (const e of AI_RELEASE_GATE) items.add(e);
  }
  return items;
};

describe('the lifecycle', () => {
  it('runs G0 to G5 in order, and every function of the framework owns a gate', () => {
    expect(LIFECYCLE.map((g) => g.id)).toEqual([...GATE_IDS]);
    for (const f of NIST_FUNCTIONS) expect(LIFECYCLE.some((g) => g.owner === f), f).toBe(true);
  });

  it('starts a new use case at intake, with what intake needs', () => {
    const s = standing({ name: 'Explain', touches: [], evidence: new Set() });
    expect(s).toMatchObject({ passed: null, next: 'G0', missing: LIFECYCLE[0].evidence });
  });

  it('passes a use case gate by gate', () => {
    expect(standing({ name: 'x', touches: [], evidence: through(2) })).toMatchObject({ passed: 'G2', next: 'G3' });
    expect(standing({ name: 'x', touches: [], evidence: through(5) })).toEqual({ passed: 'G5', next: null, missing: [] });
  });

  it('does not count later evidence while an earlier gate is open', () => {
    const e = through(4);
    e.delete('Risk assessment');
    const s = standing({ name: 'x', touches: [], evidence: e });
    expect(s).toMatchObject({ passed: 'G0', next: 'G1', missing: ['Risk assessment'] });
  });

  it('holds the pilot gate until every release-gate item is true, the kill switch included', () => {
    const e = through(3);
    e.delete('Monitoring, feedback and kill switch exist');
    expect(standing({ name: 'x', touches: [], evidence: e })).toMatchObject({
      passed: 'G2', next: 'G3', missing: ['Monitoring, feedback and kill switch exist'],
    });
  });

  it('refuses a prohibited starting scope at intake, whatever evidence it carries', () => {
    for (const p of PROHIBITED_STARTING_SCOPE) {
      const s = standing({ name: p, touches: [p], evidence: through(5) });
      expect(s.passed, p).toBeNull();
      expect(s.refused, p).toContain(p);
    }
  });

  it('means an existing flag by the kill switch', () => {
    expect(KILL_SWITCHES as readonly string[]).toContain(KILL_SWITCH);
  });
});

describe('renewal', () => {
  it('is due after a quarter, not on its last day', () => {
    expect(renewalDue('2026-06-28', '2026-09-28')).toBe(false); // 92 days
    expect(renewalDue('2026-06-27', '2026-09-28')).toBe(true);
  });

  it('refuses a date it cannot read', () => {
    expect(() => renewalDue('last spring', '2026-09-28')).toThrow(RangeError);
  });
});
