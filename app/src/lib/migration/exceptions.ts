/**
 * The exception queue: every failed check becomes a row somebody owns.
 *
 * Nothing is dropped and nothing is closed by the person who raised it. The
 * life of an exception:
 *
 *   open → triaged → resolved → verified → closed
 *                 ↘ waived       (not critical; approver is neither raiser nor owner; expires)
 *                 ↘ out_of_scope (decided not to migrate; approver and reason)
 *
 * `resolved` means the owner says they fixed it (in the source, or in the
 * transform). Only `verified` — a later run of the same check, named by its
 * evidence id, that no longer fails, by somebody other than the owner — can
 * lead to `closed`. A fix nobody re-ran is the usual way a defect comes back
 * at cutover.
 *
 * Each transition is a pure function returning the next row; the caller
 * stores it. The row carries its own history. Rows are never deleted.
 */
import { failureKey } from './gate.ts';
import type { CheckResult, DataDomain, Severity } from './types.ts';

export type ExceptionState = 'open' | 'triaged' | 'resolved' | 'verified' | 'closed' | 'waived' | 'out_of_scope';

export interface ExceptionRow {
  /** `failureKey` of the failing case, so one failure is one row across re-runs. */
  key: string;
  checkId: string;
  domain: DataDomain;
  severity: Severity;
  code: string;
  ref: string;
  /** Carried from the failure: `migration` rows are fixed in the mapping and never waived or descoped. */
  origin?: 'migration' | 'source';
  state: ExceptionState;
  raisedBy: string;
  raisedAt: string;
  owner?: string;
  /** When the owner owes a fix, by severity. */
  dueAt?: string;
  resolution?: string;
  verifiedByEvidence?: string;
  waiver?: { approver: string; reason: string; expiresAt: string };
  history: readonly { at: string; actor: string; from: ExceptionState | null; to: ExceptionState; note?: string }[];
}

/** Hours to an owner, by severity. A critical exception that sits for a day is a cutover risk, not a backlog item. */
export const TRIAGE_SLA_HOURS: Readonly<Record<Severity, number>> = { critical: 4, high: 24, medium: 72, low: 168 };
/** Hours from triage to a fix to re-verify. */
export const RESOLUTION_SLA_HOURS: Readonly<Record<Severity, number>> = { critical: 24, high: 72, medium: 168, low: 336 };

const addHours = (iso: string, h: number) => new Date(new Date(iso).getTime() + h * 3_600_000).toISOString();

function step(row: ExceptionRow, to: ExceptionState, actor: string, at: string, patch: Partial<ExceptionRow> = {}, note?: string): ExceptionRow {
  return { ...row, ...patch, state: to, history: [...row.history, { at, actor, from: row.state, to, note }] };
}

/** Rows for every failure not already in the queue. Re-running a check never duplicates a row. */
export function raise(queue: readonly ExceptionRow[], results: readonly CheckResult[], actor: string, at: string): ExceptionRow[] {
  const have = new Set(queue.map((q) => q.key));
  const out: ExceptionRow[] = [];
  for (const r of results) {
    for (const f of r.failures) {
      const key = failureKey(r.id, f);
      if (have.has(key)) continue;
      have.add(key);
      out.push({
        key, checkId: r.id, domain: r.domain, severity: r.severity, code: f.code, ref: f.ref, origin: f.origin,
        state: 'open', raisedBy: actor, raisedAt: at,
        history: [{ at, actor, from: null, to: 'open' }],
      });
    }
  }
  return out;
}

export function assignOwner(row: ExceptionRow, owner: string, actor: string, at: string): ExceptionRow {
  if (row.state !== 'open') throw new Error(`cannot triage a ${row.state} exception`);
  return step(row, 'triaged', actor, at, { owner, dueAt: addHours(at, RESOLUTION_SLA_HOURS[row.severity]) });
}

export function resolve(row: ExceptionRow, resolution: string, actor: string, at: string): ExceptionRow {
  if (row.state !== 'triaged') throw new Error(`cannot resolve a ${row.state} exception`);
  if (resolution.trim() === '') throw new Error('a resolution must say what changed');
  return step(row, 'resolved', actor, at, { resolution });
}

/** Closed only by a later run that no longer fails, named by its evidence id, and not by whoever owns the fix. */
export function verify(row: ExceptionRow, evidenceId: string, stillFailing: boolean, actor: string, at: string): ExceptionRow {
  if (row.state !== 'resolved') throw new Error(`cannot verify a ${row.state} exception`);
  if (actor === row.owner) throw new Error('the owner of an exception cannot verify it');
  if (stillFailing) return step(row, 'triaged', actor, at, { dueAt: addHours(at, RESOLUTION_SLA_HOURS[row.severity]) }, 'reopened: the check still fails');
  return step(row, 'verified', actor, at, { verifiedByEvidence: evidenceId });
}

export function close(row: ExceptionRow, actor: string, at: string): ExceptionRow {
  if (row.state !== 'verified') throw new Error(`cannot close a ${row.state} exception`);
  return step(row, 'closed', actor, at);
}

/**
 * A waiver is the institution accepting a known difference. Critical
 * failures (wrong data people act on, access that should not exist) cannot be
 * waived by anyone; the approver is neither the person who raised it nor the
 * one who owns it; and it expires, so "temporary" is a date rather than a mood.
 */
export function waive(row: ExceptionRow, approver: string, reason: string, expiresAt: string, at: string): ExceptionRow {
  if (row.severity === 'critical') throw new Error('a critical exception cannot be waived');
  if (row.origin === 'migration') throw new Error('a defect the migration introduced is fixed in the mapping; it cannot be waived');
  if (row.state !== 'triaged') throw new Error(`cannot waive a ${row.state} exception`);
  if (approver === row.raisedBy || approver === row.owner) throw new Error('the approver must be neither the raiser nor the owner');
  if (reason.trim() === '') throw new Error('a waiver must give its reason');
  if (!(new Date(expiresAt).getTime() > new Date(at).getTime())) throw new Error('a waiver must expire in the future');
  return step(row, 'waived', approver, at, { waiver: { approver, reason, expiresAt } });
}

export function markOutOfScope(row: ExceptionRow, approver: string, reason: string, at: string): ExceptionRow {
  if (row.state !== 'triaged') throw new Error(`cannot descope a ${row.state} exception`);
  if (row.origin === 'migration') throw new Error('a defect the migration introduced is fixed in the mapping; it cannot be descoped');
  if (approver === row.raisedBy || approver === row.owner) throw new Error('the approver must be neither the raiser nor the owner');
  if (reason.trim() === '') throw new Error('descoping must give its reason');
  return step(row, 'out_of_scope', approver, at, { resolution: reason });
}

/** A fix that held is not permanent: if the check finds the same failure again, the exception is open again. */
export function reopen(row: ExceptionRow, actor: string, at: string, note = 'reopened: the check found it again'): ExceptionRow {
  if (row.state !== 'verified' && row.state !== 'closed') throw new Error(`cannot reopen a ${row.state} exception`);
  return step(row, 'open', actor, at, { verifiedByEvidence: undefined }, note);
}

/**
 * Fold a run into the queue, so a fix is proven by the next run and not by
 * anyone saying so.
 *
 * - a `resolved` row whose check ran is verified if it no longer fails, and
 *   sent back to triage if it still does (the actor is `validation`, which can
 *   never be the owner of the fix);
 * - a `verified` or `closed` row whose failure is back is reopened;
 * - every failure not yet in the queue is raised.
 *
 * Only checks that appear in `results` count as having run: an exception is
 * never verified by a run that did not look.
 */
export function applyRun(queue: readonly ExceptionRow[], results: readonly CheckResult[], evidenceId: string, at: string): ExceptionRow[] {
  const ran = new Set(results.map((r) => r.id));
  const failing = new Set(results.flatMap((r) => r.failures.map((f) => failureKey(r.id, f))));
  const next = queue.map((row) => {
    if (row.state === 'resolved' && ran.has(row.checkId)) return verify(row, evidenceId, failing.has(row.key), 'validation', at);
    if ((row.state === 'verified' || row.state === 'closed') && failing.has(row.key)) return reopen(row, 'validation', at);
    return row;
  });
  return [...next, ...raise(next, results, 'validation', at)];
}

/**
 * The failure keys the gate may treat as dispositioned at `now`: verified or
 * closed work, descoped records, and waivers that have not lapsed. An expired
 * waiver counts as open again — that is what expiry is for.
 */
export function dispositioned(queue: readonly ExceptionRow[], now: string): Set<string> {
  const out = new Set<string>();
  for (const q of queue) {
    if (q.state === 'closed' || q.state === 'verified' || q.state === 'out_of_scope') out.add(q.key);
    else if (q.state === 'waived' && q.waiver && q.waiver.expiresAt > now) out.add(q.key);
  }
  return out;
}

/** Exceptions past their deadline, worst severity first. For the daily stand-up. */
export function overdue(queue: readonly ExceptionRow[], now: string): ExceptionRow[] {
  const order: Record<Severity, number> = { critical: 0, high: 1, medium: 2, low: 3 };
  return queue
    .filter((q) => {
      if (q.state === 'open') return addHours(q.raisedAt, TRIAGE_SLA_HOURS[q.severity]) < now;
      if (q.state === 'triaged' || q.state === 'resolved') return q.dueAt !== undefined && q.dueAt < now;
      return false;
    })
    .sort((a, b) => order[a.severity] - order[b.severity]);
}
