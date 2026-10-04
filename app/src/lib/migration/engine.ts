/**
 * The invariant engine: does the target mean what the source meant?
 *
 * Row counts are the one check a broken migration passes, which is why this
 * file exists. Two students' grades swapped, a balance re-derived from a
 * rounded float, a revoked guardian consent loaded as active, a module tree
 * with its children shuffled — every one of those leaves the counts equal. So
 * the checks here ask about *meaning*: identity (no two people collapsed into
 * one), relationships (nothing orphaned that was not orphaned before), history
 * (every grade change, in order), outcomes (the balance, the GPA, the credits
 * earned, recomputed from rows on both sides), permissions (nobody gains
 * access they did not have) and content (a document is the same bytes).
 *
 * Ten kinds of check, each declarative (`types.ts`), each returning how many
 * rows it looked at. That number matters as much as the findings: a check that
 * examined nothing proved nothing, and "no problems found" from an empty
 * population is exactly what a broken probe also reports. `quality.ts` refuses
 * to call a domain clean on vacuous checks, and `proveProbes` below goes
 * further: it injects a known defect of each kind into a copy of the real
 * data and requires the check to notice. A probe that has never failed is not
 * known to be a probe.
 *
 * Findings carry the field and entity name and never a value; the key they
 * carry stays in memory until `quality.ts` redacts it.
 */
import type {
  Compare, Crosswalk, Dataset, DomainSpec, EntitySpec, InvariantKind, InvariantResult, InvariantSpec, Origin, Pair, RawFinding, Row,
  Gravity,
} from './engine-types.ts';
import type { EvidenceClass } from './types.ts';

const SEP = '\u001f';
const present = (v: unknown) => v !== null && v !== undefined && v !== '';
const keyOf = (row: Row, fields: readonly string[]) => fields.map((f) => String(row[f] ?? '')).join(SEP);
const num = (v: unknown): number | null => (present(v) && Number.isFinite(Number(v)) ? Number(v) : null);

/** Two values, as the institution would call them the same. An absent value and an empty one agree. */
export function same(a: unknown, b: unknown, how: Compare = 'exact'): boolean {
  if (!present(a) && !present(b)) return true;
  if (!present(a) || !present(b)) return false;
  if (how === 'number') {
    const x = num(a);
    const y = num(b);
    return x !== null && y !== null && x === y;
  }
  if (how === 'date') {
    const x = Date.parse(String(a));
    const y = Date.parse(String(b));
    return Number.isFinite(x) && Number.isFinite(y) && x === y;
  }
  return String(a) === String(b);
}

/* ── Context ───────────────────────────────────────────────────────────── */

type Side = 'source' | 'target';

interface Ctx {
  entities: ReadonlyMap<string, EntitySpec>;
  pair: Pair;
  indexes: Map<string, Map<string, Row>>;
  reverses: Map<string, Map<string, string>>;
}

function context(domain: DomainSpec, pair: Pair): Ctx {
  const all = [...domain.entities, ...domain.references];
  return { entities: new Map(all.map((e) => [e.name, e])), pair, indexes: new Map(), reverses: new Map() };
}

function entityOf(c: Ctx, name: string): EntitySpec {
  const e = c.entities.get(name);
  if (!e) throw new Error(`The domain declares no entity "${name}".`);
  return e;
}

const rowsOf = (c: Ctx, side: Side, entity: string): readonly Row[] => c.pair[side][entity] ?? [];

function indexOf(c: Ctx, side: Side, entity: string): Map<string, Row> {
  const id = `${side}:${entity}`;
  let idx = c.indexes.get(id);
  if (!idx) {
    const key = entityOf(c, entity).key;
    idx = new Map(rowsOf(c, side, entity).map((r) => [keyOf(r, key), r]));
    c.indexes.set(id, idx);
  }
  return idx;
}

/** Target key to source key. The first source wins; a shared target is the crosswalk check's finding. */
function reverseOf(c: Ctx, entity: string): Map<string, string> {
  let rev = c.reverses.get(entity);
  if (!rev) {
    rev = new Map();
    for (const [sk, tk] of Object.entries(c.pair.crosswalk[entity] ?? {})) if (!rev.has(tk)) rev.set(tk, sk);
    c.reverses.set(entity, rev);
  }
  return rev;
}

const isExcluded = (c: Ctx, entity: string, sourceKey: string) => c.pair.excluded?.[entity]?.[sourceKey] !== undefined;

/**
 * What each kind of check proves, in the Migration pack's own evidence classes
 * (`types.ts`), so the gate that refuses a count-only domain reads these
 * results the same as any other.
 */
export const CLASS_OF_KIND: Readonly<Record<InvariantKind, EvidenceClass>> = {
  crosswalk: 'key',
  unique: 'key',
  reference: 'relationship',
  preserved: 'semantic',
  derived: 'outcome',
  history: 'history',
  permission: 'permission',
  order: 'relationship',
  bounded: 'outcome',
  temporal: 'semantic',
};

function finding(spec: InvariantSpec, key: string, origin: Origin, code: string, what: string, gravity: Gravity = spec.gravity, evidenceClass: EvidenceClass = CLASS_OF_KIND[spec.kind]): RawFinding {
  return { invariant: spec.id, key, origin, gravity, code, evidenceClass, what };
}

function groupBy(rows: readonly Row[], field: string): Map<string, Row[]> {
  const out = new Map<string, Row[]>();
  for (const r of rows) {
    const v = r[field];
    if (!present(v)) continue;
    const k = String(v);
    const list = out.get(k);
    if (list) list.push(r);
    else out.set(k, [r]);
  }
  return out;
}

const keep = (rows: readonly Row[], filter?: { field: string; in: readonly string[] }) =>
  filter ? rows.filter((r) => filter.in.includes(String(r[filter.field] ?? ''))) : rows;

const byPosition = (field: string) => (a: Row, b: Row) => (num(a[field]) ?? 0) - (num(b[field]) ?? 0);

type Out = { examined: number; findings: RawFinding[] };

/* ── The ten checks ────────────────────────────────────────────────────── */

function runCrosswalk(spec: Extract<InvariantSpec, { kind: 'crosswalk' }>, c: Ctx): Out {
  const key = entityOf(c, spec.entity).key;
  const targets = indexOf(c, 'target', spec.entity);
  const cw = c.pair.crosswalk[spec.entity] ?? {};
  const merged = new Set(c.pair.approvedMerges?.[spec.entity] ?? []);
  const findings: RawFinding[] = [];
  const claimed = new Map<string, string[]>();
  const source = rowsOf(c, 'source', spec.entity);
  for (const row of source) {
    const sk = keyOf(row, key);
    const tk = cw[sk];
    if (isExcluded(c, spec.entity, sk)) {
      if (tk !== undefined) findings.push(finding(spec, sk, 'migration', 'excluded_migrated', 'a row the institution excluded was migrated'));
      continue;
    }
    if (tk === undefined) findings.push(finding(spec, sk, 'migration', 'missing_in_target', 'no crosswalk entry'));
    else if (!targets.has(tk)) findings.push(finding(spec, sk, 'migration', 'missing_in_target', 'crosswalk points at no target row'));
    else claimed.set(tk, [...(claimed.get(tk) ?? []), sk]);
  }
  for (const [tk, sks] of claimed) {
    if (sks.length > 1 && !merged.has(tk)) {
      for (const sk of sks) findings.push(finding(spec, sk, 'migration', 'merged_in_target', 'two source rows share one target row'));
    }
  }
  for (const row of rowsOf(c, 'target', spec.entity)) {
    const tk = keyOf(row, key);
    if (!claimed.has(tk)) findings.push(finding(spec, `target:${tk}`, 'migration', 'no_source', 'target row has no source row'));
  }
  return { examined: source.length, findings };
}

function runUnique(spec: Extract<InvariantSpec, { kind: 'unique' }>, c: Ctx): Out {
  const key = entityOf(c, spec.entity).key;
  const groups = (side: Side) => {
    const out = new Map<string, Row[]>();
    for (const r of rowsOf(c, side, spec.entity)) {
      if (spec.fields.some((f) => !present(r[f]))) continue;
      const k = keyOf(r, spec.fields);
      out.set(k, [...(out.get(k) ?? []), r]);
    }
    return out;
  };
  const target = groups('target');
  const inherited = new Set([...groups('source')].filter(([, rows]) => rows.length > 1).map(([k]) => k));
  const rev = reverseOf(c, spec.entity);
  const findings: RawFinding[] = [];
  let examined = 0;
  for (const [k, rows] of target) {
    examined += rows.length;
    if (rows.length < 2) continue;
    for (const row of rows.slice(1)) {
      const tk = keyOf(row, key);
      findings.push(finding(spec, rev.get(tk) ?? `target:${tk}`, inherited.has(k) ? 'source' : 'migration', 'duplicated_in_target', `${spec.entity} repeats (${spec.fields.join(', ')})`));
    }
  }
  return { examined, findings };
}

function runReference(spec: Extract<InvariantSpec, { kind: 'reference' }>, c: Ctx): Out {
  const key = entityOf(c, spec.entity).key;
  const toKey = entityOf(c, spec.to).key;
  if (toKey.length !== 1) throw new Error(`${spec.id}: "${spec.to}" has a composite key and cannot be referenced by one field.`);
  const parents = indexOf(c, 'target', spec.to);
  const sourceParents = indexOf(c, 'source', spec.to);
  const sources = indexOf(c, 'source', spec.entity);
  const rev = reverseOf(c, spec.entity);
  const findings: RawFinding[] = [];
  let examined = 0;
  for (const row of rowsOf(c, 'target', spec.entity)) {
    const v = row[spec.field];
    if (!present(v)) continue;
    examined += 1;
    if (parents.has(String(v))) continue;
    const tk = keyOf(row, key);
    const sk = rev.get(tk);
    const was = sk === undefined ? undefined : sources.get(sk)?.[spec.field];
    const inherited = present(was) && !sourceParents.has(String(was));
    findings.push(finding(spec, sk ?? `target:${tk}`, inherited ? 'source' : 'migration', 'orphan', `${spec.entity}.${spec.field} has no ${spec.to}`));
  }
  return { examined, findings };
}

function runPreserved(spec: Extract<InvariantSpec, { kind: 'preserved' }>, c: Ctx): Out {
  const key = entityOf(c, spec.entity).key;
  const targets = indexOf(c, 'target', spec.entity);
  const cw = c.pair.crosswalk[spec.entity] ?? {};
  const findings: RawFinding[] = [];
  let examined = 0;
  for (const row of rowsOf(c, 'source', spec.entity)) {
    const sk = keyOf(row, key);
    const mapped = cw[sk] === undefined ? undefined : targets.get(cw[sk]);
    if (!mapped || isExcluded(c, spec.entity, sk)) continue;
    examined += 1;
    for (const f of spec.fields) {
      if (!same(row[f], mapped[f], spec.compare)) findings.push(finding(spec, sk, 'migration', 'value_differs', `${spec.entity}.${f} differs`));
    }
    for (const link of spec.links ?? []) {
      const was = row[link.field];
      if (!present(was)) {
        if (present(mapped[link.field])) findings.push(finding(spec, sk, 'migration', 'wrong_parent', `${spec.entity}.${link.field} appeared from nowhere`, spec.gravity, 'relationship'));
        continue;
      }
      if (isExcluded(c, link.to, String(was))) continue;
      if (String(mapped[link.field] ?? '') !== c.pair.crosswalk[link.to]?.[String(was)]) {
        findings.push(finding(spec, sk, 'migration', 'wrong_parent', `${spec.entity}.${link.field} now points at a different ${link.to}`, spec.gravity, 'relationship'));
      }
    }
  }
  return { examined, findings };
}

function runDerived(spec: Extract<InvariantSpec, { kind: 'derived' }>, c: Ctx): Out {
  const key = entityOf(c, spec.entity).key;
  const targets = indexOf(c, 'target', spec.entity);
  const cw = c.pair.crosswalk[spec.entity] ?? {};
  const children = (side: Side) => groupBy(keep(rowsOf(c, side, spec.child), spec.filter), spec.childSubject);
  const source = children('source');
  const target = children('target');
  const findings: RawFinding[] = [];
  const aggregate = (rows: readonly Row[] | undefined): number => {
    let total = 0;
    let weights = 0;
    for (const r of rows ?? []) {
      const v = num(r[spec.value]) ?? 0;
      const w = spec.weight ? num(r[spec.weight]) ?? 0 : 1;
      total += spec.agg === 'sum' ? v : v * w;
      weights += w;
    }
    return spec.agg === 'sum' ? total : weights === 0 ? 0 : total / weights;
  };
  const integers = (rows: readonly Row[] | undefined) => (rows ?? []).every((r) => !present(r[spec.value]) || Number.isInteger(Number(r[spec.value])));
  let examined = 0;
  for (const row of rowsOf(c, 'source', spec.entity)) {
    const sk = keyOf(row, key);
    const tk = cw[sk];
    const mapped = tk === undefined ? undefined : targets.get(tk);
    if (!mapped || isExcluded(c, spec.entity, sk)) continue;
    examined += 1;
    const s = aggregate(source.get(sk));
    const t = aggregate(target.get(tk!));
    if (spec.integer && !integers(source.get(sk))) findings.push(finding(spec, sk, 'source', 'not_whole_number', `${spec.child}.${spec.value} is not a whole number`, spec.gravity, 'semantic'));
    if (spec.integer && !integers(target.get(tk!))) findings.push(finding(spec, sk, 'migration', 'not_whole_number', `${spec.child}.${spec.value} is not a whole number`, spec.gravity, 'semantic'));
    if (Math.abs(s - t) > spec.tolerance + 1e-9) findings.push(finding(spec, sk, 'migration', 'outcome_differs', `${spec.id}: the outcome differs from the source's`));
    if (spec.stated) {
      const sv = num(row[spec.stated]);
      const tv = num(mapped[spec.stated]);
      const sourceDisagrees = sv !== null && Math.abs(sv - s) > spec.tolerance + 1e-9;
      if (tv !== null && Math.abs(tv - t) > spec.tolerance + 1e-9) {
        findings.push(finding(spec, sk, sourceDisagrees && sv === tv ? 'source' : 'migration', 'outcome_differs', `${spec.entity}.${spec.stated} disagrees with its own ${spec.child} rows`));
      }
    }
  }
  return { examined, findings };
}

function runHistory(spec: Extract<InvariantSpec, { kind: 'history' }>, c: Ctx): Out {
  const cw = c.pair.crosswalk[spec.subjectEntity] ?? {};
  const targetSubjects = indexOf(c, 'target', spec.subjectEntity);
  const sourceSubjects = indexOf(c, 'source', spec.subjectEntity);
  const ordered = (side: Side) => {
    const groups = groupBy(rowsOf(c, side, spec.entity), spec.subject);
    for (const rows of groups.values()) rows.sort(byPosition(spec.seq));
    return groups;
  };
  const source = ordered('source');
  const target = ordered('target');
  const findings: RawFinding[] = [];
  let examined = 0;
  for (const [sk, events] of source) {
    if (isExcluded(c, spec.subjectEntity, sk)) continue;
    examined += 1;
    const tk = cw[sk];
    if (tk === undefined) {
      findings.push(finding(spec, sk, 'migration', 'missing_in_target', `${spec.subjectEntity} with history is not in the crosswalk`));
      continue;
    }
    const moved = target.get(tk) ?? [];
    if (moved.length !== events.length) findings.push(finding(spec, sk, 'migration', 'history_truncated', `${spec.entity} history has a different number of events`));
    else if (events.some((e, i) => !same(e[spec.value], moved[i][spec.value]))) findings.push(finding(spec, sk, 'migration', 'history_rewritten', `${spec.entity}.${spec.value} differs at some step of the history`));
    if (new Set(moved.map((e) => String(e[spec.seq]))).size !== moved.length) findings.push(finding(spec, sk, 'migration', 'history_rewritten', `${spec.entity} history order is ambiguous`));
    if (spec.current) {
      const last = moved.at(-1);
      const row = targetSubjects.get(tk);
      if (last && row && !same(row[spec.current], last[spec.value])) {
        const lastSource = events.at(-1);
        const was = sourceSubjects.get(sk);
        const inherited = !!lastSource && !!was && !same(was[spec.current], lastSource[spec.value]);
        findings.push(finding(spec, sk, inherited ? 'source' : 'migration', 'history_rewritten', `${spec.subjectEntity}.${spec.current} is not the last ${spec.entity} event`));
      }
    }
  }
  return { examined, findings };
}

function runPermission(spec: Extract<InvariantSpec, { kind: 'permission' }>, c: Ctx): Out {
  const sourceGrants = rowsOf(c, 'source', spec.entity);
  const targetGrants = rowsOf(c, 'target', spec.entity);
  const sourcePairs = new Set(sourceGrants.map((g) => `${String(g[spec.principal])}${SEP}${String(g[spec.resource])}`));
  const principals = reverseOf(c, spec.principalEntity);
  const resources = spec.resourceEntity ? reverseOf(c, spec.resourceEntity) : null;
  const consent = spec.requires
    ? new Set(
        rowsOf(c, 'target', spec.requires.entity)
          .filter((r) => !spec.requires!.active || String(r[spec.requires!.active]).toLowerCase() === 'true')
          .map((r) => `${String(r[spec.requires!.principal])}${SEP}${String(r[spec.requires!.resource])}`),
      )
    : null;
  const findings: RawFinding[] = [];
  const kept = new Set<string>();
  for (const g of targetGrants) {
    const tp = String(g[spec.principal]);
    const tr = String(g[spec.resource]);
    const sp = principals.get(tp);
    const sr = resources ? resources.get(tr) : tr;
    const known = sp !== undefined && sr !== undefined && sourcePairs.has(`${sp}${SEP}${sr}`);
    if (known) kept.add(`${sp}${SEP}${sr}`);
    else findings.push(finding(spec, sp ?? `target:${tp}`, 'migration', 'access_widened', `${spec.entity} grants access the source did not`));
    if (consent && !consent.has(`${tp}${SEP}${tr}`)) findings.push(finding(spec, sp ?? `target:${tp}`, 'migration', 'access_without_consent', `${spec.entity} grant has no active ${spec.requires!.entity} record`));
  }
  for (const g of sourceGrants) {
    const sp = String(g[spec.principal]);
    const sr = String(g[spec.resource]);
    if (isExcluded(c, spec.principalEntity, sp) || (spec.resourceEntity && isExcluded(c, spec.resourceEntity, sr))) continue;
    if (!kept.has(`${sp}${SEP}${sr}`)) findings.push(finding(spec, sp, 'migration', 'access_narrowed', `${spec.entity} access the source gave was not carried`, 'major'));
  }
  return { examined: Math.max(sourceGrants.length, targetGrants.length), findings };
}

function runOrder(spec: Extract<InvariantSpec, { kind: 'order' }>, c: Ctx): Out {
  const key = entityOf(c, spec.entity).key;
  const cw = c.pair.crosswalk[spec.entity] ?? {};
  const parentCw = spec.groupEntity ? c.pair.crosswalk[spec.groupEntity] ?? {} : null;
  const sourceGroups = groupBy(rowsOf(c, 'source', spec.entity), spec.group);
  const targetGroups = groupBy(rowsOf(c, 'target', spec.entity), spec.group);
  const findings: RawFinding[] = [];
  let examined = 0;
  for (const [g, rows] of sourceGroups) {
    if (rows.length < 2) continue;
    const tg = parentCw ? parentCw[g] : g;
    if (tg === undefined) continue;
    const sorted = [...rows].sort(byPosition(spec.position));
    const expected = sorted.map((r) => cw[keyOf(r, key)]);
    if (expected.some((k) => k === undefined)) continue;
    examined += 1;
    if (new Set(rows.map((r) => String(r[spec.position]))).size !== rows.length) findings.push(finding(spec, g, 'source', 'order_ambiguous', `${spec.entity}.${spec.position} has ties, so the order was never defined`));
    const actual = [...(targetGroups.get(tg) ?? [])].sort(byPosition(spec.position)).map((r) => keyOf(r, key));
    if (actual.length !== expected.length || actual.some((k, i) => k !== expected[i])) findings.push(finding(spec, g, 'migration', 'order_differs', `${spec.entity} sibling order differs`));
  }
  return { examined, findings };
}

function runBounded(spec: Extract<InvariantSpec, { kind: 'bounded' }>, c: Ctx): Out {
  const members = (side: Side) => groupBy(keep(rowsOf(c, side, spec.entity), spec.filter), spec.group);
  const target = members('target');
  const source = members('source');
  const sourceCaps = indexOf(c, 'source', spec.groupEntity);
  const rev = reverseOf(c, spec.groupEntity);
  const memberKey = entityOf(c, spec.entity).key;
  const groupKey = entityOf(c, spec.groupEntity).key;
  const findings: RawFinding[] = [];
  let examined = 0;
  for (const cap of rowsOf(c, 'target', spec.groupEntity)) {
    examined += 1;
    const tk = keyOf(cap, groupKey);
    const sk = rev.get(tk);
    const n = target.get(tk)?.length ?? 0;
    const limit = num(cap[spec.capacity]);
    const sourceRow = sk === undefined ? undefined : sourceCaps.get(sk);
    if (limit === null && n > 0) findings.push(finding(spec, sk ?? `target:${tk}`, 'migration', 'capacity_missing', `${spec.groupEntity}.${spec.capacity} is missing`));
    else if (limit !== null && n > limit) {
      const sn = sk === undefined ? 0 : source.get(sk)?.length ?? 0;
      const sl = sourceRow ? num(sourceRow[spec.capacity]) : null;
      findings.push(finding(spec, sk ?? `target:${tk}`, sl !== null && sn > sl ? 'source' : 'migration', 'over_capacity', `${spec.entity} count exceeds ${spec.groupEntity}.${spec.capacity}`));
    }
    if (spec.equalToSource && sk !== undefined) {
      const sn = (source.get(sk) ?? []).filter((r) => !isExcluded(c, spec.entity, keyOf(r, memberKey))).length;
      if (sn !== n) findings.push(finding(spec, sk, 'migration', 'count_differs', `${spec.entity} count differs from the source's`));
    }
  }
  return { examined, findings };
}

function runTemporal(spec: Extract<InvariantSpec, { kind: 'temporal' }>, c: Ctx): Out {
  const key = entityOf(c, spec.entity).key;
  const sources = indexOf(c, 'source', spec.entity);
  const rev = reverseOf(c, spec.entity);
  const findings: RawFinding[] = [];
  let examined = 0;
  const inverted = (row: Row | undefined) => {
    if (!row || !present(row[spec.start]) || !present(row[spec.end])) return false;
    const a = Date.parse(String(row[spec.start]));
    const b = Date.parse(String(row[spec.end]));
    return !Number.isFinite(a) || !Number.isFinite(b) || a > b;
  };
  for (const row of rowsOf(c, 'target', spec.entity)) {
    if (!present(row[spec.start]) || !present(row[spec.end])) continue;
    examined += 1;
    if (!inverted(row)) continue;
    const tk = keyOf(row, key);
    const sk = rev.get(tk);
    findings.push(finding(spec, sk ?? `target:${tk}`, inverted(sk === undefined ? undefined : sources.get(sk)) ? 'source' : 'migration', 'dates_inverted', `${spec.entity}.${spec.start} is not before ${spec.entity}.${spec.end}`));
  }
  return { examined, findings };
}

function runInvariant(spec: InvariantSpec, c: Ctx): InvariantResult {
  const out = ((): Out => {
    switch (spec.kind) {
      case 'crosswalk': return runCrosswalk(spec, c);
      case 'unique': return runUnique(spec, c);
      case 'reference': return runReference(spec, c);
      case 'preserved': return runPreserved(spec, c);
      case 'derived': return runDerived(spec, c);
      case 'history': return runHistory(spec, c);
      case 'permission': return runPermission(spec, c);
      case 'order': return runOrder(spec, c);
      case 'bounded': return runBounded(spec, c);
      case 'temporal': return runTemporal(spec, c);
    }
  })();
  return { invariant: spec.id, kind: spec.kind, gravity: spec.gravity, ...out };
}

/** Every invariant of a domain against one pair, in declaration order. */
export function runDomain(domain: DomainSpec, pair: Pair): InvariantResult[] {
  const c = context(domain, pair);
  return domain.invariants.map((spec) => runInvariant(spec, c));
}

/* ── Row counts: a precondition, never evidence ────────────────────────── */

export interface Counts {
  source: Record<string, number>;
  target: Record<string, number>;
  /** What the institution excluded or approved merging, per entity: the volume that is *expected* to be missing. */
  expectedRejected: Record<string, number>;
}

/**
 * Volumes per entity, with the rows that are *supposed* to be missing taken
 * out: source rows the institution excluded, and source rows collapsed into an
 * approved merge. The comparison itself is `checks.ts` `countParity`, the one
 * implementation; equal counts earn nothing by themselves (`gate.ts` requires
 * the other evidence classes) but unequal counts are always a defect.
 */
export function countsFor(domain: DomainSpec, pair: Pair): Counts {
  const out: Counts = { source: {}, target: {}, expectedRejected: {} };
  for (const e of domain.entities) {
    const source = pair.source[e.name] ?? [];
    const present = new Set(source.map((r) => keyOf(r, e.key)));
    const excluded = Object.keys(pair.excluded?.[e.name] ?? {}).filter((k) => present.has(k)).length;
    const cw = pair.crosswalk[e.name] ?? {};
    const merges = new Set(pair.approvedMerges?.[e.name] ?? []);
    const into = new Map<string, number>();
    for (const sk of present) {
      const tk = cw[sk];
      if (tk !== undefined && merges.has(tk)) into.set(tk, (into.get(tk) ?? 0) + 1);
    }
    const merged = [...into.values()].reduce((n, k) => n + (k - 1), 0);
    out.source[e.name] = source.length;
    out.target[e.name] = (pair.target[e.name] ?? []).length;
    out.expectedRejected[e.name] = excluded + merged;
  }
  return out;
}

/* ── Proving the probes ────────────────────────────────────────────────── */

const withTarget = (pair: Pair, entity: string, rows: readonly Row[]): Pair => ({ ...pair, target: { ...pair.target, [entity]: rows } });

const bump = (v: unknown): unknown => (num(v) !== null ? Number(v) + 1 : `${String(v)}~`);

/** Every defect of this kind that can be injected into this data; none means it has nowhere to go. */
type Mutator<K extends InvariantSpec['kind']> = (spec: Extract<InvariantSpec, { kind: K }>, c: Ctx) => Pair[];

const some = (p: Pair | null): Pair[] => (p ? [p] : []);

const MUTATORS: { [K in InvariantSpec['kind']]: Mutator<K> } = {
  crosswalk(spec, c) {
    const key = entityOf(c, spec.entity).key;
    const targets = indexOf(c, 'target', spec.entity);
    const cw = c.pair.crosswalk[spec.entity] ?? {};
    for (const row of rowsOf(c, 'source', spec.entity)) {
      const tk = cw[keyOf(row, key)];
      if (tk !== undefined && targets.has(tk) && !isExcluded(c, spec.entity, keyOf(row, key))) {
        return [withTarget(c.pair, spec.entity, rowsOf(c, 'target', spec.entity).filter((r) => keyOf(r, key) !== tk))];
      }
    }
    return [];
  },
  unique(spec, c) {
    const row = rowsOf(c, 'target', spec.entity).find((r) => spec.fields.every((f) => present(r[f])));
    return some(row ? withTarget(c.pair, spec.entity, [...rowsOf(c, 'target', spec.entity), { ...row }]) : null);
  },
  reference(spec, c) {
    const parents = indexOf(c, 'target', spec.to);
    const rows = rowsOf(c, 'target', spec.entity);
    const row = rows.find((r) => present(r[spec.field]) && parents.has(String(r[spec.field])));
    return some(row ? withTarget(c.pair, spec.entity, rows.map((r) => (r === row ? { ...r, [spec.field]: '__orphan__' } : r))) : null);
  },
  preserved(spec, c) {
    const key = entityOf(c, spec.entity).key;
    const targets = indexOf(c, 'target', spec.entity);
    const cw = c.pair.crosswalk[spec.entity] ?? {};
    const rows = rowsOf(c, 'target', spec.entity);
    const mapped = rowsOf(c, 'source', spec.entity).flatMap((row) => {
      const hit = cw[keyOf(row, key)] === undefined ? undefined : targets.get(cw[keyOf(row, key)]);
      return hit ? [{ row, hit }] : [];
    });
    const out: Pair[] = [];
    const byField = mapped.find((m) => spec.fields.some((f) => present(m.hit[f]) && same(m.row[f], m.hit[f], spec.compare)));
    if (byField) {
      const field = spec.fields.find((f) => present(byField.hit[f]) && same(byField.row[f], byField.hit[f], spec.compare))!;
      out.push(withTarget(c.pair, spec.entity, rows.map((r) => (r === byField.hit ? { ...r, [field]: bump(r[field]) } : r))));
    }
    for (const link of (spec.links ?? []).filter((l) => !entityOf(c, spec.entity).key.includes(l.field))) {
      // A link inside the row's own key cannot move without changing which row it is; the crosswalk check owns that.
      const parents = [...indexOf(c, 'target', link.to).keys()];
      const hit = mapped.find((m) => present(m.hit[link.field]) && parents.some((p) => p !== String(m.hit[link.field])));
      if (!hit) continue;
      // A valid key to the wrong parent: the failure `reference` cannot see.
      const elsewhere = parents.find((p) => p !== String(hit.hit[link.field]))!;
      out.push(withTarget(c.pair, spec.entity, rows.map((r) => (r === hit.hit ? { ...r, [link.field]: elsewhere } : r))));
    }
    return out;
  },
  derived(spec, c) {
    const key = entityOf(c, spec.entity).key;
    const cw = c.pair.crosswalk[spec.entity] ?? {};
    const children = groupBy(keep(rowsOf(c, 'target', spec.child), spec.filter), spec.childSubject);
    for (const row of rowsOf(c, 'source', spec.entity)) {
      const rows = children.get(cw[keyOf(row, key)] ?? '\u0000') ?? [];
      const weights = rows.reduce((n, r) => n + (spec.weight ? num(r[spec.weight]) ?? 0 : 1), 0);
      const victim = rows.find((r) => num(r[spec.value]) !== null && (!spec.weight || (num(r[spec.weight]) ?? 0) > 0));
      if (!victim) continue;
      const w = spec.weight ? num(victim[spec.weight]) ?? 1 : 1;
      const delta = Math.ceil((spec.tolerance * 2 + 1) * (spec.agg === 'weighted_mean' ? weights / w : 1));
      return [withTarget(c.pair, spec.child, rowsOf(c, 'target', spec.child).map((r) => (r === victim ? { ...r, [spec.value]: Number(r[spec.value]) + delta } : r)))];
    }
    return [];
  },
  history(spec, c) {
    const cw = c.pair.crosswalk[spec.subjectEntity] ?? {};
    const target = groupBy(rowsOf(c, 'target', spec.entity), spec.subject);
    for (const sk of groupBy(rowsOf(c, 'source', spec.entity), spec.subject).keys()) {
      const events = [...(target.get(cw[sk] ?? '\u0000') ?? [])].sort(byPosition(spec.seq));
      const last = events.at(-1);
      if (!last) continue;
      const rows = rowsOf(c, 'target', spec.entity);
      return [withTarget(c.pair, spec.entity, events.length > 1 ? rows.filter((r) => r !== last) : rows.map((r) => (r === last ? { ...r, [spec.value]: bump(r[spec.value]) } : r)))];
    }
    return [];
  },
  permission(spec, c) {
    const grant = rowsOf(c, 'target', spec.entity)[0];
    return some(grant ? withTarget(c.pair, spec.entity, [...rowsOf(c, 'target', spec.entity), { ...grant, [spec.resource]: '__extra__' }]) : null);
  },
  order(spec, c) {
    for (const rows of groupBy(rowsOf(c, 'target', spec.entity), spec.group).values()) {
      const sorted = [...rows].sort(byPosition(spec.position));
      const i = sorted.findIndex((r, n) => n > 0 && num(r[spec.position]) !== num(sorted[n - 1][spec.position]));
      if (i < 1) continue;
      const [a, b] = [sorted[i - 1], sorted[i]];
      return [withTarget(c.pair, spec.entity, rowsOf(c, 'target', spec.entity).map((r) => (r === a ? { ...r, [spec.position]: b[spec.position] } : r === b ? { ...r, [spec.position]: a[spec.position] } : r)))];
    }
    return [];
  },
  bounded(spec, c) {
    const groupKey = entityOf(c, spec.groupEntity).key;
    const members = groupBy(keep(rowsOf(c, 'target', spec.entity), spec.filter), spec.group);
    const cap = rowsOf(c, 'target', spec.groupEntity).find((r) => (members.get(keyOf(r, groupKey))?.length ?? 0) > 0);
    if (!cap) return [];
    const n = members.get(keyOf(cap, groupKey))!.length;
    return [withTarget(c.pair, spec.groupEntity, rowsOf(c, 'target', spec.groupEntity).map((r) => (r === cap ? { ...r, [spec.capacity]: n - 1 } : r)))];
  },
  temporal(spec, c) {
    const row = rowsOf(c, 'target', spec.entity).find((r) => {
      const a = Date.parse(String(r[spec.start]));
      const b = Date.parse(String(r[spec.end]));
      return Number.isFinite(a) && Number.isFinite(b) && a < b;
    });
    return some(row ? withTarget(c.pair, spec.entity, rowsOf(c, 'target', spec.entity).map((r) => (r === row ? { ...r, [spec.start]: r[spec.end], [spec.end]: r[spec.start] } : r))) : null);
  },
};

export type ProbeStatus = 'detected' | 'missed' | 'vacuous' | 'unmutable';

export interface ProbeProof {
  invariant: string;
  kind: InvariantSpec['kind'];
  status: ProbeStatus;
  /** How many distinct defects were injected and how many of them the check found. */
  injected: number;
  caught: number;
}

/**
 * Inject each known defect of each invariant's kind into a copy of the real
 * data and require that check to find strictly more than it did before.
 *
 * `vacuous`: the check examined nothing on this data, so it cannot be
 * trusted here. `unmutable`: the data had no row a defect of this kind could be
 * injected into — the same conclusion, reached from the other side. `missed`
 * is the one that matters: the check ran on a population and a defect of its
 * own kind walked past it. `detected` means every injected defect was found.
 */
export function proveProbes(domain: DomainSpec, pair: Pair): ProbeProof[] {
  const base = context(domain, pair);
  return domain.invariants.map((spec) => {
    const before = runInvariant(spec, base);
    const proof = (status: ProbeStatus, injected = 0, caught = 0): ProbeProof => ({ invariant: spec.id, kind: spec.kind, status, injected, caught });
    if (before.examined === 0) return proof('vacuous');
    const mutated = (MUTATORS[spec.kind] as Mutator<typeof spec.kind>)(spec as never, base);
    if (mutated.length === 0) return proof('unmutable');
    const caught = mutated.filter((m) => runInvariant(spec, context(domain, m)).findings.length > before.findings.length).length;
    return proof(caught === mutated.length ? 'detected' : 'missed', mutated.length, caught);
  });
}

/** A readable sentence for the workbook: what the check asks, in the institution's words. */
export function describeInvariant(spec: InvariantSpec): string {
  switch (spec.kind) {
    case 'crosswalk': return `Every ${spec.entity} maps to exactly one target ${spec.entity}; no two collapse into one; nothing appears from nowhere.`;
    case 'unique': return `No two ${spec.entity} rows repeat (${spec.fields.join(', ')}).`;
    case 'reference': return `Every ${spec.entity}.${spec.field} points at a real ${spec.to}, and none that were fine in the source are orphaned.`;
    case 'preserved': return `${spec.entity}: ${spec.fields.join(', ')} mean the same thing after the move${spec.compare ? ` (compared as ${spec.compare})` : ''}.`;
    case 'derived': return `${spec.id}: ${spec.agg === 'sum' ? 'the sum' : 'the weighted mean'} of ${spec.child}.${spec.value} per ${spec.entity}, recomputed from rows on both sides, agrees within ${spec.tolerance}${spec.stated ? ` and with the stated ${spec.stated}` : ''}.`;
    case 'history': return `${spec.entity}: every event of each ${spec.subjectEntity}, in order, with the same values${spec.current ? `; ${spec.current} is the last one` : ''}.`;
    case 'permission': return `${spec.entity}: nobody gains access they did not have${spec.requires ? `; every grant has an active ${spec.requires.entity} record` : ''}; lost access is reported.`;
    case 'order': return `${spec.entity} keeps its sibling order within each ${spec.group}.`;
    case 'bounded': return `${spec.entity} per ${spec.group} stays within ${spec.groupEntity}.${spec.capacity}${spec.equalToSource ? ' and equals the source count' : ''}.`;
    case 'temporal': return `${spec.entity}.${spec.start} is not after ${spec.entity}.${spec.end}.`;
  }
}

/** Re-exported so a caller can build a pair without importing two modules. */
export type { Crosswalk, Dataset, Pair };
