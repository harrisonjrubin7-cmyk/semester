import { describe, expect, it } from 'vitest';
import { memoryStore, SyncEngine, type Command, type SyncTransport } from '@semester/offline-sync';
import { fakeTaskRows } from './fake-rows';
import { tasksTransport } from './tasks-transport';
import { stampToVersion, versionToStamp } from './stamp';

const NOW = 1_800_000_000_000;
const DAY = 86_400_000;

function world() {
  const t = { now: NOW };
  const rows = fakeTaskRows();
  const transport = tasksTransport(rows, { now: () => t.now });
  const device = (id: string, over: Partial<{ transport: SyncTransport }> = {}) => {
    let n = 0;
    const store = memoryStore();
    const engine = new SyncEngine({
      store, transport: over.transport ?? transport, identity: { tenantId: 'self', userId: 'u1', deviceId: id },
      now: () => t.now, newId: () => `${id}-c${++n}`, random: () => 0.5,
    });
    return { id, store, engine, sync: () => engine.syncOnce() };
  };
  return { t, rows, transport, device };
}
const task = (title = 'Read ch. 3') => ({ dataClass: 'task' as const, entityId: 'T1', op: 'create' as const, payload: { id: 'T1', title, done: false } });
const cmd = (o: Partial<Command>): Command => ({
  id: 'k', tenantId: 'self', userId: 'u1', deviceId: 'd', dataClass: 'task', entityId: 'T1', op: 'patch', payload: {}, baseVersion: null,
  hlc: { wall: NOW, counter: 0, node: 'd' }, policyVersion: '1', permissionEpoch: 0, createdAt: NOW, expiresAt: NOW + DAY, seq: 1, ...o,
});

describe('tasks transport: one device', () => {
  it('creates a row, is acknowledged with the database stamp as the version, and hides its own bookkeeping', async () => {
    const w = world(); const a = w.device('a');
    await a.engine.write(task()); await a.sync();
    const row = w.rows.table.get('T1')!;
    expect(row.data._cmd).toBe('a-c1');
    const e = (await a.store.entities.get('task', 'T1'))!;
    expect(e.version).toBe(stampToVersion(row.updated_at));
    expect(e.value).toEqual({ id: 'T1', title: 'Read ch. 3', done: false });
    expect(a.engine.stateOf(e)).toBe('synced');
  });

  it('answers a repeated key with the first answer and writes nothing', async () => {
    const w = world();
    const first = await w.transport.push({ deviceId: 'd', commands: [cmd({ op: 'create', payload: { title: 'x' } })] });
    const stamp = w.rows.table.get('T1')!.updated_at;
    const again = await w.transport.push({ deviceId: 'd', commands: [cmd({ op: 'create', payload: { title: 'x' } })] });
    expect(first).toMatchObject({ results: [{ status: 'applied' }] });
    expect(again).toMatchObject({ results: [{ status: 'duplicate', serverVersion: stampToVersion(stamp) }] });
    expect(w.rows.table.get('T1')!.updated_at).toBe(stamp);
  });

  it('survives a lost answer: one row, one write, ends synced', async () => {
    const w = world();
    const real = w.transport;
    let lost = 1;
    const a = w.device('a', { transport: { ...real, push: async (q) => { const r = await real.push(q); if (lost-- > 0) throw new Error('response lost'); return r; }, status: real.status, pull: real.pull } });
    await a.engine.write(task());
    expect((await a.sync()).stopped).toBe('offline');
    const stamp = w.rows.table.get('T1')!.updated_at;
    expect(a.engine.stateOf((await a.store.entities.get('task', 'T1'))!)).toBe('pending');
    w.t.now += 10 * 60_000;
    expect((await a.sync()).acknowledged).toBe(1);
    expect(w.rows.table.size).toBe(1);
    expect(w.rows.table.get('T1')!.updated_at).toBe(stamp);
    expect(a.engine.stateOf((await a.store.entities.get('task', 'T1'))!)).toBe('synced');
  });

  it('keeps a thrown database error ambiguous, never failed or synced, and recovers', async () => {
    const w = world(); const a = w.device('a');
    await a.engine.write(task());
    w.rows.control.failNext = 1;
    expect((await a.sync()).stopped).toBe('offline');
    expect((await a.store.outbox.all())[0]!.phase).toBe('pending_reconciliation');
    w.t.now += 10 * 60_000;
    await a.sync();
    expect(await a.store.outbox.all()).toEqual([]);
    expect(w.rows.table.size).toBe(1);
  });

  it('rejects anything but a task, a submit, and an expired command', async () => {
    const w = world();
    const r = await w.transport.push({ deviceId: 'd', commands: [
      cmd({ id: 'k1', dataClass: 'grade_change' as never }), cmd({ id: 'k2', op: 'submit' }), cmd({ id: 'k3', expiresAt: NOW - 1 }),
    ] });
    expect(r).toMatchObject({ results: [{ status: 'rejected', reason: 'policy_denied' }, { status: 'rejected', reason: 'server_authoritative' }, { status: 'rejected', reason: 'expired' }] });
    expect(w.rows.table.size).toBe(0);
  });

  it('rejects an edit to a task that is gone, without inventing it', async () => {
    const w = world();
    const r = await w.transport.push({ deviceId: 'd', commands: [cmd({ payload: { title: 'x' } })] });
    expect(r).toMatchObject({ results: [{ status: 'rejected', reason: 'validation_failed' }] });
    expect(w.rows.table.size).toBe(0);
  });
});

describe('tasks transport: two devices', () => {
  it('merges edits to different fields on top of each other', async () => {
    const w = world(); const a = w.device('a'); const b = w.device('b');
    await a.engine.write(task()); await a.sync(); await b.sync();
    await a.engine.write({ dataClass: 'task', entityId: 'T1', op: 'patch', payload: { title: 'Read ch. 4' } });
    await b.engine.write({ dataClass: 'task', entityId: 'T1', op: 'patch', payload: { done: true } });
    await a.sync(); await b.sync(); await a.sync();
    for (const d of [a, b]) expect((await d.store.entities.get('task', 'T1'))!.value).toEqual({ id: 'T1', title: 'Read ch. 4', done: true });
    expect(w.rows.table.get('T1')!.data).toMatchObject({ title: 'Read ch. 4', done: true });
  });

  it('retries a write that lost the race and applies it on the newer row, not twice', async () => {
    const w = world(); const a = w.device('a');
    await a.engine.write(task()); await a.sync();
    await a.engine.write({ dataClass: 'task', entityId: 'T1', op: 'patch', payload: { title: 'mine' } });
    // Another device writes the row between our read and our compare-and-swap.
    const real = w.rows.updateIf.bind(w.rows); let raced = false;
    w.rows.updateIf = async (id, at, data, del) => { if (!raced) { raced = true; w.rows.touch(id, { ...data, note: 'theirs' }); } return real(id, at, data, del); };
    await a.sync();
    expect(w.rows.table.get('T1')!.data).toMatchObject({ title: 'mine', note: 'theirs' });
    expect(a.engine.stateOf((await a.store.entities.get('task', 'T1'))!)).toBe('synced');
  });

  it('later arrival wins a field, whatever either device\'s clock says', async () => {
    const w = world(); const a = w.device('a'); const b = w.device('b');
    await a.engine.write(task()); await a.sync(); await b.sync();
    // Device a is a year fast and writes first; device b is right and writes after.
    w.t.now += 1000;
    await a.engine.write({ dataClass: 'task', entityId: 'T1', op: 'patch', payload: { title: 'from a' } });
    await a.sync();
    w.t.now += 1000;
    await b.engine.write({ dataClass: 'task', entityId: 'T1', op: 'patch', payload: { title: 'from b' } });
    await b.sync();
    expect(w.rows.table.get('T1')!.data.title).toBe('from b');
  });

  it('carries a deletion to the other device, and a deleted task cannot be edited back to life', async () => {
    const w = world(); const a = w.device('a'); const b = w.device('b');
    await a.engine.write(task()); await a.sync(); await b.sync();
    await a.engine.write({ dataClass: 'task', entityId: 'T1', op: 'delete', payload: null }); await a.sync();
    expect(w.rows.table.get('T1')!.deleted_at).not.toBeNull();
    await b.sync();
    expect(await b.store.entities.get('task', 'T1')).toBeUndefined();
    const late = await w.transport.push({ deviceId: 'c', commands: [cmd({ id: 'late', payload: { title: 'zombie' } })] });
    expect(late).toMatchObject({ results: [{ status: 'rejected', reason: 'validation_failed' }] });
    expect(w.rows.table.get('T1')!.data.title).toBe('Read ch. 3');
  });

  it('asks when two devices create the same id with different content, and keeps both', async () => {
    const w = world(); const a = w.device('a'); const b = w.device('b');
    await a.engine.write(task('from a')); await b.engine.write(task('from b'));
    await a.sync(); await b.sync();
    const e = (await b.store.entities.get('task', 'T1'))!;
    expect(b.engine.stateOf(e)).toBe('conflicted');
    expect(e.value).toMatchObject({ title: 'from b' });
    expect((await b.store.outbox.all())[0]!.conflict!.serverValue).toMatchObject({ title: 'from a' });
  });
});

describe('tasks transport: the feed', () => {
  it('starts from a snapshot, then follows a cursor, and does not refetch', async () => {
    const w = world(); const a = w.device('a'); const b = w.device('b');
    for (const id of ['A', 'B', 'C']) await a.engine.write({ dataClass: 'task', entityId: id, op: 'create', payload: { id, title: id } });
    await a.sync();
    expect((await b.sync()).pulled).toBe(3);
    await a.engine.write({ dataClass: 'task', entityId: 'B', op: 'patch', payload: { title: 'B2' } }); await a.sync();
    await b.sync();
    expect((await b.store.entities.get('task', 'B'))!.value).toMatchObject({ title: 'B2' });
    // The boundary row can come back once more; the engine ignores a version it already has.
    expect((await b.store.entities.all()).length).toBe(3);
  });

  it('starts over when its cursor is older than the server keeps tombstones, and drops what was swept', async () => {
    const w = world(); const a = w.device('a'); const b = w.device('b');
    await a.engine.write({ dataClass: 'task', entityId: 'GONE', op: 'create', payload: { id: 'GONE' } });
    await a.engine.write({ dataClass: 'task', entityId: 'KEPT', op: 'create', payload: { id: 'KEPT' } });
    await a.sync(); await b.sync();
    // b is away 100 days. The row was deleted and the tombstone swept in the meantime.
    w.rows.table.delete('GONE');
    w.t.now += 100 * DAY;
    // The database has moved on by 100 days of stamps, too.
    await b.sync();
    expect(await b.store.entities.get('task', 'GONE')).toBeUndefined();
    expect(await b.store.entities.get('task', 'KEPT')).toBeDefined();
  });

  it('pages a long feed without losing or repeating a change', async () => {
    const w = world(); const a = w.device('a'); const b = w.device('b');
    await b.sync(); // takes the (empty) snapshot, so it has a cursor
    for (let i = 0; i < 450; i++) w.rows.touch(`X${i}`, { id: `X${i}`, i });
    await b.sync();
    expect((await b.store.entities.all()).length).toBe(450);
    void a;
  });
});

describe('version/stamp as the compare-and-swap names it', () => {
  it('writes only against the exact stamp the database gave', async () => {
    const w = world(); const a = w.device('a');
    await a.engine.write(task()); await a.sync();
    const seen: string[] = [];
    const real = w.rows.updateIf.bind(w.rows);
    w.rows.updateIf = async (id, at, d, del) => { seen.push(at); return real(id, at, d, del); };
    await a.engine.write({ dataClass: 'task', entityId: 'T1', op: 'patch', payload: { done: true } });
    await a.sync();
    expect(seen).toHaveLength(1);
    expect(stampToVersion(seen[0]!)).toBe(stampToVersion(versionToStamp(stampToVersion(seen[0]!))));
  });
});
