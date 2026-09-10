import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * Opening the database, and the way it can fail to fail.
 *
 * `main.tsx` waits on `open()` before anything mounts. It has to: the account
 * lives in the database, IndexedDB cannot answer synchronously, and rendering
 * against a half-loaded store would send somebody who has used the app for a
 * month back through onboarding. The comment there states the contract —
 * *"a device that will not open a database gets null, and the app falls
 * straight back to the localStorage path"*.
 *
 * That held for a throw and for `onerror`. It did not hold for a request that
 * fires neither. Measured in the browser with `indexedDB.open` returning a
 * request that never answers: `#root` empty, 0 characters, nothing in the
 * console, on every load. The other two ways both boot and save.
 *
 * And below that, the schema: a store this build needs that the database on
 * the device does not have. That is what a collection added to `shape.ts`
 * after somebody's database was built looks like, and until `open` went
 * looking for it, the answer was for ever — the version asked for was a
 * hardcoded 1, so `onupgradeneeded` never ran a second time.
 */

/** An open request that behaves however the test tells it to. */
function stubOpen(behave: (req: Record<string, unknown>) => void): void {
  vi.stubGlobal('indexedDB', {
    open: () => {
      // A database with everything in it, so `open` has nothing to upgrade —
      // `close` included, because the real one always has one and a double
      // that does not gives a passing test a way to be wrong.
      const req: Record<string, unknown> = {
        result: { version: 1, objectStoreNames: { contains: () => true }, close: () => {} },
      };
      behave(req);
      return req;
    },
  });
}

const fresh = async () => {
  vi.resetModules();
  return import('./db');
};

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('open', () => {
  it('answers with the database when the request succeeds', async () => {
    stubOpen((req) => {
      setTimeout(() => (req.onsuccess as () => void)?.(), 0);
    });
    const { open } = await fresh();
    const waiting = open([]);
    await vi.advanceTimersByTimeAsync(1);
    expect(await waiting).not.toBeNull();
  });

  it('answers null when the request errors', async () => {
    stubOpen((req) => {
      setTimeout(() => (req.onerror as () => void)?.(), 0);
    });
    const { open } = await fresh();
    const waiting = open([]);
    await vi.advanceTimersByTimeAsync(1);
    expect(await waiting).toBeNull();
  });

  it('answers null when opening throws outright', async () => {
    vi.stubGlobal('indexedDB', {
      open: () => {
        throw new DOMException('no', 'InvalidStateError');
      },
    });
    const { open } = await fresh();
    expect(await open([])).toBeNull();
  });

  it('answers null when the request never answers at all', async () => {
    // The case that had no answer, and so gave none: a blank page, for ever.
    stubOpen(() => {});
    const { open } = await fresh();
    const waiting = open([]);
    let settled = false;
    void waiting.then(() => (settled = true));

    await vi.advanceTimersByTimeAsync(9_000);
    expect(settled, 'still waiting before the limit').toBe(false);

    await vi.advanceTimersByTimeAsync(1_500);
    expect(await waiting).toBeNull();
  });

  it('does not let a late answer take back the one already given', async () => {
    // A request that wakes up on the twentieth second finds the app already
    // running on the other path. Answering twice would be worse than late.
    let late: (() => void) | undefined;
    stubOpen((req) => {
      late = () => (req.onsuccess as () => void)?.();
    });
    const { open } = await fresh();
    const waiting = open([]);
    await vi.advanceTimersByTimeAsync(11_000);
    expect(await waiting).toBeNull();
    late?.();
    expect(await waiting).toBeNull();
  });

  it('waits no longer than it has to when the answer comes at once', async () => {
    stubOpen((req) => {
      (req.onsuccess as (() => void) | undefined)?.();
      setTimeout(() => (req.onsuccess as () => void)?.(), 0);
    });
    const { open } = await fresh();
    const waiting = open([]);
    await vi.advanceTimersByTimeAsync(1);
    // Nothing left pending: the timer was cleared rather than left to fire.
    expect(await waiting).not.toBeNull();
    expect(vi.getTimerCount()).toBe(0);
  });
});


/**
 * A database that remembers its version and its stores, the way a device does.
 *
 * Enough of IndexedDB to answer the only question these tests ask: after
 * `open`, does the store exist? The stub above cannot — it says every store
 * is present, which is the case that never had a bug.
 */
function fakeIndexedDB(
  start: { version: number; stores: string[] },
  /**
   * Another tab, on an older build, taking the version this one was about to
   * ask for — and taking it with a shorter list of stores. Set to a count of
   * versioned opens to steal.
   */
  stolen = 0,
) {
  const state = { version: start.version, stores: new Set(start.stores) };
  const rows = new Map<string, Map<string, unknown>>();
  const opens: (number | undefined)[] = [];
  let held = 0;

  const database = {
    get version() {
      return state.version;
    },
    objectStoreNames: { contains: (name: string) => state.stores.has(name) },
    createObjectStore: (name: string) => {
      state.stores.add(name);
      return {};
    },
    close: () => {
      held -= 1;
    },
    onversionchange: null as unknown,
    transaction: (names: string | string[], _mode?: string) => {
      const wanted = typeof names === 'string' ? [names] : names;
      for (const name of wanted) {
        if (!state.stores.has(name)) throw new DOMException('no such store', 'NotFoundError');
      }
      const t: Record<string, unknown> = {
        objectStore: (name: string) => {
          const store = rows.get(name) ?? new Map<string, unknown>();
          rows.set(name, store);
          return {
            put: (value: unknown, key: string) => store.set(key, value),
            delete: (key: string) => store.delete(key),
          };
        },
      };
      setTimeout(() => (t.oncomplete as (() => void) | undefined)?.(), 0);
      return t;
    },
  };

  vi.stubGlobal('indexedDB', {
    open: (_name: string, version?: number) => {
      opens.push(version);
      held += 1;
      const req: Record<string, unknown> = { result: database };
      setTimeout(() => {
        if (version !== undefined && stolen > 0) {
          // The other tab got there first, so this open finds the version it
          // asked for already on disk — and no `onupgradeneeded` with it.
          stolen -= 1;
          state.version = version;
        }
        // No version asked for means "whatever is on disk", and on a device
        // that has never had one that is a new database at version 1.
        const asked = version ?? (state.version === 0 ? 1 : state.version);
        if (asked > state.version) {
          state.version = asked;
          (req.onupgradeneeded as (() => void) | undefined)?.();
        }
        (req.onsuccess as (() => void) | undefined)?.();
      }, 0);
      return req;
    },
  });

  return { state, rows, opens, held: () => held };
}

describe('a store this build needs that the database has never had', () => {
  it('makes it, by opening once more a version higher', async () => {
    // The account of somebody who has used the app since before Sheets: the
    // database is at version 1 with the stores that existed then.
    const fake = fakeIndexedDB({ version: 1, stores: ['maps', 'settings', 'courses', 'notes'] });
    const { open } = await fresh();

    const waiting = open(['courses', 'notes', 'sheets', 'equations']);
    await vi.advanceTimersByTimeAsync(10);
    expect(await waiting).not.toBeNull();

    expect(fake.state.stores.has('sheets'), 'the store a sheet is saved in').toBe(true);
    expect(fake.state.stores.has('equations')).toBe(true);
    expect(fake.state.version, 'a version higher than what was on disk').toBe(2);
    expect(fake.opens, 'once to look, once to upgrade').toEqual([undefined, 2]);
  });

  it('saves into it once it is there — the write that used to be refused', async () => {
    const fake = fakeIndexedDB({ version: 1, stores: ['maps', 'settings', 'courses'] });
    const { open, write } = await fresh();

    const waiting = open(['courses', 'sheets']);
    await vi.advanceTimersByTimeAsync(10);
    await waiting;

    const saving = write([{ store: 'sheets', key: 's1', value: { id: 's1' } }]);
    await vi.advanceTimersByTimeAsync(10);
    // Before this, `write` filtered the missing store out, found nothing left
    // to do and answered false — which is the "not being saved" banner, on a
    // device with an empty disk.
    expect(await saving).toBe(true);
    expect(fake.rows.get('sheets')?.get('s1')).toEqual({ id: 's1' });
  });

  it('opens once when the database already has everything', async () => {
    const fake = fakeIndexedDB({ version: 1, stores: ['maps', 'settings', 'courses'] });
    const { open } = await fresh();

    const waiting = open(['courses']);
    await vi.advanceTimersByTimeAsync(10);
    expect(await waiting).not.toBeNull();
    expect(fake.opens).toEqual([undefined]);
    expect(fake.state.version, 'nothing to upgrade, so no upgrade').toBe(1);
  });

  it('creates every store on a device that has never had the database', async () => {
    const fake = fakeIndexedDB({ version: 0, stores: [] });
    const { open } = await fresh();

    const waiting = open(['courses', 'sheets']);
    await vi.advanceTimersByTimeAsync(10);
    expect(await waiting).not.toBeNull();
    expect([...fake.state.stores].sort()).toEqual(['courses', 'maps', 'settings', 'sheets']);
    expect(fake.opens, 'one open: the first one makes them all').toEqual([undefined]);
  });
});

describe('a write with nowhere to land says so', () => {
  it('answers false rather than reporting a row it dropped as saved', async () => {
    // The upgrade could not run — another tab holding the old version, or a
    // browser refusing it. The rest of the batch is still written; the answer
    // is about the part that was not.
    const fake = fakeIndexedDB({ version: 1, stores: ['maps', 'settings', 'courses'] });
    const { open, write } = await fresh();
    const waiting = open(['courses']);
    await vi.advanceTimersByTimeAsync(10);
    await waiting;

    const saving = write([
      { store: 'courses', key: 'c1', value: { id: 'c1' } },
      { store: 'sheets', key: 's1', value: { id: 's1' } },
    ]);
    await vi.advanceTimersByTimeAsync(10);
    expect(await saving, 'a sheet with no store is a sheet not saved').toBe(false);
    expect(fake.rows.get('courses')?.get('c1'), 'and the rest still landed').toEqual({ id: 'c1' });
  });
});

describe('the two ways a careful open still gets it wrong', () => {
  it('closes a success that arrives after it stopped waiting', async () => {
    // Ten seconds late, the answer already given, and the app on the
    // localStorage path — but the connection is real, and an open connection
    // is what blocks the next upgrade. Which is now how a store gets made.
    let late: (() => void) | undefined;
    let closed = 0;
    vi.stubGlobal('indexedDB', {
      open: () => {
        const req: Record<string, unknown> = {
          result: {
            version: 1,
            objectStoreNames: { contains: () => true },
            close: () => {
              closed += 1;
            },
          },
        };
        late = () => (req.onsuccess as (() => void) | undefined)?.();
        return req;
      },
    });
    const { open } = await fresh();

    const waiting = open([]);
    await vi.advanceTimersByTimeAsync(11_000);
    expect(await waiting).toBeNull();

    late?.();
    expect(closed, 'the handle nobody is going to use').toBe(1);
    expect(await waiting, 'and the answer still stands').toBeNull();
  });

  it('looks again when another tab takes the version first', async () => {
    // Between looking and upgrading, a tab on an older build claims version 2
    // — with its own shorter list of stores. The open at 2 then succeeds with
    // no upgrade at all, and trusting the version number would leave this tab
    // writing sheets into a store that is not there.
    const fake = fakeIndexedDB({ version: 1, stores: ['maps', 'settings', 'courses'] }, 1);
    const { open } = await fresh();

    const waiting = open(['courses', 'sheets']);
    await vi.advanceTimersByTimeAsync(30);
    expect(await waiting).not.toBeNull();

    expect(fake.state.stores.has('sheets')).toBe(true);
    expect(fake.opens, 'looked, was beaten to 2, asked for 3').toEqual([undefined, 2, 3]);
  });

  it('gives up asking after three rounds rather than looping', async () => {
    // A database that takes every version and makes nothing. The app runs on
    // the stores that do exist; `write` is what says the rest is not saved.
    const fake = fakeIndexedDB({ version: 1, stores: ['maps', 'settings', 'courses'] }, 99);
    const { open } = await fresh();

    const waiting = open(['courses', 'sheets']);
    await vi.advanceTimersByTimeAsync(60);
    expect(await waiting, 'still a database, still usable').not.toBeNull();
    expect(fake.opens.length, 'one look and three tries, then it stops').toBe(4);
  });
});
