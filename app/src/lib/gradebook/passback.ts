/**
 * Grade passback: sending released grades to an LMS, through an adapter,
 * once each, and reading back what arrived.
 *
 * Behind `writeback.lms_grade_passback`, which defaults off and is stopped by
 * `kill.writeback` and `kill.integration_sync` — `evaluateFlag` in
 * `lib/flags.ts` is the one place that decides, and a plan starts by asking
 * it. Three halves, and only the middle one does any I/O:
 *
 *   planPassback   pure. Which released grades would go, and why each of the
 *                  others would not. Reads `latestReleased` only, so a draft,
 *                  a moderated grade or a change not yet released is never in
 *                  a plan — a newer draft over a released grade sends the
 *                  released one, which is what the student was shown.
 *   runPassback    sends the plan through the adapter and returns the ledger
 *                  it leaves. Asks the gate again before every send, so a kill
 *                  switch engaged half way stops the rest. Each send carries
 *                  the entry's id as its idempotency key, and the ledger
 *                  refuses a second send of a version already sent.
 *   reconcile      pure. The ledger against what the LMS says it holds:
 *                  matched, different, missing there, or there and not ours.
 *
 * The database keeps the same ledger (`grade_passbacks`, one row per released
 * version, unique), so two runners cannot both send one version either.
 */
import type { FlagDecision } from '../flags';
import { latestReleased } from './ledger';
import type { Entry, Gradebook } from './model';

/** What an adapter is asked to send: one released version of one grade. */
export interface PassbackScore {
  /** The released entry's id: the adapter passes it on as its idempotency key. */
  key: string;
  lineItem: string;
  studentId: string;
  scoreGiven: number;
  scoreMaximum: number;
  comment: string;
  /** When the grade was released — the LMS's timestamp, never "now". */
  timestamp: string;
}

export type SendResult = { ok: true } | { ok: false; retryable: boolean; reason: string };

export interface RemoteScore {
  studentId: string;
  scoreGiven: number;
}

export type ReadResult = { ok: true; scores: readonly RemoteScore[] } | { ok: false; reason: string };

/**
 * An LMS, as passback sees one. LTI Assignment and Grade Services is the
 * first; anything that can take a score for a line item and list them back
 * is another. An adapter may throw; the runner treats a throw as a retryable
 * failure and never as a success.
 */
export interface LmsAdapter {
  readonly name: string;
  send(score: PassbackScore): Promise<SendResult>;
  read(lineItem: string): Promise<ReadResult>;
}

export interface LedgerRow {
  status: 'sent' | 'failed';
  attempts: number;
  reason: string;
  at: string;
}

/** By released entry id. */
export type PassbackLedger = Readonly<Record<string, LedgerRow>>;

export type SkipReason =
  | 'gate-closed'
  | 'no-line-item'
  | 'nothing-released'
  | 'no-score'
  | 'already-sent'
  | 'gave-up';

export interface Skip {
  itemId: string;
  studentId: string;
  why: SkipReason;
  reason: string;
}

export interface Plan {
  allowed: boolean;
  reason: string;
  sends: PassbackScore[];
  skips: Skip[];
}

/** After this many failed attempts a version stops being retried and is reported instead. */
export const MAX_ATTEMPTS = 5;

/** Which released grades on these items would pass back, and why the rest would not. */
export function planPassback(book: Gradebook, itemIds: readonly string[], gate: FlagDecision, ledger: PassbackLedger): Plan {
  if (!gate.allowed) {
    return { allowed: false, reason: `Passback is off: ${gate.reason}`, sends: [], skips: [] };
  }
  const sends: PassbackScore[] = [];
  const skips: Skip[] = [];
  const skip = (itemId: string, studentId: string, why: SkipReason, reason: string) => skips.push({ itemId, studentId, why, reason });
  for (const id of itemIds) {
    const it = book.items.find((i) => i.id === id);
    if (!it) continue;
    for (const s of [...book.roster].sort()) {
      if (!it.lineItem) {
        skip(it.id, s, 'no-line-item', `"${it.title}" is not linked to an LMS column.`);
        continue;
      }
      const e: Entry | null = latestReleased(book, it.id, s);
      if (!e) {
        skip(it.id, s, 'nothing-released', 'No released grade; nothing unreleased is ever sent.');
        continue;
      }
      if (e.score === null) {
        skip(it.id, s, 'no-score', `Marked ${e.mark ?? 'without a score'}; there is no number to send.`);
        continue;
      }
      const row = ledger[e.id];
      if (row?.status === 'sent') {
        skip(it.id, s, 'already-sent', 'This released version has already been sent.');
        continue;
      }
      if (row && row.attempts >= MAX_ATTEMPTS) {
        skip(it.id, s, 'gave-up', `${row.attempts} attempts failed; last: ${row.reason}`);
        continue;
      }
      sends.push({
        key: e.id, lineItem: it.lineItem, studentId: s, scoreGiven: e.score, scoreMaximum: it.pointsPossible,
        comment: e.comment, timestamp: e.at,
      });
    }
  }
  return { allowed: true, reason: `${sends.length} to send, ${skips.length} not.`, sends, skips };
}

export interface RunResult {
  ledger: PassbackLedger;
  sent: number;
  failed: number;
  /** Set when the gate closed part way; the rest of the plan was not attempted. */
  stopped: string | null;
}

/**
 * Send a plan. `gate` is asked before each send; `at` stamps the ledger.
 * Returns a new ledger; the one passed in is not changed.
 */
export async function runPassback(
  plan: Plan,
  adapter: LmsAdapter,
  ledger: PassbackLedger,
  gate: () => FlagDecision,
  at: string,
): Promise<RunResult> {
  const out: Record<string, LedgerRow> = { ...ledger };
  let sent = 0;
  let failed = 0;
  if (!plan.allowed) return { ledger: out, sent, failed, stopped: plan.reason };
  for (const score of plan.sends) {
    const g = gate();
    if (!g.allowed) return { ledger: out, sent, failed, stopped: `Stopped: ${g.reason}` };
    if (out[score.key]?.status === 'sent') continue;
    const attempts = (out[score.key]?.attempts ?? 0) + 1;
    let r: SendResult;
    try {
      r = await adapter.send(score);
    } catch (e) {
      r = { ok: false, retryable: true, reason: e instanceof Error ? e.message : String(e) };
    }
    if (r.ok) {
      out[score.key] = { status: 'sent', attempts, reason: `Sent to ${adapter.name}.`, at };
      sent++;
    } else {
      out[score.key] = { status: 'failed', attempts: r.retryable ? attempts : MAX_ATTEMPTS, reason: r.reason, at };
      failed++;
    }
  }
  return { ledger: out, sent, failed, stopped: null };
}

export type Drift = 'match' | 'different' | 'missing-remote' | 'unknown-remote' | 'unsent';

export interface DriftRow {
  studentId: string;
  drift: Drift;
  ours: number | null;
  theirs: number | null;
}

/**
 * One line item's released grades against what the LMS holds for it.
 * `unsent` is a released score the ledger has not sent; `unknown-remote` is a
 * score the LMS has that no released grade here accounts for.
 */
export function reconcile(book: Gradebook, itemId: string, ledger: PassbackLedger, remote: readonly RemoteScore[]): DriftRow[] {
  const theirs = new Map(remote.map((r) => [r.studentId, r.scoreGiven]));
  const out: DriftRow[] = [];
  for (const s of [...book.roster].sort()) {
    const e = latestReleased(book, itemId, s);
    const t = theirs.get(s) ?? null;
    theirs.delete(s);
    if (!e || e.score === null) {
      if (t !== null) out.push({ studentId: s, drift: 'unknown-remote', ours: null, theirs: t });
      continue;
    }
    if (ledger[e.id]?.status !== 'sent') out.push({ studentId: s, drift: 'unsent', ours: e.score, theirs: t });
    else if (t === null) out.push({ studentId: s, drift: 'missing-remote', ours: e.score, theirs: null });
    else out.push({ studentId: s, drift: Math.abs(t - e.score) < 1e-9 ? 'match' : 'different', ours: e.score, theirs: t });
  }
  for (const [s, t] of theirs) out.push({ studentId: s, drift: 'unknown-remote', ours: null, theirs: t });
  return out;
}
