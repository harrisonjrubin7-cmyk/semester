/**
 * The IndexedDB underneath the store.
 *
 * Written against the raw API rather than against a wrapper. This app already
 * talks to IndexedDB twice by hand — `lib/files.ts` for attachments and
 * `lib/snapshots.ts` for the rolling copies — and a third caller is not the
 * moment to add a dependency that would then be used by one of the three.
 * (The plan asked for `idb`. This is the departure, and it is a small one:
 * about sixty lines here do what it would have done.)
 *
 * Everything below fails soft. A device with IndexedDB switched off, a private
 * window, a browser that refuses to open the database — none of those may
 * break the app, because the app worked without any of this yesterday and
 * `src/state/persist/index.ts` falls back to the old localStorage path when
 * this file cannot deliver.
 */

const DB_NAME = 'semester-store';
const DB_VERSION = 1;

/** The two key-value stores. Collections get one store each, named by field. */
export const MAPS_STORE = 'maps';
export const SETTINGS_STORE = 'settings';

let db: IDBDatabase | null = null;
let opening: Promise<IDBDatabase | null> | null = null;

/**
 * Open it, creating every store the app needs.
 *
 * The store list is passed in rather than imported, so this file holds no
 * opinion about what the app persists and `shape.ts` stays the single place
 * that decides.
 */
export function open(collections: string[]): Promise<IDBDatabase | null> {
  if (db) return Promise.resolve(db);
  if (opening) return opening;

  opening = new Promise<IDBDatabase | null>((resolve) => {
    let req: IDBOpenDBRequest;
    try {
      req = indexedDB.open(DB_NAME, DB_VERSION);
    } catch {
      resolve(null);
      return;
    }
    req.onupgradeneeded = () => {
      const database = req.result;
      for (const name of [MAPS_STORE, SETTINGS_STORE, ...collections]) {
        if (!database.objectStoreNames.contains(name)) database.createObjectStore(name);
      }
    };
    req.onsuccess = () => {
      db = req.result;
      // A second tab upgrading the schema would otherwise block on this one
      // holding the old version open forever.
      db.onversionchange = () => {
        db?.close();
        db = null;
      };
      resolve(db);
    };
    req.onerror = () => resolve(null);
    req.onblocked = () => resolve(null);
  });
  return opening;
}

/** Read a whole store as [key, value] pairs. Empty on any trouble. */
export function readAll(store: string): Promise<[string, unknown][]> {
  return new Promise((resolve) => {
    if (!db || !db.objectStoreNames.contains(store)) {
      resolve([]);
      return;
    }
    try {
      const t = db.transaction(store, 'readonly');
      const s = t.objectStore(store);
      const keys = s.getAllKeys();
      const values = s.getAll();
      t.oncomplete = () => {
        const k = keys.result as IDBValidKey[];
        const v = values.result as unknown[];
        resolve(k.map((key, i) => [String(key), v[i]] as [string, unknown]));
      };
      t.onerror = () => resolve([]);
      t.onabort = () => resolve([]);
    } catch {
      resolve([]);
    }
  });
}

export interface Write {
  store: string;
  /** `null` value means delete this key. */
  key: string;
  value: unknown;
}

/**
 * Apply a batch of writes in one transaction.
 *
 * One transaction for the whole batch, so a save is atomic: a boot that lands
 * between two writes sees the state before or the state after, never a course
 * that exists with its deadlines missing.
 */
export function write(writes: Write[]): Promise<boolean> {
  return new Promise((resolve) => {
    if (!db || writes.length === 0) {
      resolve(writes.length === 0);
      return;
    }
    const stores = [...new Set(writes.map((w) => w.store))].filter((s) =>
      db?.objectStoreNames.contains(s),
    );
    if (stores.length === 0) {
      resolve(false);
      return;
    }
    try {
      const t = db.transaction(stores, 'readwrite');
      for (const w of writes) {
        if (!stores.includes(w.store)) continue;
        const s = t.objectStore(w.store);
        if (w.value === null) s.delete(w.key);
        else s.put(w.value, w.key);
      }
      t.oncomplete = () => resolve(true);
      t.onerror = () => resolve(false);
      t.onabort = () => resolve(false);
    } catch {
      resolve(false);
    }
  });
}

/** Whether anything has ever been written. Decides whether to migrate. */
export async function isEmpty(): Promise<boolean> {
  const settings = await readAll(SETTINGS_STORE);
  return settings.length === 0;
}

/** For tests and for "delete everything on this device". */
export async function wipe(collections: string[]): Promise<void> {
  for (const store of [MAPS_STORE, SETTINGS_STORE, ...collections]) {
    await write([]).catch(() => false);
    await new Promise<void>((resolve) => {
      if (!db || !db.objectStoreNames.contains(store)) {
        resolve();
        return;
      }
      try {
        const t = db.transaction(store, 'readwrite');
        t.objectStore(store).clear();
        t.oncomplete = () => resolve();
        t.onerror = () => resolve();
      } catch {
        resolve();
      }
    });
  }
}
