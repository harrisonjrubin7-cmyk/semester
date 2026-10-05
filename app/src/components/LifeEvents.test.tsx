// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import type { NeedId } from '../lib/help-routes';
import type { Screen } from '../lib/types';
import { LifeEvents } from './LifeEvents';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
const KEY = 'semester.life-events.v1:panel-test';
let root: Root;
let host: HTMLDivElement;
let went: Screen[];
let asked: NeedId[];

beforeEach(() => {
  localStorage.removeItem(KEY);
  went = [];
  asked = [];
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
  localStorage.removeItem(KEY);
  vi.restoreAllMocks();
});

const render = (today = '2026-10-01') =>
  act(() => root.render(<LifeEvents storageKey={KEY} today={today} onGo={(s) => went.push(s)} onHelp={(n) => asked.push(n)} />));
const button = (name: RegExp) => [...host.querySelectorAll('button')].find((b) => name.test(b.textContent ?? '') || name.test(b.getAttribute('aria-label') ?? ''));
const stored = () => JSON.parse(localStorage.getItem(KEY) ?? 'null');

it('starts with twelve plain choices, nothing chosen, no plan, and nothing to type in', () => {
  render();
  const group = host.querySelector('[role=group][aria-label="What has changed"]')!;
  expect(group.querySelectorAll('button')).toHaveLength(12);
  expect([...group.querySelectorAll('button')].every((b) => b.getAttribute('aria-pressed') === 'false')).toBe(true);
  expect(host.querySelector('[role=region]')).toBeNull();
  expect(host.querySelectorAll('input, textarea, select, [contenteditable]')).toHaveLength(0);
  expect(host.textContent).toMatch(/never have to say why/);
  expect(host.textContent).toMatch(/nothing is sent to anyone/);
});

it('is operable by keyboard and named for a screen reader: real buttons, a labelled section, every control named', () => {
  render();
  expect(host.querySelector('section')!.getAttribute('aria-labelledby')).toBe('life-events-heading');
  expect(host.querySelector('#life-events-heading')!.textContent).toBe('If something has changed');
  act(() => button(/I am taking on caregiving/)!.click());
  for (const b of host.querySelectorAll('button')) {
    expect(b.tagName).toBe('BUTTON'); // focusable and Enter/Space-activatable by default
    expect((b.textContent ?? '').trim() || b.getAttribute('aria-label'), 'every button has a name').toBeTruthy();
    expect(b.hasAttribute('disabled') || b.tabIndex >= 0).toBe(true);
  }
  expect(host.querySelector('[role=region]')!.getAttribute('aria-label')).toBe('Plan: I am taking on caregiving');
  expect(button(/I am taking on caregiving/)!.getAttribute('aria-pressed')).toBe('true');
});

it('choosing one shows an optional plan, keeps only the event and the day, and sends nothing', () => {
  render('2026-10-01');
  act(() => button(/I am ill or recovering/)!.click());
  expect(stored()).toEqual({ events: [{ id: 'illness', chosenOn: '2026-10-01' }] });
  expect(host.textContent).toMatch(/You did not have to say why/);
  expect(host.textContent).toMatch(/One reminder on 2026-10-15\. It clears itself on 2026-10-29\./);
  act(() => button(/Plan a way back in|Sort what is behind/)!.click());
  expect(went).toEqual(['behind']);
  act(() => button(/Ask for help with: Stuck on course material/)!.click());
  expect(asked).toEqual(['course']);
  // Wellbeing and accessibility are directories: the label says "find who", never "ask".
  expect(button(/Find who to talk to about: Accessibility or accommodations/)).toBeDefined();
  expect(button(/Find who to talk to about: Wellbeing or someone to talk to/)).toBeDefined();
  expect(button(/Ask for help with: Accessibility|Ask for help with: Wellbeing/)).toBeUndefined();
});

it('keeps the choice across a reload and lets it go on the day it lapses, dropping it from storage', () => {
  localStorage.setItem(KEY, JSON.stringify({ events: [{ id: 'money', chosenOn: '2026-10-01' }] }));
  render('2026-10-20');
  expect(host.querySelector('[role=region]')).not.toBeNull();
  act(() => root.render(<LifeEvents storageKey={KEY} today="2026-10-29" onGo={() => {}} onHelp={() => {}} />));
  expect(host.querySelector('[role=region]')).toBeNull();
  expect(stored()?.events ?? []).toEqual([]);
});

it('asks once, from day 14, whether it is still what you need, and both answers work', () => {
  localStorage.setItem(KEY, JSON.stringify({ events: [{ id: 'caregiving', chosenOn: '2026-10-01' }] }));
  render('2026-10-14');
  expect(host.textContent).not.toMatch(/Is this still what you need/);
  act(() => root.render(<LifeEvents storageKey={KEY} today="2026-10-15" onGo={() => {}} onHelp={() => {}} />));
  expect(host.querySelector('[role=group][aria-label="Is this still what you need?"]')).not.toBeNull();
  act(() => button(/Keep it another four weeks/)!.click());
  expect(stored().events).toEqual([{ id: 'caregiving', chosenOn: '2026-10-15' }]);
  expect(host.textContent).not.toMatch(/Is this still what you need/);
  act(() => root.render(<LifeEvents storageKey={KEY} today="2026-10-29" onGo={() => {}} onHelp={() => {}} />));
  act(() => button(/I’m fine now/)!.click());
  expect(host.querySelector('[role=region]')).toBeNull();
});

it('can always be cleared, and clearing leaves nothing behind', () => {
  render();
  act(() => button(/There is a family emergency/)!.click());
  act(() => button(/Clear this plan now: There is a family emergency/)!.click());
  expect(host.querySelector('[role=region]')).toBeNull();
  expect(stored()?.events ?? []).toEqual([]);
});

it('says so when the browser would not save it, and never overwrites data it could not read', () => {
  localStorage.setItem(KEY, '{not json');
  render();
  expect(host.querySelector('[role=alert]')!.textContent).toMatch(/could not be read/);
  expect([...host.querySelectorAll('[role=group] button')].every((b) => (b as HTMLButtonElement).disabled)).toBe(true);
  act(() => button(/My availability changed/)!.click());
  expect(localStorage.getItem(KEY)).toBe('{not json'); // kept exactly as it was
});

it('reports a full store rather than pretending it saved', () => {
  render();
  const set = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
    throw new Error('QuotaExceededError');
  });
  act(() => button(/My work schedule changed/)!.click());
  expect(host.querySelector('[role=alert]')!.textContent).toMatch(/could not be saved/);
  expect(host.querySelector('[role=region]')).toBeNull();
  set.mockRestore();
});

it('states the cap when three are open', () => {
  localStorage.setItem(
    KEY,
    JSON.stringify({ events: ['illness', 'money', 'housing'].map((id) => ({ id, chosenOn: '2026-10-01' })) }),
  );
  render();
  expect(host.textContent).toMatch(/Up to 3 can be open at once/);
});
