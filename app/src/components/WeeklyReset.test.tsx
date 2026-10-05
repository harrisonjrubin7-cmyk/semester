// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { RESET_KEY, readResets } from '../lib/weekly-reset';
import { WeeklyReset } from './WeeklyReset';
import { PRIVATE_LINE, WeeklyReflection } from './WeeklyReflection';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const NOW = new Date(2026, 9, 7, 10, 0); // Wednesday; the week starts Sunday 2026-10-04
const WEEK = '2026-10-04';

let host: HTMLDivElement;
let root: Root;

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

const render = (el: React.ReactElement) => act(async () => root.render(el));
const text = () => host.textContent ?? '';
const button = (label: string) => {
  const b = [...host.querySelectorAll('button')].find((x) => x.textContent === label);
  if (!b) throw new Error(`no button "${label}" in: ${text()}`);
  return b as HTMLButtonElement;
};
const click = (el: Element) => act(async () => void el.dispatchEvent(new MouseEvent('click', { bubbles: true })));
const type = (el: HTMLInputElement | HTMLTextAreaElement, value: string) =>
  act(async () => {
    const proto = el instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
    Object.getOwnPropertyDescriptor(proto, 'value')?.set?.call(el, value);
    el.dispatchEvent(new Event('input', { bubbles: true }));
  });
const blur = (el: Element) => act(async () => void el.dispatchEvent(new FocusEvent('focusout', { bubbles: true })));
const field = (name: string) =>
  [...host.querySelectorAll('label')].find((l) => l.textContent?.startsWith(name))!.querySelector('input,textarea') as HTMLInputElement;
const stored = () => readResets(JSON.parse(localStorage.getItem(RESET_KEY) ?? 'null'));

describe('WeeklyReset', () => {
  it('walks five steps with Back and Next, and Skip for now is on every one', async () => {
    await render(<WeeklyReset now={NOW} />);
    for (let i = 1; i <= 5; i += 1) {
      expect(text()).toContain(`Step ${i} of 5`);
      expect(button('Skip for now')).toBeTruthy();
      expect(button('Back').disabled).toBe(i === 1);
      await click(button(i === 5 ? 'Finish' : 'Next'));
    }
    expect(text()).toContain('All five steps are done');
    expect(button('Skip for now')).toBeTruthy();
    await click(button('Back'));
    expect(text()).toContain('Step 5 of 5');
  });

  it('keeps one academic, one practical and one support pick, labelled', async () => {
    await render(<WeeklyReset now={NOW} />);
    await click(button('Next'));
    const academic = field('Academic priority');
    await type(academic, 'Chemistry problem set');
    await blur(academic);
    await type(field('Practical priority'), 'Renew my bus pass');
    await type(field('Personal support priority'), 'Book a counseling visit');
    await click(button('Next'));
    expect(stored().resets[0]).toMatchObject({
      weekStart: WEEK,
      step: 2,
      picks: { academic: 'Chemistry problem set', practical: 'Renew my bus pass', support: 'Book a counseling visit' },
    });
  });

  it('skips from the middle without losing picks or saying what it costs, and can be picked up again', async () => {
    await render(<WeeklyReset now={NOW} />);
    await click(button('Next'));
    const academic = field('Academic priority');
    await type(academic, 'Read chapter 4');
    await blur(academic);
    await click(button('Skip for now'));
    const record = stored().resets[0];
    expect(record.skipped).toBe(true);
    expect(record.picks.academic).toBe('Read chapter 4');
    expect(text()).toContain('Nothing is waiting on it');
    expect(text()).not.toMatch(/missed|streak|behind|penalt|lose|lost/i);
    expect(button('Skip for now')).toBeTruthy();
    await click(button('Pick this up again'));
    expect(stored().resets[0].skipped).toBe(false);
    expect(text()).toContain('Step 2 of 5');
  });

  it('shows study blocks as proposals the student accepts, one at a time', async () => {
    const accepted = vi.fn();
    await render(<WeeklyReset now={NOW} onAcceptBlock={accepted} />);
    await click(button('Next'));
    await click(button('Next'));
    const boxes = [...host.querySelectorAll<HTMLInputElement>('input[type="checkbox"]')];
    expect(boxes).toHaveLength(3);
    expect(boxes.every((b) => !b.checked)).toBe(true);
    expect(text()).toContain('Nothing is placed until you accept it');
    expect(accepted).not.toHaveBeenCalled();
    await click(boxes[0]);
    expect(accepted).toHaveBeenCalledTimes(1);
    expect(accepted.mock.calls[0][1]).toBe(true);
    expect(host.querySelectorAll<HTMLInputElement>('input[type="checkbox"]')[0].checked).toBe(true);
  });

  it('says a busy day plainly, and offers help options with an explicit none', async () => {
    const deadlines = ['A', 'B', 'C'].map((title) => ({ day: '2026-10-08', title }));
    await render(<WeeklyReset now={NOW} deadlines={deadlines} />);
    for (let i = 0; i < 3; i += 1) await click(button('Next'));
    expect(text()).toContain('Thursday has three deadlines');
    await click(button('Next'));
    const radios = [...host.querySelectorAll<HTMLInputElement>('input[type="radio"]')];
    expect(radios).toHaveLength(4);
    await click(radios[0]);
    expect(stored().resets[0].help).toBe('tutoring');
    await click(radios[3]);
    expect(stored().resets[0].help).toBeNull();
  });
});

describe('WeeklyReflection', () => {
  it('shows the five prompts and that they are private, with no share control', async () => {
    await render(<WeeklyReflection now={NOW} onShare={() => {}} />);
    expect(text()).toContain(PRIVATE_LINE);
    expect(host.querySelectorAll('textarea')).toHaveLength(5);
    expect(text()).toContain('What did you finish?');
    expect(text()).toContain('What do you want to carry into next term?');
    expect(host.querySelectorAll('input[type="checkbox"]')).toHaveLength(1);
    expect(host.querySelector<HTMLInputElement>('input[type="checkbox"]')!.checked).toBe(false);
    expect(text()).not.toContain('Share this copy');
  });

  it('offers a copy to share only after the student ticks the checkbox, and shares the copy it showed', async () => {
    const shared = vi.fn();
    await render(<WeeklyReflection now={NOW} onShare={shared} />);
    const first = host.querySelector('textarea')!;
    await type(first, 'Finished the lab report');
    await blur(first);
    expect(stored().reflections[0]).toMatchObject({ private: true, shared: false });
    await click(host.querySelector('input[type="checkbox"]')!);
    expect(stored().reflections[0].shared).toBe(true);
    expect(text()).toContain('Finished the lab report');
    await click(button('Share this copy'));
    expect(shared).toHaveBeenCalledTimes(1);
    expect(shared.mock.calls[0][0].answers.finished).toBe('Finished the lab report');
    expect(shared.mock.calls[0][0]).not.toHaveProperty('private');
    await click(host.querySelector('input[type="checkbox"]')!);
    expect(text()).not.toContain('Share this copy');
  });
});
