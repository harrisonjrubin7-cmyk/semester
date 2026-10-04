import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SyncEngine } from '@semester/offline-sync';
import { fakeIndexedDB } from '../fakeidb';
import { fakeTaskRows } from './fake-rows';
import { clearEngineStore, idbSnapshotPort, openEngineStore } from './persistent';
import { tasksTransport } from './tasks-transport';

const NOW = 1_800_000_000_000;
const identity = { tenantId: 'self', userId: 'u1', deviceId: 'a' };

beforeEach(() => vi.stubGlobal('indexedDB', fakeIndexedDB()));
afterEach(() => vi.unstubAllGlobals());

describe('the engine store on disk', () => {
  it('survives closing the app: an edit made offline is still queued, with its key, and goes up after a restart', async () => {
    const rows = fakeTaskRows();
    const transport = tasksTransport(rows, { now: () => NOW });
    const first = await openEngineStore(idbSnapshotPort('u1'));
    const e1 = new SyncEngine({ store: first, transport, identity, now: () => NOW, newId: () => 'key-1' });
    await e1.write({ dataClass: 'task', entityId: 'T1', op: 'create', payload: { id: 'T1', title: 'written offline' } });
    await first.flush();

    // The app is closed; a new one opens the same database.
    const second = await openEngineStore(idbSnapshotPort('u1'));
    expect((await second.outbox.all()).map((r) => r.id)).toEqual(['key-1']);
    expect((await second.entities.get('task', 'T1'))!.value).toMatchObject({ title: 'written offline' });
    const e2 = new SyncEngine({ store: second, transport, identity, now: () => NOW, newId: () => 'key-2' });
    await e2.recover();
    expect((await e2.syncOnce()).acknowledged).toBe(1);
    expect(rows.table.get('T1')!.data._cmd).toBe('key-1');
  });

  it('keeps a terminal refusal terminal across a restart', async () => {
    const s = await openEngineStore(idbSnapshotPort('u1'));
    await s.outbox.put({
      id: 'k', tenantId: 'self', userId: 'u1', deviceId: 'a', dataClass: 'task', entityId: 'T', op: 'patch', payload: {}, baseVersion: 1,
      hlc: { wall: NOW, counter: 0, node: 'a' }, policyVersion: '1', permissionEpoch: 0, createdAt: NOW, expiresAt: NOW + 1, seq: 1,
      phase: 'rejected', attempts: 1, nextAttemptAt: Infinity, rejectReason: 'policy_denied',
    });
    await s.flush();
    expect((await (await openEngineStore(idbSnapshotPort('u1'))).outbox.get('k'))!.nextAttemptAt).toBe(Infinity);
  });

  it('keeps one account\'s queue away from another\'s', async () => {
    const mine = await openEngineStore(idbSnapshotPort('u1'));
    await mine.cursors.set('scope', '42'); await mine.flush();
    const theirs = await openEngineStore(idbSnapshotPort('u2'));
    expect(await theirs.cursors.get('scope')).toBeUndefined();
  });

  it('starts empty, rather than refusing to sync, when what is on disk cannot be read', async () => {
    await idbSnapshotPort('u1').save('{ this is not json');
    const s = await openEngineStore(idbSnapshotPort('u1'));
    expect(await s.outbox.all()).toEqual([]);
    expect(await s.entities.all()).toEqual([]);
  });

  it('is emptied by Erase from this device', async () => {
    const s = await openEngineStore(idbSnapshotPort('u1'));
    await s.cursors.set('scope', '42'); await s.flush();
    await clearEngineStore();
    expect(await (await openEngineStore(idbSnapshotPort('u1'))).cursors.get('scope')).toBeUndefined();
  });
});
