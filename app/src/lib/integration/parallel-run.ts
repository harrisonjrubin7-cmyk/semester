/**
 * Parallel run: a connector fills the same records the school's current
 * process does, side by side, before anyone is asked to trust it.
 *
 * Two sets of values for each record:
 *
 *   `authoritative`  what the student sees and relies on today — the school's
 *                    own listing, the manual entry, the native record
 *   `connector`      what the connector produced in the shadow
 *
 * `assessParallelRun` compares them field by field, over a window, and returns
 * a verdict and the reasons for it. It never switches anything. Cutover is
 * three separate things, and this only ever supplies the first:
 *
 *   1. evidence that the connector agrees (this file),
 *   2. two named people who are not its proposer, in two different roles,
 *   3. a way back — `shouldRollBack` is the check to run after cutover, with
 *      the same comparison and a stricter floor.
 *
 * Comparison is on canonical values after the pipeline's own transforms, so a
 * disagreement is a disagreement in meaning and not in formatting. Reports
 * carry redacted record references and field *names*, never values.
 */
import { redactReference } from './redact.ts';

export type CompareKind = 'string' | 'datetime' | 'number' | 'boolean';

export interface ComparedField {
  name: string;
  kind: CompareKind;
}

export interface ParallelSample {
  entity: string;
  /** The record's external id; redacted before it leaves this file. */
  key: string;
  authoritative: Record<string, unknown> | null;
  connector: Record<string, unknown> | null;
  /** When the comparison was taken. */
  at: Date;
}

export interface ParallelPolicy {
  fields: Record<string, readonly ComparedField[]>;
  /** Fewest compared records, per entity, before a verdict means anything. */
  minSamples: number;
  /** Fewest distinct days the comparison must span. */
  minDays: number;
  /** Fraction of present-on-both records that must agree on every field. */
  minAgreement: number;
  /** Most records the school has that the connector missed, as a fraction. */
  maxMissingFromConnector: number;
  /** Most records only the connector has, as a fraction. */
  maxExtraFromConnector: number;
}

export const DEFAULT_PARALLEL_POLICY = {
  minSamples: 200,
  minDays: 14,
  minAgreement: 0.99,
  maxMissingFromConnector: 0.01,
  maxExtraFromConnector: 0.02,
} as const;

export interface EntityAssessment {
  entity: string;
  compared: number;
  matched: number;
  mismatched: number;
  missingFromConnector: number;
  extraFromConnector: number;
  agreement: number;
  /** Which fields disagreed, and how often. */
  fieldMismatches: Record<string, number>;
  /** Up to five redacted references an operator can look up. */
  examples: { reference: string; fields: string[] }[];
}

export type Verdict = 'insufficient_data' | 'diverging' | 'shadow_ok';

export interface ParallelAssessment {
  verdict: Verdict;
  days: number;
  entities: EntityAssessment[];
  blockers: string[];
}

function normalize(value: unknown, kind: CompareKind): string | null {
  if (value === null || value === undefined || value === '') return null;
  switch (kind) {
    case 'string': return typeof value === 'string' ? value.trim().toLowerCase() : String(value).toLowerCase();
    case 'datetime': {
      const t = typeof value === 'string' || typeof value === 'number' ? Date.parse(String(value)) : NaN;
      return Number.isNaN(t) ? `invalid:${String(value)}` : new Date(t).toISOString();
    }
    case 'number': return typeof value === 'number' && Number.isFinite(value) ? String(value) : `invalid:${String(value)}`;
    case 'boolean': return typeof value === 'boolean' ? String(value) : `invalid:${String(value)}`;
  }
}

const dayOf = (d: Date) => d.toISOString().slice(0, 10);

export async function assessParallelRun(
  tenantId: string, samples: readonly ParallelSample[], policy: ParallelPolicy,
): Promise<ParallelAssessment> {
  const blockers: string[] = [];
  const byEntity = new Map<string, ParallelSample[]>();
  for (const s of samples) byEntity.set(s.entity, [...(byEntity.get(s.entity) ?? []), s]);
  const days = new Set(samples.map((s) => dayOf(s.at))).size;

  const entities: EntityAssessment[] = [];
  for (const [entity, rows] of byEntity) {
    const fields = policy.fields[entity];
    if (!fields || fields.length === 0) {
      blockers.push(`${entity}: no fields are named for comparison`);
      continue;
    }
    const a: EntityAssessment = {
      entity, compared: 0, matched: 0, mismatched: 0, missingFromConnector: 0, extraFromConnector: 0,
      agreement: 0, fieldMismatches: {}, examples: [],
    };
    for (const row of rows) {
      if (row.authoritative && !row.connector) { a.missingFromConnector++; continue; }
      if (!row.authoritative && row.connector) { a.extraFromConnector++; continue; }
      if (!row.authoritative && !row.connector) continue;
      a.compared++;
      const differing = fields.filter((f) =>
        normalize((row.authoritative as Record<string, unknown>)[f.name], f.kind)
        !== normalize((row.connector as Record<string, unknown>)[f.name], f.kind)).map((f) => f.name);
      if (differing.length === 0) { a.matched++; continue; }
      a.mismatched++;
      for (const name of differing) a.fieldMismatches[name] = (a.fieldMismatches[name] ?? 0) + 1;
      if (a.examples.length < 5) a.examples.push({ reference: await redactReference(tenantId, row.key), fields: differing });
    }
    a.agreement = a.compared === 0 ? 0 : a.matched / a.compared;
    entities.push(a);
  }

  if (entities.length === 0) blockers.push('no records were compared');
  if (days < policy.minDays) blockers.push(`only ${days} of ${policy.minDays} required days are covered`);
  let diverging = false;
  for (const e of entities) {
    const authoritativeTotal = e.compared + e.missingFromConnector;
    if (e.compared < policy.minSamples) blockers.push(`${e.entity}: ${e.compared} of ${policy.minSamples} required comparisons`);
    if (e.compared >= policy.minSamples && e.agreement < policy.minAgreement) {
      diverging = true;
      blockers.push(`${e.entity}: ${(e.agreement * 100).toFixed(1)}% agreement is under ${(policy.minAgreement * 100).toFixed(1)}%`);
    }
    if (authoritativeTotal > 0 && e.missingFromConnector / authoritativeTotal > policy.maxMissingFromConnector) {
      diverging = true;
      blockers.push(`${e.entity}: the connector missed ${e.missingFromConnector} of ${authoritativeTotal} school records`);
    }
    if (e.compared > 0 && e.extraFromConnector / (e.compared + e.extraFromConnector) > policy.maxExtraFromConnector) {
      diverging = true;
      blockers.push(`${e.entity}: the connector has ${e.extraFromConnector} records the school does not`);
    }
  }
  const insufficient = entities.length === 0 || days < policy.minDays || entities.some((e) => e.compared < policy.minSamples);
  const verdict: Verdict = diverging ? 'diverging' : insufficient ? 'insufficient_data' : 'shadow_ok';
  return { verdict, days, entities, blockers };
}

export interface SignOff {
  by: string;
  role: 'registrar' | 'it_security' | 'data_owner' | 'semester_integration';
  at: Date;
}

export interface CutoverDecision {
  mayCutOver: boolean;
  blockers: string[];
}

/**
 * Whether a cutover may be *requested*. Needs a `shadow_ok` assessment, two
 * sign-offs from different people in different roles, neither of them the
 * proposer, one of them from the school. It does not perform the cutover.
 */
export function cutoverDecision(
  assessment: ParallelAssessment, signOffs: readonly SignOff[], proposedBy: string,
): CutoverDecision {
  const blockers: string[] = [];
  if (assessment.verdict !== 'shadow_ok') blockers.push(`the parallel run is ${assessment.verdict.replace('_', ' ')}`);
  const independent = signOffs.filter((s) => s.by !== proposedBy);
  if (independent.length < signOffs.length) blockers.push('the proposer cannot sign off their own cutover');
  if (new Set(independent.map((s) => s.by)).size < 2) blockers.push('two different people must sign off');
  if (new Set(independent.map((s) => s.role)).size < 2) blockers.push('the two sign-offs must be in different roles');
  if (!independent.some((s) => s.role === 'registrar' || s.role === 'data_owner' || s.role === 'it_security')) {
    blockers.push('one sign-off must come from the school');
  }
  return { mayCutOver: blockers.length === 0, blockers };
}

/**
 * After cutover, the same comparison against a stricter floor. True means the
 * operator should be offered the way back; it does not roll anything back.
 */
export function shouldRollBack(post: ParallelAssessment, policy: ParallelPolicy, margin = 0.005): boolean {
  const floor = Math.min(1, policy.minAgreement + margin);
  return post.entities.some((e) => e.compared > 0 && e.agreement < floor);
}
