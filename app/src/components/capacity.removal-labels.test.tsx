// @vitest-environment jsdom
import { act, useEffect } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeAll, beforeEach, expect, it } from 'vitest';
import { loadSeed } from '../data/seed';
import { STORAGE_KEY, type State } from '../state/shape';
import { StoreProvider, useStore } from '../state/store';
import { Capacity } from './Capacity';

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
    rest: [
      {
        id: 'dinner-mw',
        label: 'Dinner',
        days: [1, 3],
        from: 18 * 60,
        to: 19 * 60,
      },
      {
        id: 'dinner-tu-th',
        label: 'Dinner',
        days: [2, 4],
        from: 19 * 60 + 30,
        to: 20 * 60 + 30,
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
        <Capacity />
      </StoreProvider>,
    );
  });
});

afterEach(async () => {
  await act(async () => root.unmount());
  host.remove();
  localStorage.clear();
});

it('identifies duplicate protected-time removals by their represented schedule facts', async () => {
  const mondayWednesday = host.querySelector<HTMLButtonElement>(
    'button[aria-label="Remove protected time 1 of 2, Dinner: Monday, Wednesday · 6:00 PM–7:00 PM"]',
  );
  const tuesdayThursday = host.querySelector<HTMLButtonElement>(
    'button[aria-label="Remove protected time 2 of 2, Dinner: Tuesday, Thursday · 7:30 PM–8:30 PM"]',
  );

  expect(mondayWednesday).not.toBeNull();
  expect(tuesdayThursday).not.toBeNull();

  await act(async () => tuesdayThursday?.click());

  expect(seen.rest.map((block) => block.id)).toEqual(['dinner-mw']);
  expect(seen.undone?.label).toBe('Protected time removed');
});
