/**
 * Events from the platform: the envelope and outbox the institution package
 * defined (ADR 0008), with the tenant boundary closed around them.
 *
 * Two additions, both about tenancy:
 *
 * - `eventFromContext` stamps tenant, actor, correlation and environment from
 *   the `RequestContext`, so a producer cannot label an event with a tenant it
 *   is not acting for.
 * - `TenantOutbox` refuses an append whose event carries a different tenant
 *   than the transaction's, and `consumeForTenant` makes a consumer verify the
 *   tenant on the way *out* of a queue. A message that arrives for the wrong
 *   tenant is dead-lettered, never processed: queues are the layer where a
 *   cross-tenant bug is otherwise invisible until a report is wrong.
 *
 * The outbox write is part of the unit of work that changed the data
 * (`gateway/command.ts`), which is the point of the pattern: a record and the
 * announcement of it commit together or not at all.
 */

import type { IdSource } from '../kernel/clock.ts';
import type { Clock } from '../kernel/clock.ts';
import { makeEvent, validateEvent } from '../seam/institution.ts';
import type { EventType, OutboxStore, ReceiptLedger, ResourceClassification, SemesterEvent } from '../seam/institution.ts';
import { processOnce } from '../seam/institution.ts';
import { PlatformError } from '../gateway/errors.ts';
import type { RequestContext } from '../tenancy/context.ts';

export interface EventDraft<T extends Record<string, unknown> = Record<string, unknown>> {
  type: EventType;
  subject: { type: string; id: string };
  payload: T;
  /** May raise the type's classification floor, never lower it. */
  dataClassification?: ResourceClassification;
  causationId?: string;
}

export function eventFromContext(ctx: RequestContext, draft: EventDraft, deps: { clock: Clock; ids: IdSource; producer: string }): SemesterEvent {
  return makeEvent({
    // The catalog requires a UUID, so no prefix.
    eventId: deps.ids.next(),
    eventType: draft.type,
    occurredAt: deps.clock.now().toISOString(),
    producer: deps.producer,
    environment: ctx.environment,
    tenantId: ctx.tenantId,
    actor: { id: ctx.actor.personId, type: ctx.actor.type },
    subject: draft.subject,
    correlationId: ctx.correlationId,
    ...(draft.causationId ? { causationId: draft.causationId } : {}),
    ...(ctx.idempotencyKey ? { idempotencyKey: ctx.idempotencyKey } : {}),
    ...(draft.dataClassification ? { dataClassification: draft.dataClassification } : {}),
    payload: draft.payload,
  });
}

/** An outbox bound to one tenant for the life of one transaction. */
export class TenantOutbox {
  private readonly tenantId: string;
  private readonly store: OutboxStore;

  constructor(tenantId: string, store: OutboxStore) {
    this.tenantId = tenantId;
    this.store = store;
  }

  async append(event: SemesterEvent): Promise<void> {
    const verdict = validateEvent(event);
    if (!verdict.ok) throw new PlatformError('internal', 'An event was refused before it was written.');
    if (event.tenantId !== this.tenantId) throw new PlatformError('tenant_mismatch', 'An event for another school was refused.');
    await this.store.append(event);
  }
}

export type TenantConsume =
  | { outcome: 'processed' }
  | { outcome: 'duplicate' }
  | { outcome: 'refused'; reason: string }
  | { outcome: 'failed'; error: string }
  | { outcome: 'wrong_tenant'; expected: string; got: string | undefined };

/**
 * Process one delivery for a consumer that serves one tenant's queue (or a
 * shared queue it has partitioned by tenant). Idempotent via the receipt
 * ledger: a second delivery of the same event to the same consumer is a no-op.
 * A message for another tenant is reported as `wrong_tenant` — the caller
 * dead-letters it and raises an alert — and is never handed to `handle`.
 */
export async function consumeForTenant(
  ledger: ReceiptLedger,
  consumer: string,
  tenantId: string,
  raw: unknown,
  handle: (event: SemesterEvent) => Promise<void>,
): Promise<TenantConsume> {
  const verdict = validateEvent(raw);
  if (!verdict.ok) return { outcome: 'refused', reason: verdict.reason };
  if (verdict.event.tenantId !== tenantId) return { outcome: 'wrong_tenant', expected: tenantId, got: verdict.event.tenantId };
  const report = await processOnce(ledger, consumer, verdict.event, handle, tenantId);
  switch (report.outcome) {
    case 'processed':
      return { outcome: 'processed' };
    case 'duplicate':
      return { outcome: 'duplicate' };
    case 'refused':
      return { outcome: 'refused', reason: report.reason };
    case 'failed':
      return { outcome: 'failed', error: report.error };
  }
}
