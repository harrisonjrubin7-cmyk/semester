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
 * One open request, answered exactly once.
 *
 * `version` is left off for "whatever is on disk", which is also what creates
 * the database at version 1 on a device that has never had one. Passing a
 * number asks for an upgrade, and is how a store that did not exist when the
 * database was built gets made.
 *
 * Every way this can fail answers null, including the one that answers
 * nothing at all. `main.tsx` waits on this before anything mounts — it has
 * to, because the account lives in here and rendering against a half-loaded
 * store would send somebody who has used the app for a month back through
 * onboarding — and the comment there promises that *"a device that will not
 * open a database gets null, and the app falls straight back to the
 * localStorage path"*. That was true of a throw and of `onerror`, and not of
 * a request that simply never fires either: measured with `indexedDB.open`
 * returning a request that never answers, the app drew nothing at all —
 * `#root` empty, 0 characters, no error in the console, on every load, for
 * ever. Both of the others boot and save.
 */
function request(version: number | undefined, needed: string[]): Promise<IDBDatabase | null> {
  return new Promise<IDBDatabase | null>((resolve) => {
    /*
     * Whichever comes first, and the loser is closed rather than dropped.
     *
     * `resolve` after the first call is a no-op, so a request that answers
     * late cannot take back an answer already given. But a late answer that
     * *succeeded* is a live connection to the database, and letting go of the
     * variable does not close it — it sits there for the life of the tab,
     * blocking the next upgrade that comes along, which is now the thing that
     * makes a new store. A handle nobody is going to use is a handle to close.
     */
    let answered = false;
    const gaveUp = setTimeout(() => {
      answered = true;
      resolve(null);
    }, OPEN_LIMIT_MS);
    const answer = (value: IDBDatabase | null) => {
      if (answered) {
        value?.close();
        return;
      }
      answered = true;
      clearTimeout(gaveUp);
      resolve(value);
    };
    let req: IDBOpenDBRequest;
    try {
      req = version === undefined ? indexedDB.open(DB_NAME) : indexedDB.open(DB_NAME, version);
    } catch {
      answer(null);
      return;
    }
    req.onupgradeneeded = () => {
      const database = req.result;
      for (const name of needed) {
        if (!database.objectStoreNames.contains(name)) database.createObjectStore(name);
      }
    };
    req.onsuccess = () => answer(req.result);
    req.onerror = () => answer(null);
    /*
     * Blocked is not an answer, so it is not answered.
     *
     * It fires only for a version change, and only while another tab still
     * holds the old version open — and that tab closes its handle the moment
     * it hears `onversionchange`, which is milliseconds away. Answering null
     * here would give up on the upgrade in the one case that resolves itself,
     * and leave that tab on a database missing the store it is about to write
     * to. The timeout above still guarantees an answer either way.
     */
    req.onblocked = () => {};
  });
}

/** Which of the stores this build needs are not in the database. */
function missingFrom(database: IDBDatabase, needed: string[]): string[] {
  return needed.filter((name) => !database.objectStoreNames.contains(name));
}

/** Hold on to the handle, and let go of it when another tab wants to upgrade. */
function keep(database: IDBDatabase): IDBDatabase {
  db = database;
  // A second tab upgrading the schema would otherwise block on this one
  // holding the old version open forever.
  database.onversionchange = () => {
    database.close();
    if (db === database) db = null;
  };
  return database;
}

/**
 * Open it, creating every store the app needs — including the ones it did not
 * need last time.
 *
 * The store list is passed in rather than imported, so this file holds no
 * opinion about what the app persists and `shape.ts` stays the single place
 * that decides.
 *
 * ## Why this is two opens rather than one
 *
 * Stores can only be made inside `onupgradeneeded`, and that runs only when
 * the version asked for is higher than the version on disk. This asked for a
 * hardcoded version 1 forever, so on a device that already had the database,
 * `onupgradeneeded` had run once and would never run again — and every field
 * added to `shape.ts` afterwards was a collection with no store to live in.
 *
 * That is not a small failure and it is not a loud one. `write` dropped those
 * rows and answered false, so making a sheet or saving an equation on an
 * account created before either existed drew on screen, stayed in memory, put
 * up the "not being saved" banner about a full disk — and was gone on reload,
 * on a device with the disk practically empty. Nothing else was affected,
 * which is what made it look like a storage problem rather than a schema one.
 *
 * So: open at whatever version is on disk, look for what is missing, and if
 * anything is, open once more a version higher to make it. A database that is
 * already complete — every new install, and every returning device after the
 * first load — does the second open never.
 */
export function open(collections: string[]): Promise<IDBDatabase | null> {
  if (db) return Promise.resolve(db);
  if (opening) return opening;
  opening = adopt([MAPS_STORE, SETTINGS_STORE, ...collections]);
  return opening;
}

/**
 * How many times to ask for a higher version before settling for what is
 * there.
 *
 * One is enough for the case this exists for — a database a version behind
 * this build's fields. More than one is for the race: between looking and
 * upgrading, another tab on an older build can take the version this one was
 * about to ask for, and take it with a shorter list of stores. That open then
 * succeeds with no `onupgradeneeded` and the store is still missing, so the
 * answer is to look again rather than to trust the version number. Bounded,
 * because a loop against a database that will not take an upgrade is worse
 * than the missing store.
 */
const UPGRADE_TRIES = 3;

async function adopt(needed: string[]): Promise<IDBDatabase | null> {
  let database = await request(undefined, needed);
  if (!database) return null;

  for (let tries = 0; tries < UPGRADE_TRIES; tries += 1) {
    if (missingFrom(database, needed).length === 0) return keep(database);

    // Closed before asking for the upgrade: this tab's own handle is
    // otherwise the thing blocking it.
    const next = database.version + 1;
    database.close();
    const upgraded = await request(next, needed);
    if (upgraded) {
      database = upgraded;
      continue;
    }

    /*
     * The upgrade did not happen — a browser refusing it, or another tab that
     * never let go. Going back to the database as it is beats going back with
     * nothing: everything that has a store still loads and still saves, and
     * the next load tries the upgrade again. Only what is stored in a missing
     * store is affected, and `write` says so rather than pretending.
     */
    const again = await request(undefined, needed);
    return again ? keep(again) : null;
  }

  // Three rounds and something is still missing. The app runs on what does
  // exist, and the write that has nowhere to land answers false.
  return keep(database);
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
    const wanted = [...new Set(writes.map((w) => w.store))];
    const stores = wanted.filter((s) => db?.objectStoreNames.contains(s));
    /*
     * A store the database does not have is a row that is not being kept, and
     * saying so is the whole of what this file owes the caller. `open` makes
     * every store this build needs, so reaching here means that upgrade could
     * not run — and the rest of the batch is still written, because half an
     * account saved beats none. `false` is about the part that was not.
     */
    const dropped = stores.length < wanted.length;
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
      t.oncomplete = () => resolve(!dropped);
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
