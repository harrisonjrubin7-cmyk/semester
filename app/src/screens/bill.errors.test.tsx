// @vitest-environment jsdom
import { afterEach, beforeAll, beforeEach, expect, it } from 'vitest';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { StoreProvider } from '../state/store';
import { loadSeed } from '../data/seed';
import { Costs } from './Costs';

/**
 * The bill is the first screen to draw `ErrorSummary` (the out-of-pocket form
 * on the same screen is the second): pressing "Add it" on an empty form is
 * wrong in two places, and the screen says so in one list as well as at each
 * box. The default tab is the bill, so that is the form this drives.
 */

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
afterEach(() => {
  act(() => root.unmount());
  host.remove();
  localStorage.clear();
});

it('lists both problems of an empty submit on the bill, each a link to its own box', () => {
  act(() =>
    root.render(
      <StoreProvider>
        <Costs />
      </StoreProvider>,
    ),
  );
  expect(host.querySelector('.error-summary')).toBeNull();
  const add = [...host.querySelectorAll('button')].find((b) => b.textContent?.trim() === 'Add it')!;
  act(() => add.click());

  const links = [...host.querySelectorAll<HTMLAnchorElement>('.error-summary a')];
  expect(links.map((a) => a.textContent?.split(':')[0])).toEqual(['What it is', 'How much']);
  act(() => links[1]!.click());
  expect(document.activeElement?.getAttribute('aria-label')).toBe('How much');
  expect(host.querySelector('.error-summary')).not.toBeNull();
});
