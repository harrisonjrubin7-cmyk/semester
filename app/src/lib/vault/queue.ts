/**
 * Edits made offline, held until the server has said what became of them.
 *
 * This is the state machine from `docs/architecture/offline-sync-contract.md`
 * made executable, for the classes the vault may keep: the student's own
 * plan and drafts, and allowlisted assignment metadata. It is *not* a path to
 * the official record. Registration, grades, billing and holds are classes
 * the vault refuses to hold, so a mutation for one cannot be enqueued —
 * `vault.put` throws before anything is written — and `lib/sync/classes.ts`
 * keeps them `never-queued`. There is no flag that lets one through.
 *
 * ## States
 *
 *     saved_locally ─► queued ─► accepted
 *                         │ ├──► rejected
 *                         │ └──► conflict_requires_copy
 *                         └─(retry, with backoff)─► queued
 *
 * `saved_locally` is on this device only: never shared, never sent.
 * `queued` is waiting for the server. Neither is "done", and the interface
 * must not say so. `accepted`, `rejected` and `conflict_requires_copy` are
 * final; a rejected edit stays on the list with its reason, because a
 * silently dropped edit is the failure this exists to prevent.
 *
 * ## One edit, once
 *
 * The caller supplies the idempotency key (a fresh `crypto.randomUUID()` per
 * user action, not per attempt). Enqueuing the same key twice returns the
 * first entry, and the same key travels with every retry so the server can
 * collapse a request that was cut off after it landed.
 *
 * ## Never sent late
 *
 * A mutation past `expiresAt` is rejected as `expired` instead of sent. An
 * edit that has waited a week has been made against a world that moved on.
 * `retries_exhausted` is the dead letter: after `maxAttempts` it stops, says
 * so, and waits for the student to decide, rather than retrying forever.
 */

import { minimise, type DataClass } from './classes';
import { compare } from './hlc';
import type { Vault } from './vault';

export const STATES = ['saved_locally', 'queued', 'accepted', 'rejected', 'conflict_requires_copy'] as const;
export type State = (typeof STATES)[number];

const NEXT: Record<State, readonly State[]> = {
  saved_locally: ['queued', 'rejected'],
  queued: ['queued', 'accepted', 'rejected', 'conflict_requires_copy'],
  accepted: [],
  rejected: [],
  conflict_requires_copy: [],
};

export const canMove = (from: State, to: State): boolean => NEXT[from].includes(to);

export const WAIT_MS = 7 * 24 * 60 * 60 * 1000;
export const MAX_ATTEMPTS = 6;
const BACKOFF_CAP_MS = 5 * 60 * 1000;

export interface Mutation {
  /** The idempotency key. */
  id: string;
  recordId: string;
  op: 'upsert' | 'delete';
  cls: DataClass;
  fields: Record<string, unknown>;
  /** The stamp of the version this edit was made against, so the server can tell a conflict from a plain update. */
  baseStamp: string | null;
  stamp: string;
  correlationId: string;
  policyVersion: string;
  state: State;
  attempts: number;
  nextAttemptAt: number;
  createdAt: number;
  expiresAt: number;
  /** Why it is in its state, when that is not obvious. Shown to the student. */
  reason?: 'expired' | 'retries_exhausted' | string;
}

export type Outcome =
  | { status: 'accepted' }
  | { status: 'rejected'; reason: string }
  | { status: 'conflict' }
  | { status: 'retry' };

export type Send = (m: Readonly<Mutation>, idempotencyKey: string) => Promise<Outcome>;

const idOf = (key: string) => `mutation:${key}`;

export interface Enqueue {
  key: string;
  recordId: string;
  op: Mutation['op'];
  cls: DataClass;
  fields?: Record<string, unknown>;
  baseStamp?: string | null;
  stamp: string;
  correlationId: string;
  policyVersion: string;
  /** Hold it `saved_locally` (default `queued`): for an edit the student has not yet chosen to send. */
  hold?: boolean;
}

export async function enqueue(vault: Vault, e: Enqueue, now = Date.now()): Promise<Mutation> {
  const have = await vault.get<Mutation>(idOf(e.key));
  if (have) return have.value;
  const m: Mutation = {
    id: e.key, recordId: e.recordId, op: e.op, cls: e.cls, fields: minimise(e.cls, e.fields ?? {}),
    baseStamp: e.baseStamp ?? null, stamp: e.stamp, correlationId: e.correlationId, policyVersion: e.policyVersion,
    state: e.hold ? 'saved_locally' : 'queued', attempts: 0, nextAttemptAt: now, createdAt: now, expiresAt: now + WAIT_MS,
  };
  // The class gate lives in the vault, so this throws for a class that may not
  // be kept offline, and nothing about the edit is written anywhere.
  await vault.put(idOf(e.key), e.cls, m as unknown as Record<string, unknown>, e.stamp, { envelope: true });
  return m;
}

async function save(vault: Vault, m: Mutation): Promise<void> {
  await vault.put(idOf(m.id), m.cls, m as unknown as Record<string, unknown>, m.stamp, { envelope: true });
}

function move(m: Mutation, to: State, reason?: string): Mutation {
  if (!canMove(m.state, to)) throw new Error(`A ${m.state} edit cannot become ${to}.`);
  return { ...m, state: to, ...(reason ? { reason } : {}) };
}

/** Release a held edit for sending. */
export async function release(vault: Vault, key: string): Promise<Mutation | null> {
  const have = await vault.get<Mutation>(idOf(key));
  if (!have) return null;
  const next = move(have.value, 'queued');
  await save(vault, next);
  return next;
}

/** Every edit still on this device, oldest first, final ones included until the student clears them. */
export async function entries(vault: Vault): Promise<Mutation[]> {
  const out: Mutation[] = [];
  for (const id of await vault.list()) {
    if (!id.startsWith('mutation:')) continue;
    const it = await vault.get<Mutation>(id);
    if (it) out.push(it.value);
  }
  return out.sort((a, b) => compare(a.stamp, b.stamp));
}

export interface DrainReport { sent: number; accepted: number; rejected: number; conflicts: number; retrying: number; skipped: number }

export async function drain(
  vault: Vault,
  send: Send,
  opts: { now?: () => number; maxAttempts?: number } = {},
): Promise<DrainReport> {
  const now = opts.now ?? Date.now;
  const max = opts.maxAttempts ?? MAX_ATTEMPTS;
  const report: DrainReport = { sent: 0, accepted: 0, rejected: 0, conflicts: 0, retrying: 0, skipped: 0 };
  const blocked = new Set<string>(); // records with an earlier edit still waiting: keep their order

  for (const m of await entries(vault)) {
    if (m.state !== 'queued') continue;
    if (now() >= m.expiresAt) {
      await save(vault, move(m, 'rejected', 'expired'));
      report.rejected++;
      continue;
    }
    if (blocked.has(m.recordId) || now() < m.nextAttemptAt) {
      blocked.add(m.recordId);
      report.skipped++;
      continue;
    }
    report.sent++;
    let outcome: Outcome;
    try {
      outcome = await send(m, m.id);
    } catch {
      outcome = { status: 'retry' };
    }
    if (outcome.status === 'accepted') {
      await save(vault, move(m, 'accepted'));
      report.accepted++;
    } else if (outcome.status === 'rejected') {
      await save(vault, move(m, 'rejected', outcome.reason));
      report.rejected++;
    } else if (outcome.status === 'conflict') {
      await save(vault, move(m, 'conflict_requires_copy'));
      report.conflicts++;
    } else {
      const attempts = m.attempts + 1;
      if (attempts >= max) {
        await save(vault, move({ ...m, attempts }, 'rejected', 'retries_exhausted'));
        report.rejected++;
      } else {
        const wait = Math.min(2 ** attempts * 1000, BACKOFF_CAP_MS);
        await save(vault, { ...move(m, 'queued'), attempts, nextAttemptAt: now() + wait });
        blocked.add(m.recordId);
        report.retrying++;
      }
    }
  }
  return report;
}

/** A field value with the stamp of the edit that set it. */
export type Stamped = Record<string, { v: unknown; stamp: string }>;

export interface FieldConflict { field: string; kept: unknown; dropped: unknown }

/**
 * Merge two copies of one record field by field, newest stamp winning each
 * field. Independent edits to different fields both survive; an edit to the
 * same field on two devices keeps the later one and reports the other, so the
 * loser is evidence the student can see, not a silent overwrite.
 *
 * Commutative and idempotent: `merge(a, b)` and `merge(b, a)` agree, and
 * merging a copy into itself changes nothing, so replays and reorderings
 * converge. (Equal stamps from different devices differ in their node suffix,
 * so ties cannot occur between real devices.)
 */
export function mergeFields(a: Stamped, b: Stamped): { merged: Stamped; conflicts: FieldConflict[] } {
  const merged: Stamped = {};
  const conflicts: FieldConflict[] = [];
  for (const f of new Set([...Object.keys(a), ...Object.keys(b)])) {
    const x = a[f], y = b[f];
    if (!x || !y) { merged[f] = (x ?? y)!; continue; }
    const win = compare(x.stamp, y.stamp) >= 0 ? x : y;
    const lose = win === x ? y : x;
    merged[f] = win;
    if (JSON.stringify(win.v) !== JSON.stringify(lose.v)) conflicts.push({ field: f, kept: win.v, dropped: lose.v });
  }
  return { merged, conflicts };
}
