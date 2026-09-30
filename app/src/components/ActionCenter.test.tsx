// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeAll, beforeEach, expect, it, vi } from 'vitest';
import { MODULE_FLAGS } from '../lib/experience-flags';
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

it('shows one most important, three next, and the rest behind View all', () => {
  render(Array.from({ length: 8 }, (_, i) => make(i)));
  expect(host.querySelector('#action-top-title')?.textContent).toBe('Task number 0');
  const lists = host.querySelectorAll('ol.action-list');
  expect(lists[0].querySelectorAll(':scope > li')).toHaveLength(3);
  expect(host.textContent).toContain('View all (4 more)');
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
  expect(host.textContent).toContain('1 snoozed until the time you chose');
  expect(host.querySelector('[role="status"]')?.textContent).toContain('Snoozed until tomorrow morning');
});

/** Wednesday 30 September 2026, 10:00 local: every preset is on offer. */
const MIDDAY = new Date(2026, 8, 30, 10, 0).getTime();

it('offers later today, next week and the day before it is due, and stores the time chosen', () => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(MIDDAY);
  try {
    // make(1) is due two days out and make(0) is pushed to five, so make(1) leads.
    const due = MIDDAY + 2 * DAY;
    render([{ ...make(0), dueAt: MIDDAY + 5 * DAY }, make(1)]);
    const top = host.querySelector('article')!;
    expect(button(/^Snooze until later today$/, top)).toBeUndefined(); // behind "More snooze times"
    act(() => button(/^More snooze times$/, top)?.click());
    const group = top.querySelector('[role="group"][aria-label*="until"]')!;
    const labels = [...group.querySelectorAll('button')].map((b) => b.textContent);
    expect(labels).toEqual([
      'Snooze until later today',
      'Snooze until next week',
      'Snooze until the day before it is due',
    ]);
    act(() => button(/^Snooze until the day before it is due$/, group)?.click());
    expect(stored().a1.status).toBe('snoozed');
    expect(stored().a1.snoozedUntil).toBe(due - DAY);
    expect(stored().a0).toBeUndefined();
    expect(host.querySelector('[role="status"]')?.textContent).toContain('Snoozed until the day before it is due');
  } finally {
    vi.useRealTimers();
  }
});

it('does not offer later today late in the evening', () => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date(2026, 8, 30, 21, 30).getTime());
  try {
    render([make(0), make(1)]);
    const top = host.querySelector('article')!;
    act(() => button(/^More snooze times$/, top)?.click());
    const labels = [...top.querySelectorAll('[role="group"][aria-label*="until"] button')].map((b) => b.textContent);
    expect(labels).not.toContain('Snooze until later today');
    expect(labels).toContain('Snooze until next week');
  } finally {
    vi.useRealTimers();
  }
});

it('asks why before hiding, records the reason, and shows it in the hidden list', () => {
  render([make(0), make(1)]);
  const top = host.querySelector('article')!;
  act(() => button(/^Not relevant$/, top)?.click());
  // Choosing to hide is one more tap, and nothing is hidden until it happens.
  expect(stored().a0).toBeUndefined();
  const group = top.querySelector('[role="group"][aria-label^="Why hide"]')!;
  expect([...group.querySelectorAll('button')].map((b) => b.textContent)).toEqual([
    'I already did this',
    'This does not apply to me',
    'The information is wrong',
    'Too much right now',
    'Hide without saying why',
  ]);
  act(() => button(/^I already did this$/, group)?.click());
  expect(stored().a0.status).toBe('dismissed');
  expect(stored().a0.history.at(-1).note).toBe('Hidden because: I already did this');
  expect(host.textContent).toContain('Not relevant · I already did this');
});

it('hides without a reason when the student would rather not say', () => {
  render([make(0), make(1)]);
  const top = host.querySelector('article')!;
  act(() => button(/^Not relevant$/, top)?.click());
  act(() => button(/^Hide without saying why$/, top)?.click());
  expect(stored().a0.status).toBe('dismissed');
  expect(stored().a0.history.at(-1).note).toBeUndefined();
  expect(host.textContent).not.toContain('Not relevant ·');
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

it('asks whether it helped, stores the answer on the device, and then stops asking', () => {
  render([make(0)]);
  const legend = [...host.querySelectorAll('legend')].find((l) => /Did this help you understand what to do next\?/.test(l.textContent ?? ''));
  expect(legend).toBeDefined();
  act(() => button(/^Somewhat$/)?.click());
  const stored = JSON.parse(localStorage.getItem('semester.clarity.v1:device')!);
  expect(stored.answers.map((a: { answer: string }) => a.answer)).toEqual(['somewhat']);
  expect(host.textContent).toContain('saved on this device only');
  expect(host.textContent).toContain('Tell us what was unclear');

  act(() => root.unmount());
  act(() => {
    root = createRoot(host);
  });
  render([make(0)]);
  expect(host.textContent).not.toContain('Did this help you understand what to do next?');
});

it('opens a report about the action from its source badge, sending nothing by itself', async () => {
  render([make(0)]);
  const report = [...host.querySelectorAll('article [data-source] button')].find((b) => /Report incorrect information/.test(b.textContent ?? ''));
  expect(report).toBeDefined();
  act(() => (report as HTMLButtonElement).click());
  // The form is loaded on demand, so it is not in Today's entry chunk.
  for (let i = 0; i < 50 && !/Write to/.test(host.querySelector('article .action-note')?.textContent ?? ''); i++) {
    await act(async () => {
      await new Promise((r) => setTimeout(r, 20));
    });
  }
  // Signed out in the test: the form gives the address rather than sending.
  expect(host.querySelector('article .action-note')?.textContent).toMatch(/Write to .*needs an account/);
});

it('with the help route off, "Ask for help" keeps the note and hands nothing over', async () => {
  const { helpSeedWaiting } = await import('../lib/help-routes');
  render([make(0)]);
  act(() => button(/Ask for help/)?.click());
  expect(host.querySelector('textarea')?.closest('label')?.textContent).toContain('What do you need help with?');
  expect(helpSeedWaiting()).toBe(false);
});

it('can bring back something marked not relevant, after the Undo is gone', () => {
  render([make(0), make(1)]);
  act(() => button(/^Not relevant$/)?.click());
  act(() => button(/^Hide without saying why$/)?.click());
  expect(stored().a0.status).toBe('dismissed');

  // A reload: the Undo line lives in component state and does not survive it.
  act(() => root.unmount());
  act(() => {
    root = createRoot(host);
  });
  render([make(0), make(1)]);
  expect(button(/^Undo$/)).toBeUndefined();
  const active = () => [...host.querySelectorAll('#action-top-title, ol.action-list')].map((e) => e.textContent).join(' ');
  expect(active()).not.toContain('Task number 0');

  const back = button(/Bring back/);
  expect(back?.textContent).toMatch(/Task number 0/);
  act(() => back!.click());
  expect(stored().a0.status).toBe('open');
  expect(active()).toContain('Task number 0');
  expect(button(/Bring back/)).toBeUndefined();
});

it('with offline mode on, does not open an official site offline, and does online (the control)', () => {
  const flag = MODULE_FLAGS.offline_mode;
  const onLine = Object.getOwnPropertyDescriptor(Navigator.prototype, 'onLine');
  const external: Action = { ...make(0), primary: { label: 'Open the aid portal', kind: 'external', target: 'https://aid.school.edu', requiresConfirmation: true } };
  const opened = vi.spyOn(window, 'open').mockReturnValue(null);
  const confirm = vi.spyOn(window, 'confirm').mockReturnValue(true);
  const alerted = vi.spyOn(window, 'alert').mockImplementation(() => {});
  try {
    MODULE_FLAGS.offline_mode = 'production';
    Object.defineProperty(navigator, 'onLine', { configurable: true, get: () => false });
    render([external]);
    act(() => button(/^Open the aid portal/)!.click());
    expect(opened).not.toHaveBeenCalled();
    expect(confirm).not.toHaveBeenCalled();
    expect(alerted.mock.calls[0][0]).toContain('nothing was sent');
    Object.defineProperty(navigator, 'onLine', { configurable: true, get: () => true });
    act(() => button(/^Open the aid portal/)!.click());
    expect(opened).toHaveBeenCalledTimes(1);
  } finally {
    MODULE_FLAGS.offline_mode = flag;
    if (onLine) Object.defineProperty(navigator, 'onLine', onLine);
    else delete (navigator as { onLine?: boolean }).onLine;
    vi.restoreAllMocks();
  }
});
