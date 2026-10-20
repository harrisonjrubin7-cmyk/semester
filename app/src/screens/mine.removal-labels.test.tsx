// @vitest-environment jsdom
import { afterEach, beforeAll, beforeEach, expect, it, vi } from 'vitest';
import { act, useEffect, useRef } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { loadSeed } from '../data/seed';
import { StoreProvider, useStore } from '../state/store';
import { Mine } from './Mine';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let host: HTMLDivElement;
let root: Root;

beforeAll(async () => {
  await loadSeed();
});

beforeEach(() => {
  // The seed dates are fixed; Mine orders by today, so today is fixed too.
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date(2026, 9, 19, 12));
  localStorage.clear();
  host = document.createElement('div');
  document.body.append(host);
  root = createRoot(host);
});

afterEach(() => {
  act(() => root.unmount());
  host.remove();
  vi.useRealTimers();
});

function SeedMine() {
  const { dispatch } = useStore();
  const seeded = useRef(false);

  useEffect(() => {
    if (seeded.current) return;
    seeded.current = true;
    dispatch({
      type: 'addTask',
      task: {
        title: 'Plan review',
        date: '2026-10-20',
        time: '9:00 AM',
        note: '',
        courseId: null,
        steps: [
          { id: 'first-outline', text: 'Draft outline', done: false },
          { id: 'second-outline', text: 'Draft outline', done: true },
        ],
      },
    });
    dispatch({
      type: 'addTask',
      task: {
        title: 'Plan review',
        date: '2026-10-22',
        time: '2:00 PM',
        note: '',
        courseId: null,
      },
    });
    dispatch({
      type: 'addAppointment',
      appointment: {
        title: 'Office hours',
        date: '2026-10-21',
        at: 600,
        time: '10:00a',
        minutes: 30,
        where: 'Library 201',
        note: '',
        kind: 'study',
      },
    });
    dispatch({
      type: 'addAppointment',
      appointment: {
        title: 'Office hours',
        date: '2026-10-23',
        at: 900,
        time: '3:00p',
        minutes: 60,
        where: 'Online',
        note: '',
        kind: 'study',
      },
    });
  }, [dispatch]);

  return null;
}

async function show() {
  await act(async () => {
    root.render(
      <StoreProvider>
        <SeedMine />
        <Mine />
      </StoreProvider>,
    );
    await Promise.resolve();
  });
}

function click(button: Element) {
  act(() => (button as HTMLButtonElement).click());
}

it('distinguishes repeated steps and same-title actions before removal', async () => {
  await show();

  const edits = host.querySelectorAll('button[aria-label="Edit Plan review"]');
  expect(edits).toHaveLength(2);
  click(edits[0]);

  expect(
    host.querySelector(
      'button[aria-label="Remove step 1 of 2 from Plan review: Draft outline · not done"]',
    ),
  ).toBeTruthy();
  expect(
    host.querySelector(
      'button[aria-label="Remove step 2 of 2 from Plan review: Draft outline · done"]',
    ),
  ).toBeTruthy();
  expect(host.querySelector('button[aria-label^="Delete action Plan review"]')?.getAttribute('aria-label')).toBe(
    'Delete action Plan review: Personal · Tue Oct 20 · 9:00 AM · 1/2 steps',
  );
});

it('distinguishes same-title appointments before removal', async () => {
  await show();
  click([...host.querySelectorAll('button')].find((button) => button.textContent === 'Events')!);

  const edits = host.querySelectorAll('button[aria-label="Edit Office hours"]');
  expect(edits).toHaveLength(2);
  click(edits[0]);

  expect(
    host.querySelector(
      'button[aria-label="Delete appointment Office hours: Wed Oct 21 · 10:00a · Study · Library 201 · 30 min"]',
    ),
  ).toBeTruthy();
});
