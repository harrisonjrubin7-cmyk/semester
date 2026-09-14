import { describe, expect, it } from 'vitest';
import { SEEN_KEY, SYNCED_KEY, markSeen, seenRows, unseen, type Seen } from './shape';

/**
 * The watermark, and the two ways the old one lost somebody's work.
 *
 * `refresh` asks one question — is there anything in the account this device
 * has not taken? It used to answer it with `remote.updated > syncedAt()`: the
 * newest `updated_at` in the account, against a number the device wrote down.
 * Both halves of that comparison could be wrong, and both fail silently, which
 * is the only kind of sync bug worth being afraid of.
 */

/** A stub store, so a test can say what the browser does. */
function withStorage<T>(
  impl: { getItem?: (k: string) => string | null; setItem?: (k: string, v: string) => void; removeItem?: (k: string) => void },
  run: () => T,
): T {
  const original = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
  Object.defineProperty(globalThis, 'localStorage', {
    value: {
      getItem: impl.getItem ?? (() => null),
      setItem: impl.setItem ?? (() => {}),
      removeItem: impl.removeItem ?? (() => {}),
      clear: () => {},
      key: () => null,
      length: 0,
    },
    configurable: true,
  });
  try {
    return run();
  } finally {
    if (original) Object.defineProperty(globalThis, 'localStorage', original);
    else delete (globalThis as { localStorage?: unknown }).localStorage;
  }
}

/** A store backed by a plain object, for the round trips. */
function holding(seed: Record<string, string> = {}) {
  const store = { ...seed };
  return {
    store,
    getItem: (k: string) => store[k] ?? null,
    setItem: (k: string, v: string) => { store[k] = v; },
    removeItem: (k: string) => { delete store[k]; },
  };
}

/** What a browser with site data blocked does. */
const refusing = {
  getItem: () => {
    throw new DOMException('The operation is insecure.', 'SecurityError');
  },
  setItem: () => {
    throw new DOMException('The quota has been exceeded.', 'QuotaExceededError');
  },
};

const seen = (state: string | undefined, courses: Record<string, string>): Seen => ({
  ...(state ? { state } : {}),
  courses,
});

describe('what counts as unseen', () => {
  it('is nothing when every row is at the stamp last taken', () => {
    const now = seen('2026-09-14T10:00:02Z', { econ: '2026-09-14T10:00:01Z' });
    expect(unseen(now, { ...now, courses: { ...now.courses } })).toBe(false);
  });

  it('is everything for a device that has never synced', () => {
    expect(unseen(seen('2026-09-14T10:00:02Z', {}), null)).toBe(true);
  });

  /*
   * The commit window.
   *
   * `updated_at` is stamped by a `before` trigger, so it is the moment the
   * transaction *started*; the row appears to everyone else when it *commits*.
   * A pull in between reads the account, misses the row, and — under the old
   * rule — wrote down a watermark higher than the stamp that row is carrying.
   * `> watermark` then never matched it again.
   */
  it('takes a row that commits after the pull that should have seen it', () => {
    // The laptop's write began at :00 and is still in flight. The phone's
    // landed at :01, so a pull now sees only the phone's.
    const pulled = seen('2026-09-14T10:00:01Z', { econ: '2026-09-14T10:00:01Z' });
    // …and later the laptop's commits, carrying the older stamp.
    const after = seen('2026-09-14T10:00:01Z', {
      econ: '2026-09-14T10:00:01Z',
      psci: '2026-09-14T10:00:00Z',
    });

    expect(unseen(after, pulled)).toBe(true);

    // What the old rule did with the same two pulls: the newest stamp in the
    // account never moved, so there was nothing to take — for good.
    const newest = (s: Seen) =>
      Math.max(...[s.state, ...Object.values(s.courses)].filter(Boolean).map((x) => Date.parse(x as string)));
    expect(newest(after) > newest(pulled)).toBe(false);
  });

  it('takes a row whose stamp moved backwards, whatever the clock says', () => {
    const before = seen(undefined, { econ: '2026-09-14T10:00:05Z' });
    const after = seen(undefined, { econ: '2026-09-14T10:00:00Z' });
    expect(unseen(after, before)).toBe(true);
  });

  it('notices the state row appearing, changing and going away', () => {
    const none = seen(undefined, {});
    const one = seen('2026-09-14T10:00:00Z', {});
    const later = seen('2026-09-14T10:00:09Z', {});
    expect(unseen(one, none)).toBe(true);
    expect(unseen(later, one)).toBe(true);
    expect(unseen(none, one)).toBe(true);
  });

  it('notices a course that is no longer there', () => {
    const two = seen(undefined, { econ: 'a', psci: 'b' });
    const one = seen(undefined, { econ: 'a' });
    expect(unseen(one, two)).toBe(true);
  });
});

describe('remembering what was taken', () => {
  it('round-trips the stamps as the database wrote them', () => {
    const io = holding();
    const mine = seen('2026-09-14T10:00:02.123456Z', { econ: '2026-09-14T10:00:01Z' });
    withStorage(io, () => markSeen(mine));
    expect(withStorage(io, seenRows)).toEqual(mine);
  });

  it('is null before anything has ever been taken, which is how a first sign-in is known', () => {
    expect(withStorage(holding(), seenRows)).toBeNull();
  });

  /*
   * A device that synced under the old number has synced, and must not be
   * asked "this device or the account?" all over again — that dialogue is for
   * a first sign-in, and a null answer here is how `refresh` recognises one.
   */
  it('treats the old watermark as having synced, holding nothing', () => {
    const got = withStorage(holding({ [SYNCED_KEY]: '1757808000000' }), seenRows);
    expect(got).not.toBeNull();
    expect(got).toEqual({ courses: {} });
    // Holding nothing means the first refresh after this ships takes once.
    expect(unseen(seen('2026-09-14T10:00:00Z', {}), got)).toBe(true);
  });

  it('drops the old watermark once its replacement is written', () => {
    const io = holding({ [SYNCED_KEY]: '1757808000000' });
    withStorage(io, () => markSeen(seen(undefined, { econ: 'a' })));
    expect(io.store[SYNCED_KEY]).toBeUndefined();
    expect(io.store[SEEN_KEY]).toBeDefined();
  });

  it('survives a store holding something that is not a stamp set', () => {
    for (const raw of ['null', '"nope"', '[]', '{"courses":"nope"}', '{"courses":{"econ":7}}', 'not json']) {
      const got = withStorage(holding({ [SEEN_KEY]: raw }), seenRows);
      expect(got === null || typeof got.courses === 'object', raw).toBe(true);
      if (got) expect(Object.values(got.courses).every((v) => typeof v === 'string'), raw).toBe(true);
    }
  });

  // Every other read and write of storage in this app is wrapped; these are
  // two of the four that were not. `markSeen` is called from a React event
  // handler with no `try` around it, where a throw left the first-sign-in
  // dialogue on screen with both buttons dead.
  it('is null rather than a throw when the browser refuses to be read', () => {
    expect(withStorage(refusing, seenRows)).toBeNull();
  });

  it('does not throw when the browser refuses to store it', () => {
    expect(() => withStorage(refusing, () => markSeen(seen(undefined, {})))).not.toThrow();
  });
});
