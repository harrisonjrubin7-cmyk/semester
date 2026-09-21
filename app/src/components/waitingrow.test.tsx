// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import type { Session } from '@supabase/supabase-js';
import type { Message } from '../lib/classmates';

/**
 * The row is only worth anything if it reaches the screen.
 *
 * `lib/waiting.test.ts` proves the arithmetic — what counts, what is muted
 * out, what the sentence says — across twenty-five cases and six reverts. None
 * of that is evidence that a student ever sees it. The failure this component
 * exists to fix is a *silent* one: the unread counts were already correct and
 * already unreachable, so a second correct calculation that renders nothing
 * would be the same bug with more code in it.
 *
 * So this mounts the real component against a real store and reads the real
 * DOM.
 *
 * ## What is faked, and why only this much
 *
 * Two modules, both through `importOriginal`, so everything not named here
 * stays real — `roomsFor`, `roomKey`, `codeOf`, `termOf`, `listed`, `unread`,
 * `bucket` and the whole of `lib/waiting.ts` are the shipping code.
 *
 *   - `lib/cloud`, because there is no Supabase project behind a test and
 *     `cloudConfigured` is false without one, which would make every
 *     assertion below vacuously green by closing the first gate.
 *   - `myProfile`, `myRooms` and `across` on `lib/classmates`, because those
 *     are the three queries. `eligible` is faked too: it reads the school's
 *     domain list, and a test about whether a row appears should not fail
 *     when somebody edits a list of email domains.
 *
 * The sentence asserted below is the one the real `waitingLine` builds from
 * the real message rows, so this fails if the wiring is wrong, if the gate
 * never opens, or if the copy moves.
 */

const session = {
  user: { id: 'me', email: 'a@vanderbilt.edu', app_metadata: { provider: 'email' } },
  access_token: 'tok',
} as unknown as Session;

/** Reassigned per test, read by the mock when the store asks. */
let signedIn: Session | null = session;

vi.mock('../lib/cloud', () => ({
  cloudConfigured: true,
  accountOf: (s: Session | null) =>
    s?.user ? { id: s.user.id, email: s.user.email ?? '', via: 'email' } : null,
  currentSession: async () => signedIn,
  onAuthChange: () => () => {},
  explainSyncError: (e: unknown) => String(e),
  // `store.tsx` calls this one now: it hands the error object over whole, so
  // PostgREST's `code` survives to reach `classify`. See `lib/failure.ts`.
  explainSync: (e: unknown) => ({ said: String(e), code: 'INTERNAL_ERROR', ref: 'SEM-TEST' }),
  pull: async () => null,
  push: async () => {},
}));

/** Reassigned per test; what the three queries answer. */
let joined: string[] = [];
let said: Message[] = [];

vi.mock('../lib/classmates', async (original) => ({
  ...(await original<typeof import('../lib/classmates')>()),
  eligible: () => true,
  myProfile: async () => ({ handle: 'harrison' }),
  myRooms: async () => joined,
  across: async () => said,
}));

const { StoreProvider } = await import('../state/store');
const { Waiting } = await import('./Waiting');
const { loadSeed } = await import('../data/seed');

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const ROOM = 'vanderbilt/ECON 1020';

function from(who: string, body: string, minutesAgo = 5): Message {
  return {
    id: `${who}-${body.slice(0, 6)}-${minutesAgo}`,
    term: '2026FA',
    code: ROOM,
    user_id: who,
    body,
    created_at: new Date(Date.now() - minutesAgo * 60_000).toISOString(),
  } as Message;
}

let host: HTMLDivElement;
let root: Root;

beforeEach(() => {
  history.replaceState(null, '', '/');
  localStorage.clear();
  signedIn = session;
  joined = [];
  said = [];
  // jsdom has neither, and `screens/Today.tsx` reaches for both. Stubbed here
  // rather than in the one test that mounts it, because the cost is nil and a
  // second Today test would otherwise rediscover this.
  window.matchMedia = (() => ({
    matches: false,
    addEventListener: () => {},
    removeEventListener: () => {},
  })) as unknown as typeof window.matchMedia;
  (globalThis as { ResizeObserver?: unknown }).ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
  host = document.createElement('div');
  document.body.append(host);
});

afterEach(async () => {
  // The root comes down here rather than being left to the environment —
  // `src/rootunmount.test.ts` is the structural guard that says so, and a
  // mounted root outliving this file reports its `window is not defined`
  // against whatever file vitest runs next.
  await act(async () => root.unmount());
  host.remove();
  localStorage.clear();
});

/**
 * Mount, and wait long enough for the account to arrive.
 *
 * The 600ms is `state/storetoken.test.tsx`'s number and its reason: the
 * store's session effect does not run on mount. It waits for
 * `requestIdleCallback`, which jsdom does not have, so it takes the
 * `setTimeout` fallback. A shorter wait leaves `account` null, the gate shut
 * and every assertion here vacuous.
 */
async function draw(): Promise<string> {
  await loadSeed().catch(() => []);
  await act(async () => {
    root = createRoot(host);
    root.render(
      <StoreProvider>
        <Waiting />
      </StoreProvider>,
    );
  });
  await act(async () => {
    await new Promise((r) => setTimeout(r, 600));
  });
  return host.textContent ?? '';
}

describe('the waiting row on Today', () => {
  it('says what is waiting, and offers to open it', async () => {
    joined = [ROOM];
    said = [from('kayo', 'is it due Friday?'), from('oskar', 'I have the reading', 3)];

    const text = await draw();

    expect(text).toContain('2 new in ECON 1020.');
    expect(host.querySelector('button')).not.toBeNull();
  });

  it('leads with being named when somebody used your handle', async () => {
    joined = [ROOM];
    said = [from('kayo', 'anyone got notes?'), from('oskar', '@harrison can you send yours?', 2)];

    expect(await draw()).toContain('A message names you in ECON 1020.');
  });

  /*
   * The control for every "renders nothing" case below. Without it a `Waiting`
   * that returned null unconditionally would pass all three of them and be
   * entirely broken — which is the exact shape of over-broad fix
   * `lib/waiting.test.ts` also guards against.
   *
   * It is the two tests above, and it is named here so the reason is on the
   * page rather than inferred.
   */

  it('draws nothing when nothing is waiting', async () => {
    joined = [ROOM];
    said = [];
    expect(await draw()).toBe('');
  });

  it('draws nothing when the only messages are your own', async () => {
    joined = [ROOM];
    said = [from('me', 'I will bring the notes')];
    expect(await draw()).toBe('');
  });

  it('draws nothing when signed out', async () => {
    signedIn = null;
    joined = [ROOM];
    said = [from('kayo', 'is it due Friday?')];
    expect(await draw()).toBe('');
  });

  /**
   * The wiring, end to end.
   *
   * Every other test in this file mounts `<Waiting />` on its own, which
   * proves the component works and proves nothing at all about whether a
   * student ever meets it. Deleting the one line in `screens/Today.tsx` would
   * leave all of them green and ship the silent failure this whole change
   * exists to fix. This is the test that goes red for that, so it mounts the
   * real screen and looks for the sentence in it.
   */
  it('reaches the student, because Today draws it', async () => {
    joined = [ROOM];
    said = [from('kayo', 'is it due Friday?'), from('oskar', 'I have the reading', 3)];

    const { Today } = await import('../screens/Today');
    await loadSeed().catch(() => []);
    await act(async () => {
      root = createRoot(host);
      root.render(
        <StoreProvider>
          <Today />
        </StoreProvider>,
      );
    });
    await act(async () => {
      await new Promise((r) => setTimeout(r, 600));
    });

    expect(host.textContent ?? '').toContain('2 new in ECON 1020.');
  });

  it('honours a room this device muted', async () => {
    // Written the way `lib/roomprefs.ts` stores it. This is the wiring test
    // that matters most: it can only pass if the row is reading the real
    // `waiting`, because muting lives nowhere else.
    localStorage.setItem(
      'semester.rooms.v1',
      JSON.stringify({ [ROOM]: { pinned: false, muted: true, read: '' } }),
    );
    joined = [ROOM];
    said = [from('kayo', 'is it due Friday?')];

    expect(await draw()).toBe('');
  });
});
