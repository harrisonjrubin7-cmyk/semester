// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, expect, it } from 'vitest';
import { toolkitFlags } from '../../lib/toolkit/flags';
import type { Screen } from '../../lib/types';
import { TOOLKIT_KEY } from './store';
import { Toolkit, type ToolkitCourse } from './Toolkit';

/**
 * The toolkit driven as a student would: pick a goal, read why, open a
 * workspace, try to skip a stage, try to verify a source without opening it.
 */

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
let root: Root;
let host: HTMLDivElement;
let opened: Screen[];

const ALL_ON = toolkitFlags({
  VITE_AI_TOOLKIT: 'preview',
  VITE_TOOLKIT_RESEARCH: 'preview',
  VITE_TOOLKIT_DATA: 'preview',
  VITE_TOOLKIT_DATA_UPLOAD: 'preview',
  VITE_TOOLKIT_WORKBENCHES: 'preview',
  VITE_TOOLKIT_DISCLOSURE: 'preview',
});

const COURSES: ToolkitCourse[] = [
  { code: 'PSCI 1104', name: 'Intro to Security Studies' },
  { code: 'ECON 1010', name: 'Principles of Macroeconomics', ai: { stance: 'limited', note: 'AI for brainstorming only; disclose it.' } },
];

beforeEach(() => {
  localStorage.clear();
  opened = [];
  host = document.createElement('div');
  document.body.append(host);
  root = createRoot(host);
});
afterEach(() => {
  act(() => root.unmount());
  host.remove();
  localStorage.clear();
});

const mount = (flags = ALL_ON) =>
  act(() => root.render(<Toolkit courses={COURSES} flags={flags} now={new Date('2026-09-27T12:00:00')} onOpen={(s) => opened.push(s)} onClose={() => {}} />));

const button = (text: string | RegExp) => {
  const b = [...host.querySelectorAll('button')].find((x) => (typeof text === 'string' ? x.textContent?.trim() === text : text.test(x.textContent ?? '')));
  if (!b) throw new Error(`No button ${text}`);
  return b;
};
const click = (text: string | RegExp) => act(() => button(text).click());
const tab = (name: string) => act(() => ([...host.querySelectorAll('[role="tab"]')].find((t) => t.textContent === name) as HTMLElement).click());
const type = (el: HTMLInputElement | HTMLTextAreaElement, value: string) =>
  act(() => {
    const proto = el instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
    Object.getOwnPropertyDescriptor(proto, 'value')!.set!.call(el, value);
    el.dispatchEvent(new Event('input', { bubbles: true }));
  });

it('asks for a goal first and recommends nothing until there is one', () => {
  mount();
  expect(host.textContent).toContain('What are you working on?');
  expect(host.textContent).toContain('never grades, health, location');
  expect(host.querySelector('.toolkit-recs')).toBeNull();
});

it('recommends a finite set with a reason for each, and can hide one', () => {
  mount();
  click('Write a paper');
  const items = host.querySelectorAll('.toolkit-recs > li');
  expect(items.length).toBeGreaterThan(0);
  expect(items.length).toBeLessThanOrEqual(4);
  const first = items[0].querySelector('strong')!.textContent!;
  click(`Hide`);
  expect([...host.querySelectorAll('.toolkit-recs strong')].map((s) => s.textContent)).not.toContain(first);
  expect(JSON.parse(localStorage.getItem(TOOLKIT_KEY)!).hidden.length).toBe(1);
});

it('opens a native Semester screen rather than a copy of it', () => {
  mount();
  click('Study for an exam');
  click(/^Open Exam review/);
  expect(opened).toEqual(['study']);
});

it('says the policy is unavailable for a course with nothing recorded, and never assumes permission', () => {
  mount();
  tab('AI-use policy');
  expect(host.textContent).toContain('Policy unavailable — ask your instructor');
  expect(host.textContent).not.toContain('Allowed with disclosure');
});

it('labels a recorded policy as the student’s own record and lists final answers as not allowed', () => {
  mount();
  act(() => {
    const select = host.querySelector('select') as HTMLSelectElement;
    Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value')!.set!.call(select, 'ECON 1010');
    select.dispatchEvent(new Event('change', { bubbles: true }));
  });
  tab('AI-use policy');
  expect(host.textContent).toContain('your own record of the syllabus — not verified by the instructor');
  expect(host.textContent).toContain('Requires disclosure');
  expect(host.textContent).toContain('Generating final answers for an assessment');
});

it('will not mark a stage done until the student writes their own note', () => {
  mount();
  tab('Assignments');
  click(/^Start a essay workspace/);
  click('Mark Claim done');
  expect(host.textContent).toContain('Write a short note on what you did for this stage first');
  const claim = [...host.querySelectorAll('label')].find((l) => l.textContent?.startsWith('Your note for Claim'))!.querySelector('textarea')!;
  type(claim, 'Remote work lowers commuting emissions in mid-size cities.');
  click('Mark Claim done');
  expect(host.textContent).toContain('1 of 7 stages done');
});
