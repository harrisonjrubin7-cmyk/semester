import { describe, expect, it } from 'vitest';
import { drainOutbox, MemoryReceiptLedger, processOnce, validateEvent } from '../../../packages/institution/src/index.ts';
import { COMMAND_TYPES, type Command, type CommandResult, type CommandType } from './contract.ts';
import { ApiError } from './service.ts';
import {
  ALICE, BOB, EVENT_ID, FEED, T0, TASK_ID, clock, cmd, createEvent, createTask, feedJob, harness, iso, person, shareGrant,
} from './fixtures.ts';

/**
 * Every refusal here takes a command the service accepts and changes exactly
 * one thing, so the control is inside the test: a service that refused
 * everything would fail the "accepted" half, and one that accepted everything
 * would fail the "refused" half.
 */

const only = (r: CommandResult[]): CommandResult => {
  expect(r).toHaveLength(1);
  return r[0]!;
};

describe('creating and changing, the ordinary way', () => {
  it('applies a create, and writes the record, the audit row and the event together', async () => {
    const h = harness();
    const r = only(await h.service.execute(person(), [createTask()], h.meta));
    expect(r).toMatchObject({ status: 'applied', entity: { type: 'task', id: TASK_ID, version: 1 }, seq: 1, clockClamped: false });
    expect(h.repo.auditRows).toHaveLength(1);
    expect(h.repo.auditRows[0]).toMatchObject({ action: 'task.created', outcome: 'allowed', actorId: ALICE, ownerId: ALICE, correlationId: h.meta.correlationId });
    expect(h.repo.outbox.rows).toHaveLength(1);
    expect(h.repo.outbox.rows[0]!.event).toMatchObject({ eventType: 'task.created', tenantId: 'school-a', correlationId: h.meta.correlationId });
  });

  it('keeps what a person typed out of the audit row and the event', async () => {
    const h = harness();
    await h.service.execute(person(), [createTask({ title: 'Confidential: therapy at 3', notes: 'private note' })], h.meta);
    const everything = JSON.stringify([h.repo.auditRows, h.repo.outbox.rows]);
    expect(everything).not.toContain('therapy');
    expect(everything).not.toContain('private note');
  });

  it('emits events the shared contract accepts, for every verb', async () => {
    const h = harness();
    const u = person();
    await h.service.execute(u, [
      createTask(), cmd({ type: 'task.update', id: TASK_ID, changes: { title: 'Read chapter 5' } }, { at: T0 + 1 }),
      cmd({ type: 'task.complete', id: TASK_ID }, { at: T0 + 2 }), cmd({ type: 'task.reopen', id: TASK_ID }, { at: T0 + 3 }),
      cmd({ type: 'task.delete', id: TASK_ID }, { at: T0 + 4 }),
      createEvent(), cmd({ type: 'calendar_event.update', id: EVENT_ID, changes: { location: 'Zoom' } }, { at: T0 + 5 }),
      cmd({ type: 'calendar_event.delete', id: EVENT_ID }, { at: T0 + 6 }),
    ], h.meta);
    expect(h.repo.outbox.rows.map((r) => r.event.eventType)).toEqual([
      'task.created', 'task.updated', 'task.completed', 'task.updated', 'task.deleted',
      'calendar_event.created', 'calendar_event.updated', 'calendar_event.deleted',
    ]);
    for (const row of h.repo.outbox.rows) expect(validateEvent(row.event)).toEqual({ ok: true, event: row.event });
  });

  it('refuses an id that is already something else, without saying whose', async () => {
    const h = harness();
    await h.service.execute(person(), [createTask()], h.meta);
    const again = only(await h.service.execute(person(), [createTask({ title: 'Different' })], h.meta));
    expect(again).toMatchObject({ status: 'rejected', code: 'id_in_use' });
  });
});

describe('idempotency, which is what makes an offline queue safe', () => {
  it('answers a repeated command from the ledger and applies it once', async () => {
    const h = harness();
    const c = createTask();
    const first = only(await h.service.execute(person(), [c], h.meta));
    const second = only(await h.service.execute(person(), [c], h.meta));
    expect(first.status).toBe('applied');
    expect(second).toMatchObject({ status: 'duplicate', original: first });
    expect(h.repo.auditRows).toHaveLength(1);
    expect(h.repo.outbox.rows).toHaveLength(1);
  });

  it('refuses the same command id carrying a different change', async () => {
    const h = harness();
    const c = createTask();
    await h.service.execute(person(), [c], h.meta);
    const reused = { ...c, fields: { title: 'Something else entirely' } };
    expect(only(await h.service.execute(person(), [reused as typeof c], h.meta))).toMatchObject({ status: 'rejected', code: 'idempotency_key_reused' });
    const read = await h.service.listTasks(person(), { after: null }, h.meta);
    expect(read.data[0]).toMatchObject({ title: 'Read chapter 4' });
  });

  it('applies one of two identical commands that arrive at the same instant', async () => {
    const h = harness();
    const c = createTask();
    const [a, b] = await Promise.all([h.service.execute(person(), [c], h.meta), h.service.execute(person(), [c], h.meta)]);
    expect([only(a).status, only(b).status].sort()).toEqual(['applied', 'duplicate']);
    expect(h.repo.outbox.rows).toHaveLength(1);
  });

  it('is safe to resend after the store failed before it committed', async () => {
    const h = harness();
    const c = createTask();
    h.repo.faults.commit = new Error('connection reset');
    const lost = only(await h.service.execute(person(), [c], h.meta));
    expect(lost).toMatchObject({ status: 'failed', code: 'unavailable', retryable: true });
    // Nothing leaked from the attempt that did not commit.
    expect(h.repo.auditRows).toHaveLength(0);
    expect(h.repo.outbox.rows).toHaveLength(0);
    h.repo.faults.commit = null;
    expect(only(await h.service.execute(person(), [c], h.meta))).toMatchObject({ status: 'applied', seq: 1 });
    expect(h.repo.outbox.rows).toHaveLength(1);
  });

  it('is safe to resend after the change committed but the answer was lost', async () => {
    const h = harness();
    const c = createTask();
    h.repo.faults.afterCommit = new Error('timeout reading response');
    expect(only(await h.service.execute(person(), [c], h.meta)).status).toBe('failed');
    expect(h.repo.outbox.rows).toHaveLength(1); // it did happen
    h.repo.faults.afterCommit = null;
    expect(only(await h.service.execute(person(), [c], h.meta))).toMatchObject({ status: 'duplicate', original: { status: 'applied' } });
    expect(h.repo.outbox.rows).toHaveLength(1); // and was not done twice
  });

  it('stops at the first failure and tells the client what it did not try', async () => {
    const h = harness();
    const second = createTask({}, { at: T0 + 1 });
    h.repo.faults.commit = new Error('down');
    const r = await h.service.execute(person(), [createEvent(), { ...second, id: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc' } as typeof second], h.meta);
    expect(r.map((x) => x.status)).toEqual(['failed', 'not_attempted']);
  });

  it('rolls the whole command back when the event cannot be written', async () => {
    const h = harness();
    h.repo.faults.emit = new Error('outbox full');
    expect(only(await h.service.execute(person(), [createTask()], h.meta)).status).toBe('failed');
    h.repo.faults.emit = null;
    expect((await h.service.listTasks(person(), { after: null }, h.meta)).data).toHaveLength(0);
    expect(h.repo.auditRows).toHaveLength(0);
  });

  it('hands out gapless sequence numbers, and a rolled-back command does not use one', async () => {
    const h = harness();
    const u = person();
    await h.service.execute(u, [createTask()], h.meta);
    h.repo.faults.commit = new Error('down');
    await h.service.execute(u, [createEvent()], h.meta);
    h.repo.faults.commit = null;
    await h.service.execute(u, [createEvent()], h.meta);
    await h.service.execute(u, [cmd({ type: 'task.update', id: TASK_ID, changes: { title: 'B' } }, { at: T0 + 1 })], h.meta);
    const feed = await h.service.changes(u, { after: null }, h.meta);
    expect(feed.data.map((d) => d.seq).sort()).toEqual([2, 3]); // the task moved to 3; the event is 2
    expect(h.repo.outbox.rows.map((r) => (r.event.payload as { seq: number }).seq)).toEqual([1, 2, 3]);
  });

  it('refuses a command queued longer ago than it is safe to replay', async () => {
    const h = harness();
    const stale = createTask({}, { at: T0 - 31 * 86_400_000 });
    expect(only(await h.service.execute(person(), [stale], h.meta))).toMatchObject({ status: 'rejected', code: 'command_expired' });
    expect(only(await h.service.execute(person(), [createTask({}, { at: T0 - 29 * 86_400_000 })], h.meta)).status).toBe('applied');
  });
});

describe('every command type is idempotent, generically', () => {
  // One case per registered command. A command added to the vocabulary without a case here fails the
  // first test below, so no command can be registered that this has not been run against.
  const imported = (over: Record<string, unknown> = {}) => cmd({
    type: 'calendar_event.create', id: EVENT_ID, source: { ref: 'feed:x' },
    fields: { title: 'MATH', startsAt: '2026-10-06T14:00:00Z', endsAt: '2026-10-06T14:50:00Z', timezone: 'UTC', ...over },
  }, { at: T0 + 1 });
  const cases: Record<CommandType, { who?: 'person' | 'job'; setup: () => Command[]; target: () => Command }> = {
    'task.create': { setup: () => [], target: () => createTask() },
    'task.update': { setup: () => [createTask()], target: () => cmd({ type: 'task.update', id: TASK_ID, changes: { title: 'B' } }, { at: T0 + 5 }) },
    'task.complete': { setup: () => [createTask()], target: () => cmd({ type: 'task.complete', id: TASK_ID }, { at: T0 + 5 }) },
    'task.reopen': { setup: () => [createTask(), cmd({ type: 'task.complete', id: TASK_ID }, { at: T0 + 4 })], target: () => cmd({ type: 'task.reopen', id: TASK_ID }, { at: T0 + 5 }) },
    'task.delete': { setup: () => [createTask()], target: () => cmd({ type: 'task.delete', id: TASK_ID }, { at: T0 + 5 }) },
    'calendar_event.create': { setup: () => [], target: () => createEvent() },
    'calendar_event.update': { setup: () => [createEvent()], target: () => cmd({ type: 'calendar_event.update', id: EVENT_ID, changes: { location: 'Zoom' } }, { at: T0 + 5 }) },
    'calendar_event.delete': { setup: () => [createEvent()], target: () => cmd({ type: 'calendar_event.delete', id: EVENT_ID }, { at: T0 + 5 }) },
  };

  it('has a case for every command the validator knows', () => {
    expect(Object.keys(cases).sort()).toEqual([...COMMAND_TYPES].sort());
    void imported;
  });

  it.each(COMMAND_TYPES)('%s: twice with one id is one effect, one audit row, one event and the same answer; a different body is a conflict', async (type) => {
    const h = harness();
    const u = person();
    const { setup, target } = cases[type];
    await h.service.execute(u, setup(), h.meta);
    const audits = h.repo.auditRows.length;
    const events = h.repo.outbox.rows.length;
    const c = target();
    const first = only(await h.service.execute(u, [c], h.meta));
    expect(['applied', 'superseded']).toContain(first.status);
    const second = only(await h.service.execute(u, [c], h.meta));
    expect(second).toMatchObject({ status: 'duplicate', original: first });
    expect(h.repo.auditRows.length - audits).toBe(1);
    expect(h.repo.outbox.rows.length - events).toBe(1);
    expect(h.repo.outbox.rows.at(-1)!.event.causationId).toBe(c.commandId);
    const other = { ...c, clock: clock(T0 + 77, 'dev-a', 1) } as Command;
    expect(only(await h.service.execute(u, [other], h.meta))).toMatchObject({ status: 'rejected', code: 'idempotency_key_reused' });
    expect(h.repo.outbox.rows.length - events).toBe(1);
  });
});

describe('what goes to the server\'s log, and what does not reach the caller', () => {
  it('hands a failed command\'s real error to the hook, with the correlation id, and tells the caller none of it', async () => {
    const seen: { error: unknown; correlationId: string }[] = [];
    const h = harness();
    const { ProductivityService } = await import('./service.ts');
    const service = new ProductivityService({ repo: h.repo, now: () => T0, onError: (error, c) => void seen.push({ error, correlationId: c.correlationId }) });
    h.repo.faults.commit = new Error('password=hunter2 at db.internal:5432');
    const r = only(await service.execute(person(), [createTask()], h.meta));
    expect(r).toMatchObject({ status: 'failed', retryable: true });
    expect(JSON.stringify(r)).not.toMatch(/hunter2|db\.internal/);
    expect(seen).toHaveLength(1);
    expect((seen[0]!.error as Error).message).toContain('hunter2');
    expect(seen[0]!.correlationId).toBe(h.meta.correlationId);
  });
});

describe('two devices, one task: field-aware last writer wins', () => {
  const setup = async () => {
    const h = harness();
    await h.service.execute(person(), [createTask({}, { at: T0 })], h.meta);
    return h;
  };
  const title = (t: string, at: number, device = 'dev-a') => cmd({ type: 'task.update', id: TASK_ID, changes: { title: t } }, { at, deviceId: device });
  const read = async (h: ReturnType<typeof harness>) => (await h.service.listTasks(person(), { after: null }, h.meta)).data[0]!;

  it('lands edits to different fields from both devices', async () => {
    const h = await setup();
    await h.service.execute(person(), [cmd({ type: 'task.update', id: TASK_ID, changes: { priority: 'low' } }, { at: T0 + 10, deviceId: 'dev-a' })], h.meta);
    await h.service.execute(person(), [cmd({ type: 'task.update', id: TASK_ID, changes: { notes: 'moved' } }, { at: T0 + 5, deviceId: 'dev-b' })], h.meta);
    expect(await read(h)).toMatchObject({ priority: 'low', notes: 'moved', version: 3 });
  });

  it('resolves the same field to the later intent, whichever replay arrives first', async () => {
    const early = title('written first', T0 + 10, 'dev-a');
    const late = title('written last', T0 + 20, 'dev-b');
    const outcomes: string[] = [];
    for (const order of [[early, late], [late, early]]) {
      const h = await setup();
      const results = await h.service.execute(person(), order, h.meta);
      outcomes.push(`${(await read(h)).title as string}|${results.map((r) => r.status).join(',')}`);
    }
    expect(outcomes[0]).toBe('written last|applied,applied');
    expect(outcomes[1]).toBe('written last|applied,superseded');
  });

  it('says which fields lost, rather than dropping them quietly', async () => {
    const h = await setup();
    await h.service.execute(person(), [title('newer', T0 + 20)], h.meta);
    const r = only(await h.service.execute(person(), [cmd({ type: 'task.update', id: TASK_ID, changes: { title: 'older', priority: 'low' } }, { at: T0 + 10, deviceId: 'dev-b' })], h.meta));
    expect(r).toMatchObject({ status: 'applied', appliedFields: ['priority'], supersededFields: ['title'] });
  });

  it('keeps a clock it learned from an edit that changed nothing, so an older edit still loses', async () => {
    const h = await setup();
    // Same value as stored, but stamped later than anything the record has seen.
    await h.service.execute(person(), [title('Read chapter 4', T0 + 30, 'dev-b')], h.meta);
    const r = only(await h.service.execute(person(), [title('stale', T0 + 20, 'dev-a')], h.meta));
    expect(r).toMatchObject({ status: 'superseded', reason: 'newer_edit' });
    expect(await read(h)).toMatchObject({ title: 'Read chapter 4' });
  });

  it('does not let a device with a wrong clock outrank honest ones for more than the allowed skew', async () => {
    const h = await setup();
    const hostile = cmd({ type: 'task.update', id: TASK_ID, changes: { title: 'from 2099' } }, { at: Date.parse('2099-01-01T00:00:00Z'), deviceId: 'dev-x' });
    const r = only(await h.service.execute(person(), [hostile], h.meta));
    expect(r).toMatchObject({ status: 'applied', clockClamped: true });
    // An honest edit made just past the skew allowance wins, even though the hostile one claimed 2099.
    const honest = title('honest', T0 + 6 * 60_000, 'dev-a');
    h.setNow(T0 + 6 * 60_000);
    await h.service.execute(person(), [honest], h.meta);
    expect(await read(h)).toMatchObject({ title: 'honest' });
  });

  it('records the time a task was completed as when the person did it, not when the queue replayed', async () => {
    const h = await setup();
    h.setNow(T0 + 3_600_000);
    await h.service.execute(person(), [cmd({ type: 'task.complete', id: TASK_ID }, { at: T0 + 60_000 })], h.meta);
    expect(await read(h)).toMatchObject({ status: 'done', completedAt: iso(T0 + 60_000) });
  });

  it('lets a later reopen undo a complete, and an earlier one not', async () => {
    const h = await setup();
    await h.service.execute(person(), [cmd({ type: 'task.complete', id: TASK_ID }, { at: T0 + 100 })], h.meta);
    expect(only(await h.service.execute(person(), [cmd({ type: 'task.reopen', id: TASK_ID }, { at: T0 + 50, deviceId: 'dev-b' })], h.meta)).status).toBe('superseded');
    expect((await read(h)).status).toBe('done');
    expect(only(await h.service.execute(person(), [cmd({ type: 'task.reopen', id: TASK_ID }, { at: T0 + 200, deviceId: 'dev-b' })], h.meta)).status).toBe('applied');
    expect(await read(h)).toMatchObject({ status: 'open', completedAt: null });
  });

  it('refuses an event edit that would leave it ending before it starts', async () => {
    const h = harness();
    await h.service.execute(person(), [createEvent()], h.meta);
    const bad = cmd({ type: 'calendar_event.update', id: EVENT_ID, changes: { endsAt: '2026-10-06T18:00:00Z' } }, { at: T0 + 1 });
    expect(only(await h.service.execute(person(), [bad], h.meta))).toMatchObject({ status: 'rejected', code: 'validation_failed' });
  });
});

describe('deleting', () => {
  it('turns a record into a tombstone the sync feed carries and a read does not', async () => {
    const h = harness();
    const u = person();
    await h.service.execute(u, [createTask(), cmd({ type: 'task.delete', id: TASK_ID }, { at: T0 + 1 })], h.meta);
    await expect(h.service.get(u, 'task', TASK_ID, h.meta)).rejects.toMatchObject({ status: 404, code: 'not_found' });
    expect((await h.service.listTasks(u, { after: null }, h.meta)).data).toHaveLength(0);
    const feed = await h.service.changes(u, { after: null }, h.meta);
    expect(feed.data).toEqual([expect.objectContaining({ type: 'task', id: TASK_ID, deleted: true })]);
  });

  it('outranks an edit stamped later, because bringing back something somebody removed is the surprise', async () => {
    const h = harness();
    await h.service.execute(person(), [createTask(), cmd({ type: 'task.delete', id: TASK_ID }, { at: T0 + 1 })], h.meta);
    const late = cmd({ type: 'task.update', id: TASK_ID, changes: { title: 'revived?' } }, { at: T0 + 9_999, deviceId: 'dev-b' });
    expect(only(await h.service.execute(person(), [late], h.meta))).toMatchObject({ status: 'rejected', code: 'gone' });
  });

  it('is a no-op the second time, and not-found for something that never existed', async () => {
    const h = harness();
    await h.service.execute(person(), [createTask(), cmd({ type: 'task.delete', id: TASK_ID }, { at: T0 + 1 })], h.meta);
    expect(only(await h.service.execute(person(), [cmd({ type: 'task.delete', id: TASK_ID }, { at: T0 + 2 })], h.meta))).toMatchObject({ status: 'superseded', reason: 'already_deleted' });
    expect(only(await h.service.execute(person(), [cmd({ type: 'task.delete', id: EVENT_ID }, { at: T0 + 3 })], h.meta))).toMatchObject({ status: 'rejected', code: 'not_found' });
  });
});

describe('what the body is not allowed to decide', () => {
  it('rejects an owner, a tenant, a version or a source smuggled into a command', async () => {
    const h = harness();
    for (const extra of [{ ownerId: BOB }, { tenantId: 'school-b' }, { version: 9 }, { source: { kind: 'institution_verified' } }]) {
      const bad = { ...createTask(), ...extra };
      expect(only(await h.service.execute(person(), [bad], h.meta))).toMatchObject({ status: 'rejected', code: 'validation_failed' });
    }
    expect(only(await h.service.execute(person(), [createTask()], h.meta)).status).toBe('applied');
  });

  it.each([
    ['a missing title', { title: '   ' }],
    ['a title with a control character', { title: 'bad\u0007title' }],
    ['an over-long note', { notes: 'x'.repeat(4_001) }],
    ['a due date with no offset', { dueAt: '2026-10-08T17:00:00' }],
    ['an unknown priority', { priority: 'urgent' }],
  ])('refuses %s', async (_name, over) => {
    const h = harness();
    expect(only(await h.service.execute(person(), [createTask(over)], h.meta))).toMatchObject({ status: 'rejected', code: 'validation_failed' });
  });

  it.each([
    ['an unknown zone', { timezone: 'Mars/Olympus' }],
    ['an event that ends before it starts', { endsAt: '2026-10-06T18:00:00Z' }],
    ['an event longer than a year', { endsAt: '2028-10-06T20:00:00Z' }],
  ])('refuses %s', async (_name, over) => {
    const h = harness();
    expect(only(await h.service.execute(person(), [createEvent(over)], h.meta)).status).toBe('rejected');
    expect(only(await h.service.execute(person(), [createEvent()], h.meta)).status).toBe('applied');
  });
});

describe('tenants and owners do not see each other', () => {
  it('keeps one person\'s commands and reads inside their own data, even for the same record id', async () => {
    const h = harness();
    await h.service.execute(person(ALICE), [createTask({ title: 'alice task' })], h.meta);
    // Bob, same tenant, same record id: creates his own. No collision, no leak.
    expect(only(await h.service.execute(person(BOB), [createTask({ title: 'bob task' })], h.meta)).status).toBe('applied');
    // Bob cannot change Alice's: the id resolves inside his own scope, where it is his.
    await h.service.execute(person(BOB), [cmd({ type: 'task.update', id: TASK_ID, changes: { title: 'bob edits' } }, { at: T0 + 1 })], h.meta);
    expect((await h.service.listTasks(person(ALICE), { after: null }, h.meta)).data[0]).toMatchObject({ title: 'alice task' });
    expect((await h.service.listTasks(person(BOB), { after: null }, h.meta)).data[0]).toMatchObject({ title: 'bob edits' });
  });

  it('keeps tenants apart for the same person id', async () => {
    const h = harness();
    await h.service.execute(person(ALICE, 'school-a'), [createTask({ title: 'at a' })], h.meta);
    expect((await h.service.listTasks(person(ALICE, 'school-b'), { after: null }, h.meta)).data).toHaveLength(0);
  });

  it('answers a record that is not yours with not-found, not forbidden', async () => {
    const h = harness();
    await h.service.execute(person(ALICE), [createTask()], h.meta);
    await expect(h.service.get(person(BOB), 'task', TASK_ID, h.meta)).rejects.toMatchObject({ status: 404 });
    expect(await h.service.get(person(ALICE), 'task', TASK_ID, h.meta)).toMatchObject({ id: TASK_ID });
  });

  it('refuses a person with no planning capability, and one with no membership', async () => {
    const h = harness();
    expect(only(await h.service.execute(person(ALICE, 'school-a', { capabilities: [] }), [createTask()], h.meta))).toMatchObject({ status: 'rejected', code: 'capability_missing' });
    expect(only(await h.service.execute(person(ALICE, 'school-a', { membershipIds: [] }), [createTask()], h.meta))).toMatchObject({ status: 'rejected', code: 'membership_missing' });
    expect(only(await h.service.execute(person(), [createTask()], h.meta)).status).toBe('applied');
  });

  it('refuses a tenant the server did not verify', async () => {
    const h = harness();
    const unverified = person();
    delete (unverified.tenant as { verifiedBy?: string }).verifiedBy;
    expect(only(await h.service.execute(unverified, [createTask()], h.meta))).toMatchObject({ status: 'rejected', code: 'tenant_unverified' });
  });

  it('records the refusal, with its reason and no content', async () => {
    const h = harness();
    await h.service.execute(person(ALICE, 'school-a', { capabilities: [] }), [createTask({ title: 'secret title' })], h.meta);
    expect(h.repo.auditRows).toEqual([expect.objectContaining({ outcome: 'denied', reasonCode: 'capability_missing', action: 'task.write' })]);
    expect(JSON.stringify(h.repo.auditRows)).not.toContain('secret title');
    expect(h.repo.outbox.rows).toHaveLength(0);
  });
});

describe('reading somebody else\'s data', () => {
  const setup = async () => {
    const h = harness();
    await h.service.execute(person(ALICE), [createTask(), createEvent()], h.meta);
    return h;
  };
  const bob = (grants = [shareGrant()]) => person(BOB, 'school-a', { consentGrantsFor: (owner) => (owner === ALICE ? grants : []) });
  const asAlice = { ownerId: ALICE, after: null };
  const purposeful = { correlationId: 'req-0123456789abcdef', purpose: 'advising check-in for the October plan' };

  it('shows only the fields the share allows, records the read, and expires with the grant', async () => {
    const h = await setup();
    const page = await h.service.listTasks(bob(), asAlice, purposeful);
    expect(page.data).toHaveLength(1);
    expect(page.data[0]).toMatchObject({ type: 'task', ownerId: ALICE, title: 'Read chapter 4' });
    expect(page.data[0]).not.toHaveProperty('notes');
    const events = await h.service.listEvents(bob(), { ...asAlice, from: '2026-10-01T00:00:00Z', to: '2026-10-31T00:00:00Z' }, purposeful);
    expect(events.data[0]).not.toHaveProperty('location');
    expect(events.data[0]).not.toHaveProperty('notes');
    const reads = h.repo.auditRows.filter((r) => r.action === 'productivity.shared_read');
    expect(reads).toHaveLength(2);
    expect(reads[0]).toMatchObject({ actorId: BOB, ownerId: ALICE, outcome: 'allowed' });
  });

  it.each([
    ['no purpose', () => bob(), { correlationId: 'req-0123456789abcdef' }, 'purpose_missing'],
    ['no grant', () => bob([]), purposeful, 'grant_missing'],
    ['a grant for the calendar only', () => bob([shareGrant({ scopes: ['calendar:read'] })]), purposeful, 'grant_missing'],
    ['a grant from somebody else', () => bob([shareGrant({ grantedBy: FEED })]), purposeful, 'grant_missing'],
    ['a grant to somebody else', () => bob([shareGrant({ grantedTo: FEED })]), purposeful, 'grant_missing'],
    ['an expired grant', () => bob([shareGrant({ expiresAt: iso(T0 - 1) })]), purposeful, 'grant_not_live'],
    ['a revoked grant', () => bob([shareGrant({ revokedAt: iso(T0 - 1000) })]), purposeful, 'grant_not_live'],
  ])('refuses %s', async (_name, who, meta, code) => {
    const h = await setup();
    await expect(h.service.listTasks(who(), asAlice, meta)).rejects.toMatchObject({ status: 403, code });
    // The control: the same request, with everything in order, is allowed.
    expect((await h.service.listTasks(bob(), asAlice, purposeful)).data).toHaveLength(1);
  });

  it('does not return a thing when the read cannot be recorded', async () => {
    const h = await setup();
    h.repo.faults.commit = new Error('audit store down');
    await expect(h.service.listTasks(bob(), asAlice, purposeful)).rejects.toThrow('audit store down');
  });

  it('records a refused attempt on the owner\'s trail', async () => {
    const h = await setup();
    await h.service.listTasks(bob([]), asAlice, purposeful).catch(() => undefined);
    expect(h.repo.auditRows.at(-1)).toMatchObject({ action: 'productivity.shared_read', outcome: 'denied', reasonCode: 'grant_missing', actorId: BOB });
  });

  it('never lets a share change anything', async () => {
    const h = await setup();
    // A share is a read grant; bob's commands apply to bob's own data and cannot name alice's.
    await h.service.execute(bob(), [cmd({ type: 'task.delete', id: TASK_ID }, { at: T0 + 1 })], h.meta);
    expect((await h.service.listTasks(person(ALICE), { after: null }, h.meta)).data).toHaveLength(1);
  });

  it('does not serve a read to a service', async () => {
    const h = await setup();
    await expect(h.service.listTasks(feedJob(), { ownerId: ALICE, after: null }, purposeful)).rejects.toMatchObject({ code: 'actor_not_person' });
  });
});

describe('what comes from a source stays the source\'s', () => {
  const importEvent = (over: Record<string, unknown> = {}, base = {}) => cmd({
    type: 'calendar_event.create', id: EVENT_ID, source: { ref: 'feed:canvas:evt-9' },
    fields: { title: 'MATH 1301', startsAt: '2026-10-06T14:00:00Z', endsAt: '2026-10-06T14:50:00Z', timezone: 'America/Chicago', kind: 'event', ...over },
  }, base);
  const asFeed = (h: ReturnType<typeof harness>, c = importEvent(), who = feedJob()) =>
    h.service.execute(who, [c], { ...h.meta, purpose: 'feed:canvas' }, { ownerId: ALICE });

  it('lets a bound feed job import into a person\'s calendar', async () => {
    const h = harness();
    expect(only(await asFeed(h)).status).toBe('applied');
    expect((await h.service.listEvents(person(), { from: '2026-10-06T00:00:00Z', to: '2026-10-07T00:00:00Z', after: null }, h.meta)).data[0]).toMatchObject({ title: 'MATH 1301', source: { kind: 'imported', ref: 'feed:canvas:evt-9' } });
    expect(h.repo.auditRows[0]).toMatchObject({ actorType: 'integration', ownerId: ALICE });
  });

  it.each([
    ['a job that is not bound to the tenant', () => feedJob('school-a', { tenant: { id: 'school-a', environment: 'production', verifiedBy: 'membership' } }), 'service_unbound'],
    ['a job without the import capability', () => feedJob('school-a', { capabilities: [] }), 'capability_missing'],
  ])('refuses %s', async (_name, who, code) => {
    const h = harness();
    expect(only(await asFeed(h, importEvent(), who()))).toMatchObject({ status: 'rejected', code });
    expect(only(await asFeed(h)).status).toBe('applied');
  });

  it('refuses an import with no purpose, and an import with no source', async () => {
    const h = harness();
    const r = only(await h.service.execute(feedJob(), [importEvent()], h.meta, { ownerId: ALICE }));
    expect(r).toMatchObject({ status: 'rejected', code: 'purpose_missing' });
    const bare = cmd({ type: 'calendar_event.create', id: EVENT_ID, fields: { title: 'x', startsAt: '2026-10-06T14:00:00Z', endsAt: '2026-10-06T15:00:00Z', timezone: 'UTC' } });
    expect(only(await asFeed(h, bare))).toMatchObject({ status: 'rejected', code: 'source_required' });
  });

  it('keeps a job away from tasks, and from events a person made', async () => {
    const h = harness();
    await h.service.execute(person(), [createEvent()], h.meta);
    const edit = cmd({ type: 'calendar_event.update', id: EVENT_ID, changes: { title: 'hijack' } }, { at: T0 + 1, deviceId: 'dev-job' });
    expect(only(await asFeed(h, edit))).toMatchObject({ status: 'rejected', code: 'source_mismatch' });
    expect(only(await asFeed(h, createTask() as never))).toMatchObject({ status: 'rejected', code: 'actor_not_permitted' });
  });

  it('refuses a person\'s attempt to move an imported class, and to delete it, but not to annotate it', async () => {
    const h = harness();
    await asFeed(h);
    const u = person();
    const move = cmd({ type: 'calendar_event.update', id: EVENT_ID, changes: { startsAt: '2026-10-06T15:00:00Z' } }, { at: T0 + 1 });
    expect(only(await h.service.execute(u, [move], h.meta))).toMatchObject({ status: 'rejected', code: 'source_authoritative' });
    expect(only(await h.service.execute(u, [cmd({ type: 'calendar_event.delete', id: EVENT_ID }, { at: T0 + 2 })], h.meta))).toMatchObject({ code: 'source_authoritative' });
    // The control: a note is theirs.
    expect(only(await h.service.execute(u, [cmd({ type: 'calendar_event.update', id: EVENT_ID, changes: { notes: 'bring calculator' } }, { at: T0 + 3 })], h.meta)).status).toBe('applied');
  });

  it('lets a job refresh what it imported', async () => {
    const h = harness();
    await asFeed(h);
    const moved = cmd({ type: 'calendar_event.update', id: EVENT_ID, changes: { startsAt: '2026-10-06T15:00:00Z', endsAt: '2026-10-06T15:50:00Z' } }, { at: T0 + 1, deviceId: 'dev-job' });
    expect(only(await asFeed(h, moved)).status).toBe('applied');
  });

  it('does not let a person claim a source', async () => {
    const h = harness();
    expect(only(await h.service.execute(person(), [importEvent()], h.meta))).toMatchObject({ status: 'rejected', code: 'source_forbidden' });
  });

  it('refuses to be handed a job without an owner to act for', async () => {
    const h = harness();
    await expect(h.service.execute(feedJob(), [importEvent()], { ...h.meta, purpose: 'feed' })).rejects.toThrow('whose data');
    await expect(h.service.execute(person(), [createTask()], h.meta, { ownerId: BOB })).rejects.toThrow('their own');
  });
});

describe('the agenda and the sync feed', () => {
  it('merges tasks due and events happening in a window, in time order', async () => {
    const h = harness();
    await h.service.execute(person(), [
      createTask({ dueAt: '2026-10-06T21:00:00Z' }), createEvent(),
      cmd({ type: 'task.create', id: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd', fields: { title: 'due outside', dueAt: '2026-12-01T00:00:00Z' } }),
    ], h.meta);
    const agenda = await h.service.agenda(person(), { from: '2026-10-06T00:00:00Z', to: '2026-10-07T00:00:00Z' }, h.meta);
    expect(agenda.data.map((d) => d.title)).toEqual(['Office hours', 'Read chapter 4']);
    expect(agenda.truncated).toBe(false);
  });

  it('pages the sync feed by sequence, with no gaps and no repeats', async () => {
    const h = harness();
    const u = person();
    await h.service.execute(u, [createTask(), createEvent(), cmd({ type: 'task.update', id: TASK_ID, changes: { title: 'B' } }, { at: T0 + 1 })], h.meta);
    const first = await h.service.changes(u, { after: null, limit: 1 }, h.meta);
    expect(first.page.has_more).toBe(true);
    const seen = [...first.data];
    let cursor = first.page.next_cursor;
    while (cursor) {
      const { decodeCursor } = await import('./contract.ts');
      const next = await h.service.changes(u, { after: decodeCursor(cursor, 's') as never, limit: 1 }, h.meta);
      seen.push(...next.data);
      cursor = next.page.has_more ? next.page.next_cursor : null;
    }
    expect(seen.map((d) => d.seq)).toEqual([2, 3]);
  });
});

describe('after the transaction: the outbox, the consumers and the dead letters', () => {
  it('delivers each event, and a consumer that sees one twice acts once', async () => {
    const h = harness();
    await h.service.execute(person(), [createTask()], h.meta);
    const delivered: unknown[] = [];
    const report = await drainOutbox(h.repo.outbox, (e) => void delivered.push(e));
    expect(report).toEqual({ published: 1, failed: 0, deadLettered: 0 });
    const ledger = new MemoryReceiptLedger();
    let acted = 0;
    const handle = () => { acted += 1; };
    expect((await processOnce(ledger, 'search-index', delivered[0], handle, 'school-a')).outcome).toBe('processed');
    expect((await processOnce(ledger, 'search-index', delivered[0], handle, 'school-a')).outcome).toBe('duplicate');
    expect(acted).toBe(1);
    expect((await processOnce(new MemoryReceiptLedger(), 'search-index', delivered[0], handle, 'school-b')).outcome).toBe('refused');
  });

  it('retries a failing publish and parks it for an operator after the last attempt', async () => {
    const h = harness();
    await h.service.execute(person(), [createTask()], h.meta);
    const bus = () => { throw new Error('bus unavailable'); };
    for (let pass = 0; pass < 2; pass += 1) await drainOutbox(h.repo.outbox, bus, { maxAttempts: 3 });
    expect(await h.service.outboxStats()).toMatchObject({ pending: 1, deadLettered: 0 });
    expect((await drainOutbox(h.repo.outbox, bus, { maxAttempts: 3 })).deadLettered).toBe(1);
    expect(await h.service.outboxStats()).toMatchObject({ pending: 0, deadLettered: 1 });
  });
});

describe('the service counts outcomes without content', () => {
  it('reports each command\'s type, status and actor kind', async () => {
    const h = harness();
    const c = createTask();
    await h.service.execute(person(), [c, c, { nonsense: true }], h.meta);
    expect(h.outcomes).toEqual([
      { type: 'task.create', status: 'applied', actorType: 'user' },
      { type: 'task.create', status: 'duplicate', actorType: 'user' },
      { type: 'invalid', status: 'rejected', actorType: 'user' },
    ]);
  });
});

describe('ApiError', () => {
  it('carries a status and a code a client can switch on', () => {
    const e = new ApiError(403, 'grant_missing', 'no');
    expect([e.status, e.code, e.message]).toEqual([403, 'grant_missing', 'no']);
  });
  it('has a clock helper that sorts as text', () => {
    expect(clock(2) < clock(10)).toBe(true);
  });
});
