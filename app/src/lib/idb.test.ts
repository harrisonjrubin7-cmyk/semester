import { afterEach, describe, expect, it, vi } from 'vitest';
import { newId, store } from './idb';

/**
 * The one id generator the app has, and the promise it makes.
 *
 * `threads.test.ts` asks for two hundred distinct ids and gets them, which
 * used to be a dice roll: every id in a loop shares a timestamp, so only the
 * noise separated them, and six base36 characters put two hundred draws about
 * one run in a hundred thousand from a collision. It flaked, once, in about a
 * hundred runs — which was the four-character version, before these were
 * unified.
 *
 * The tests below take the dice away. The clock is frozen and the noise is
 * pinned to one value, so anything still distinct is distinct because of the
 * counter and not because it got lucky.
 */

afterEach(() => {
  vi.restoreAllMocks();
});

/** One millisecond, one random value: everything the noise could give. */
function frozen() {
  vi.spyOn(Date, 'now').mockReturnValue(1_800_000_000_000);
  vi.spyOn(Math, 'random').mockReturnValue(0.5);
}

describe('two ids made in the same millisecond', () => {
  it('differ even when the noise is identical', () => {
    frozen();
    expect(newId()).not.toBe(newId());
  });

  it('are all distinct across a whole import, not just usually', () => {
    // The shape of the case that flaked: a loop inside one tick. With the
    // clock and the noise both pinned, a collision here is a certainty rather
    // than a probability — which is the point.
    frozen();
    const ids = new Set(Array.from({ length: 2000 }, () => newId()));
    expect(ids.size).toBe(2000);
  });

  it('are distinct across the prefixes too', () => {
    frozen();
    const ids = new Set([newId('t'), newId('snap-'), newId(), newId('t')]);
    expect(ids.size).toBe(4);
  });
});

describe('what the id is made of', () => {
  it('carries the prefix, and nothing when none is asked for', () => {
    expect(newId('t')).toMatch(/^t/);
    expect(newId('snap-')).toMatch(/^snap-/);
    expect(newId()).toMatch(/^[0-9a-z]/);
  });

  it('keeps the noise at its full six characters', () => {
    // The between-tabs case has no counter to lean on — a backup restored
    // from another device lands with a clock of its own — so the randomness
    // is the only defence there and must not be traded away for the counter.
    frozen();
    const noise = newId().split('-')[1].slice(3);
    expect(noise).toHaveLength(6);
  });

  it('still sorts by when it was made', () => {
    // Time first, so a plain string sort is chronological. The counter sits
    // after the timestamp for the same reason.
    vi.spyOn(Math, 'random').mockReturnValue(0.5);
    vi.spyOn(Date, 'now').mockReturnValue(1_800_000_000_000);
    const early = newId();
    vi.spyOn(Date, 'now').mockReturnValue(1_800_000_060_000);
    const late = newId();
    expect([late, early].sort()).toEqual([early, late]);
  });
});

/**
 * `work`, against an IndexedDB small enough to reason about.
 *
 * jsdom has none, which is precisely how the bug this guards against reached a
 * pull request: `patch` in `files.ts` returned its read request to `tx`, `tx`
 * replaced the `onsuccess` that would have issued the write, and starring or
 * binning a file became a button that did nothing. Every unit test passed,
 * because none of them could reach a database.
 *
 * The double below is not a real IndexedDB — it is the four behaviours the
 * helper depends on: a request resolves asynchronously with a result, handlers
 * set by the caller are honoured, further requests can be issued from inside
 * those handlers, and the transaction completes only once the queue is empty.
 */
function fakeIndexedDB(rows: Record<string, unknown> = {}) {
  const queue: (() => void)[] = [];
  let done: (() => void) | null = null;

  const request = <T,>(get: () => T) => {
    const req: Record<string, unknown> = { result: undefined, error: null };
    queue.push(() => {
      req.result = get();
      (req.onsuccess as (() => void) | undefined)?.();
    });
    return req as unknown as IDBRequest<T>;
  };

  const objectStore = {
    get: (id: string) => request(() => rows[id]),
    put: (row: { id: string }) => request(() => {
      rows[row.id] = row;
      return undefined;
    }),
    delete: (id: string) => request(() => {
      delete rows[id];
      return undefined;
    }),
    getAll: () => request(() => Object.values(rows)),
    clear: () => request(() => {
      for (const k of Object.keys(rows)) delete rows[k];
      return undefined;
    }),
  };

  /** Drain the queue, letting handlers add to it, then complete. */
  const run = () => {
    setTimeout(() => {
      while (queue.length) queue.shift()!();
      done?.();
    }, 0);
  };

  const transaction = {
    objectStore: () => objectStore as unknown as IDBObjectStore,
    set oncomplete(fn: () => void) {
      done = fn;
      run();
    },
    onerror: null,
    onabort: null,
    error: null,
  };

  const db = { transaction: () => transaction, close: () => undefined };
  const open = () => {
    const req: Record<string, unknown> = { result: db };
    setTimeout(() => (req.onsuccess as (() => void) | undefined)?.(), 0);
    return req;
  };
  vi.stubGlobal('indexedDB', { open });
  return rows;
}

describe('a read and a write in one transaction', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('runs the caller’s own success handler', async () => {
    // The whole bug: `tx` overwrote this, so the write inside it never ran.
    fakeIndexedDB({ a: { id: 'a', starred: false } });
    const { work } = store('db', 's');
    let ran = false;
    await work<void>('readwrite', (s, finish) => {
      const read = s.get('a') as IDBRequest<unknown>;
      read.onsuccess = () => {
        ran = true;
        finish(undefined);
      };
    });
    expect(ran).toBe(true);
  });

  it('lets a handler issue a further request, and that request lands', async () => {
    const rows = fakeIndexedDB({ a: { id: 'a', starred: false } });
    const { work } = store('db', 's');
    await work<void>('readwrite', (s, finish) => {
      const read = s.get('a') as IDBRequest<{ id: string; starred: boolean } | undefined>;
      read.onsuccess = () => {
        s.put({ ...read.result!, starred: true });
        finish(undefined);
      };
    });
    expect(rows.a).toEqual({ id: 'a', starred: true });
  });

  it('answers with what the callback decided', async () => {
    fakeIndexedDB({ a: { id: 'a' } });
    const { work } = store('db', 's');
    const found = await work<boolean>('readonly', (s, finish) => {
      const read = s.get('a') as IDBRequest<unknown>;
      read.onsuccess = () => finish(read.result !== undefined);
    });
    expect(found).toBe(true);
  });

  it('does not write when the record has gone', async () => {
    const rows = fakeIndexedDB({});
    const { work } = store('db', 's');
    await work<void>('readwrite', (s, finish) => {
      const read = s.get('missing') as IDBRequest<unknown>;
      read.onsuccess = () => {
        if (read.result === undefined) {
          finish(undefined);
          return;
        }
        s.put({ id: 'missing' });
        finish(undefined);
      };
    });
    expect(rows).toEqual({});
  });
});
