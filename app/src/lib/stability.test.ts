import { describe, expect, it } from 'vitest';
import { contractDecision, evaluateUnderContract, type Ask, type TenantContract } from './contract/tenantcontract';
import { evaluateFlag } from './flags';
import { DAY as HDAY, DEFAULT_POLICY, add, alive, makeRecord, prune, forget, visible, type State } from './history/evaluations';
import { DAY, KEYS, T0, context, draw } from './verify/flagdraw';
import { rng, runProperty, type Gen } from './verify/property';

/**
 * Soak, in process: does anything accumulate over a long run?
 *
 * The database soak (`supabase/load/run.sh`, `LOAD_SOAK_WINDOWS`) answers that
 * for the paths that touch Postgres. These are the pure ones, and their way of
 * failing over time is quiet: a cache that only grows, a list that is never
 * trimmed, a function that remembers its last call. Wall-clock timing and heap
 * readings are what make soak tests flaky, and this suite is run shuffled, so
 * nothing here reads a clock or the heap. It asserts the structural things a
 * leak would break: the size of the retained state is bounded at every step
 * of a long simulated timeline, and a function called many times, in any
 * order, on inputs that are frozen, gives the answer it gave the first time.
 */

const freeze = <T>(v: T): T => {
  if (v && typeof v === 'object' && !Object.isFrozen(v)) {
    Object.freeze(v);
    for (const k of Object.keys(v)) freeze((v as Record<string, unknown>)[k]);
  }
  return v;
};

describe('the history, over a simulated year of use', () => {
  const policy = { ...DEFAULT_POLICY, maxRecords: 50 };
  const input = (i: number) => ({ subject: `s${i % 7}`, ruleId: 'r', ruleVersion: '1', outcome: 'ok', explanation: 'e', tenantId: i % 3 === 0 ? 'a' : 'b' });

  it('never holds more than its cap, nor a record past its retention, at any of twenty thousand steps', () => {
    let s: State = { records: [], policy };
    let now = T0;
    let peak = 0;
    const r = rng(11);
    for (let i = 0; i < 20_000; i++) {
      now += r.int(0, 60) * 60_000; // up to an hour between evaluations: about two years in all
      s = add(s, makeRecord(input(i), `e${i}`, now, policy), now);
      if (i % 997 === 0) s = forget(s, { tenantId: 'a' });
      if (i % 1499 === 0) s = prune(s, now);
      peak = Math.max(peak, s.records.length);
      if (s.records.length > policy.maxRecords) throw new Error(`step ${i}: ${s.records.length} records held, cap ${policy.maxRecords}`);
      if (s.records.some((x) => !alive(x, policy, now))) throw new Error(`step ${i}: a record is held past its retention`);
    }
    expect(peak).toBeLessThanOrEqual(policy.maxRecords);
    expect(now - T0, 'the timeline was not long enough to mean anything').toBeGreaterThan(400 * HDAY);
  });

  it('settles: the same history, run twice as long, holds no more', () => {
    const run = (steps: number) => {
      let s: State = { records: [], policy };
      let now = T0;
      for (let i = 0; i < steps; i++) { now += 30 * 60_000; s = add(s, makeRecord(input(i), `e${i}`, now, policy), now); }
      return visible(s, now).length;
    };
    expect(run(8000)).toBe(run(16_000));
  });

  it('holds nothing once the history is switched off, however much came before', () => {
    let s: State = { records: [], policy };
    for (let i = 0; i < 500; i++) s = add(s, makeRecord(input(i), `e${i}`, T0 + i * 1000, policy), T0 + i * 1000);
    expect(s.records.length).toBeGreaterThan(0);
    s = prune({ ...s, policy: { ...policy, retentionDays: 0 } }, T0 + 500_000);
    expect(s.records).toEqual([]);
  });
});

describe('the evaluators, called many times', () => {
  const contexts = (): ReturnType<typeof context>[] => {
    const out: ReturnType<typeof context>[] = [];
    const gen: Gen<ReturnType<typeof draw.gen>> = draw;
    runProperty(gen, (d) => { out.push(freeze(context(d))); }, { runs: 400, seed: 5 });
    return out;
  };

  it('gives a flag decision the same answer on the thousandth call as on the first, on frozen input', () => {
    const cs = contexts();
    const first = cs.map((c, i) => evaluateFlag(KEYS[i % KEYS.length]!, c));
    for (let round = 0; round < 100; round++) {
      // In a different order each round, so a function that remembers its last call cannot hide.
      const order = cs.map((_, i) => i).sort((a, b) => ((a * 7 + round * 13) % 101) - ((b * 7 + round * 13) % 101));
      for (const i of order) expect(evaluateFlag(KEYS[i % KEYS.length]!, cs[i]!)).toEqual(first[i]);
    }
  });

  it('does the same for contract decisions, which only read what they are given', () => {
    const c = freeze<TenantContract>({
      tenantId: 't', effectiveFrom: new Date(T0 - DAY).toISOString(), effectiveTo: null,
      modules: [KEYS[0]!, KEYS[1]!], prohibited: [KEYS[2]!],
      ai: { providers: ['Anthropic'], sources: 'institution_only', annualTokenBudget: 1000 },
      regions: ['eu'], retention: { minDays: 30, maxDays: 90 }, adminMfa: true, support: { tier: 'standard', escalation: null },
    });
    const asks: Ask[] = [
      { kind: 'module', key: KEYS[0]! }, { kind: 'module', key: KEYS[2]! }, { kind: 'ai', provider: 'OpenAI', source: 'institution' },
      { kind: 'ai_tokens', usedThisYear: 990, asking: 11 }, { kind: 'data', cls: 'T1', dest: 'semester', region: 'eu' }, { kind: 'admin_action', mfa: false },
    ];
    // Written out by hand, not taken from a first call: a function that remembers
    // its last answer would make a first call wrong in the same way as the rest.
    const expected = [true, false, false, false, true, false];
    const r = rng(3);
    for (let i = 0; i < 30_000; i++) {
      const k = r.int(0, asks.length - 1);
      const d = contractDecision(c, asks[k]!, new Date(T0));
      if (d.allowed !== expected[k]) throw new Error(`call ${i}, ask ${k}: allowed is ${d.allowed}, expected ${expected[k]}`);
    }
    const cs = contexts()[0]!;
    const under = evaluateUnderContract(KEYS[0]!, cs, c, new Date(T0));
    for (let i = 0; i < 2000; i++) expect(evaluateUnderContract(KEYS[0]!, cs, c, new Date(T0))).toEqual(under);
  });

  it('is repeatable: the same seed draws the same contexts, so a failure replays', () => {
    const a = contexts().map((c) => JSON.stringify(c));
    const b = contexts().map((c) => JSON.stringify(c));
    expect(a).toEqual(b);
  });
});
