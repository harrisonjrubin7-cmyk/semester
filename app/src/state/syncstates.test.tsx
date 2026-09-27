// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, useEffect } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import type { Session } from '@supabase/supabase-js';

/**
 * Offline, Queued and Conflict — and the bug underneath them.
 *
 * The three states only mean something if an edit actually goes up, and on
 * the database path it did not. The push depended on `persisted`, the
 * serialised persisted half, and on IndexedDB that string is never built:
 * it is `''` on every render. So in every ordinary browser an edit never
 * re-ran the push, and the account heard about it only at the next sign-in.
 * Every earlier sync test ran in jsdom, which has no IndexedDB, so all of
 * them took the localStorage path and none of them could see it. This file
 * mocks the database as open.
 */

const session = {
  user: { id: 'u1', email: 'a@b.c', app_metadata: { provider: 'email' } },
  access_token: 'tok',
} as unknown as Session;

class Stale extends Error {
  constructor() {
    super('stale');
    this.name = 'Stale';
  }
}

const pull = vi.fn();
const push = vi.fn();
let db = true;

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

// The database, open — or not, per test. Writes go nowhere; what matters is
// which path the store believes it is on.
vi.mock('./persist', () => ({
  available: () => db,
  persist: () => {},
  flushNow: async () => {},
  whileWriting: () => {},
  load: async () => null,
}));

const { StoreProvider, useStore } = await import('./store');
const { SEEN_KEY, UNPUSHED_KEY } = await import('./shape');
const { loadSeed } = await import('../data/seed');

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let host: HTMLDivElement;
let root: Root;
let onLine = true;
let store: ReturnType<typeof useStore>;

function Peek() {
  const seen = useStore();
  // In an effect rather than during render, so the test reads what the last
  // committed render saw.
  useEffect(() => {
    store = seen;
  });
  return null;
}

const snapshot = (stamp: string) => ({ state: {}, courses: [], updated: 0, seen: { state: stamp, courses: {} } });

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

async function addTask(title: string) {
  await act(async () => {
    store.dispatch({ type: 'addTask', task: { title, date: null, time: '', note: '' } } as never);
  });
}

async function connection(on: boolean) {
  onLine = on;
  await act(async () => {
    window.dispatchEvent(new Event(on ? 'online' : 'offline'));
  });
}

beforeEach(async () => {
  await loadSeed().catch(() => []);
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
  Object.defineProperty(navigator, 'onLine', { configurable: true, get: () => onLine });
  onLine = true;
  db = true;
  pull.mockReset();
  push.mockReset();
  localStorage.clear();
  localStorage.setItem('semester.v1', JSON.stringify({ schemaVersion: 6, seenOnboarding: true, registered: true }));
  localStorage.setItem(SEEN_KEY, JSON.stringify({ state: 's1', courses: {} }));
  pull.mockResolvedValue(snapshot('s1'));
  let n = 1;
  push.mockImplementation(async () => ({ state: `s${++n}`, courses: {} }));
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

describe('an edit goes up on the database path', () => {
  it('pushes after an edit, not only at sign-in', async () => {
    await mount();
    await wait(3_000);
    const atSignIn = push.mock.calls.length;
    expect(atSignIn).toBe(1);

    await addTask('Problem set 4');
    await wait(3_000);
    expect(push.mock.calls.length).toBe(atSignIn + 1);
  });

  it('does not push for a change that is only on screen', async () => {
    // The control: opening search changes `state` and nothing persisted. A
    // navigation is not a control — `recent` and `visited` are persisted and
    // sync, on both paths, as they always have.
    await mount();
    await wait(3_000);
    const before = push.mock.calls.length;
    await act(async () => {
      store.dispatch({ type: 'finder', open: true });
    });
    await wait(3_000);
    expect(push.mock.calls.length).toBe(before);
  });
});

describe('without a connection', () => {
  it('says Offline when nothing is waiting, and pushes nothing', async () => {
    onLine = false;
    await mount();
    await wait(3_000);
    expect(store.sync.status).toBe('offline');
    expect(push).not.toHaveBeenCalled();
  });

  it('says Queued once there is an edit waiting, and remembers it across a reload', async () => {
    await mount();
    await wait(3_000);
    await connection(false);
    await addTask('Read chapter 6');
    await wait(3_000);
    expect(store.sync.status).toBe('queued');
    expect(localStorage.getItem(UNPUSHED_KEY)).toBe('1');
  });

  it('on the way back: pulls, pushes the waiting edit, and says Synced', async () => {
    await mount();
    await wait(3_000);
    await connection(false);
    await addTask('Email the TA');
    await wait(3_000);
    const pushes = push.mock.calls.length;
    const pulls = pull.mock.calls.length;

    await connection(true);
    await wait(3_000);
    expect(pull.mock.calls.length).toBe(pulls + 1);
    expect(push.mock.calls.length).toBe(pushes + 1);
    expect(store.sync.status).toBe('synced');
    expect(localStorage.getItem(UNPUSHED_KEY)).toBeNull();
  });
});

describe('when another device keeps winning', () => {
  it('says Conflict from the third lost race, not Trouble', async () => {
    push.mockRejectedValue(new Stale());
    await mount();
    // 2.5s, then 5s, 10s, 20s between rounds.
    await wait(40_000);
    expect(push.mock.calls.length).toBeGreaterThanOrEqual(3);
    expect(store.sync.status).toBe('conflict');
  });
});
