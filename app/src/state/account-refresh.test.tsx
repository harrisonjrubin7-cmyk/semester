// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, useEffect } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import type { Session } from '@supabase/supabase-js';

const session = (id: string): Session => ({
  user: { id, email: `${id}@example.test`, app_metadata: { provider: 'email' } },
  access_token: `token-${id}`,
} as unknown as Session);

const accountA = session('account-a');
const accountB = session('account-b');
const accountC = session('account-c');
let authChanged: (session: Session | null) => void = () => {};
let databaseAvailable = false;
const persist = vi.fn();
const flushNow = vi.fn(async (_signal?: AbortSignal) => true);
const acknowledgeRemoteWrite = vi.fn(async () => true);
const rollbackRemoteWrite = vi.fn(async (_target: unknown) => true);
const pull = vi.fn();

vi.mock('../lib/cloud', () => ({
  cloudConfigured: true,
  accountOf: (value: Session | null) => value?.user
    ? { id: value.user.id, email: value.user.email ?? '', via: 'email' }
    : null,
  currentSession: async () => accountA,
  onAuthChange: (listener: (value: Session | null) => void) => {
    authChanged = listener;
    return () => {};
  },
  explainSync: (error: unknown) => ({ said: String(error), code: 'INTERNAL_ERROR', ref: 'SEM-TEST' }),
  isStale: () => false,
  pull: (...args: unknown[]) => pull(...args),
  push: async () => ({ state: 'pushed', courses: {} }),
}));

vi.mock('./persist', () => ({
  acknowledgeRemoteWrite: () => acknowledgeRemoteWrite(),
  available: () => databaseAvailable,
  persist: (...args: unknown[]) => persist(...args),
  flushNow: (signal?: AbortSignal) => flushNow(signal),
  flushOnLeave: () => {},
  rollbackRemoteWrite: (target: unknown) => rollbackRemoteWrite(target),
  whileWriting: () => {},
  load: async () => null,
}));

const { StoreProvider, useStore } = await import('./store');
const { SEEN_KEY } = await import('./shape');
const { loadSeed } = await import('../data/seed');

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

type Remote = {
  state: Record<string, unknown> | null;
  courses: unknown[];
  updated: number;
  seen: { state?: string; courses: Record<string, string> };
};

const remote = (account: 'a' | 'b'): Remote => ({
  state: {
    tasks: [{
      id: `${account}-task`, title: `${account.toUpperCase()} task`, date: null,
      time: '', note: '', courseId: null, done: false, created: account === 'a' ? 2 : 3,
    }, ...(account === 'a' ? [{
      id: 'a-task-2', title: 'Second A task', date: null,
      time: '', note: '', courseId: null, done: false, created: 4,
    }] : [])],
  },
  courses: [],
  updated: account === 'a' ? 2 : 3,
  seen: { state: `${account}-seen`, courses: {} },
});

function deferred<T>() {
  let resolve: (value: T) => void = () => {};
  let reject: (reason: unknown) => void = () => {};
  const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}

let host: HTMLDivElement;
let root: Root;
let store: ReturnType<typeof useStore>;

function Peek() {
  const value = useStore();
  useEffect(() => { store = value; });
  return null;
}

async function mount() {
  await act(async () => { root.render(<StoreProvider><Peek /></StoreProvider>); });
  await act(async () => { await vi.advanceTimersByTimeAsync(500); });
}

async function changeAccount(value: Session | null) {
  await act(async () => { authChanged(value); await Promise.resolve(); });
}

beforeEach(async () => {
  await loadSeed().catch(() => []);
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'Date'] });
  Object.defineProperty(navigator, 'onLine', { configurable: true, get: () => true });
  localStorage.clear();
  localStorage.setItem('semester.v1', JSON.stringify({
    schemaVersion: 6, seenOnboarding: true, registered: true,
    tasks: [{ id: 'local-task', title: 'Local task', done: false, created: 1 }],
  }));
  localStorage.removeItem(SEEN_KEY);
  authChanged = () => {};
  databaseAvailable = false;
  persist.mockReset();
  flushNow.mockReset();
  flushNow.mockResolvedValue(true);
  acknowledgeRemoteWrite.mockReset().mockResolvedValue(true);
  rollbackRemoteWrite.mockReset().mockResolvedValue(true);
  pull.mockReset();
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

describe('an account change during a refresh', () => {
  it('starts B\'s pull and shows B\'s adoption prompt without waiting for A', async () => {
    const a = deferred<Remote>();
    pull.mockImplementation((id: string) => id === 'account-a' ? a.promise : Promise.resolve(remote('b')));
    await mount();
    expect(pull).toHaveBeenCalledWith('account-a');

    await changeAccount(accountB);

    expect(pull).toHaveBeenCalledWith('account-b');
    expect(store.account?.id).toBe('account-b');
    expect(store.asking?.sides.cloud).toBe(1);
  });

  it('ignores A success after B has reached its adoption prompt', async () => {
    const a = deferred<Remote>();
    pull.mockImplementation((id: string) => id === 'account-a' ? a.promise : Promise.resolve(remote('b')));
    await mount();
    await changeAccount(accountB);
    await act(async () => { a.resolve(remote('a')); await Promise.resolve(); });

    expect(store.account?.id).toBe('account-b');
    expect(store.asking?.sides.cloud).toBe(1);
    expect(store.state.tasks.some((task) => task.id === 'a-task')).toBe(false);
    expect(localStorage.getItem(SEEN_KEY)).toBeNull();
  });

  it('ignores A failure after B has reached its adoption prompt', async () => {
    const a = deferred<Remote>();
    pull.mockImplementation((id: string) => id === 'account-a' ? a.promise : Promise.resolve(remote('b')));
    await mount();
    await changeAccount(accountB);
    await act(async () => { a.reject(new Error('A failed late')); await Promise.resolve(); });

    expect(store.account?.id).toBe('account-b');
    expect(store.asking?.sides.cloud).toBe(1);
    expect(store.sync.status).not.toBe('error');
    expect(store.sync.error).not.toContain('A failed late');
  });

  it('ignores A success after sign-out', async () => {
    const a = deferred<Remote>();
    pull.mockImplementation(() => a.promise);
    await mount();
    await changeAccount(null);
    await act(async () => { a.resolve(remote('a')); await Promise.resolve(); });

    expect(store.account).toBeNull();
    expect(store.sync.status).toBe('signed-out');
    expect(store.asking).toBeNull();
    expect(store.state.tasks.some((task) => task.id === 'a-task')).toBe(false);
    expect(localStorage.getItem(SEEN_KEY)).toBeNull();
  });

  it('keeps suppressing duplicate pulls within one account generation', async () => {
    const a = deferred<Remote>();
    pull.mockImplementation(() => a.promise);
    await mount();

    await changeAccount(accountA);

    expect(pull.mock.calls.filter(([id]) => id === 'account-a')).toHaveLength(1);
  });

  it('aborts A before the new account can be applied during its durable write', async () => {
    databaseAvailable = true;
    localStorage.setItem(SEEN_KEY, JSON.stringify({ state: 'old', courses: {} }));
    const firstWrite = deferred<boolean>();
    const b = deferred<Remote>();
    let signal: AbortSignal | undefined;
    flushNow.mockImplementationOnce(async (given?: AbortSignal) => {
      signal = given;
      return firstWrite.promise;
    }).mockResolvedValue(true);
    pull.mockImplementation((id: string) => id === 'account-a'
      ? Promise.resolve(remote('a'))
      : b.promise);
    await mount();
    expect(flushNow).toHaveBeenCalledOnce();

    await changeAccount(accountB);
    expect(signal?.aborted).toBe(true);
    await act(async () => {
      firstWrite.resolve(true);
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(store.state.tasks.some((task) => task.id.startsWith('a-task'))).toBe(false);
    expect(localStorage.getItem(SEEN_KEY) ?? '').not.toContain('a-seen');
  });

  it('does not activate a queued identity when durable rollback fails', async () => {
    databaseAvailable = true;
    localStorage.setItem(SEEN_KEY, JSON.stringify({ state: 'old', courses: {} }));
    const firstWrite = deferred<boolean>();
    flushNow.mockImplementationOnce(() => firstWrite.promise);
    rollbackRemoteWrite.mockResolvedValue(false);
    pull.mockImplementation((id: string) => id === 'account-a'
      ? Promise.resolve(remote('a'))
      : Promise.resolve(remote('b')));
    await mount();

    await changeAccount(accountB);
    await act(async () => {
      firstWrite.resolve(false);
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(store.account?.id).toBe('account-a');
    expect(pull).not.toHaveBeenCalledWith('account-b');
    expect(store.sync.status).toBe('error');
    expect(localStorage.getItem(SEEN_KEY) ?? '').not.toContain('a-seen');
  });

  it('invalidates an adoption prompt when its account signs out', async () => {
    const a = deferred<Remote>();
    pull.mockImplementation((id: string) => id === 'account-a' ? a.promise : Promise.resolve(remote('b')));
    await mount();
    await changeAccount(accountB);
    const settleB = store.settle;
    expect(store.asking?.sides.cloud).toBe(1);

    await changeAccount(null);
    await act(async () => { await settleB('merge', null); });

    expect(store.asking).toBeNull();
    expect(store.state.tasks.some((task) => task.id === 'b-task')).toBe(false);
    expect(localStorage.getItem(SEEN_KEY)).toBeNull();
  });

  it('persists an authored edit made during an automatic remote flush before marking seen', async () => {
    databaseAvailable = true;
    localStorage.setItem(SEEN_KEY, JSON.stringify({ state: 'old', courses: {} }));
    const firstWrite = deferred<boolean>();
    let committed: { tasks?: { id: string }[] } | undefined;
    let writes = 0;
    flushNow.mockImplementation(async () => {
      if (writes++ === 0) await firstWrite.promise;
      committed = persist.mock.calls.at(-1)?.[0] as typeof committed;
      return true;
    });
    pull.mockResolvedValue(remote('a'));
    await mount();

    await act(async () => {
      store.dispatch({
        type: 'hydrate',
        persisted: {
          tasks: [{
            id: 'authored-during-flush', title: 'Authored during flush', date: null,
            time: '', note: '', courseId: null, done: false, created: 5,
          }],
        },
      });
      await Promise.resolve();
    });
    await act(async () => {
      firstWrite.resolve(true);
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(committed?.tasks?.some((task) => task.id === 'authored-during-flush')).toBe(true);
    expect(localStorage.getItem(SEEN_KEY)).toContain('a-seen');
  });

  it('persists an authored edit made during journal acknowledgement before marking seen', async () => {
    databaseAvailable = true;
    localStorage.setItem(SEEN_KEY, JSON.stringify({ state: 'old', courses: {} }));
    const acknowledgement = deferred<boolean>();
    acknowledgeRemoteWrite
      .mockImplementationOnce(() => acknowledgement.promise)
      .mockResolvedValue(true);
    let committed: { tasks?: { id: string }[] } | undefined;
    flushNow.mockImplementation(async () => {
      committed = persist.mock.calls.at(-1)?.[0] as typeof committed;
      return true;
    });
    pull.mockResolvedValue(remote('a'));
    await mount();
    expect(acknowledgeRemoteWrite).toHaveBeenCalledOnce();

    await act(async () => {
      store.dispatch({
        type: 'hydrate',
        persisted: {
          tasks: [{
            id: 'authored-during-ack', title: 'Authored during acknowledgement', date: null,
            time: '', note: '', courseId: null, done: false, created: 8,
          }],
        },
      });
    });
    await act(async () => {
      acknowledgement.resolve(true);
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(flushNow).toHaveBeenCalledTimes(2);
    expect(committed?.tasks?.some((task) => task.id === 'authored-during-ack')).toBe(true);
    expect(localStorage.getItem(SEEN_KEY)).toContain('a-seen');
  });

  it('rolls the whole operation back to an authored edit when identity changes during its retry', async () => {
    databaseAvailable = true;
    localStorage.setItem(SEEN_KEY, JSON.stringify({ state: 'old', courses: {} }));
    const firstWrite = deferred<boolean>();
    const secondWrite = deferred<boolean>();
    const b = deferred<Remote>();
    let writes = 0;
    let retrySignal: AbortSignal | undefined;
    flushNow.mockImplementation(async (signal?: AbortSignal) => {
      writes += 1;
      if (writes === 1) return firstWrite.promise;
      retrySignal = signal;
      return secondWrite.promise;
    });
    pull.mockImplementation((id: string) => id === 'account-a'
      ? Promise.resolve(remote('a'))
      : b.promise);
    await mount();

    await act(async () => {
      store.dispatch({
        type: 'hydrate',
        persisted: {
          tasks: [{
            id: 'authored-before-switch', title: 'Authored before switch', date: null,
            time: '', note: '', courseId: null, done: false, created: 7,
          }],
        },
      });
    });
    await act(async () => {
      firstWrite.resolve(true);
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(writes).toBe(2);

    await changeAccount(accountB);
    expect(retrySignal?.aborted).toBe(true);
    await act(async () => {
      secondWrite.resolve(true);
      await Promise.resolve();
      await Promise.resolve();
    });

    const restored = rollbackRemoteWrite.mock.calls.at(-1)?.[0] as
      { tasks?: { id: string }[] } | undefined;
    expect(restored?.tasks?.some((task) => task.id === 'authored-before-switch')).toBe(true);
    expect(restored?.tasks?.some((task) => task.id.startsWith('a-task'))).toBe(false);
    expect(store.state.tasks.some((task) => task.id.startsWith('a-task'))).toBe(false);
    expect(localStorage.getItem(SEEN_KEY) ?? '').not.toContain('a-seen');
  });

  it('persists an authored edit made during adoption before marking seen', async () => {
    const a = deferred<Remote>();
    pull.mockImplementation((id: string) => id === 'account-a' ? a.promise : Promise.resolve(remote('b')));
    await mount();
    await changeAccount(accountB);
    const settleB = store.settle;
    databaseAvailable = true;
    const firstWrite = deferred<boolean>();
    let committed: { tasks?: { id: string }[] } | undefined;
    let writes = 0;
    flushNow.mockImplementation(async () => {
      if (writes++ === 0) await firstWrite.promise;
      committed = persist.mock.calls.at(-1)?.[0] as typeof committed;
      return true;
    });
    let settling: Promise<void> = Promise.resolve();
    await act(async () => {
      settling = Promise.resolve(settleB('merge', null));
      await Promise.resolve();
    });

    await act(async () => {
      store.dispatch({
        type: 'hydrate',
        persisted: {
          tasks: [{
            id: 'authored-during-adoption', title: 'Authored during adoption', date: null,
            time: '', note: '', courseId: null, done: false, created: 6,
          }],
        },
      });
      await Promise.resolve();
    });
    await act(async () => {
      firstWrite.resolve(true);
      await settling;
    });

    expect(committed?.tasks?.some((task) => task.id === 'authored-during-adoption')).toBe(true);
    expect(localStorage.getItem(SEEN_KEY)).toContain('b-seen');
    const lastQueued = persist.mock.calls.at(-1)?.[0] as
      { tasks?: { id: string }[] } | undefined;
    expect(lastQueued?.tasks?.some((task) => task.id === 'b-task')).toBe(true);
    expect(lastQueued?.tasks?.some((task) => task.id === 'authored-during-adoption')).toBe(true);
  });

  it('aborts adoption before the new account can be applied during its durable write', async () => {
    const a = deferred<Remote>();
    const c = deferred<Remote>();
    pull.mockImplementation((id: string) => id === 'account-a'
      ? a.promise
      : id === 'account-b' ? Promise.resolve(remote('b')) : c.promise);
    await mount();
    await changeAccount(accountB);
    const settleB = store.settle;
    databaseAvailable = true;
    const firstWrite = deferred<boolean>();
    let signal: AbortSignal | undefined;
    flushNow.mockImplementationOnce(async (given?: AbortSignal) => {
      signal = given;
      return firstWrite.promise;
    }).mockResolvedValue(true);
    let settling: Promise<void> = Promise.resolve();
    await act(async () => {
      settling = Promise.resolve(settleB('merge', null));
      await Promise.resolve();
    });

    await changeAccount(accountC);
    expect(signal?.aborted).toBe(true);
    await act(async () => {
      firstWrite.resolve(true);
      await settling;
    });

    expect(store.account?.id).toBe('account-c');
    expect(store.state.tasks.some((task) => task.id === 'b-task')).toBe(false);
    expect(localStorage.getItem(SEEN_KEY)).toBeNull();
  });
});
