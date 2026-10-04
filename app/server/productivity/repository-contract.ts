import { describe, expect, it } from 'vitest';
import type { Entity, Task } from './contract.ts';
import type { ProductivityRepository, Scope } from './repository.ts';

/**
 * What any `ProductivityRepository` must do, stated as tests the
 * implementation runs. The in-memory one passes them today; the Postgres one
 * is not allowed to ship until it does, because these are the properties the
 * service's safety arguments lean on:
 *
 *  - writes in one transaction are all-or-nothing;
 *  - transactions on one scope run one at a time, so "seen this command?" and
 *    "record that I have" cannot interleave;
 *  - sequence numbers are gapless and a rolled-back transaction spends none;
 *  - a scope sees nothing of another, even with the same ids.
 */

const A: Scope = { tenantId: 'school-a', ownerId: '11111111-1111-4111-8111-111111111111' };
const B: Scope = { tenantId: 'school-a', ownerId: '22222222-2222-4222-8222-222222222222' };
const OTHER_TENANT: Scope = { tenantId: 'school-b', ownerId: A.ownerId };
const ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';

const task = (scope: Scope, over: Partial<Task> = {}): Task => ({
  id: ID, tenantId: scope.tenantId, ownerId: scope.ownerId, version: 1, seq: 0,
  source: { kind: 'student_entered' }, clocks: {}, createdAt: '2026-10-05T15:00:00.000Z', updatedAt: '2026-10-05T15:00:00.000Z',
  deletedAt: null, deleteClock: null, title: 't', notes: null, status: 'open', completedAt: null, dueAt: null, priority: 'normal', courseId: null,
  ...over,
});

export function runRepositoryContract(name: string, make: () => ProductivityRepository | Promise<ProductivityRepository>): void {
  describe(`${name} satisfies the repository contract`, () => {
    it('commits everything written in a transaction, or nothing', async () => {
      const repo = await make();
      await expect(repo.transaction(A, (tx) => {
        tx.save(task(A));
        throw new Error('boom');
      })).rejects.toThrow('boom');
      expect(await repo.get(A, 'task', ID)).toBeNull();
      await repo.transaction(A, (tx) => void tx.save(task(A)));
      expect((await repo.get(A, 'task', ID))?.id).toBe(ID);
    });

    it('lets a transaction read what it has written but not yet committed', async () => {
      const repo = await make();
      await repo.transaction(A, (tx) => {
        expect(tx.entity('task', ID)).toBeNull();
        tx.save(task(A));
        expect(tx.entity('task', ID)?.id).toBe(ID);
      });
    });

    it('runs transactions on one scope one at a time, in arrival order', async () => {
      const repo = await make();
      const order: string[] = [];
      const slow = repo.transaction(A, async () => {
        order.push('a:start');
        await new Promise((r) => setTimeout(r, 20));
        order.push('a:end');
      });
      const fast = repo.transaction(A, () => void order.push('b'));
      await Promise.all([slow, fast]);
      expect(order).toEqual(['a:start', 'a:end', 'b']);
    });

    it('serializes "have I seen this command" with "record that I have"', async () => {
      const repo = await make();
      const attempt = () => repo.transaction(A, async (tx) => {
        if (tx.command('c1')) return 'duplicate';
        await new Promise((r) => setTimeout(r, 5));
        tx.recordCommand({ commandId: 'c1', requestSha256: 'h', storedAt: 'now', result: { commandId: 'c1', status: 'superseded', entity: { type: 'task', id: ID, version: 1 }, supersededFields: [], reason: 'no_change' } });
        return 'applied';
      });
      expect((await Promise.all([attempt(), attempt(), attempt()])).sort()).toEqual(['applied', 'duplicate', 'duplicate']);
    });

    it('hands out gapless sequence numbers, and a rolled-back transaction spends none', async () => {
      const repo = await make();
      const seqs: number[] = [];
      await repo.transaction(A, (tx) => void seqs.push(tx.save(task(A))));
      await expect(repo.transaction(A, (tx) => {
        tx.save(task(A, { id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb' }));
        throw new Error('no');
      })).rejects.toThrow();
      await repo.transaction(A, (tx) => void seqs.push(tx.save(task(A, { id: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc' }))));
      expect(seqs).toEqual([1, 2]);
    });

    it('gives each scope its own sequence', async () => {
      const repo = await make();
      let a = 0;
      let b = 0;
      await repo.transaction(A, (tx) => { a = tx.save(task(A)); });
      await repo.transaction(B, (tx) => { b = tx.save(task(B)); });
      expect([a, b]).toEqual([1, 1]);
    });

    it('shows a scope nothing of another, even with the same record id', async () => {
      const repo = await make();
      await repo.transaction(A, (tx) => void tx.save(task(A, { title: 'a' })));
      await repo.transaction(B, (tx) => void tx.save(task(B, { title: 'b' })));
      await repo.transaction(OTHER_TENANT, (tx) => void tx.save(task(OTHER_TENANT, { title: 'other tenant' })));
      expect(((await repo.get(A, 'task', ID)) as Task).title).toBe('a');
      expect(((await repo.get(B, 'task', ID)) as Task).title).toBe('b');
      expect((await repo.listTasks(A, { after: null, limit: 10 })).map((t) => t.title)).toEqual(['a']);
      expect(await repo.changes(A, 0, 10)).toHaveLength(1);
    });

    it('refuses to write an entity into a scope that is not the transaction\'s', async () => {
      const repo = await make();
      await expect(repo.transaction(A, (tx) => void tx.save(task(B)))).rejects.toThrow();
      expect(await repo.get(B, 'task', ID)).toBeNull();
    });

    it('keeps tombstones out of reads and in the change feed', async () => {
      const repo = await make();
      await repo.transaction(A, (tx) => void tx.save(task(A)));
      await repo.transaction(A, (tx) => void tx.save({ ...(tx.entity('task', ID) as Entity), deletedAt: '2026-10-05T16:00:00.000Z', version: 2 }));
      expect(await repo.get(A, 'task', ID)).toBeNull();
      expect(await repo.listTasks(A, { after: null, limit: 10 })).toHaveLength(0);
      const feed = await repo.changes(A, 0, 10);
      expect(feed).toHaveLength(1);
      expect(feed[0]!.deletedAt).not.toBeNull();
    });

    it('does not let a caller reach stored state through what it was handed', async () => {
      const repo = await make();
      await repo.transaction(A, (tx) => void tx.save(task(A, { title: 'original' })));
      const got = (await repo.get(A, 'task', ID)) as Task;
      got.title = 'mutated by the caller';
      expect(((await repo.get(A, 'task', ID)) as Task).title).toBe('original');
    });
  });
}
