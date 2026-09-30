// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, useEffect } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import type { Session } from '@supabase/supabase-js';

/**
 * Read-only mode, from the store's side: an edit is saved, remembered as
 * unpushed, and never sent — and the status says which mode it is in, not
 * "offline", because the connection is fine. The same harness as
 * `syncstates.test.tsx` (database path mocked open, cloud mocked), with
 * `lib/readonly` answering true.
 *
 * The control is the file beside this one: with the flag off the same edit
 * pushes within three seconds (`syncstates.test.tsx`, "pushes after an edit").
 */

const session = {
  user: { id: 'u1', email: 'a@b.c', app_metadata: { provider: 'email' } },
  access_token: 'tok',
} as unknown as Session;

const pull = vi.fn();
const push = vi.fn();

vi.mock('../lib/readonly', async (importOriginal) => {
  const real = await importOriginal<typeof import('../lib/readonly')>();
  return { ...real, READ_ONLY: true };
});

vi.mock('../lib/cloud', () => ({
  cloudConfigured: true,
  accountOf: (s: Session | null) =>
    s?.user ? { id: s.user.id, email: s.user.email ?? '', via: 'email' } : null,
  currentSession: async () => session,
  onAuthChange: () => () => {},
  explainSyncError: (e: unknown) => String(e),
  explainSync: (e: unknown) => ({ said: String(e), code: 'INTERNAL_ERROR', ref: 'SEM-TEST' }),
  isStale: (e: unknown) => e instanceof Error && e.name === 'Stale',
  pull: (...a: unknown[]) => pull(...a),
  push: (...a: unknown[]) => push(...a),
}));

vi.mock('./persist', () => ({
  available: () => true,
  persist: () => {},
  flushNow: async () => {},
  flushOnLeave: () => {},
  whileWriting: () => {},
  load: async () => null,
}));

const { StoreProvider, useStore } = await import('./store');
const { SEEN_KEY, UNPUSHED_KEY } = await import('./shape');
const { loadSeed } = await import('../data/seed');

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let host: HTMLDivElement;
let root: Root;
let store: ReturnType<typeof useStore>;

function Peek() {
  const seen = useStore();
  useEffect(() => {
    store = seen;
  });
  return null;
}

async function mount() {
  await act(async () => {
    root.render(
      <StoreProvider>
        <Peek />
      </StoreProvider>,
    );
  });
}

async function wait(ms: number) {
  for (let t = 0; t < ms; t += 250) {
    await act(async () => {
      await vi.advanceTimersByTimeAsync(250);
    });
  }
}

beforeEach(async () => {
  await loadSeed().catch(() => []);
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'Date'] });
  Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'visible' });
  Object.defineProperty(navigator, 'onLine', { configurable: true, get: () => true });
  pull.mockReset();
  push.mockReset();
  localStorage.clear();
  localStorage.setItem('semester.v1', JSON.stringify({ schemaVersion: 6, seenOnboarding: true, registered: true }));
  localStorage.setItem(SEEN_KEY, JSON.stringify({ state: 's1', courses: {} }));
  pull.mockResolvedValue({ state: {}, courses: [], updated: 0, seen: { state: 's1', courses: {} } });
  push.mockResolvedValue({ state: 's2', courses: {} });
  host = document.createElement('div');
  document.body.append(host);
  root = createRoot(host);
});

afterEach(async () => {
  await act(async () => root.unmount());
  host.remove();
  vi.useRealTimers();
  localStorage.clear();
});

describe('read-only mode in the store', () => {
  it('saves the edit, remembers it as unpushed, pushes nothing, and says so as read-only rather than offline', async () => {
    await mount();
    await wait(3_000);
    await act(async () => {
      store.dispatch({ type: 'addTask', task: { title: 'Read chapter 6', date: null, time: '', note: '' } } as never);
    });
    await wait(6_000);
    expect(push).not.toHaveBeenCalled();
    expect(store.sync.status).toBe('read-only');
    expect(localStorage.getItem(UNPUSHED_KEY), 'the edit waits for a build that pushes').toBe('1');
    expect(store.state.tasks.some((t) => t.title === 'Read chapter 6'), 'and it is on the device').toBe(true);
  });

  it('still reads: the account is pulled on sign-in, because a pull is harmless during a restore', async () => {
    await mount();
    await wait(3_000);
    expect(pull).toHaveBeenCalled();
  });
});
