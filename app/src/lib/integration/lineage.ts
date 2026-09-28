/**
 * Field lineage and source ownership: where each canonical field comes from,
 * and whose job it is when it goes stale.
 *
 * Lineage is read off the adapter declaration — one row per canonical field
 * per mapping version, not per value. Per-value provenance is already the
 * canonical reference itself (source system, record id, timestamp, mapping
 * version). A student never sees these rows; they see the freshness words from
 * `freshness.ts`. An integration owner with `audit:read` sees these.
 *
 * Freshness targets gain an owner here. A breach is a question about the
 * *source*, raised to the person answerable for it, never an alert about a
 * student.
 *
 * See `docs/FIELD-LINEAGE-AND-SOURCE-FRESHNESS.md`.
 */
import type { AdapterDeclaration, FieldType, Transform } from './adapter.ts';
import type { DataClass } from './classification.ts';

export interface LineageRow {
  adapterId: string;
  sourceSystem: string;
  sourceOfTruth: string;
  externalEntity: string;
  externalField: string;
  canonicalEntity: string;
  canonicalField: string;
  type: FieldType;
  transform: Transform;
  required: boolean;
  classification: DataClass;
  mappingVersion: number;
}

export function lineageOf(adapter: AdapterDeclaration): LineageRow[] {
  return adapter.entities.flatMap((e) =>
    e.fields.map((f) => ({
      adapterId: adapter.id,
      sourceSystem: `${adapter.provider} ${adapter.product}`.trim(),
      sourceOfTruth: adapter.sourceOfTruth,
      externalEntity: e.externalEntity,
      externalField: f.external,
      canonicalEntity: e.canonicalEntity,
      canonicalField: f.canonical,
      type: f.type,
      transform: f.transform ?? 'none',
      required: f.required,
      classification: e.classification,
      mappingVersion: e.version,
    })),
  );
}

/** Two adapter fields writing the same canonical field of the same entity: a lineage conflict. */
export function lineageConflicts(rows: readonly LineageRow[]): string[] {
  const seen = new Map<string, string>();
  const out: string[] = [];
  for (const r of rows) {
    const k = `${r.adapterId}:${r.canonicalEntity}.${r.canonicalField}`;
    const from = `${r.externalEntity}.${r.externalField}`;
    const prior = seen.get(k);
    if (prior && prior !== from) out.push(`${r.canonicalEntity}.${r.canonicalField} is written by both ${prior} and ${from}`);
    else seen.set(k, from);
  }
  return out;
}

export interface SourceOwner {
  adapterId: string;
  owner: string;
  backupOwner: string;
  /** Minutes: the source is late after this. */
  freshnessTargetMinutes: number;
  /** Minutes: the source is stale after this; at or past it is a breach. */
  staleThresholdMinutes: number;
  reviewCadenceDays: number;
  escalation: string;
  correctionRoute: string;
}

export function ownerProblems(o: SourceOwner): string[] {
  const out: string[] = [];
  if (!o.owner.trim()) out.push('a source needs an owner before it can be marked official');
  if (!o.backupOwner.trim()) out.push('a backup owner is required');
  if (o.owner.trim() && o.owner.trim() === o.backupOwner.trim()) out.push('the backup owner must be a different person');
  if (!(o.freshnessTargetMinutes > 0)) out.push('the freshness target must be positive');
  if (!(o.staleThresholdMinutes >= o.freshnessTargetMinutes)) out.push('the stale threshold cannot be sooner than the target');
  if (!o.escalation.trim()) out.push('an escalation path is required');
  if (!o.correctionRoute.trim()) out.push('a correction route is required');
  return out;
}

export type BreachLevel = 'ok' | 'warning' | 'breach' | 'unavailable';

/**
 * Where a source stands against its owner's threshold. `warning` at 80 % of
 * the threshold, so the owner hears before the students' screens say "May be
 * out of date"; `breach` at or past it; `unavailable` when nothing has ever
 * synced.
 */
export function breachLevel(lastSuccess: Date | null, owner: Pick<SourceOwner, 'staleThresholdMinutes'>, now: Date): BreachLevel {
  if (!lastSuccess) return 'unavailable';
  const age = (now.getTime() - lastSuccess.getTime()) / 60_000;
  if (age >= owner.staleThresholdMinutes) return 'breach';
  if (age >= owner.staleThresholdMinutes * 0.8) return 'warning';
  return 'ok';
}

/**
 * One alert per level change, not one per check: a source that stays in
 * breach for a week raises one breach, not two thousand.
 */
export function alertFor(previous: BreachLevel, current: BreachLevel): BreachLevel | null {
  if (current === previous) return null;
  if (current === 'ok') return null;
  return current;
}
