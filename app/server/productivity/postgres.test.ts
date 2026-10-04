import { describe, expect, it } from 'vitest';
import { ContentionError, DatabaseError, PostgresProductivityRepository, type RpcClient } from './postgres.ts';
import type { Task } from './contract.ts';
import type { Scope } from './repository.ts';

/**
 * The adapter's protocol, against a scripted client: what each call carries, how a
 * conflict is answered, and what is never retried. The same adapter is run against
 * a real, migrated Postgres in `postgres.integration.test.ts` (see
 * `supabase/check.sh`'s SEMESTER_CHECK_THEN); this file is what keeps running when
 * there is no database to hand.
 */

const SCOPE: Scope = { tenantId: 'school-a', ownerId: '11111111-1111-4111-8111-111111111111' };
const ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const ID2 = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';

const task = (over: Partial<Task> = {}): Task => ({
  id: ID, tenantId: SCOPE.tenantId, ownerId: SCOPE.ownerId, version: 1, seq: 0,
  source: { kind: 'student_entered' }, clocks: { title: '1790000000000.0000.dev-a' },
  createdAt: '2026-10-05T15:00:00.000Z', updatedAt: '2026-10-05T15:00:00.000Z', deletedAt: null, deleteClock: null,
  title: 't', notes: null, status: 'open', completedAt: null, dueAt: null, dueOn: null, whenText: null, priority: 'normal', courseId: null,
  repeat: null, steps: [], plannedFrom: null, ...over,
});

type Reply = { data?: unknown; error?: { code?: string; message?: string } | null };
type Handler = (args: Record<string, unknown>, nth: number) => Reply | Promise<Reply>;

function fake(handlers: Record<string, Handler>) {
  const calls: { fn: string; args: Record<string, unknown> }[] = [];
  const counts = new Map<string, number>();
  const client: RpcClient = {
    async rpc(fn, args = {}) {
      calls.push({ fn, args });
      const nth = (counts.get(fn) ?? 0) + 1;
      counts.set(fn, nth);
      const h = handlers[fn];
      if (!h) throw new Error(`unscripted call to ${fn}`);
      const r = await h(args, nth);
      return { data: r.data ?? null, error: r.error ?? null };
    },
  };
  return { client, calls, of: (fn: string) => calls.filter((c) => c.fn === fn) };
}

const state = (lastSeq: number, command: unknown = null): Handler => () => ({ data: { lastSeq, command } });
const repo = (client: RpcClient, extra: { maxAttempts?: number; sleeps?: number[] } = {}) =>
  new PostgresProductivityRepository({
    client, ...(extra.maxAttempts ? { maxAttempts: extra.maxAttempts } : {}),
    sleep: async (ms) => void extra.sleeps?.push(ms), random: () => 0.5,
  });

describe('what every call carries', () => {
  it('names the tenant and the owner, from the scope, on every read and on the commit', async () => {
    const f = fake({
      productivity_tx_state: state(4), productivity_get: () => ({ data: null }), productivity_commit: () => ({ data: { seqs: [5] } }),
      productivity_list_tasks: () => ({ data: [] }), productivity_list_events: () => ({ data: [] }), productivity_changes: () => ({ data: [] }),
    });
    const r = repo(f.client);
    await r.transaction(SCOPE, async (tx) => {
      await tx.command('c0000000-0000-4000-8000-000000000001');
      await tx.entity('task', ID);
      await tx.save(task());
    });
    await r.get(SCOPE, 'task', ID);
    await r.listTasks(SCOPE, { after: null, limit: 10 });
    await r.listEvents(SCOPE, { from: '2026-10-01T00:00:00.000Z', to: '2026-10-08T00:00:00.000Z', after: null, limit: 10 });
    await r.changes(SCOPE, 0, 10);
    expect(f.calls.length).toBe(7);
    for (const c of f.calls) expect(c.args, c.fn).toMatchObject({ p_tenant: SCOPE.tenantId, p_owner: SCOPE.ownerId });
  });

  it('reads a tombstone inside a transaction and not outside it', async () => {
    const f = fake({ productivity_get: () => ({ data: null }), productivity_tx_state: state(0), productivity_commit: () => ({ data: {} }) });
    const r = repo(f.client);
    await r.get(SCOPE, 'task', ID);
    await r.transaction(SCOPE, async (tx) => void await tx.entity('task', ID));
    expect(f.of('productivity_get').map((c) => c.args.p_include_deleted)).toEqual([false, true]);
  });

  it('turns a cursor into the two arguments the SQL keys on, and no cursor into nulls', async () => {
    const f = fake({ productivity_list_tasks: () => ({ data: [] }) });
    const r = repo(f.client);
    await r.listTasks(SCOPE, { after: null, limit: 5 });
    await r.listTasks(SCOPE, { after: { k: 'k', key: '2026-10-08T17:00:00.000Z', id: ID }, status: 'open', dueBefore: '2026-11-01T00:00:00.000Z', limit: 5 });
    expect(f.calls[0]!.args).toMatchObject({ p_after_key: null, p_after_id: null, p_status: null });
    expect(f.calls[1]!.args).toMatchObject({ p_after_key: '2026-10-08T17:00:00.000Z', p_after_id: ID, p_status: 'open', p_due_before: '2026-11-01T00:00:00.000Z' });
  });
});

describe('what a transaction stages', () => {
  const commitArgs = (f: ReturnType<typeof fake>) => f.of('productivity_commit')[0]!.args as {
    p_command: unknown; p_entities: { type: string; expectedSeq: number; seq: number; row: { seq: number } }[]; p_audit: unknown[]; p_events: unknown[];
  };

  it('predicts each sequence number from the counter it read, and holds the commit to it', async () => {
    const f = fake({ productivity_tx_state: state(7), productivity_commit: () => ({ data: { seqs: [8, 9] } }) });
    const seqs: number[] = [];
    await repo(f.client).transaction(SCOPE, async (tx) => {
      await tx.command('c0000000-0000-4000-8000-000000000001');
      seqs.push(await tx.save(task({ id: ID })), await tx.save(task({ id: ID2 })));
    });
    expect(seqs).toEqual([8, 9]);
    expect(commitArgs(f).p_entities.map((e) => [e.seq, e.row.seq, e.expectedSeq])).toEqual([[8, 8, 0], [9, 9, 0]]);
  });

  it('expects the seq a record was read at, whatever the caller has since made of it', async () => {
    const f = fake({
      productivity_tx_state: state(7), productivity_get: () => ({ data: task({ seq: 5 }) }), productivity_commit: () => ({ data: { seqs: [8] } }),
    });
    await repo(f.client).transaction(SCOPE, async (tx) => {
      const read = (await tx.entity('task', ID)) as Task;
      await tx.save({ ...read, title: 'changed', seq: 999 });
    });
    expect(commitArgs(f).p_entities[0]).toMatchObject({ expectedSeq: 5, seq: 8 });
  });

  it('shows the transaction what it has staged, and reads a record from the database once', async () => {
    const f = fake({ productivity_tx_state: state(0), productivity_get: () => ({ data: null }), productivity_commit: () => ({ data: {} }) });
    await repo(f.client).transaction(SCOPE, async (tx) => {
      expect(await tx.entity('task', ID)).toBeNull();
      expect(await tx.entity('task', ID)).toBeNull();
      await tx.save(task());
      expect(((await tx.entity('task', ID)) as Task).seq).toBe(1);
    });
    expect(f.of('productivity_get')).toHaveLength(1);
  });

  it('sends the command, the audit rows and the events with the entities, and nothing it was not given', async () => {
    const f = fake({ productivity_tx_state: state(0), productivity_commit: () => ({ data: {} }) });
    await repo(f.client).transaction(SCOPE, async (tx) => {
      await tx.save(task());
      tx.recordCommand({ commandId: 'c0000000-0000-4000-8000-000000000001', requestSha256: 'a'.repeat(64), storedAt: 'x', result: { commandId: 'c', status: 'superseded', entity: { type: 'task', id: ID, version: 1 }, supersededFields: [], reason: 'no_change' } });
      tx.audit({ id: 'a1', tenantId: SCOPE.tenantId, ownerId: SCOPE.ownerId, correlationId: 'req-0123456789abcdef', actorId: 'u', actorType: 'user', action: 'task.created', objectKind: 'task', objectId: ID, outcome: 'allowed', occurredAt: 'x' });
    });
    const a = commitArgs(f);
    expect(a.p_command).toEqual({ commandId: 'c0000000-0000-4000-8000-000000000001', requestSha256: 'a'.repeat(64), result: expect.objectContaining({ status: 'superseded' }) });
    expect(a.p_audit).toHaveLength(1);
    expect(a.p_events).toEqual([]);
  });

  it('makes no commit when there is nothing to write, and an entity-less one for an audit alone', async () => {
    const f = fake({ productivity_commit: () => ({ data: {} }) });
    const r = repo(f.client);
    await r.transaction(SCOPE, () => 'nothing');
    expect(f.of('productivity_commit')).toHaveLength(0);
    await r.transaction(SCOPE, (tx) => tx.audit({ id: 'a', tenantId: SCOPE.tenantId, ownerId: SCOPE.ownerId, correlationId: 'req-0123456789abcdef', actorId: 'u', actorType: 'user', action: 'productivity.shared_read', objectKind: 'task', objectId: SCOPE.ownerId, outcome: 'denied', occurredAt: 'x' }));
    expect(commitArgs(f)).toMatchObject({ p_command: null, p_entities: [] });
  });

  it('refuses a record from another scope, a second save of one, and commits nothing when the work throws', async () => {
    const f = fake({ productivity_tx_state: state(0), productivity_commit: () => ({ data: {} }) });
    const r = repo(f.client);
    await expect(r.transaction(SCOPE, async (tx) => void await tx.save(task({ ownerId: '22222222-2222-4222-8222-222222222222' })))).rejects.toThrow('outside the transaction scope');
    await expect(r.transaction(SCOPE, async (tx) => { await tx.save(task()); await tx.save(task()); })).rejects.toThrow('once per transaction');
    await expect(r.transaction(SCOPE, async (tx) => { await tx.save(task()); throw new Error('boom'); })).rejects.toThrow('boom');
    expect(f.of('productivity_commit')).toHaveLength(0);
  });
});

describe('when somebody else got there first', () => {
  const conflict = (code: string): Handler => (_a, nth) => (nth <= 2 ? { error: { code, message: 'entity changed since it was read' } } : { data: { seqs: [1] } });

  it.each(['40001', '23505'])('re-runs the work from the reads on %s, waiting longer each time, and returns the attempt that committed', async (code) => {
    const f = fake({ productivity_tx_state: state(0), productivity_get: () => ({ data: null }), productivity_commit: conflict(code) });
    const sleeps: number[] = [];
    let runs = 0;
    const out = await repo(f.client, { sleeps }).transaction(SCOPE, async (tx) => {
      runs += 1;
      await tx.entity('task', ID);
      await tx.save(task());
      return `attempt ${runs}`;
    });
    expect(out).toBe('attempt 3');
    expect(f.of('productivity_commit')).toHaveLength(3);
    // Each attempt reads again: a decision is never made on one state and applied to another.
    expect(f.of('productivity_get')).toHaveLength(3);
    expect(f.of('productivity_tx_state')).toHaveLength(3);
    expect(sleeps).toHaveLength(2);
    expect(sleeps[1]!).toBeGreaterThan(sleeps[0]!);
  });

  it('predicts again from the counter as it now stands', async () => {
    let state_ = 0;
    const f = fake({
      productivity_tx_state: () => ({ data: { lastSeq: (state_ += 1), command: null } }),
      productivity_commit: (_a, nth) => (nth === 1 ? { error: { code: '40001' } } : { data: {} }),
    });
    await repo(f.client).transaction(SCOPE, async (tx) => void await tx.save(task()));
    expect(f.of('productivity_commit').map((c) => (c.args.p_entities as { seq: number }[])[0]!.seq)).toEqual([2, 3]);
  });

  it('gives up after its attempts, with the contention and not the database\'s words', async () => {
    const f = fake({ productivity_tx_state: state(0), productivity_commit: () => ({ error: { code: '40001', message: 'secret detail' } }) });
    const err = await repo(f.client, { maxAttempts: 3 }).transaction(SCOPE, async (tx) => void await tx.save(task())).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(ContentionError);
    expect(f.of('productivity_commit')).toHaveLength(3);
  });

  it.each([['23514'], ['PGRST301'], [undefined]])('does not retry an error that is not a conflict (%s), and does not repeat what it said', async (code) => {
    const f = fake({ productivity_tx_state: state(0), productivity_commit: () => ({ error: { ...(code ? { code } : {}), message: 'password=hunter2' } }) });
    const err = await repo(f.client).transaction(SCOPE, async (tx) => void await tx.save(task())).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(DatabaseError);
    expect((err as Error).message).not.toContain('hunter2');
    expect(f.of('productivity_commit')).toHaveLength(1);
  });

  it('runs transactions for one scope one at a time within a process', async () => {
    const order: string[] = [];
    const f = fake({ productivity_tx_state: state(0) });
    const r = repo(f.client);
    const slow = r.transaction(SCOPE, async (tx) => { order.push('a:start'); await tx.command('c0000000-0000-4000-8000-000000000001'); await new Promise((x) => setTimeout(x, 15)); order.push('a:end'); });
    const fast = r.transaction(SCOPE, () => void order.push('b'));
    await Promise.all([slow, fast]);
    expect(order).toEqual(['a:start', 'a:end', 'b']);
  });
});

describe('the rest', () => {
  it('refuses to hand back something that is not an entity', async () => {
    const f = fake({ productivity_get: () => ({ data: { id: ID } }) });
    await expect(repo(f.client).get(SCOPE, 'task', ID)).rejects.toThrow('not an entity');
  });

  it('asks the database for the outbox, for readiness and for stats', async () => {
    const f = fake({ productivity_outbox_stats: () => ({ data: { pending: '3', oldestPendingAgeSeconds: 12, deadLettered: 1 } }) });
    const r = repo(f.client);
    await r.ping();
    expect(await r.outboxStats()).toEqual({ pending: 3, oldestPendingAgeSeconds: 12, deadLettered: 1 });
  });

  it('will not be built without a client or a server-side key', () => {
    expect(() => new PostgresProductivityRepository({})).toThrow('service client');
    expect(() => new PostgresProductivityRepository({ url: 'https://x.example' })).toThrow('service client');
    expect(() => new PostgresProductivityRepository({ url: 'https://x.example', serviceKey: 'k' })).not.toThrow();
  });
});
