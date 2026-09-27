// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';

/**
 * What an instructor published, inside Study Studio (Course Studio, D-100
 * slices 2 and 4): their packs as a reading list, their do-not-use references
 * held back from the AI whatever the student ticks, and their rules deciding
 * whether a guide can be made at all.
 */

const mock = vi.hoisted(() => ({
  ask: vi.fn(),
  published: {} as Record<string, unknown>,
}));
vi.mock('../state/store', () => ({
  useNow: () => new Date('2026-09-23T12:00:00Z'),
  useStore: () => ({
    account: { id: 'student' },
    state: { term: '2026FA', sample: false, reviews: {}, updates: [], notes: [] },
    catalog: { byId: { econ: { code: 'ECON 1020', ai: { stance: 'allowed', note: '' } } } },
    dispatch: vi.fn(),
  }),
}));
vi.mock('../lib/live', () => ({
  useLive: () => ({
    guide: {
      code: 'ECON 1020',
      source: 'Course guide',
      units: [
        { name: 'Opportunity cost', cards: [{ q: 'What is opportunity cost?', a: 'The value of the next best alternative.' }] },
        { name: 'Old answer key', cards: [{ q: 'Question 3?', a: 'The answer to question 3.' }] },
      ],
    },
  }),
}));
vi.mock('../lib/claude', () => ({ ask: mock.ask }));
vi.mock('../lib/assistant', () => ({ configured: () => true, routeLabel: () => 'test connection' }));
vi.mock('./Drawing', () => ({ Drawing: () => null }));
vi.mock('../lib/courserules', async (original) => ({
  ...(await original<typeof import('../lib/courserules')>()),
  useCoursePublications: () => mock.published,
}));
const { StudyStudio } = await import('./StudyStudio');

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
let root: Root;
let host: HTMLDivElement;

const PACK = {
  id: 'p1',
  title: 'Midterm 1',
  note: 'Start with the slides.',
  published: '2026-09-02',
  items: [
    { title: 'Week 4 slides', citation: 'Slides, week 4', link: 'https://lms.example/w4', authority: 'authoritative' },
    { title: 'Old Answer Key.pdf', citation: '', link: '', authority: 'prohibited' },
  ],
};

beforeEach(() => {
  localStorage.clear();
  mock.ask.mockReset();
  mock.published = { 'ECON 1020': { packs: [PACK] } };
  host = document.createElement('div');
  document.body.append(host);
  root = createRoot(host);
});

/* No root outlives the test that made it. See `src/rootunmount.test.ts`. */
afterEach(() => {
  act(() => root.unmount());
  host.remove();
});

const button = (text: string) => [...host.querySelectorAll('button')].find((b) => b.textContent?.trim() === text) as HTMLButtonElement;
const check = (text: string) => {
  const box = [...host.querySelectorAll('label')].find((l) => l.textContent?.includes(text))?.querySelector('input[type=checkbox]') as HTMLInputElement;
  act(() => box.click());
};
const mount = () => act(() => root.render(<StudyStudio courseId="econ" onClose={() => {}} />));

it('lists the instructor’s packs as a reading list, links out, and says what is never sent', () => {
  mount();
  const packs = host.querySelector('.study-packs')!;
  expect(packs.textContent).toContain('Study packs from your instructor (1)');
  expect(packs.textContent).toContain('Midterm 1');
  expect(packs.textContent).toContain('Start with the slides.');
  expect(packs.textContent).toContain('Authoritative · Slides, week 4');
  expect((packs.querySelector('a[href="https://lms.example/w4"]') as HTMLAnchorElement).rel).toContain('noopener');
  expect(packs.textContent).toContain('Do not use — never sent to an AI, even if you add it as a source');
});

it('holds back a ticked source the instructor marked do-not-use, and names it', async () => {
  mount();
  check('Opportunity cost');
  check('Old answer key');
  expect(host.textContent).toContain('Not sent: Old answer key — your instructor marked it do-not-use.');
  check('Send the selected text');
  mock.ask.mockResolvedValue(JSON.stringify({ sections: [{ format: 'comprehensive', title: 'S', body: 'b [unit-0].', citations: [{ sourceId: 'unit-0', quote: 'The value of the next best alternative.' }] }] }));
  await act(async () => button('Create study guide').click());
  const payload = JSON.parse(mock.ask.mock.calls[0][0].messages[0].content);
  expect(payload.sources.map((s: { id: string }) => s.id)).toEqual(['unit-0']);
  expect(JSON.stringify(payload)).not.toContain('The answer to question 3');
});

it('makes nothing when every ticked source is do-not-use', () => {
  mount();
  check('Old answer key');
  check('Send the selected text');
  expect(button('Create study guide').disabled).toBe(true);
});

it('holds nothing back when there are no packs', () => {
  mock.published = {};
  mount();
  check('Old answer key');
  expect(host.textContent).not.toContain('Not sent:');
  expect(host.querySelector('.study-packs')).toBeNull();
});

it('follows the instructor’s rules over the student’s own note, and says whose they are', () => {
  mock.published = { 'ECON 1020': { packs: [], rules: { blanket: null, uses: { practice: 'prohibited' }, words: 'No AI practice sets.', link: '', effective: '', published: '2026-09-01' } } };
  mount();
  check('Opportunity cost');
  expect(host.textContent).toContain('Course AI policy for study guides: Not allowed · set by your instructor, published 2026-09-01');
  expect(button('Create study guide').disabled).toBe(true);
});

it('holds a do-not-use source back from teach-back too, which sends the same selection', async () => {
  mount();
  check('Opportunity cost');
  check('Old answer key');
  check('Send the selected text');
  const field = (name: string) => [...host.querySelectorAll('[aria-labelledby=teachback-title] label')].find((l) => l.textContent?.startsWith(name))!.querySelector('input,textarea') as HTMLInputElement;
  const type = (el: HTMLInputElement | HTMLTextAreaElement, value: string) => {
    const set = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(el), 'value')!.set!;
    act(() => {
      set.call(el, value);
      el.dispatchEvent(new Event('input', { bubbles: true }));
    });
  };
  type(field('Topic'), 'Opportunity cost');
  type(field('Your explanation'), 'It is what you give up.');
  mock.ask.mockResolvedValue(JSON.stringify({ covered: [], missing: [], conflicts: [] }));
  await act(async () => button('Send my explanation and the selected text to check it').click());
  expect(mock.ask).toHaveBeenCalledTimes(1);
  const sent = JSON.stringify(mock.ask.mock.calls[0][0]);
  expect(sent).toContain('The value of the next best alternative.');
  expect(sent).not.toContain('The answer to question 3');
});
