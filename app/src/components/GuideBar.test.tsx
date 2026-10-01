// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { EMPTY_CALM } from '../lib/calm-controls';
import { guideBar, type GuideInput, type GuidePriority } from '../lib/guide-bar';
import { GuideBar } from './GuideBar';

/** The bar draws the model and nothing else: what it says is `lib/guide-bar.ts`'s. */

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
let root: Root;
let host: HTMLDivElement;

beforeEach(() => {
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

const priority: GuidePriority = {
  id: 'deadline:essay',
  title: 'Outline the essay',
  why: 'It is due soonest and nothing else is.',
  source: 'Syllabus, imported',
  deadlineLabel: 'Due Thursday',
  fallback: false,
};
const input = (over: Partial<GuideInput> = {}): GuideInput => ({
  surface: 'today',
  priority,
  counts: { deadlines: 2, planDecisions: 0, continuations: 0 },
  calm: EMPTY_CALM,
  ...over,
});
const labels = () => [...host.querySelectorAll('button')].map((b) => b.textContent);

describe('GuideBar', () => {
  it('is a named region with the headline, the next step and four buttons', () => {
    act(() => root.render(<GuideBar model={guideBar(input())} onAction={() => {}} />));
    const region = host.querySelector('section[aria-label="Semester Guide"]');
    expect(region).not.toBeNull();
    expect(region!.textContent).toContain('Today, you have: One priority · Two deadlines');
    expect(region!.textContent).toContain('Outline the essay · Due Thursday');
    expect(labels()).toEqual(['Why this matters', 'Snooze', 'Not now', 'Start']);
  });

  it('reports the kind of a button and opens the explanation in place', () => {
    const onAction = vi.fn();
    act(() => root.render(<GuideBar model={guideBar(input())} onAction={onAction} />));
    const [why, snooze] = [...host.querySelectorAll('button')];
    expect(why.getAttribute('aria-expanded')).toBe('false');
    act(() => why.click());
    expect(why.getAttribute('aria-expanded')).toBe('true');
    expect(host.textContent).toContain('What it does not know');
    expect(onAction).not.toHaveBeenCalled();
    act(() => snooze.click());
    expect(onAction).toHaveBeenCalledWith('snooze');
  });

  it('always has the element its Why button controls, and shows it only when opened', () => {
    // The accessibility smoke failed a closed bar whose button named an id that
    // was not in the document at all.
    act(() => root.render(<GuideBar model={guideBar(input())} onAction={vi.fn()} />));
    const why = host.querySelector('button[aria-controls]') as HTMLButtonElement;
    const panel = document.getElementById(why.getAttribute('aria-controls') as string);
    expect(panel).not.toBeNull();
    expect(panel?.hidden).toBe(true);
    act(() => why.click());
    expect(panel?.hidden).toBe(false);
  });

  it('says what a choice did, politely', () => {
    act(() => root.render(<GuideBar model={guideBar(input())} confirmation="Snoozed." onAction={() => {}} />));
    expect(host.querySelector('[role="status"]')!.textContent).toBe('Snoozed.');
  });

  it('collapses to one line and the primary button in minimal mode', () => {
    act(() => root.render(<GuideBar model={guideBar(input({ calm: { ...EMPTY_CALM, minimalMode: true } }))} onAction={() => {}} />));
    expect(labels()).toEqual(['Start']);
    expect(host.textContent).not.toContain('Today, you have');
  });

  it('draws nothing where the student has paused the guide', () => {
    act(() => root.render(<GuideBar model={guideBar(input({ surface: 'career', calm: { ...EMPTY_CALM, pauseCareer: true } }))} onAction={() => {}} />));
    expect(host.innerHTML).toBe('');
  });
});
