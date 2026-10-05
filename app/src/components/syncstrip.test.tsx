// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';

/**
 * The strip reads the store's status and routes to Account.
 *
 * `syncLine` in `lib/syncstatus.test.ts` holds which statuses earn a line and
 * what each says. This is the part that could be wrong around it: that the
 * live region exists before its text changes, that the button goes where the
 * whole story is, and that the strip does not point at Account from Account.
 */

const store = vi.hoisted(() => ({
  sync: { status: 'synced', at: 0, error: '' } as { status: string; at: number; error: string },
  state: { screen: 'home' } as { screen: string },
  went: [] as unknown[],
}));

vi.mock('../state/store', () => ({
  useStore: () => ({
    sync: store.sync,
    state: store.state,
    dispatch: (a: unknown) => store.went.push(a),
  }),
}));

const { SyncStrip } = await import('./SyncStrip');

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let host: HTMLDivElement;
let root: Root;

beforeEach(() => {
  store.sync = { status: 'synced', at: 0, error: '' };
  store.state = { screen: 'home' };
  store.went = [];
  host = document.createElement('div');
  document.body.append(host);
  act(() => {
    root = createRoot(host);
  });
});

afterEach(() => {
  act(() => root.unmount());
  host.remove();
});

function draw() {
  act(() => root.render(<SyncStrip />));
  return host.querySelector('[role="status"]');
}

describe('SyncStrip', () => {
  it('keeps its live region mounted, and empty, while there is nothing to say', () => {
    for (const status of ['synced', 'syncing', 'signed-out', 'off']) {
      store.sync = { status, at: 0, error: '' };
      const region = draw();
      expect(region, status).not.toBeNull();
      expect(region?.textContent, status).toBe('');
    }
  });

  it('says offline with changes waiting, and goes to Account from its button', () => {
    store.sync = { status: 'queued', at: 0, error: '' };
    const region = draw();
    expect(region?.textContent).toContain('Offline · changes waiting');
    expect(region?.className).toContain('sync-strip-warn');
    act(() => region?.querySelector('button')?.click());
    expect(store.went).toEqual([{ type: 'go', screen: 'account' }]);
  });

  it('asks for a choice when two versions are waiting', () => {
    store.sync = { status: 'review', at: 0, error: '' };
    const region = draw();
    expect(region?.textContent).toContain('Two versions need your review');
    expect(region?.querySelector('button')?.textContent).toBe('Choose');
  });

  it('stays quiet on Account, which already says all of it', () => {
    store.sync = { status: 'review', at: 0, error: '' };
    store.state = { screen: 'account' };
    expect(draw()?.textContent).toBe('');
  });

  it('says offline without an account, and offers nothing to press', () => {
    store.sync = { status: 'signed-out', at: 0, error: '' };
    const was = Object.getOwnPropertyDescriptor(Navigator.prototype, 'onLine');
    Object.defineProperty(navigator, 'onLine', { configurable: true, get: () => false });
    try {
      const region = draw();
      expect(region?.textContent).toContain('Offline.');
      expect(region?.querySelector('button')).toBeNull();
      // And it goes when the connection comes back.
      Object.defineProperty(navigator, 'onLine', { configurable: true, get: () => true });
      act(() => window.dispatchEvent(new Event('online')));
      expect(region?.textContent).toBe('');
    } finally {
      delete (navigator as unknown as Record<string, unknown>).onLine;
      if (was) Object.defineProperty(Navigator.prototype, 'onLine', was);
    }
  });
});
