// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';

/**
 * Reconnecting catches up — pull, merge, then push — and does not only pull
 * (review fix). `refresh` pulls, and when the account had nothing new it
 * changes nothing that would set off the ordinary push, so an edit whose push
 * failed offline stayed on the device while the badge cleared. That the push
 * waits on a pull that succeeded is `state/catchup.test.tsx`.
 */

const calls: string[] = [];
const store = vi.hoisted(() => ({
  account: { id: 'u1' } as { id: string } | null,
}));
vi.mock('../state/store', () => ({
  useNow: () => new Date('2026-09-27T12:00:00Z'),
  useStore: () => ({
    account: store.account,
    sync: { status: 'error', at: 0, error: 'offline' },
    catchUp: async () => {
      calls.push('catch up');
      return true;
    },
  }),
}));

const { OfflineBanner } = await import('./OfflineBanner');

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
let host: HTMLDivElement;
let root: Root;

beforeEach(() => {
  localStorage.clear();
  calls.length = 0;
  store.account = { id: 'u1' };
  host = document.createElement('div');
  document.body.append(host);
  root = createRoot(host);
});

afterEach(async () => {
  await act(async () => root.unmount());
  host.remove();
  localStorage.clear();
});

const settle = () => act(async () => new Promise((r) => setTimeout(r, 20)));

it('catches up when the connection comes back with changes waiting', async () => {
  await act(async () => root.render(<OfflineBanner online={false} />));
  await settle();
  expect(JSON.parse(localStorage.getItem('semester.offline-ledger.v1:u1')!).unsyncedSince).not.toBeNull();
  await act(async () => root.render(<OfflineBanner online />));
  await settle();
  expect(calls).toEqual(['catch up']);
});

it('does neither with no account (the control)', async () => {
  store.account = null;
  await act(async () => root.render(<OfflineBanner online={false} />));
  await act(async () => root.render(<OfflineBanner online />));
  await settle();
  expect(calls).toEqual([]);
});
