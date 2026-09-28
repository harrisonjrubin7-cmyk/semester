// @vitest-environment jsdom
import { act, useEffect } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import type { Session } from '@supabase/supabase-js';
import { afterEach, beforeAll, beforeEach, expect, it, vi } from 'vitest';

/**
 * A reconnect pushes only after a pull that succeeded (Codex on #879).
 *
 * `push` overwrites the account's copy. `refresh` swallows a failed pull and
 * resolves, so a reconnect that pushed after it would replace changes made on
 * another device that this one never read. The real store is mounted; only
 * the cloud module is faked, so `catchUp` is measured as it ships.
 */

const session = { user: { id: 'me', email: 'a@school.edu', app_metadata: { provider: 'email' } }, access_token: 't' } as unknown as Session;
let pullFails = false;
let pushes = 0;

vi.mock('../lib/cloud', () => ({
  cloudConfigured: true,
  accountOf: (s: Session | null) => (s?.user ? { id: s.user.id, email: s.user.email ?? '', via: 'email' } : null),
  currentSession: async () => session,
  onAuthChange: () => () => {},
  explainSyncError: (e: unknown) => String(e),
  explainSync: (e: unknown) => ({ said: String(e), code: 'INTERNAL_ERROR', ref: 'SEM-TEST' }),
  pull: async () => {
    if (pullFails) throw new Error('offline');
    return { state: null, courses: [], seen: {}, updated: 0 };
  },
  push: async () => {
    pushes += 1;
    return {};
  },
}));

const { StoreProvider, useStore } = await import('./store');
const { loadSeed } = await import('../data/seed');

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
let host: HTMLDivElement;
let root: Root;
let catchUp: (() => Promise<boolean>) | null = null;
let signedIn = false;

function Probe() {
  const store = useStore();
  useEffect(() => {
    catchUp = store.catchUp;
    signedIn = Boolean(store.account);
  });
  return null;
}

beforeAll(async () => {
  await loadSeed();
});

beforeEach(async () => {
  localStorage.clear();
  pullFails = false;
  pushes = 0;
  host = document.createElement('div');
  document.body.append(host);
  root = createRoot(host);
  await act(async () => root.render(<StoreProvider><Probe /></StoreProvider>));
  const until = Date.now() + 2000;
  while (!signedIn && Date.now() < until) {
    await act(async () => new Promise((r) => setTimeout(r, 10)));
  }
  pushes = 0;
});

afterEach(async () => {
  await act(async () => root.unmount());
  host.remove();
  localStorage.clear();
});

it('does not push when the pull failed, so nothing unseen is overwritten', async () => {
  expect(signedIn).toBe(true);
  pullFails = true;
  let pushed: boolean | null = null;
  await act(async () => {
    pushed = await catchUp!();
  });
  expect(pushed).toBe(false);
  expect(pushes).toBe(0);
});

it('pushes after a pull that succeeded (the control)', async () => {
  let pushed: boolean | null = null;
  await act(async () => {
    pushed = await catchUp!();
  });
  expect(pushed).toBe(true);
  expect(pushes).toBe(1);
});
