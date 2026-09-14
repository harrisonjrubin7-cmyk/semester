import { describe, expect, it } from 'vitest';
import { SYNCED_KEY, markSynced, syncedAt } from './shape';

/**
 * The sync watermark, against a browser that will not store it.
 *
 * `localStorage.setItem` is not a call that always works. Safari's private
 * windows throw on it, and so does any browser with site data blocked for the
 * origin. The four writes of this key were the app's only unguarded ones, and
 * the worst of them sat inside `settle` — the first-sign-in dialogue — where a
 * throw skipped `setAsking(null)` and left a modal on screen with two dead
 * buttons and no explanation.
 */
function withStorage<T>(
  impl: { getItem?: (k: string) => string | null; setItem?: (k: string, v: string) => void },
  run: () => T,
): T {
  const original = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
  Object.defineProperty(globalThis, 'localStorage', {
    value: {
      getItem: impl.getItem ?? (() => null),
      setItem: impl.setItem ?? (() => {}),
      removeItem: () => {},
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

/** What a browser with site data blocked does. */
function refusing() {
  return {
    getItem: () => {
      throw new DOMException('The operation is insecure.', 'SecurityError');
    },
    setItem: () => {
      throw new DOMException('The quota has been exceeded.', 'QuotaExceededError');
    },
  };
}

describe('syncedAt', () => {
  it('reads the stamp a previous sync left', () => {
    const at = withStorage({ getItem: (k) => (k === SYNCED_KEY ? '1757808000000' : null) }, syncedAt);
    expect(at).toBe(1757808000000);
  });

  it('is zero when nothing has synced, so the next sign-in is treated as a first one', () => {
    expect(withStorage({}, syncedAt)).toBe(0);
  });

  it('is zero rather than NaN when storage holds something that is not a number', () => {
    expect(withStorage({ getItem: () => 'not a time' }, syncedAt)).toBe(0);
  });

  it('is zero rather than a throw when the browser refuses to be read', () => {
    expect(withStorage(refusing(), syncedAt)).toBe(0);
  });
});

describe('markSynced', () => {
  it('writes the stamp', () => {
    const written: Record<string, string> = {};
    withStorage({ setItem: (k, v) => { written[k] = v; } }, () => markSynced(1757808000000));
    expect(written[SYNCED_KEY]).toBe('1757808000000');
  });

  // The bug: this threw out of a React event handler and froze the
  // first-sign-in dialogue, and threw inside `refresh` to report a successful
  // pull as a sync error.
  it('does not throw when the browser refuses to store it', () => {
    expect(() => withStorage(refusing(), () => markSynced(Date.now()))).not.toThrow();
  });
});
