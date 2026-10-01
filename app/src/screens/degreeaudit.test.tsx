// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ServiceError } from '../lib/attempt';
import { forgetModuleModes } from '../lib/modulemode';
import { todayIso } from '../lib/degreeaudit/views';
import type { AuditResult } from '../lib/degreeaudit/audit';
import type { AuditRecord, Program } from '../lib/degreeaudit/model';
import fixtures from '../lib/degreeaudit/fixtures.json';

/**
 * The degree audit screen, driven against a replaced account service.
 *
 * The mode read is the real one over a fake database; the degree audit
 * client's reads and its one write are replaced. Under test: that the screen
 * stops at the mode without reading a program when the school has not switched
 * the module to Core; that a school with no published program is told so and
 * shown no requirements; that a student audits only the record linked to their
 * account and is never offered another reference; that staff type one and a
 * malformed one is refused with the field-error component before the database
 * is asked; that the date cannot be later than today; that one attempt carries
 * one key across a lost reply and a new key after an answer; that a refusal is
 * the server's sentence; that in-progress work is shown apart from finished
 * work; and that a frozen module reads what was kept and runs nothing.
 */

const mock = vi.hoisted(() => ({
  configured: true,
  user: 'ana-0001-aaaa' as string | null,
  school: 'vu' as string | null,
  modes: [{ module: 'degree_audit', mode: 'core', frozen: false, killed: false }] as unknown[] | 'error',
  caps: vi.fn(),
  programs: vi.fn(),
  ref: vi.fn(),
  audits: vi.fn(),
  run: vi.fn(),
  dispatch: vi.fn(),
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
  useStore: () => ({ dispatch: mock.dispatch, say: vi.fn(), account: mock.user ? { id: mock.user } : null, state: {} }),
  useNow: () => new Date(),
}));
vi.mock('../lib/capabilities', async (orig) => ({ ...(await orig<object>()), loadMyCapabilitiesOrThrow: mock.caps }));
vi.mock('../lib/degreeaudit/client', async (orig) => ({
  ...(await orig<object>()),
  loadPrograms: mock.programs,
  myStudentRef: mock.ref,
  loadAudits: mock.audits,
  runAudit: mock.run,
}));

import { DegreeAudit } from './DegreeAudit';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let host: HTMLDivElement;
let root: Root;

const grant = (capability: string) => ({ capability, scopeKind: 'school', scopeId: 'vu' });
const STAFF = [grant('degree:audit')];
const PROGRAM: Program = {
  id: 'p1', code: 'ECON-BA', title: 'Economics, B.A.', catalogYear: 2026, version: 2, state: 'published', passingGrades: ['A', 'B', 'C'], publishedAt: '2026-09-01T00:00:00Z',
};
const RESULT = fixtures[2].expected.result as unknown as AuditResult;
const audit = (patch: Partial<AuditRecord> = {}): AuditRecord => ({
  id: 'a1', studentRef: 'S100', programId: 'p1', programCode: 'ECON-BA', programTitle: 'Economics, B.A.', catalogYear: 2026, programVersion: 2,
  asOf: '2026-09-01', requestedBy: 'ana-0001-aaaa', requestedAt: '2026-09-01T10:00:00Z', inputsSha256: 'ab'.repeat(32), inputsCount: 7,
  verdict: 'complete_if_in_progress_passes', result: RESULT, ...patch,
});

beforeEach(() => {
  vi.resetAllMocks();
  localStorage.clear();
  forgetModuleModes();
  mock.configured = true;
  mock.user = 'ana-0001-aaaa';
  mock.school = 'vu';
  mock.modes = [{ module: 'degree_audit', mode: 'core', frozen: false, killed: false }];
  mock.caps.mockResolvedValue([]);
  mock.programs.mockResolvedValue([PROGRAM]);
  mock.ref.mockResolvedValue('S100');
  mock.audits.mockResolvedValue([]);
  mock.run.mockResolvedValue('a1');
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
async function render() {
  await act(async () => {
    root.render(<DegreeAudit />);
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
function field(label: string): HTMLInputElement | HTMLSelectElement {
  const l = [...host.querySelectorAll('label')].find((x) => x.textContent?.trim().startsWith(label));
  if (!l) throw new Error(`No field “${label}”; have: ${[...host.querySelectorAll('label')].map((x) => x.textContent).join(' | ')}`);
  return host.querySelector(`#${CSS.escape((l as HTMLLabelElement).htmlFor)}`) as HTMLInputElement;
}
function type(el: Element, value: string) {
  const proto = el instanceof HTMLSelectElement ? HTMLSelectElement.prototype : HTMLInputElement.prototype;
  act(() => {
    Object.getOwnPropertyDescriptor(proto, 'value')?.set?.call(el, value);
    el.dispatchEvent(new Event(el instanceof HTMLSelectElement ? 'change' : 'input', { bubbles: true }));
  });
}

// ── The mode ────────────────────────────────────────────────────────────

describe('when the school has not switched the degree audit to Core', () => {
  it('says so in one sentence and reads no program', async () => {
    mock.modes = [{ module: 'degree_audit', mode: 'connect', frozen: false, killed: false }];
    await render();
    expect(text()).toContain('has not switched the degree audit to Semester Core');
    expect(mock.caps).not.toHaveBeenCalled();
    expect(mock.programs).not.toHaveBeenCalled();
    await press('Open The degree');
    expect(mock.dispatch).toHaveBeenCalledWith({ type: 'go', screen: 'degree' });
  });

  it('reads a school with no row at all as Connect', async () => {
    mock.modes = [];
    await render();
    expect(text()).toContain('has not switched the degree audit');
    expect(mock.programs).not.toHaveBeenCalled();
  });

  it('reads a failed mode read as Connect, never as Core, and says it could not read it', async () => {
    mock.modes = 'error';
    await render();
    expect(text()).toContain('could not read how your school runs its degree audit');
    expect(mock.programs).not.toHaveBeenCalled();
  });

  it('says the same under the kill switch, as a pause and not as never switched', async () => {
    mock.modes = [{ module: 'degree_audit', mode: 'connect', frozen: true, killed: true }];
    mock.audits.mockResolvedValue([audit()]);
    await render();
    expect(text()).toContain('paused its Core modules');
    expect(host.querySelector('[role="alert"]')).not.toBeNull();
    expect(must('Run the audit').disabled).toBe(true);
    expect(text()).toContain('Economics, B.A.');
  });
});

describe('who it is for', () => {
  it('asks a signed-out visitor to sign in, and reads nothing', async () => {
    mock.user = null;
    await render();
    expect(text()).toContain('Sign in with your school account');
    expect(mock.programs).not.toHaveBeenCalled();
  });

  it('says a build with no account service cannot show the school’s audit, and offers the calculator', async () => {
    mock.configured = false;
    await render();
    expect(text()).toContain('needs an account');
    await press('Open The degree');
    expect(mock.dispatch).toHaveBeenCalledWith({ type: 'go', screen: 'degree' });
  });
});

// ── A school that has published nothing ─────────────────────────────────

describe('when the school has published no program', () => {
  it('says so plainly and shows no requirement of its own', async () => {
    mock.programs.mockResolvedValue([]);
    await render();
    expect(text()).toContain('Your school has published no degree program yet');
    expect(text()).toContain('does not invent requirements');
    expect(has('Run the audit')).toBe(false);
    expect(host.querySelector('input')).toBeNull();
    expect(text()).not.toMatch(/Core theory|Distribution|AXLE|Electives/);
  });

  it('does not offer a draft or a retired version to audit against', async () => {
    mock.programs.mockResolvedValue([{ ...PROGRAM, state: 'draft' }, { ...PROGRAM, id: 'p0', version: 1, state: 'retired' }]);
    await render();
    expect(text()).toContain('published no degree program');
  });
});

// ── A student ──────────────────────────────────────────────────────────

describe('a student', () => {
  it('is told when the school has linked no record to their account, and nothing is run', async () => {
    mock.ref.mockResolvedValue(null);
    await render();
    expect(text()).toContain('has not linked your account to its academic record');
    expect(has('Run the audit')).toBe(false);
  });

  it('audits only the record linked to their account, and is never offered another reference', async () => {
    await render();
    expect(host.querySelector('input[aria-label="Student reference"]')).toBeNull();
    expect(mock.audits).toHaveBeenCalledWith('S100');
    await press('Run the audit');
    expect(mock.run).toHaveBeenCalledTimes(1);
    expect(mock.run).toHaveBeenCalledWith('p1', 'S100', todayIso(new Date()), expect.stringMatching(/^[A-Za-z0-9:._-]{8,200}$/));
  });

  it('says what a run did and did not do, and reads the kept audit back', async () => {
    mock.audits.mockResolvedValueOnce([]).mockResolvedValue([audit()]);
    await render();
    await press('Run the audit');
    expect(text()).toContain('Nothing was written to the academic record');
    expect(mock.audits).toHaveBeenCalledTimes(2);
    expect(text()).toContain('Met if in-progress courses pass');
  });

  it('shows in-progress work apart from finished work, and never as done', async () => {
    mock.audits.mockResolvedValue([audit()]);
    await render();
    expect(text()).toContain('1 of 2 courses finished, and 1 in progress would cover the rest.');
    expect(text()).toContain('In progress, not yet done');
    expect(text()).toContain('ECON 2010 · Fall 2026: in progress');
    expect(text()).not.toContain('Requirements met.');
    expect(text()).toContain('Fingerprint abababababab');
    expect(text()).toContain('It is not a transcript');
  });

  it('states double counting from the kept result', async () => {
    mock.audits.mockResolvedValue([audit({ result: fixtures[3].expected.result as unknown as AuditResult })]);
    await render();
    expect(text()).toContain('Counted in more than one requirement');
    expect(text()).toContain('ECON 2010 · Spring 2026: Major core, Writing, Electives');
    expect(text()).toContain('On the record, not counted');
    expect(text()).toContain('Its grade is not one of the passing grades the school listed');
  });

  it('shows no verdict of its own for a kept audit it cannot read', async () => {
    mock.audits.mockResolvedValue([audit({ result: null, verdict: 'incomplete' })]);
    await render();
    expect(text()).toContain('cannot read, so no verdict is shown');
    expect(host.querySelector('[aria-label="Verdict"]')).toBeNull();
    expect(host.querySelector('[aria-label="Requirements"]')).toBeNull();
  });

  it('is refused a future date before the database is asked', async () => {
    await render();
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 3);
    type(field('As of'), todayIso(tomorrow));
    await press('Run the audit');
    expect(mock.run).not.toHaveBeenCalled();
    const box = field('As of');
    expect(box.getAttribute('aria-invalid')).toBe('true');
    expect(text()).toContain('never a later one');
  });

  it('shows the server’s sentence when it refuses', async () => {
    mock.run.mockRejectedValue(new ServiceError('You can audit your own record, or any record if your school gave you degree:audit.', true));
    await render();
    await press('Run the audit');
    expect(text()).toContain('You can audit your own record');
    expect(has('Try again')).toBe(false);
  });

  it('keeps one key across a lost reply, and takes a new one after an answer', async () => {
    mock.run
      .mockRejectedValueOnce(new ServiceError('The connection did not answer, so it is not known whether the change was made.', false))
      .mockResolvedValueOnce('a1')
      .mockResolvedValue('a1');
    await render();
    await press('Run the audit');
    expect(text()).toContain('not known whether the change was made');
    expect(has('Try the audit again')).toBe(true);
    await press('Try the audit again');
    expect(mock.run).toHaveBeenCalledTimes(2);
    expect(mock.run.mock.calls[1][3]).toBe(mock.run.mock.calls[0][3]);
    await press('Run the audit');
    expect(mock.run.mock.calls[2][3]).not.toBe(mock.run.mock.calls[0][3]);
  });
});

// ── Staff ──────────────────────────────────────────────────────────────

describe('a registrar, dean or advisor', () => {
  beforeEach(() => {
    mock.caps.mockResolvedValue(STAFF);
  });

  it('types a student reference, and is not asked which record is theirs', async () => {
    await render();
    expect(mock.ref).not.toHaveBeenCalled();
    expect(field('Student reference')).toBeTruthy();
    type(field('Student reference'), 'S200');
    await press('Run the audit');
    expect(mock.run).toHaveBeenCalledWith('p1', 'S200', todayIso(new Date()), expect.any(String));
  });

  it('is refused a malformed reference with the field-error component, before the database is asked', async () => {
    await render();
    type(field('Student reference'), 'S2 00; drop');
    await press('Run the audit');
    expect(mock.run).not.toHaveBeenCalled();
    const box = field('Student reference');
    expect(box.getAttribute('aria-invalid')).toBe('true');
    expect(box.getAttribute('aria-describedby')).toContain(`${box.id}-error`);
    expect(host.querySelector(`#${CSS.escape(`${box.id}-error`)}`)?.textContent).toContain('letters, digits');
    expect(document.activeElement).toBe(box);
    // Fixing it clears the complaint.
    type(box, 'S200');
    expect(box.getAttribute('aria-invalid')).toBeNull();
  });

  it('reads the audits kept for a student when asked, and reads none before', async () => {
    mock.audits.mockResolvedValue([audit({ requestedBy: 'someone-else' })]);
    await render();
    expect(mock.audits).not.toHaveBeenCalled();
    type(field('Student reference'), 'S100');
    await press('Show the audits kept for this student');
    expect(mock.audits).toHaveBeenCalledWith('S100');
    expect(text()).toContain('the audit as of');
    expect(text()).not.toContain('by you');
  });

  it('chooses among published programs only', async () => {
    mock.programs.mockResolvedValue([PROGRAM, { ...PROGRAM, id: 'p9', title: 'Draft program', state: 'draft' }]);
    await render();
    const options = [...(field('Program') as HTMLSelectElement).options].map((o) => o.textContent);
    expect(options).toEqual(['Economics, B.A. · catalog 2026 · version 2']);
  });
});
