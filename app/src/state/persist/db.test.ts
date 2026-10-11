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

    await vi.advanceTimersByTimeAsync(2_500);
    expect(settled, 'still waiting before the limit').toBe(false);

    await vi.advanceTimersByTimeAsync(750);
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
    await vi.advanceTimersByTimeAsync(3_250);
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
  /**
   * Transactions still to leave in neither the complete nor the error state,
   * which is the Mobile WebKit stall `TRANSACTION_LIMIT_MS` exists for. Zero
   * is a browser that answers.
   */
  const knob = { stall: 0, aborted: 0, holdCompletion: 0, commit: null as null | (() => void) };

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
      const changes: (() => void)[] = [];
      let aborted = false;
      let finished = false;
      const commit = () => {
        if (aborted || finished) return;
        for (const change of changes) change();
        finished = true;
      };
      const complete = () => {
        commit();
        if (!aborted) (t.oncomplete as (() => void) | undefined)?.();
      };
      const t: Record<string, unknown> = {
        objectStore: (name: string) => {
          const store = rows.get(name) ?? new Map<string, unknown>();
          rows.set(name, store);
          return {
            put: (value: unknown, key: string) => changes.push(() => store.set(key, value)),
            delete: (key: string) => changes.push(() => store.delete(key)),
            // Answered on `oncomplete`, the way the real requests are read.
            getAllKeys: () => ({ get result() { return [...store.keys()]; } }),
            getAll: () => ({ get result() { return [...store.values()]; } }),
          };
        },
        abort: () => {
          if (finished) throw new DOMException('already committed', 'InvalidStateError');
          aborted = true;
          knob.aborted += 1;
          setTimeout(() => (t.onabort as (() => void) | undefined)?.(), 0);
        },
      };
      if (knob.stall > 0) {
        knob.stall -= 1;
        return t;
      }
      if (knob.holdCompletion > 0) {
        knob.holdCompletion -= 1;
        knob.commit = () => {
          commit();
          setTimeout(complete, 0);
        };
        return t;
      }
      setTimeout(complete, 0);
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

  return { state, rows, opens, held: () => held, knob };
}

/*
 * A transaction that never settles.
 *
 * Mobile WebKit can open the database and then leave a transaction in
 * neither the complete nor the error state, most often after restoring the
 * app from suspension. `main.tsx` awaits the first read before mounting, so
 * this used to be an empty window for as long as the tab lived. Now the
 * read answers at the limit — and what it answers is the whole point: `null`,
 * not `[]`. The first version answered `[]`, `load` read that as an empty
 * store and migrated the localStorage account onto a handle this had just
 * dropped, and a returning student was handed a fresh account (Codex on
 * #954). Two figures are pinned: the answer, and the handle let go.
 */
/** The fake answers on a timer, so every promise it owes is advanced to. */
const settled = async <T,>(waiting: Promise<T>, ms = 10): Promise<T> => {
  await vi.advanceTimersByTimeAsync(ms);
  return waiting;
};

describe('a transaction that never settles', () => {
  it('reads as "did not answer", not as an empty store, and lets go of the handle', async () => {
    const fake = fakeIndexedDB({ version: 1, stores: ['maps', 'settings', 'courses'] });
    const { open, readAll, write, held } = await fresh();
    await settled(open(['courses']));
    expect(held(), 'the handle is held after a good open').toBe(true);

    fake.knob.stall = 1;
    const waiting = readAll('settings');
    let done = false;
    void waiting.then(() => (done = true));
    await vi.advanceTimersByTimeAsync(1_000);
    expect(done, 'still waiting before the limit').toBe(false);

    await vi.advanceTimersByTimeAsync(600);
    expect(await waiting, 'a stall is not an empty store').toBeNull();
    expect(fake.knob.aborted, 'the transaction is aborted rather than left running').toBe(1);
    expect(held(), 'a handle that stopped answering is not kept').toBe(false);
    expect(fake.held(), 'and was closed rather than dropped').toBe(0);

    // And a later write does not pretend to have landed.
    expect(await settled(write([{ store: 'settings', key: 'k', value: 1 }]))).toBe(false);
  });

  it('a stalled write answers false and lets go the same way', async () => {
    const fake = fakeIndexedDB({ version: 1, stores: ['maps', 'settings', 'courses'] });
    const { open, write, held } = await fresh();
    await settled(open(['courses']));

    fake.knob.stall = 1;
    const waiting = write([{ store: 'settings', key: 'nav', value: 'tabs' }]);
    await vi.advanceTimersByTimeAsync(1_600);
    expect(await waiting).toBe(false);
    expect(held()).toBe(false);
    expect(fake.held()).toBe(0);
  });

  // The control: a browser that answers is read as before, and keeps its
  // handle. Without this the two above could pass against a `readAll` that
  // answers null to everything.
  it('a transaction that completes still answers its rows, and the handle stays', async () => {
    const fake = fakeIndexedDB({ version: 1, stores: ['maps', 'settings', 'courses'] });
    const { open, readAll, write, isEmpty, held } = await fresh();
    await settled(open(['courses']));

    expect(await settled(isEmpty())).toBe(true);
    expect(await settled(write([{ store: 'settings', key: 'nav', value: 'tabs' }]))).toBe(true);
    expect(await settled(readAll('settings'))).toEqual([['nav', 'tabs']]);
    expect(await settled(isEmpty())).toBe(false);
    expect(held()).toBe(true);
    expect(fake.knob.aborted).toBe(0);
  });
});

describe('an abort requested after IndexedDB committed', () => {
  it('reports the commit so the persistence layer can roll its journal back', async () => {
    const fake = fakeIndexedDB({ version: 1, stores: ['maps', 'settings', 'courses'] });
    const { open, write } = await fresh();
    await settled(open(['courses']));
    fake.knob.holdCompletion = 1;
    const controller = new AbortController();
    const saving = write(
      [{ store: 'settings', key: 'account-row', value: 'account-a' }],
      controller.signal,
    );

    fake.knob.commit?.();
    controller.abort();
    await vi.advanceTimersByTimeAsync(10);

    expect(await saving).toBe(true);
    expect(fake.rows.get('settings')?.get('account-row')).toBe('account-a');
    expect(fake.knob.aborted, 'a finished transaction cannot be reported as aborted').toBe(0);
  });
});

describe('a committed remote snapshot interrupted before acknowledgement', () => {
  it('restores the previous authored rows from the durable journal on restart', async () => {
    const { COLLECTIONS } = await import('./shape');
    const { DEFAULT_PERSISTED } = await import('../shape');
    const fake = fakeIndexedDB({
      version: 1,
      stores: ['maps', 'settings', ...COLLECTIONS],
    });
    let db = await fresh();
    await settled(db.open(COLLECTIONS as string[]));
    const local = {
      id: 'local-task', title: 'Authored locally', date: null, time: '',
      note: '', courseId: null, done: false, created: 1,
    };
    const accountA = {
      id: 'a-task', title: 'Account A', date: null, time: '',
      note: '', courseId: null, done: false, created: 2,
    };
    expect(await settled(db.write([
      { store: 'tasks', key: local.id, value: local },
      {
        store: 'settings',
        key: 'schemaVersion',
        value: DEFAULT_PERSISTED.schemaVersion,
      },
    ]))).toBe(true);
    expect(await settled(db.write([
      { store: 'tasks', key: local.id, value: null },
      { store: 'tasks', key: accountA.id, value: accountA },
      {
        store: 'settings',
        key: 'remoteWriteRollback',
        value: [
          { store: 'tasks', key: accountA.id, value: null },
          { store: 'tasks', key: local.id, value: local },
        ],
      },
    ]))).toBe(true);

    vi.resetModules();
    const persistence = await import('./index');
    const loading = persistence.load();
    for (let turn = 0; turn < 50; turn += 1) {
      await vi.advanceTimersByTimeAsync(10);
    }
    const restored = await loading;

    expect(restored?.tasks.map((task) => task.id)).toContain(local.id);
    expect(restored?.tasks.map((task) => task.id)).not.toContain(accountA.id);
    db = await import('./db');
    expect(await settled(db.readAll('settings'))).not.toContainEqual([
      'remoteWriteRollback',
      expect.anything(),
    ]);
    expect(fake.rows.get('tasks')?.has(accountA.id)).toBe(false);
  });
});

describe('an unsafe rollback journal', () => {
  it('blocks activation instead of opening a writable fallback copy', async () => {
    const { COLLECTIONS } = await import('./shape');
    const fake = fakeIndexedDB({
      version: 1,
      stores: ['maps', 'settings', ...COLLECTIONS],
    });
    const db = await fresh();
    await settled(db.open(COLLECTIONS as string[]));
    expect(await settled(db.write([
      { store: 'settings', key: 'remoteWriteRollback', value: { malformed: true } },
    ]))).toBe(true);

    vi.resetModules();
    const persistence = await import('./index');
    const loading = persistence.load();
    // Attach the rejection observer before advancing the fake transaction.
    // Otherwise the expected failure is briefly unhandled and Vitest reports
    // it after this test has already completed.
    const blocked = expect(loading).rejects.toBeInstanceOf(persistence.OfflineRecoveryRequired);
    for (let turn = 0; turn < 20; turn += 1) {
      await vi.advanceTimersByTimeAsync(10);
    }

    await blocked;
    expect(fake.rows.get('settings')?.has('remoteWriteRollback')).toBe(true);
  });
});

describe('an account-scoped write that loses ownership', () => {
  it('aborts atomically before any row becomes visible', async () => {
    const fake = fakeIndexedDB({ version: 1, stores: ['maps', 'settings', 'courses'] });
    const { open, write } = await fresh();
    await settled(open(['courses']));
    const controller = new AbortController();
    const abortable = write as unknown as (
      writes: { store: string; key: string; value: unknown }[],
      signal: AbortSignal,
    ) => Promise<boolean>;

    const saving = abortable(
      [{ store: 'settings', key: 'account-row', value: 'account-a' }],
      controller.signal,
    );
    controller.abort();
    await vi.advanceTimersByTimeAsync(10);

    expect(await saving).toBe(false);
    expect(fake.rows.get('settings')?.has('account-row')).toBe(false);
    expect(fake.knob.aborted).toBe(1);
  });
});

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
  it('refuses the whole batch before deleting a rollback journal', async () => {
    // A database whose upgrade was blocked must not partially restore the
    // stores it still has and then remove the only durable retry identity.
    // The next boot needs the journal intact so it can hold safely and retry.
    const fake = fakeIndexedDB({ version: 1, stores: ['maps', 'settings', 'courses'] });
    const { open, write } = await fresh();
    const waiting = open(['courses']);
    await vi.advanceTimersByTimeAsync(10);
    await waiting;
    fake.rows.set('settings', new Map([['remoteWriteRollback', [
      { store: 'courses', key: 'c1', value: null },
      { store: 'sheets', key: 's1', value: null },
    ]]]));

    const saving = write([
      { store: 'courses', key: 'c1', value: { id: 'c1' } },
      { store: 'sheets', key: 's1', value: { id: 's1' } },
      { store: 'settings', key: 'remoteWriteRollback', value: null },
    ]);
    await vi.advanceTimersByTimeAsync(10);

    expect(await saving, 'an incomplete schema cannot commit any requested row').toBe(false);
    expect(fake.rows.get('courses')?.has('c1') ?? false, 'no partial inverse row landed').toBe(false);
    expect(fake.rows.get('settings')?.has('remoteWriteRollback'), 'restart can retry').toBe(true);
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
