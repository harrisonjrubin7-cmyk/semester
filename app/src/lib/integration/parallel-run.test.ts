import { describe, expect, it } from 'vitest';
import {
  DEFAULT_PARALLEL_POLICY, assessParallelRun, cutoverDecision, shouldRollBack,
  type ParallelPolicy, type ParallelSample, type SignOff,
} from './parallel-run';

const TENANT = 'school-a';
const policy: ParallelPolicy = {
  ...DEFAULT_PARALLEL_POLICY,
  minSamples: 20,
  minDays: 3,
  fields: { section: [{ name: 'title', kind: 'string' }, { name: 'starts', kind: 'datetime' }, { name: 'seats', kind: 'number' }] },
};

const day = (n: number) => new Date(Date.UTC(2026, 8, 1 + n, 12));
const row = (over: Partial<Record<string, unknown>> = {}) => ({ title: 'Macroeconomics', starts: '2026-10-05T14:00:00Z', seats: 30, ...over });

/** `n` records, one per day cycling over `days`, authoritative = connector unless overridden. */
function samples(n: number, days = 3, tweak: (i: number) => Partial<ParallelSample> = () => ({})): ParallelSample[] {
  return Array.from({ length: n }, (_, i) => ({
    entity: 'section', key: `crn-${i}`, authoritative: row(), connector: row(), at: day(i % days), ...tweak(i),
  }));
}

describe('assessing a parallel run', () => {
  it('is shadow_ok when the connector agrees, over enough records and days (the control)', async () => {
    const a = await assessParallelRun(TENANT, samples(40), policy);
    expect(a).toMatchObject({ verdict: 'shadow_ok', days: 3, blockers: [] });
    expect(a.entities[0]).toMatchObject({ compared: 40, matched: 40, agreement: 1 });
  });

  it('compares meaning, not formatting', async () => {
    const a = await assessParallelRun(TENANT, samples(40, 3, () => ({
      authoritative: row({ title: ' MACROECONOMICS ', starts: '2026-10-05T09:00:00-05:00' }),
    })), policy);
    expect(a.verdict).toBe('shadow_ok');
  });

  it('is insufficient_data on too few records or too few days, and says which', async () => {
    const few = await assessParallelRun(TENANT, samples(10), policy);
    expect(few.verdict).toBe('insufficient_data');
    expect(few.blockers).toContain('section: 10 of 20 required comparisons');
    const short = await assessParallelRun(TENANT, samples(40, 2), policy);
    expect(short.verdict).toBe('insufficient_data');
    expect(short.blockers).toContain('only 2 of 3 required days are covered');
    expect((await assessParallelRun(TENANT, [], policy)).blockers).toContain('no records were compared');
  });

  it('is diverging below the agreement floor, and reports which fields disagree', async () => {
    const a = await assessParallelRun(TENANT, samples(100, 3, (i) => (i < 5 ? { connector: row({ seats: 31 }) } : {})), policy);
    expect(a.verdict).toBe('diverging');
    expect(a.entities[0].fieldMismatches).toEqual({ seats: 5 });
    expect(a.blockers[0]).toMatch(/95\.0% agreement is under 99\.0%/);
  });

  it('is diverging when the connector misses school records or invents its own', async () => {
    const missing = await assessParallelRun(TENANT, samples(100, 3, (i) => (i < 3 ? { connector: null } : {})), policy);
    expect(missing.verdict).toBe('diverging');
    expect(missing.entities[0].missingFromConnector).toBe(3);
    const extra = await assessParallelRun(TENANT, samples(100, 3, (i) => (i < 5 ? { authoritative: null } : {})), policy);
    expect(extra.verdict).toBe('diverging');
    expect(extra.entities[0].extraFromConnector).toBe(5);
  });

  it('refuses an entity it was not told which fields to compare', async () => {
    const a = await assessParallelRun(TENANT, samples(40).map((s) => ({ ...s, entity: 'mystery' })), policy);
    expect(a.verdict).toBe('insufficient_data');
    expect(a.blockers).toContain('mystery: no fields are named for comparison');
  });

  it('reports redacted references and field names, never values', async () => {
    const a = await assessParallelRun(TENANT, samples(100, 3, (i) => (i < 8 ? { connector: row({ title: 'LEAKED-TITLE' }) } : {})), policy);
    const text = JSON.stringify(a);
    expect(text).not.toContain('LEAKED-TITLE');
    expect(text).not.toContain('crn-3');
    expect(a.entities[0].examples).toHaveLength(5);
    expect(a.entities[0].examples[0].reference).toMatch(/^sha256:[0-9a-f]{32}$/);
    expect(a.entities[0].examples[0].fields).toEqual(['title']);
  });
});

describe('deciding whether a cutover may be requested', () => {
  const ok = { verdict: 'shadow_ok' as const, days: 14, entities: [], blockers: [] };
  const at = day(0);
  const registrar: SignOff = { by: 'dana', role: 'registrar', at };
  const security: SignOff = { by: 'lee', role: 'it_security', at };

  it('allows it with a clean run and two independent sign-offs in different roles', () => {
    expect(cutoverDecision(ok, [registrar, security], 'sam')).toEqual({ mayCutOver: true, blockers: [] });
  });

  it('refuses without shadow_ok evidence, whatever the sign-offs', () => {
    for (const verdict of ['insufficient_data', 'diverging'] as const) {
      const d = cutoverDecision({ ...ok, verdict }, [registrar, security], 'sam');
      expect(d.mayCutOver).toBe(false);
      expect(d.blockers[0]).toMatch(/parallel run is/);
    }
  });

  it('refuses the proposer signing their own cutover', () => {
    const d = cutoverDecision(ok, [registrar, { by: 'sam', role: 'semester_integration', at }], 'sam');
    expect(d.mayCutOver).toBe(false);
    expect(d.blockers).toContain('the proposer cannot sign off their own cutover');
  });

  it('refuses one person twice, and two people in one role', () => {
    expect(cutoverDecision(ok, [registrar, { ...registrar, role: 'it_security' }], 'sam').blockers).toContain('two different people must sign off');
    expect(cutoverDecision(ok, [registrar, { by: 'pat', role: 'registrar', at }], 'sam').blockers).toContain('the two sign-offs must be in different roles');
  });

  it('needs someone from the school', () => {
    const d = cutoverDecision(ok, [{ by: 'a', role: 'semester_integration', at }, { by: 'b', role: 'semester_integration', at }], 'sam');
    expect(d.blockers).toContain('one sign-off must come from the school');
  });

  it('refuses no sign-offs at all', () => {
    expect(cutoverDecision(ok, [], 'sam').mayCutOver).toBe(false);
  });
});

describe('after cutover', () => {
  it('offers the way back when agreement falls under a stricter floor than it was approved at', async () => {
    const steady = await assessParallelRun(TENANT, samples(200, 3), policy);
    expect(shouldRollBack(steady, policy)).toBe(false);
    // 99.2% is above the 99% approval floor and under the 99.5% rollback floor.
    const slipping = await assessParallelRun(TENANT, samples(500, 3, (i) => (i < 4 ? { connector: row({ seats: 0 }) } : {})), policy);
    expect(slipping.entities[0].agreement).toBeCloseTo(0.992, 3);
    expect(shouldRollBack(slipping, policy)).toBe(true);
  });
});
