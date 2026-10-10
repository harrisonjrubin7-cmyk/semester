import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import type { IdempotencyScope } from '../../../packages/platform/src/index.ts';
import { ActionJournal } from './journal.ts';

const dirs: string[] = [];
const journals: ActionJournal[] = [];
const encryptionKey = Buffer.alloc(32, 11);
const scope = (over: Partial<IdempotencyScope> = {}): IdempotencyScope => ({
  tenantId: 'school-a',
  actorId: 'student-a',
  command: 'institution.action.commit',
  key: 'commit-key-00000001',
  ...over,
});

function open(path?: string): { journal: ActionJournal; path: string } {
  const dir = path ? '' : mkdtempSync(join(tmpdir(), 'semester-idempotency-'));
  if (dir) dirs.push(dir);
  const file = path ?? join(dir, 'journal.sqlite');
  const journal = new ActionJournal(file, encryptionKey);
  journals.push(journal);
  return { journal, path: file };
}

afterEach(() => {
  journals.splice(0).forEach((journal) => {
    try { journal.close(); } catch { /* already closed by a durability test */ }
  });
  dirs.splice(0).forEach((dir) => rmSync(dir, { recursive: true, force: true }));
});

describe('the durable institution idempotency store', () => {
  it('replays a completed response after the journal is reopened', async () => {
    const first = open();
    const now = new Date('2026-10-10T00:00:00Z');
    expect(await first.journal.begin(scope(), 'hash-a', now, 60_000, 86_400_000)).toEqual({ kind: 'started' });
    await first.journal.complete(scope(), { status: 200, body: { id: 'receipt-1', status: 'completed' } }, now);
    first.journal.close();

    const reopened = open(first.path).journal;
    expect(await reopened.begin(scope(), 'hash-a', now, 60_000, 86_400_000)).toEqual({
      kind: 'replay',
      response: { status: 200, body: { id: 'receipt-1', status: 'completed' } },
    });
    expect(await reopened.begin(scope(), 'different-hash', now, 60_000, 86_400_000)).toEqual({ kind: 'conflict' });
  });

  it('scopes keys, leases concurrent work, permits takeover, and releases transient failures', async () => {
    const { journal } = open();
    const now = new Date('2026-10-10T00:00:00Z');
    expect(await journal.begin(scope(), 'hash-a', now, 60_000, 86_400_000)).toEqual({ kind: 'started' });
    expect(await journal.begin(scope(), 'hash-a', now, 60_000, 86_400_000)).toEqual({
      kind: 'in_progress',
      retryAfterSeconds: 60,
    });
    expect(await journal.begin(scope({ actorId: 'student-b' }), 'hash-a', now, 60_000, 86_400_000)).toEqual({ kind: 'started' });

    const afterLease = new Date(now.getTime() + 60_001);
    expect(await journal.begin(scope(), 'hash-a', afterLease, 60_000, 86_400_000)).toEqual({ kind: 'started' });
    await journal.release(scope());
    expect(await journal.begin(scope(), 'hash-b', afterLease, 60_000, 86_400_000)).toEqual({ kind: 'started' });
  });

  it('starts again after the stored result expires and purges expired records', async () => {
    const { journal } = open();
    const now = new Date('2026-10-10T00:00:00Z');
    expect(await journal.begin(scope(), 'hash-a', now, 1_000, 2_000)).toEqual({ kind: 'started' });
    await journal.complete(scope(), { status: 422, body: { code: 'invalid_request' } }, now);
    const expired = new Date(now.getTime() + 2_001);
    expect(await journal.begin(scope(), 'hash-b', expired, 1_000, 2_000)).toEqual({ kind: 'started' });
    journal.purge(expired.getTime() + 2_001);
    expect(await journal.begin(scope(), 'hash-c', new Date(expired.getTime() + 2_001), 1_000, 2_000)).toEqual({ kind: 'started' });
  });
});
