// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { toolkitFlags } from '../../lib/toolkit/flags';
import type { Screen } from '../../lib/types';
import { DATA_BUDGET, MAX_RAW } from '../../lib/toolkit/data';
import { toolkitDataKey, toolkitKey } from './store';
import { Toolkit, type ToolkitCourse } from './Toolkit';
import { clear, peek } from '../../lib/learningintent';

/**
 * The toolkit driven as a student would: pick a goal, read why, open a
 * workspace, try to skip a stage, try to verify a source without opening it.
 */

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
let root: Root;
let host: HTMLDivElement;
let opened: Screen[];
let closed = 0;

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
  closed = 0;
  host = document.createElement('div');
  document.body.append(host);
  root = createRoot(host);
});
afterEach(() => {
  vi.restoreAllMocks();
  act(() => root.unmount());
  host.remove();
  localStorage.clear();
});

const mount = (flags = ALL_ON) =>
  act(() => root.render(<Toolkit courses={COURSES} flags={flags} now={new Date('2026-09-27T12:00:00')} onOpen={(s) => opened.push(s)} onClose={() => { closed += 1; }} />));

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
  expect(host.textContent).toContain('PSCI 1104 is Political science');
  const first = items[0].querySelector('strong')!.textContent!;
  click(`Hide`);
  expect([...host.querySelectorAll('.toolkit-recs strong')].map((s) => s.textContent)).not.toContain(first);
  expect(JSON.parse(localStorage.getItem(toolkitKey())!).hidden.length).toBe(1);
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

it('shows rules the instructor published as theirs, over the student’s own record (Course Studio)', () => {
  const published = {
    'PSCI 1104': {
      rules: { blanket: 'prohibited' as const, uses: { practice: 'allowed' as const }, words: 'No AI on papers; practice quizzes are fine.', link: 'https://example.edu/psci1104', effective: '2026-08-24', published: '2026-09-01' },
      packs: [],
    },
  };
  act(() => root.render(<Toolkit courses={COURSES} flags={ALL_ON} published={published} now={new Date('2026-09-27T12:00:00')} onOpen={() => {}} onClose={() => {}} />));
  tab('AI-use policy');
  expect(host.textContent).toContain('Set by your instructor · published 2026-09-01 · in effect from 2026-08-24.');
  expect(host.textContent).toContain('“No AI on papers; practice quizzes are fine.”');
  expect((host.querySelector('a[href="https://example.edu/psci1104"]') as HTMLAnchorElement)?.rel).toContain('noopener');
  expect(host.textContent).toContain('Practice questions and flashcards');
  expect(host.textContent).not.toContain('Policy unavailable');
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

it('will not verify a source until the student says they opened the original', () => {
  mount();
  tab('Research Studio');
  click('Start a research project');
  click('Add a source');
  act(() => (host.querySelector('details.toolkit-evidence') as HTMLDetailsElement).setAttribute('open', ''));
  click('Mark verified');
  expect(host.textContent).toContain('Open the original source and confirm you read it.');
  expect(host.textContent).not.toContain('Marked verified.');
});

it('hides the research and data sections when their flags are off', () => {
  mount(toolkitFlags({ VITE_AI_TOOLKIT: 'preview' }));
  const tabs = [...host.querySelectorAll('[role="tab"]')].map((t) => t.textContent);
  expect(tabs).not.toContain('Research Studio');
  expect(tabs).not.toContain('Data Studio');
  expect(tabs).toContain('Assignments');
});

it('refuses to import data until it is classified, and refuses regulated data outright', () => {
  mount();
  tab('Data Studio');
  const paste = [...host.querySelectorAll('label')].find((l) => l.textContent?.startsWith('CSV text'))!.querySelector('textarea')!;
  type(paste, 'a,b\n1,2\n');
  click('Import pasted data');
  expect(host.textContent).toMatch(/not been classified|Choose what kind of data/);
  const regulated = [...host.querySelectorAll('input[type="radio"]')][4] as HTMLInputElement;
  act(() => regulated.click());
  expect(host.textContent).toContain('Regulated or restricted material is not kept in Semester');
});

it('shows a restricted workbench as needing review, not as a working tool', () => {
  mount();
  tab('All tools');
  act(() => {
    const select = host.querySelector('.toolkit-catalog')!.parentElement!.querySelector('select') as HTMLSelectElement;
    Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value')!.set!.call(select, 'bio');
    select.dispatchEvent(new Event('change', { bubbles: true }));
  });
  const dna = [...host.querySelectorAll('.toolkit-catalog li')].find((li) => li.textContent?.includes('DNA Learning Lab'))!;
  expect(dna.textContent).toContain('Needs review before use');
  expect(dna.querySelector('button')).toBeNull();
});

it('shows the professional boundary a topic runs into, and nothing for ordinary coursework', () => {
  mount();
  const topic = [...host.querySelectorAll('label')].find((l) => l.textContent?.startsWith('Topic'))!.querySelector('input')!;
  type(topic, 'sleep and memory in first-year students');
  expect(host.querySelector('.portal-warning')).toBeNull();
  type(topic, 'answers to the take-home exam');
  expect(host.textContent).toContain('Semester will not produce answers for an assessment');
});

it('keeps the AI-use declaration from leaving until it is complete and attested', () => {
  mount();
  tab('AI-use policy');
  expect(button('Download declaration').disabled).toBe(true);
  expect(host.textContent).toContain('Confirm the attestation.');
});

const importPasted = (tierIndex: number, csv: string) => {
  tab('Data Studio');
  act(() => ([...host.querySelectorAll('input[type="radio"]')][tierIndex] as HTMLInputElement).click());
  type([...host.querySelectorAll('label')].find((l) => l.textContent?.startsWith('CSV text'))!.querySelector('textarea')!, csv);
  click('Import pasted data');
};

it('keeps an education record on the device: no export, and the reason why', () => {
  mount();
  importPasted(3, 'student,grade\nAda,91\n');
  expect(host.textContent).toContain('Imported');
  expect([...host.querySelectorAll('button')].some((b) => /Export cleaned CSV|Export methods/.test(b.textContent ?? ''))).toBe(false);
  expect(host.textContent).toContain('Education records are blocked from AI services, sharing and external tools.');
});

it('offers export for the student’s own data', () => {
  mount();
  importPasted(2, 'x,y\n1,2\n');
  expect(button('Export cleaned CSV')).toBeTruthy();
});

it('says a dataset was not imported when the device refuses to save it, and shows why', () => {
  mount();
  const real = Storage.prototype.setItem;
  vi.spyOn(Storage.prototype, 'setItem').mockImplementation(function (this: Storage, key: string, value: string) {
    if (key === toolkitDataKey()) throw new Error('quota');
    return real.call(this, key, value);
  });
  importPasted(2, 'x,y\n1,2\n');
  expect(host.textContent).not.toContain('Imported');
  expect(host.textContent).toContain('could not be saved on this device');
  expect(host.textContent).toContain('Changes could not be saved: quota');
  expect(button('Download recovery copy')).toBeTruthy();
});

it('never lets datasets grow past their storage budget, however many are imported', () => {
  mount();
  // Quotes and line breaks nearly double in JSON, so each of these is close to the per-file cap once stored.
  const big = 'a\n' + '"q",\n'.repeat(Math.floor((MAX_RAW - 2) / 5));
  for (let i = 0; i < 4; i++) importPasted(2, big);
  expect((localStorage.getItem(toolkitDataKey()) ?? '').length).toBeLessThanOrEqual(DATA_BUDGET);
  expect(host.textContent).toContain('Not enough room on this device');
});

it('does not say AI help is allowed for data that may not go to AI', () => {
  mount();
  tab('Data Studio');
  act(() => ([...host.querySelectorAll('input[type="radio"]')][3] as HTMLInputElement).click());
  expect(host.textContent).toContain('AI help is not available for this kind of data');
  act(() => ([...host.querySelectorAll('input[type="radio"]')][2] as HTMLInputElement).click());
  expect(host.textContent).not.toContain('AI help is not available for this kind of data');
});

it('keeps each account’s toolkit apart on a shared device', () => {
  act(() => root.render(<Toolkit courses={COURSES} accountId="student-a" flags={ALL_ON} now={new Date('2026-09-27T12:00:00')} onOpen={() => {}} onClose={() => {}} />));
  tab('Assignments');
  click(/^Start a essay workspace/);
  expect(host.textContent).toContain('0 of 7 stages done');
  expect(localStorage.getItem(toolkitKey('student-a'))).toContain('"essay"');
  act(() => root.render(<Toolkit key="b" courses={COURSES} accountId="student-b" flags={ALL_ON} now={new Date('2026-09-27T12:00:00')} onOpen={() => {}} onClose={() => {}} />));
  tab('Assignments');
  expect(host.textContent).not.toContain('stages done');
  expect(localStorage.getItem(toolkitKey('student-b'))).toBeNull();
});

it('carries the assignment to the feedback inbox: its title and course, and leaves the toolkit for Study', () => {
  clear();
  mount();
  tab('Assignments');
  click(/^Start a essay workspace/);
  expect(peek('feedback')).toBeNull();
  click('File the feedback I received');
  // The toolkit is a mode of Study, so going there means closing it; navigating to 'study' would leave the student where they are.
  expect(closed).toBe(1);
  expect(opened).not.toContain('study');
  const intent = peek('feedback');
  expect(intent?.work).toBe('Essay');
  expect(intent?.courseCode).toBe('PSCI 1104');
  clear();
});
