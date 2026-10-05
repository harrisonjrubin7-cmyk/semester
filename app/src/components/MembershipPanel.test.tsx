// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeAll, beforeEach, expect, it } from 'vitest';
import { loadSeed } from '../data/seed';
import { PLANS } from '../lib/plans';
import { StoreProvider } from '../state/store';
import { MembershipPanel } from './MembershipPanel';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
let root: Root;
let host: HTMLDivElement;

beforeAll(async () => {
  await loadSeed();
});

beforeEach(() => {
  localStorage.clear();
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
});

const render = () =>
  act(() => {
    root.render(
      <StoreProvider>
        <MembershipPanel />
      </StoreProvider>,
    );
  });
const button = (name: RegExp) => [...host.querySelectorAll('button')].find((b) => name.test(b.textContent ?? ''))!;

it('says you are on Free and that nothing is for sale', () => {
  render();
  expect(host.textContent).toContain('You are on Semester Free');
  expect(host.textContent).toContain('not on sale in this build');
});

it('explains upgrade and cancel rather than doing either', () => {
  render();
  act(() => button(/^View planned Plus$/).click());
  expect(button(/^View planned Plus$/).getAttribute('aria-expanded')).toBe('true');
  expect(host.querySelector('[role="status"]')?.textContent).toMatch(/Nothing has been charged/);
  act(() => button(/Cancel membership/).click());
  expect(host.querySelector('[role="status"]')?.textContent).toMatch(/nothing to cancel/);
});

it('compares every plan, and marks yours', () => {
  render();
  for (const p of PLANS) expect(host.textContent, p.name).toContain(p.name);
  expect(host.textContent).toContain('Semester Free · your plan');
  expect(host.textContent).toContain('(planned)');
});

it('keeps export and deletion one tap away, and shows no payments', () => {
  render();
  expect(button(/Export your data/)).toBeDefined();
  expect(button(/Delete your data/)).toBeDefined();
  expect(host.textContent).toContain('No payments. Semester has never charged you');
});

it('uses only real, named buttons, none disabled', () => {
  render();
  for (const b of host.querySelectorAll('button')) {
    expect(b.hasAttribute('disabled'), b.textContent ?? '').toBe(false);
    expect((b.textContent ?? '').trim().length).toBeGreaterThan(0);
  }
});
