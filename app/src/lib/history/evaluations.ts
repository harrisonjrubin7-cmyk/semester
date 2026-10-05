/**
 * The minimum needed to answer "why did Semester say that last month?".
 *
 * A student, an advisor or a school asks why a rule gave an answer on a day,
 * and the honest answer needs three things: which rule and which version, what
 * was shown, and how fresh the source was. It does not need the student's
 * record. So this keeps **metadata by default** and no copy of the inputs at
 * all, for a short, configurable time, on the device, and forgets on request.
 *
 * ## The defaults, and why each is the safe one
 *
 * - **Off is a setting, and off writes nothing.** Zero days of retention stores
 *   no record and deletes what there is.
 * - **Thirty days, never more than ninety.** A request to keep longer is
 *   clamped, not refused, so a mis-set value cannot become a long-lived store.
 * - **No snapshot of the inputs** unless the policy turns snapshots on, and then
 *   only a small one (4 KB) that expires with the record. Without it an answer
 *   cannot be *re*computed, only explained; that is the trade, and it is the
 *   right one until a retention decision says otherwise.
 * - **A fingerprint, not the inputs**, to say whether two evaluations saw the
 *   same thing. It is a hash of a small input, which can be guessed when the
 *   input is low-entropy, so it is treated as personal data: it is deleted,
 *   exported and expires exactly as the record does.
 * - **No identifier for the student.** The record is on the student's own
 *   device, so it is theirs by where it lives. It carries a tenant id only so a
 *   school's records can be removed together.
 * - **Nothing is synced.** It is never sent to the server, so there is no server
 *   copy to delete, and `history.test.ts` fails if this module imports the
 *   account client.
 *
 * None of this is an approved retention schedule. It is the smallest thing that
 * serves the question, chosen so that a governance decision can only make it
 * longer by an explicit, visible change. `docs/TIME-TRAVEL-HISTORY.md` lists
 * what has to be decided, and by whom, before it is lengthened.
 */

export const DAY = 86_400_000;

export interface HistoryPolicy {
  /** Days a record is shown and kept. 0 switches the history off. */
  retentionDays: number;
  /** The most records kept; older ones go first. */
  maxRecords: number;
  /** Whether a small snapshot of the inputs may be stored. Off unless a school turns it on. */
  snapshots: boolean;
}

export const DEFAULT_POLICY: HistoryPolicy = { retentionDays: 30, maxRecords: 200, snapshots: false };
export const MAX_RETENTION_DAYS = 90;
export const MAX_RECORDS = 1000;
export const MAX_SNAPSHOT_BYTES = 4096;
export const MAX_TEXT = 500;

/** A ceiling a school or a contract can set on what a device may choose. */
export interface Ceiling {
  retentionDays?: number;
  snapshots?: boolean;
}

/** A requested policy, made safe: whole numbers, inside the limits, and never above a ceiling. */
export function clampPolicy(requested: Partial<HistoryPolicy> | null | undefined, ceiling: Ceiling = {}): HistoryPolicy {
  const whole = (n: unknown, fallback: number) => (typeof n === 'number' && Number.isFinite(n) ? Math.floor(n) : fallback);
  const days = Math.min(Math.max(0, whole(requested?.retentionDays, DEFAULT_POLICY.retentionDays)), MAX_RETENTION_DAYS, ceiling.retentionDays ?? MAX_RETENTION_DAYS);
  const records = Math.min(Math.max(1, whole(requested?.maxRecords, DEFAULT_POLICY.maxRecords)), MAX_RECORDS);
  const snapshots = requested?.snapshots === true && ceiling.snapshots !== false && days > 0;
  return { retentionDays: Math.max(0, days), maxRecords: records, snapshots };
}

export interface EvaluationRecord {
  id: string;
  /** Milliseconds: when the rule was evaluated. */
  at: number;
  tenantId: string | null;
  /** What was evaluated, as a rule-side identifier and never a person: `degree.requirement.quantitative`. */
  subject: string;
  ruleId: string;
  ruleVersion: string;
  /** What the student was shown. */
  outcome: string;
  /** The explanation the student was shown. */
  explanation: string;
  /** Which source the answer rested on, and how fresh it was. */
  freshness: { source: string; asOf: string | null } | null;
  /** A hash of the inputs, to say whether two evaluations agree. Personal data for deletion and export. */
  fingerprint: string | null;
  /** Present only when the policy allowed it, and small. */
  snapshot?: unknown;
}

/** The only fields a record may carry. Anything else a caller passes is dropped, not stored. */
export const RECORD_KEYS = ['id', 'at', 'tenantId', 'subject', 'ruleId', 'ruleVersion', 'outcome', 'explanation', 'freshness', 'fingerprint', 'snapshot'] as const;

export interface EvaluationInput {
  subject: string;
  ruleId: string;
  ruleVersion: string;
  outcome: string;
  explanation: string;
  tenantId?: string | null;
  freshness?: { source: string; asOf: string | null } | null;
  fingerprint?: string | null;
  snapshot?: unknown;
  /** Anything else is ignored. The type is open so a caller holding a richer object cannot leak it by spreading. */
  [extra: string]: unknown;
}

const text = (s: unknown, max = MAX_TEXT) => (typeof s === 'string' ? s.slice(0, max) : '');
const bytes = (v: unknown): number => {
  try { return new TextEncoder().encode(JSON.stringify(v) ?? '').length; } catch { return Infinity; }
};

/** The record to store, or null when the policy says nothing is stored. Copies only the fields above. */
export function makeRecord(input: EvaluationInput, id: string, at: number, policy: HistoryPolicy): EvaluationRecord | null {
  if (policy.retentionDays <= 0) return null;
  const rec: EvaluationRecord = {
    id,
    at,
    tenantId: typeof input.tenantId === 'string' ? input.tenantId.slice(0, 100) : null,
    subject: text(input.subject, 200),
    ruleId: text(input.ruleId, 200),
    ruleVersion: text(input.ruleVersion, 100),
    outcome: text(input.outcome, 200),
    explanation: text(input.explanation),
    freshness: input.freshness && typeof input.freshness.source === 'string'
      ? { source: text(input.freshness.source, 200), asOf: typeof input.freshness.asOf === 'string' ? input.freshness.asOf.slice(0, 40) : null }
      : null,
    fingerprint: typeof input.fingerprint === 'string' ? input.fingerprint.slice(0, 128) : null,
  };
  if (policy.snapshots && input.snapshot !== undefined && bytes(input.snapshot) <= MAX_SNAPSHOT_BYTES) rec.snapshot = input.snapshot;
  return rec;
}

/** A record read back from storage, or null when it is not exactly one. */
export function readRecord(raw: unknown): EvaluationRecord | null {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) return null;
  const r = raw as Record<string, unknown>;
  if (typeof r.id !== 'string' || typeof r.at !== 'number' || !Number.isFinite(r.at)) return null;
  for (const k of ['subject', 'ruleId', 'ruleVersion', 'outcome', 'explanation'] as const) if (typeof r[k] !== 'string') return null;
  if (!(r.tenantId === null || typeof r.tenantId === 'string')) return null;
  if (!(r.fingerprint === null || typeof r.fingerprint === 'string')) return null;
  const f = r.freshness as { source?: unknown; asOf?: unknown } | null;
  if (!(f === null || (typeof f === 'object' && typeof f.source === 'string' && (f.asOf === null || typeof f.asOf === 'string')))) return null;
  const out: EvaluationRecord = {
    id: r.id, at: r.at, tenantId: r.tenantId as string | null, subject: r.subject as string, ruleId: r.ruleId as string,
    ruleVersion: r.ruleVersion as string, outcome: r.outcome as string, explanation: r.explanation as string,
    freshness: f as EvaluationRecord['freshness'], fingerprint: r.fingerprint as string | null,
  };
  if ('snapshot' in r && r.snapshot !== undefined) out.snapshot = r.snapshot;
  return out;
}

/** A hash of the inputs, in canonical key order, so equal inputs give equal fingerprints. */
export async function fingerprint(inputs: unknown): Promise<string> {
  const canon = (v: unknown): unknown => Array.isArray(v) ? v.map(canon)
    : v && typeof v === 'object' ? Object.fromEntries(Object.keys(v).sort().map((k) => [k, canon((v as Record<string, unknown>)[k])]))
    : v;
  const data = new TextEncoder().encode(JSON.stringify(canon(inputs)) ?? 'null');
  const digest = await crypto.subtle.digest('SHA-256', data);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

// ── The pure lifecycle ────────────────────────────────────────────────────

export interface State {
  records: readonly EvaluationRecord[];
  policy: HistoryPolicy;
}

/** A record is shown while `now` is before `at` plus the retention, so the last instant is excluded. */
export const alive = (r: EvaluationRecord, policy: HistoryPolicy, now: number): boolean =>
  policy.retentionDays > 0 && r.at <= now && now < r.at + policy.retentionDays * DAY;

/** What may be shown now: unexpired, newest first, no more than the cap. Expired records are never returned, purged or not. */
export function visible(s: State, now: number): EvaluationRecord[] {
  return s.records.filter((r) => alive(r, s.policy, now)).sort((a, b) => b.at - a.at || a.id.localeCompare(b.id)).slice(0, s.policy.maxRecords);
}

/** What is physically kept: exactly what is visible. */
export function prune(s: State, now: number): State {
  return { ...s, records: visible(s, now) };
}

export function add(s: State, rec: EvaluationRecord | null, now: number): State {
  if (rec === null) return prune(s, now);
  return prune({ ...s, records: [...s.records.filter((r) => r.id !== rec.id), rec] }, now);
}

export interface Scope {
  /** Remove every record for this school. */
  tenantId?: string;
  /** Remove every record about this subject. */
  subject?: string;
  /** Remove records at or before this time. */
  before?: number;
}

/** Remove what the scope names. An empty scope removes nothing; `clear` is the way to remove everything. */
export function forget(s: State, scope: Scope): State {
  if (scope.tenantId === undefined && scope.subject === undefined && scope.before === undefined) return s;
  return {
    ...s,
    records: s.records.filter((r) => !(
      (scope.tenantId === undefined || r.tenantId === scope.tenantId)
      && (scope.subject === undefined || r.subject === scope.subject)
      && (scope.before === undefined || r.at <= scope.before)
    )),
  };
}

export interface HistoryExport {
  kind: 'semester-evaluation-history';
  version: 1;
  exportedAt: string;
  policy: HistoryPolicy;
  note: string;
  records: EvaluationRecord[];
}

/** What the student takes away: every record still visible, in full, and the policy that governs it. */
export function toExport(s: State, now: number): HistoryExport {
  return {
    kind: 'semester-evaluation-history',
    version: 1,
    exportedAt: new Date(now).toISOString(),
    policy: s.policy,
    note: 'Why Semester gave each answer on the day it did. Kept on this device only, for a short time, and never sent to a server.',
    records: visible(s, now),
  };
}
