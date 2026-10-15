/**
 * The command pipeline: how every write enters a Semester domain.
 *
 * The audit's service contract is `CommandEnvelope` in, `CommandResult` out.
 * This is the function that makes the contract more than types — it fixes the
 * order, so no domain can get it subtly different:
 *
 * ```
 *  1. parse          bad input is refused before anything is read          validation_failed
 *  2. authorize      the policy engine; deny-by-default; denial is audited  forbidden
 *  3. approval gate  an action that needs a second person stops here        pending_approval
 *  4. idempotency    retried commands replay, mismatched ones conflict
 *  5. unit of work   handler + audit row + outbox events: one transaction
 *  6. result         { status, userMessage, auditEventId, correlationId }
 * ```
 *
 * Step 5 is the invariant the rest hangs on. The record, the audit row that
 * says who changed it and why, and the event that announces it commit
 * together or roll back together. There is no path on which a grade is posted
 * and nobody was told, or an audit row says "allowed" about a write that
 * never happened.
 *
 * The handler gets a `Transaction`, not a database. It sees only the
 * `TenantScope` of this request, so even a handler that wants to read another
 * tenant's rows has no handle to do it with.
 */

import type { Clock, IdSource } from '../kernel/clock.ts';
import { hashOf } from '../kernel/canonical.ts';
import type { AuditEvent, AuditLog } from '../identity/audit.ts';
import type { ApprovalRequest } from '../identity/approval.ts';
import { isApprovedFor } from '../identity/approval.ts';
import type { PlatformDecision, PolicyEngine, PolicyResource } from '../policy/engine.ts';
import type { RequestContext, TenantScope } from '../tenancy/context.ts';
import { scopeOf } from '../tenancy/context.ts';
import { TenantOutbox, eventFromContext, type EventDraft } from '../events/emit.ts';
import type { OutboxStore } from '../seam/institution.ts';
import { PlatformError, isPlatformError, toPlatformError } from './errors.ts';
import { withIdempotency, type IdempotencyStore } from './idempotency.ts';

const CLIENT_COMMAND_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export interface CommandEnvelope<T> {
  commandId: string;
  idempotencyKey: string;
  correlationId: string;
  tenantId: string;
  actor: { personId: string; accountId?: string; sessionId?: string; roles: string[] };
  purpose: string;
  submittedAt: string;
  payload: T;
}

export type CommandStatus = 'accepted' | 'completed' | 'pending_approval' | 'rejected' | 'failed';

export interface CommandResult<T> {
  commandId: string;
  status: CommandStatus;
  data?: T;
  userMessage: string;
  nextAction?: string;
  auditEventId: string;
  correlationId: string;
}

/** What a handler is given. `scope` is the tenant every read and write it makes must carry. */
export interface Transaction {
  readonly scope: TenantScope;
  emit(draft: EventDraft): Promise<void>;
}

export interface UnitOfWork {
  /**
   * Run `fn` atomically. On throw, everything `fn` wrote — rows, the audit
   * rows it caused, outbox events — is discarded. The reference implementation
   * snapshots; Postgres uses a transaction.
   */
  run<T>(ctx: RequestContext, fn: (tx: Transaction, audit: (draft: Parameters<AuditLog['append']>[1]) => Promise<AuditEvent>) => Promise<T>): Promise<T>;
}

export interface CommandDefinition<In, Out> {
  /** `domain.verb`, also the idempotency scope and the audit action unless `action` differs. */
  name: string;
  /** The policy action. Defaults to `name`. */
  action?: string;
  parse(payload: unknown): In;
  resource(input: In, ctx: RequestContext): PolicyResource;
  /** The change, hashed so an approval authorises exactly it. Defaults to the parsed input. */
  changeOf?(input: In): unknown;
  /** Financial and academic commands keep their idempotency keys 7 days, not 24 hours (`IDEMPOTENCY_TTL_EXTENDED_MS`). */
  idempotencyTtlMs?: number;
  handle(tx: Transaction, ctx: RequestContext, input: In): Promise<{ data: Out; events?: EventDraft[]; userMessage: string; detail?: Record<string, unknown> }>;
}

export interface CommandDeps {
  clock: Clock;
  ids: IdSource;
  policy: PolicyEngine;
  idempotency: IdempotencyStore;
  uow: UnitOfWork;
  audit: AuditLog;
  /** Looks up an approval the caller named, so a gated command can be re-run once approved. */
  approvals?: {
    find(tenantId: string, id: string): Promise<ApprovalRequest | undefined>;
    /** Spend the approval. Called inside the unit of work, so a failed command does not use it up. */
    consume(tenantId: string, id: string): Promise<void>;
  };
  /** Records a request for approval (the caller's workflow engine decides who is asked). */
  openApproval?(ctx: RequestContext, action: string, subject: { type: string; id: string }, changeHash: string): Promise<{ id: string }>;
  producer: string;
}

export interface CommandOptions {
  /** The id of an approved request this run is carrying, when re-running a gated command. */
  approvalId?: string;
  /**
   * The client-generated command id (a UUID), echoed in the result so an offline client can match a queued
   * command to its answer. Anything else is ignored and one is minted: an id a client chose is a label, never a key.
   */
  commandId?: string;
}

export async function runCommand<In, Out>(
  deps: CommandDeps,
  ctx: RequestContext,
  def: CommandDefinition<In, Out>,
  payload: unknown,
  opts: CommandOptions = {},
): Promise<CommandResult<Out>> {
  const commandId = opts.commandId !== undefined && CLIENT_COMMAND_ID.test(opts.commandId) ? opts.commandId : deps.ids.next('cmd');
  const action = def.action ?? def.name;

  // 1. parse
  let input: In;
  try {
    input = def.parse(payload);
  } catch (e) {
    if (isPlatformError(e)) throw e;
    throw new PlatformError('validation_failed', e instanceof Error && e.message ? e.message : 'Check the form and try again.');
  }

  // 2. authorize
  const resource = def.resource(input, ctx);
  const decision: PlatformDecision = await deps.policy.evaluate(ctx, action, resource);
  if (!decision.allow) {
    await deps.audit.append(ctx, {
      action,
      resource: { type: resource.type, ...(resource.id ? { id: resource.id } : {}) },
      decision: 'denied',
      reasonCode: decision.reasonCode,
    });
    throw new PlatformError(decision.reasonCode === 'consent_required' ? 'consent_required' : 'forbidden', decision.userMessage, decision.userAction ? { userAction: decision.userAction } : {});
  }

  // 3. approval gate
  let spent: string | undefined;
  if (decision.requiresApproval) {
    const changeHash = await hashOf({ action, change: def.changeOf ? def.changeOf(input) : input });
    const approved = opts.approvalId && deps.approvals
      ? await deps.approvals.find(ctx.tenantId, opts.approvalId)
      : undefined;
    const ok = approved ? isApprovedFor(approved, ctx.tenantId, action, changeHash, deps.clock.now().getTime()) : false;
    if (!ok) {
      if (!deps.openApproval) throw new PlatformError('internal', 'This action needs approval and no approval workflow is configured.');
      const subject = { type: resource.type, id: resource.id ?? 'unspecified' };
      const opened = await deps.openApproval(ctx, action, subject, changeHash);
      const row = await deps.audit.append(ctx, {
        action,
        resource: { type: resource.type, ...(resource.id ? { id: resource.id } : {}) },
        decision: 'pending_approval',
        reasonCode: 'approval_required',
        detail: { approvalId: opened.id },
      });
      return {
        commandId,
        status: 'pending_approval',
        userMessage: 'This needs a second person to approve it before it takes effect.',
        nextAction: opened.id,
        auditEventId: row.id,
        correlationId: ctx.correlationId,
      };
    }
    spent = opts.approvalId;
  }

  // 4 + 5. idempotency around the unit of work
  const run = async (): Promise<CommandResult<Out>> => {
    try {
      return await deps.uow.run(ctx, async (tx, writeAudit) => {
        const out = await def.handle(tx, ctx, input);
        if (spent) await deps.approvals?.consume(ctx.tenantId, spent);
        for (const draft of out.events ?? []) await tx.emit(draft);
        const row = await writeAudit({
          action,
          resource: { type: resource.type, ...(resource.id ? { id: resource.id } : {}) },
          decision: 'allowed',
          reasonCode: decision.reasonCode,
          ...(out.detail ? { detail: out.detail } : {}),
        });
        return {
          commandId,
          status: 'completed' as const,
          data: out.data,
          userMessage: out.userMessage,
          auditEventId: row.id,
          correlationId: ctx.correlationId,
        };
      });
    } catch (e) {
      if (isPlatformError(e)) throw e;
      // What an adapter threw is not for the person. The cause is the caller's to log.
      throw toPlatformError(e);
    }
  };

  const { value } = await withIdempotency(deps.idempotency, deps, ctx, def.name, payload, run, def.idempotencyTtlMs === undefined ? {} : { ttlMs: def.idempotencyTtlMs });
  return value;
}

/**
 * Build the pieces a unit-of-work implementation needs to give a handler a
 * `Transaction`. Kept here so every implementation (memory, Postgres) binds
 * events the same way: stamped from the context, validated, tenant-checked.
 */
export function transactionFor(ctx: RequestContext, deps: { clock: Clock; ids: IdSource; producer: string }, outbox: OutboxStore): Transaction {
  const bound = new TenantOutbox(ctx.tenantId, outbox);
  return {
    scope: scopeOf(ctx),
    emit: (draft) => bound.append(eventFromContext(ctx, draft, deps)),
  };
}
