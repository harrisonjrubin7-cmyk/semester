// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, useEffect } from 'react';
import { createRoot, type Root } from 'react-dom/client';

/**
 * `useDomains` under the real `StoreProvider`: the hook, mounted. The harness
 * is `state/readonly.test.tsx`'s — storage and the cloud stubbed, nothing
 * about the store itself mocked — so what is exercised is the store's own
 * dispatch, reducer and re-render.
 */

vi.mock('../lib/cloud', () => ({
  cloudConfigured: false,
  accountOf: () => null,
  currentSession: async () => null,
  onAuthChange: () => () => {},
  explainSyncError: (e: unknown) => String(e),
  explainSync: (e: unknown) => ({ said: String(e), code: 'INTERNAL_ERROR', ref: 'SEM-TEST' }),
  isStale: () => false,
  pull: async () => ({ state: {}, courses: [], updated: 0, seen: { state: 's', courses: {} } }),
  push: async () => ({ state: 's', courses: {} }),
}));
vi.mock('../lib/capabilities', async (importOriginal) => ({ ...(await importOriginal<typeof import('../lib/capabilities')>()), loadMyCapabilities: async () => [] }));
vi.mock('../state/persist', () => ({
  available: () => true,
  persist: () => {},
  flushNow: async () => {},
  flushOnLeave: () => {},
  whileWriting: () => {},
  load: async () => null,
}));

const { StoreProvider, useStore } = await import('../state/store');
const { useDomains } = await import('./react');
const { loadSeed } = await import('../data/seed');

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let host: HTMLDivElement;
let root: Root;
let store: ReturnType<typeof useStore>;
const seen: ReturnType<typeof useDomains>[] = [];

function Peek() {
  const s = useStore();
  const domains = useDomains();
  useEffect(() => {
    store = s;
    seen.push(domains);
  });
  return null;
}

beforeEach(async () => {
  await loadSeed().catch(() => []);
  localStorage.clear();
  localStorage.setItem('semester.v1', JSON.stringify({ schemaVersion: 6, seenOnboarding: true, registered: true }));
  seen.length = 0;
  host = document.createElement('div');
  document.body.append(host);
  root = createRoot(host);
  await act(async () => {
    root.render(<StoreProvider><Peek /></StoreProvider>);
  });
});

afterEach(async () => {
  await act(async () => root.unmount());
  host.remove();
  localStorage.clear();
});

describe('useDomains, mounted on the real store', () => {
  it('ticks a task through the store: the reducer wrote it, and the store re-rendered with it', async () => {
    await act(async () => {
      store.dispatch({ type: 'addTask', task: { title: 'Read chapter 6', date: '2026-10-08', time: '', note: '' } } as never);
    });
    const id = store.state.tasks.find((t) => t.title === 'Read chapter 6')!.id;
    let result: Awaited<ReturnType<ReturnType<typeof useDomains>['tasks']['complete']>> | undefined;
    await act(async () => {
      result = await seen.at(-1)!.tasks.complete(id);
    });
    expect(result?.ok).toBe(true);
    expect(store.state.tasks.find((t) => t.id === id)?.done).toBe(true);
  });

  it('is the same object on every render, so it is safe in an effect’s dependencies', async () => {
    await act(async () => {
      store.dispatch({ type: 'addTask', task: { title: 'Another', date: null, time: '', note: '' } } as never);
    });
    expect(seen.length).toBeGreaterThan(1);
    expect(new Set(seen).size).toBe(1);
  });

  it('reads Today from the live store, signed out, with the device’s own role', async () => {
    await act(async () => {
      store.dispatch({ type: 'addTask', task: { title: 'Due now', date: '2026-10-08', time: '', note: '' } } as never);
    });
    const domains = seen.at(-1)!;
    expect(domains.subject()).toMatchObject({ signedIn: false, roleId: store.state.role });
    const view = await domains.today.view();
    expect(view.ok).toBe(true);
  });
});
