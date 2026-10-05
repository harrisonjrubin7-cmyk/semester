/**
 * Reconciliation: what the provider holds, against what Semester holds.
 *
 * `ingest` answers "was this batch taken"; this answers "do the two sides
 * agree". The source side is the provider's own listing — ids, last-modified
 * times and, where the provider gives one, a content version — and the
 * Semester side is the canonical references already stored. Neither side is
 * trusted to be complete, which is the point of asking.
 *
 * Statuses, per record:
 *
 * - **matched** — both sides, same version or timestamp.
 * - **pending** — the provider's copy is newer than ours; the next sync takes it.
 * - **mismatch** — same timestamp, different content version.
 * - **missing_in_semester** — the provider lists it and we have nothing.
 * - **missing_at_source** — we hold a live copy the provider no longer lists.
 * - **duplicate** — the provider lists the same id twice.
 * - **stale** — ours is past the freshness target and not newer at source.
 * - **rejected** — the last run refused it (its redacted reference is in the errors).
 *
 * Only exceptions become discrepancies; a matched record is a count. The
 * report carries redacted references (see `redact.ts`), never ids or values,
 * so it can be shown on a staff dashboard by default. Drilling into one
 * student's record is a separate, capability-checked, audited read.
 *
 * See `docs/INTEGRATION-QUALITY-AND-RECONCILIATION.md`.
 */
import type { CanonicalReference, IngestError } from './pipeline.ts';
import { redactReference } from './redact.ts';

export type ReconcileStatus =
  | 'matched'
  | 'pending'
  | 'mismatch'
  | 'missing_in_semester'
  | 'missing_at_source'
  | 'duplicate'
  | 'stale'
  | 'rejected';

export const RECONCILE_STATUSES: readonly ReconcileStatus[] = [
  'matched', 'pending', 'mismatch', 'missing_in_semester', 'missing_at_source', 'duplicate', 'stale', 'rejected',
];

/** One line of the provider's listing. */
export interface SourceEntry {
  entityType: string;
  id: string;
  updatedAt: string | null;
  /** A provider content version or etag, when it gives one. */
  version?: string | null;
}

/** The part of a stored reference reconciliation needs. */
export type StoredEntry = Pick<CanonicalReference, 'sourceRecordId' | 'sourceTimestamp' | 'externalDeletedAt'> & {
  entityType: string;
  version?: string | null;
};

export interface Discrepancy {
  status: Exclude<ReconcileStatus, 'matched'>;
  entityType: string;
  /** `sha256:…` from `redactReference` — safe to show, useless to anybody without the tenant. */
  reference: string;
  detail: string;
}

export interface ReconcileReport {
  counts: Record<ReconcileStatus, number>;
  discrepancies: Discrepancy[];
  /** True when every record matched or is merely pending the next sync. */
  clean: boolean;
}

const zero = (): Record<ReconcileStatus, number> =>
  Object.fromEntries(RECONCILE_STATUSES.map((s) => [s, 0])) as Record<ReconcileStatus, number>;

export interface ReconcileInput {
  tenantId: string;
  source: readonly SourceEntry[];
  stored: readonly StoredEntry[];
  /** The last run's errors; their references mark records it refused. */
  lastRunErrors?: readonly IngestError[];
  freshnessTargetMinutes: number;
  now: Date;
}

export async function reconcile(input: ReconcileInput): Promise<ReconcileReport> {
  const { tenantId, source, stored, now } = input;
  const counts = zero();
  const discrepancies: Discrepancy[] = [];
  const key = (entity: string, id: string) => `${entity}\u0000${id}`;
  const note = async (status: Discrepancy['status'], entityType: string, id: string, detail: string) => {
    counts[status] += 1;
    discrepancies.push({ status, entityType, reference: await redactReference(tenantId, id), detail });
  };

  const rejected = new Set((input.lastRunErrors ?? []).map((e) => `${e.entityType ?? ''}\u0000${e.reference}`));
  const ours = new Map(stored.filter((s) => !s.externalDeletedAt).map((s) => [key(s.entityType, s.sourceRecordId), s]));
  const seen = new Set<string>();
  const staleBefore = now.getTime() - input.freshnessTargetMinutes * 60_000;

  for (const entry of source) {
    const k = key(entry.entityType, entry.id);
    if (seen.has(k)) {
      await note('duplicate', entry.entityType, entry.id, 'the provider lists this id more than once');
      continue;
    }
    seen.add(k);
    const mine = ours.get(k);
    if (!mine) {
      const ref = await redactReference(tenantId, entry.id);
      if (rejected.has(`${entry.entityType}\u0000${ref}`)) {
        await note('rejected', entry.entityType, entry.id, 'the last run refused it; see its error');
      } else {
        await note('missing_in_semester', entry.entityType, entry.id, 'listed by the provider, not held');
      }
      continue;
    }
    const theirs = entry.updatedAt ? Date.parse(entry.updatedAt) : NaN;
    const held = mine.sourceTimestamp ? Date.parse(mine.sourceTimestamp) : NaN;
    if (Number.isFinite(theirs) && Number.isFinite(held) && theirs > held) {
      await note('pending', entry.entityType, entry.id, 'newer at the provider; the next sync takes it');
      continue;
    }
    if (entry.version && mine.version && entry.version !== mine.version) {
      await note('mismatch', entry.entityType, entry.id, 'same time, different content version');
      continue;
    }
    if (Number.isFinite(held) && held < staleBefore) {
      await note('stale', entry.entityType, entry.id, 'past the freshness target');
      continue;
    }
    counts.matched += 1;
  }

  for (const [k, mine] of ours) {
    if (!seen.has(k)) await note('missing_at_source', mine.entityType, mine.sourceRecordId, 'held here, no longer listed');
  }

  const serious = discrepancies.filter((d) => d.status !== 'pending');
  return { counts, discrepancies, clean: serious.length === 0 };
}
