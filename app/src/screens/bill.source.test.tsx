// @vitest-environment jsdom
import { afterEach, beforeAll, beforeEach, expect, it } from 'vitest';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { StoreProvider } from '../state/store';
import { loadSeed } from '../data/seed';
import { Bill } from './Bill';

/**
 * The figures on this screen are the ones the student typed in. The screen
 * says so in the app's trust vocabulary, and does not claim the school's own
 * record stands behind them.
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

it('labels the tracked total as student entered, and never as institution verified', () => {
  act(() =>
    root.render(
      <StoreProvider>
        <Bill schoolAccount={false} />
      </StoreProvider>,
    ),
  );
  const badge = host.querySelector('[data-source="student_entered"]');
  expect(badge?.textContent).toContain('Student entered');
  expect(host.querySelector('[data-source="institution_verified"]')).toBeNull();
});
