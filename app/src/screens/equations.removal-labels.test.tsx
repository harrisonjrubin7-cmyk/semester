// @vitest-environment jsdom
import { afterEach, beforeAll, beforeEach, expect, it } from 'vitest';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { loadSeed } from '../data/seed';
import { STORAGE_KEY } from '../state/shape';
import { StoreProvider } from '../state/store';
import { Equations } from './Equations';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let host: HTMLDivElement;
let root: Root;

beforeAll(async () => {
  await loadSeed();
});

beforeEach(async () => {
  localStorage.clear();
  localStorage.setItem(STORAGE_KEY, JSON.stringify({
    schemaVersion: 6,
    mathTab: 'kept',
    equations: [
      {
        id: 'average-mean',
        name: 'Average',
        latex: '\\frac{x+y}{2}',
        note: 'Arithmetic mean',
        courseId: null,
        itemId: null,
        created: 1,
      },
      {
        id: 'average-sum',
        name: 'Average',
        latex: 'x+y',
        note: 'Running total',
        courseId: null,
        itemId: null,
        created: 2,
      },
    ],
  }));
  host = document.createElement('div');
  document.body.append(host);
  root = createRoot(host);
  await act(async () => {
    root.render(
      <StoreProvider>
        <Equations />
      </StoreProvider>,
    );
  });
  const kept = [...host.querySelectorAll<HTMLButtonElement>('button')]
    .find((button) => button.textContent === 'Kept (2)');
  expect(kept).toBeTruthy();
  await act(async () => kept?.click());
});

afterEach(async () => {
  await act(async () => root.unmount());
  host.remove();
  localStorage.clear();
});

it('distinguishes same-name formula removals by their represented notation, filing and note', () => {
  const names = [...host.querySelectorAll<HTMLButtonElement>('button[aria-label^="Remove Average equation: "]')]
    .map((button) => button.ariaLabel);

  expect(names).toEqual([
    'Remove Average equation: (x+y)/(2) · Personal · Arithmetic mean',
    'Remove Average equation: x+y · Personal · Running total',
  ]);
  expect(new Set(names).size).toBe(2);
});
