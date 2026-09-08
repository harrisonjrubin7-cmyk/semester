/**
 * One object store in one database, for the two things too big for localStorage.
 *
 * `lib/files.ts` keeps the files you attach and `lib/snapshots.ts` keeps the
 * rolling copies of your term. They want exactly the same thing — a single
 * store keyed by `id`, opened on demand, closed when the transaction
 * finishes — and until now each had written it out: the same `open`, the same
 * `tx`, byte for byte, in two files. Two copies of a promise wrapper around a
 * callback API is two places for a leaked connection or an unhandled
 * `onerror`, and the copy nobody is looking at is the one that gets it wrong.
 *
 * So it is written once, here, and parameterised by the two things that
 * genuinely differ: which database, and which store inside it. They stay
 * separate databases — clearing your snapshots has never had any chance of
 * touching your files, and that is worth keeping.
 *
 * ## What this is not
 *
 * Not a general IndexedDB wrapper, and not a dependency. `state/persist/db.ts`
 * is deliberately left alone: it holds many stores rather than one, caches its
 * connection across calls, handles a second tab upgrading the schema, and
 * resolves `null` rather than rejecting so the store can fall back to
 * localStorage. Folding those two contracts together would mean one of them
 * getting a behaviour it did not ask for, which is how a "shared" helper
 * becomes a bug in the caller that did not need the feature.
 */

/** A database with one store in it, keyed by the `id` on each record. */
export interface Store {
  /** Run one request inside one transaction, and resolve what it returns. */
  tx<T>(mode: IDBTransactionMode, run: (store: IDBObjectStore) => IDBRequest<T>): Promise<T>;
}

/**
 * Name a database and its one store. Nothing is opened until something asks.
 *
 * The connection is opened per transaction and closed on `oncomplete` rather
 * than held: these two stores are written a handful of times a session, and a
 * held connection is what blocks another tab from upgrading the schema.
 */
export function store(dbName: string, storeName: string, version = 1): Store {
  const open = (): Promise<IDBDatabase> =>
    new Promise((resolve, reject) => {
      const req = indexedDB.open(dbName, version);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(storeName)) {
          db.createObjectStore(storeName, { keyPath: 'id' });
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });

  return {
    tx<T>(mode: IDBTransactionMode, run: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
      return open().then(
        (db) =>
          new Promise<T>((resolve, reject) => {
            const t = db.transaction(storeName, mode);
            const req = run(t.objectStore(storeName));
            req.onsuccess = () => resolve(req.result);
            req.onerror = () => reject(req.error);
            t.oncomplete = () => db.close();
          }),
      );
    },
  };
}

/**
 * A short id that sorts by when it was made.
 *
 * Time plus a little noise. Two records made in the same millisecond is not
 * something a person can do, but a restored backup landing on the same clock
 * tick is, and an id collision silently merges two things that were separate.
 *
 * Written three times before this — `lib/files.ts`, `lib/snapshots.ts` and a
 * private one in `lib/threads.ts` with its own prefix and four characters of
 * noise instead of six. The prefix was the only real difference, so it is a
 * parameter, and there is one of these now.
 */
export function newId(prefix = ''): string {
  return `${prefix}${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}
