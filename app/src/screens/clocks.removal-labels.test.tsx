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
        id: 'pasta-long-one',
        label: 'Pasta',
        seconds: 900,
        endsAt: null,
        left: 780,
        rangAt: null,
        created: 2,
      },
      {
        id: 'pasta-long-two',
        label: 'Pasta',
        seconds: 900,
        endsAt: null,
        left: 780,
        rangAt: null,
        created: 3,
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
        created: 4,
      },
      {
        id: 'lab-shift-one',
        label: 'Lab shift',
        at: 450,
        days: [2, 4],
        on: false,
        lastRang: '',
        ringingAt: 0,
        created: 5,
      },
      {
        id: 'lab-shift-two',
        label: 'Lab shift',
        at: 450,
        days: [2, 4],
        on: false,
        lastRang: '',
        ringingAt: 0,
        created: 6,
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

it('distinguishes exact-duplicate timer clears by represented position', async () => {
  const names = [...host.querySelectorAll<HTMLButtonElement>('button[aria-label^="Clear timer "]')]
    .map((button) => button.ariaLabel);

  expect(names).toEqual([
    'Clear timer 1 of 3, Pasta · 10 minutes total · 7:00 remaining · paused',
    'Clear timer 2 of 3, Pasta · 15 minutes total · 13:00 remaining · paused',
    'Clear timer 3 of 3, Pasta · 15 minutes total · 13:00 remaining · paused',
  ]);
  expect(new Set(names).size).toBe(3);

  await act(async () => host.querySelector<HTMLButtonElement>(
    'button[aria-label="Clear timer 3 of 3, Pasta · 15 minutes total · 13:00 remaining · paused"]',
  )?.click());

  expect(seen.timers.map((timer) => timer.id)).toEqual(['pasta-short', 'pasta-long-one']);
  expect(seen.alarms.map((alarm) => alarm.id)).toEqual(['morning-class', 'lab-shift-one', 'lab-shift-two']);
});

it('distinguishes exact-duplicate timer resets by represented position', async () => {
  const names = [...host.querySelectorAll<HTMLButtonElement>('button[aria-label^="Reset timer "]')]
    .map((button) => button.ariaLabel);

  expect(names).toEqual([
    'Reset timer 1 of 3, Pasta · 10 minutes total · 7:00 remaining · paused',
    'Reset timer 2 of 3, Pasta · 15 minutes total · 13:00 remaining · paused',
    'Reset timer 3 of 3, Pasta · 15 minutes total · 13:00 remaining · paused',
  ]);
  expect(new Set(names).size).toBe(3);

  await act(async () => host.querySelector<HTMLButtonElement>(
    'button[aria-label="Reset timer 3 of 3, Pasta · 15 minutes total · 13:00 remaining · paused"]',
  )?.click());

  expect(seen.timers.map(({ id, left }) => ({ id, left }))).toEqual([
    { id: 'pasta-short', left: 420 },
    { id: 'pasta-long-one', left: 780 },
    { id: 'pasta-long-two', left: 900 },
  ]);
  expect(seen.alarms.map((alarm) => alarm.id)).toEqual(['morning-class', 'lab-shift-one', 'lab-shift-two']);
});

it('distinguishes exact-duplicate alarm deletes by represented position', async () => {
  const alarms = [...host.querySelectorAll<HTMLButtonElement>('button')]
    .find((button) => button.textContent === 'Alarms (3)');
  await act(async () => alarms?.click());

  const names = [...host.querySelectorAll<HTMLButtonElement>('button[aria-label^="Delete alarm "]')]
    .map((button) => button.ariaLabel);

  expect(names).toEqual([
    'Delete alarm 1 of 3 at 7:30 AM: Morning class · Mon, Wed, Fri · off',
    'Delete alarm 2 of 3 at 7:30 AM: Lab shift · Tue, Thu · off',
    'Delete alarm 3 of 3 at 7:30 AM: Lab shift · Tue, Thu · off',
  ]);
  expect(new Set(names).size).toBe(3);

  await act(async () => host.querySelector<HTMLButtonElement>(
    'button[aria-label="Delete alarm 3 of 3 at 7:30 AM: Lab shift · Tue, Thu · off"]',
  )?.click());

  expect(seen.alarms.map((alarm) => alarm.id)).toEqual(['morning-class', 'lab-shift-one']);
  expect(seen.timers.map((timer) => timer.id)).toEqual(['pasta-short', 'pasta-long-one', 'pasta-long-two']);
});
