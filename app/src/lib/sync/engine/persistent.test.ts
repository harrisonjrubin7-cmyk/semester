import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SyncEngine } from '@semester/offline-sync';
import { fakeIndexedDB } from '../fakeidb';
import { fakeTaskRows } from './fake-rows';
import { store } from '../../idb';
import { eraseVaults, idbStorage } from '../../vault/idb';
import { openVault, VaultError, type Identity, type Vault } from '../../vault/vault';
import { clearEngineStore, idbSnapshotPort, openEngineStore, sealedSnapshotPort } from './persistent';
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

const openVaultFor = (who: Identity) => openVault(who, idbStorage());

describe('the sealed snapshot', () => {
  const who = { tenantId: 'self', personId: 'u1', deviceId: 'a' };
  const NOW_ = 1_800_000_000_000;
  const plainRecord = async (account: string) => {
    const all = await store('semester-engine', 'snapshots').tx('readonly', (o) => o.getAll() as IDBRequest<{ id: string; json: string }[]>);
    return all.find((r) => r.id === `tasks:${account}`)?.json;
  };
  const seal = (account = 'u1') => sealedSnapshotPort(account, { who: { ...who, personId: account }, plain: idbSnapshotPort(account), now: () => NOW_ });

  it('round-trips a snapshot and leaves no readable copy of it in the engine database', async () => {
    const port = seal();
    await port.save('{"secret":"organic chemistry problem set"}');
    expect(await port.load()).toBe('{"secret":"organic chemistry problem set"}');
    expect(await plainRecord('u1')).toBeUndefined();
    const raw = JSON.stringify(await store('semester-vault', 'sealed').tx('readonly', (o) => o.getAll()));
    expect(raw).not.toContain('organic chemistry');
  });

  it('moves a plain snapshot into the vault once, then removes the plain copy', async () => {
    await idbSnapshotPort('u1').save('{"v":1}');
    const port = seal();
    expect(await port.load()).toBe('{"v":1}');
    expect(await plainRecord('u1')).toBeUndefined();
    expect(await seal().load()).toBe('{"v":1}');
  });

  it('keeps the plain copy when the sealed one cannot be read back', async () => {
    await idbSnapshotPort('u1').save('{"v":1}');
    const lying = { ...(await openVaultFor(who)), get: async () => null } as Vault;
    const port = sealedSnapshotPort('u1', { who, plain: idbSnapshotPort('u1'), vault: async () => lying, now: () => NOW_ });
    expect(await port.load()).toBe('{"v":1}');
    expect(await plainRecord('u1')).toBe('{"v":1}');
  });

  it('falls back to the plain store when the browser cannot seal, so an edit is never dropped', async () => {
    const port = sealedSnapshotPort('u1', { who, plain: idbSnapshotPort('u1'), vault: async () => { throw new VaultError('unavailable', 'no crypto'); }, now: () => NOW_ });
    await port.save('{"v":2}');
    expect(await plainRecord('u1')).toBe('{"v":2}');
    expect(await port.load()).toBe('{"v":2}');
  });

  it('falls back to the plain store when the vault opens but a write to it fails', async () => {
    const broken = { ...(await openVaultFor(who)), put: async () => { throw new VaultError('unavailable', 'quota'); } } as Vault;
    const port = sealedSnapshotPort('u1', { who, plain: idbSnapshotPort('u1'), vault: async () => broken, now: () => NOW_ });
    await port.save('{"v":4}');
    expect(await plainRecord('u1')).toBe('{"v":4}');
  });

  it('keeps one account away from another on the same device', async () => {
    await seal('u1').save('{"mine":true}');
    expect(await seal('u2').load()).toBeUndefined();
  });

  it('is unreadable after Erase device, even if a copy survived', async () => {
    const port = seal();
    await port.save('{"v":3}');
    await eraseVaults();
    expect(await seal().load()).toBeUndefined();
  });

  it('opens an engine store from it and keeps an offline edit across a restart', async () => {
    const rows = fakeTaskRows();
    const transport = tasksTransport(rows, { now: () => NOW });
    const first = await openEngineStore(seal());
    const e1 = new SyncEngine({ store: first, transport, identity, now: () => NOW, newId: () => 'key-1' });
    await e1.write({ dataClass: 'task', entityId: 'T1', op: 'create', payload: { id: 'T1', title: 'sealed offline' } });
    await first.flush();
    const second = await openEngineStore(seal());
    expect((await second.outbox.all()).map((r) => r.id)).toEqual(['key-1']);
  });
});
