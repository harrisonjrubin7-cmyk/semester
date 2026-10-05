import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { KEPT_TABLES } from '../cloud';
import { assertMachine, assertProperty, bool, command, int, oneOf, record, runMachine, type Gen } from '../verify/property';
import {
  DAY, DEFAULT_POLICY, MAX_RECORDS, MAX_RETENTION_DAYS, MAX_SNAPSHOT_BYTES, MAX_TEXT, RECORD_KEYS,
  add, alive, clampPolicy, fingerprint, forget, makeRecord, prune, readRecord, toExport, visible,
  type EvaluationInput, type EvaluationRecord, type HistoryPolicy, type State,
} from './evaluations';
import { createHistory, idbBacking, readPolicy, savePolicy, type Backing } from './history';

/**
 * The evaluation history, for every sequence of things that can happen to it.
 *
 * Two kinds of claim are tested. Privacy claims are properties: whatever a
 * caller passes in, only the listed fields are stored; whatever policy is
 * asked for, it is short and inside the ceiling. Lifecycle claims are a state
 * machine: through any order of recording, time passing, forgetting and the
 * policy changing, an expired or forgotten record is never shown, the cap
 * holds, and shortening retention hides records at once while lengthening it
 * cannot bring back what was already deleted. The wrapper is then held to the
 * same lifecycle against a real backing and to every way storage can fail.
 * There is no screen here, so there is no accessibility case; the module is
 * local-only, so offline is covered by asserting it has no network path.
 */

const T = Date.UTC(2026, 9, 1);
const policy = (p: Partial<HistoryPolicy> = {}): HistoryPolicy => ({ ...DEFAULT_POLICY, ...p });

const input = (o: Partial<EvaluationInput> = {}): EvaluationInput => ({
  subject: 'degree.requirement.quantitative',
  ruleId: 'psychology-bs',
  ruleVersion: '14',
  outcome: 'Satisfied by STAT 201',
  explanation: 'STAT 201 counts toward quantitative reasoning in catalog year 2026.',
  tenantId: 'vanderbilt',
  freshness: { source: 'registrar catalog', asOf: '2026-09-15' },
  ...o,
});

const rec = (id: string, at: number, extra: Partial<EvaluationRecord> = {}): EvaluationRecord => ({ ...makeRecord(input(), id, at, policy())!, ...extra });

// ── What is stored ────────────────────────────────────────────────────────

const JUNK = ['email', 'name', 'studentId', 'grades', 'gpa', 'inputs', 'record', 'userId', 'ip'] as const;
const junkInput: Gen<{ junk: string[]; long: number; snap: number; snapOn: boolean }> = record({
  junk: { gen: (r) => JUNK.filter(() => r.next() < 0.5), *shrink(v) { for (let i = 0; i < v.length; i++) yield [...v.slice(0, i), ...v.slice(i + 1)]; } } as Gen<string[]>,
  long: int(0, 3000),
  snap: int(0, 9000),
  snapOn: bool,
});

describe('what a record may carry', () => {
  it('stores only the listed fields, however rich the object it was handed', () => {
    assertProperty('minimisation', junkInput, (j) => {
      const extra = Object.fromEntries(j.junk.map((k) => [k, `SECRET-${k}`]));
      const r = makeRecord({ ...input(), ...extra }, 'id', T, policy())!;
      const json = JSON.stringify(r);
      return Object.keys(r).every((k) => (RECORD_KEYS as readonly string[]).includes(k)) && !json.includes('SECRET-');
    }, { runs: 500 });
  });

  it('truncates every text field, so an explanation cannot carry a document', () => {
    assertProperty('truncation', junkInput, (j) => {
      const r = makeRecord(input({ explanation: 'x'.repeat(j.long), outcome: 'y'.repeat(j.long), subject: 'z'.repeat(j.long) }), 'id', T, policy())!;
      return r.explanation.length <= MAX_TEXT && r.outcome.length <= 200 && r.subject.length <= 200;
    }, { runs: 300 });
  });

  it('keeps no copy of the inputs unless the policy allows it, and then only a small one', () => {
    assertProperty('snapshots', junkInput, (j) => {
      const snapshot = { blob: 'q'.repeat(j.snap) };
      const off = makeRecord(input({ snapshot }), 'id', T, policy({ snapshots: false }))!;
      const on = makeRecord(input({ snapshot }), 'id', T, policy({ snapshots: true }))!;
      const small = new TextEncoder().encode(JSON.stringify(snapshot)).length <= MAX_SNAPSHOT_BYTES;
      return !('snapshot' in off) && ('snapshot' in on) === small;
    }, { runs: 300 });
  });

  it('stores nothing at all when the history is off', () => {
    expect(makeRecord(input(), 'id', T, policy({ retentionDays: 0 }))).toBeNull();
  });

  it('round-trips through the reader, and the reader refuses anything that is not exactly a record', () => {
    const r = rec('a', T);
    expect(readRecord(JSON.parse(JSON.stringify(r)))).toEqual(r);
    for (const bad of [null, 7, [], {}, { ...r, at: 'yesterday' }, { ...r, id: 4 }, { ...r, tenantId: 4 }, { ...r, freshness: { source: 4 } }, { ...r, outcome: undefined }, { ...r, at: Number.NaN }]) {
      expect(readRecord(bad), JSON.stringify(bad)?.slice(0, 50)).toBeNull();
    }
  });
});

describe('the policy', () => {
  const asked = record({
    retentionDays: oneOf<number>([-5, 0, 1, 30, 89, 90, 91, 10_000, Number.NaN, Infinity, 12.7]),
    maxRecords: oneOf<number>([-1, 0, 1, 200, 1000, 1001, 1e9, Number.NaN]),
    snapshots: oneOf<boolean | string>([true, false, 'yes']),
    ceilingDays: oneOf<number | undefined>([undefined, 0, 7, 45, 500]),
    ceilingSnapshots: oneOf<boolean | undefined>([undefined, true, false]),
  });

  it('is always short, whole, inside its limits and under a school’s ceiling', () => {
    assertProperty('clamp', asked, (a) => {
      const p = clampPolicy({ retentionDays: a.retentionDays, maxRecords: a.maxRecords, snapshots: a.snapshots as boolean }, { retentionDays: a.ceilingDays, snapshots: a.ceilingSnapshots });
      return Number.isInteger(p.retentionDays) && p.retentionDays >= 0 && p.retentionDays <= MAX_RETENTION_DAYS
        && p.retentionDays <= (a.ceilingDays ?? MAX_RETENTION_DAYS)
        && Number.isInteger(p.maxRecords) && p.maxRecords >= 1 && p.maxRecords <= MAX_RECORDS
        && (!p.snapshots || (a.snapshots === true && a.ceilingSnapshots !== false && p.retentionDays > 0));
    }, { runs: 1000 });
  });

  it('defaults to thirty days, two hundred records and no snapshots', () => {
    expect(clampPolicy(undefined)).toEqual({ retentionDays: 30, maxRecords: 200, snapshots: false });
    expect(clampPolicy({ retentionDays: 10_000 }).retentionDays).toBe(90);
  });

  it('reads the device’s saved policy safely and saves only what was clamped', () => {
    const store = new Map<string, string>();
    const real = globalThis.localStorage;
    Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => void store.set(k, v) } });
    try {
      expect(readPolicy()).toEqual(DEFAULT_POLICY);
      expect(savePolicy({ retentionDays: 5000, snapshots: true })).toEqual({ retentionDays: 90, maxRecords: 200, snapshots: true });
      expect(JSON.parse([...store.values()][0]!).retentionDays).toBe(90);
      store.set([...store.keys()][0]!, '{not json');
      expect(readPolicy()).toEqual(DEFAULT_POLICY);
    } finally {
      Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: real });
    }
  });
});

// ── The lifecycle, as a machine ───────────────────────────────────────────

interface Model { now: number; n: number; added: Map<string, { tenant: string | null; subject: string; at: number }>; gone: Set<string> }
interface Sut { s: State }

const TENANTS = [null, 'a', 'b'] as const;
const SUBJECTS = ['s1', 's2', 's3'] as const;

type C = ReturnType<typeof command<Model, Sut, never>>;
const ids = (s: State, now: number) => visible(s, now).map((r) => r.id);

const machine = (cap = 4) => ({
  init: () => ({ model: { now: T, n: 0, added: new Map(), gone: new Set<string>() } as Model, sut: { s: { records: [], policy: policy({ maxRecords: cap }) } } as Sut }),
  commands: [
    command<Model, Sut, { back: number; tenant: string | null; subject: string }>({
      name: 'record', args: record({ back: int(0, 120), tenant: oneOf<string | null>(TENANTS), subject: oneOf(SUBJECTS) }),
      step: (m, sut, a) => {
        const at = m.now - a.back * DAY / 4;
        const id = `r${m.n++}`;
        const r = makeRecord(input({ tenantId: a.tenant, subject: a.subject }), id, at, sut.s.policy);
        if (r) m.added.set(id, { tenant: a.tenant, subject: a.subject, at });
        sut.s = add(sut.s, r, m.now);
      },
    }),
    command<Model, Sut, { days: number }>({ name: 'time passes', args: record({ days: int(0, 45) }), step: (m, _s, a) => { m.now += a.days * DAY; } }),
    command<Model, Sut, { retention: number }>({
      name: 'set retention', args: record({ retention: oneOf<number>([0, 1, 7, 30, 90, 500]) }),
      step: (_m, sut, a) => { sut.s = { ...sut.s, policy: clampPolicy({ ...sut.s.policy, retentionDays: a.retention }) }; },
    }),
    command<Model, Sut, { tenant: string }>({
      name: 'forget a school', args: record({ tenant: oneOf(['a', 'b']) }),
      step: (m, sut, a) => {
        for (const [id, v] of m.added) if (v.tenant === a.tenant) m.gone.add(id);
        sut.s = forget(sut.s, { tenantId: a.tenant });
      },
    }),
    command<Model, Sut, { subject: string }>({
      name: 'forget a subject', args: record({ subject: oneOf(SUBJECTS) }),
      step: (m, sut, a) => {
        for (const [id, v] of m.added) if (v.subject === a.subject) m.gone.add(id);
        sut.s = forget(sut.s, { subject: a.subject });
      },
    }),
    command<Model, Sut, { days: number }>({
      name: 'forget the old', args: record({ days: int(0, 30) }),
      step: (m, sut, a) => {
        const before = m.now - a.days * DAY;
        for (const [id, v] of m.added) if (v.at <= before) m.gone.add(id);
        sut.s = forget(sut.s, { before });
      },
    }),
    command<Model, Sut, { days: number }>({
      name: 'purge', args: record({ days: int(0, 1) }),
      step: (m, sut) => { sut.s = prune(sut.s, m.now); },
    }),
    command<Model, Sut, { days: number }>({
      name: 'purge, then lengthen', args: record({ days: int(0, 1) }),
      step: (m, sut) => {
        sut.s = prune(sut.s, m.now);
        const before = new Set(ids(sut.s, m.now));
        sut.s = { ...sut.s, policy: clampPolicy({ ...sut.s.policy, retentionDays: MAX_RETENTION_DAYS }) };
        for (const id of ids(sut.s, m.now)) if (!before.has(id)) throw new Error(`${id} came back after it had been purged`);
      },
    }),
  ] as unknown as C[],
  invariant: (m: Model, sut: Sut) => {
    const shown = visible(sut.s, m.now);
    const p = sut.s.policy;
    for (const r of shown) {
      if (!alive(r, p, m.now)) throw new Error(`${r.id} is shown past its retention`);
      if (m.now >= r.at + p.retentionDays * DAY) throw new Error(`${r.id} is shown at or after its expiry`);
      if (m.gone.has(r.id)) throw new Error(`${r.id} was forgotten and is shown`);
      if (!m.added.has(r.id)) throw new Error(`${r.id} was never recorded`);
      if ('snapshot' in r) throw new Error(`${r.id} carries a snapshot the policy never allowed`);
      if (!Object.keys(r).every((k) => (RECORD_KEYS as readonly string[]).includes(k))) throw new Error(`${r.id} carries a field it should not`);
    }
    if (shown.length > p.maxRecords) throw new Error(`${shown.length} shown, cap ${p.maxRecords}`);
    if (p.retentionDays === 0 && shown.length > 0) throw new Error('records are shown with the history off');
    const order = shown.map((r) => r.at);
    if (order.some((t, i) => i > 0 && order[i - 1]! < t)) throw new Error('the list is not newest first');
  },
});

describe('the lifecycle, through any order of events', () => {
  it('never shows an expired, forgotten or capped-out record, however the events fall', () => {
    assertMachine('history', machine(4) as never, { runs: 600, maxCommands: 25 });
  });

  it('holds with a cap of one, where every record displaces the last', () => {
    assertMachine('history, cap one', machine(1) as never, { runs: 300, maxCommands: 20 });
  });

  it('reaches expiry, forgetting, the cap and the off switch, so the machine is not idle', () => {
    let sawExpired = 0; let sawCap = 0; let sawOff = 0; let sawGone = 0;
    const m = machine(2);
    const probing = { ...m, invariant: (mo: Model, su: Sut) => {
      m.invariant(mo, su);
      const p = su.s.policy;
      if (su.s.records.some((r) => !alive(r, p, mo.now)) ) sawExpired++;
      if (visible(su.s, mo.now).length === p.maxRecords) sawCap++;
      if (p.retentionDays === 0) sawOff++;
      if (mo.gone.size > 0) sawGone++;
    } };
    runMachine(probing as never, { runs: 400, maxCommands: 25 });
    expect(sawExpired, 'no record ever expired').toBeGreaterThan(0);
    expect(sawCap, 'the cap was never reached').toBeGreaterThan(0);
    expect(sawOff, 'the history was never switched off').toBeGreaterThan(0);
    expect(sawGone, 'nothing was ever forgotten').toBeGreaterThan(0);
  });
});

describe('the boundaries of the lifecycle', () => {
  const day30 = 30 * DAY;

  it('shows a record through its last instant and not at its expiry', () => {
    const s: State = { records: [rec('a', T)], policy: policy() };
    expect(ids(s, T)).toEqual(['a']);
    expect(ids(s, T + day30 - 1)).toEqual(['a']);
    expect(ids(s, T + day30)).toEqual([]);
  });

  it('does not show a record dated in the future', () => {
    expect(ids({ records: [rec('a', T + 1)], policy: policy() }, T)).toEqual([]);
  });

  it('hides records at once when retention is shortened, and keeps the newest when over the cap', () => {
    const s: State = { records: [rec('old', T - 20 * DAY), rec('new', T - DAY), rec('newest', T)], policy: policy() };
    expect(ids(s, T)).toEqual(['newest', 'new', 'old']);
    expect(ids({ ...s, policy: policy({ retentionDays: 7 }) }, T)).toEqual(['newest', 'new']);
    expect(ids({ ...s, policy: policy({ maxRecords: 1 }) }, T)).toEqual(['newest']);
    expect(ids({ ...s, policy: policy({ retentionDays: 0 }) }, T)).toEqual([]);
  });

  it('forgets nothing for an empty scope, and removes everything a scope names', () => {
    const s: State = { records: [rec('a', T, { tenantId: 'x' }), rec('b', T, { tenantId: 'y' })], policy: policy() };
    expect(forget(s, {})).toBe(s);
    expect(forget(s, { tenantId: 'x' }).records.map((r) => r.id)).toEqual(['b']);
    expect(forget(s, { tenantId: 'x', subject: 'nothing' }).records).toHaveLength(2);
  });

  it('exports every visible record in full, with the policy and an honest note', () => {
    const s: State = { records: [rec('a', T), rec('gone', T - 60 * DAY)], policy: policy() };
    const out = toExport(s, T);
    expect(out).toMatchObject({ kind: 'semester-evaluation-history', version: 1, policy: s.policy });
    expect(out.records.map((r) => r.id)).toEqual(['a']);
    expect(out.note).toMatch(/this device only/);
  });
});

describe('the fingerprint', () => {
  it('is the same for the same inputs in any key order, and different for different inputs', async () => {
    const a = await fingerprint({ credits: 84, rule: 'x', nested: { b: 1, a: 2 } });
    expect(await fingerprint({ nested: { a: 2, b: 1 }, rule: 'x', credits: 84 })).toBe(a);
    expect(await fingerprint({ credits: 85, rule: 'x', nested: { b: 1, a: 2 } })).not.toBe(a);
    expect(a).toMatch(/^[0-9a-f]{64}$/);
  });

  it('never contains the input it was made from', async () => {
    expect(await fingerprint({ name: 'SECRET-VALUE' })).not.toContain('SECRET');
  });
});

// ── The wrapper, against a backing ────────────────────────────────────────

function memory(rows: Record<string, unknown> = {}) {
  const log = { puts: 0, removes: [] as string[][], cleared: 0 };
  const b: Backing & { rows: Record<string, unknown>; fail: Set<string>; log: typeof log } = {
    rows, fail: new Set(), log,
    all: async () => { if (b.fail.has('all')) throw new Error('read failed'); return Object.values(b.rows); },
    put: async (r) => { if (b.fail.has('put')) throw new Error('write failed'); log.puts++; b.rows[r.id] = r; },
    remove: async (ids) => { if (b.fail.has('remove')) throw new Error('delete failed'); log.removes.push([...ids]); for (const id of ids) delete b.rows[id]; },
    clear: async () => { if (b.fail.has('clear')) throw new Error('clear failed'); log.cleared++; for (const k of Object.keys(b.rows)) delete b.rows[k]; },
  };
  return b;
}

function harness(p: Partial<HistoryPolicy> = {}, rows: Record<string, unknown> = {}) {
  const backing = memory(rows);
  let now = T;
  let n = 0;
  let current = policy(p);
  const h = createHistory(backing, { policy: () => current, now: () => now, id: () => `e${n++}` });
  return { h, backing, advance: (days: number) => { now += days * DAY; }, setPolicy: (next: Partial<HistoryPolicy>) => { current = policy(next); } };
}

const value = <T>(o: { ok: true; value: T } | { ok: false; reason: string }): T => { if (!o.ok) throw new Error(o.reason); return o.value; };

describe('the wrapper lifecycle', () => {
  it('records, lists newest first, and keeps on disk exactly what it shows', async () => {
    const { h, backing, advance } = harness();
    await h.record(input({ subject: 'first' }));
    advance(1);
    await h.record(input({ subject: 'second' }));
    expect(value(await h.list()).map((r) => r.subject)).toEqual(['second', 'first']);
    expect(Object.keys(backing.rows).sort()).toEqual(value(await h.list()).map((r) => r.id).sort());
  });

  it('deletes an expired record from storage, not merely from view', async () => {
    const { h, backing, advance } = harness();
    await h.record(input());
    advance(31);
    expect(value(await h.list())).toEqual([]);
    expect(Object.keys(backing.rows)).toHaveLength(1);
    expect(value(await h.purge())).toBe(1);
    expect(backing.rows).toEqual({});
  });

  it('removes what has expired when the next record is written, so nothing lingers', async () => {
    const { h, backing, advance } = harness();
    await h.record(input({ subject: 'old' }));
    advance(31);
    await h.record(input({ subject: 'new' }));
    expect(Object.values(backing.rows).map((r) => (r as EvaluationRecord).subject)).toEqual(['new']);
  });

  it('holds the cap on disk and keeps the newest', async () => {
    const { h, backing, advance } = harness({ maxRecords: 3 });
    for (let i = 0; i < 6; i++) { await h.record(input({ subject: `s${i}` })); advance(0.01); }
    expect(Object.values(backing.rows).map((r) => (r as EvaluationRecord).subject).sort()).toEqual(['s3', 's4', 's5']);
  });

  it('writes nothing when the history is off, and deletes what is there when it is switched off', async () => {
    const { h, backing, setPolicy } = harness();
    await h.record(input());
    await h.record(input());
    expect(Object.keys(backing.rows)).toHaveLength(2);
    setPolicy({ retentionDays: 0 });
    const out = await h.record(input());
    expect(out).toEqual({ ok: true, value: null });
    expect(backing.rows).toEqual({});
    expect(backing.log.puts).toBe(2);
  });

  it('forgets a school’s records, and only that school’s', async () => {
    const { h, backing } = harness();
    await h.record(input({ tenantId: 'a' }));
    await h.record(input({ tenantId: 'b' }));
    await h.record(input({ tenantId: 'a' }));
    expect(value(await h.forget({ tenantId: 'a' }))).toBe(2);
    expect(Object.values(backing.rows).map((r) => (r as EvaluationRecord).tenantId)).toEqual(['b']);
    expect(value(await h.forget({}))).toBe(0);
  });

  it('exports what the student could be shown, and only that', async () => {
    const { h, advance } = harness();
    await h.record(input({ subject: 'old' }));
    advance(31);
    await h.record(input({ subject: 'kept' }));
    const out = value(await h.exportAll());
    expect(out.records.map((r) => r.subject)).toEqual(['kept']);
  });

  it('clears everything, and says so only when it did', async () => {
    const { h, backing } = harness();
    await h.record(input());
    expect(await h.clear()).toBe(true);
    expect(backing.rows).toEqual({});
  });
});

describe('when storage fails', () => {
  it.each(['all', 'put', 'remove'])('reports a failed %s and does not throw into the caller', async (op) => {
    const { h, backing } = harness();
    await h.record(input());
    backing.fail.add(op);
    const results = await Promise.all([h.record(input()), h.list(), h.purge(), h.forget({ tenantId: 'vanderbilt' }), h.exportAll()]);
    for (const r of results) if (!r.ok) expect(r.reason).toMatch(/failed/);
    expect(results.some((r) => !r.ok)).toBe(true);
  });

  it('says it could not clear, rather than claiming it did', async () => {
    const { h, backing } = harness();
    await h.record(input());
    backing.fail.add('clear');
    expect(await h.clear()).toBe(false);
    expect(Object.keys(backing.rows)).toHaveLength(1);
  });

  it('never shows an expired record even when the purge that would delete it fails', async () => {
    const { h, backing, advance } = harness();
    await h.record(input());
    advance(31);
    backing.fail.add('remove');
    expect(value(await h.list())).toEqual([]);
    expect((await h.purge()).ok).toBe(false);
  });

  it('ignores a row that is not a record, never shows it, and removes it at the next purge', async () => {
    const { h, backing } = harness({}, { junk: { id: 'junk', at: 'yesterday' }, good: rec('good', T) });
    expect(value(await h.list()).map((r) => r.id)).toEqual(['good']);
    expect(value(await h.purge())).toBe(1);
    expect(Object.keys(backing.rows)).toEqual(['good']);
  });
});

describe('the production backing', () => {
  /** Enough of an object store for the adapter: what it asks for is what it is given. */
  function fakeStore() {
    const rows: Record<string, unknown> = {};
    const calls: string[] = [];
    const os = {
      getAll: () => { calls.push('getAll'); return { result: Object.values(rows) }; },
      put: (r: { id: string }) => { calls.push('put'); rows[r.id] = r; return { result: r.id }; },
      delete: (id: string) => { calls.push('delete'); delete rows[id]; return { result: undefined }; },
      clear: () => { calls.push('clear'); for (const k of Object.keys(rows)) delete rows[k]; return { result: undefined }; },
    };
    return {
      rows, calls,
      tx: async (_m: string, run: (s: unknown) => { result: unknown }) => run(os).result,
      work: async (_m: string, run: (s: unknown, done: (v: unknown) => void) => void) => { run(os, () => undefined); },
    };
  }

  it('reads, writes, removes many in one transaction, and clears', async () => {
    const s = fakeStore();
    const b = idbBacking(s as never);
    await b.put(rec('a', T)); await b.put(rec('b', T)); await b.put(rec('c', T));
    expect((await b.all()).length).toBe(3);
    await b.remove(['a', 'b']);
    expect(Object.keys(s.rows)).toEqual(['c']);
    await b.remove([]);
    expect(s.calls.filter((c) => c === 'delete')).toHaveLength(2);
    await b.clear();
    expect(s.rows).toEqual({});
  });
});

// ── It never leaves the device ────────────────────────────────────────────

describe('it stays on the device', () => {
  const dir = join(import.meta.dirname);
  const source = ['evaluations.ts', 'history.ts'].map((f) => readFileSync(join(dir, f), 'utf8')).join('\n');
  const code = source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

  it('has no path to the network: no fetch, beacon, socket, online check or account client', () => {
    for (const banned of [/\bfetch\(/, /sendBeacon/, /XMLHttpRequest/, /WebSocket/, /navigator\.onLine/, /from '\.\.\/cloud'/, /from '\.\.\/connect'/, /supabase/i]) {
      expect(code, String(banned)).not.toMatch(banned);
    }
  });

  it('is not among the tables the account syncs', () => {
    expect(KEPT_TABLES.length).toBeGreaterThan(0);
    for (const t of KEPT_TABLES) expect(String(t), String(t)).not.toMatch(/history|evaluation/i);
  });

  it('opens its own database, which Erase from this device is made to clear', () => {
    expect(source).toMatch(/DB_NAME = 'semester-history'/);
    const erase = readFileSync(join(dir, '../erase.ts'), 'utf8');
    expect(erase).toContain("'semester-history'");
    expect(erase).toContain('clearHistory()');
  });
});

describe('the document', () => {
  const doc = readFileSync(join(import.meta.dirname, '../../../../docs/TIME-TRAVEL-HISTORY.md'), 'utf8');

  it('states the defaults the code has, so the document cannot drift from them', () => {
    expect(doc).toContain(`**${DEFAULT_POLICY.retentionDays} days**`);
    expect(doc).toContain(`**${MAX_RETENTION_DAYS}**`);
    expect(doc).toContain(`**${DEFAULT_POLICY.maxRecords} records**`);
    expect(doc).toContain(`more than ${MAX_RECORDS}`);
    expect(doc).toContain(`${MAX_SNAPSHOT_BYTES / 1024} KB`);
  });

  it('lists every field a record may carry', () => {
    for (const k of ['id', 'time', 'school', 'subject', 'rule', 'outcome', 'explanation', 'source', 'fingerprint']) expect(doc.toLowerCase(), k).toContain(k);
  });

  it('claims no approval, and names what is not built and what must be decided', () => {
    expect(doc).toMatch(/not an approved retention schedule/);
    expect(doc).toMatch(/nothing here claims legal, institutional or counsel approval/);
    expect(doc).toMatch(/Nothing records yet/);
    expect(doc).toMatch(/Decisions required/);
  });
});
