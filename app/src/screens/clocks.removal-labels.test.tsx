// @vitest-environment jsdom
import { act, useEffect } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeAll, beforeEach, expect, it } from 'vitest';
import { loadSeed } from '../data/seed';
import { STORAGE_KEY, type State } from '../state/shape';
import { StoreProvider, useStore } from '../state/store';
import { Clocks } from './Clocks';

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
    timers: [
      {
        id: 'pasta-short',
        label: 'Pasta',
        seconds: 600,
        endsAt: null,
        left: 420,
        rangAt: null,
        created: 1,
      },
      {
        id: 'pasta-long',
        label: 'Pasta',
        seconds: 900,
        endsAt: null,
        left: 780,
        rangAt: null,
        created: 2,
      },
    ],
    alarms: [
      {
        id: 'morning-class',
        label: 'Morning class',
        at: 450,
        days: [1, 3, 5],
        on: false,
        lastRang: '',
        ringingAt: 0,
        created: 3,
      },
      {
        id: 'lab-shift',
        label: 'Lab shift',
        at: 450,
        days: [2, 4],
        on: false,
        lastRang: '',
        ringingAt: 0,
        created: 4,
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
        <Clocks />
      </StoreProvider>,
    );
  });
});

afterEach(async () => {
  await act(async () => root.unmount());
  host.remove();
  localStorage.clear();
});

it('distinguishes same-label timers by their represented duration, remainder and state', async () => {
  const names = [...host.querySelectorAll<HTMLButtonElement>('button[aria-label^="Clear timer Pasta "]')]
    .map((button) => button.ariaLabel);

  expect(names).toEqual([
    'Clear timer Pasta · 10 minutes total · 7:00 remaining · paused',
    'Clear timer Pasta · 15 minutes total · 13:00 remaining · paused',
  ]);
  expect(new Set(names).size).toBe(2);

  await act(async () => host.querySelector<HTMLButtonElement>(
    'button[aria-label="Clear timer Pasta · 15 minutes total · 13:00 remaining · paused"]',
  )?.click());

  expect(seen.timers.map((timer) => timer.id)).toEqual(['pasta-short']);
  expect(seen.alarms.map((alarm) => alarm.id)).toEqual(['morning-class', 'lab-shift']);
});

it('distinguishes same-time alarms by their represented label, schedule and state', async () => {
  const alarms = [...host.querySelectorAll<HTMLButtonElement>('button')]
    .find((button) => button.textContent === 'Alarms (2)');
  await act(async () => alarms?.click());

  const names = [...host.querySelectorAll<HTMLButtonElement>('button[aria-label^="Delete 7:30 AM alarm: "]')]
    .map((button) => button.ariaLabel);

  expect(names).toEqual([
    'Delete 7:30 AM alarm: Morning class · Mon, Wed, Fri · off',
    'Delete 7:30 AM alarm: Lab shift · Tue, Thu · off',
  ]);
  expect(new Set(names).size).toBe(2);

  await act(async () => host.querySelector<HTMLButtonElement>(
    'button[aria-label="Delete 7:30 AM alarm: Lab shift · Tue, Thu · off"]',
  )?.click());

  expect(seen.alarms.map((alarm) => alarm.id)).toEqual(['morning-class']);
  expect(seen.timers.map((timer) => timer.id)).toEqual(['pasta-short', 'pasta-long']);
});
