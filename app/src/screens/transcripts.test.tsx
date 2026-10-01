// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ServiceError } from '../lib/attempt';
import { forgetModuleModes } from '../lib/modulemode';
import { buildBody } from '../lib/transcripts/body';
import { canonicalize } from '../lib/transcripts/canonical';
import { todayIso } from '../lib/transcripts/views';
import type { Disclosure, Transcript } from '../lib/transcripts/model';

/**
 * The transcripts screen, driven against a replaced account service.
 *
 * The mode read is the real one over a fake database; the transcripts client's
 * reads and writes are replaced. Under test: that the screen stops at the mode
 * without reading a transcript when the school has not switched records to
 * Core, and still offers the one thing that works anywhere, a check; that a
 * student reads only their own and is never offered another reference or the
 * means to issue; that a school with nothing issued is told so; that staff type
 * a reference, are refused a malformed one or a future date before the database
 * is asked, and that one attempt carries one key across a lost reply and a new
 * key after an answer; that a release is logged with who, what and why and is
 * refused when a field is blank; that a dean reads and cannot issue; that a
 * check shows one of three words and no more; that a frozen module reads what
 * was kept and issues nothing; and that the screen says it is not signed and
 * never calls what it shows official, certified or authenticated.
 */

const mock = vi.hoisted(() => ({
  configured: true,
  user: 'ana-0001-aaaa' as string | null,
  school: 'vu' as string | null,
  modes: [{ module: 'records', mode: 'core', frozen: false, killed: false }] as unknown[] | 'error',
  caps: vi.fn(),
  transcripts: vi.fn(),
  disclosures: vi.fn(),
  ref: vi.fn(),
  issue: vi.fn(),
  release: vi.fn(),
  verify: vi.fn(),
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
vi.mock('../lib/transcripts/client', async (orig) => ({
  ...(await orig<object>()),
  loadTranscripts: mock.transcripts,
  loadDisclosures: mock.disclosures,
  myStudentRef: mock.ref,
  issueTranscript: mock.issue,
  discloseTranscript: mock.release,
  verifyTranscript: mock.verify,
}));

import { Transcripts } from './Transcripts';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let host: HTMLDivElement;
let root: Root;

const grant = (capability: string) => ({ capability, scopeKind: 'school', scopeId: 'vu' });
const REGISTRAR = [grant('transcript:issue'), grant('transcript:read')];
const DEAN = [grant('transcript:read')];
const HASH = 'ab'.repeat(32);
const HASH2 = 'cd'.repeat(32);

const bodyText = (serial: string, ref = 'S100') =>
  canonicalize(
    buildBody({ serial, school_id: 'vu', school_name: 'Vale University', student_ref: ref, as_of: '2026-09-30' }, [
      { kind: 'enrollment', key: 'ECON 1010 · Fall 2025', value: 'Enrolled', effective_on: '2025-09-01' },
      { kind: 'grade', key: 'ECON 1010 · Fall 2025', value: 'A-', effective_on: '2025-12-15' },
      { kind: 'credit', key: 'ECON 1010 · Fall 2025', value: '3', effective_on: '2025-12-15' },
      { kind: 'standing', key: 'Academic standing', value: 'Good standing', effective_on: '2026-01-15' },
    ]),
  );
const transcript = (serial: number, patch: Partial<Transcript> = {}): Transcript => ({
  id: `t${serial}`, serial, studentRef: 'S100', asOf: '2026-09-30', issuedBy: 'reg-1', issuedAt: '2026-09-30T10:00:00Z',
  bodyText: bodyText(String(serial)), bodySha256: serial === 1 ? HASH : HASH2, replacedBy: null, replacedBecause: null, ...patch,
});
const disclosure = (patch: Partial<Disclosure> = {}): Disclosure => ({
  id: 'd1', serial: 1, studentRef: 'S100', releasedBy: 'reg-1', releasedAt: '2026-09-30T11:00:00Z', recipientName: 'Northern State University',
  recipientKind: 'another school', purpose: 'Transfer admission.', ...patch,
});

const writeText = vi.fn();

beforeEach(() => {
  vi.resetAllMocks();
  localStorage.clear();
  forgetModuleModes();
  mock.configured = true;
  mock.user = 'ana-0001-aaaa';
  mock.school = 'vu';
  mock.modes = [{ module: 'records', mode: 'core', frozen: false, killed: false }];
  mock.caps.mockResolvedValue([]);
  mock.transcripts.mockResolvedValue([]);
  mock.disclosures.mockResolvedValue([]);
  mock.ref.mockResolvedValue('S100');
  mock.issue.mockResolvedValue('t1');
  mock.release.mockResolvedValue('d1');
  mock.verify.mockResolvedValue({ status: 'valid', schoolName: 'Vale University', issuedOn: '2026-09-30' });
  Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
  writeText.mockResolvedValue(undefined);
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
    root.render(<Transcripts />);
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

// ── The words ───────────────────────────────────────────────────────────

const FORBIDDEN = /\bofficial|certified|authenticated|authentic\b/i;

describe('what the screen says it is', () => {
  it('says it is not signed, in the body, before anything else, in every state that reads the module', async () => {
    mock.modes = [{ module: 'records', mode: 'connect', frozen: false, killed: false }];
    await render();
    expect(host.querySelector('[data-testid="not-signed"]')?.textContent).toContain('This is not a signed transcript.');
    expect(text()).toContain('does not show who issued it');
    expect(text()).toContain('Signing needs a decision about who holds a key');
    expect(text()).toContain('has not made it');
  });

  it('says it above the transcripts themselves, for a student and for a registrar at a Core school too', async () => {
    mock.transcripts.mockResolvedValue([transcript(1)]);
    await render();
    const first = (): Element | null => host.querySelector('[data-testid="not-signed"]');
    expect(first()?.textContent).toContain('This is not a signed transcript.');
    expect(first()?.compareDocumentPosition(host.querySelector('[data-testid="hash-1"]')!) ?? 0).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
    mock.caps.mockResolvedValue(REGISTRAR);
    act(() => root.unmount());
    root = createRoot(host);
    await render();
    expect(first()?.textContent).toContain('This is not a signed transcript.');
    // And in a paused module, which still shows what was kept.
    mock.modes = [{ module: 'records', mode: 'connect', frozen: true, killed: true }];
    forgetModuleModes();
    act(() => root.unmount());
    root = createRoot(host);
    await render();
    expect(first()?.textContent).toContain('This is not a signed transcript.');
  });

  it('never calls what it shows official, certified or authenticated, whoever is looking', async () => {
    mock.transcripts.mockResolvedValue([transcript(2, { replacedBy: 3, replacedBecause: 'The record was corrected.' }), transcript(1)]);
    mock.disclosures.mockResolvedValue([disclosure()]);
    await render();
    expect(text()).not.toMatch(FORBIDDEN);
    mock.caps.mockResolvedValue(REGISTRAR);
    act(() => root.unmount());
    root = createRoot(host);
    await render();
    expect(text()).not.toMatch(FORBIDDEN);
    type(field('Serial'), '1');
    type(field('SHA-256'), HASH);
    await press('Check it');
    expect(text()).toContain('Matches.');
    expect(text()).not.toMatch(FORBIDDEN);
  });
});

// ── The mode ────────────────────────────────────────────────────────────

describe('when the school has not switched records to Core', () => {
  it('says so in one sentence, reads no transcript, and still offers a check', async () => {
    mock.modes = [{ module: 'records', mode: 'connect', frozen: false, killed: false }];
    await render();
    expect(text()).toContain('has not switched records and transcripts to Semester Core');
    expect(mock.caps).not.toHaveBeenCalled();
    expect(mock.transcripts).not.toHaveBeenCalled();
    expect(has('Check it')).toBe(true);
    expect(has('Issue the transcript')).toBe(false);
    await press('Open your courses');
    expect(mock.dispatch).toHaveBeenCalledWith({ type: 'go', screen: 'courses' });
  });

  it('reads a school with no row at all as Connect', async () => {
    mock.modes = [];
    await render();
    expect(text()).toContain('has not switched records and transcripts');
    expect(mock.transcripts).not.toHaveBeenCalled();
  });

  it('reads a failed mode read as Connect, never as Core, and says it could not read it', async () => {
    mock.modes = 'error';
    await render();
    expect(text()).toContain('could not read how your school runs its records');
    expect(mock.transcripts).not.toHaveBeenCalled();
  });

  it('says the same under the kill switch, as a pause, and reads what was kept but issues nothing', async () => {
    mock.modes = [{ module: 'records', mode: 'connect', frozen: true, killed: true }];
    mock.caps.mockResolvedValue(REGISTRAR);
    mock.transcripts.mockResolvedValue([transcript(1)]);
    await render();
    expect(text()).toContain('paused its Core modules');
    expect(host.querySelector('[role="alert"]')).not.toBeNull();
    expect(must('Issue the transcript').disabled).toBe(true);
    type(field('Student reference to look up'), 'S100');
    await press('Show what was issued');
    expect(text()).toContain('Serial 1');
    expect(must('Log the release').disabled).toBe(true);
  });

  it('says a frozen module is read-only, and issues nothing', async () => {
    mock.modes = [{ module: 'records', mode: 'connect', frozen: true, killed: false }];
    mock.caps.mockResolvedValue(REGISTRAR);
    await render();
    expect(text()).toContain('taken records and transcripts back out of Semester Core');
    expect(must('Issue the transcript').disabled).toBe(true);
  });
});

describe('who it is for', () => {
  it('asks a signed-out visitor to sign in, and reads nothing', async () => {
    mock.user = null;
    await render();
    expect(text()).toContain('Sign in with your school account');
    expect(mock.transcripts).not.toHaveBeenCalled();
  });

  it('says a build with no account service cannot show them', async () => {
    mock.configured = false;
    await render();
    expect(text()).toContain('need an account');
  });

  it('says an account with no school has none to show', async () => {
    mock.school = null;
    await render();
    expect(text()).toContain('no school yet');
  });
});

// ── A student ──────────────────────────────────────────────────────────

describe('a student', () => {
  it('is told when the school has linked no record to their account', async () => {
    mock.ref.mockResolvedValue(null);
    await render();
    expect(text()).toContain('has not linked your account to its academic record');
    expect(mock.transcripts).not.toHaveBeenCalled();
  });

  it('is told plainly when nothing has been issued', async () => {
    await render();
    expect(text()).toContain('Nothing has been issued yet.');
    expect(text()).toContain('has not issued a transcript of your record from Semester');
  });

  it('reads their own transcripts and releases without naming a reference, and is not offered the means to issue or look up', async () => {
    mock.transcripts.mockResolvedValue([transcript(2, { replacedBy: 3, replacedBecause: 'The record was corrected.' }), transcript(1)]);
    mock.disclosures.mockResolvedValue([disclosure()]);
    await render();
    expect(mock.transcripts).toHaveBeenCalledWith(null);
    expect(mock.disclosures).toHaveBeenCalledWith(null);
    expect(text()).toContain('Serial 2');
    expect(text()).toContain('Serial 1');
    expect(has('Issue the transcript')).toBe(false);
    expect(has('Log the release')).toBe(false);
    expect(host.querySelector('input[aria-label="Student reference"]')).toBeNull();
    expect(host.querySelector('input[aria-label="Student reference to look up"]')).toBeNull();
  });

  it('shows the serial and the whole hash, whether it was replaced, and who it was released to', async () => {
    mock.transcripts.mockResolvedValue([transcript(2, { replacedBy: 3, replacedBecause: 'The record was corrected.' }), transcript(1)]);
    mock.disclosures.mockResolvedValue([disclosure()]);
    await render();
    expect(host.querySelector('[data-testid="hash-1"]')?.textContent).toBe(HASH);
    expect(host.querySelector('[data-testid="hash-2"]')?.textContent).toBe(HASH2);
    expect(text()).toContain('Replaced by serial 3: The record was corrected.');
    expect(text()).toContain('Not replaced.');
    expect(text()).toContain('to Northern State University (another school), for Transfer admission.');
  });

  it('shows what the kept text says as the ledger held it, and the text itself', async () => {
    mock.transcripts.mockResolvedValue([transcript(1)]);
    await render();
    expect(text()).toContain('Fall 2025');
    expect(text()).toContain('ECON 1010: grade A-, credit 3');
    expect(text()).toContain('Academic standing: Good standing');
    expect(host.querySelector('pre')?.textContent).toBe(bodyText('1'));
  });

  it('shows a kept text it cannot read as it is, and says so', async () => {
    mock.transcripts.mockResolvedValue([transcript(1, { bodyText: 'not the shape this build reads' })]);
    await render();
    expect(text()).toContain('cannot read the kept text');
    expect(host.querySelector('pre')?.textContent).toBe('not the shape this build reads');
  });

  it('copies the serial and the hash to give someone, and sends nothing', async () => {
    mock.transcripts.mockResolvedValue([transcript(1)]);
    await render();
    await press('Copy the serial and hash');
    expect(writeText).toHaveBeenCalledWith(`Transcript serial 1\nSHA-256 ${HASH}`);
    expect(text()).toContain('Copied.');
    expect(mock.release).not.toHaveBeenCalled();
    expect(mock.issue).not.toHaveBeenCalled();
  });

  it('says when it could not copy, and where to find the values', async () => {
    writeText.mockRejectedValue(new Error('blocked'));
    mock.transcripts.mockResolvedValue([transcript(1)]);
    await render();
    await press('Copy the serial and hash');
    expect(text()).toContain('Could not copy. Select the serial and hash above');
  });

  it('says it could not read, and changed nothing, when the read fails', async () => {
    mock.transcripts.mockRejectedValue(new ServiceError('Could not load the transcripts.', true));
    await render();
    expect(text()).toContain('Could not load the transcripts.');
    expect(text()).toContain('Nothing has changed.');
  });
});

// ── Staff ──────────────────────────────────────────────────────────────

describe('a registrar', () => {
  beforeEach(() => {
    mock.caps.mockResolvedValue(REGISTRAR);
  });

  it('types a student reference, and is not asked which record is theirs', async () => {
    await render();
    expect(mock.ref).not.toHaveBeenCalled();
    expect(mock.transcripts).not.toHaveBeenCalled();
    type(field('Student reference to look up'), 'S200');
    await press('Show what was issued');
    expect(mock.transcripts).toHaveBeenCalledWith('S200');
    expect(mock.disclosures).toHaveBeenCalledWith('S200');
    expect(text()).toContain('Nothing has been issued yet.');
    expect(text()).toContain('Nothing has been issued for that student reference');
  });

  it('issues with a reference and a date, and the attempt key the database accepts', async () => {
    await render();
    type(field('Student reference'), 'S100');
    await press('Issue the transcript');
    expect(mock.issue).toHaveBeenCalledTimes(1);
    expect(mock.issue).toHaveBeenCalledWith('S100', todayIso(new Date()), null, null, expect.stringMatching(/^[A-Za-z0-9:._-]{8,200}$/));
    expect(text()).toContain('The transcript was issued and kept. Nothing was written to the academic record.');
    // And reads what is now kept for that student.
    expect(mock.transcripts).toHaveBeenCalledWith('S100');
  });

  it('replaces an earlier transcript with its serial and a trimmed reason', async () => {
    await render();
    type(field('Student reference'), 'S100');
    type(field('Replaces serial'), '2');
    type(field('Why it is replaced'), '  The record was corrected.  ');
    await press('Issue the transcript');
    expect(mock.issue).toHaveBeenCalledWith('S100', todayIso(new Date()), 2, 'The record was corrected.', expect.any(String));
  });

  it('is refused a malformed reference with the field-error component, before the database is asked', async () => {
    await render();
    type(field('Student reference'), 'S1 00; drop');
    await press('Issue the transcript');
    expect(mock.issue).not.toHaveBeenCalled();
    const box = field('Student reference');
    expect(box.getAttribute('aria-invalid')).toBe('true');
    expect(box.getAttribute('aria-describedby')).toContain(`${box.id}-error`);
    expect(host.querySelector(`#${CSS.escape(`${box.id}-error`)}`)?.textContent).toContain('letters, digits');
    expect(document.activeElement).toBe(box);
    type(box, 'S100');
    expect(box.getAttribute('aria-invalid')).toBeNull();
  });

  it('is refused a future date before the database is asked', async () => {
    await render();
    type(field('Student reference'), 'S100');
    const later = new Date();
    later.setDate(later.getDate() + 3);
    type(field('As of'), todayIso(later));
    await press('Issue the transcript');
    expect(mock.issue).not.toHaveBeenCalled();
    expect(field('As of').getAttribute('aria-invalid')).toBe('true');
    expect(text()).toContain('never a later one');
  });

  it('is refused a serial with no reason, and a reason with no serial', async () => {
    await render();
    type(field('Student reference'), 'S100');
    type(field('Replaces serial'), '2');
    await press('Issue the transcript');
    expect(mock.issue).not.toHaveBeenCalled();
    expect(text()).toContain('Say why it is replaced');
    type(field('Replaces serial'), '');
    type(field('Why it is replaced'), 'Because.');
    await press('Issue the transcript');
    expect(mock.issue).not.toHaveBeenCalled();
    expect(text()).toContain('A reason goes with a replacement');
  });

  it('shows the server’s sentence when it refuses, with no retry', async () => {
    mock.issue.mockRejectedValue(new ServiceError('There is nothing on that student’s record as of that date to issue.', true));
    await render();
    type(field('Student reference'), 'S999');
    await press('Issue the transcript');
    expect(text()).toContain('nothing on that student’s record');
    expect(has('Try again')).toBe(false);
  });

  it('keeps one key across a lost reply, and takes a new one after an answer', async () => {
    mock.issue
      .mockRejectedValueOnce(new ServiceError('The connection did not answer, so it is not known whether the change was made.', false))
      .mockResolvedValue('t1');
    await render();
    type(field('Student reference'), 'S100');
    await press('Issue the transcript');
    expect(text()).toContain('not known whether the change was made');
    expect(has('Try issuing again')).toBe(true);
    await press('Try issuing again');
    expect(mock.issue).toHaveBeenCalledTimes(2);
    expect(mock.issue.mock.calls[1][4]).toBe(mock.issue.mock.calls[0][4]);
    await press('Issue the transcript');
    expect(mock.issue.mock.calls[2][4]).not.toBe(mock.issue.mock.calls[0][4]);
  });

  it('logs a release with who, what kind and why, and reads the log again', async () => {
    mock.transcripts.mockResolvedValue([transcript(2), transcript(1)]);
    await render();
    type(field('Student reference to look up'), 'S100');
    await press('Show what was issued');
    type(field('Transcript'), '1');
    type(field('Released to'), '  Northern State University  ');
    type(field('What kind of recipient'), 'another school');
    type(field('Why it was released'), 'Transfer admission.');
    await press('Log the release');
    expect(mock.release).toHaveBeenCalledWith(1, 'Northern State University', 'another school', 'Transfer admission.', expect.stringMatching(/^[A-Za-z0-9:._-]{8,200}$/));
    expect(text()).toContain('The release was logged. Semester sent nothing');
    expect(mock.transcripts.mock.calls.length).toBeGreaterThanOrEqual(2);
  });

  it('is refused a release with a blank field, naming each, before the database is asked', async () => {
    mock.transcripts.mockResolvedValue([transcript(1)]);
    await render();
    type(field('Student reference to look up'), 'S100');
    await press('Show what was issued');
    await press('Log the release');
    expect(mock.release).not.toHaveBeenCalled();
    expect(text()).toContain('Say who it was released to.');
    expect(text()).toContain('Say what kind of recipient that is');
    expect(text()).toContain('Say why it was released.');
  });

  it('says plainly that nothing is sent from the release form and that a logged release cannot be edited', async () => {
    mock.transcripts.mockResolvedValue([transcript(1)]);
    await render();
    type(field('Student reference to look up'), 'S100');
    await press('Show what was issued');
    expect(text()).toContain('Nothing is sent from here. A logged release cannot be edited or removed by anybody.');
  });
});

describe('a dean', () => {
  it('reads what was issued for a student and is offered neither an issue nor a release', async () => {
    mock.caps.mockResolvedValue(DEAN);
    mock.transcripts.mockResolvedValue([transcript(1)]);
    mock.disclosures.mockResolvedValue([disclosure()]);
    await render();
    expect(has('Issue the transcript')).toBe(false);
    type(field('Student reference to look up'), 'S100');
    await press('Show what was issued');
    expect(text()).toContain('Serial 1');
    expect(text()).toContain('Northern State University');
    expect(has('Log the release')).toBe(false);
  });
});

// ── Checking ───────────────────────────────────────────────────────────

describe('checking a transcript', () => {
  it('is refused a serial or a hash that cannot be one, before the database is asked', async () => {
    await render();
    type(field('Serial'), 'twelve');
    type(field('SHA-256'), 'abc');
    await press('Check it');
    expect(mock.verify).not.toHaveBeenCalled();
    expect(text()).toContain('A serial is a whole number');
    expect(text()).toContain('A hash is 64 letters and digits');
  });

  it('says matches, with the school and the day, and not who issued it', async () => {
    await render();
    type(field('Serial'), '1');
    type(field('SHA-256'), `  ${HASH.toUpperCase()}  `);
    await press('Check it');
    expect(mock.verify).toHaveBeenCalledWith(1, HASH);
    expect(text()).toContain('Matches.');
    expect(text()).toContain('Vale University issued this transcript on');
    expect(text()).toContain('It does not show who issued it');
  });

  it('says matches but replaced when it was, and no match otherwise, and nothing more', async () => {
    mock.verify.mockResolvedValueOnce({ status: 'superseded', schoolName: 'Vale University', issuedOn: '2026-09-30' });
    await render();
    type(field('Serial'), '1');
    type(field('SHA-256'), HASH);
    await press('Check it');
    expect(text()).toContain('Matches, replaced since.');
    expect(text()).toContain('Ask for the current one');
    mock.verify.mockResolvedValueOnce({ status: 'unknown', schoolName: null, issuedOn: null });
    await press('Check it');
    expect(text()).toContain('No match.');
    expect(text()).toContain('does not tell you which of the two is wrong');
    expect(text()).not.toContain('Vale University issued');
  });

  it('shows the server’s sentence when the check is refused, such as the limit', async () => {
    mock.verify.mockRejectedValue(new ServiceError('You’ve sent a lot in a short time — try again in a few minutes.', true));
    await render();
    type(field('Serial'), '1');
    type(field('SHA-256'), HASH);
    await press('Check it');
    expect(text()).toContain('a short time');
    expect(host.querySelector('[role="alert"]')).not.toBeNull();
  });

  it('says it needs an account and that each account may check 120 an hour', async () => {
    await render();
    expect(text()).toContain('needs you to be signed in');
    expect(text()).toContain('120 an hour');
  });
});
