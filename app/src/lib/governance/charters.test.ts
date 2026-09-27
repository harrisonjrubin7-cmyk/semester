import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { FLAGS } from '../flags';
import { charterProblems, CHARTERS } from './charters';

describe('product charters', () => {
  it('charters every module and ops flag, and nothing that is not a flag', () => {
    const need = FLAGS.filter((f) => f.type === 'module' || f.type === 'ops').map((f) => f.key);
    for (const k of need) expect(CHARTERS.some((c) => c.flag === k), k).toBe(true);
    for (const c of CHARTERS) expect(FLAGS.some((f) => f.key === c.flag), c.flag).toBe(true);
  });

  it('has no empty fields, and reviews no later than the flag it governs', () => {
    for (const c of CHARTERS) {
      expect(charterProblems(c, '2026-09-27'), c.flag).toEqual([]);
      const f = FLAGS.find((x) => x.key === c.flag)!;
      expect(c.reviewAt <= f.reviewAt, c.flag).toBe(true);
    }
  });

  it('flags a lapsed review and a build decision the scorecard did not support (controls)', () => {
    const c = CHARTERS[0];
    expect(charterProblems(c, '2027-01-01').join()).toMatch(/has passed/);
    expect(charterProblems({ ...c, route: 'partner_or_decline' }, '2026-09-27').join()).toMatch(/decided build/);
    expect(charterProblems({ ...c, nonGoals: [] }, '2026-09-27').join()).toMatch(/non-goals/);
  });

  it('charters the whole Operations studio, at the tier of its data, with the switch that really turns it off', () => {
    const c = CHARTERS.find((x) => x.flag === 'module.institutional_operations')!;
    // Every tab the one flag turns on is named somewhere in the charter.
    const source = readFileSync(new URL('../../components/institutional/OperationsStudio.tsx', import.meta.url), 'utf8');
    const tabs = [...source.matchAll(/\{ id: '(\w+)' as const, label: '(\w+)' \}/g)].map((m) => m[2]);
    expect(tabs.length).toBeGreaterThanOrEqual(5);
    const text = JSON.stringify(c).toLowerCase();
    for (const t of tabs) expect(text, t).toContain(t.toLowerCase());
    // Aggregates of education records, some sensitive: not student-owned work.
    expect(c.classification).toBe('T3');
    // The screen reads the build-time flag, so the tenant row alone is not a rollback.
    const gate = readFileSync(new URL('../experience-flags.ts', import.meta.url), 'utf8');
    expect(gate).toMatch(/institutionalOperations: featureState\(env, 'VITE_INSTITUTIONAL_OPERATIONS'/);
    expect(c.killSwitch).toContain('VITE_INSTITUTIONAL_OPERATIONS');
    expect(FLAGS.find((f) => f.key === c.flag)!.rollback).toContain('VITE_INSTITUTIONAL_OPERATIONS');
    // University gates the studio on outcomes:read as my_capabilities() reports
    // it for this school, so the charter names that gate and its source.
    const university = readFileSync(new URL('../../screens/University.tsx', import.meta.url), 'utf8');
    expect(university).toMatch(/operationsAllowed\(verified\)/);
    expect(university).toMatch(/useMyCapabilities\(\)/);
    expect(c.killSwitch).toContain('outcomes:read');
    expect(c.killSwitch).not.toMatch(/open work|checks outcomes:read|nothing on the client supplies/);
    expect(c.killSwitch).toContain('my_capabilities');
  });
});
