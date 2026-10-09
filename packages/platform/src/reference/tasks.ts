/**
 * The reference vertical slice: a *task*, built the way every domain object is.
 *
 * It is deliberately small and deliberately complete. Read this file to see how
 * a domain uses the platform; copy its shape, not its fields.
 *
 * ```
 *  POST /v1/tasks         createTask      command → policy → idempotency → UoW(repo + audit + outbox)
 *  POST /v1/tasks/:id/complete  completeTask   same, plus a state rule
 *  GET  /v1/tasks         listTasks       query → policy → tenant-scoped repo → keyset page
 *  consumer               indexTask       event → receipt (idempotent) → tenant-scoped search index
 * ```
 *
 * What it demonstrates, each with a test in `reference.test.ts`:
 *
 * - The handler is given a `Transaction` and writes through a `TenantScope`;
 *   it cannot name a tenant.
 * - Ownership is a policy rule (`ownerMay`), not an `if` in the handler.
 * - The client generates the task id (offline-first clients must), and the
 *   idempotency key makes the create safe to retry.
 * - Events carry **ids, not content**; the consumer loads the record through
 *   its own tenant scope. A leaked queue message discloses nothing.
 * - A failure after the write rolls back the record, the audit row *and* the
 *   event together.
 */

import type { CommandDefinition } from '../gateway/command.ts';
import { PlatformError } from '../gateway/errors.ts';
import { CursorCodec, paginate } from '../gateway/pagination.ts';
import type { Page } from '../gateway/pagination.ts';
import type { ActionRule } from '../policy/engine.ts';
import { requirePolicy } from '../policy/engine.ts';
import type { PolicyEngine } from '../policy/engine.ts';
import type { RequestContext } from '../tenancy/context.ts';
import { scopeOf } from '../tenancy/context.ts';
import type { TenantRepository, TenantRow } from '../isolation/layers.ts';
import { consumeForTenant } from '../events/emit.ts';
import type { ReceiptLedger, SemesterEvent } from '../seam/institution.ts';
import type { SearchIndex } from '../engines/search.ts';

export interface Task extends TenantRow {
  ownerId: string;
  title: string;
  dueAt?: string;
  done: boolean;
  createdAt: string;
}

export const TASK_RULES: readonly ActionRule[] = [
  { action: 'task.create', capability: null, ownerMay: true, classificationCeiling: 'student_private' },
  { action: 'task.complete', capability: null, ownerMay: true, classificationCeiling: 'student_private' },
  { action: 'task.list', capability: null, ownerMay: true, classificationCeiling: 'student_private' },
];

interface CreateInput {
  taskId: string;
  title: string;
  dueAt?: string;
}

const isUuid = (v: unknown): v is string => typeof v === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v);

export function createTaskCommand(repo: TenantRepository<Task>): CommandDefinition<CreateInput, { taskId: string }> {
  return {
    name: 'task.create',
    parse: (payload) => {
      const p = payload as Partial<CreateInput> | null;
      if (!p || !isUuid(p.taskId)) throw new PlatformError('validation_failed', 'A task needs an id.');
      if (typeof p.title !== 'string' || !p.title.trim() || p.title.length > 200) throw new PlatformError('validation_failed', 'Give the task a title of up to 200 characters.');
      if (p.dueAt !== undefined && !Number.isFinite(Date.parse(p.dueAt))) throw new PlatformError('validation_failed', 'The due date is not a date.');
      return { taskId: p.taskId, title: p.title.trim(), ...(p.dueAt !== undefined ? { dueAt: p.dueAt } : {}) };
    },
    resource: (input, ctx) => ({ type: 'task', id: input.taskId, tenantId: ctx.tenantId, ownerId: ctx.actor.personId, classification: 'student_private' }),
    handle: async (tx, ctx, input) => {
      await repo.insert(tx.scope, {
        id: input.taskId,
        tenantId: tx.scope.tenantId,
        ownerId: ctx.actor.personId,
        title: input.title,
        ...(input.dueAt !== undefined ? { dueAt: input.dueAt } : {}),
        done: false,
        createdAt: ctx.receivedAt,
      });
      return {
        data: { taskId: input.taskId },
        events: [{ type: 'action.created', subject: { type: 'task', id: input.taskId }, payload: { taskId: input.taskId } }],
        userMessage: 'Task added.',
        // Ids and sizes, never the title: audit detail answers "what happened", not "what was written".
        detail: { taskId: input.taskId, titleLength: input.title.length },
      };
    },
  };
}

export function completeTaskCommand(repo: TenantRepository<Task>): CommandDefinition<{ taskId: string }, { taskId: string }> {
  return {
    name: 'task.complete',
    parse: (payload) => {
      const p = payload as { taskId?: unknown } | null;
      if (!p || !isUuid(p.taskId)) throw new PlatformError('validation_failed', 'Choose a task.');
      return { taskId: p.taskId };
    },
    resource: (input, ctx) => ({ type: 'task', id: input.taskId, tenantId: ctx.tenantId, ownerId: ctx.actor.personId, classification: 'student_private' }),
    handle: async (tx, ctx, input) => {
      const task = await repo.get(tx.scope, input.taskId);
      // Not-found for a task that is someone else's *or* another tenant's: no oracle.
      if (!task || task.ownerId !== ctx.actor.personId) throw new PlatformError('not_found', 'We could not find that task.');
      if (task.done) throw new PlatformError('precondition_failed', 'That task is already done.');
      await repo.update(tx.scope, input.taskId, { done: true });
      return {
        data: { taskId: input.taskId },
        events: [{ type: 'action.completed', subject: { type: 'task', id: input.taskId }, payload: { taskId: input.taskId } }],
        userMessage: 'Marked done.',
        detail: { taskId: input.taskId },
      };
    },
  };
}

export async function listTasks(
  deps: { policy: PolicyEngine; codec: CursorCodec },
  repo: TenantRepository<Task>,
  ctx: RequestContext,
  req: { limit?: unknown; cursor?: string | null },
): Promise<Page<Task>> {
  await requirePolicy(deps.policy, ctx, 'task.list', { type: 'task', tenantId: ctx.tenantId, ownerId: ctx.actor.personId, classification: 'student_private' });
  // The repository is already tenant-scoped; the owner filter is the *product* rule on top.
  const mine = (await repo.list(scopeOf(ctx))).filter((t) => t.ownerId === ctx.actor.personId);
  return paginate(mine, (t) => t.createdAt, req, { codec: deps.codec, tenantId: ctx.tenantId, query: { resource: 'tasks', owner: ctx.actor.personId } });
}

/** The consumer: keeps the search index in step. Idempotent through the receipt ledger, tenant-verified on the way in. */
export async function indexTask(
  deps: { ledger: ReceiptLedger; index: SearchIndex; repo: TenantRepository<Task> },
  tenantId: string,
  raw: unknown,
) {
  return consumeForTenant(deps.ledger, 'search-indexer', tenantId, raw, async (event: SemesterEvent) => {
    const taskId = (event.payload as { taskId?: unknown }).taskId;
    if (typeof taskId !== 'string') return;
    const task = await deps.repo.get({ tenantId }, taskId);
    if (!task) return;
    await deps.index.index({
      id: task.id,
      tenantId: task.tenantId,
      kind: 'task',
      classification: 'student_private',
      title: task.title,
      excerpt: task.dueAt ? `Due ${task.dueAt.slice(0, 10)}` : '',
      acl: [`person:${task.ownerId}`],
      purposes: ['search', 'ai_context'],
      roles: [],
      source: { id: task.id, kind: 'student_entered' },
      freshness: { state: 'current', observedAt: task.createdAt },
    });
  });
}
