// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';

/**
 * Attendance as the person sees it: nothing in Connect, the instructor's half
 * for someone who takes it, the student's for the roster, and a check-in that
 * goes out with its key and says what the database answered. A wrong code is
 * an answer, not a crash. The rules are `supabase/attendance.check.sql`'s.
 */
const mock = vi.hoisted(() => ({
  store: { school: { id: 'vu' }, account: { id: 'u1' } as { id: string } | null, say: vi.fn(), dispatch: vi.fn() },
  rows: [] as unknown[] | null,
  grants: [] as unknown[],
  sessions: [] as unknown[],
  marks: [] as unknown[],
  checkIn: vi.fn(),
  open: vi.fn(async () => ({ id: 's9', code: '123456' })),
  close: vi.fn(async () => 2),
}));
vi.mock('../../state/store', () => ({ useStore: () => mock.store }));
vi.mock('../../lib/modulemode', async (orig) => ({ ...(await orig<typeof import('../../lib/modulemode')>()), moduleModes: () => Promise.resolve(mock.rows) }));
vi.mock('../../lib/capabilities', () => ({ loadMyCapabilities: () => Promise.resolve(mock.grants) }));
vi.mock('../../lib/attendance/client', async (orig) => ({
  ...(await orig<typeof import('../../lib/attendance/client')>()),
  loadSessions: () => Promise.resolve(mock.sessions),
  loadMarks: () => Promise.resolve(mock.marks),
  checkIn: mock.checkIn,
  openSession: mock.open,
  closeSession: mock.close,
}));
const { AttendanceHome } = await import('./AttendanceHome');

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
let root: Root;
let host: HTMLDivElement;
const CORE = [{ module: 'attendance', mode: 'core', frozen: false, killed: false }];
const TAKER = [{ capability: 'attendance:take', scopeKind: 'course', scopeId: 'vu/ECON 1020/2026FA' }];
const STUDENT = [{ capability: 'attendance:attend', scopeKind: 'course', scopeId: 'vu/ECON 1020/2026FA' }];

beforeEach(() => {
  mock.store.account = { id: 'u1' };
  mock.rows = CORE; mock.grants = STUDENT; mock.sessions = []; mock.marks = [];
  mock.checkIn.mockReset(); mock.open.mockClear(); mock.close.mockClear();
  host = document.createElement('div');
  document.body.append(host);
  root = createRoot(host);
});

/* No root outlives the test that made it. See `src/rootunmount.test.ts`. */
afterEach(() => { act(() => root.unmount()); host.remove(); });

const render = async () => { await act(async () => root.render(<AttendanceHome />)); };
const button = (name: RegExp) => [...host.querySelectorAll('button')].find((b) => name.test(b.textContent ?? ''));
const typeInto = async (el: HTMLInputElement, value: string) => {
  await act(async () => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(el, value);
    el.dispatchEvent(new Event('input', { bubbles: true }));
  });
};

it('asks a signed-out visitor to sign in', async () => {
  mock.store.account = null;
  await render();
  expect(host.textContent).toContain('Sign in with your school account');
});

it('says nothing is here while the school is in Connect, and when the setting is unreadable', async () => {
  mock.rows = [{ module: 'attendance', mode: 'connect', frozen: false, killed: false }];
  await render();
  expect(host.textContent).toContain('own system holds attendance');
  act(() => root.unmount()); root = createRoot(host);
  mock.rows = null;
  await render();
  expect(host.textContent).toContain('own system holds attendance');
});

it('shows a student a check-in, and keeps the check-in button off until six digits are typed', async () => {
  await render();
  expect((button(/^Check in$/) as HTMLButtonElement).disabled).toBe(true);
  await typeInto(host.querySelector('input[inputmode="numeric"]') as HTMLInputElement, '12a345');
  expect((host.querySelector('input[inputmode="numeric"]') as HTMLInputElement).value).toBe('12345');
});

it('sends the code under a key and shows what the database answered', async () => {
  mock.checkIn.mockResolvedValue({ ok: true, status: 'late', course: 'ECON 1020', heldOn: '2026-10-01' });
  await render();
  await typeInto(host.querySelector('input[inputmode="numeric"]') as HTMLInputElement, '123456');
  await act(async () => button(/^Check in$/)!.click());
  expect(mock.checkIn).toHaveBeenCalledWith('123456', expect.stringMatching(/^[A-Za-z0-9:._-]{8,128}$/));
  expect(mock.store.say).toHaveBeenCalledWith(expect.stringContaining('late'));
});

it('says a wrong code in words, and that too many tries wait', async () => {
  mock.checkIn.mockResolvedValue({ ok: false, reason: 'too_many_tries' });
  await render();
  await typeInto(host.querySelector('input[inputmode="numeric"]') as HTMLInputElement, '000000');
  await act(async () => button(/^Check in$/)!.click());
  expect(host.textContent).toContain('Too many tries');
});

it('shows a student their own marks, latest version, and a tally', async () => {
  mock.marks = [
    { id: 'a', sessionId: 's1', studentId: 'u1', heldOn: '2026-10-01', course: 'ECON 1020', version: 1, status: 'absent', method: 'close', note: '', markedAt: '' },
    { id: 'b', sessionId: 's1', studentId: 'u1', heldOn: '2026-10-01', course: 'ECON 1020', version: 2, status: 'excused', method: 'instructor', note: 'Illness', markedAt: '' },
  ];
  await render();
  expect(host.textContent).toContain('Excused');
  expect(host.textContent).toContain('Illness');
  expect(host.textContent).toContain('0 present · 0 late · 0 absent · 1 excused');
});

it('shows a taker the open session and its code, and closes it', async () => {
  mock.grants = TAKER;
  mock.sessions = [{ id: 's1', title: 'Week 1', heldOn: '2026-10-01', opensAt: '2026-10-01T15:00:00Z', closesAt: '2026-10-01T16:00:00Z', lateAfter: 10, code: '482913', status: 'open' }];
  await render();
  expect(host.textContent).toContain('482913');
  await act(async () => button(/Close and mark the rest absent/)!.click());
  expect(mock.close).toHaveBeenCalledWith('s1', expect.stringMatching(/^[A-Za-z0-9:._-]{8,128}$/));
  expect(mock.store.say).toHaveBeenCalledWith('Closed. 2 students marked absent.');
});

it('opens a session and says the code', async () => {
  mock.grants = TAKER;
  await render();
  await act(async () => button(/Open a session now/)!.click());
  expect(mock.open).toHaveBeenCalledTimes(1);
  expect(mock.store.say).toHaveBeenCalledWith('Open. The code is 123456.');
});
