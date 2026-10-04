import { beforeEach, describe, expect, it } from 'vitest';
import { randomUUID } from 'node:crypto';
import type { Command } from './contract.ts';
import { ALICE, BOB, EVENT_ID, T0, TASK_ID, clock, cmd, createEvent, createTask, person, shareGrant } from './fixtures.ts';
import { MemoryProductivityRepository } from './memory.ts';
import { PostgresProductivityRepository } from './postgres.ts';
import { PsqlRpcClient, psql, psqlJson, type PsqlTarget } from './psql-rpc.ts';
import { runRepositoryContract } from './repository-contract.ts';
import type { ProductivityRepository } from './repository.ts';
import { ProductivityService } from './service.ts';

/**
 * The adapter, against a real migrated Postgres.
 *
 * Skipped unless `SEMESTER_PG_HOST` is set, which `supabase/check.sh` does for a
 * command given in SEMESTER_CHECK_THEN — so the database under test is the one the
 * policy suites run against, with every migration applied:
 *
 *     SEMESTER_CHECK_THEN='cd app && npx vitest run server/productivity/postgres.integration' \
 *       SEMESTER_CHECK_PG_ANY=1 supabase/check.sh productivity-commands
 *
 * Three things are held here that nothing else can hold. The repository contract —
 * the properties the service's safety arguments rest on — passes against Postgres
 * as it does against memory. The *same* script of commands, run through the same
 * service against each repository, produces the same results and the same records.
 * And two adapters that share no memory — two processes, as far as the database can
 * tell — race each other, so the compare-and-swap and the retry are exercised for
 * real instead of described.
 */

const host = process.env.SEMESTER_PG_HOST;
const target: PsqlTarget = { host: host ?? '', port: process.env.SEMESTER_PG_PORT ?? '' };

const GHOST = '00000000-0000-4000-8000-00000000dead';

async function reset(): Promise<void> {
  await psql(target, `
    insert into public.invites (email, note) select e, 'pg-adapter test' from (values ('pg-a@example.invalid'), ('pg-b@example.invalid')) v(e)
      where not exists (select 1 from public.invites i where i.email = v.e);
    insert into auth.users (id, email) values ('${ALICE}', 'pg-a@example.invalid'), ('${BOB}', 'pg-b@example.invalid') on conflict do nothing;
    insert into public.schools (id, name, is_demo) values ('school-a', 'Adapter A', true), ('school-b', 'Adapter B', true) on conflict do nothing;
    truncate public.productivity_task, public.productivity_event, private.productivity_command, private.productivity_owner_seq,
             private.domain_outbox_events, public.audit_event;`);
}

/** A repository and the client under it, as one more "process". */
function process_(): { repo: PostgresProductivityRepository; client: PsqlRpcClient } {
  const client = new PsqlRpcClient(target);
  return { client, repo: new PostgresProductivityRepository({ client, sleep: async () => undefined, random: () => 0 }) };
}

const service = (repo: ProductivityRepository) => new ProductivityService({ repo, now: () => T0 });
const meta = { correlationId: 'req-0123456789abcdef' };

describe.skipIf(!host)('PostgresProductivityRepository, against a migrated database', () => {
  runRepositoryContract('PostgresProductivityRepository', async () => {
    await reset();
    return process_().repo;
  });

  describe('the same commands, through the same service, against memory and against Postgres', () => {
    const script = (): Command[] => [
      createTask({ dueAt: '2026-10-08T17:00:00Z' }),
      createEvent(),
      cmd({ type: 'task.update', id: TASK_ID, changes: { title: 'Read chapter 5' } }, { at: T0 + 10, deviceId: 'dev-a' }),
      cmd({ type: 'task.update', id: TASK_ID, changes: { title: 'older', priority: 'low' } }, { at: T0 + 5, deviceId: 'dev-b' }),
      cmd({ type: 'task.update', id: TASK_ID, changes: { notes: 'x' } }, { at: T0 + 30, deviceId: 'dev-b' }),
      cmd({ type: 'task.update', id: TASK_ID, changes: { notes: 'x' } }, { at: T0 + 40, deviceId: 'dev-b' }), // clock advances, nothing changes
      cmd({ type: 'task.update', id: TASK_ID, changes: { notes: 'older still' } }, { at: T0 + 35, deviceId: 'dev-a' }),
      cmd({ type: 'task.complete', id: TASK_ID }, { at: T0 + 20 }),
      cmd({ type: 'calendar_event.update', id: EVENT_ID, changes: { location: 'Zoom', allDay: true } }, { at: T0 + 11 }),
      cmd({ type: 'calendar_event.update', id: EVENT_ID, changes: { endsAt: '2026-10-06T18:00:00Z' } }, { at: T0 + 12 }),
      cmd({ type: 'task.create', id: '99999999-9999-4999-8999-999999999999', fields: { title: 'undated' } }, { at: T0 + 13 }),
      cmd({ type: 'calendar_event.delete', id: EVENT_ID }, { at: T0 + 14 }),
      cmd({ type: 'calendar_event.update', id: EVENT_ID, changes: { title: 'revived?' } }, { at: T0 + 15 }),
      cmd({ type: 'task.delete', id: '88888888-8888-4888-8888-888888888888' }, { at: T0 + 16 }),
    ];

    it('give the same results and the same records, in the same order', async () => {
      await reset();
      const mem = service(new MemoryProductivityRepository());
      const pg = service(process_().repo);
      const commands = script();
      const u = person();
      // Resend two of them, and one with a different body: the ledger has to agree too.
      const sequence = [...commands, commands[2]!, { ...commands[2]!, clock: clock(T0 + 77, 'dev-a', 1) } as Command];
      const a = await mem.execute(u, sequence, meta);
      const b = await pg.execute(u, sequence, meta);
      expect(b).toEqual(a);
      expect(b.map((r) => r.status)).toEqual([
        'applied', 'applied', 'applied', 'applied', 'applied', 'superseded', 'superseded', 'applied', 'applied', 'rejected',
        'applied', 'applied', 'rejected', 'rejected', 'duplicate', 'rejected',
      ]);

      const asks = [
        (s: ProductivityService) => s.changes(u, { after: null, limit: 100 }, meta),
        (s: ProductivityService) => s.listTasks(u, { after: null }, meta),
        (s: ProductivityService) => s.listTasks(u, { after: null, status: 'done' }, meta),
        (s: ProductivityService) => s.listEvents(u, { from: '2026-10-01T00:00:00Z', to: '2026-10-31T00:00:00Z', after: null }, meta),
        (s: ProductivityService) => s.agenda(u, { from: '2026-10-06T00:00:00Z', to: '2026-10-09T00:00:00Z' }, meta),
        (s: ProductivityService) => s.get(u, 'task', TASK_ID, meta),
      ];
      for (const ask of asks) expect(await ask(pg)).toEqual(await ask(mem));
    });

    it('page the same way, by sort key and by sequence', async () => {
      await reset();
      const mem = service(new MemoryProductivityRepository());
      const pg = service(process_().repo);
      const u = person();
      const many = Array.from({ length: 7 }, (_, i) => cmd({ type: 'task.create', id: `00000000-0000-4000-8000-00000000000${i}`, fields: { title: `t${i}`, ...(i % 3 === 0 ? {} : { dueAt: `2026-10-0${i}T12:00:00Z` }) } }, { at: T0 + i }));
      await mem.execute(u, many, meta);
      await pg.execute(u, many, meta);
      const walk = async (s: ProductivityService) => {
        const titles: string[] = [];
        let after = null as Parameters<ProductivityService['listTasks']>[1]['after'];
        for (;;) {
          const p = await s.listTasks(u, { after, limit: 3 }, meta);
          titles.push(...p.data.map((d) => String(d.title)));
          if (!p.page.has_more) return titles;
          const { decodeCursor } = await import('./contract.ts');
          after = decodeCursor(p.page.next_cursor, 'k') as typeof after;
        }
      };
      expect(await walk(pg)).toEqual(await walk(mem));
      expect(await walk(pg)).toHaveLength(7);
    });
  });

  describe('what the database ends up holding', () => {
    beforeEach(reset);

    it('has the record, the ledger row, the audit row and the event, tied to one command', async () => {
      const s = service(process_().repo);
      const c = createTask({ title: 'Confidential: therapy at 3' });
      await s.execute(person(), [c], meta);
      expect((await psqlJson<{ seq: number; title: string }[]>(target, 'select seq, title from public.productivity_task'))[0]).toMatchObject({ seq: 1, title: 'Confidential: therapy at 3' });
      expect(await psqlJson(target, `select command_id from private.productivity_command where command_id = '${c.commandId}'`)).toHaveLength(1);
      const events = await psqlJson<{ event_type: string; causation_id: string; correlation_id: string; payload: object }[]>(target, 'select event_type, causation_id, correlation_id, payload from private.domain_outbox_events');
      expect(events).toEqual([expect.objectContaining({ event_type: 'task.created', causation_id: c.commandId, correlation_id: meta.correlationId })]);
      const audit = await psqlJson<{ action: string; outcome: string; detail: object }[]>(target, 'select action, outcome, detail from public.audit_event');
      expect(audit).toEqual([expect.objectContaining({ action: 'task.created', outcome: 'allowed' })]);
      // The title is in the table the owner owns, and in nothing that is shared or kept as evidence.
      expect(JSON.stringify([events, audit])).not.toContain('therapy');
    });

    it('audits a refused write and a read of a share, and a probe at an owner who does not exist', async () => {
      const s = service(process_().repo);
      await s.execute(person(ALICE, 'school-a', { capabilities: [] }), [createTask()], meta);
      const bob = person(BOB, 'school-a', { consentGrantsFor: (o) => (o === ALICE ? [shareGrant()] : []) });
      await s.execute(person(), [createTask()], meta);
      await s.listTasks(bob, { ownerId: ALICE, after: null }, { ...meta, purpose: 'advising check-in' });
      await expect(s.listTasks(bob, { ownerId: GHOST, after: null }, { ...meta, purpose: 'probing' })).rejects.toMatchObject({ code: 'grant_missing' });
      const rows = await psqlJson<{ action: string; outcome: string }[]>(target, 'select action, outcome from public.audit_event order by occurred_at, id');
      expect(rows.map((r) => `${r.action}:${r.outcome}`).sort()).toEqual([
        'productivity.shared_read:allowed', 'productivity.shared_read:denied', 'task.created:allowed', 'task.write:denied',
      ]);
      // The probe took no place in anybody's history, and cost nobody a foreign-key error.
      expect(await psqlJson(target, `select 1 from private.productivity_owner_seq where owner_id = '${GHOST}'`)).toHaveLength(0);
    });

    it('answers readiness, and counts only this producer\'s outbox', async () => {
      const { repo } = process_();
      await service(repo).execute(person(), [createTask()], meta);
      await psql(target, `insert into private.domain_outbox_events (aggregate_type, aggregate_id, event_type, event_version, environment, tenant_id, producer, correlation_id, payload, data_classification, retention_class)
        values ('x', 'y', 'task.created', 1, 'staging', 'school-a', 'somebody-else', 'req-0123456789abcdef', '{}', 'internal', 'operational')`);
      await expect(repo.ping()).resolves.toBeUndefined();
      expect(await repo.outboxStats()).toMatchObject({ pending: 1, deadLettered: 0 });
    });
  });

  describe('two processes at once', () => {
    beforeEach(reset);

    it('apply one of two identical commands, and answer the other from the ledger', async () => {
      const a = service(process_().repo);
      const b = service(process_().repo);
      const c = createTask();
      const [x, y] = await Promise.all([a.execute(person(), [c], meta), b.execute(person(), [c], meta)]);
      expect([x[0]!.status, y[0]!.status].sort()).toEqual(['applied', 'duplicate']);
      expect(await psqlJson(target, 'select 1 from private.domain_outbox_events')).toHaveLength(1);
      expect(await psqlJson(target, 'select 1 from public.audit_event')).toHaveLength(1);
    });

    it('give a burst of different commands from several processes gapless sequence numbers', async () => {
      const procs = [process_(), process_(), process_()].map((p) => service(p.repo));
      const ids = Array.from({ length: 12 }, () => randomUUID());
      const commands = ids.map((id, i) => cmd({ type: 'task.create', id, fields: { title: `t${i}` } }, { at: T0 + i }));
      const results = await Promise.all(commands.map((c, i) => procs[i % 3]!.execute(person(), [c], meta)));
      expect(results.flat().map((r) => r.status)).toEqual(Array(12).fill('applied'));
      // The number each caller was *told* is the number the row was *given*: a prediction that two
      // processes both made, and both believed, would show here even though the table stays gapless.
      const stored = await psqlJson<{ id: string; seq: number }[]>(target, 'select id, seq from public.productivity_task');
      for (const [i, r] of results.entries()) expect((r[0] as { seq: number }).seq).toBe(stored.find((t) => t.id === ids[i])!.seq);
      const events = await psqlJson<{ payload: { seq: number; entityId: string } }[]>(target, 'select payload from private.domain_outbox_events');
      for (const e of events) expect(e.payload.seq).toBe(stored.find((t) => t.id === e.payload.entityId)!.seq);
      const seqs = await psqlJson<{ seq: number }[]>(target, 'select seq from public.productivity_task order by seq');
      expect(seqs.map((r) => r.seq)).toEqual(Array.from({ length: 12 }, (_, i) => i + 1));
      expect((await psqlJson<{ last_seq: number }[]>(target, 'select last_seq from private.productivity_owner_seq'))[0]!.last_seq).toBe(12);
    });

    it('retry when another process commits between this one\'s read and its write, and still decide on what is there', async () => {
      const slow = process_();
      const fast = process_();
      await service(fast.repo).execute(person(), [createTask()], meta);
      // The slow process reads the task, then — before it commits — the other one changes a different field.
      let interleaved = false;
      slow.client.beforeCall = async (fn) => {
        if (fn === 'productivity_commit' && !interleaved) {
          interleaved = true;
          await service(fast.repo).execute(person(), [cmd({ type: 'task.update', id: TASK_ID, changes: { priority: 'low' } }, { at: T0 + 20, deviceId: 'dev-b' })], meta);
        }
      };
      const r = await service(slow.repo).execute(person(), [cmd({ type: 'task.update', id: TASK_ID, changes: { title: 'Read chapter 5' } }, { at: T0 + 10, deviceId: 'dev-a' })], meta);
      expect(r[0]).toMatchObject({ status: 'applied', appliedFields: ['title'], entity: { version: 3 }, seq: 3 });
      expect(slow.client.calls.filter((c) => c.fn === 'productivity_commit')).toHaveLength(2);
      const [t] = await psqlJson<{ title: string; priority: string; version: number }[]>(target, 'select title, priority, version from public.productivity_task');
      expect(t).toEqual({ title: 'Read chapter 5', priority: 'low', version: 3 });
    });

    it('lose a race to a delete cleanly: the retry sees the tombstone and refuses', async () => {
      const slow = process_();
      const fast = process_();
      await service(fast.repo).execute(person(), [createTask()], meta);
      let interleaved = false;
      slow.client.beforeCall = async (fn) => {
        if (fn === 'productivity_commit' && !interleaved) {
          interleaved = true;
          await service(fast.repo).execute(person(), [cmd({ type: 'task.delete', id: TASK_ID }, { at: T0 + 5 })], meta);
        }
      };
      const r = await service(slow.repo).execute(person(), [cmd({ type: 'task.update', id: TASK_ID, changes: { title: 'too late' } }, { at: T0 + 10 })], meta);
      expect(r[0]).toMatchObject({ status: 'rejected', code: 'gone' });
    });

    it('report a resend after a lost acknowledgement as a duplicate, not a second change', async () => {
      const lossy = process_();
      const c = createTask();
      // The commit reaches the database, and the answer never reaches the caller.
      const real = lossy.client.rpc.bind(lossy.client);
      let lost = false;
      lossy.client.rpc = async (fn, args) => {
        const out = await real(fn, args);
        if (fn === 'productivity_commit' && !lost) {
          lost = true;
          return { data: null, error: { message: 'fetch failed' } };
        }
        return out;
      };
      const s = service(lossy.repo);
      expect((await s.execute(person(), [c], meta))[0]).toMatchObject({ status: 'failed', retryable: true });
      expect(await psqlJson(target, 'select 1 from public.productivity_task')).toHaveLength(1);
      expect((await s.execute(person(), [c], meta))[0]).toMatchObject({ status: 'duplicate', original: { status: 'applied' } });
      expect(await psqlJson(target, 'select 1 from private.domain_outbox_events')).toHaveLength(1);
    });
  });
});
