/**
 * The check primitives: each looks at both sides and returns who disagrees.
 *
 * They take already-extracted rows, never a connection, so the same function
 * runs in a rehearsal, in the parallel run and in a test. They return opaque
 * references only — the caller supplies `ref` for each row already redacted —
 * so nothing here can leak a value into an evidence file.
 *
 * Money is integer minor units (cents). A float sum is how a reconciliation
 * reports a one-cent drift that is really arithmetic.
 */
import type { CheckResult, DataDomain, EvidenceClass, Failure, Severity } from './types.ts';

interface Meta {
  id: string;
  domain: DataDomain;
  severity: Severity;
}

function result(meta: Meta, evidenceClass: EvidenceClass, examined: number, failures: Failure[]): CheckResult {
  return { ...meta, evidenceClass, examined, failures };
}

/** Volumes by entity. A mismatch is a failure; a match proves nothing else. */
export function countParity(meta: Meta, source: Readonly<Record<string, number>>, target: Readonly<Record<string, number>>, expectedRejected: Readonly<Record<string, number>> = {}): CheckResult {
  const entities = new Set([...Object.keys(source), ...Object.keys(target)]);
  const failures: Failure[] = [];
  for (const e of entities) {
    const expected = (source[e] ?? 0) - (expectedRejected[e] ?? 0);
    if (expected !== (target[e] ?? 0)) failures.push({ ref: e, code: 'count_mismatch' });
  }
  return result(meta, 'count', entities.size, failures);
}

export interface KeyedRow {
  /** The source system's natural key. */
  key: string;
  ref: string;
}

/**
 * Identity: the crosswalk is the only thing that says which target row is
 * which source row. Anything in the source with no target, a target with no
 * source, or two targets claiming one source is a failure.
 */
export function keyParity(
  meta: Meta,
  source: readonly KeyedRow[],
  target: readonly (KeyedRow & { sourceKey: string })[],
  intentionallyExcluded: ReadonlySet<string> = new Set(),
): CheckResult {
  const failures: Failure[] = [];
  const seen = new Map<string, number>();
  for (const t of target) seen.set(t.sourceKey, (seen.get(t.sourceKey) ?? 0) + 1);
  const sourceKeys = new Set(source.map((s) => s.key));
  for (const s of source) {
    if (intentionallyExcluded.has(s.key)) continue;
    const n = seen.get(s.key) ?? 0;
    if (n === 0) failures.push({ ref: s.ref, code: 'missing_in_target' });
    else if (n > 1) failures.push({ ref: s.ref, code: 'duplicated_in_target' });
  }
  for (const t of target) if (!sourceKeys.has(t.sourceKey)) failures.push({ ref: t.ref, code: 'no_source' });
  return result(meta, 'key', source.length + target.length, failures);
}

export interface FieldPair {
  ref: string;
  source: unknown;
  target: unknown;
}

/**
 * Semantic parity of one field. `normalize` is the *declared* transformation
 * (trim, code table, unit, time zone); a value that differs after it has been
 * applied is a real difference, not a formatting one.
 */
export function valueParity(meta: Meta, pairs: readonly FieldPair[], normalize: (v: unknown) => unknown = (v) => v): CheckResult {
  const failures: Failure[] = [];
  for (const p of pairs) {
    if (JSON.stringify(normalize(p.source)) !== JSON.stringify(p.target)) failures.push({ ref: p.ref, code: 'value_differs' });
  }
  return result(meta, 'semantic', pairs.length, failures);
}

/**
 * Every child must point at a parent that exists. `expectedParent` (optional)
 * says which parent it should be — landing on *a* parent is not the same as
 * landing on the right one, which is how a section ends up in the wrong term.
 */
export function referentialIntegrity(
  meta: Meta,
  children: readonly { ref: string; parentKey: string | null; expectedParentKey?: string }[],
  parentKeys: ReadonlySet<string>,
): CheckResult {
  const failures: Failure[] = [];
  for (const c of children) {
    if (c.parentKey === null || !parentKeys.has(c.parentKey)) failures.push({ ref: c.ref, code: 'orphan' });
    else if (c.expectedParentKey !== undefined && c.expectedParentKey !== c.parentKey) failures.push({ ref: c.ref, code: 'wrong_parent' });
  }
  return result(meta, 'relationship', children.length, failures);
}

export interface Group {
  key: string;
  /** Integer minor units, or a count. */
  amount: number;
}

/** A sum per group (account, term, fund, student) on both sides, to a stated tolerance in the same unit. */
export function aggregateParity(meta: Meta, source: readonly Group[], target: readonly Group[], tolerance = 0): CheckResult {
  const sum = (rows: readonly Group[]) => {
    const m = new Map<string, number>();
    for (const r of rows) m.set(r.key, (m.get(r.key) ?? 0) + r.amount);
    return m;
  };
  const s = sum(source);
  const t = sum(target);
  const failures: Failure[] = [];
  for (const k of new Set([...s.keys(), ...t.keys()])) {
    if (Math.abs((s.get(k) ?? 0) - (t.get(k) ?? 0)) > tolerance) failures.push({ ref: k, code: 'aggregate_differs' });
  }
  return result(meta, 'outcome', new Set([...s.keys(), ...t.keys()]).size, failures);
}

export interface HistoryEntry {
  /** The entity this event belongs to. */
  entity: string;
  /** What happened, in the source's own words, so a re-labelled event is a difference. */
  kind: string;
  /** When it happened *there*. A migration date here is the failure this check exists for. */
  at: string;
  actor: string;
}

/**
 * The past arrived: same events, same order, same original timestamps and
 * actors, per entity. A target whose events all say "created by migration at
 * cutover" has the right count and has lost the history.
 */
export function historyPreserved(meta: Meta, source: readonly HistoryEntry[], target: readonly HistoryEntry[]): CheckResult {
  const by = (rows: readonly HistoryEntry[]) => {
    const m = new Map<string, HistoryEntry[]>();
    for (const r of rows) m.set(r.entity, [...(m.get(r.entity) ?? []), r]);
    return m;
  };
  const s = by(source);
  const t = by(target);
  const failures: Failure[] = [];
  for (const [entity, srcEvents] of s) {
    const tgt = t.get(entity) ?? [];
    const sameLength = srcEvents.length === tgt.length;
    const same = sameLength && srcEvents.every((e, i) => e.kind === tgt[i].kind && e.at === tgt[i].at && e.actor === tgt[i].actor);
    if (!same) failures.push({ ref: entity, code: sameLength ? 'history_rewritten' : 'history_truncated' });
  }
  return result(meta, 'history', s.size, failures);
}

export interface Interval {
  entity: string;
  /** ISO dates, inclusive start and exclusive end; `null` end is open. */
  from: string;
  to: string | null;
}

/**
 * Effective-dated rows (a program of study, a housing assignment, a hold)
 * must not overlap or leave a gap the source did not have. Compare the
 * *shape* of the timeline, not only each row.
 */
export function temporalContinuity(meta: Meta, source: readonly Interval[], target: readonly Interval[]): CheckResult {
  const shape = (rows: readonly Interval[]) => {
    const m = new Map<string, { overlaps: number; gaps: number }>();
    const grouped = new Map<string, Interval[]>();
    for (const r of rows) grouped.set(r.entity, [...(grouped.get(r.entity) ?? []), r]);
    for (const [e, list] of grouped) {
      const sorted = [...list].sort((a, b) => a.from.localeCompare(b.from));
      let overlaps = 0;
      let gaps = 0;
      for (let i = 1; i < sorted.length; i++) {
        const prevEnd = sorted[i - 1].to;
        if (prevEnd === null || prevEnd > sorted[i].from) overlaps++;
        else if (prevEnd < sorted[i].from) gaps++;
      }
      m.set(e, { overlaps, gaps });
    }
    return m;
  };
  const s = shape(source);
  const t = shape(target);
  const failures: Failure[] = [];
  for (const [e, a] of s) {
    const b = t.get(e) ?? { overlaps: -1, gaps: -1 };
    if (a.overlaps !== b.overlaps || a.gaps !== b.gaps) failures.push({ ref: e, code: 'timeline_shape_differs' });
  }
  return result(meta, 'history', s.size, failures);
}

export interface Grant {
  principal: string;
  resource: string;
  action: string;
}

/**
 * Effective access, compared as sets. Two directions are not the same fault:
 * a grant the source did not give is *widening* (critical, someone can read
 * what they could not) and a grant that vanished is *narrowing* (someone is
 * locked out on day one). Callers give each `severity`; the check reports
 * both under different codes so the queue can route them differently.
 */
export function permissionParity(meta: Meta, source: readonly Grant[], target: readonly Grant[], refOf: (g: Grant) => string): CheckResult {
  const id = (g: Grant) => `${g.principal}\u0000${g.resource}\u0000${g.action}`;
  const s = new Set(source.map(id));
  const t = new Set(target.map(id));
  const failures: Failure[] = [];
  for (const g of target) if (!s.has(id(g))) failures.push({ ref: refOf(g), code: 'access_widened' });
  for (const g of source) if (!t.has(id(g))) failures.push({ ref: refOf(g), code: 'access_narrowed' });
  return result(meta, 'permission', new Set([...s, ...t]).size, failures);
}

export interface Outcome {
  ref: string;
  /** What the institution relies on today, from the source system or its signed report. */
  expected: number | string;
  /** The same figure recomputed by Semester from the migrated inputs. */
  recomputed: number | string;
}

/**
 * The business result, recomputed, not copied. Standing, balance, GPA,
 * remaining degree requirements: if Semester only stored the number the
 * source produced, matching it proves nothing about the inputs.
 */
export function outcomeParity(meta: Meta, outcomes: readonly Outcome[], tolerance = 0): CheckResult {
  const failures: Failure[] = [];
  for (const o of outcomes) {
    const same = typeof o.expected === 'number' && typeof o.recomputed === 'number' ? Math.abs(o.expected - o.recomputed) <= tolerance : o.expected === o.recomputed;
    if (!same) failures.push({ ref: o.ref, code: 'outcome_differs' });
  }
  return result(meta, 'outcome', outcomes.length, failures);
}
