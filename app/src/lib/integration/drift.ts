/**
 * Schema drift: noticing that a provider changed shape before the pipeline
 * rejects its records one at a time.
 *
 * `ingest` already refuses a record whose required field is missing or the
 * wrong type — correctly, and one record at a time. What it cannot say is
 * "the SIS renamed `description` to `term_name` on Tuesday", because every
 * record fails the same way and the run reads as a batch of bad data. This
 * reads the whole batch against the adapter's declaration first and says what
 * moved, whether it breaks the mapping, and what the connection should do.
 *
 * Pure and read-only: it looks at field *names*, *types* and — for enums —
 * the values seen. It never keeps a value, so a drift report can be stored
 * and shown to an integration owner without carrying student data. Enum
 * values are the one exception, and only enums, which the declaration has
 * already said are a closed list of codes.
 *
 * See `docs/SCHEMA-DRIFT-AND-CONTRACT-TESTING.md`.
 */
import type { AdapterDeclaration, EntityMapping, FieldType } from './adapter.ts';
import { namesNeverDisplayed } from './adapter.ts';
import type { ExternalRecord } from './pipeline.ts';

export type DriftKind = 'added' | 'removed' | 'possible_rename' | 'type_changed' | 'enum_changed' | 'unmapped_entity';

export const DRIFT_KINDS: readonly DriftKind[] = [
  'added', 'removed', 'possible_rename', 'type_changed', 'enum_changed', 'unmapped_entity',
];

export interface DriftChange {
  kind: DriftKind;
  entity: string;
  field: string | null;
  /** For a rename, the field that appeared; for a type change, what was seen. */
  detail: string;
  breaking: boolean;
}

export interface DriftReport {
  /** A stable hash of the observed shape, to store and compare run to run. */
  fingerprint: string;
  changes: DriftChange[];
  breaking: boolean;
  /** What the connection should do: carry on, or stop this entity and degrade. */
  action: 'continue' | 'degrade';
  /** Entities whose records must not be processed until a mapping review. */
  hold: string[];
}

/** The JSON type a value arrived as, in the adapter's vocabulary where it can be. */
function observedType(v: unknown): FieldType | 'null' | 'object' | 'array' {
  if (v === null || v === undefined) return 'null';
  if (Array.isArray(v)) return 'array';
  switch (typeof v) {
    case 'string':
      if (/^https:\/\/\S+$/.test(v)) return 'url';
      if (/^\d{4}-\d{2}-\d{2}([T ][\d:.]+(Z|[+-]\d{2}:?\d{2})?)?$/.test(v) && !Number.isNaN(Date.parse(v))) return 'datetime';
      return 'string';
    case 'number':
      return 'number';
    case 'boolean':
      return 'boolean';
    default:
      return 'object';
  }
}

/** Whether a value observed as `seen` satisfies a field declared as `declared`. */
function compatible(declared: FieldType, seen: ReturnType<typeof observedType>): boolean {
  if (seen === 'null') return true;
  if (declared === seen) return true;
  // A url and a datetime are strings too; a string field accepts both.
  if (declared === 'string' || declared === 'enum') return seen === 'string' || seen === 'url' || seen === 'datetime';
  return false;
}

interface Observed {
  records: number;
  fields: Map<string, { present: number; types: Set<string>; enumValues: Set<string> }>;
}

function observe(records: readonly ExternalRecord[], mappings: readonly EntityMapping[]): Map<string, Observed> {
  const enums = new Map<string, Set<string>>();
  for (const m of mappings) {
    enums.set(m.externalEntity, new Set(m.fields.filter((f) => f.type === 'enum').map((f) => f.external)));
  }
  const byEntity = new Map<string, Observed>();
  for (const rec of records) {
    let o = byEntity.get(rec.entityType);
    if (!o) byEntity.set(rec.entityType, (o = { records: 0, fields: new Map() }));
    o.records += 1;
    for (const [name, value] of Object.entries(rec.fields)) {
      let f = o.fields.get(name);
      if (!f) o.fields.set(name, (f = { present: 0, types: new Set(), enumValues: new Set() }));
      const t = observedType(value);
      if (t !== 'null') f.present += 1;
      f.types.add(t);
      if (enums.get(rec.entityType)?.has(name) && typeof value === 'string') f.enumValues.add(value);
    }
  }
  return byEntity;
}

/**
 * A field the gateway never keeps — the never-ingest list and the
 * never-display list (a hold's `reason`, `amount`) — is not drift when it
 * arrives: a real SIS sends it, and the mapping leaves it behind on purpose.
 * Reporting it would raise the same "added" on every run and teach the owner
 * to ignore the report.
 */
const dropsByDesign = (name: string) => namesNeverDisplayed(name);

/** A short, stable, non-cryptographic hash (FNV-1a) — this identifies a shape, it protects nothing. */
function fnv(text: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i += 1) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(16).padStart(8, '0');
}

/**
 * The observed shape of a batch, as field names and types per entity. Values
 * never enter it, so two batches with the same shape and different students
 * fingerprint the same.
 */
export function fingerprintBatch(records: readonly ExternalRecord[]): string {
  const shape = [...observe(records, []).entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([entity, o]) =>
      `${entity}{${[...o.fields.entries()]
        .filter(([name]) => !dropsByDesign(name))
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([name, f]) => `${name}:${[...f.types].sort().join('|')}`)
        .join(',')}}`,
    )
    .join(';');
  return fnv(shape);
}

/**
 * Compare a batch with the adapter's declaration.
 *
 * - **removed** — a mapped field no record in the batch carries. Breaking when
 *   the field is required.
 * - **added** — a field the provider now sends that nothing maps. Never
 *   breaking; recorded so a mapping review can decide. A field the gateway
 *   never keeps (`namesNeverDisplayed`) is not reported at all.
 * - **possible_rename** — exactly one required field removed and exactly one
 *   compatible field added on the same entity. A guess, labelled as one; the
 *   removal is still what breaks.
 * - **type_changed** — a mapped field whose values no longer fit its declared
 *   type in most records that carry it. Breaking when required.
 * - **enum_changed** — an enum field carrying a code the declaration does not
 *   list. Breaking when required, because every such record would be refused.
 * - **unmapped_entity** — an entity type the adapter does not declare.
 *   Not breaking; the pipeline already refuses it.
 *
 * A breaking change holds that entity (its records are not processed) and
 * recommends `degrade` for the connection. It never edits the mapping.
 */
export function detectDrift(adapter: AdapterDeclaration, records: readonly ExternalRecord[]): DriftReport {
  const observed = observe(records, adapter.entities);
  const changes: DriftChange[] = [];

  for (const [entity, o] of observed) {
    const mapping = adapter.entities.find((m) => m.externalEntity === entity);
    if (!mapping) {
      changes.push({ kind: 'unmapped_entity', entity, field: null, detail: `${o.records} records`, breaking: false });
      continue;
    }
    const mapped = new Set(mapping.fields.map((f) => f.external));
    const removed: string[] = [];
    for (const f of mapping.fields) {
      const seen = o.fields.get(f.external);
      if (!seen || seen.present === 0) {
        removed.push(f.external);
        changes.push({ kind: 'removed', entity, field: f.external, detail: 'no record carries it', breaking: f.required });
        continue;
      }
      const wrong = [...seen.types].filter((t) => !compatible(f.type, t as ReturnType<typeof observedType>));
      if (wrong.length > 0) {
        changes.push({
          kind: 'type_changed', entity, field: f.external, detail: `declared ${f.type}, seen ${wrong.join('/')}`,
          breaking: f.required,
        });
      }
      if (f.type === 'enum') {
        const unknown = [...seen.enumValues].filter((v) => !f.enumValues?.includes(v)).sort();
        if (unknown.length > 0) {
          changes.push({ kind: 'enum_changed', entity, field: f.external, detail: `new codes: ${unknown.join(', ')}`, breaking: f.required });
        }
      }
    }
    const added = [...o.fields.keys()].filter((name) => !mapped.has(name) && !dropsByDesign(name)).sort();
    for (const name of added) changes.push({ kind: 'added', entity, field: name, detail: 'not in the mapping', breaking: false });

    const requiredRemoved = removed.filter((name) => mapping.fields.find((f) => f.external === name)?.required);
    if (requiredRemoved.length === 1 && added.length === 1) {
      const was = mapping.fields.find((f) => f.external === requiredRemoved[0])!;
      const types = o.fields.get(added[0])!.types;
      if ([...types].every((t) => compatible(was.type, t as ReturnType<typeof observedType>))) {
        changes.push({
          kind: 'possible_rename', entity, field: was.external, detail: `perhaps now ${added[0]} — a guess, for review`,
          breaking: false,
        });
      }
    }
  }

  const hold = [...new Set(changes.filter((c) => c.breaking).map((c) => c.entity))].sort();
  return {
    fingerprint: fingerprintBatch(records),
    changes,
    breaking: hold.length > 0,
    action: hold.length > 0 ? 'degrade' : 'continue',
    hold,
  };
}

/** The records a drift report allows through: everything but held entities. */
export function withoutHeld(records: readonly ExternalRecord[], report: DriftReport): ExternalRecord[] {
  const held = new Set(report.hold);
  return records.filter((r) => !held.has(r.entityType));
}
