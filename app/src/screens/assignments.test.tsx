// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ServiceError } from '../lib/attempt';
import { forgetModuleModes } from '../lib/modulemode';
import { sha256Hex } from '../lib/assignments/views';
import type { Loaded } from '../lib/assignments/client';

/**
 * Assignments, driven against a replaced account service.
 *
 * The mode read is the real one over a fake database; the assignments client's
 * reads and writes are replaced. Under test: that the screen stops at the mode
 * without reading a course when the school has not switched assignments to
 * Core, that who sees which half comes from course-and-term grants, that a
 * student's submission carries one key across a lost reply and a new key after
 * an answer, that a refusal is the server's sentence, that a receipt can be
 * checked against the text it covers, that a draft typed on the device comes
 * back, and that an instructor authors, publishes, closes and extends — and a
 * teaching assistant reads without being offered any of it.
 */

const mock = vi.hoisted(() => ({
  configured: true,
  user: 'ana-0001-aaaa' as string | null,
  school: 'vu' as string | null,
  modes: [{ module: 'lms_assignments', mode: 'core', frozen: false, killed: false }] as unknown[] | 'error',
  caps: vi.fn(),
  load: vi.fn(),
  create: vi.fn(),
  revise: vi.fn(),
  publish: vi.fn(),
  close: vi.fn(),
  extend: vi.fn(),
  submit: vi.fn(),
  dispatch: vi.fn(),
  say: vi.fn(),
}));

function table(name: string) {
  const self: Record<string, unknown> = {};
  self.select = () => self;
  self.eq = () => self;
  self.maybeSingle = async () => ({ data: name === 'profiles' && mock.school ? { school_id: mock.school } : null, error: null });
  self.then = (ok: (r: unknown) => unknown) => Promise.resolve({ data: [], error: null }).then(ok);
  return self;
}

vi.mock('../lib/cloud', () => ({
  get cloudConfigured() {
    return mock.configured;
  },
  cloud: async () => ({
    auth: { getUser: async () => ({ data: { user: mock.user ? { id: mock.user } : null }, error: null }) },
    rpc: async (name: string) =>
      name === 'effective_module_modes'
        ? mock.modes === 'error' ? { data: null, error: { message: 'down' } } : { data: mock.modes, error: null }
        : { data: null, error: null },
    from: (name: string) => table(name),
  }),
}));
vi.mock('../state/store', () => ({
  useStore: () => ({ dispatch: mock.dispatch, say: mock.say, account: mock.user ? { id: mock.user } : null, state: {} }),
  useNow: () => new Date(),
}));
vi.mock('../lib/capabilities', async (orig) => ({ ...(await orig<object>()), loadMyCapabilities: mock.caps }));
vi.mock('../lib/assignments/client', async (orig) => ({
  ...(await orig<object>()),
  loadAssignments: mock.load,
  createAssignment: mock.create,
  reviseAssignment: mock.revise,
  publishAssignment: mock.publish,
  closeAssignment: mock.close,
  extendAssignment: mock.extend,
  submitWork: mock.submit,
}));

import { Assignments } from './Assignments';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let host: HTMLDivElement;
let root: Root;

const grant = (capability: string, scopeId: string) => ({ capability, scopeKind: 'course', scopeId });
const FA = 'vu/ECON 1020/2026FA';
const PROF = [grant('assignments:author', FA), grant('assignments:review', FA)];
const TA = [grant('assignments:review', FA)];
const STUDENT = [grant('grades:receive', FA)];

const HOUR = 3_600_000;
const iso = (hours: number): string => new Date(Date.now() + hours * HOUR).toISOString();

const assignment = (patch: Record<string, unknown> = {}) => ({
  id: 'a1', course: 'ECON 1020', term: '2026FA', title: 'Problem set 1', instructions: 'Do the first five.',
  dueAt: iso(48), closesAt: iso(96), allowResubmission: true, maxVersions: 3, status: 'published',
  createdAt: iso(-24), publishedAt: iso(-23), closedAt: null, ...patch,
});
const LOADED = (patch: Partial<Loaded> = {}): Loaded => ({
  course: 'ECON 1020', term: '2026FA', assignments: [assignment()] as Loaded['assignments'],
  extensions: [], versions: [], receipts: [], events: [], ...patch,
});
const version = (patch: Record<string, unknown> = {}) => ({
  id: 'v1', submissionId: 's1', assignmentId: 'a1', studentId: 'ana-0001-aaaa', version: 1, body: 'Answer one.',
  contentSha256: '0'.repeat(64), dueAtThen: iso(48), late: false, submittedAt: iso(-1), ...patch,
});
const receipt = (patch: Record<string, unknown> = {}) => ({
  id: 'r1', versionId: 'v1', assignmentId: 'a1', studentId: 'ana-0001-aaaa', code: 'SR-0123456789AB',
  contentSha256: '0'.repeat(64), submittedAt: iso(-1), dueAtThen: iso(48), late: false, ...patch,
});

beforeEach(() => {
  vi.resetAllMocks();
  localStorage.clear();
  forgetModuleModes();
  mock.configured = true;
  mock.user = 'ana-0001-aaaa';
  mock.school = 'vu';
  mock.modes = [{ module: 'lms_assignments', mode: 'core', frozen: false, killed: false }];
  mock.caps.mockResolvedValue(STUDENT);
  mock.load.mockResolvedValue(LOADED());
  mock.create.mockResolvedValue('new-id');
  mock.revise.mockResolvedValue(undefined);
  mock.publish.mockResolvedValue(undefined);
  mock.close.mockResolvedValue(undefined);
  mock.extend.mockResolvedValue(undefined);
  mock.submit.mockResolvedValue({ version: 1, receipt: 'SR-AAAAAAAAAAAA', submittedAt: iso(0), late: false });
  host = document.createElement('div');
  document.body.append(host);
  root = createRoot(host);
});

afterEach(() => {
  act(() => root.unmount());
  host.remove();
});

async function flush() {
  for (let i = 0; i < 5; i++) await act(async () => {});
}
/** Flush until a condition holds, for work that resolves on its own schedule (a hash, a timer). */
async function until(ok: () => boolean) {
  for (let i = 0; i < 40 && !ok(); i++) await act(async () => { await new Promise((r) => setTimeout(r, 5)); });
}
async function render() {
  await act(async () => {
    root.render(<Assignments />);
  });
  await flush();
}

const text = () => host.textContent ?? '';
const buttons = () => [...host.querySelectorAll('button')];
const must = (label: string) => {
  const b = buttons().find((x) => x.textContent?.trim() === label);
  if (!b) throw new Error(`No button “${label}”; have: ${buttons().map((x) => JSON.stringify(x.textContent?.trim())).join(', ')}`);
  return b as HTMLButtonElement;
};
const has = (label: string) => buttons().some((x) => x.textContent?.trim() === label);
async function press(label: string) {
  await act(async () => must(label).click());
  await flush();
}
function field(label: string): HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement {
  const l = [...host.querySelectorAll('label')].find((x) => x.textContent?.trim().startsWith(label));
  if (!l) throw new Error(`No field “${label}”; have: ${[...host.querySelectorAll('label')].map((x) => x.textContent).join(' | ')}`);
  return host.querySelector(`#${CSS.escape((l as HTMLLabelElement).htmlFor)}`) as HTMLInputElement;
}
function type(el: Element, value: string) {
  const proto = el instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : el instanceof HTMLSelectElement ? HTMLSelectElement.prototype : HTMLInputElement.prototype;
  act(() => {
    Object.getOwnPropertyDescriptor(proto, 'value')?.set?.call(el, value);
    el.dispatchEvent(new Event(el instanceof HTMLSelectElement ? 'change' : 'input', { bubbles: true }));
  });
}
/** A `datetime-local` value, in the viewer's own zone, for `hours` from now. */
const localIn = (hours: number): string => {
  const d = new Date(Date.now() + hours * HOUR);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
};

// ── The mode ────────────────────────────────────────────────────────────

describe('when the school has not switched assignments to Core', () => {
  it('says so in one sentence and reads no course', async () => {
    mock.modes = [{ module: 'lms_assignments', mode: 'connect', frozen: false, killed: false }];
    await render();
    expect(text()).toContain('has not switched assignments to Semester Core');
    expect(mock.caps).not.toHaveBeenCalled();
    expect(mock.load).not.toHaveBeenCalled();
    await press('Open your courses');
    expect(mock.dispatch).toHaveBeenCalledWith({ type: 'go', screen: 'courses' });
  });

  it('reads a school with no row at all as Connect', async () => {
    mock.modes = [];
    await render();
    expect(text()).toContain('has not switched assignments');
    expect(mock.load).not.toHaveBeenCalled();
  });

  it('reads a failed mode read as Connect and says it could not read, never as Core', async () => {
    mock.modes = 'error';
    await render();
    expect(text()).toContain('could not read how your school runs assignments');
    expect(mock.load).not.toHaveBeenCalled();
    expect(has('Submit')).toBe(false);
  });

  it('says so with no account service', async () => {
    mock.configured = false;
    await render();
    expect(text()).toContain('need an account');
    expect(mock.caps).not.toHaveBeenCalled();
  });

  it('asks a signed-out person to sign in, and one with no school to claim one', async () => {
    mock.user = null;
    await render();
    expect(text()).toContain('Sign in with your school account');
    act(() => root.unmount());
    mock.user = 'ana-0001-aaaa';
    mock.school = null;
    root = createRoot(host);
    await render();
    expect(text()).toContain('has no school yet');
  });

  it('shows what was submitted but offers no way to change it when the module is frozen', async () => {
    mock.modes = [{ module: 'lms_assignments', mode: 'connect', frozen: true, killed: false }];
    mock.load.mockResolvedValue(LOADED({ versions: [version()] as Loaded['versions'], receipts: [receipt()] as Loaded['receipts'] }));
    await render();
    expect(text()).toContain('taken assignments back out of Semester Core');
    expect(text()).toContain('Problem set 1');
    await press('Open Problem set 1');
    expect(text()).toContain('Version 1');
    expect(text()).toContain('cannot be changed here');
    expect(host.querySelector('textarea')).toBeNull();
  });

  it('says Core is paused, and offers no writes, while a kill switch is engaged on a school that was in Core', async () => {
    mock.modes = [{ module: 'lms_assignments', mode: 'connect', frozen: true, killed: true }];
    await render();
    expect(text()).toContain('paused its Core modules');
    await press('Open Problem set 1');
    expect(host.querySelector('textarea')).toBeNull();
  });
});

// ── Who sees which half ─────────────────────────────────────────────────

describe('who may see it', () => {
  it('tells somebody with no course role why there is nothing', async () => {
    mock.caps.mockResolvedValue([grant('assignments:author', 'other/ECON 1020/2026FA'), grant('grades:receive', 'vu/ECON 1020')]);
    await render();
    expect(text()).toContain('not an instructor or a student on any course');
    expect(mock.load).not.toHaveBeenCalled();
  });

  it('gives an instructor the instructor view and a student only their own', async () => {
    mock.caps.mockResolvedValue(PROF);
    mock.user = 'prof-1';
    await render();
    expect(has('New assignment')).toBe(true);
    expect(has('Open Problem set 1 to submit')).toBe(false);
    act(() => root.unmount());
    mock.caps.mockResolvedValue(STUDENT);
    mock.user = 'ana-0001-aaaa';
    root = createRoot(host);
    await render();
    expect(has('New assignment')).toBe(false);
    expect(has('Open Problem set 1 to submit')).toBe(true);
  });

  it('gives somebody who teaches one course and takes another both, with tabs', async () => {
    mock.caps.mockResolvedValue([...PROF, grant('grades:receive', 'vu/HIST 2100/2026FA')]);
    await render();
    expect(host.querySelector('[role="tablist"]')).not.toBeNull();
    expect(text()).toContain('Courses you teach');
    expect(text()).toContain('Your assignments');
  });

  it('offers a term only where a grant exists for it', async () => {
    mock.caps.mockResolvedValue([...STUDENT, grant('grades:receive', 'vu/ECON 1020/2025FA')]);
    await render();
    const options = [...host.querySelectorAll('select option')].map((o) => o.textContent);
    expect(options).toEqual(['ECON 1020 · 2026FA', 'ECON 1020 · 2025FA']);
  });
});

// ── A student's side ────────────────────────────────────────────────────

describe('a student', () => {
  it('reads a course with nothing published as an empty state, not a blank', async () => {
    mock.load.mockResolvedValue(LOADED({ assignments: [] }));
    await render();
    expect(text()).toContain('No assignments yet');
    expect(text()).toContain('appear here once they do');
  });

  it('says what the read failed with, changes nothing, and offers to load again', async () => {
    mock.load.mockRejectedValueOnce(new ServiceError('That is not allowed.', true));
    await render();
    expect(text()).toContain('That is not allowed.');
    expect(text()).toContain('Nothing has changed');
    await press('Load again');
    expect(text()).toContain('Problem set 1');
  });

  it('lists each assignment with when it is due and where they stand', async () => {
    mock.load.mockResolvedValue(LOADED({
      assignments: [assignment(), assignment({ id: 'a2', title: 'Essay', dueAt: iso(-5), closesAt: iso(40) })] as Loaded['assignments'],
    }));
    await render();
    expect(text()).toContain('Problem set 1');
    expect(text()).toContain('Not submitted.');
    expect(text()).toContain('Past its due time and not submitted');
  });

  it('shows an extension as theirs, and only theirs', async () => {
    mock.load.mockResolvedValue(LOADED({
      extensions: [
        { id: 'e1', assignmentId: 'a1', studentId: 'ana-0001-aaaa', dueAt: iso(100), closesAt: null, reason: 'Hospital', at: iso(-2) },
        { id: 'e2', assignmentId: 'a1', studentId: 'ben-0002-bbbb', dueAt: iso(120), closesAt: null, reason: 'Other', at: iso(-2) },
      ] as Loaded['extensions'],
    }));
    await render();
    expect(text()).toContain('(extended for you)');
    expect(text()).not.toContain('Other');
  });

  it('never shows another student’s submission, even if the read returned one', async () => {
    mock.load.mockResolvedValue(LOADED({
      versions: [version(), version({ id: 'v9', studentId: 'ben-0002-bbbb', body: 'Ben’s secret answer' })] as Loaded['versions'],
      receipts: [receipt(), receipt({ id: 'r9', versionId: 'v9', studentId: 'ben-0002-bbbb', code: 'SR-BBBBBBBBBBBB' })] as Loaded['receipts'],
    }));
    await render();
    await press('Open Problem set 1');
    expect(text()).toContain('Answer one.');
    expect(text()).not.toContain('secret');
    expect(text()).not.toContain('SR-BBBBBBBBBBBB');
  });

  it('opens one, shows its instructions and the limits, and submits only what was typed', async () => {
    await render();
    await press('Open Problem set 1 to submit');
    expect(text()).toContain('Do the first five.');
    expect(text()).toContain('up to 3 versions');
    expect(must('Submit').disabled).toBe(true);
    type(field('Your work'), 'My answer.');
    expect(must('Submit').disabled).toBe(false);
    await press('Submit');
    expect(mock.submit).toHaveBeenCalledTimes(1);
    expect(mock.submit.mock.calls[0].slice(0, 2)).toEqual(['a1', 'My answer.']);
    expect(mock.submit.mock.calls[0][2]).toMatch(/^submit:a1:/);
    expect(mock.say).toHaveBeenCalledWith(expect.stringContaining('SR-AAAAAAAAAAAA'));
  });

  it('keeps the same key when the reply is lost, and says it may have gone through', async () => {
    mock.submit.mockRejectedValueOnce(new ServiceError('The connection did not answer, so it is not known whether the change was made.', false));
    await render();
    await press('Open Problem set 1 to submit');
    type(field('Your work'), 'My answer.');
    await press('Submit');
    expect(text()).toContain('may have gone through');
    expect(text()).toContain('same receipt, not a second submission');
    await press('Try again');
    expect(mock.submit).toHaveBeenCalledTimes(2);
    expect(mock.submit.mock.calls[1][2]).toBe(mock.submit.mock.calls[0][2]);
  });

  it('says the server’s sentence on a refusal and starts a new attempt after it', async () => {
    mock.submit.mockRejectedValueOnce(new ServiceError('This assignment stopped accepting work at its closing time.', true));
    await render();
    await press('Open Problem set 1 to submit');
    type(field('Your work'), 'My answer.');
    await press('Submit');
    expect(text()).toContain('stopped accepting work at its closing time');
    expect(text()).not.toContain('Try again');
    await press('Submit');
    expect(mock.submit.mock.calls[1][2]).not.toBe(mock.submit.mock.calls[0][2]);
  });

  it('refuses before sending a copy of the last version, and says so', async () => {
    mock.load.mockResolvedValue(LOADED({ versions: [version()] as Loaded['versions'], receipts: [receipt()] as Loaded['receipts'] }));
    await render();
    await press('Open Problem set 1');
    expect(must('Submit version 2').disabled).toBe(true);
    type(field('Your work'), 'Answer one.');
    expect(text()).toContain('already submitted');
    expect(must('Submit version 2').disabled).toBe(true);
    type(field('Your work'), 'Answer two.');
    expect(must('Submit version 2').disabled).toBe(false);
  });

  it('keeps what they typed on the device, brings it back, and clears it once the receipt is in', async () => {
    vi.useFakeTimers();
    try {
      await render();
      await press('Open Problem set 1 to submit');
      type(field('Your work'), 'Half an answer');
      await act(async () => { vi.advanceTimersByTime(1000); });
      expect(Object.values(JSON.parse(localStorage.getItem('semester.drafts') ?? '{}')).map((d) => (d as { text: string }).text)).toContain('Half an answer');
      act(() => root.unmount());
      root = createRoot(host);
      await render();
      await press('Open Problem set 1 to submit');
      expect((field('Your work') as HTMLTextAreaElement).value).toBe('Half an answer');
      await press('Submit');
      expect(localStorage.getItem('semester.drafts') ?? '{}').not.toContain('Half an answer');
    } finally {
      vi.useRealTimers();
    }
  });

  it('marks a late version and offers no box when the closing time has passed or it is closed', async () => {
    mock.load.mockResolvedValue(LOADED({
      assignments: [assignment({ dueAt: iso(-10), closesAt: iso(-1) })] as Loaded['assignments'],
      versions: [version({ late: true })] as Loaded['versions'], receipts: [receipt({ late: true })] as Loaded['receipts'],
    }));
    await render();
    await press('Open Problem set 1');
    expect(text()).toContain('late');
    expect(text()).toContain('stopped accepting work');
    expect(host.querySelector('textarea')).toBeNull();
    act(() => root.unmount());
    root = createRoot(host);
    mock.load.mockResolvedValue(LOADED({ assignments: [assignment({ status: 'closed' })] as Loaded['assignments'] }));
    await render();
    await press('Open Problem set 1');
    expect(text()).toContain('This assignment is closed.');
    expect(host.querySelector('textarea')).toBeNull();
  });

  it('checks a receipt against the text it covers, and catches a text that no longer matches', async () => {
    const sha = await sha256Hex('Answer one.');
    mock.load.mockResolvedValue(LOADED({
      versions: [version({ contentSha256: sha })] as Loaded['versions'],
      receipts: [receipt({ contentSha256: sha })] as Loaded['receipts'],
    }));
    await render();
    await press('Open Problem set 1');
    await press('Check the receipt against your text');
    await until(() => text().includes('matches this text exactly'));
    expect(text()).toContain('matches this text exactly');
    await press('Show the receipt for version 1');
    expect(text()).toContain('Semester submission receipt');
    expect(text()).toContain('not a grade');
    // The control: a version whose text was changed after the fact does not match.
    act(() => root.unmount());
    root = createRoot(host);
    mock.load.mockResolvedValue(LOADED({
      versions: [version({ body: 'Answer one, edited.', contentSha256: sha })] as Loaded['versions'],
      receipts: [receipt({ contentSha256: sha })] as Loaded['receipts'],
    }));
    await render();
    await press('Open Problem set 1');
    await press('Check the receipt against your text');
    await until(() => text().includes('does not match this text'));
    expect(text()).toContain('does not match this text');
  });
});

// ── An instructor's side ────────────────────────────────────────────────

describe('an instructor', () => {
  beforeEach(() => {
    mock.user = 'prof-1';
    mock.caps.mockResolvedValue(PROF);
  });

  it('reads an empty course as an invitation to write the first assignment', async () => {
    mock.load.mockResolvedValue(LOADED({ assignments: [] }));
    await render();
    expect(text()).toContain('No assignments yet');
    expect(text()).toContain('It stays a draft until you publish it');
  });

  it('refuses a draft with no title or due time before sending it, and sends a sound one with its key', async () => {
    await render();
    await press('New assignment');
    expect(must('Save the draft').disabled).toBe(true);
    type(field('Title'), 'Problem set 2');
    expect(must('Save the draft').disabled).toBe(true);
    type(field('Due'), localIn(72));
    expect(must('Save the draft').disabled).toBe(false);
    type(field('Stops taking work'), localIn(60));
    expect(text()).toContain('cannot close before it is due');
    expect(must('Save the draft').disabled).toBe(true);
    type(field('Stops taking work'), localIn(96));
    await press('Save the draft');
    expect(mock.create).toHaveBeenCalledTimes(1);
    const [course, term, draft, key] = mock.create.mock.calls[0];
    expect([course, term]).toEqual(['ECON 1020', '2026FA']);
    expect(draft).toMatchObject({ title: 'Problem set 2', allowResubmission: true, maxVersions: 5 });
    expect(new Date(draft.dueAt).getTime()).toBeGreaterThan(Date.now());
    expect(key).toMatch(/^create:/);
    expect(mock.say).toHaveBeenCalledWith(expect.stringContaining('Students cannot see it until you publish it'));
  });

  it('turns resubmission off to one version', async () => {
    await render();
    await press('New assignment');
    type(field('Title'), 'Quiz');
    type(field('Due'), localIn(24));
    await act(async () => { (field('Resubmission') as HTMLInputElement).click(); });
    expect(host.textContent).not.toContain('Most versions');
    await press('Save the draft');
    expect(mock.create.mock.calls[0][2]).toMatchObject({ allowResubmission: false, maxVersions: 1 });
  });

  it('shows the server’s sentence when a write is refused, and keeps the key when the reply is lost', async () => {
    mock.create.mockRejectedValueOnce(new ServiceError('Your school has not switched assignments to Semester Core.', true));
    await render();
    await press('New assignment');
    type(field('Title'), 'Problem set 2');
    type(field('Due'), localIn(72));
    await press('Save the draft');
    expect(text()).toContain('has not switched assignments to Semester Core');
    mock.create.mockRejectedValueOnce(new ServiceError('The connection did not answer, so it is not known whether the change was made.', false));
    await press('Save the draft');
    await press('Try again');
    expect(mock.create.mock.calls[2][3]).toBe(mock.create.mock.calls[1][3]);
  });

  it('publishes a draft, and is told why it cannot when the due time has passed', async () => {
    mock.load.mockResolvedValue(LOADED({ assignments: [assignment({ id: 'd1', title: 'Draft one', status: 'draft' }), assignment({ id: 'd2', title: 'Overdue', status: 'draft', dueAt: iso(-3), closesAt: null })] as Loaded['assignments'] }));
    await render();
    expect(must('Publish Overdue').disabled).toBe(true);
    expect(text()).toContain('The due time has passed. Revise it before publishing.');
    await press('Publish Draft one');
    expect(mock.publish.mock.calls[0].slice(0, 1)).toEqual(['d1']);
    expect(mock.say).toHaveBeenCalledWith('Draft one is published. Students can see it now.');
  });

  it('revises a draft but offers no revision of a published assignment', async () => {
    mock.load.mockResolvedValue(LOADED({ assignments: [assignment({ id: 'd1', title: 'Draft one', status: 'draft' }), assignment({ id: 'p1', title: 'Live one' })] as Loaded['assignments'] }));
    await render();
    expect(has('Revise Draft one')).toBe(true);
    expect(has('Revise Live one')).toBe(false);
    await press('Revise Draft one');
    expect((field('Title') as HTMLInputElement).value).toBe('Draft one');
    await press('Save the changes');
    expect(mock.revise.mock.calls[0][0]).toBe('d1');
  });

  it('closes a published assignment and extends one student with a reason', async () => {
    mock.load.mockResolvedValue(LOADED({ versions: [version({ studentId: 'ana-0001-aaaa' })] as Loaded['versions'] }));
    await render();
    await press('Extend Problem set 1 for a student');
    expect(must('Grant the extension').disabled).toBe(true);
    type(field('New due time'), localIn(120));
    expect(must('Grant the extension').disabled).toBe(true);
    type(field('Reason'), 'Hospital, note on file');
    expect(must('Grant the extension').disabled).toBe(false);
    await press('Grant the extension');
    expect(mock.extend).toHaveBeenCalledTimes(1);
    expect(mock.extend.mock.calls[0].slice(0, 2)).toEqual(['a1', 'ana-0001-aaaa']);
    expect(mock.extend.mock.calls[0][4]).toBe('Hospital, note on file');
    await press('Close Problem set 1');
    expect(mock.close.mock.calls[0].slice(0, 1)).toEqual(['a1']);
  });

  it('refuses an extension that is not later than what already applies', async () => {
    mock.load.mockResolvedValue(LOADED({ versions: [version()] as Loaded['versions'] }));
    await render();
    await press('Extend Problem set 1 for a student');
    type(field('New due time'), localIn(1));
    type(field('Reason'), 'r');
    expect(text()).toContain('must be later than the time that already applies');
    expect(must('Grant the extension').disabled).toBe(true);
  });

  it('reads every submission: the student, how many versions, when, late or not, the receipt and the text', async () => {
    mock.load.mockResolvedValue(LOADED({
      versions: [version(), version({ id: 'v2', version: 2, body: 'Answer two.', late: true })] as Loaded['versions'],
      receipts: [receipt(), receipt({ id: 'r2', versionId: 'v2', code: 'SR-FFFFFFFFFFFF', late: true })] as Loaded['receipts'],
    }));
    await render();
    await press('Read submissions to Problem set 1');
    expect(text()).toContain('ana-0001');
    expect(text()).toContain('SR-FFFFFFFFFFFF');
    expect(text()).toContain('late');
    expect(text()).toContain('Answer two.');
    expect(text()).toContain('1 student has submitted; 1 late.');
  });

  it('shows what has happened to an assignment, from its events', async () => {
    mock.load.mockResolvedValue(LOADED({ events: [
      { id: 'n1', assignmentId: 'a1', action: 'created', actor: 'prof-1', at: iso(-24) },
      { id: 'n2', assignmentId: 'a1', action: 'published', actor: 'prof-1', at: iso(-23) },
    ] as Loaded['events'] }));
    await render();
    expect(text()).toContain('What has happened to Problem set 1');
    expect(text()).toContain('Published');
  });
});

describe('a teaching assistant', () => {
  it('reads every submission and is offered no way to write, publish, close or extend', async () => {
    mock.user = 'ta-1';
    mock.caps.mockResolvedValue(TA);
    mock.load.mockResolvedValue(LOADED({
      assignments: [assignment(), assignment({ id: 'd1', title: 'Draft one', status: 'draft' })] as Loaded['assignments'],
      versions: [version()] as Loaded['versions'],
    }));
    await render();
    expect(text()).toContain('Only an instructor can write or publish');
    for (const b of ['New assignment', 'Revise Draft one', 'Publish Draft one', 'Close Problem set 1', 'Extend Problem set 1 for a student']) expect(has(b), b).toBe(false);
    await press('Read submissions to Problem set 1');
    expect(text()).toContain('Answer one.');
  });
});
