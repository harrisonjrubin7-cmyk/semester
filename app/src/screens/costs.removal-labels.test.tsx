// @vitest-environment jsdom
import { act, useEffect } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeAll, beforeEach, expect, it, vi } from 'vitest';
import { loadSeed } from '../data/seed';
import { STORAGE_KEY, type State } from '../state/shape';
import { StoreProvider, useStore } from '../state/store';
import { Costs } from './Costs';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

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
    costsTab: 'out',
    costs: [
      {
        id: 'materials-econ',
        courseId: 'econ',
        what: 'Course materials',
        kind: 'book',
        cents: 6499,
        rented: false,
        backCents: 2500,
        term: '2026FA',
        at: 1,
      },
      {
        id: 'materials-psci',
        courseId: 'psci',
        what: 'Course materials',
        kind: 'access',
        cents: 5000,
        rented: false,
        backCents: 0,
        term: '2026FA',
        at: 2,
      },
    ],
  }));
  host = document.createElement('div');
  document.body.append(host);
  root = createRoot(host);
  await act(async () => {
    root.render(
      <StoreProvider>
        <Probe />
        <Costs />
      </StoreProvider>,
    );
  });
  const outOfPocket = [...host.querySelectorAll<HTMLButtonElement>('button')]
    .find((button) => button.textContent === 'Out of pocket');
  await act(async () => outOfPocket?.click());
});

afterEach(async () => {
  await act(async () => root.unmount());
  host.remove();
  localStorage.clear();
});

it('identifies duplicate cost removals by every represented fact', async () => {
  const removals = await vi.waitFor(() => {
    const buttons = [...host.querySelectorAll<HTMLButtonElement>('button[aria-label^="Remove Course materials"]')];
    expect(buttons).toHaveLength(2);
    return buttons;
  });
  expect(removals.map((button) => button.ariaLabel)).toEqual([
    'Remove Course materials: ECON 1020 · Textbook · $25.00 back · $64.99',
    'Remove Course materials: PSCI 1104 · Access code · $50.00',
  ]);
  expect(new Set(removals.map((button) => button.ariaLabel)).size).toBe(2);

  await act(async () => removals[0]?.click());

  expect(seen.costs.map((row) => row.id)).toEqual(['materials-psci']);
  expect(seen.undone?.label).toBe('Cost removed');
});
