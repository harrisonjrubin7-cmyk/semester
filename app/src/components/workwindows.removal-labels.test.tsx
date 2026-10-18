// @vitest-environment jsdom
import { act, useEffect } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeAll, beforeEach, expect, it } from 'vitest';
import { loadSeed } from '../data/seed';
import { STORAGE_KEY, type State } from '../state/shape';
import { StoreProvider, useStore } from '../state/store';
import { WorkWindows } from './WorkWindows';

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
    windows: [
      {
        id: 'study-mwf',
        label: 'Study time',
        days: [1, 3, 5],
        from: 18 * 60,
        to: 20 * 60,
      },
      {
        id: 'study-tu-th',
        label: 'Study time',
        days: [2, 4],
        from: 19 * 60 + 30,
        to: 22 * 60,
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
        <WorkWindows />
      </StoreProvider>,
    );
  });
});

afterEach(async () => {
  await act(async () => root.unmount());
  host.remove();
  localStorage.clear();
});

it('identifies duplicate work-window removals by their represented schedule facts', async () => {
  const mondayWednesdayFriday = host.querySelector<HTMLButtonElement>(
    'button[aria-label="Remove work window 1 of 2, Study time: Mon, Wed, Fri · 6:00p – 8:00p · 6 hours a week"]',
  );
  const tuesdayThursday = host.querySelector<HTMLButtonElement>(
    'button[aria-label="Remove work window 2 of 2, Study time: Tue, Thu · 7:30p – 10:00p · 5 hours a week"]',
  );

  expect(mondayWednesdayFriday).not.toBeNull();
  expect(tuesdayThursday).not.toBeNull();

  await act(async () => tuesdayThursday?.click());

  expect(seen.windows.map((window) => window.id)).toEqual(['study-mwf']);
  expect(seen.undone?.label).toBe('Working hours removed');
});
