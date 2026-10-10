// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { beforeAll, beforeEach, afterEach, expect, it, vi } from 'vitest';
import { StoreProvider, useStore } from '../state/store';
import { AIProvider } from '../ai/store';
import { loadSeed } from '../data/seed';
import { Calendar } from './Calendar';

/**
 * The agenda view (§94), through the screen rather than `lib/agenda.ts`.
 *
 * The unit file proves which things land on which day. This proves the
 * segment is there, that choosing it draws the list rather than one of the
 * four grids, that an action you add shows up under its own day in date
 * order, and that a day heading opens that day — the list is a way in to the
 * grids, not a dead end beside them.
 *
 * Measured against a revert: with the `'agenda'` branch removed from the view
 * switch in `Calendar()`, the screen falls through to the month grid and every
 * test below but the first goes red. The first is the control — it asserts the
 * segment exists, which the revert leaves in place.
 */

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
let host: HTMLDivElement;
let root: Root;

function Harness() {
  const { dispatch } = useStore();
  const add = (title: string, date: string) =>
    dispatch({ type: 'addTask', task: { title, date, time: '', note: '', courseId: null } });
  return (
    <div className="device">
      <Calendar />
      <button onClick={() => add('Draft the lab memo', '2026-10-09')}>Add later</button>
      <button onClick={() => add('Email the TA', '2026-10-07')}>Add today</button>
    </div>
  );
}

function button(name: string) {
  const el = [...host.querySelectorAll('button')].find((b) => b.textContent?.trim() === name);
  if (!el) throw new Error('Missing button ' + name);
  return el;
}
const click = (name: string) => act(() => button(name).click());
const headings = () =>
  [...host.querySelectorAll('section[aria-label]')].map((s) => s.getAttribute('aria-label') ?? '');

beforeAll(() => loadSeed());
beforeEach(async () => {
  localStorage.clear();
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date(2026, 9, 7, 12));
  window.matchMedia = (() => ({
    matches: false,
    addEventListener() {},
    removeEventListener() {},
  })) as unknown as typeof window.matchMedia;
  host = document.createElement('div');
  document.body.append(host);
  root = createRoot(host);
  await act(async () =>
    root.render(
      <StoreProvider>
        <AIProvider>
          <Harness />
        </AIProvider>
      </StoreProvider>,
    ),
  );
});
afterEach(() => {
  act(() => root.unmount());
  host.remove();
  localStorage.clear();
  vi.useRealTimers();
});

it('offers Agenda beside the four grids, which is the control', () => {
  expect(button('Agenda')).toBeTruthy();
});

it('draws the list instead of a grid, counting what is in it', () => {
  click('Agenda');
  expect(host.querySelector('[role="grid"]')).toBeNull();
  expect(host.textContent).toMatch(/in the next 14 days/);
});

it('lists your actions under their own days, soonest first', () => {
  click('Add later');
  click('Add today');
  click('Agenda');
  const text = host.textContent ?? '';
  expect(text).toContain('Draft the lab memo');
  expect(text).toContain('Email the TA');
  expect(text.indexOf('Email the TA')).toBeLessThan(text.indexOf('Draft the lab memo'));
  expect(headings().some((h) => h.startsWith('Today'))).toBe(true);
});

it('opens a day from its heading', () => {
  click('Add later');
  click('Agenda');
  const heading = [...host.querySelectorAll('section[aria-label] button')].find((b) =>
    b.getAttribute('aria-label')?.startsWith('Open') && b.getAttribute('aria-label')?.includes('9'),
  ) as HTMLButtonElement | undefined;
  expect(heading).toBeTruthy();
  act(() => heading!.click());
  // The day view: no agenda count, and the action is still there on its day.
  expect(host.textContent).not.toMatch(/in the next 14 days/);
  expect(host.textContent).toContain('Draft the lab memo');
});
