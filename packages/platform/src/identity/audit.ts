/**
 * The audit log: append-only, per tenant, hash-chained.
 *
 * Every consequential action — and every refusal of one — writes a row here,
 * in the same transaction as the change it describes (`gateway/command.ts`).
 * Each row carries the SHA-256 of its own canonical content *and* of the row
 * before it in the same tenant, so deleting, reordering or editing a row
 * breaks every hash after it and `verifyAuditChain` says where. That is
 * tamper-*evident*, which is what a database owner cannot be stopped from
 * attempting and can be stopped from doing silently. The existing ledger
 * chains (financial-retention, gateway journal) use the same idea; this is the
 * shared form.
 *
 * `detail` is redacted on the way in (`observability/redact.ts`): an audit row
 * says *that* a grade was amended and by whom, never what the essay said.
 * Chains are per tenant on purpose: one global chain would serialise every
 * write in the system, and would put one tenant's row hashes in another's
 * evidence.
 */

import { hashOf } from '../kernel/canonical.ts';
import type { Clock, IdSource } from '../kernel/clock.ts';
import { redact } from '../observability/redact.ts';
import type { RequestContext } from '../tenancy/context.ts';
import { PlatformError } from '../gateway/errors.ts';

export const AUDIT_DECISIONS = ['allowed', 'denied', 'pending_approval', 'failed'] as const;
export type AuditDecision = (typeof AUDIT_DECISIONS)[number];

export interface AuditDraft {
  action: string;
  resource: { type: string; id?: string };
  decision: AuditDecision;
  reasonCode?: string;
  detail?: Record<string, unknown>;
  causationId?: string;
}

export interface AuditEvent extends AuditDraft {
  id: string;
  tenantId: string;
  seq: number;
  at: string;
  actor: { id: string; type: string; sessionId?: string };
  purpose: string;
  correlationId: string;
  requestId: string;
  prevHash: string;
  hash: string;
}

export const GENESIS_HASH = '0'.repeat(64);

/** What the write side of the log needs from storage. Production binds it to an append-only table with a per-tenant sequence. */
export interface AuditLog {
  append(ctx: RequestContext, draft: AuditDraft): Promise<AuditEvent>;
  /** Rows for one tenant, in sequence order. */
  read(tenantId: string): Promise<AuditEvent[]>;
}

type Hashed = Omit<AuditEvent, 'hash'>;

export const hashAuditEvent = (e: Hashed): Promise<string> => hashOf(e);

export type ChainVerdict = { ok: true; length: number } | { ok: false; brokenAt: number; reason: string };

export async function verifyAuditChain(events: readonly AuditEvent[]): Promise<ChainVerdict> {
  let prev = GENESIS_HASH;
  let tenant: string | undefined;
  for (let i = 0; i < events.length; i++) {
    const e = events[i];
    tenant ??= e.tenantId;
    if (e.tenantId !== tenant) return { ok: false, brokenAt: i, reason: 'a row from another tenant is in this chain' };
    if (e.seq !== i + 1) return { ok: false, brokenAt: i, reason: `expected sequence ${i + 1}, found ${e.seq}` };
    if (e.prevHash !== prev) return { ok: false, brokenAt: i, reason: 'previous-hash link is broken' };
    const { hash, ...rest } = e;
    if ((await hashAuditEvent(rest)) !== hash) return { ok: false, brokenAt: i, reason: 'row content does not match its hash' };
    prev = hash;
  }
  return { ok: true, length: events.length };
}

/** Reference implementation. Append is serialised per tenant, as a unique `(tenant_id, seq)` constraint would force. */
export class MemoryAuditLog implements AuditLog {
  private readonly rows = new Map<string, AuditEvent[]>();

  private readonly deps: { clock: Clock; ids: IdSource };
  constructor(deps: { clock: Clock; ids: IdSource }) {
    this.deps = deps;
  }

  async append(ctx: RequestContext, draft: AuditDraft): Promise<AuditEvent> {
    if (!draft.action || !draft.resource?.type) throw new PlatformError('internal', 'An audit row needs an action and a resource.');
    const chain = this.rows.get(ctx.tenantId) ?? [];
    const prev = chain[chain.length - 1];
    const base: Hashed = {
      id: this.deps.ids.next('aud'),
      tenantId: ctx.tenantId,
      seq: chain.length + 1,
      at: this.deps.clock.now().toISOString(),
      actor: { id: ctx.actor.personId, type: ctx.actor.type, ...(ctx.actor.sessionId ? { sessionId: ctx.actor.sessionId } : {}) },
      purpose: ctx.purpose,
      correlationId: ctx.correlationId,
      requestId: ctx.requestId,
      action: draft.action,
      resource: draft.resource,
      decision: draft.decision,
      ...(draft.reasonCode !== undefined ? { reasonCode: draft.reasonCode } : {}),
      ...(draft.detail !== undefined ? { detail: redact(draft.detail) as Record<string, unknown> } : {}),
      ...(draft.causationId !== undefined ? { causationId: draft.causationId } : {}),
      prevHash: prev?.hash ?? GENESIS_HASH,
    };
    const event: AuditEvent = { ...base, hash: await hashAuditEvent(base) };
    this.rows.set(ctx.tenantId, [...chain, event]);
    return event;
  }

  async read(tenantId: string): Promise<AuditEvent[]> {
    return [...(this.rows.get(tenantId) ?? [])];
  }

  /** Snapshot and restore are how the memory unit of work rolls back; a real database does it with a transaction. */
  snapshot(): Map<string, AuditEvent[]> {
    return new Map([...this.rows].map(([k, v]) => [k, [...v]]));
  }

  restore(snap: Map<string, AuditEvent[]>): void {
    this.rows.clear();
    for (const [k, v] of snap) this.rows.set(k, v);
  }
}
