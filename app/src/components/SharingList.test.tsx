// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeAll, beforeEach, expect, it } from 'vitest';
import { loadSeed } from '../data/seed';
import { EMPTY_FAMILY, newFamilyItem, newFamilyMember } from '../lib/family';
import { StoreProvider } from '../state/store';
import { SharingList } from './SharingList';

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
  root = createRoot(host);
});

/* No root outlives the test that made it. See `src/rootunmount.test.ts`. */
afterEach(() => {
  act(() => root.unmount());
  host.remove();
});

const render = () =>
  act(() =>
    root.render(
      <StoreProvider>
        <SharingList today="2026-09-27" />
      </StoreProvider>,
    ),
  );

it('says plainly that nothing is shared yet', () => {
  render();
  expect(host.textContent).toContain('A plan is shared only when you make a code for it');
  expect(host.textContent).toContain('No plans.');
});

it('lists each plan with what stops it being shareable, and marks a ready one', () => {
  const ready = { ...newFamilyMember(), name: 'Mom', relationship: 'Parent', expires: '2026-12-15' };
  ready.permissions.finances = 'selected';
  const open = { ...newFamilyMember(), name: 'Uncle Joe', expires: '' };
  const bill = { ...newFamilyItem(ready.id), category: 'finances' as const, title: 'Spring bill' };
  localStorage.setItem('semester.family.v1:device', JSON.stringify({ ...EMPTY_FAMILY, members: [ready, open], items: [bill] }));
  render();
  const rows = [...host.querySelectorAll('.sharing-list > li')].map((li) => li.textContent ?? '');
  expect(rows[0]).toContain('Mom · Parent');
  expect(rows[0]).toContain('1 item · until 2026-12-15');
  expect(rows[0]).toContain('Ready to share: make a code for it on Family → Preview.');
  expect(rows[1]).toContain('Uncle Joe');
  expect(rows[1]).toContain('Needs an end date');
  expect(rows[1]).toContain('Nothing is chosen yet');
});

it('says when saved plans cannot be read, rather than claiming there are none', () => {
  localStorage.setItem('semester.family.v1:device', JSON.stringify({ version: 1, members: 'broken' }));
  render();
  expect(host.querySelector('[role="alert"]')?.textContent).toContain('could not be read');
  expect(host.textContent).not.toContain('No plans.');
});
