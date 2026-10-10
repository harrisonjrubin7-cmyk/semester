import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
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

async function acquire(
  journal: ActionJournal,
  requestedScope: IdempotencyScope,
  requestHash: string,
  now: Date,
  leaseMs = 60_000,
  ttlMs = 86_400_000,
): Promise<string> {
  const outcome = await journal.begin(requestedScope, requestHash, now, leaseMs, ttlMs);
  expect(outcome).toMatchObject({ kind: 'started' });
  if (outcome.kind !== 'started') throw new Error(`expected a lease, received ${outcome.kind}`);
  return outcome.leaseId;
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
    const leaseId = await acquire(first.journal, scope(), 'hash-a', now);
    await first.journal.complete(scope(), leaseId, { status: 200, body: { id: 'receipt-secret', status: 'completed' } }, now);
    first.journal.close();

    const raw = new DatabaseSync(first.path);
    const stored = raw.prepare('SELECT response_body FROM idempotency').get() as { response_body: string };
    raw.close();
    expect(stored.response_body).not.toContain('receipt-secret');

    const reopened = open(first.path).journal;
    expect(await reopened.begin(scope(), 'hash-a', now, 60_000, 86_400_000)).toEqual({
      kind: 'replay',
      response: { status: 200, body: { id: 'receipt-secret', status: 'completed' } },
    });
    expect(await reopened.begin(scope(), 'different-hash', now, 60_000, 86_400_000)).toEqual({ kind: 'conflict' });
  });

  it('scopes keys, leases concurrent work, fences stale workers, and releases transient failures', async () => {
    const { journal } = open();
    const now = new Date('2026-10-10T00:00:00Z');
    const firstLease = await acquire(journal, scope(), 'hash-a', now);
    expect(await journal.begin(scope(), 'hash-a', now, 60_000, 86_400_000)).toEqual({
      kind: 'in_progress',
      retryAfterSeconds: 60,
    });
    const otherScope = scope({ actorId: 'student-b' });
    const otherLease = await acquire(journal, otherScope, 'hash-a', now);

    const afterLease = new Date(now.getTime() + 60_001);
    const successorLease = await acquire(journal, scope(), 'hash-a', afterLease);
    await journal.complete(scope(), firstLease, { status: 200, body: { winner: 'stale' } }, afterLease);
    await journal.release(scope(), firstLease);
    expect(await journal.begin(scope(), 'hash-a', afterLease, 60_000, 86_400_000)).toMatchObject({ kind: 'in_progress' });
    await journal.complete(scope(), successorLease, { status: 200, body: { winner: 'successor' } }, afterLease);
    expect(await journal.begin(scope(), 'hash-a', afterLease, 60_000, 86_400_000)).toEqual({
      kind: 'replay',
      response: { status: 200, body: { winner: 'successor' } },
    });

    await journal.release(otherScope, otherLease);
    await acquire(journal, otherScope, 'hash-b', afterLease);
  });

  it('starts again after the stored result expires and purges expired records', async () => {
    const { journal } = open();
    const now = new Date('2026-10-10T00:00:00Z');
    const firstLease = await acquire(journal, scope(), 'hash-a', now, 1_000, 2_000);
    await journal.complete(scope(), firstLease, { status: 422, body: { code: 'invalid_request' } }, now);
    const expired = new Date(now.getTime() + 2_001);
    await acquire(journal, scope(), 'hash-b', expired, 1_000, 2_000);
    journal.purge(expired.getTime() + 2_001);
    await acquire(journal, scope(), 'hash-c', new Date(expired.getTime() + 2_001), 1_000, 2_000);
  });

  it('preserves the decryption error when a stored replay body is corrupt', async () => {
    const first = open();
    const now = new Date('2026-10-10T00:00:00Z');
    const leaseId = await acquire(first.journal, scope(), 'hash-a', now);
    await first.journal.complete(scope(), leaseId, { status: 200, body: { value: 'secret' } }, now);
    first.journal.close();

    const raw = new DatabaseSync(first.path);
    raw.prepare("UPDATE idempotency SET response_body='not-valid-ciphertext'").run();
    raw.close();

    const reopened = open(first.path).journal;
    let failure: unknown;
    try {
      await reopened.begin(scope(), 'hash-a', now, 60_000, 86_400_000);
    } catch (error) {
      failure = error;
    }
    expect(failure).toBeInstanceOf(Error);
    expect((failure as Error).message).not.toMatch(/rollback/i);
  });
});
