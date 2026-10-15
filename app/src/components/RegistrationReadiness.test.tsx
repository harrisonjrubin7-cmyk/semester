// @vitest-environment jsdom
import { afterEach, beforeAll, beforeEach, expect, it } from 'vitest';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { StoreProvider } from '../state/store';
import { loadSeed } from '../data/seed';
import { RegistrationReadiness } from './RegistrationReadiness';

/**
 * The readiness view leads with one line on where the student stands, and the
 * line is a word, not a colour: the state is in the text and in `data-state`.
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

it('opens with an overall status in words, ahead of the steps', () => {
  act(() =>
    root.render(
      <StoreProvider>
        <RegistrationReadiness />
      </StoreProvider>,
    ),
  );
  const overall = host.querySelector('.path-readiness-overall')!;
  expect(overall).not.toBeNull();
  expect(overall.textContent).toMatch(/^(Ready|Almost ready|Getting ready|Blocked|Information unavailable)\./);
  expect(overall.getAttribute('data-state')).toMatch(/^(ready|almost_ready|getting_ready|blocked|unavailable)$/);
  const list = host.querySelector('.path-readiness-list')!;
  expect(overall.compareDocumentPosition(list) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  // Preparation, not clearance: the standing disclaimer is still there.
  expect(host.textContent).toContain('not registration clearance');
});
