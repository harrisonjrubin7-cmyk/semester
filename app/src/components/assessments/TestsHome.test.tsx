// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';

/**
 * Tests as the person sees them: nothing in Connect, a student who starts a
 * test and is sent no key, answers saved as they are chosen, a deadline the
 * server enforces and the screen reports, and a submit that shows a score and
 * says it is not a grade. The rules are `supabase/assessments.check.sql`'s;
 * the loaders are stubbed here.
 */
const mock = vi.hoisted(() => ({
  store: { school: { id: 'vu' }, account: { id: 'u1' } as { id: string } | null, say: vi.fn(), dispatch: vi.fn() },
  rows: [] as unknown[] | null,
  grants: [] as unknown[],
  tests: [] as unknown[],
  attempts: [] as unknown[],
  start: vi.fn(),
  sheet: vi.fn(),
  save: vi.fn(),
  finish: vi.fn(),
  review: vi.fn(),
}));
vi.mock('../../state/store', () => ({ useStore: () => mock.store }));
vi.mock('../../lib/modulemode', async (orig) => ({ ...(await orig<typeof import('../../lib/modulemode')>()), moduleModes: () => Promise.resolve(mock.rows) }));
vi.mock('../../lib/capabilities', () => ({ loadMyCapabilities: () => Promise.resolve(mock.grants) }));
vi.mock('../../lib/assessments/client', async (orig) => ({
  ...(await orig<typeof import('../../lib/assessments/client')>()),
  loadTests: () => Promise.resolve(mock.tests),
  loadAttempts: () => Promise.resolve(mock.attempts),
  loadBanks: () => Promise.resolve([]),
  loadItems: () => Promise.resolve([]),
  startTest: mock.start,
  loadSheet: mock.sheet,
  saveAnswer: mock.save,
  finishTest: mock.finish,
  loadReview: mock.review,
}));
const { TestsHome } = await import('./TestsHome');

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
let root: Root;
let host: HTMLDivElement;
const CORE = [{ module: 'lms_assessments', mode: 'core', frozen: false, killed: false }];
const STUDENT = [{ capability: 'assessments:take', scopeKind: 'course', scopeId: 'vu/ECON 1020/2026FA' }];
const OPEN_TEST = { id: 't1', bankId: 'b1', title: 'Midterm', instructions: 'Closed book.', poolSize: null, itemCount: 2, minutes: 30, opensAt: '2020-01-01T00:00:00Z', closesAt: '2099-01-01T00:00:00Z', attempts: 1, showAnswers: true, status: 'published' };
const SHEET = {
  status: 'in_progress', deadlineAt: '2099-01-01T00:00:00Z', remainingSeconds: 300, score: null, points: null, needsReview: false, answers: {},
  items: [
    { id: 'i1', kind: 'multiple_choice', stem: 'Price rises, demand falls: that is', options: [{ id: 'a', text: 'supply' }, { id: 'b', text: 'the law of demand' }], points: 1 },
    { id: 'i2', kind: 'true_false', stem: 'Scarcity is universal.', options: [], points: 1 },
  ],
};

beforeEach(() => {
  mock.store.account = { id: 'u1' };
  mock.rows = CORE; mock.grants = STUDENT; mock.tests = [OPEN_TEST]; mock.attempts = [];
  for (const f of [mock.start, mock.sheet, mock.save, mock.finish, mock.review, mock.store.say]) f.mockReset();
  mock.start.mockResolvedValue({ attemptId: 'a1', attempt: 1, startedAt: '', deadlineAt: '', resumed: false });
  mock.sheet.mockResolvedValue(SHEET);
  mock.save.mockResolvedValue({ ok: true });
  host = document.createElement('div');
  document.body.append(host);
  root = createRoot(host);
});

/* No root outlives the test that made it. See `src/rootunmount.test.ts`. */
afterEach(() => { act(() => root.unmount()); host.remove(); });

const render = async () => { await act(async () => root.render(<TestsHome />)); };
const button = (name: RegExp) => [...host.querySelectorAll('button')].find((b) => name.test(b.textContent ?? ''));
const start = async () => { await render(); await act(async () => button(/Start the test/)!.click()); };

it('asks a signed-out visitor to sign in', async () => {
  mock.store.account = null;
  await render();
  expect(host.textContent).toContain('Sign in with your school account');
});

it('says nothing is here while the school is in Connect, and when the setting is unreadable', async () => {
  mock.rows = [{ module: 'lms_assessments', mode: 'connect', frozen: false, killed: false }];
  await render();
  expect(host.textContent).toContain('own learning system holds tests');
  act(() => root.unmount()); root = createRoot(host);
  mock.rows = null;
  await render();
  expect(host.textContent).toContain('own learning system holds tests');
});

it('lists an open test with its limit and attempts, and offers to start it', async () => {
  await render();
  expect(host.textContent).toContain('Midterm');
  expect(host.textContent).toContain('30 minutes');
  expect(host.textContent).toContain('0 of 1 attempt used');
  expect(button(/Start the test/)).toBeDefined();
});

it('does not offer a test that has not opened, and offers a resume for one in progress', async () => {
  mock.tests = [{ ...OPEN_TEST, opensAt: '2098-01-01T00:00:00Z' }];
  await render();
  expect(button(/Start the test/)).toBeUndefined();
  act(() => root.unmount()); root = createRoot(host);
  mock.tests = [OPEN_TEST];
  mock.attempts = [{ id: 'a1', assessmentId: 't1', attempt: 1, startedAt: '', deadlineAt: '', status: 'in_progress', score: null, points: null, needsReview: false }];
  await render();
  expect(button(/Resume the test/)).toBeDefined();
});

it('starts under a key and shows the questions and the time left, with no key in sight', async () => {
  await start();
  expect(mock.start).toHaveBeenCalledWith('t1', expect.stringMatching(/^[A-Za-z0-9:._-]{8,128}$/));
  expect(host.textContent).toContain('Price rises, demand falls');
  expect(host.textContent).toContain('Time left: 05:00');
  expect(host.innerHTML).not.toMatch(/answer_key|accepted|correct/);
});

it('saves an answer as it is chosen', async () => {
  await start();
  const radios = [...host.querySelectorAll('input[type="radio"]')] as HTMLInputElement[];
  await act(async () => radios[1].click());
  expect(mock.save).toHaveBeenCalledWith('a1', 'i1', { choice: 'b' });
});

it('says time is up when the server answers that the deadline passed', async () => {
  mock.save.mockResolvedValue({ ok: false, reason: 'time_up' });
  await start();
  await act(async () => ([...host.querySelectorAll('input[type="radio"]')] as HTMLInputElement[])[0].click());
  expect(host.textContent).toContain('Time is up');
});

it('submits, shows a score, and says it is not the grade', async () => {
  mock.finish.mockResolvedValue({ status: 'submitted', score: 1, points: 2, needsReview: true });
  await start();
  await act(async () => button(/Submit the test/)!.click());
  expect(mock.finish).toHaveBeenCalledWith('a1', expect.stringMatching(/^[A-Za-z0-9:._-]{8,128}$/));
  expect(host.textContent).toContain('You scored 1 of 2 points');
  expect(host.textContent).toContain('not your grade');
  expect(host.textContent).toContain('essay answers');
});

it('shows a finished attempt’s review, with the key only when the server sent it', async () => {
  mock.finish.mockResolvedValue({ status: 'submitted', score: 2, points: 2, needsReview: false });
  mock.review.mockResolvedValue({
    status: 'submitted', score: 2, points: 2, needsReview: false, shown: true,
    items: [{ id: 'i1', kind: 'multiple_choice', stem: 'Q one', options: [{ id: 'a', text: 'supply' }, { id: 'b', text: 'the law of demand' }], answer: { choice: 'b' }, correct: true, key: { correct: 'b' }, points: 1 }],
  });
  await start();
  await act(async () => button(/Submit the test/)!.click());
  await act(async () => button(/See your answers/)!.click());
  expect(host.textContent).toContain('Your answer: the law of demand — correct (key: the law of demand)');
});
