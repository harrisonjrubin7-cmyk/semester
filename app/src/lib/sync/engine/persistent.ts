import { decodeSnapshot, encodeSnapshot, memoryStore, type LocalStore } from '@semester/offline-sync';
import { store } from '../../idb';

const DB = 'semester-engine';
const STORE = 'snapshots';

/** One durable string per account: the engine's whole local state, written as a single record. */
export interface SnapshotPort {
  load(): Promise<string | undefined>;
  save(json: string): Promise<void>;
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
