// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { CALM_KEY, EMPTY_CALM, readCalm, type CalmSettings as Settings } from '../lib/calm-controls';
import { CalmSettings } from './CalmSettings';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let host: HTMLDivElement;
let root: Root;

const stored = (): Settings => readCalm(JSON.parse(localStorage.getItem(CALM_KEY) as string));
const seed = (s: Partial<Settings>) => localStorage.setItem(CALM_KEY, JSON.stringify({ ...EMPTY_CALM, ...s }));
const mount = async () => {
  await act(async () => root.render(<CalmSettings />));
};
const box = (label: string) =>
  [...host.querySelectorAll('label')].find((l) => l.textContent?.includes(label))!.querySelector('input')!;

beforeEach(() => {
  localStorage.clear();
  host = document.createElement('div');
  document.body.append(host);
  root = createRoot(host);
});
afterEach(async () => {
  await act(async () => root.unmount());
  host.remove();
  localStorage.clear();
});

describe('CalmSettings', () => {
  it('opens on the calm defaults, with every control named', async () => {
    await mount();
    expect(box('Send a morning briefing').checked).toBe(false);
    expect(box('Minimal mode').checked).toBe(false);
    const unnamed = [...host.querySelectorAll('input,select,button')].filter(
      (el) => !el.closest('label') && !el.textContent?.trim() && !el.getAttribute('aria-label'),
    );
    expect(unnamed).toEqual([]);
  });

  it('writes a toggle to the stored settings', async () => {
    await mount();
    await act(async () => box('Hide suggested study blocks').click());
    await act(async () => box('Send a morning briefing').click());
    expect(stored().hideStudyBlocks).toBe(true);
    expect(stored().briefing.on).toBe(true);
  });

  it('writes the category list and the horizon', async () => {
    await mount();
    await act(async () => box('Career').click());
    expect(stored().categories).toEqual(['deadlines', 'career']);
    const select = host.querySelector('select')!;
    await act(async () => {
      select.value = 'week';
      select.dispatchEvent(new Event('change', { bubbles: true }));
    });
    expect(stored().horizon).toBe('week');
  });

  it('turns quiet hours off and on again', async () => {
    await mount();
    await act(async () => box('Use quiet hours').click());
    expect(stored().quiet).toBeNull();
    expect(host.textContent).not.toContain('Quiet hours start');
    await act(async () => box('Use quiet hours').click());
    expect(stored().quiet).toEqual(EMPTY_CALM.quiet);
  });

  it('lists the assistant’s notes and Clear empties them, leaving the rest', async () => {
    seed({ pauseCareer: true, memory: [{ id: 'a', text: 'Prefers mornings', at: 1 }, { id: 'b', text: 'No weekends', at: 2 }] });
    await mount();
    expect(host.textContent).toContain('remembers 2 notes');
    expect(host.textContent).toContain('Prefers mornings');
    const clear = [...host.querySelectorAll('button')].find((b) => b.textContent === 'Clear assistant memory')!;
    await act(async () => clear.click());
    expect(stored().memory).toEqual([]);
    expect(stored().pauseCareer).toBe(true);
    expect(host.textContent).toContain('not remembering anything');
  });
});
