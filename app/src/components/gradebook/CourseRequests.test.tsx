// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { CourseRequest, LoadedRequests, RequestAction } from '../../lib/gradebook/requests';

/**
 * Course requests on screen, both sides. A student: nothing is sent before
 * the preview is confirmed, an extension cannot be sent without a date, a
 * question from the instructor is answered naming the version read, a stale
 * withdrawal offers a reload, and a school without the feature, an account
 * without the role and a failed load each say so. An instructor: the TA reads
 * and cannot decide, a faculty member's decision is previewed and names the
 * version read, and a decision that lost a race says so instead of retrying.
 * The server's rules are proved by course-requests.check.sql.
 */

const mock = vi.hoisted(() => ({ rpc: vi.fn(), say: vi.fn(), load: vi.fn() }));
vi.mock('../../lib/cloud', () => ({ cloudConfigured: true, cloud: () => Promise.resolve({ rpc: mock.rpc, from: vi.fn() }) }));
vi.mock('../../state/store', () => ({ useStore: () => ({ say: mock.say }) }));
vi.mock('../../lib/gradebook/requests', async (orig) => ({ ...(await orig<object>()), loadRequests: mock.load }));
const { AskInstructor } = await import('./AskInstructor');
const { RequestQueue } = await import('./RequestQueue');

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
let root: Root;
let host: HTMLDivElement;

beforeEach(() => {
  mock.rpc.mockReset();
  mock.say.mockReset();
  mock.load.mockReset();
  host = document.createElement('div');
  document.body.append(host);
  root = createRoot(host);
});

/* No root outlives the test that made it. See `src/rootunmount.test.ts`. */
afterEach(() => {
  act(() => root.unmount());
  host.remove();
});

const STUDENT = { create: true, decide: false, view: false };
const FACULTY = { create: false, decide: true, view: true };
const TA = { create: false, decide: false, view: true };

const request = (patch: Partial<CourseRequest> = {}): CourseRequest => ({
  id: 'r1',
  studentId: 'maya-0000-1111',
  course: 'HIST 2100',
  term: '2026FA',
  kind: 'extension',
  reason: 'My grandmother’s funeral is that week.',
  itemId: 'essay2',
  requestedDue: '2026-11-10',
  status: 'open',
  decidedBy: null,
  decidedAt: null,
  grantedDue: null,
  decisionNote: '',
  version: 1,
  filedAt: '2026-10-30T10:00:00Z',
  updatedAt: '2026-10-30T10:00:00Z',
  ...patch,
});
const loaded = (requests: CourseRequest[], actions: RequestAction[] = []): LoadedRequests => ({
  available: true,
  requests,
  actions,
  items: [{ id: 'essay2', title: 'Essay 2' }],
});

const button = (name: RegExp) => [...document.querySelectorAll('button')].find((b) => name.test(b.textContent ?? ''));
const flush = () => act(async () => { await new Promise((r) => setTimeout(r, 0)); });
const type = (el: HTMLInputElement | HTMLTextAreaElement, text: string) => {
  const proto = el instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
  act(() => {
    Object.getOwnPropertyDescriptor(proto, 'value')!.set!.call(el, text);
    el.dispatchEvent(new Event('input', { bubbles: true }));
  });
};
const STALE = { data: null, error: { message: 'semester: this request changed since you read it (it is at version 2 now). Reload it and look again', code: '40001' } };

describe('the student’s side', () => {
  it('previews before sending, needs a date for an extension, and sends the request', async () => {
    mock.load.mockResolvedValue(loaded([]));
    mock.rpc.mockResolvedValue({ data: { request: 'r9', status: 'open', version: 1, granted_due: null, at: 't' }, error: null });
    act(() => root.render(<AskInstructor course="HIST 2100" term="2026FA" caps={STUDENT} />));
    await flush();
    expect(host.textContent).toContain('No requests yet');

    act(() => button(/Ask for an extension/)!.click());
    type(host.querySelector('textarea')!, 'My grandmother’s funeral is that week.');
    expect(button(/Review and send/)!.disabled).toBe(true);
    expect(host.textContent).toContain('Choose the date you are asking for.');
    type(host.querySelector('input[type="date"]')!, '2026-11-10');
    expect(button(/Review and send/)!.disabled).toBe(false);

    act(() => button(/Review and send/)!.click());
    expect(mock.rpc).not.toHaveBeenCalled();
    const dialog = document.querySelector('[role="dialog"]')!;
    expect(dialog.textContent).toContain('Extension · HIST 2100');
    expect(dialog.textContent).toContain('You can withdraw it until your instructor decides.');

    act(() => button(/Send the request/)!.click());
    await flush();
    expect(mock.rpc).toHaveBeenCalledTimes(1);
    expect(mock.rpc.mock.calls[0][0]).toBe('course_request_file');
    expect(mock.rpc.mock.calls[0][1]).toMatchObject({
      want_course: 'HIST 2100',
      want_term: '2026FA',
      want_kind: 'extension',
      want_item: null,
      want_requested_due: '2026-11-10',
      want_reason: 'My grandmother’s funeral is that week.',
    });
    expect(host.textContent).toContain('Your request for extension is sent');
    expect(mock.load).toHaveBeenCalledTimes(2);
  });

  it('shows each request’s status in words, and answers a question naming the version read', async () => {
    const asked = request({ status: 'info_requested', version: 2 });
    mock.load.mockResolvedValue(
      loaded(
        [asked, request({ id: 'r0', kind: 'incomplete', itemId: null, requestedDue: null, status: 'denied', decisionNote: 'Bring the letter.', decidedAt: 'x', version: 2 })],
        [{ id: 'a2', requestId: 'r1', actor: 'prof', action: 'info_requested', note: 'Which essay?', version: 2, at: 'x' }],
      ),
    );
    mock.rpc.mockResolvedValue({ data: { request: 'r1', status: 'open', version: 3, granted_due: null, at: 't' }, error: null });
    act(() => root.render(<AskInstructor course="HIST 2100" term="2026FA" caps={STUDENT} />));
    await flush();
    const table = host.querySelector('table')!;
    expect(table.textContent).toContain('Extension · Essay 2');
    expect(table.textContent).toContain('The instructor asked a question');
    expect(table.textContent).toContain('Your instructor asks: “Which essay?”');
    expect(table.textContent).toContain('Denied');
    expect(table.textContent).toContain('“Bring the letter.”');

    type(table.querySelector('textarea')!, 'Essay 2, due the 6th.');
    act(() => button(/Send your answer/)!.click());
    await flush();
    expect(mock.rpc.mock.calls[0]).toEqual(['course_request_respond', expect.objectContaining({ want_request: 'r1', want_note: 'Essay 2, due the 6th.', want_expect: 2 })]);
    expect(host.textContent).toContain('Your answer is sent.');
  });

  it('a withdrawal that lost a race says so and offers a reload, not a retry', async () => {
    mock.load.mockResolvedValue(loaded([request()]));
    mock.rpc.mockResolvedValue(STALE);
    act(() => root.render(<AskInstructor course="HIST 2100" term="2026FA" caps={STUDENT} />));
    await flush();
    act(() => button(/^Withdraw$/)!.click());
    act(() => button(/Withdraw the request/)!.click());
    await flush();
    expect(mock.rpc.mock.calls[0][1]).toMatchObject({ want_request: 'r1', want_expect: 1 });
    expect(host.textContent).toContain('This request changed since you read it');
    expect(button(/^Try again$/)).toBeUndefined();
    act(() => button(/Reload your requests/)!.click());
    await flush();
    expect(mock.load).toHaveBeenCalledTimes(2);
  });

  it('says when the school has not set requests up, and offers no button', async () => {
    mock.load.mockResolvedValue({ available: false, requests: [], actions: [], items: [] });
    act(() => root.render(<AskInstructor course="HIST 2100" term="2026FA" caps={STUDENT} />));
    await flush();
    expect(host.textContent).toContain('not set up at your school yet');
    expect(button(/Ask for/)).toBeUndefined();
  });

  it('says why when the account cannot ask on this course', async () => {
    mock.load.mockResolvedValue(loaded([]));
    act(() => root.render(<AskInstructor course="HIST 2100" term="2026FA" caps={{ create: false, decide: false, view: false }} />));
    await flush();
    expect(host.querySelector('[data-state="permission-denied"]')!.textContent).toContain('You cannot file requests on this course');
    expect(button(/Ask for/)).toBeUndefined();
  });

  it('a failed load says so and loads again', async () => {
    mock.load.mockRejectedValueOnce(new Error('Could not load the requests.')).mockResolvedValue(loaded([]));
    act(() => root.render(<AskInstructor course="HIST 2100" term="2026FA" caps={STUDENT} />));
    expect(host.textContent).toContain('Loading your requests');
    await flush();
    expect(host.querySelector('[role="alert"]')!.textContent).toContain('Your requests did not load');
    act(() => button(/Load again/)!.click());
    await flush();
    expect(host.textContent).toContain('No requests yet');
  });
});

describe('the instructor’s side', () => {
  it('a TA reads the queue and has nothing to decide with', async () => {
    mock.load.mockResolvedValue(loaded([request()]));
    act(() => root.render(<RequestQueue course="HIST 2100" term="2026FA" caps={TA} />));
    await flush();
    expect(host.textContent).toContain('“My grandmother’s funeral is that week.”');
    expect(host.textContent).toContain('The course’s instructor decides them.');
    expect(button(/Review the decision/)).toBeUndefined();
  });

  it('approves an extension with the date granted, after a preview, naming the version read', async () => {
    mock.load.mockResolvedValue(loaded([request({ version: 3 })]));
    mock.rpc.mockResolvedValue({ data: { request: 'r1', status: 'approved', version: 4, granted_due: '2026-11-09', at: 't' }, error: null });
    act(() => root.render(<RequestQueue course="HIST 2100" term="2026FA" caps={FACULTY} />));
    await flush();
    const date = host.querySelector('input[type="date"]') as HTMLInputElement;
    expect(date.value).toBe('2026-11-10');
    type(date, '2026-11-09');
    act(() => button(/Review the decision/)!.click());
    expect(mock.rpc).not.toHaveBeenCalled();
    expect(document.querySelector('[role="dialog"]')!.textContent).toContain('A decided request is closed.');
    // An extension on an item moves that student's due date for it (20261021130000), and the preview says so.
    expect(document.querySelector('[role="dialog"]')!.textContent).toMatch(/Nov.*9.*becomes their due date for Essay 2, unless the item’s own date is later/);
    act(() => button(/^Approve$/)!.click());
    await flush();
    expect(mock.rpc.mock.calls[0]).toEqual([
      'course_request_decide',
      expect.objectContaining({ want_request: 'r1', want_outcome: 'approve', want_granted_due: '2026-11-09', want_expect: 3 }),
    ]);
    expect(host.textContent).toContain('is approved, with a new date of');
  });

  it('a decision a colleague beat says so and offers a reload', async () => {
    mock.load.mockResolvedValue(loaded([request()]));
    mock.rpc.mockResolvedValue(STALE);
    act(() => root.render(<RequestQueue course="HIST 2100" term="2026FA" caps={FACULTY} />));
    await flush();
    act(() => button(/Review the decision/)!.click());
    act(() => button(/^Approve$/)!.click());
    await flush();
    expect(host.textContent).toContain('This request changed since you read it');
    expect(button(/^Try again$/)).toBeUndefined();
    act(() => button(/Reload the requests/)!.click());
    await flush();
    expect(mock.load).toHaveBeenCalledTimes(2);
  });

  it('denying needs a note before it can be reviewed', async () => {
    mock.load.mockResolvedValue(loaded([request({ kind: 'incomplete', requestedDue: null, itemId: null })]));
    act(() => root.render(<RequestQueue course="HIST 2100" term="2026FA" caps={FACULTY} />));
    await flush();
    const select = host.querySelector('select')!;
    act(() => {
      select.value = 'deny';
      select.dispatchEvent(new Event('change', { bubbles: true }));
    });
    expect(button(/Review the decision/)!.disabled).toBe(true);
    expect(host.textContent).toContain('Say why; the student reads it.');
  });

  it('an empty queue says what will appear', async () => {
    mock.load.mockResolvedValue(loaded([]));
    act(() => root.render(<RequestQueue course="HIST 2100" term="2026FA" caps={FACULTY} />));
    await flush();
    expect(host.textContent).toContain('No requests waiting');
  });

  it('without a reading role it reads nothing and says why', async () => {
    act(() => root.render(<RequestQueue course="HIST 2100" term="2026FA" caps={{ create: false, decide: false, view: false }} />));
    await flush();
    expect(mock.load).not.toHaveBeenCalled();
    expect(host.querySelector('[data-state="permission-denied"]')).not.toBeNull();
  });
});
