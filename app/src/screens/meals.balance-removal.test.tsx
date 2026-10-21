// @vitest-environment jsdom
import { act, useEffect } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeAll, beforeEach, expect, it } from 'vitest';
import { loadSeed } from '../data/seed';
import { formatDate } from '../lib/locale';
import { STORAGE_KEY, type State } from '../state/shape';
import { StoreProvider, useStore } from '../state/store';
import { Meals } from './Meals';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const FIRST_AT = new Date(2026, 9, 15, 12).getTime();
let host: HTMLDivElement;
let root: Root;
let seen: State;

function Probe() {
  const { state } = useStore();
  useEffect(() => {
    seen = state;
  });
  return null;
}

beforeAll(async () => {
  await loadSeed();
});

beforeEach(async () => {
  localStorage.clear();
  localStorage.setItem(STORAGE_KEY, JSON.stringify({
    schemaVersion: 6,
    term: '2026FA',
    balances: [
      { id: 'newer', at: FIRST_AT, swipes: 42, cashCents: 1250, diningCents: 1800, term: '2026FA' },
      { id: 'duplicate', at: FIRST_AT, swipes: 42, cashCents: 1250, diningCents: 1800, term: '2026FA' },
    ],
  }));
  host = document.createElement('div');
  document.body.append(host);
  root = createRoot(host);
  await act(async () => {
    root.render(
      <StoreProvider>
        <Probe />
        <Meals />
      </StoreProvider>,
    );
  });
});

afterEach(async () => {
  await act(async () => root.unmount());
  host.remove();
  localStorage.clear();
});

it('distinguishes exact-duplicate balance readings and removes only the selected stable id', async () => {
  const facts = `from ${formatDate(FIRST_AT)}: 42 swipes · $12.50 Commodore Cash · $18.00 meal money`;
  const first = host.querySelector<HTMLButtonElement>(
    `button[aria-label="Remove balance reading 1 of 2 ${facts}"]`,
  );
  const second = host.querySelector<HTMLButtonElement>(
    `button[aria-label="Remove balance reading 2 of 2 ${facts}"]`,
  );

  expect(host.textContent).toContain('42 swipes · $12.50 Commodore Cash · $18.00 meal money');
  expect(first).not.toBeNull();
  expect(second).not.toBeNull();

  await act(async () => second?.click());

  expect(seen.balances.map((reading) => reading.id)).toEqual(['newer']);
  expect(seen.undone?.label).toBe('Reading removed');
});
