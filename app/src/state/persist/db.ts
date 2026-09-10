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
 * How long to wait for the database to open before going without it.
 *
 * Opening does not read anything — it checks a version and hands back a
 * handle — so on a working browser it is milliseconds. Ten seconds is not a
 * budget, it is the point past which the honest conclusion is that no answer
 * is coming.
 *
 * The trade it makes, stated plainly: a device whose open is merely *slow*
 * rather than stuck spends the rest of the session on the localStorage path,
 * which after the migration is a copy from the day of the migration. That
 * would be an old account on screen. Against a wait with no end, which is
 * what this replaces, it is the better of the two — and at ten seconds it
 * takes a browser that has stopped answering rather than one that is busy.
 */
const OPEN_LIMIT_MS = 10_000;

/**
 * Open it, creating every store the app needs.
 *
 * The store list is passed in rather than imported, so this file holds no
 * opinion about what the app persists and `shape.ts` stays the single place
 * that decides.
 *
 * Every way this can fail answers null, including the one that answers
 * nothing at all. `main.tsx` waits on this before anything mounts — it has
 * to, because the account lives in here and rendering against a half-loaded
 * store would send somebody who has used the app for a month back through
 * onboarding — and the comment there promises that *"a device that will not
 * open a database gets null, and the app falls straight back to the
 * localStorage path"*. That was true of a throw, of `onerror` and of
 * `onblocked`, and not of a request that simply never fires any of them:
 * measured with `indexedDB.open` returning a request that never answers, the
 * app drew nothing at all — `#root` empty, 0 characters, no error in the
 * console, on every load, for ever. The other three ways all boot and save.
 */
export function open(collections: string[]): Promise<IDBDatabase | null> {
  if (db) return Promise.resolve(db);
  if (opening) return opening;

  opening = new Promise<IDBDatabase | null>((resolve) => {
    // Whichever comes first. `resolve` after the first call is a no-op, so a
    // request that answers late cannot take back an answer already given.
    const gaveUp = setTimeout(() => resolve(null), OPEN_LIMIT_MS);
    const answer = (value: IDBDatabase | null) => {
      clearTimeout(gaveUp);
      resolve(value);
    };
    let req: IDBOpenDBRequest;
    try {
      req = indexedDB.open(DB_NAME, DB_VERSION);
    } catch {
      answer(null);
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
      answer(db);
    };
    req.onerror = () => answer(null);
    req.onblocked = () => answer(null);
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
