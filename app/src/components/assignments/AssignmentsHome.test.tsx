// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';

/**
 * Assignments, as the person sees them: nothing in Connect, the instructor's
 * half for an author, the student's half for a student, and a hand-in that
 * goes out with its key and comes back with a receipt. The database decides
 * what is accepted; the loaders are stubbed here and
 * `supabase/assignments.check.sql` holds the rules.
 */
const mock = vi.hoisted(() => {
  const draft = { id: 'd1', title: 'Essay draft', instructions: '', points: null, dueAt: '2099-01-01T00:00:00Z', latePolicy: 'refuse', lateUntil: null, attempts: 1, status: 'draft' };
  const open = { id: 'p1', title: 'Problem set 1', instructions: 'Do chapter 3.', points: 10, dueAt: '2099-01-01T00:00:00Z', latePolicy: 'refuse', lateUntil: null, attempts: 2, status: 'published' };
  return {
    draft, open,
    store: { school: { id: 'vu' }, account: { id: 'u1' } as { id: string } | null, say: vi.fn(), dispatch: vi.fn() },
    rows: [] as unknown[] | null,
    grants: [] as unknown[],
    list: [] as unknown[],
    attempts: [] as unknown[],
    publish: vi.fn(async () => undefined),
    submit: vi.fn(async () => ({ submissionId: 's1', attempt: 1, late: false, submittedAt: '2026-10-01T12:00:00Z', receiptHash: 'ab'.repeat(32) })),
    uploads: vi.fn(),
  };
});
vi.mock('../../state/store', () => ({ useStore: () => mock.store }));
vi.mock('../../lib/modulemode', async (orig) => ({ ...(await orig<typeof import('../../lib/modulemode')>()), moduleModes: () => Promise.resolve(mock.rows) }));
vi.mock('../../lib/capabilities', () => ({ loadMyCapabilities: () => Promise.resolve(mock.grants) }));
vi.mock('../../lib/assignments/client', async (orig) => ({
  ...(await orig<typeof import('../../lib/assignments/client')>()),
  loadAssignments: () => Promise.resolve(mock.list),
  loadMyAttempts: () => Promise.resolve(mock.attempts),
  loadMyExtensions: () => Promise.resolve(new Map()),
  loadTimezone: () => Promise.resolve('America/Chicago'),
  publishAssignment: mock.publish,
  submitAssignment: mock.submit,
  uploadFile: mock.uploads,
}));
const { AssignmentsHome } = await import('./AssignmentsHome');

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
let root: Root;
let host: HTMLDivElement;

const CORE = [{ module: 'lms_assignments', mode: 'core', frozen: false, killed: false }];
const AUTHOR = [{ capability: 'assignments:author', scopeKind: 'course', scopeId: 'vu/ECON 1020/2026FA' }];
const STUDENT = [{ capability: 'assignments:submit', scopeKind: 'course', scopeId: 'vu/ECON 1020/2026FA' }];

beforeEach(() => {
  mock.store.account = { id: 'u1' };
  mock.rows = CORE;
  mock.grants = STUDENT;
  mock.list = [mock.draft, mock.open];
  mock.attempts = [];
  mock.publish.mockClear();
  mock.submit.mockClear();
  host = document.createElement('div');
  document.body.append(host);
  root = createRoot(host);
});

/* No root outlives the test that made it. See `src/rootunmount.test.ts`. */
afterEach(() => {
  act(() => root.unmount());
  host.remove();
});

const render = async () => { await act(async () => root.render(<AssignmentsHome />)); };
const button = (name: RegExp) => [...host.querySelectorAll('button')].find((b) => name.test(b.textContent ?? ''));
const type = async (el: HTMLTextAreaElement, value: string) => {
  await act(async () => {
    Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')!.set!.call(el, value);
    el.dispatchEvent(new Event('input', { bubbles: true }));
  });
};

it('asks a signed-out visitor to sign in', async () => {
  mock.store.account = null;
  await render();
  expect(host.textContent).toContain('Sign in with your school account');
});

it('shows nothing to hand in while the school is in Connect, and says why', async () => {
  mock.rows = [{ module: 'lms_assignments', mode: 'connect', frozen: false, killed: false }];
  await render();
  expect(host.textContent).toContain('learning system holds assignments');
  expect(host.querySelector('textarea')).toBeNull();
});

it('treats an unreadable setting as Connect', async () => {
  mock.rows = null;
  await render();
  expect(host.textContent).toContain('learning system holds assignments');
});

it('shows a student the published assignment, hides the draft, and offers the hand-in', async () => {
  await render();
  expect(host.textContent).toContain('Problem set 1');
  expect(host.textContent).not.toContain('Essay draft');
  expect(host.textContent).toContain('0 of 2 attempts used');
  expect(button(/Publish/)).toBeUndefined();
  expect(button(/Hand in your work/)).toBeDefined();
});

it('hands work in under one key, and shows what came back', async () => {
  await render();
  await act(async () => button(/Hand in your work/)!.click());
  expect((button(/Hand it in/) as HTMLButtonElement).disabled).toBe(true);
  await type(host.querySelector('textarea')!, 'My answer');
  await act(async () => button(/Hand it in/)!.click());
  expect(mock.submit).toHaveBeenCalledTimes(1);
  const [id, body, files, key] = mock.submit.mock.calls[0] as unknown as [string, string, unknown[], string];
  expect([id, body, files]).toEqual(['p1', 'My answer', []]);
  expect(key).toMatch(/^[A-Za-z0-9:._-]{8,128}$/);
  expect(mock.store.say).toHaveBeenCalledWith(expect.stringContaining('Handed in'));
});

it('does not offer a hand-in once the attempts are used, and lets the student keep a receipt', async () => {
  mock.attempts = [
    { id: 's1', assignmentId: 'p1', attempt: 1, submittedAt: '2026-10-01T12:00:00Z', late: false, body: 'x', receiptHash: 'ab'.repeat(32), statement: '', files: 0 },
    { id: 's2', assignmentId: 'p1', attempt: 2, submittedAt: '2026-10-02T12:00:00Z', late: true, body: 'y', receiptHash: 'cd'.repeat(32), statement: '', files: 1 },
  ];
  await render();
  expect(host.textContent).toContain('You have used all 2 attempts.');
  expect(host.textContent).toContain('marked late');
  expect(button(/Hand in/)).toBeUndefined();
  expect(button(/Download receipt/)).toBeDefined();
});

it('shows an instructor the draft and publishes it', async () => {
  mock.grants = AUTHOR;
  await render();
  expect(host.textContent).toContain('Essay draft');
  expect(host.textContent).toContain('Problem set 1');
  await act(async () => button(/^Publish$/)!.click());
  expect(mock.publish).toHaveBeenCalledWith('d1', expect.stringMatching(/^[A-Za-z0-9:._-]{8,128}$/));
});

it('says so when the account teaches or takes no course', async () => {
  mock.grants = [];
  await render();
  expect(host.textContent).toContain('not an instructor or a student');
});
