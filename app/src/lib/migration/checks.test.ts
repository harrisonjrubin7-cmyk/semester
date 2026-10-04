import { describe, expect, it } from 'vitest';
import {
  aggregateParity, countParity, historyPreserved, keyParity, outcomeParity, permissionParity,
  referentialIntegrity, temporalContinuity, valueParity,
} from './checks.ts';

const m = (id: string) => ({ id, domain: 'finance' as const, severity: 'high' as const });

describe('check primitives', () => {
  it('countParity subtracts declared rejections and names the entity that differs', () => {
    expect(countParity(m('c'), { a: 10, b: 5 }, { a: 9, b: 5 }, { a: 1 }).failures).toEqual([]);
    expect(countParity(m('c'), { a: 10 }, { a: 9 }).failures).toEqual([{ ref: 'a', code: 'count_mismatch' }]);
  });

  it('keyParity finds missing, duplicated and sourceless rows, and honours declared exclusions', () => {
    const src = [{ key: 'A', ref: 'ra' }, { key: 'B', ref: 'rb' }, { key: 'C', ref: 'rc' }, { key: 'D', ref: 'rd' }];
    const tgt = [
      { key: 't1', ref: 'ta', sourceKey: 'A' },
      { key: 't2', ref: 'tb1', sourceKey: 'B' },
      { key: 't3', ref: 'tb2', sourceKey: 'B' },
      { key: 't4', ref: 'tz', sourceKey: 'Z' },
    ];
    const r = keyParity(m('k'), src, tgt, new Set(['D']));
    expect(r.failures.map((f) => f.code).sort()).toEqual(['duplicated_in_target', 'missing_in_target', 'no_source']);
  });

  it('valueParity applies only the declared normalisation', () => {
    const pairs = [{ ref: 'x', source: ' 4.0 ', target: '4.0' }, { ref: 'y', source: 'W', target: 'F' }];
    const r = valueParity(m('v'), pairs, (v) => String(v).trim());
    expect(r.failures).toEqual([{ ref: 'y', code: 'value_differs' }]);
  });

  it('referentialIntegrity separates an orphan from landing on the wrong parent', () => {
    const r = referentialIntegrity(
      m('r'),
      [
        { ref: 'ok', parentKey: 'P1', expectedParentKey: 'P1' },
        { ref: 'orph', parentKey: 'GONE' },
        { ref: 'nul', parentKey: null },
        { ref: 'wrong', parentKey: 'P2', expectedParentKey: 'P1' },
      ],
      new Set(['P1', 'P2']),
    );
    expect(r.failures).toEqual([
      { ref: 'orph', code: 'orphan' }, { ref: 'nul', code: 'orphan' }, { ref: 'wrong', code: 'wrong_parent' },
    ]);
  });

  it('aggregateParity compares sums in integer minor units, to a stated tolerance', () => {
    const s = [{ key: 'acct1', amount: 10_000 }, { key: 'acct1', amount: -2_500 }, { key: 'acct2', amount: 1 }];
    const t = [{ key: 'acct1', amount: 7_500 }, { key: 'acct2', amount: 2 }];
    expect(aggregateParity(m('a'), s, t).failures).toEqual([{ ref: 'acct2', code: 'aggregate_differs' }]);
    expect(aggregateParity(m('a'), s, t, 1).failures).toEqual([]);
  });

  it('historyPreserved fails a rewritten timeline and a truncated one differently', () => {
    const ev = (entity: string, kind: string, at: string, actor = 'reg') => ({ entity, kind, at, actor });
    const src = [ev('s1', 'grade_set', '2025-05-10'), ev('s1', 'grade_changed', '2025-06-01'), ev('s2', 'grade_set', '2025-05-10')];
    const rewritten = [ev('s1', 'grade_set', '2025-05-10'), ev('s1', 'grade_changed', '2026-10-04', 'migration'), ev('s2', 'grade_set', '2025-05-10')];
    const truncated = [ev('s1', 'grade_set', '2025-05-10'), ev('s2', 'grade_set', '2025-05-10')];
    expect(historyPreserved(m('h'), src, rewritten).failures).toEqual([{ ref: 's1', code: 'history_rewritten' }]);
    expect(historyPreserved(m('h'), src, truncated).failures).toEqual([{ ref: 's1', code: 'history_truncated' }]);
    expect(historyPreserved(m('h'), src, src).failures).toEqual([]);
  });

  it('temporalContinuity compares the shape of a timeline, not each row', () => {
    const iv = (entity: string, from: string, to: string | null) => ({ entity, from, to });
    const src = [iv('p', '2024-01-01', '2024-06-01'), iv('p', '2024-06-01', null)];
    const newOverlap = [iv('p', '2024-01-01', '2024-07-01'), iv('p', '2024-06-01', null)];
    const newGap = [iv('p', '2024-01-01', '2024-05-01'), iv('p', '2024-06-01', null)];
    expect(temporalContinuity(m('t'), src, src).failures).toEqual([]);
    expect(temporalContinuity(m('t'), src, newOverlap).failures).toHaveLength(1);
    expect(temporalContinuity(m('t'), src, newGap).failures).toHaveLength(1);
  });

  it('permissionParity reports widening and narrowing under different codes', () => {
    const g = (principal: string, resource: string, action = 'read') => ({ principal, resource, action });
    const r = permissionParity(m('p'), [g('adv', 'r1'), g('stu', 'r1')], [g('adv', 'r1'), g('guard', 'r1')], (x) => `${x.principal}>${x.resource}`);
    expect(r.failures).toEqual([{ ref: 'guard>r1', code: 'access_widened' }, { ref: 'stu>r1', code: 'access_narrowed' }]);
  });

  it('outcomeParity compares recomputed to expected, numbers with tolerance, strings exactly', () => {
    const r = outcomeParity(m('o'), [
      { ref: 'a', expected: 3.5, recomputed: 3.5 },
      { ref: 'b', expected: 3.5, recomputed: 3.49 },
      { ref: 'c', expected: 'good', recomputed: 'probation' },
    ]);
    expect(r.failures.map((f) => f.ref)).toEqual(['b', 'c']);
    expect(outcomeParity(m('o'), [{ ref: 'b', expected: 3.5, recomputed: 3.49 }], 0.02).failures).toEqual([]);
  });

  it('a target with exactly the right counts can still be wrong everywhere that matters', () => {
    // The scenario the whole module exists for. Same row counts, and:
    // two students swapped their transcripts; the history was restamped;
    // a guardian gained access; the balance is off by a cent.
    const counts = countParity(m('count'), { students: 2, results: 2, grants: 2 }, { students: 2, results: 2, grants: 2 });
    expect(counts.failures).toEqual([]);

    const rel = referentialIntegrity(
      m('rel'),
      [{ ref: 'r1', parentKey: 'S2', expectedParentKey: 'S1' }, { ref: 'r2', parentKey: 'S1', expectedParentKey: 'S2' }],
      new Set(['S1', 'S2']),
    );
    const hist = historyPreserved(m('hist'), [{ entity: 's', kind: 'k', at: '2024-01-01', actor: 'a' }], [{ entity: 's', kind: 'k', at: '2026-10-04', actor: 'migration' }]);
    const perm = permissionParity(m('perm'), [{ principal: 'stu', resource: 'r', action: 'read' }], [{ principal: 'stu', resource: 'r', action: 'read' }, { principal: 'guard', resource: 'r', action: 'read' }], () => 'g');
    const bal = aggregateParity(m('bal'), [{ key: 'a', amount: 100_00 }], [{ key: 'a', amount: 100_01 }]);

    for (const r of [rel, hist, perm, bal]) expect(r.failures.length).toBeGreaterThan(0);
  });
});
