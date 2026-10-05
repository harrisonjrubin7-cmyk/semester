// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';

/**
 * Faculty Course Studio on screen (D-100 slice 3): offered only to someone
 * the server says may publish, every publish previewed and confirmed, the
 * preview drawn by the engine students' screens use, and nothing about any
 * student anywhere in it. The server's own rules: coursestudio.check.sql.
 */

const mock = vi.hoisted(() => {
  const chain = () => {
    const q = { select: () => q, eq: () => q, in: () => q, then: (ok: (r: unknown) => unknown) => Promise.resolve({ data: [], error: null }).then(ok) };
    return q;
  };
  return { rpc: vi.fn(), from: vi.fn(chain), account: { id: 'prof' } as { id: string } | null };
});
vi.mock('../lib/cloud', () => ({ cloudConfigured: true, cloud: () => Promise.resolve({ rpc: mock.rpc, from: mock.from }) }));
vi.mock('../state/store', () => ({ useStore: () => ({ account: mock.account, state: { term: '2026FA' } }) }));
const { CourseStudio, CourseStudioEntry } = await import('./CourseStudio');

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
let root: Root;
let host: HTMLDivElement;

beforeEach(() => {
  mock.rpc.mockReset();
  mock.account = { id: 'prof' };
  host = document.createElement('div');
  document.body.append(host);
  root = createRoot(host);
});

/* No root outlives the test that made it. See `src/rootunmount.test.ts`. */
afterEach(() => {
  act(() => root.unmount());
  host.remove();
});

const button = (name: RegExp) => [...host.querySelectorAll('button')].find((b) => name.test(b.textContent ?? ''));
const control = (label: RegExp) => [...host.querySelectorAll('label')].find((l) => label.test(l.textContent ?? ''))!.querySelector('input, select, textarea') as HTMLInputElement;
const setValue = (el: HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement, v: string) =>
  act(() => {
    const proto = el instanceof HTMLSelectElement ? HTMLSelectElement.prototype : el instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
    Object.getOwnPropertyDescriptor(proto, 'value')!.set!.call(el, v);
    el.dispatchEvent(new Event(el instanceof HTMLSelectElement ? 'change' : 'input', { bubbles: true }));
  });
const open = async () => {
  await act(async () => root.render(<CourseStudio courses={['ECON 1020']} term="2026FA" />));
};

it('is not offered to an account the server does not say may publish', async () => {
  mock.rpc.mockResolvedValue({ data: [], error: null });
  await act(async () => root.render(<CourseStudioEntry on />));
  expect(host.textContent).toBe('');
});

it('is not offered with the module off, and does not even ask', async () => {
  await act(async () => root.render(<CourseStudioEntry on={false} />));
  expect(host.textContent).toBe('');
  expect(mock.rpc).not.toHaveBeenCalled();
});

it('is offered, for the courses it names, to faculty', async () => {
  mock.rpc.mockResolvedValue({ data: [{ course_code: 'ECON 1020' }], error: null });
  await act(async () => root.render(<CourseStudioEntry on />));
  expect(host.textContent).toContain('You can publish AI rules, guidance and study packs for ECON 1020.');
  await act(async () => button(/Open Course Studio/)!.click());
  expect(host.textContent).toContain('Nothing here shows you anything about students.');
});

it('previews rules with the students’ engine, and publishes only on a confirmation', async () => {
  await open();
  setValue(control(/For every use you do not name below/), 'prohibited');
  const practice = [...host.querySelectorAll('label.studio-use')].find((l) => /Practice questions/.test(l.textContent ?? ''))!.querySelector('select')!;
  setValue(practice, 'allowed');
  setValue(control(/In your own words/), 'No AI on papers; practice quizzes are fine.');
  const preview = host.querySelector('[aria-label="What students will see"]')!.textContent!;
  expect(preview).toContain('Set by your instructor');
  expect(preview).toMatch(/Allowed.*Practice questions and flashcards/);
  expect(preview).toMatch(/Not allowed.*Brainstorming/);
  expect(preview).toContain('“No AI on papers; practice quizzes are fine.”');

  act(() => button(/Publish these rules/)!.click());
  expect(host.textContent).toContain('A published version is never changed');
  expect(mock.rpc).not.toHaveBeenCalledWith('publish_course_rules', expect.anything());
  mock.rpc.mockResolvedValue({ data: 1, error: null });
  await act(async () => button(/^Publish$/)!.click());
  expect(mock.rpc).toHaveBeenCalledWith('publish_course_rules', expect.objectContaining({ want_course: 'ECON 1020', want_term: '2026FA', want_blanket: 'prohibited', want_uses: { practice: 'allowed' } }));
  expect(host.querySelector('[role="status"]')?.textContent).toBe('AI rules published for ECON 1020 as version 1.');
});

it('will not publish final answers as permitted until the instructor says so by name (F3)', async () => {
  await open();
  const fa = [...host.querySelectorAll('label.studio-use')].find((l) => /final answers/.test(l.textContent ?? ''))!.querySelector('select')!;
  setValue(fa, 'required');
  expect(button(/Publish these rules/)?.disabled).toBe(true);
  expect(host.textContent).toContain('Confirm that AI may produce final answers for assessments in this course.');
  act(() => (control(/I mean it: AI may produce final answers/) as HTMLInputElement).click());
  expect(button(/Publish these rules/)?.disabled).toBe(false);
});

it('says what the server refused', async () => {
  await open();
  setValue(control(/For every use you do not name below/), 'allowed');
  act(() => button(/Publish these rules/)!.click());
  mock.rpc.mockResolvedValue({ data: null, error: { message: 'semester: you do not teach that course here' } });
  await act(async () => button(/^Publish$/)!.click());
  expect(host.querySelector('[role="alert"]')?.textContent).toBe('Not published: semester: you do not teach that course here');
});

it('builds a pack of references, marks do-not-use ones, and publishes it', async () => {
  await open();
  const tab = [...host.querySelectorAll('button')].find((b) => b.textContent === 'Study packs')!;
  act(() => tab.click());
  act(() => button(/New pack/)!.click());
  setValue(control(/Pack name/), 'Midterm 1');
  setValue(control(/^Title/), 'Week 4 slides');
  act(() => button(/Add a reference/)!.click());
  const titles = [...host.querySelectorAll('label')].filter((l) => /^Title/.test(l.textContent ?? '')).map((l) => l.querySelector('input')!);
  setValue(titles[1], 'Last year’s answer key');
  const uses = [...host.querySelectorAll('label')].filter((l) => /Use it as/.test(l.textContent ?? '')).map((l) => l.querySelector('select')!);
  setValue(uses[1], 'prohibited');
  expect(host.textContent).toContain('“Do not use” references are shown to students as such, and never sent to an AI.');

  act(() => button(/Publish this pack/)!.click());
  mock.rpc.mockResolvedValue({ data: 'pack', error: null });
  await act(async () => button(/^Publish$/)!.click());
  const [, args] = mock.rpc.mock.calls.find(([fn]) => fn === 'publish_study_pack')!;
  expect(args.want_items.map((i: { title: string; authority: string }) => [i.title, i.authority])).toEqual([
    ['Week 4 slides', 'supplemental'],
    ['Last year’s answer key', 'prohibited'],
  ]);
});

it('has nothing in it about students', async () => {
  await open();
  for (const name of ['AI rules', 'Guidance', 'Study packs', 'History']) {
    await act(async () => [...host.querySelectorAll('button')].find((b) => b.textContent === name)!.click());
    expect(host.textContent).not.toMatch(/students? (viewed|opened|read)|roster|enrolled|\d+ students/i);
  }
});
