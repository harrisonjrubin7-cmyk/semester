/**
 * What may be migrated at all, before any row moves.
 *
 * The platform floor already decides where each class of data can go
 * (`integration/classification.ts`): T4 and above go nowhere, so no migration
 * can be the back door for accommodations, health, conduct or government
 * identifiers. And `catalog.ts` names fields no connector ingests by default —
 * grades, GPA, submissions, aid, balances. A migration is not a connector, and
 * moving a transcript is the whole point of one, but that is exactly why it is
 * never implicit: each such entity needs a named scope approval from the
 * institution's records owner, on file before the mapping is approved.
 *
 * This file only decides; it moves nothing and stores nothing.
 */
import { namesNeverDisplayed, namesNeverIngest } from '../integration/adapter.ts';
import { routeAllowed, type ClassRoute, type DataClass } from '../integration/classification.ts';
import type { DomainSpec } from './engine-types.ts';

export type ScopeReason = 'class_blocked' | 'never_ingest' | 'never_display';

export interface ScopeFlag {
  domain: string;
  entity: string;
  field: string;
  class: DataClass;
  reason: ScopeReason;
  /** The approval that lifts the flag; null when nothing can (a blocked class). */
  approval: string | null;
}

/** One approval per domain and entity: `scope.migration.academic_records.course_result`. */
export const approvalKey = (domain: string, entity: string) => `scope.migration.${domain}.${entity}`;

export function scopeFlags(domain: DomainSpec, tenant?: Partial<Record<DataClass, Partial<ClassRoute>>>): ScopeFlag[] {
  const out: ScopeFlag[] = [];
  for (const e of domain.entities) {
    for (const f of e.fields) {
      const base = { domain: domain.id, entity: e.name, field: f.name, class: f.class };
      if (!routeAllowed(f.class, 'semester', tenant)) out.push({ ...base, reason: 'class_blocked', approval: null });
      else if (namesNeverIngest(f.name)) out.push({ ...base, reason: 'never_ingest', approval: approvalKey(domain.id, e.name) });
      else if (namesNeverDisplayed(f.name)) out.push({ ...base, reason: 'never_display', approval: approvalKey(domain.id, e.name) });
    }
  }
  return out;
}

/** What stops this scope from being approved, given the approvals on file. Empty means it may proceed. */
export function scopeProblems(domain: DomainSpec, approvals: readonly string[], tenant?: Partial<Record<DataClass, Partial<ClassRoute>>>): string[] {
  const have = new Set(approvals);
  return scopeFlags(domain, tenant).flatMap((f) => {
    if (f.reason === 'class_blocked') return [`${f.entity}.${f.field} is ${f.class}; the platform floor allows it nowhere`];
    return have.has(f.approval!) ? [] : [`${f.entity}.${f.field} needs ${f.approval}`];
  });
}

/** Every approval a domain would need, sorted, for the workbook. */
export function approvalsNeeded(domain: DomainSpec): string[] {
  return [...new Set(scopeFlags(domain).flatMap((f) => (f.approval ? [f.approval] : [])))].sort();
}
