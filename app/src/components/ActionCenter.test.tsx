// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeAll, beforeEach, expect, it } from 'vitest';
import { loadSeed } from '../data/seed';
import type { Action } from '../lib/actions';
import { StoreProvider } from '../state/store';
import { ActionCenter, dueLine, tomorrowMorning } from './ActionCenter';

/**
 * The Action Center, worked the way a student works it: by buttons alone.
 */

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
const KEY = 'semester.actions.v1:device';
let root: Root;
let host: HTMLDivElement;

beforeAll(async () => {
  // The store's own seed import must have settled before the file ends.
  await loadSeed();
});

beforeEach(() => {
  localStorage.clear();
  host = document.createElement('div');
  document.body.append(host);
  act(() => {
    root = createRoot(host);
  });
});

/* No root outlives the test that made it. See `src/rootunmount.test.ts`. */
afterEach(() => {
  act(() => root.unmount());
  host.remove();
});

const DAY = 86_400_000;
const make = (i: number): Action => ({
  id: `a${i}`,
  type: 'deadline',
  title: `Task number ${i}`,
  whyItMatters: `Reason ${i}.`,
  priority: 'normal',
  dueAt: Date.now() + (i + 1) * DAY,
  source: { label: i === 0 ? 'estimated' : 'imported', system: 'Test source' },
  explanation: {
    trigger: 'Because.',
    factors: ['A factor'],
    expectedImpact: 'Things improve.',
    limitations: ['A limit'],
    alternatives: ['Something else'],
  },
  primary: { label: 'Open it', kind: 'navigate', target: '#/courses', requiresConfirmation: false },
});

const render = (actions: Action[]) =>
  act(() => {
    root.render(
      <StoreProvider>
        <ActionCenter actions={actions} />
      </StoreProvider>,
    );
  });

const button = (name: RegExp, within: ParentNode = host) =>
  [...within.querySelectorAll('button')].find((b) => name.test(b.textContent ?? '')) as HTMLButtonElement | undefined;
const stored = () => JSON.parse(localStorage.getItem(KEY) ?? '{"choices":{}}').choices;

it('shows one most important, five next, and the rest behind View all', () => {
  render(Array.from({ length: 8 }, (_, i) => make(i)));
  expect(host.querySelector('#action-top-title')?.textContent).toBe('Task number 0');
  const lists = host.querySelectorAll('ol.action-list');
  expect(lists[0].querySelectorAll(':scope > li')).toHaveLength(5);
  expect(host.textContent).toContain('View all (2 more)');
});

it('shows the source, and opens the whole explanation with its working in a sheet', () => {
  // jsdom has no matchMedia; a narrow window, so "Why this?" is the phone's sheet.
  window.matchMedia = (() => ({ matches: false, addEventListener: () => {}, removeEventListener: () => {} })) as unknown as typeof window.matchMedia;
  render([make(0)]);
  const top = host.querySelector('article')!;
  expect(top.querySelector('[data-source="estimated"]')).not.toBeNull();
  act(() => button(/^Why this\?$/, top)?.click());
  const why = host.querySelector('[role="dialog"]')!;
  for (const s of ['Because.', 'A factor', 'Things improve.', 'A limit', 'Something else', 'Test source', 'How it was ranked']) {
    expect(why.textContent, s).toContain(s);
  }
  act(() => button(/^Close$/, why)?.click());
  expect(host.querySelector('[role="dialog"]')).toBeNull();
});

it('marks done, stores it, moves the next one up — and can be undone', () => {
  render([make(0), make(1)]);
  act(() => button(/^Done$/, host.querySelector('article')!)?.click());
  expect(stored().a0.status).toBe('completed');
  expect(host.querySelector('#action-top-title')?.textContent).toBe('Task number 1');
  expect(host.querySelector('[role="status"]')?.textContent).toContain('Marked as done');

  act(() => button(/^Undo$/)?.click());
  expect(stored().a0).toBeUndefined();
  expect(host.querySelector('#action-top-title')?.textContent).toBe('Task number 0');
});

it('snoozes until tomorrow morning and says how many are snoozed', () => {
  render([make(0), make(1)]);
  act(() => button(/Snooze until tomorrow/, host.querySelector('article')!)?.click());
  const choice = stored().a0;
  expect(choice.status).toBe('snoozed');
  expect(choice.snoozedUntil).toBe(tomorrowMorning(Date.now()));
  expect(host.textContent).toContain('1 snoozed until tomorrow morning');
});

it('records a correction with a note, and says it was not sent anywhere', () => {
  render([make(0)]);
  act(() => button(/Something is wrong/)?.click());
  const box = host.querySelector('textarea')!;
  expect(box.closest('label')?.textContent).toContain('What is wrong with this?');
  expect(host.textContent).toContain('does not send it to anyone');
  expect(button(/Save note/)?.disabled).toBe(true);

  act(() => {
    const set = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')!.set!;
    set.call(box, 'The date is a week late');
    box.dispatchEvent(new Event('input', { bubbles: true }));
  });
  act(() => button(/Save note/)?.click());
  const choice = stored().a0;
  expect(choice.status).toBe('open');
  expect(choice.history.at(-1)).toMatchObject({ event: 'correct', note: 'The date is a week late' });
});

it('says so when there is nothing to do', () => {
  render([]);
  expect(host.textContent).toContain('Nothing needs you right now');
});

it('uses only buttons for its choices — no swipe, no long press', () => {
  render([make(0), make(1)]);
  for (const group of host.querySelectorAll('[role="group"]')) {
    for (const el of group.children) expect(el.tagName, el.textContent ?? '').toBe('BUTTON');
  }
});

it('counts calendar days, so two things due the same day say the same thing', () => {
  const now = new Date(2026, 8, 27, 12).getTime();
  const at = (d: number, h: number) => ({ ...make(0), dueAt: new Date(2026, 8, 27 + d, h).getTime() });
  // Found in the browser: 9 a.m. two days out read "Due tomorrow" beside a
  // same-day 11:59 p.m. deadline reading "Due in 2 days".
  expect(dueLine(at(2, 9), now)).toBe('Due in 2 days');
  expect(dueLine(at(2, 23), now)).toBe('Due in 2 days');
  expect(dueLine(at(1, 7), now)).toBe('Due tomorrow');
  expect(dueLine(at(0, 18), now)).toBe('Due today');
  expect(dueLine(at(0, 9), now)).toBe('Overdue');
});

it('with the help route off, "Ask for help" keeps the note and hands nothing over', async () => {
  const { helpSeedWaiting } = await import('../lib/help-routes');
  render([make(0)]);
  act(() => button(/Ask for help/)?.click());
  expect(host.querySelector('textarea')?.closest('label')?.textContent).toContain('What do you need help with?');
  expect(helpSeedWaiting()).toBe(false);
});
