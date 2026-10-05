// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';

/** The "You said, we changed" panel on What's new: absent unless the flag is on, and the notes stay. */

const mock = vi.hoisted(() => ({ on: false }));

vi.mock('../lib/momentfeedback', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../lib/momentfeedback')>()),
  momentFeedbackOn: () => mock.on,
}));
vi.mock('../state/store', () => ({
  useStore: () => ({ state: {}, dispatch: vi.fn() }),
  useAccountId: () => null,
  useNow: () => new Date(2026, 9, 1, 12, 0),
}));

import { WhatsNew } from './WhatsNew';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
let root: Root;
let host: HTMLDivElement;

beforeEach(() => {
  localStorage.clear();
  mock.on = false;
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
});

it('does not draw the panel while the flag is off, and the notes are all still there', () => {
  act(() => root.render(<WhatsNew />));
  expect(host.querySelector('#you-said-heading')).toBeNull();
  expect(host.querySelector('#wn-known')).not.toBeNull();
  expect(host.querySelector('#wn-new')).not.toBeNull();
});

it('draws it when the flag is on, with an honest empty log, between the notes and the ways to say something', () => {
  mock.on = true;
  act(() => root.render(<WhatsNew />));
  const panel = host.querySelector('#you-said-heading')!;
  expect(panel.textContent).toBe('You said, we changed');
  expect(host.textContent).toMatch(/Nothing has changed yet because of this/);
  const order = [...host.querySelectorAll('#wn-new, #you-said-heading')].map((e) => e.id);
  expect(order).toEqual(['wn-new', 'you-said-heading']);
  expect(host.textContent).toMatch(/Say something/);
});
