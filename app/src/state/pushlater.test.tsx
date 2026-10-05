// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, useEffect } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import type { Session } from '@supabase/supabase-js';

/**
 * A change made after sign-in reaches the account — on the database path too.
 *
 * The push effect used to be keyed on `persisted`, the serialised persisted
 * half. On the IndexedDB path that string is never built — it is `''` on every
 * render, by design — so on the path every current browser takes the push ran
 * once after sign-in and never again. #777 re-keyed it on `edit`, a count
 * `sameFields` moves by reference, and `lib/syncstatus.test.ts` checks that
 * comparison. Nothing checked that the *effect* reads it: put `persisted` back
 * in the dependency list and every existing test stays green.
 *
 * This mounts the real provider with the database reported available, makes
 * one persisted change after the first push, and counts pushes. Measured
 * against that revert: the database case fails with "expected 1 to be greater
 * than 1", and the two controls below still pass.
 */

const session = {
  user: { id: 'u1', email: 'a@b.c', app_metadata: { provider: 'email' } },
  access_token: 'tok-abc',
} as unknown as Session;

const { pushes } = vi.hoisted(() => ({ pushes: [] as Record<string, unknown>[] }));

vi.mock('../lib/cloud', async (original) => ({
  ...(await original<typeof import('../lib/cloud')>()),
  cloudConfigured: true,
  accountOf: (s: Session | null) =>
    s?.user ? { id: s.user.id, email: s.user.email ?? '', via: 'email' } : null,
  currentSession: async () => session,
  onAuthChange: () => () => {},
  explainSyncError: (e: unknown) => String(e),
  explainSync: (e: unknown) => ({ said: String(e), code: 'INTERNAL_ERROR', ref: 'SEM-TEST' }),
  pull: async () => ({ state: null, courses: [], seen: null, updated: 0 }),
  push: async (_id: string, rest: Record<string, unknown>) => {
    pushes.push(rest);
    return null;
  },
}));

/*
 * The database path, without a database. `available()` is the only thing the
 * store asks to choose its writer; the writer itself is stubbed so nothing
 * reaches jsdom's missing IndexedDB.
 */
let dbUp = true;
vi.mock('./persist', async (original) => ({
  ...(await original<typeof import('./persist')>()),
  available: () => dbUp,
  persist: () => undefined,
  prime: async () => undefined,
  flushNow: async () => undefined,
  flushOnLeave: () => undefined,
}));

const { StoreProvider, useStore } = await import('./store');
const { setSessionToken } = await import('../lib/token');
const { loadSeed } = await import('../data/seed');

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let host: HTMLDivElement;
let root: Root;
let dispatch: ReturnType<typeof useStore>['dispatch'] = () => undefined;

function Grab() {
  const store = useStore();
  useEffect(() => {
    dispatch = store.dispatch;
  });
  return null;
}

const wait = (ms: number) =>
  act(async () => {
    await new Promise((r) => setTimeout(r, ms));
  });

beforeEach(() => {
  pushes.length = 0;
  history.replaceState(null, '', '/');
  localStorage.clear();
  setSessionToken(null);
  host = document.createElement('div');
  document.body.append(host);
  act(() => {
    root = createRoot(host);
  });
});

afterEach(() => {
  act(() => root.unmount());
  setSessionToken(null);
  host.remove();
  dbUp = true;
});

/** Wait, in real time, until `ok` holds or `ms` runs out. */
async function until(ok: () => boolean, ms: number) {
  const end = Date.now() + ms;
  while (!ok() && Date.now() < end) await wait(100);
}

async function signedInThenChanged() {
  act(() => {
    root.render(
      <StoreProvider>
        <Grab />
      </StoreProvider>,
    );
  });
  await loadSeed().catch(() => []);
  // Sign-in waits on the idle fallback, then the first push on its debounce.
  await until(() => pushes.length > 0, 8000);
  // Past one more debounce, so a straggling first push is not counted as the second.
  await wait(3000);
  const first = pushes.length;
  act(() => dispatch({ type: 'setTone', tone: 'minimal' }));
  await until(() => pushes.length > first, 5000);
  return { first, after: pushes.length, last: pushes.at(-1) };
}

describe('a change after sign-in goes up to the account', () => {
  it('pushes again after a persisted change on the database path', async () => {
    dbUp = true;
    const { first, after, last } = await signedInThenChanged();
    expect(first, 'sign-in never pushed; the harness is not reaching the effect').toBeGreaterThan(0);
    expect(after).toBeGreaterThan(first);
    expect(last?.tone).toBe('minimal');
  }, 25_000);

  // The control: the localStorage path always worked, and must go on working.
  it('CONTROL: pushes again after a persisted change on the localStorage path', async () => {
    dbUp = false;
    const { first, after, last } = await signedInThenChanged();
    expect(first).toBeGreaterThan(0);
    expect(after).toBeGreaterThan(first);
    expect(last?.tone).toBe('minimal');
  }, 25_000);

  /*
   * The other half of the key: it must *not* move for state that is never
   * persisted, or every tab switch becomes a whole-account upload 2.5 s
   * later. (A navigation *does* push, on both paths: `recent` and `visited`
   * are persisted fields, and the localStorage path always pushed for them.)
   */
  it('does not push for a change to state that is not persisted', async () => {
    dbUp = true;
    act(() => {
      root.render(
        <StoreProvider>
          <Grab />
        </StoreProvider>,
      );
    });
    await loadSeed().catch(() => []);
    await until(() => pushes.length > 0, 8000);
    await wait(3000);
    const first = pushes.length;
    act(() => dispatch({ type: 'setMeTab', tab: 'task' }));
    await wait(3500);
    expect(pushes.length).toBe(first);
  }, 25_000);
});
