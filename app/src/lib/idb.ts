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
 * Time, a counter, and some noise — in that order, so the string still sorts
 * by when it was made.
 *
 * Written three times before this — `lib/files.ts`, `lib/snapshots.ts` and a
 * private one in `lib/threads.ts` with its own prefix and four characters of
 * noise instead of six. The prefix was the only real difference, so it is a
 * parameter, and there is one of these now.
 *
 * ## Why a counter as well as the noise
 *
 * The two ways two ids can collide are not the same problem and do not have
 * the same answer.
 *
 * *In one tab*, a loop can make hundreds of records inside a single
 * millisecond — importing a syllabus, restoring a backup, breaking a deadline
 * into steps. Every one of those shares a timestamp, so the whole guarantee
 * rested on the noise, and noise only ever gives you a probability: with six
 * base36 characters, two hundred ids in one tick collide about once in a
 * hundred thousand runs. Rare is not never, and `threads.test.ts` asks for
 * never — it makes two hundred and expects two hundred. The counter makes
 * that exact. Two ids from this module in the same millisecond cannot be
 * equal, because the counter has moved.
 *
 * *Between tabs*, or when a backup made on another device is restored onto
 * this one, there is no shared counter to lean on and the noise is the only
 * defence. So it stays, at its full six characters — and it is drawn as a
 * number rather than sliced out of one.
 *
 * `Math.random().toString(36).slice(2, 8)` was the obvious way and it does not
 * keep its promise: the string it slices is only as long as the double needs,
 * so a value like 0.5 renders as "0.i" and the six characters of noise are
 * one. It is rare and it is silent, and the case it weakens is the one case
 * the counter cannot help with. Taking a whole number below 36⁶ and padding
 * it is the same six characters every time, uniformly.
 *
 * The counter wraps at 36³ and restarts at zero on reload, neither of which
 * reopens the door: a wrap needs 46,656 records inside one millisecond, and a
 * reload that lands in the same millisecond as the id before it is back to
 * the between-tabs case, which is what the noise is for.
 */
let made = 0;

/** 36⁶, the number of six-character base36 strings there are. */
const NOISE = 36 ** 6;

export function newId(prefix = ''): string {
  made = (made + 1) % 46_656;
  const run = made.toString(36).padStart(3, '0');
  const noise = Math.floor(Math.random() * NOISE)
    .toString(36)
    .padStart(6, '0');
  return `${prefix}${Date.now().toString(36)}-${run}${noise}`;
}
