// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { GoalPlan } from './GoalPlan';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const NOW = new Date(2026, 9, 7, 10, 0);

let host: HTMLDivElement;
let root: Root;
beforeEach(() => {
  host = document.createElement('div');
  document.body.append(host);
  root = createRoot(host);
});
afterEach(async () => {
  await act(async () => root.unmount());
  host.remove();
});

const render = (el: React.ReactElement) => act(async () => root.render(el));
const text = () => host.textContent ?? '';
const button = (label: string) => {
  const b = [...host.querySelectorAll('button')].find((x) => x.textContent === label || x.getAttribute('aria-label') === label);
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
const named = (name: string) => host.querySelector<HTMLInputElement>(`[aria-label="${name}"]`)!;
const labelled = (start: string) =>
  [...host.querySelectorAll('label')].find((l) => l.textContent?.startsWith(start))!.querySelector('input,textarea') as HTMLInputElement;

async function draft(goal: string, by = '') {
  await type(labelled('Your goal'), goal);
  if (by) await type(labelled('Date to aim for'), by);
  await click(button('Draft a plan'));
}

describe('GoalPlan', () => {
  it('shows nothing but the form until a plan is drafted', async () => {
    await render(<GoalPlan now={NOW} />);
    expect(host.querySelector('textarea')).toBeTruthy();
    expect(text()).not.toContain('Milestones');
  });

  it('drafts milestones, actions, proposed blocks, a review date and a person to ask', async () => {
    await render(<GoalPlan now={NOW} />);
    await draft('Do well on the chemistry midterm', '2026-11-05');
    expect(text()).toContain('Milestones');
    expect(named('Milestone 1 title').value).toBe('Gather what is due and when');
    expect(text()).toContain('Check each date against the syllabus');
    expect(text()).toContain('Proposed calendar blocks');
    expect(text()).toContain('Nothing is added to your calendar');
    expect(text()).toContain('Your instructor or TA');
    expect(labelled('Look at how it is going on').value).toBe('2026-10-14');
  });

  it('lets every part be edited or removed', async () => {
    await render(<GoalPlan now={NOW} />);
    await draft('Do well on the chemistry midterm', '2026-11-05');
    await type(named('Milestone 1 title'), 'Collect the past papers');
    expect(named('Milestone 1 title').value).toBe('Collect the past papers');
    await type(named('Milestone 1 date'), '2026-10-12');
    expect(named('Milestone 1 date').value).toBe('2026-10-12');
    await click(button('Remove milestone 3'));
    expect(host.querySelectorAll('[aria-label$="title"]')).toHaveLength(2);
    await click(button('Remove action List the assignments or topics involved'));
    expect(text()).not.toContain('List the assignments or topics involved');
    await click(button('Remove block 1'));
    expect(named('Block 1 day')).toBeTruthy();
    await type(labelled('Add an action'), 'Email the TA');
    await click(button('Add action'));
    expect(text()).toContain('Email the TA');
    await type(labelled('Look at how it is going on'), '2026-10-20');
    expect(labelled('Look at how it is going on').value).toBe('2026-10-20');
  });

  it('is not a dead end for a goal no rule recognises', async () => {
    await render(<GoalPlan now={NOW} />);
    await draft('Learn to juggle');
    expect(text()).toContain('Milestones');
    expect(text()).toContain('No date to aim for');
  });

  it('calls onSave only from Save plan, with the edited plan', async () => {
    const onSave = vi.fn();
    await render(<GoalPlan now={NOW} onSave={onSave} />);
    await draft('Be less tired');
    await type(named('Milestone 1 title'), 'Choose a bedtime');
    expect(onSave).not.toHaveBeenCalled();
    await click(button('Save plan'));
    expect(onSave).toHaveBeenCalledTimes(1);
    expect(onSave.mock.calls[0][0].milestones[0].title).toBe('Choose a bedtime');
    expect(text()).toContain('Plan saved.');
  });
});
