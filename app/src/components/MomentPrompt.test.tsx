// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { FeedbackPanel } from './FeedbackPanel';
import { MomentPrompt } from './MomentPrompt';
import type { Change } from '../lib/momentfeedback';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
const KEY = 'semester.moment-feedback.v1:panel-test';
let root: Root;
let host: HTMLDivElement;

beforeEach(() => {
  localStorage.removeItem(KEY);
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

const prompt = (moment: 'ai-answer' | 'first-plan' | 'support-routed' = 'ai-answer', today = '2026-10-01') =>
  act(() => root.render(<MomentPrompt moment={moment} storageKey={KEY} today={today} />));
const button = (name: RegExp) => [...host.querySelectorAll('button')].find((b) => name.test(b.textContent ?? '') || name.test(b.getAttribute('aria-label') ?? ''));
const stored = () => JSON.parse(localStorage.getItem(KEY) ?? 'null');

it('asks one question, says it is optional and stays here, and offers a way out of it and of all of them', () => {
  prompt();
  const group = host.querySelector('[role=group]')!;
  expect(group.getAttribute('aria-labelledby')).toBeTruthy();
  expect(host.querySelector(`#${CSS.escape(group.getAttribute('aria-labelledby')!)}`)!.textContent).toBe('You read an answer from Ask Semester. Was the source accurate?');
  expect(host.textContent).toMatch(/Optional\. Your answer stays on this device\./);
  expect([...host.querySelectorAll('button')].map((b) => b.textContent)).toEqual(['Yes', 'No', 'There was no source', 'Skip', 'Don’t ask me these']);
  expect(host.querySelectorAll('input, textarea, select')).toHaveLength(0); // nothing to type in
});

it('is named and operable for keyboard and screen-reader users: native buttons, every one named, a polite status on answer', () => {
  prompt();
  for (const b of host.querySelectorAll('button')) {
    expect(b.tagName).toBe('BUTTON');
    expect((b.textContent ?? '').trim() || b.getAttribute('aria-label')).toBeTruthy();
  }
  expect(button(/Stop asking me these questions/)).toBeDefined();
  act(() => button(/^No$/)!.click());
  const status = host.querySelector('[role=status]')!;
  expect(status.textContent).toMatch(/Thanks\. That is saved on this device only\./);
});

it('keeps the answer as a choice, a category and a day, and asks no more that day', () => {
  prompt();
  act(() => button(/^No$/)!.click());
  expect(stored()).toEqual({ answers: [{ moment: 'ai-answer', choice: 'wrong', category: 'inaccurate', on: '2026-10-01' }], skips: [], shown: [{ moment: 'ai-answer', on: '2026-10-01' }], muted: false });
  // Each of these is a new visit: a fresh mount, as when the student comes back to the screen.
  const revisit = (moment: 'ai-answer' | 'first-plan', today: string) => {
    act(() => root.render(<div />));
    prompt(moment, today);
  };
  revisit('first-plan', '2026-10-01');
  expect(host.querySelector('[role=group]')).toBeNull(); // one prompt a day
  revisit('ai-answer', '2026-10-30');
  expect(host.querySelector('[role=group]')).toBeNull(); // the same moment, 29 days on
  revisit('ai-answer', '2026-10-31');
  expect(host.querySelector('[role=group]')).not.toBeNull(); // thirty days on
  revisit('first-plan', '2026-10-02');
  expect(host.querySelector('[role=group]')).not.toBeNull(); // a different moment, the next day
});

it('skipping is remembered and closes the prompt; a third skip stops the question for good', () => {
  for (const day of ['2026-10-01', '2026-12-01', '2027-02-01']) {
    prompt('first-plan', day);
    expect(host.querySelector('[role=group]'), day).not.toBeNull();
    act(() => button(/^Skip$/)!.click());
    expect(host.querySelector('[role=group]')).toBeNull();
    act(() => root.render(<div />));
  }
  expect(stored().skips).toHaveLength(3);
  prompt('first-plan', '2028-01-01');
  expect(host.querySelector('[role=group]')).toBeNull();
});

it('"Don’t ask me these" turns every question off, on this device', () => {
  prompt();
  act(() => button(/Stop asking me these questions/)!.click());
  expect(host.querySelector('[role=group]')).toBeNull();
  expect(stored().muted).toBe(true);
  act(() => root.render(<div />)); // a new visit, months later
  prompt('support-routed', '2027-06-01');
  expect(host.querySelector('[role=group]')).toBeNull();
});

it('draws nothing, and overwrites nothing, when what is stored cannot be read', () => {
  localStorage.setItem(KEY, '{not json');
  prompt();
  expect(host.querySelector('[role=group]')).toBeNull();
  expect(localStorage.getItem(KEY)).toBe('{not json');
});

it('does not say thanks for an answer the browser would not keep', () => {
  prompt();
  vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
    throw new Error('QuotaExceededError');
  });
  act(() => button(/^Yes$/)!.click());
  expect(host.textContent).not.toMatch(/Thanks/);
  expect(host.querySelector('[role=status]')).toBeNull();
  expect(JSON.parse(localStorage.getItem(KEY)!).answers).toEqual([]); // the impression was written at mount; the answer was refused
});

it('counts a prompt that was shown and walked away from, so it is not asked again the same day or within thirty days', () => {
  prompt();
  expect(host.querySelector('[role=group]')).not.toBeNull();
  expect(stored()).toEqual({ answers: [], skips: [], shown: [{ moment: 'ai-answer', on: '2026-10-01' }], muted: false });
  // Leaves without answering or skipping, then comes back: a fresh mount each time.
  const revisit = (moment: 'ai-answer' | 'first-plan', today: string) => {
    act(() => root.render(<div />));
    prompt(moment, today);
  };
  revisit('ai-answer', '2026-10-01');
  expect(host.querySelector('[role=group]')).toBeNull(); // the same moment, the same day
  revisit('first-plan', '2026-10-01');
  expect(host.querySelector('[role=group]')).toBeNull(); // another moment, the same day: the day's one prompt was used
  revisit('ai-answer', '2026-10-30');
  expect(host.querySelector('[role=group]')).toBeNull(); // 29 days on
  revisit('ai-answer', '2026-10-31');
  expect(host.querySelector('[role=group]')).not.toBeNull(); // thirty days on
});

it('keeps a prompt on screen once it has been shown, and still lets it be answered, with the day already used', () => {
  prompt();
  act(() => root.render(<MomentPrompt moment="ai-answer" storageKey={KEY} today="2026-10-01" />)); // re-render of the same visit
  expect(host.querySelector('[role=group]')).not.toBeNull();
  act(() => button(/^Yes$/)!.click());
  expect(stored().answers).toHaveLength(1);
  expect(stored().shown).toHaveLength(1); // the impression is not recorded twice
});

// ── The panel ────────────────────────────────────────────────────────────────

const panel = (changes?: readonly Change[]) => act(() => root.render(<FeedbackPanel storageKey={KEY} changes={changes} />));
const seed = () => localStorage.setItem(KEY, JSON.stringify({ answers: [{ moment: 'advising', choice: 'thin', on: '2026-10-01' }, { moment: 'ai-answer', choice: 'yes', on: '2026-10-02' }], skips: [{ moment: 'registration', on: '2026-10-03' }], muted: false }));

it('says nothing has changed yet, in the log, until something has, and lists a real change with its date', () => {
  panel();
  expect(host.querySelector('#you-said-heading')!.textContent).toBe('You said, we changed');
  expect(host.querySelector('section')!.getAttribute('aria-labelledby')).toBe('you-said-heading');
  expect(host.textContent).toMatch(/Nothing has changed yet because of this/);
  panel([{ moment: 'advising', said: 'agendas were thin.', changed: 'agendas now list your open questions.', on: '2026-11-01', evidence: 'README.md' }]);
  expect(host.textContent).toMatch(/You said: agendas were thin\. We changed: agendas now list your open questions\. \(2026-11-01\)/);
  expect(host.textContent).not.toMatch(/Nothing has changed yet/);
});

it('says the answers are on this device and not sent, counts them, and has an off switch that is honoured', () => {
  seed();
  panel();
  expect(host.textContent).toMatch(/2 answers are saved on this device\. They are not sent anywhere, and nobody at your school can read them\./);
  const box = host.querySelector('input[type=checkbox]') as HTMLInputElement;
  expect(box.checked).toBe(true);
  expect(box.closest('label')!.textContent).toMatch(/Ask me short questions after things happen/);
  act(() => box.click());
  expect(stored().muted).toBe(true);
  expect((host.querySelector('input[type=checkbox]') as HTMLInputElement).checked).toBe(false);
  act(() => root.render(<MomentPrompt moment="first-plan" storageKey={KEY} today="2027-01-01" />));
  expect(host.querySelector('[role=group]')).toBeNull();
});

it('deletes the answers only after a second step, keeps the off switch, and can be backed out of', () => {
  seed();
  panel();
  act(() => button(/Delete my answers/)!.click());
  expect(host.querySelector('[role=group][aria-label="Delete your answers?"]')).not.toBeNull();
  act(() => button(/Keep them/)!.click());
  expect(stored().answers).toHaveLength(2);
  act(() => button(/Delete my answers/)!.click());
  act(() => button(/Yes, delete them/)!.click());
  expect(stored()).toEqual({ answers: [], skips: [], shown: [], muted: false });
  expect(host.textContent).toMatch(/No answers are saved on this device\./);
  expect(button(/Delete my answers/)).toBeUndefined();
});

it('reports unreadable or unsaveable storage in an alert, and touches nothing', () => {
  localStorage.setItem(KEY, '[[[');
  panel();
  expect(host.querySelector('[role=alert]')!.textContent).toMatch(/could not be read/);
  expect((host.querySelector('input[type=checkbox]') as HTMLInputElement).disabled).toBe(true);
  act(() => (host.querySelector('input[type=checkbox]') as HTMLInputElement).click());
  expect(localStorage.getItem(KEY)).toBe('[[[');
});
