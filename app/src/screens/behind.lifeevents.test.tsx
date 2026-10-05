// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';

/**
 * The life-event panel on Behind: absent unless `VITE_ME_LIFE_EVENTS` is on,
 * keyed to the account, and a help route seeds Help with nothing filled in.
 * The flag is read at import, so it is switched by a mock here.
 */

const mock = vi.hoisted(() => ({ on: false, account: null as string | null, dispatch: vi.fn() }));

vi.mock('../lib/lifeevents', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../lib/lifeevents')>()),
  lifeEventsOn: () => mock.on,
}));
vi.mock('../state/store', () => ({
  useStore: () => ({
    state: { windows: [], done: {}, spent: {}, attendPolicy: {}, attendance: {}, term: '2026FA' },
    catalog: { empty: false, courses: [], items: [], byId: {} },
    courseCode: () => '',
    dispatch: mock.dispatch,
  }),
  useNow: () => new Date(2026, 9, 1, 12, 0),
  useAccountId: () => mock.account,
}));

import { Behind } from './Behind';
import { takeHelpSeed } from '../lib/help-routes';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
let root: Root;
let host: HTMLDivElement;

beforeEach(() => {
  localStorage.clear();
  vi.clearAllMocks();
  mock.on = false;
  mock.account = null;
  host = document.createElement('div');
  document.body.append(host);
  act(() => {
    root = createRoot(host);
  });
});

/* No root outlives the test that made it. See `src/rootunmount.test.ts`. */
afterEach(() => {
  act(() => root.unmount());
  host.remove();
  localStorage.clear();
  takeHelpSeed();
});

const button = (name: RegExp) => [...host.querySelectorAll('button')].find((b) => name.test(b.textContent ?? '') || name.test(b.getAttribute('aria-label') ?? ''));

it('does not draw the panel, or write anything, while the flag is off', () => {
  act(() => root.render(<Behind />));
  expect(host.querySelector('#life-events-heading')).toBeNull();
  expect(host.textContent).not.toMatch(/If something has changed/);
  expect(localStorage.length).toBe(0);
});

it('draws it when the flag is on, keeps it under the signed-in account, and keeps the rest of the screen', () => {
  mock.on = true;
  mock.account = 'acct-1';
  act(() => root.render(<Behind />));
  expect(host.querySelector('#life-events-heading')!.textContent).toBe('If something has changed');
  expect(host.textContent).toMatch(/Where it actually stands/); // the screen is still the screen
  act(() => button(/My availability changed/)!.click());
  expect(Object.keys(localStorage)).toEqual(['semester.life-events.v1:acct-1']);
  expect(JSON.parse(localStorage.getItem('semester.life-events.v1:acct-1')!)).toEqual({ events: [{ id: 'availability', chosenOn: '2026-10-01' }] });
});

it('keeps a signed-out visit on a key of its own, apart from any account’s', () => {
  mock.on = true;
  act(() => root.render(<Behind />));
  act(() => button(/My work schedule changed/)!.click());
  expect(Object.keys(localStorage)).toEqual(['semester.life-events.v1:device']);
});

it('sends a chosen route to Help with nothing filled in and nothing ticked', () => {
  mock.on = true;
  act(() => root.render(<Behind />));
  act(() => button(/I am ill or recovering/)!.click());
  act(() => button(/Ask for help with: Stuck on course material/)!.click());
  expect(mock.dispatch).toHaveBeenCalledWith({ type: 'go', screen: 'university' });
  const seed = takeHelpSeed();
  expect(seed).toEqual({ need: 'course', from: 'You said something has changed. Nothing else is filled in.', fields: {} });
  expect(seed).not.toHaveProperty('question');
});

it('goes to the screens it suggests, and only when asked', () => {
  mock.on = true;
  act(() => root.render(<Behind />));
  act(() => button(/There is a family emergency/)!.click());
  expect(mock.dispatch).not.toHaveBeenCalled();
  act(() => button(/Sort what is behind/)!.click());
  expect(mock.dispatch).toHaveBeenCalledWith({ type: 'go', screen: 'behind' });
});
