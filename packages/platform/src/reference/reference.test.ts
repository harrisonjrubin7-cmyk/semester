import { describe, expect, it } from 'vitest';
import { verifyAuditChain } from '../identity/audit.ts';
import { runCommand } from '../gateway/command.ts';
import { CursorCodec } from '../gateway/pagination.ts';
import { PlatformError } from '../gateway/errors.ts';
import { drainPartition, MemoryTenantQueue, MemoryTenantRepository, newLedger } from '../isolation/layers.ts';
import { MemorySearchIndex, scopeFor } from '../engines/search.ts';
import { scopeOf } from '../tenancy/context.ts';
import { utf8 } from '../kernel/canonical.ts';
import { TENANT_A, TENANT_B, harness } from '../testing/memory.ts';
import { TASK_RULES, completeTaskCommand, createTaskCommand, indexTask, listTasks, type Task } from './tasks.ts';
import { drainOutbox, MemoryOutbox } from '../seam/institution.ts';
import { TenantOutbox, eventFromContext } from '../events/emit.ts';

function wire() {
  const h = harness(TASK_RULES);
  const repo = new MemoryTenantRepository<Task>();
  h.enroll(repo);
  const codec = new CursorCodec({ currentKid: 'k', keys: { k: utf8('reference-cursor-secret-000000000000') } }, h.clock);
  return { h, repo, codec, create: createTaskCommand(repo), complete: completeTaskCommand(repo) };
}

const uuid = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const code = async (p: Promise<unknown>) => {
  try {
    await p;
  } catch (e) {
    return e instanceof PlatformError ? e.code : 'other';
  }
  return 'none';
};

describe('reference slice: tasks', () => {
  it('create: writes the record, one audit row and one event — together', async () => {
    const { h, repo, create } = wire();
    const ctx = h.context(TENANT_A, 'stu', { key: 'create-key-000000001' });
    const r = await runCommand(h.deps, ctx, create, { taskId: uuid(1), title: '  Read ch. 4  ' });

    expect(r).toMatchObject({ status: 'completed', data: { taskId: uuid(1) }, userMessage: 'Task added.', correlationId: ctx.correlationId });
    expect((await repo.get(scopeOf(ctx), uuid(1)))?.title).toBe('Read ch. 4');

    const audit = await h.audit.read(TENANT_A);
    expect(audit).toHaveLength(1);
    expect(audit[0]).toMatchObject({ action: 'task.create', decision: 'allowed', reasonCode: 'owner', correlationId: ctx.correlationId });
    expect(r.auditEventId).toBe(audit[0].id);
    expect(JSON.stringify(audit[0].detail)).not.toContain('Read ch. 4');

    expect(h.outbox.rows).toHaveLength(1);
    expect(h.outbox.rows[0].event).toMatchObject({ eventType: 'action.created', tenantId: TENANT_A, correlationId: ctx.correlationId, idempotencyKey: 'create-key-000000001', payload: { taskId: uuid(1) } });
    expect(JSON.stringify(h.outbox.rows[0].event)).not.toContain('Read ch. 4'); // ids, not content
    expect(await verifyAuditChain(audit)).toMatchObject({ ok: true });
  });

  it('a retry with the same key replays: one record, one audit row, one event', async () => {
    const { h, repo, create } = wire();
    const run = () => runCommand(h.deps, h.context(TENANT_A, 'stu', { key: 'create-key-000000001' }), create, { taskId: uuid(1), title: 'x' });
    const first = await run();
    const second = await run();
    expect(second).toEqual(first);
    expect(await repo.list({ tenantId: TENANT_A })).toHaveLength(1);
    expect(await h.audit.read(TENANT_A)).toHaveLength(1);
    expect(h.outbox.rows).toHaveLength(1);
  });

  it('a different body under the same key is refused (422)', async () => {
    const { h, create } = wire();
    const ctx = () => h.context(TENANT_A, 'stu', { key: 'create-key-000000001' });
    await runCommand(h.deps, ctx(), create, { taskId: uuid(1), title: 'x' });
    expect(await code(runCommand(h.deps, ctx(), create, { taskId: uuid(2), title: 'y' }))).toBe('idempotency_key_reused');
  });

  it('a failure after the write rolls back the record, the audit row and the event together', async () => {
    const { h, repo } = wire();
    const broken = {
      ...createTaskCommand(repo),
      handle: async (tx: Parameters<ReturnType<typeof createTaskCommand>['handle']>[0], ctx: Parameters<ReturnType<typeof createTaskCommand>['handle']>[1], input: Parameters<ReturnType<typeof createTaskCommand>['handle']>[2]) => {
        const ok = await createTaskCommand(repo).handle(tx, ctx, input);
        await tx.emit(ok.events![0]);
        throw new Error('postgres://svc:hunter2@db/semester exploded after the write');
      },
    };
    const ctx = h.context(TENANT_A, 'stu', { key: 'create-key-000000002' });
    const e = await runCommand(h.deps, ctx, broken, { taskId: uuid(1), title: 'x' }).catch((x: unknown) => x);
    expect(e).toMatchObject({ code: 'internal' });
    expect((e as Error).message).not.toContain('hunter2');
    expect(await repo.list({ tenantId: TENANT_A })).toEqual([]);
    expect(await h.audit.read(TENANT_A)).toEqual([]);
    expect(h.outbox.rows).toEqual([]);
    // and the key was released: the same request can run again once the bug is fixed
    const retry = await runCommand(h.deps, h.context(TENANT_A, 'stu', { key: 'create-key-000000002' }), createTaskCommand(repo), { taskId: uuid(1), title: 'x' });
    expect(retry.status).toBe('completed');
  });

  it('validation fails before anything is read or written, with the person\'s sentence', async () => {
    const { h, repo, create } = wire();
    const ctx = () => h.context(TENANT_A, 'stu', { key: 'create-key-0000000003' });
    expect(await code(runCommand(h.deps, ctx(), create, { taskId: 'nope', title: 'x' }))).toBe('validation_failed');
    expect(await code(runCommand(h.deps, ctx(), create, { taskId: uuid(1), title: '   ' }))).toBe('validation_failed');
    expect(await code(runCommand(h.deps, ctx(), create, { taskId: uuid(1), title: 'x'.repeat(201) }))).toBe('validation_failed');
    expect(await code(runCommand(h.deps, ctx(), create, null))).toBe('validation_failed');
    expect(await repo.list({ tenantId: TENANT_A })).toEqual([]);
    expect(await h.audit.read(TENANT_A)).toEqual([]);
  });

  it('refuses a write when policy says no, audits the denial, and writes nothing else', async () => {
    const { h, repo, complete, create } = wire();
    await runCommand(h.deps, h.context(TENANT_A, 'stu', { key: 'create-key-000000004' }), create, { taskId: uuid(1), title: 'mine' });
    // Another person in the same tenant tries to complete it: the resource names *them* as owner, so policy
    // allows the attempt — and the handler's own ownership check refuses with not_found (no oracle).
    const other = h.context(TENANT_A, 'other', { key: 'complete-key-00000001' });
    expect(await code(runCommand(h.deps, other, complete, { taskId: uuid(1) }))).toBe('not_found');
    expect((await repo.get({ tenantId: TENANT_A }, uuid(1)))?.done).toBe(false);
    expect(h.outbox.rows).toHaveLength(1); // only the create event
  });

  it('an undeclared action is denied and the denial is in the audit log', async () => {
    const { h, repo } = wire();
    const sneaky = { ...createTaskCommand(repo), name: 'task.purge', action: 'task.purge' };
    const e = await runCommand(h.deps, h.context(TENANT_A, 'stu', { key: 'purge-key-0000000001' }), sneaky, { taskId: uuid(1), title: 'x' }).catch((x: unknown) => x);
    expect(e).toMatchObject({ code: 'forbidden' });
    const audit = await h.audit.read(TENANT_A);
    expect(audit).toHaveLength(1);
    expect(audit[0]).toMatchObject({ action: 'task.purge', decision: 'denied', reasonCode: 'action_not_declared' });
    expect(await repo.list({ tenantId: TENANT_A })).toEqual([]);
  });

  it('complete: state rule, event, and a second completion is refused', async () => {
    const { h, repo, create, complete } = wire();
    await runCommand(h.deps, h.context(TENANT_A, 'stu', { key: 'create-key-000000005' }), create, { taskId: uuid(1), title: 'x' });
    const done = await runCommand(h.deps, h.context(TENANT_A, 'stu', { key: 'complete-key-0000001a' }), complete, { taskId: uuid(1) });
    expect(done.status).toBe('completed');
    expect((await repo.get({ tenantId: TENANT_A }, uuid(1)))?.done).toBe(true);
    expect(h.outbox.rows.map((r) => r.event.eventType)).toEqual(['action.created', 'action.completed']);
    expect(await code(runCommand(h.deps, h.context(TENANT_A, 'stu', { key: 'complete-key-0000001b' }), complete, { taskId: uuid(1) }))).toBe('precondition_failed');
  });

  it('tenant B cannot complete tenant A\'s task even with the same id and person — and gets not_found', async () => {
    const { h, repo, create, complete } = wire();
    await runCommand(h.deps, h.context(TENANT_A, 'stu', { key: 'create-key-000000006' }), create, { taskId: uuid(1), title: 'x' });
    expect(await code(runCommand(h.deps, h.context(TENANT_B, 'stu', { key: 'complete-key-0000002a' }), complete, { taskId: uuid(1) }))).toBe('not_found');
    expect((await repo.get({ tenantId: TENANT_A }, uuid(1)))?.done).toBe(false);
  });

  it('the same task id can exist in two tenants, independently', async () => {
    const { h, repo, create } = wire();
    await runCommand(h.deps, h.context(TENANT_A, 'stu', { key: 'create-key-000000007' }), create, { taskId: uuid(1), title: 'A' });
    await runCommand(h.deps, h.context(TENANT_B, 'stu', { key: 'create-key-000000007' }), create, { taskId: uuid(1), title: 'B' });
    expect((await repo.get({ tenantId: TENANT_A }, uuid(1)))?.title).toBe('A');
    expect((await repo.get({ tenantId: TENANT_B }, uuid(1)))?.title).toBe('B');
  });

  it('list: pages the caller\'s own tasks, never another person\'s or tenant\'s', async () => {
    const { h, repo, create, codec } = wire();
    for (let i = 1; i <= 7; i++) {
      h.clock.advance(1000);
      await runCommand(h.deps, h.context(TENANT_A, 'stu', { key: `create-key-00000010${i}` }), create, { taskId: uuid(i), title: `t${i}` });
    }
    await runCommand(h.deps, h.context(TENANT_A, 'other', { key: 'create-key-000000020' }), create, { taskId: uuid(50), title: 'not mine' });
    await runCommand(h.deps, h.context(TENANT_B, 'stu', { key: 'create-key-000000021' }), create, { taskId: uuid(60), title: 'other tenant' });

    const seen: string[] = [];
    let cursor: string | null = null;
    do {
      const page: Awaited<ReturnType<typeof listTasks>> = await listTasks({ policy: h.policy, codec }, repo, h.context(TENANT_A, 'stu'), { limit: 3, cursor });
      seen.push(...page.items.map((t) => t.title));
      cursor = page.nextCursor;
    } while (cursor);
    expect(seen).toEqual(['t1', 't2', 't3', 't4', 't5', 't6', 't7']);

    // A cursor minted in A for 'stu' is refused for the same person in B.
    const page = await listTasks({ policy: h.policy, codec }, repo, h.context(TENANT_A, 'stu'), { limit: 3 });
    expect(await code(listTasks({ policy: h.policy, codec }, repo, h.context(TENANT_B, 'stu'), { limit: 3, cursor: page.nextCursor }))).toBe('invalid_cursor');
  });

  it('end to end: outbox → queue → consumer → search, idempotent, tenant-safe', async () => {
    const { h, repo, create } = wire();
    const index = new MemorySearchIndex();
    const queue = new MemoryTenantQueue();
    const ledger = newLedger();

    await runCommand(h.deps, h.context(TENANT_A, 'stu', { key: 'create-key-000000030' }), create, { taskId: uuid(1), title: 'Calculus problem set' });
    await runCommand(h.deps, h.context(TENANT_B, 'stu', { key: 'create-key-000000031' }), create, { taskId: uuid(2), title: 'Calculus quiz review' });

    // Publisher: route each outbox row to its tenant's partition.
    const report = await drainOutbox(h.outbox, async (event) => queue.enqueue({ tenantId: event.tenantId! }, event), { now: () => h.clock.now() });
    expect(report).toMatchObject({ published: 2, failed: 0 });

    const handle = (tenantId: string) => (e: Parameters<typeof indexTask>[2]) => indexTask({ ledger, index, repo }, tenantId, e);
    for (const t of [TENANT_A, TENANT_B]) {
      for (const raw of await queue.receive({ tenantId: t }, 10)) await handle(t)(raw);
    }

    const aScope = scopeFor(h.context(TENANT_A, 'stu'), []);
    const bScope = scopeFor(h.context(TENANT_B, 'stu'), []);
    expect((await index.query(aScope, 'calculus', 10)).map((x) => x.id)).toEqual([uuid(1)]);
    expect((await index.query(bScope, 'calculus', 10)).map((x) => x.id)).toEqual([uuid(2)]);
    expect(await index.query(scopeFor(h.context(TENANT_A, 'someone-else'), []), 'calculus', 10)).toEqual([]);
  });

  it('a message in the wrong tenant\'s partition is dead-lettered and never handled', async () => {
    const { h, repo, create } = wire();
    const index = new MemorySearchIndex();
    const queue = new MemoryTenantQueue();
    const ledger = newLedger();
    await runCommand(h.deps, h.context(TENANT_B, 'stu', { key: 'create-key-000000040' }), create, { taskId: uuid(2), title: 'B secret' });
    // Simulate a routing bug that puts B's event in A's lane.
    queue.injectUnchecked(TENANT_A, h.outbox.rows[0].event);

    const out = await drainPartition(queue, ledger, 'search-indexer', { tenantId: TENANT_A }, async (e) => {
      await indexTask({ ledger: newLedger(), index, repo }, TENANT_A, e);
    });
    expect(out).toEqual({ processed: 0, deadLettered: 1 });
    expect((await queue.deadLetters({ tenantId: TENANT_A }))[0].reason).toBe('wrong_tenant');
    expect(await index.query(scopeFor(h.context(TENANT_A, 'stu'), []), 'secret', 10)).toEqual([]);
  });

  it('the outbox bound to a transaction refuses another tenant\'s event and an invalid one', async () => {
    const h = harness(TASK_RULES);
    const store = new MemoryOutbox();
    const outboxA = new TenantOutbox(TENANT_A, store);
    const draft = { type: 'action.created' as const, subject: { type: 'task', id: '1' }, payload: {} };
    const forB = eventFromContext(h.context(TENANT_B, 'p'), draft, { clock: h.clock, ids: h.ids, producer: 'x' });
    const forA = eventFromContext(h.context(TENANT_A, 'p'), draft, { clock: h.clock, ids: h.ids, producer: 'x' });
    expect(await code(outboxA.append(forB))).toBe('tenant_mismatch');
    expect(await code(outboxA.append({ ...forA, eventType: 'made.up' } as never))).toBe('internal');
    expect(store.rows).toHaveLength(0);
    await outboxA.append(forA);
    expect(store.rows).toHaveLength(1);
  });

  it('events from a context carry the context\'s tenant, actor, correlation id and idempotency key', () => {
    const h = harness(TASK_RULES);
    const ctx = h.context(TENANT_A, 'stu', { key: 'event-key-00000000001' });
    const e = eventFromContext(ctx, { type: 'action.created', subject: { type: 'task', id: '1' }, payload: {} }, { clock: h.clock, ids: h.ids, producer: 'tasks' });
    expect(e).toMatchObject({ tenantId: TENANT_A, actor: { id: 'stu', type: 'user' }, correlationId: ctx.correlationId, idempotencyKey: 'event-key-00000000001', producer: 'tasks', environment: 'production' });
  });

  it('redelivery of the same event is a no-op for the consumer', async () => {
    const { h, repo, create } = wire();
    const index = new MemorySearchIndex();
    const ledger = newLedger();
    await runCommand(h.deps, h.context(TENANT_A, 'stu', { key: 'create-key-000000050' }), create, { taskId: uuid(1), title: 'x' });
    const event = h.outbox.rows[0].event;
    expect(await indexTask({ ledger, index, repo }, TENANT_A, event)).toEqual({ outcome: 'processed' });
    expect(await indexTask({ ledger, index, repo }, TENANT_A, event)).toEqual({ outcome: 'duplicate' });
  });
});
