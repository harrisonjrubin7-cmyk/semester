import { decodeSnapshot, encodeSnapshot, memoryStore, type LocalStore } from '@semester/offline-sync';
import { store } from '../../idb';
import { encode } from '../../vault/hlc';
import { idbStorage } from '../../vault/idb';
import { openVault, type Identity, type Vault } from '../../vault/vault';

const DB = 'semester-engine';
const STORE = 'snapshots';

/** One durable string per account: the engine's whole local state, written as a single record. */
export interface SnapshotPort {
  load(): Promise<string | undefined>;
  save(json: string): Promise<void>;
  /** Remove the record. Only the migration into the vault needs it. */
  clear?(): Promise<void>;
}

interface Record_ {
  id: string;
  json: string;
}

/**
 * IndexedDB (`semester-engine`), one record per account.
 *
 * One record rather than a table per kind because the engine's guarantee is that its queue, its rows and its
 * cursor change *together* (`SyncEngine` commits a pull's changes and its cursor in one transaction). A single
 * `put` is atomic by construction; three stores written one after another are atomic only if every browser's
 * transaction semantics and every caller's await order are right. A person's tasks are hundreds of rows, so
 * rewriting the record per commit is cheap, and it is the whole cost of being unable to tear.
 */
export function idbSnapshotPort(accountId: string): SnapshotPort {
  const s = store(DB, STORE);
  const id = `tasks:${accountId}`;
  return {
    load: async () => {
      const all = await s.tx('readonly', (o) => o.getAll() as IDBRequest<Record_[]>);
      return all.find((r) => r.id === id)?.json;
    },
    save: async (json) => {
      await s.tx('readwrite', (o) => o.put({ id, json } satisfies Record_));
    },
    clear: async () => {
      await s.tx('readwrite', (o) => o.delete(id));
    },
  };
}

const SEALED_ID = 'engine-snapshot';

/**
 * The same snapshot, sealed in the vault (`lib/vault`) instead of stored as plain JSON.
 *
 * A person's task list is their own writing and unsent edits, so it is class `personal_plan`: allowed offline, with
 * no expiry, kept encrypted under a key that never leaves the device and is destroyed first by Erase device. It sits
 * in the vault's database beside its key rather than in `semester-engine`, so a browser that evicts one evicts both
 * and there is no state where a sealed record outlives the key that opens it.
 *
 * Three behaviours, each chosen so that sealing can never cost a person an edit:
 *
 * - **Migration.** With no sealed record yet, the plain one (if any) is sealed, read back and compared byte for
 *   byte, and only then removed. Any failure leaves the plain copy in place and the engine running on it.
 * - **No Web Crypto, or any vault failure.** The snapshot is written to the plain store instead, exactly as before.
 *   The alternative is refusing to save, which would lose the edit.
 * - **A sealed record that will not open** (tampered, or its key gone) is treated as absent, so the plain copy, if
 *   there is one, is used and otherwise the engine starts empty and re-takes the account's copy, as it already does
 *   for a record it cannot decode.
 */
export function sealedSnapshotPort(
  accountId: string,
  deps: { who: Identity; plain?: SnapshotPort; vault?: () => Promise<Vault>; now?: () => number },
): SnapshotPort {
  const plain = deps.plain ?? idbSnapshotPort(accountId);
  const now = deps.now ?? Date.now;
  let opened: Promise<Vault | null> | undefined;
  const vault = () => (opened ??= (deps.vault ?? (() => openVault(deps.who, idbStorage())))().catch(() => null));
  const stamp = () => encode({ wall: now(), counter: 0, node: deps.who.deviceId });

  return {
    load: async () => {
      const v = await vault();
      if (!v) return plain.load();
      try {
        const sealed = await v.get<{ json: string }>(SEALED_ID);
        if (sealed) return sealed.value.json;
      } catch {
        // Will not open: treated as absent, below.
      }
      const old = await plain.load();
      if (old === undefined) return undefined;
      try {
        await v.put(SEALED_ID, 'personal_plan', { json: old }, stamp());
        const back = await v.get<{ json: string }>(SEALED_ID);
        if (back?.value.json === old) await plain.clear?.();
      } catch {
        // The plain copy stays and is what the engine runs on.
      }
      return old;
    },
    save: async (json) => {
      const v = await vault();
      if (v) {
        try {
          await v.put(SEALED_ID, 'personal_plan', { json }, stamp());
          return;
        } catch {
          // Fall through to the plain store.
        }
      }
      await plain.save(json);
    },
    clear: async () => {
      await (await vault())?.remove(SEALED_ID).catch(() => undefined);
      await plain.clear?.();
    },
  };
}

/** The engine's local store, loaded from disk and written through on every commit. */
export async function openEngineStore(port: SnapshotPort): Promise<ReturnType<typeof memoryStore>> {
  const saved = await port.load();
  let initial;
  try {
    initial = saved ? decodeSnapshot(saved) : undefined;
  } catch {
    // A record that cannot be read is not worth blocking sync for; the account's copy is the other half, and
    // starting empty re-takes it. Unsent edits in it are lost — said here so nobody finds it by surprise.
    initial = undefined;
  }
  return memoryStore({ initial, onCommit: (s) => port.save(encodeSnapshot(s)) });
}

export type EngineStore = LocalStore & { flush(): Promise<void> };

/** Empties it. Called by Erase device, which has to reach every database. */
export async function clearEngineStore(): Promise<void> {
  try {
    await store(DB, STORE).tx('readwrite', (o) => o.clear());
  } catch {
    // Nothing was ever stored where it could not be opened.
  }
}
