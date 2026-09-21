// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import type { Session } from '@supabase/supabase-js';

/**
 * The token and the account have to have the same lifetime.
 *
 * `StoreProvider` holds the account in `useState`, so it goes when the
 * provider goes. The token is a module-level variable in `lib/token.ts`, so
 * it does not: before this, the effect's cleanup dropped the subscription and
 * the idle handle and left the token set. A provider mounting after that
 * started with `account` null and a token still in hand.
 *
 * That is the inverse of the state `lib/assistant.ts` has a paragraph about —
 * there it is an account with no token, here a token with no account — and it
 * is worth closing for the same reason: the two are only safe to reason about
 * together if they begin and end together.
 *
 * ## Why this mounts rather than reads the source
 *
 * `src/rootunmount.test.ts` next door is structural, and says in its own
 * header what that cannot see. Here the question is not whether a line exists
 * but whether the cleanup actually runs and reaches the module — a
 * `setSessionToken(null)` sitting in a cleanup that React never calls, or
 * written after an early return, would read correctly and do nothing. So this
 * mounts the real provider, lets the real effect set a real token, unmounts,
 * and asks `lib/token.ts` what it is holding.
 */

const session = {
  user: { id: 'u1', email: 'a@b.c', app_metadata: { provider: 'email' } },
  access_token: 'tok-abc',
} as unknown as Session;

vi.mock('../lib/cloud', () => ({
  cloudConfigured: true,
  // The real shape: an account is made from the user and never looks at the token.
  accountOf: (s: Session | null) =>
    s?.user ? { id: s.user.id, email: s.user.email ?? '', via: 'email' } : null,
  currentSession: async () => session,
  onAuthChange: () => () => {},
  explainSyncError: (e: unknown) => String(e),
  pull: async () => null,
  push: async () => {},
}));

const { StoreProvider } = await import('./store');
const { sessionToken, setSessionToken } = await import('../lib/token');
const { loadSeed } = await import('../data/seed');

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let host: HTMLDivElement;
let root: Root;
/**
 * Whether the tree is still up, because this file takes it down mid-test.
 *
 * The unmount IS the thing under test, so it happens in the test body rather
 * than a hook. That is exactly the shape `src/rootunmount.test.ts` exists to
 * catch: an assertion failing before that line would end the file with a root
 * still mounted, and the `ReferenceError: window is not defined` it produces
 * gets reported against whatever file runs next. So the hook below takes it
 * down too, and this flag is what stops it unmounting twice.
 */
let mounted = false;

/**
 * The seed, awaited rather than raced — `softtop.test.tsx`'s reason verbatim.
 *
 * `StoreProvider` starts `loadSeed()` on mount and it dynamically imports four
 * course modules. Left to finish on its own it outlives this file's
 * environment and vitest ends the run with `EnvironmentTeardownError`s.
 */
async function settle() {
  await loadSeed().catch(() => []);
  // Long enough for the deferral, not a guess: the effect does not run on
  // mount. It waits for `requestIdleCallback`, which jsdom does not have, so
  // it takes the `setTimeout(start, 400)` fallback. A shorter wait here left
  // the token unset and the assertion below vacuous, which is how this number
  // was arrived at rather than chosen.
  await act(async () => {
    await new Promise((r) => setTimeout(r, 600));
  });
}

beforeEach(() => {
  history.replaceState(null, '', '/');
  localStorage.clear();
  setSessionToken(null);
  host = document.createElement('div');
  document.body.append(host);
  act(() => {
    root = createRoot(host);
  });
  mounted = true;
});

afterEach(() => {
  if (mounted) act(() => root.unmount());
  mounted = false;
  setSessionToken(null);
  host.remove();
});

describe('the token does not outlive the provider that set it', () => {
  it('clears the session token when the store unmounts', async () => {
    act(() => {
      root.render(<StoreProvider>{null}</StoreProvider>);
    });
    await settle();

    // The effect is deferred behind requestIdleCallback, so this is the part
    // that would silently make the test vacuous: if the token were never set,
    // asserting it is null after unmount would pass against any cleanup at all.
    expect(sessionToken(), 'the effect never set a token; this guard is vacuous').toBe('tok-abc');

    act(() => root.unmount());
    mounted = false;

    expect(sessionToken()).toBeNull();
  });

  /*
   * The control. Every assertion above is about a value becoming null, and a
   * `sessionToken()` that returned null unconditionally would satisfy them —
   * so this is the one that says the getter reports what was set.
   */
  it('CONTROL: reports a token that is set and not cleared', () => {
    setSessionToken('tok-xyz');
    expect(sessionToken()).toBe('tok-xyz');
  });
});
