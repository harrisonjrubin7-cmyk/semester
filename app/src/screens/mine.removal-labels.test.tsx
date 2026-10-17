// @vitest-environment jsdom
import { afterEach, beforeAll, beforeEach, expect, it } from 'vitest';
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
  localStorage.clear();
  host = document.createElement('div');
  document.body.append(host);
  root = createRoot(host);
});

afterEach(() => {
  act(() => root.unmount());
  host.remove();
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
  expect(edits).toHaveLength(3);
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
  expect(
    host
      .querySelector('button[aria-label$="Plan review: Personal · Tue Oct 20 · 9:00 AM · 1/2 steps"]')
      ?.getAttribute('aria-label'),
  ).toMatch(/^Delete action \d+ of \d+, Plan review:/);
});

it('removes only the represented exact-duplicate action', async () => {
  await show();

  const edits = host.querySelectorAll('button[aria-label="Edit Plan review"]');
  click(edits[1]);
  click(edits[2]);

  const removals = host.querySelectorAll<HTMLButtonElement>(
    'button[aria-label$="Plan review: Personal · Thu Oct 22 · 2:00 PM"]',
  );
  expect(removals).toHaveLength(2);
  expect(removals[0].getAttribute('aria-label')).not.toBe(removals[1].getAttribute('aria-label'));
  click(removals[1]);

  expect(host.querySelectorAll('button[aria-label="Edit Plan review"]')).toHaveLength(1);
  const remaining = host.querySelectorAll<HTMLButtonElement>(
    'button[aria-label$="Plan review: Personal · Thu Oct 22 · 2:00 PM"]',
  );
  expect(remaining).toHaveLength(1);
  expect(remaining[0].getAttribute('aria-label')).toMatch(/^Delete action \d+ of \d+, Plan review:/);
});

it('removes only the represented exact-duplicate appointment', async () => {
  await show();
  click([...host.querySelectorAll('button')].find((button) => button.textContent === 'Events')!);

  const edits = host.querySelectorAll('button[aria-label="Edit Office hours"]');
  expect(edits).toHaveLength(3);
  click(edits[1]);
  click(edits[2]);

  const removals = [...host.querySelectorAll<HTMLButtonElement>('button[aria-label^="Delete appointment"]')]
    .filter((button) => button.getAttribute('aria-label')?.includes('Office hours: Fri Oct 23'));
  expect(removals).toHaveLength(2);
  expect(removals[0].getAttribute('aria-label')).not.toBe(removals[1].getAttribute('aria-label'));
  for (const removal of removals) {
    expect(removal.getAttribute('aria-label')).toContain('3:00p · Study · Online · 1 hour');
  }
  click(removals[1]);

  expect(host.querySelectorAll('button[aria-label="Edit Office hours"]')).toHaveLength(1);
  const remaining = [...host.querySelectorAll<HTMLButtonElement>('button[aria-label^="Delete appointment"]')]
    .filter((button) => button.getAttribute('aria-label')?.includes('Office hours: Fri Oct 23'));
  expect(remaining).toHaveLength(1);
  expect(remaining[0].getAttribute('aria-label')).toMatch(/^Delete appointment \d+ of \d+, Office hours:/);
});
