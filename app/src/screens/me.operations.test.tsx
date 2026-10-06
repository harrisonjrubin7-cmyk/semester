// @vitest-environment jsdom
import { act, useEffect } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { loadSeed } from '../data/seed';
import type { Grant } from '../lib/capabilities';
import { STORAGE_KEY } from '../state/shape';
import { StoreProvider, useStore } from '../state/store';

/**
 * The way into the operations console from Me. It is an offer, not a gate:
 * the row appears only when the database reports `console:operate` at
 * platform scope, and `screens/Console.tsx` and every RPC check it again.
 */

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const mock = vi.hoisted(() => ({ caps: vi.fn<() => Promise<Grant[]>>() }));
// `useMyCapabilities` calls its own module's loader, so the seam is the cloud client beneath it.
vi.mock('../lib/cloud', () => ({
  cloudConfigured: true,
  cloud: async () => ({
    auth: { getUser: async () => ({ data: { user: { id: 'u1' } } }) },
    rpc: async (name: string) => {
      if (name !== 'my_capabilities') return { data: null, error: { message: 'unexpected rpc' } };
      try {
        const grants = await mock.caps();
        return { data: grants.map((g) => ({ capability: g.capability, scope_kind: g.scopeKind, scope_id: g.scopeId })), error: null };
      } catch (e) {
        return { data: null, error: { message: String(e) } };
      }
    },
  }),
}));

const { Me } = await import('./Me');

let host: HTMLDivElement;
let root: Root;
let screen = '';
function Probe() {
  const { state } = useStore();
  useEffect(() => { screen = state.screen; });
  return null;
}

beforeAll(async () => { await loadSeed(); });
beforeEach(() => {
  window.location.hash = '';
  window.matchMedia = (() => ({ matches: false, addEventListener: () => {}, removeEventListener: () => {} })) as unknown as typeof window.matchMedia;
  localStorage.clear();
  localStorage.setItem(STORAGE_KEY, JSON.stringify({ schemaVersion: 6, seenOnboarding: true, sample: false, term: '2026FA', courses: [] }));
  screen = '';
  host = document.createElement('div');
  host.className = 'device';
  document.body.append(host);
  root = createRoot(host);
});
afterEach(async () => {
  await act(async () => root.unmount());
  host.remove();
  localStorage.clear();
});

const render = async () => {
  await act(async () => root.render(<StoreProvider><Me trustCenter={false} semesterWrapped={false} /><Probe /></StoreProvider>));
  for (let i = 0; i < 3; i += 1) await act(async () => { await new Promise((r) => setTimeout(r, 10)); });
};
const row = () => [...host.querySelectorAll('button')].find((b) => /Semester Operations/.test(b.textContent ?? ''));
const grant = (scopeKind: string): Grant => ({ capability: 'console:operate', scopeKind, scopeId: scopeKind === 'platform' ? '*' : 'vanderbilt' });

describe('Operations entry on Me', () => {
  it('is absent for an account with no grants', async () => {
    mock.caps.mockResolvedValue([]);
    await render();
    expect(row()).toBeUndefined();
  });

  it('is absent when console:operate is held only at school scope', async () => {
    mock.caps.mockResolvedValue([grant('school')]);
    await render();
    expect(row()).toBeUndefined();
  });

  it('is absent when the grant read fails', async () => {
    mock.caps.mockRejectedValue(new Error('offline'));
    await render();
    expect(row()).toBeUndefined();
  });

  it('is offered at platform scope and opens the console', async () => {
    mock.caps.mockResolvedValue([grant('platform')]);
    await render();
    expect(row()).toBeDefined();
    await act(async () => row()!.click());
    expect(screen).toBe('console');
  });
});
