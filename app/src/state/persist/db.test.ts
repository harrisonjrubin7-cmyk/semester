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
 * That held for a throw, for `onerror` and for `onblocked`. It did not hold
 * for a request that fires none of them. Measured in the browser with
 * `indexedDB.open` returning a request that never answers: `#root` empty, 0
 * characters, nothing in the console, on every load. The other three ways all
 * boot and save.
 */

/** An open request that behaves however the test tells it to. */
function stubOpen(behave: (req: Record<string, unknown>) => void): void {
  vi.stubGlobal('indexedDB', {
    open: () => {
      const req: Record<string, unknown> = { result: { objectStoreNames: { contains: () => true } } };
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
