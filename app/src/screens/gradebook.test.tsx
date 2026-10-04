// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ServiceError } from '../lib/attempt';
import type { LoadedBook } from '../lib/gradebook/client';

/**
 * The Gradebook, driven against a replaced account service.
 *
 * The gate is the real one over a fake database; the gradebook client's
 * reads and writes are replaced. Under test: that it stops at the gate
 * without reading, that who sees which half comes from course-scope grants,
 * that a draft reads as a draft, that a write's key survives a retry after a
 * lost reply, that a refusal is the server's sentence, and that a student
 * sees their own released grades and can ask for a regrade.
 */

const mock = vi.hoisted(() => ({
  configured: true,
  user: 'prof-1' as string | null,
  school: 'vu' as string | null,
  flag: 'production' as string,
  caps: vi.fn(),
  book: vi.fn(),
  setScheme: vi.fn(),
  addItem: vi.fn(),
  enter: vi.fn(),
  moderate: vi.fn(),
  release: vi.fn(),
  resolve: vi.fn(),
  exportRows: vi.fn(),
  passback: vi.fn(),
  regrade: vi.fn(),
  download: vi.fn(),
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
    rpc: async (name: string) => ({ data: name === 'feature_state' ? mock.flag : name === 'feature_narrowing' ? [] : null, error: null }),
    from: (name: string) => table(name),
  }),
}));
vi.mock('../state/store', () => ({
  useStore: () => ({ dispatch: mock.dispatch, say: mock.say, account: mock.user ? { id: mock.user } : null, state: {} }),
  useNow: () => new Date(),
}));
vi.mock('../lib/capabilities', async (orig) => ({ ...(await orig<object>()), loadMyCapabilities: mock.caps }));
vi.mock('../lib/deliver', () => ({ download: mock.download }));
vi.mock('../lib/gradebook/client', async (orig) => ({
  ...(await orig<object>()),
  loadBook: mock.book,
  setScheme: mock.setScheme,
  addItem: mock.addItem,
  enterScore: mock.enter,
  moderate: mock.moderate,
  release: mock.release,
  resolveRegrade: mock.resolve,
  exportRows: mock.exportRows,
  queuePassback: mock.passback,
  fileRegrade: mock.regrade,
}));

import { Gradebook } from './Gradebook';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let host: HTMLDivElement;
let root: Root;

const grant = (capability: string, scopeId: string) => ({ capability, scopeKind: 'course', scopeId });
// Gradebook grants are held per course and term: `<school>/<CODE>/<TERM>`.
const FA = 'vu/ECON 1020/2026FA';
const PROF = [grant('grades:enter', FA), grant('grades:moderate', FA), grant('grades:release', FA), grant('grades:export', FA)];
const STUDENT = [grant('grades:receive', FA)];

const entry = (patch: Record<string, unknown>) => ({
  id: 'g',
  itemId: 'mid',
  studentId: 'ana-0001-aaaa',
  version: 1,
  score: 88,
  mark: null,
  comment: '',
  status: 'draft',
  action: 'entered',
  gradedBy: 'ta-9',
  actor: 'ta-9',
  reason: '',
  regradeId: null,
  operation: 'k',
  at: '2026-10-01T15:00:00Z',
  ...patch,
});

const BOOK = (patch: Partial<LoadedBook> = {}): LoadedBook => ({
  course: 'ECON 1020',
  term: '2026FA',
  scheme: {
    categories: [
      { key: 'problem-sets', name: 'Problem sets', weight: 40, dropLowest: 1 },
      { key: 'exams', name: 'Exams', weight: 60, dropLowest: 0 },
    ],
    letters: [{ letter: 'A', min: 90 }, { letter: 'B', min: 80 }, { letter: 'F', min: 0 }],
    moderationRequired: false,
  },
  schemeVersion: 1,
  items: [
    { id: 'mid', categoryKey: 'exams', title: 'Midterm', pointsPossible: 100, lineItem: 'lti:mid' },
    { id: 'ps1', categoryKey: 'problem-sets', title: 'Problem set 1', pointsPossible: 10, lineItem: null },
  ],
  entries: [
    entry({ id: 'g1' }),
    entry({ id: 'g2', studentId: 'ben-0002-bbbb', version: 1, score: 70, status: 'draft' }),
    entry({ id: 'g3', studentId: 'ben-0002-bbbb', version: 2, score: 70, status: 'released', action: 'released' }),
    entry({ id: 'g4', studentId: 'ben-0002-bbbb', version: 3, score: 75, status: 'draft', action: 'changed', reason: 'Q2' }),
  ] as LoadedBook['entries'],
  regrades: [{ id: 'r1', itemId: 'mid', studentId: 'ben-0002-bbbb', contestedEntry: 'g3', reason: 'Question 2 was marked wrong', at: 't' }],
  resolutions: [],
  ...patch,
});

beforeEach(() => {
  vi.resetAllMocks();
  mock.configured = true;
  mock.user = 'prof-1';
  mock.school = 'vu';
  mock.flag = 'production';
  mock.caps.mockResolvedValue(PROF);
  mock.book.mockResolvedValue(BOOK());
  mock.enter.mockResolvedValue(2);
  mock.release.mockResolvedValue({ released: 2, held: 0 });
  mock.moderate.mockResolvedValue(2);
  mock.passback.mockResolvedValue({ queued: 0, reason: 'flag-off', said: 'Your school has not turned on grade passback. Nothing was queued.' });
  mock.exportRows.mockResolvedValue([{ studentId: 'ben', itemId: 'mid', categoryKey: 'exams', title: 'Midterm', pointsPossible: 100, score: 70, mark: null, releasedAt: 't' }]);
  mock.regrade.mockResolvedValue('req-2');
  host = document.createElement('div');
  document.body.append(host);
  root = createRoot(host);
});

afterEach(() => {
  act(() => root.unmount());
  host.remove();
});

async function flush() {
  for (let i = 0; i < 4; i++) await act(async () => {});
}

async function render() {
  await act(async () => {
    root.render(<Gradebook />);
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
async function press(label: string) {
  await act(async () => must(label).click());
  await flush();
}
function type(el: Element | null | undefined, value: string) {
  if (!el) throw new Error('No control to type into');
  const proto = el instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : el instanceof HTMLSelectElement ? HTMLSelectElement.prototype : HTMLInputElement.prototype;
  act(() => {
    Object.getOwnPropertyDescriptor(proto, 'value')?.set?.call(el, value);
    el.dispatchEvent(new Event(el instanceof HTMLSelectElement ? 'change' : 'input', { bubbles: true }));
  });
}
const byLabel = (label: string) => host.querySelector(`[aria-label="${label}"]`);

describe('when the school has not turned it on', () => {
  it('says so in one sentence and reads nothing', async () => {
    mock.flag = 'off';
    await render();
    expect(text()).toContain('Your school has not turned on the gradebook in Semester');
    expect(mock.caps).not.toHaveBeenCalled();
    expect(mock.book).not.toHaveBeenCalled();
    await press('Work out your own grades');
    expect(mock.dispatch).toHaveBeenCalledWith({ type: 'setCoursesTab', tab: 'grades' });
  });

  it('says the same with no account service', async () => {
    mock.configured = false;
    await render();
    expect(text()).toContain('has not turned on the gradebook');
  });
});

describe('who may see it', () => {
  it('tells somebody with no course role why there is nothing, who assigns one, and where their own arithmetic is', async () => {
    mock.caps.mockResolvedValue([grant('grades:enter', 'other/ECON 1020/2026FA'), grant('grades:export', 'vu/HIST 1100/2026FA')]);
    await render();
    expect(text()).toContain('not an instructor or a student on any course in your school’s gradebook');
    expect(mock.book).not.toHaveBeenCalled();
    await press('Work out your own grades');
    expect(mock.dispatch).toHaveBeenCalledWith({ type: 'setCoursesTab', tab: 'grades' });
    expect(mock.dispatch).toHaveBeenCalledWith({ type: 'go', screen: 'courses' });
  });

  it('offers nothing on a grant with no term: it authorises nothing in the database either', async () => {
    mock.caps.mockResolvedValue([grant('grades:enter', 'vu/ECON 1020'), grant('grades:release', 'vu/ECON 1020'), grant('grades:receive', 'vu/ECON 1020')]);
    await render();
    expect(text()).toContain('not an instructor or a student on any course in your school’s gradebook');
    expect(mock.book).not.toHaveBeenCalled();
  });

  it('asks a signed-out person to sign in', async () => {
    mock.user = null;
    await render();
    expect(text()).toContain('Sign in with your school account to use the gradebook');
  });
});

describe('an instructor’s course', () => {
  it('shows the scheme, the item, and every version as the student would see it', async () => {
    await render();
    expect(mock.book).toHaveBeenCalledWith('ECON 1020', '2026FA');
    expect(text()).toContain('Problem sets 40% (lowest 1 dropped) · Exams 60%.');
    const table = host.querySelector('table');
    expect(table?.querySelector('caption')?.textContent).toContain('Scores for Midterm, out of 100');
    expect([...table!.querySelectorAll('thead th')].every((th) => th.getAttribute('scope') === 'col')).toBe(true);
    expect([...table!.querySelectorAll('tbody th')].map((th) => th.getAttribute('scope'))).toEqual(['row', 'row']);
    expect(text()).toContain('Draft — the student cannot see this');
    // Ben's released 70 stays what he sees while the change to 75 is a draft.
    expect(text()).toContain('The student still sees 70.');
    // One primary: releasing the item.
    expect(buttons().filter((b) => b.classList.contains('btn-primary')).map((b) => b.textContent)).toEqual(['Release grades for Midterm']);
    expect(text()).toContain('Question 2 was marked wrong');
  });

  it('asks for a reason before changing a released grade', async () => {
    await render();
    expect(byLabel('Reason for changing a released grade for student ben-0002…')).not.toBeNull();
    expect(byLabel('Reason for changing a released grade for student ana-0001…')).toBeNull();
    expect(must('Save draft for ben-0002…').disabled).toBe(true);
  });

  it('keeps a score’s key across a retry after a lost reply, and makes a new one for a new score', async () => {
    mock.enter
      .mockRejectedValueOnce(new ServiceError('The score was not saved. The connection to your school’s service did not answer, so it is not known whether the change was made.', false))
      .mockResolvedValueOnce(2)
      .mockResolvedValueOnce(3);
    await render();
    type(byLabel('Score for student ana-0001…'), '91');
    type(byLabel('Mark for student ana-0001…'), 'late');
    await press('Save draft for ana-0001…');
    expect(host.querySelector('[role="alert"]')?.textContent).toMatch(/not known whether the change was made/);
    expect(mock.enter.mock.calls[0][0]).toEqual({ itemId: 'mid', studentId: 'ana-0001-aaaa', score: 91, mark: 'late', comment: '', reason: '' });
    await press('Try again');
    expect(mock.enter).toHaveBeenCalledTimes(2);
    expect(mock.enter.mock.calls[1][1]).toBe(mock.enter.mock.calls[0][1]);
    expect(text()).toContain('Saved as a draft of Midterm for student ana-0001… (version 2). The student cannot see it until it is released.');

    type(byLabel('Score for student ana-0001…'), '93');
    await press('Save draft for ana-0001…');
    expect(mock.enter.mock.calls[2][1]).not.toBe(mock.enter.mock.calls[0][1]);
  });

  it('shows a refusal in the server’s own words, and drops the key', async () => {
    mock.enter.mockRejectedValueOnce(new ServiceError('That student is not enrolled in this course.', true)).mockResolvedValueOnce(2);
    await render();
    type(byLabel('Score for student ana-0001…'), '91');
    await press('Save draft for ana-0001…');
    expect(host.querySelector('[role="alert"]')?.textContent).toBe('That student is not enrolled in this course.');
    expect(buttons().some((b) => b.textContent === 'Try again')).toBe(false);
    await press('Save draft for ana-0001…');
    expect(mock.enter.mock.calls[1][1]).not.toBe(mock.enter.mock.calls[0][1]);
  });

  it('moderates only another grader’s draft, releases, queues passback and exports released grades', async () => {
    await render();
    // Both drafts were graded by the TA, so the professor may moderate them.
    await press('Moderate ana-0001…');
    expect(mock.moderate).toHaveBeenCalledWith('mid', 'ana-0001-aaaa', expect.any(String));
    await press('Release grades for Midterm');
    expect(mock.release).toHaveBeenCalledWith('mid', expect.any(String));
    expect(mock.say).toHaveBeenCalledWith('2 grades for Midterm released to students.');
    await press('Send Midterm to your learning system');
    expect(text()).toContain('Your school has not turned on grade passback. Nothing was queued.');
    await press('Download released grades (CSV)');
    expect(mock.exportRows).toHaveBeenCalled();
    const piece = mock.download.mock.calls[0][0] as { name: string; body: string; mime: string };
    expect(piece.name).toMatch(/^ECON-1020-[0-9]{4}(FA|SP|SU)-released-grades\.csv$/);
    expect(piece.mime).toBe('text/csv');
    expect(piece.body.split('\r\n')[1]).toContain('ben,mid,exams,Midterm,100,70');
  });

  it('does not offer to moderate the professor’s own grade', async () => {
    mock.book.mockResolvedValue(BOOK({ entries: [entry({ gradedBy: 'prof-1' })] as LoadedBook['entries'] }));
    await render();
    expect(buttons().some((b) => b.textContent?.startsWith('Moderate'))).toBe(false);
  });

  it('starts from the scheme when there is none', async () => {
    mock.book.mockResolvedValue(BOOK({ scheme: null, schemeVersion: 0, items: [], entries: [], regrades: [] }));
    await render();
    expect(text()).toContain('No grading scheme yet');
    expect(text()).toContain('No items yet');
    expect(must('Save the scheme').disabled).toBe(false);
  });

  it('says what failed when the course cannot be read, and loads again', async () => {
    mock.book.mockRejectedValueOnce(new ServiceError('Could not load this gradebook.', true));
    await render();
    expect(host.querySelector('[role="alert"]')?.textContent).toMatch(/^Could not load this gradebook\. Nothing has changed\./);
    await press('Load again');
    expect(text()).toContain('Scores for Midterm');
  });
});

describe('choosing a course and term', () => {
  it('offers exactly the course-terms the grants name, and reads the one chosen with only its own capabilities', async () => {
    // Full authority in 2026FA; only grades:enter in 2027SP.
    mock.caps.mockResolvedValue([...PROF, grant('grades:enter', 'vu/ECON 1020/2027SP')]);
    await render();
    const select = host.querySelector('select') as HTMLSelectElement;
    expect([...select.options].map((o) => o.textContent)).toEqual(['ECON 1020 · 2027SP', 'ECON 1020 · 2026FA']);
    expect(host.querySelector('input[pattern]')).toBeNull();
    mock.book.mockClear();
    type(select, 'ECON 1020/2027SP');
    await flush();
    expect(mock.book).toHaveBeenCalledWith('ECON 1020', '2027SP');
    // 2027SP's grant carries no grades:release, so nothing is offered for release there.
    expect(buttons().some((b) => b.textContent === 'Release grades for Midterm')).toBe(false);
    type(host.querySelector('select'), 'ECON 1020/2026FA');
    await flush();
    expect(mock.book).toHaveBeenLastCalledWith('ECON 1020', '2026FA');
    expect(buttons().some((b) => b.textContent === 'Release grades for Midterm')).toBe(true);
  });
});

describe('a student’s course', () => {
  beforeEach(() => {
    mock.user = 'ben-0002-bbbb';
    mock.caps.mockResolvedValue(STUDENT);
    // What row-level security would return to Ben: his released row only.
    mock.book.mockResolvedValue(BOOK({ entries: [entry({ id: 'g3', studentId: 'ben-0002-bbbb', version: 2, score: 70, status: 'released', action: 'released' })] as LoadedBook['entries'], regrades: [] }));
  });

  it('shows their released grades, the total labelled as an estimate, and a way to their own arithmetic', async () => {
    await render();
    expect(text()).toContain('Released grades');
    expect(text()).toContain('70 of 100');
    expect(host.querySelector('[data-source="estimated"]')).not.toBeNull();
    expect(host.querySelector('[data-source="institution_verified"]')).not.toBeNull();
    expect(text()).toContain('your instructor’s final grade is the one that counts');
    expect(buttons().some((b) => b.textContent === 'Release grades for Midterm')).toBe(false);
    await press('Work out what you need on the final');
    expect(mock.dispatch).toHaveBeenCalledWith({ type: 'go', screen: 'courses' });
  });

  it('draws the released grades as one captioned table of item, grade, released and regrade', async () => {
    await render();
    const table = host.querySelector('table')!;
    expect(table.querySelector('caption')?.textContent).toMatch(/^Your released grades in /);
    expect([...table.querySelectorAll('thead th')].map((th) => [th.textContent, th.getAttribute('scope')])).toEqual([
      ['Item', 'col'],
      ['Grade', 'col'],
      ['Released', 'col'],
      ['Regrade', 'col'],
    ]);
    const row = table.querySelector('tbody tr')!;
    expect(row.querySelector('th')?.textContent).toBe('Midterm');
    expect(row.querySelector('th')?.getAttribute('scope')).toBe('row');
    const cells = [...row.querySelectorAll('td')];
    expect(cells).toHaveLength(3);
    expect(cells[0].textContent).toContain('70 of 100');
    expect(cells[2].querySelector('button')?.textContent).toBe('Ask about Midterm');
    expect(table.querySelectorAll('tbody tr')).toHaveLength(1);
  });

  it('files a regrade request with a reason', async () => {
    await render();
    await press('Ask about Midterm');
    expect(document.activeElement?.textContent).toBe('Ask for Midterm to be looked at again');
    expect(must('Send the regrade request').disabled).toBe(true);
    type(host.querySelector('textarea'), 'Question 2 was marked wrong');
    await press('Send the regrade request');
    expect(mock.regrade).toHaveBeenCalledWith('mid', 'Question 2 was marked wrong', expect.stringMatching(/^regrade:mid:/));
    expect(mock.say).toHaveBeenCalledWith(expect.stringMatching(/^Your regrade request for Midterm is sent/));
  });

  it('says so when nothing is released yet', async () => {
    mock.book.mockResolvedValue(BOOK({ entries: [], regrades: [] }));
    await render();
    expect(text()).toContain('No grades released yet');
  });
});
