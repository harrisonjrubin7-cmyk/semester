/**
 * The exception queue: where a finding goes to be decided, not forgotten.
 *
 * Every finding from a validation run becomes an exception with an owner, a
 * due time by severity, and exactly one way out. The rules are the ones a
 * records office would want written down before the first migration, because
 * each is what somebody under deadline pressure would otherwise talk
 * themselves out of:
 *
 * - **A fix is proven by the next run, not by a person saying so.** An
 *   exception marked fixed whose finding the re-run still reports is reopened.
 *   One whose finding is gone is closed by the run.
 * - **The migration's own critical defects cannot be waived.** Only fixed.
 *   Nobody may decide that a wrong grade of ours is acceptable.
 * - **A waiver is a decision with a name, a reason and an end date.** It needs
 *   an approver who is not the person proposing it, a reason that says
 *   something, and an expiry; an expired waiver blocks again. In a high-stakes
 *   domain, anything above minor also needs the Semester side to countersign.
 * - **Only source-origin defects can be waived or fixed at source.** A defect
 *   the migration introduced is fixed in the mapping.
 * - **Excluding a row is a scope change.** The decision is recorded here; the
 *   exclusion itself lives in the institution's `excluded.json`, which the
 *   validation `Pair` carries with its reason, so a row is never missing
 *   without a sentence saying why.
 *
 * Everything here is pure. The queue is a value; filing it is the ledger's job.
 */
import type { Origin, Severity } from './types.ts';
import type { ReportFinding } from './quality.ts';

export type Disposition = 'fix_source' | 'fix_mapping' | 'waive' | 'exclude';

export interface Waiver {
  approvedBy: string;
  countersignedBy?: string;
  reason: string;
  /** ISO date, inclusive. */
  expiresOn: string;
}

export interface Exception {
  id: string;
  domain: string;
  invariant: string;
  ref: string;
  severity: Severity;
  origin: Origin;
  what: string;
  openedAt: string;
  dueAt: string;
  status: 'open' | 'dispositioned' | 'closed';
  disposition?: Disposition;
  decidedBy?: string;
  decidedAt?: string;
  waiver?: Waiver;
  closedBy?: 'rerun';
  history: { at: string; by: string; what: string }[];
}

export type Queue = readonly Exception[];

/** Hours to a decision, by severity. A critical finding is a same-day matter. */
export const SLA_HOURS: Readonly<Record<Severity, number>> = { critical: 24, major: 72, minor: 240 };

/** The longest a waiver may run. A waiver is a bridge, not a policy. */
export const MAX_WAIVER_DAYS = 90;

const addHours = (iso: string, h: number) => new Date(Date.parse(iso) + h * 3_600_000).toISOString();

export const exceptionId = (invariant: string, ref: string) => `${invariant}:${ref.replace(/^sha256:/, '').slice(0, 12)}`;

export type Result = { ok: true; queue: Queue } | { ok: false; why: string };

/**
 * Fold a run into the queue.
 *
 * `ran` is every invariant the run executed: an exception is only closed by a
 * run that actually looked again, never by one that did not run its check.
 */
export function ingest(queue: Queue, domain: string, ran: readonly string[], findings: readonly (ReportFinding & { invariant: string })[], now: string): Queue {
  const current = new Map(findings.map((f) => [exceptionId(f.invariant, f.ref), f]));
  const ranSet = new Set(ran);
  const out: Exception[] = queue.map((e) => {
    if (e.domain !== domain || !ranSet.has(e.invariant) || e.status === 'closed') return e;
    if (!current.has(e.id)) return { ...e, status: 'closed', closedBy: 'rerun', history: [...e.history, { at: now, by: 'validation', what: 'no longer found by a re-run' }] };
    const fixClaimed = e.status === 'dispositioned' && (e.disposition === 'fix_source' || e.disposition === 'fix_mapping');
    return fixClaimed
      ? { ...e, status: 'open', history: [...e.history, { at: now, by: 'validation', what: 'reopened: the re-run still finds it' }] }
      : e;
  });
  const have = new Set(out.map((e) => e.id));
  for (const [id, f] of current) {
    if (have.has(id)) {
      const i = out.findIndex((e) => e.id === id);
      if (out[i].status === 'closed') out[i] = { ...out[i], status: 'open', closedBy: undefined, history: [...out[i].history, { at: now, by: 'validation', what: 'reopened: found again' }] };
      continue;
    }
    out.push({
      id, domain, invariant: f.invariant, ref: f.ref, severity: f.severity, origin: f.origin, what: f.what,
      openedAt: now, dueAt: addHours(now, SLA_HOURS[f.severity]), status: 'open',
      history: [{ at: now, by: 'validation', what: 'opened' }],
    });
  }
  return out;
}

export interface DecisionInput {
  disposition: Disposition;
  by: string;
  now: string;
  /** Required for `waive` and `exclude`. */
  approvedBy?: string;
  countersignedBy?: string;
  reason?: string;
  expiresOn?: string;
  /** Whether the domain is high stakes; set by the caller from the domain spec. */
  highStakes: boolean;
}

export function decide(queue: Queue, id: string, input: DecisionInput): Result {
  const e = queue.find((x) => x.id === id);
  if (!e) return { ok: false, why: `No exception ${id}.` };
  if (e.status === 'closed') return { ok: false, why: 'That exception is closed; a re-run reopens it if the finding returns.' };
  if (!input.by.trim()) return { ok: false, why: 'A decision needs the person making it.' };
  const d = input.disposition;
  if (e.origin === 'migration' && d !== 'fix_mapping') {
    return { ok: false, why: 'A defect the migration introduced is fixed in the mapping. It cannot be waived, excluded or passed to the source.' };
  }
  if (e.origin === 'source' && d === 'fix_mapping') return { ok: false, why: 'The source already had this defect; fixing the mapping would change the record rather than carry it.' };

  let waiver: Waiver | undefined;
  if (d === 'waive' || d === 'exclude') {
    const reason = (input.reason ?? '').trim();
    if (reason.length < 20) return { ok: false, why: 'A waiver or exclusion needs a reason that says what was decided and why (20 characters at least).' };
    if (!input.approvedBy?.trim()) return { ok: false, why: 'A waiver or exclusion needs an approver.' };
    if (input.approvedBy === input.by) return { ok: false, why: 'The approver must be someone other than the person proposing it.' };
    if (!input.expiresOn || !/^\d{4}-\d{2}-\d{2}$/.test(input.expiresOn)) return { ok: false, why: 'A waiver or exclusion needs an end date (YYYY-MM-DD).' };
    const days = (Date.parse(`${input.expiresOn}T23:59:59Z`) - Date.parse(input.now)) / 86_400_000;
    if (!(days > 0)) return { ok: false, why: 'That end date is already past.' };
    if (days > MAX_WAIVER_DAYS + 1) return { ok: false, why: `A waiver runs ${MAX_WAIVER_DAYS} days at most; renew it with a new decision.` };
    if (d === 'waive' && input.highStakes && e.severity !== 'minor') {
      if (!input.countersignedBy?.trim()) return { ok: false, why: 'In a high-stakes domain a waiver above minor needs the Semester side to countersign.' };
      if (input.countersignedBy === input.approvedBy || input.countersignedBy === input.by) return { ok: false, why: 'The countersigner must be a third person.' };
    }
    waiver = { approvedBy: input.approvedBy, countersignedBy: input.countersignedBy, reason, expiresOn: input.expiresOn };
  }

  return {
    ok: true,
    queue: queue.map((x) => (x.id !== id ? x : {
      ...x, status: 'dispositioned', disposition: d, decidedBy: input.by, decidedAt: input.now, waiver,
      history: [...x.history, { at: input.now, by: input.by, what: d }],
    })),
  };
}

/** The decision that is still in force: unexpired waivers and exclusions only. */
const standing = (e: Exception, now: string) =>
  e.status === 'dispositioned' && (e.disposition === 'waive' || e.disposition === 'exclude') && e.waiver !== undefined && Date.parse(`${e.waiver.expiresOn}T23:59:59Z`) >= Date.parse(now);

/**
 * What stops cutover: critical and major exceptions that are open, claimed
 * fixed but not yet proven by a re-run, or waived with a waiver that ran out.
 * Minor ones never block; they are reported.
 */
export function blockers(queue: Queue, now: string, domain?: string): Exception[] {
  return queue.filter((e) => (domain === undefined || e.domain === domain) && e.status !== 'closed' && e.severity !== 'minor' && !standing(e, now));
}

export function overdue(queue: Queue, now: string, domain?: string): Exception[] {
  return queue.filter((e) => (domain === undefined || e.domain === domain) && e.status === 'open' && Date.parse(e.dueAt) < Date.parse(now));
}

export interface Snapshot {
  domain: string;
  openCritical: number;
  openMajor: number;
  openMinor: number;
  overdue: number;
  standingWaivers: number;
}

export function snapshot(queue: Queue, domain: string, now: string): Snapshot {
  const b = blockers(queue, now, domain);
  const open = queue.filter((e) => e.domain === domain && e.status !== 'closed');
  return {
    domain,
    openCritical: b.filter((e) => e.severity === 'critical').length,
    openMajor: b.filter((e) => e.severity === 'major').length,
    openMinor: open.filter((e) => e.severity === 'minor' && !standing(e, now)).length,
    overdue: overdue(queue, now, domain).length,
    standingWaivers: open.filter((e) => standing(e, now)).length,
  };
}
