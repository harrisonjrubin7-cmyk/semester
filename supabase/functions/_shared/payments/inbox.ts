/**
 * What happens to a verified provider event after it is written to the inbox
 * (`provider_event_inbox`, 20261006090000): parked when it is early, retried on a
 * clock, dead-lettered when it will not apply, and replayed by a person.
 *
 * Nothing here knows a database. The inbox is a port (`InboxStore`), the way an
 * event is applied is a function the caller passes, and the clock is an argument,
 * so the whole life of an event runs in a test. **Nothing calls this from an Edge
 * Function yet**: `billing-webhook` still answers 500 for an early invoice and
 * lets the provider retry, and that stays the safety net until a drain job exists
 * and has been watched.
 *
 * The status moves below are the table trigger's, written a second time on
 * purpose: `app/src/lib/payments/inbox.test.ts` reads the trigger's SQL and fails
 * if the two lists differ.
 */
import type { NormalizedPaymentEvent } from './types.ts';

export type InboxStatus = 'received' | 'applied' | 'parked' | 'failed' | 'dead_letter';

/** Moves to a different status (`private.provider_event_inbox_guard`). `applied` is terminal. */
export const MOVES: Record<InboxStatus, readonly InboxStatus[]> = {
  received: ['applied', 'parked', 'failed'],
  parked: ['applied', 'parked', 'dead_letter'],
  failed: ['applied', 'failed', 'dead_letter'],
  dead_letter: ['received'],
  applied: [],
};

/** The trigger lets `received` and `dead_letter` stay as they are, and `parked` and `failed` re-enter themselves via MOVES. */
export function canMove(from: InboxStatus, to: InboxStatus): boolean {
  if (from === 'applied') return false;
  if (to === from && from !== 'parked' && from !== 'failed') return true;
  return MOVES[from].includes(to);
}

/** After this many tries an event stops retrying itself and waits for a person. */
export const MAX_ATTEMPTS = 8;

/** Seconds to wait after the nth failed try: a minute, doubling, never more than six hours. */
export const backoffSeconds = (attempts: number): number =>
  Math.min(60 * 2 ** Math.max(0, attempts - 1), 6 * 3600);

/** Codes, never messages: nothing a request or a response said can be stored. */
export type InboxErrorCode = 'not_ready' | 'apply_error';

/** What a caller's `apply` reports. A throw is `apply_error`. */
export type ApplyOutcome = 'applied' | 'not_ready';

/** The columns the table keeps outside the projection. */
type Identity = 'provider' | 'eventId' | 'occurredAt' | 'payloadSha256' | 'type';

export interface InboxRow {
  id: string;
  provider: string;
  eventId: string;
  eventType: string;
  occurredAt: string;
  payloadSha256: string;
  /** The event minus the columns kept beside it: ids, amounts, statuses, nothing personal. */
  projection: Record<string, unknown>;
  status: InboxStatus;
  attempts: number;
  nextAttemptAt: string | null;
  lastErrorCode: InboxErrorCode | null;
  appliedAt: string | null;
}

export interface InboxStore {
  /** Insert if `(provider, eventId)` is new. A second delivery of the same event is `duplicate`. */
  insert(row: Omit<InboxRow, 'id'>): Promise<'inserted' | 'duplicate'>;
  /** Rows waiting to be tried: `received`, or `parked`/`failed` whose time has come, oldest first. */
  due(nowIso: string, limit: number): Promise<InboxRow[]>;
  get(id: string): Promise<InboxRow | null>;
  update(id: string, patch: Partial<Pick<InboxRow, 'status' | 'attempts' | 'nextAttemptAt' | 'lastErrorCode' | 'appliedAt'>>): Promise<void>;
}

const TABLE_DIGIT_RUN = /[0-9]([ -]?[0-9]){12,18}/;
const MAX_PROJECTION_BYTES = 8192;

/** The part of an event the table keeps as `projection`, or null when the table would refuse it. */
export function project(e: NormalizedPaymentEvent): Record<string, unknown> | null {
  const { provider: _p, eventId: _i, occurredAt: _o, payloadSha256: _h, type: _t, ...rest } = e as NormalizedPaymentEvent & Record<Identity, unknown>;
  const text = JSON.stringify(rest);
  if (new TextEncoder().encode(text).length > MAX_PROJECTION_BYTES || TABLE_DIGIT_RUN.test(text)) return null;
  return rest;
}

/** Put the event back together from a row. */
export const rebuild = (r: InboxRow): NormalizedPaymentEvent =>
  ({ ...r.projection, provider: r.provider, eventId: r.eventId, occurredAt: r.occurredAt, payloadSha256: r.payloadSha256, type: r.eventType }) as NormalizedPaymentEvent;

/**
 * Write a verified event. `unrecordable` means the table would refuse the projection
 * (too large, or a run of digits that could be a card number): the caller carries on
 * as it did before the inbox existed. It is never a reason to refuse the event.
 */
export async function record(store: InboxStore, e: NormalizedPaymentEvent): Promise<'recorded' | 'duplicate' | 'unrecordable'> {
  const projection = project(e);
  if (!projection) return 'unrecordable';
  const r = await store.insert({
    provider: e.provider, eventId: e.eventId, eventType: e.type, occurredAt: e.occurredAt, payloadSha256: e.payloadSha256,
    projection, status: 'received', attempts: 0, nextAttemptAt: null, lastErrorCode: null, appliedAt: null,
  });
  return r === 'inserted' ? 'recorded' : 'duplicate';
}

export interface DrainReport { tried: number; applied: number; parked: number; failed: number; deadLettered: number }

/** Try every row whose time has come. One row's trouble never stops the others. */
export async function drain(
  store: InboxStore, apply: (e: NormalizedPaymentEvent) => Promise<ApplyOutcome>, nowIso: string, limit = 50,
): Promise<DrainReport> {
  const report: DrainReport = { tried: 0, applied: 0, parked: 0, failed: 0, deadLettered: 0 };
  for (const row of await store.due(nowIso, limit)) {
    report.tried++;
    const attempts = row.attempts + 1;
    let code: InboxErrorCode | null = null;
    try {
      if ((await apply(rebuild(row))) === 'applied') {
        await store.update(row.id, { status: 'applied', attempts, appliedAt: nowIso, nextAttemptAt: null, lastErrorCode: null });
        report.applied++;
        continue;
      }
      code = 'not_ready';
    } catch {
      code = 'apply_error';
    }
    // Not applied. Out of tries: wait for a person. A first miss is parked when the subscription is not there yet and failed when applying threw; after that it stays where it is and waits out the backoff.
    const tired = attempts >= MAX_ATTEMPTS && row.status !== 'received';
    const next: InboxStatus = tired ? 'dead_letter'
      : row.status === 'parked' || row.status === 'failed' ? row.status
      : code === 'not_ready' ? 'parked' : 'failed';
    const at = next === 'dead_letter' ? null : new Date(Date.parse(nowIso) + backoffSeconds(attempts) * 1000).toISOString();
    await store.update(row.id, { status: next, attempts, nextAttemptAt: at, lastErrorCode: code });
    if (next === 'dead_letter') report.deadLettered++; else if (next === 'parked') report.parked++; else report.failed++;
  }
  return report;
}

/** A person's replay: a dead-lettered event goes back to `received`, with its tries kept and counted. */
export async function replay(store: InboxStore, id: string): Promise<'requeued' | 'not_dead_letter' | 'unknown'> {
  const row = await store.get(id);
  if (!row) return 'unknown';
  if (row.status !== 'dead_letter') return 'not_dead_letter';
  await store.update(id, { status: 'received', nextAttemptAt: null });
  return 'requeued';
}
