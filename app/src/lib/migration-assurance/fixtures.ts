/**
 * Synthetic data, generated from a domain's own declaration.
 *
 * Nobody's records. A clean source and a target loaded from it under new keys,
 * with the crosswalk between them, so every invariant of every domain can be
 * run against data that is right and then against data with one defect put in.
 *
 * It is generated from the `DomainSpec` rather than written per domain for the
 * same reason the workbooks are: a fixture written by hand beside the spec
 * stops matching it, and a probe proof on data the spec no longer describes
 * proves nothing. Foreign keys are read from the invariants that name them;
 * stated figures are computed from the rows they summarise; capacities are
 * above their counts; consents exist for every grant that needs one.
 */
import type { DomainSpec, EntitySpec, InvariantSpec, Pair, Row } from './types.ts';

const SEP = '\u001f';

interface Fk { field: string; parent: string }

/** Every foreign key a domain declares, by the entity that holds it. */
function foreignKeys(domain: DomainSpec): Map<string, Fk[]> {
  const out = new Map<string, Fk[]>();
  const add = (entity: string, field: string, parent: string) => {
    const list = out.get(entity) ?? [];
    if (!list.some((f) => f.field === field)) list.push({ field, parent });
    out.set(entity, list);
  };
  for (const s of domain.invariants) {
    switch (s.kind) {
      case 'reference': add(s.entity, s.field, s.to); break;
      case 'preserved': for (const l of s.links ?? []) add(s.entity, l.field, l.to); break;
      case 'derived': add(s.child, s.childSubject, s.entity); break;
      case 'history': add(s.entity, s.subject, s.subjectEntity); break;
      case 'permission':
        add(s.entity, s.principal, s.principalEntity);
        if (s.resourceEntity) add(s.entity, s.resource, s.resourceEntity);
        break;
      case 'order': if (s.groupEntity) add(s.entity, s.group, s.groupEntity); break;
      case 'bounded': add(s.entity, s.group, s.groupEntity); break;
      default: break;
    }
  }
  return out;
}

const TRUE_FLAGS = new Set(['active', 'published', 'counts_in_gpa', 'earned', 'mentor_opt_in']);
const FALSE_FLAGS = new Set(['legal_hold', 'directory_suppressed']);

function scalar(entity: string, field: string, i: number, filters: Map<string, string>): unknown {
  const f = filters.get(`${entity}.${field}`);
  if (f !== undefined) return f;
  if (TRUE_FLAGS.has(field)) return 'true';
  if (FALSE_FLAGS.has(field)) return 'false';
  if (field === 'email') return `person-${i}@example.test`;
  if (/_cents$/.test(field)) return 1000 * (i + 1) + (i % 2 === 0 ? 250 : -75);
  if (/(^|_)(capacity)$/.test(field)) return 40;
  if (/^(credits|points|installment_count|byte_size)$/.test(field) || field === 'grade_points') return field === 'grade_points' ? 3 + (i % 2) : 3 + (field === 'byte_size' ? 1000 * i : 0);
  if (/_(on|at)$/.test(field)) return `2026-0${(i % 8) + 1}-1${i % 9}`;
  if (/^(attempt)$/.test(field)) return 1;
  return `${field}-${i}`;
}

function topological(entities: readonly EntitySpec[], fks: Map<string, Fk[]>): EntitySpec[] {
  const done = new Set<string>();
  const out: EntitySpec[] = [];
  const visit = (e: EntitySpec) => {
    if (done.has(e.name)) return;
    done.add(e.name);
    for (const fk of fks.get(e.name) ?? []) {
      const parent = entities.find((p) => p.name === fk.parent);
      if (parent && parent !== e) visit(parent);
    }
    out.push(e);
  };
  entities.forEach(visit);
  return out;
}

const keyString = (row: Row, key: readonly string[]) => key.map((k) => String(row[k] ?? '')).join(SEP);

/**
 * A clean pair for one domain: `rows` rows per entity, a target loaded under
 * different keys, and the crosswalk. Deterministic.
 */
export function syntheticPair(domain: DomainSpec, rows = 8): Pair {
  const fks = foreignKeys(domain);
  const all = topological([...domain.references, ...domain.entities], fks);
  const filters = new Map<string, string>();
  for (const s of domain.invariants) {
    if ('filter' in s && s.filter) filters.set(`${s.kind === 'derived' ? s.child : s.entity}.${s.filter.field}`, s.filter.in[0]);
  }
  const source: Record<string, Row[]> = {};
  const parents = (entity: string) => source[entity] ?? [];
  const specOf = (name: string) => all.find((e) => e.name === name)!;

  for (const e of all) {
    const own = fks.get(e.name) ?? [];
    const isReference = domain.references.some((r) => r.name === e.name);
    const biggest = Math.max(0, ...own.map((fk) => (fk.parent === e.name ? 0 : source[fk.parent]?.length ?? 0)));
    // Two children per parent, so groups have order, history and capacity to check.
    const count = isReference || !own.length ? Math.min(4, rows) : Math.min(Math.max(rows, biggest * 2), 32);
    const list: Row[] = [];
    for (let i = 0; i < count; i += 1) {
      const row: Record<string, unknown> = {};
      for (const f of e.fields) row[f.name] = scalar(e.name, f.name, i, filters);
      own.forEach((fk, n) => {
        const p = parents(fk.parent);
        if (fk.parent === e.name) {
          row[fk.field] = i === 1 ? String(list[0][specOf(e.name).key[0]]) : null;
          return;
        }
        const pick = n === 0 ? i % p.length : Math.floor(i / p.length) % p.length;
        row[fk.field] = p[pick][specOf(fk.parent).key[0]];
      });
      for (const k of e.key) if (!own.some((fk) => fk.field === k) && e.key.length === 1) row[k] = `${e.name}-${i}`;
      if (e.key.length > 1) {
        for (const k of e.key) if (!own.some((fk) => fk.field === k)) row[k] = `${k}-${i}`;
      }
      list.push(row);
    }
    source[e.name] = list;
  }

  const patch = (entity: string, edit: (rows: Record<string, unknown>[]) => Record<string, unknown>[] | void) => {
    const next = edit(source[entity] as Record<string, unknown>[]);
    if (next) source[entity] = next;
  };

  for (const s of domain.invariants as readonly InvariantSpec[]) {
    if (s.kind === 'order') {
      const seen = new Map<string, number>();
      patch(s.entity, (list) => list.forEach((r) => { const g = String(r[s.group]); const n = (seen.get(g) ?? 0) + 1; seen.set(g, n); r[s.position] = n; }));
    }
    if (s.kind === 'temporal') {
      patch(s.entity, (list) => list.forEach((r, i) => { r[s.start] = `2026-01-0${(i % 5) + 1}`; r[s.end] = `2026-06-1${i % 9}`; }));
    }
    if (s.kind === 'history') {
      const key = specOf(s.subjectEntity).key[0];
      const events: Record<string, unknown>[] = [];
      for (const subject of source[s.subjectEntity]) {
        ['A', 'B', 'C'].forEach((grade, n) => {
          const e = specOf(s.entity);
          const row: Record<string, unknown> = {};
          for (const f of e.fields) row[f.name] = scalar(e.name, f.name, events.length, filters);
          row[e.key[0]] = `${e.name}-${events.length}`;
          row[s.subject] = subject[key];
          row[s.seq] = n + 1;
          row[s.value] = grade;
          events.push(row);
        });
        if (s.current) (subject as Record<string, unknown>)[s.current] = 'C';
      }
      source[s.entity] = events;
    }
    if (s.kind === 'derived' && s.stated) {
      const key = specOf(s.entity).key[0];
      const filtered = source[s.child].filter((r) => !s.filter || s.filter.in.includes(String(r[s.filter.field])));
      patch(s.entity, (list) => list.forEach((subject) => {
        const mine = filtered.filter((r) => r[s.childSubject] === subject[key]);
        const w = (r: Row) => (s.weight ? Number(r[s.weight]) : 1);
        const total = mine.reduce((n, r) => n + Number(r[s.value]) * (s.agg === 'sum' ? 1 : w(r)), 0);
        const weights = mine.reduce((n, r) => n + w(r), 0);
        subject[s.stated!] = s.agg === 'sum' ? total : weights === 0 ? 0 : total / weights;
      }));
    }
    if (s.kind === 'permission' && s.requires) {
      const grants = source[s.entity];
      const req = s.requires;
      patch(req.entity, (list) => list.forEach((r, i) => {
        r[req.principal] = grants[i % grants.length][s.principal];
        r[req.resource] = grants[i % grants.length][s.resource];
        if (req.active) r[req.active] = 'true';
      }));
    }
  }

  // Load the target under new keys; foreign keys follow the crosswalk of their parent.
  const crosswalk: Record<string, Record<string, string>> = {};
  const target: Record<string, Row[]> = {};
  for (const e of all) {
    const own = fks.get(e.name) ?? [];
    crosswalk[e.name] = {};
    target[e.name] = source[e.name].map((row) => {
      const out: Record<string, unknown> = { ...row };
      for (const fk of own) {
        const v = row[fk.field];
        if (v !== null && v !== undefined && fk.parent !== e.name) out[fk.field] = crosswalk[fk.parent][String(v)];
      }
      for (const k of e.key) if (e.key.length === 1 && !own.some((fk) => fk.field === k)) out[k] = `T-${String(row[k])}`;
      return out;
    });
    // Self references need the crosswalk of the same entity, which exists only now.
    source[e.name].forEach((row, i) => { crosswalk[e.name][keyString(row, e.key)] = keyString(target[e.name][i], e.key); });
    for (const fk of own.filter((f) => f.parent === e.name)) {
      target[e.name] = target[e.name].map((r, i) => {
        const v = source[e.name][i][fk.field];
        return v === null || v === undefined ? r : { ...r, [fk.field]: crosswalk[e.name][String(v)] };
      });
    }
  }
  return { source, target, crosswalk };
}
