// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ServiceError } from '../lib/attempt';
import { forgetModuleModes } from '../lib/modulemode';
import type { Applicant, ApplicantLink, HistoryEntry } from '../lib/admissions/model';
import type { Award, AwardHistoryEntry, Disbursement } from '../lib/aid/model';

/**
 * The admissions and financial-aid screens, driven against a replaced account service.
 *
 * The mode read is the real one over a fake database; the two clients' reads and
 * writes are replaced. Under test: that each screen stops at the mode without
 * reading a record when the school has not switched its module to Core; that
 * somebody without the staff capability reads no applicant file and is told only
 * that the page is for staff; that a status is chosen from the steps the record
 * allows and a decision is offered only to somebody who may decide; that a
 * reason is required and a social security number or a card number in any field
 * is refused before the database is asked; that one attempt carries one key
 * across a lost reply and a new key after an answer; that a refusal is the
 * server's sentence; that a student reads only their own awards and what was
 * paid out, with no history and no form; and that no screen shows a score, a
 * rank, a rating, a prediction or a recommendation.
 */

const mock = vi.hoisted(() => ({
  configured: true,
  user: 'reg-0001-aaaa' as string | null,
  school: 'vu' as string | null,
  modes: [
    { module: 'admissions', mode: 'core', frozen: false, killed: false },
    { module: 'financial_aid', mode: 'core', frozen: false, killed: false },
  ] as unknown[] | 'error',
  caps: vi.fn(),
  applicants: vi.fn(),
  links: vi.fn(),
  history: vi.fn(),
  add: vi.fn(),
  record: vi.fn(),
  correct: vi.fn(),
  link: vi.fn(),
  awards: vi.fn(),
  awardHistory: vi.fn(),
  disbursements: vi.fn(),
  myRef: vi.fn(),
  recordAward: vi.fn(),
  approve: vi.fn(),
  awardStatus: vi.fn(),
  disburse: vi.fn(),
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
  useStore: () => ({ dispatch: vi.fn(), say: vi.fn(), account: mock.user ? { id: mock.user } : null, state: {} }),
  useNow: () => new Date(),
}));
vi.mock('../lib/capabilities', async (orig) => ({ ...(await orig<object>()), loadMyCapabilitiesOrThrow: mock.caps }));
vi.mock('../lib/admissions/client', async (orig) => ({
  ...(await orig<object>()),
  loadApplicants: mock.applicants,
  loadLinks: mock.links,
  loadHistory: mock.history,
  addApplicant: mock.add,
  recordStatus: mock.record,
  correctStatus: mock.correct,
  linkApplicant: mock.link,
}));
vi.mock('../lib/aid/client', async (orig) => ({
  ...(await orig<object>()),
  loadAwards: mock.awards,
  loadHistory: mock.awardHistory,
  loadDisbursements: mock.disbursements,
  myStudentRef: mock.myRef,
  recordAward: mock.recordAward,
  approveAward: mock.approve,
  recordAwardStatus: mock.awardStatus,
  recordDisbursement: mock.disburse,
}));

import { Admissions } from './Admissions';
import { Aid } from './Aid';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let host: HTMLDivElement;
let root: Root;

const grant = (capability: string) => ({ capability, scopeKind: 'school', scopeId: 'vu' });
const REGISTRAR = ['admissions:read', 'admissions:record', 'admissions:decide'].map(grant);
const RECORDER = ['admissions:read', 'admissions:record'].map(grant);
const AID_OFFICER = ['aid:read', 'aid:record'].map(grant);
const APPROVER = ['aid:read', 'aid:approve_high'].map(grant);

const applicant = (patch: Partial<Applicant> = {}): Applicant => ({
  id: 'a1', cycle: 'Fall 2027', applicantRef: 'A-1001', program: 'Economics, B.A.', status: 'in_review', statusAt: '2026-10-01T10:00:00Z', ...patch,
});
const entry = (patch: Partial<HistoryEntry> = {}): HistoryEntry => ({
  id: 'h1', applicantId: 'a1', seq: 1, kind: 'status', fromStatus: null, toStatus: 'submitted', correctsSeq: null, reason: 'Received through the portal', recordedBy: 'reg-0001-aaaa', recordedAt: '2026-10-01T09:00:00Z', ...patch,
});
const award = (patch: Partial<Award> = {}): Award => ({
  id: 'w1', studentRef: 'S100', aidYear: '2026-2027', fundName: 'Merit Grant', awardType: 'grant', amountCents: 40000, status: 'accepted', highValue: false, approvedAt: null, recordedAt: '2026-10-01T09:00:00Z', ...patch,
});
const awardEntry = (patch: Partial<AwardHistoryEntry> = {}): AwardHistoryEntry => ({
  id: 'ah1', awardId: 'w1', seq: 1, kind: 'status', fromStatus: null, toStatus: 'offered', correctsSeq: null, reason: 'Offered by the aid office', recordedBy: 'someone-else', recordedAt: '2026-10-01T09:00:00Z', ...patch,
});
const paid = (patch: Partial<Disbursement> = {}): Disbursement => ({
  id: 'd1', awardId: 'w1', amountCents: 10000, disbursedOn: '2026-09-01', ledgerEntryId: null, recordedAt: '2026-09-01T09:00:00Z', ...patch,
});

beforeEach(() => {
  vi.resetAllMocks();
  localStorage.clear();
  forgetModuleModes();
  mock.configured = true;
  mock.user = 'reg-0001-aaaa';
  mock.school = 'vu';
  mock.modes = [
    { module: 'admissions', mode: 'core', frozen: false, killed: false },
    { module: 'financial_aid', mode: 'core', frozen: false, killed: false },
  ];
  mock.caps.mockResolvedValue(REGISTRAR);
  mock.applicants.mockResolvedValue([applicant()]);
  mock.links.mockResolvedValue([]);
  mock.history.mockResolvedValue([entry()]);
  mock.add.mockResolvedValue('a2');
  mock.record.mockResolvedValue('h2');
  mock.correct.mockResolvedValue('h3');
  mock.link.mockResolvedValue('l1');
  mock.awards.mockResolvedValue([award()]);
  mock.awardHistory.mockResolvedValue([awardEntry()]);
  mock.disbursements.mockResolvedValue([paid()]);
  mock.myRef.mockResolvedValue('S100');
  mock.recordAward.mockResolvedValue('w2');
  mock.approve.mockResolvedValue('p1');
  mock.awardStatus.mockResolvedValue('ah2');
  mock.disburse.mockResolvedValue('d2');
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
async function render(which: 'admissions' | 'aid') {
  await act(async () => {
    root.render(which === 'admissions' ? <Admissions /> : <Aid />);
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
const optionsOf = (label: string) => [...field(label).querySelectorAll('option')].map((o) => o.textContent);

// A word that would make a list a ranking, a number a score or a suggestion a recommendation.
const BANNED = /\b(score[sd]?|scoring|rank(?:s|ed|ing|ings)?|rating|ratings|recommend(?:s|ed|ation|ations)?|predict(?:s|ed|ion|ions|ive)?|likelihood|likely|probability|yield|propensity|percentile)\b/i;

// ── Admissions: the mode ─────────────────────────────────────────────────

describe('admissions, when the school has not switched the module to Core', () => {
  it('says so in one sentence and reads no applicant', async () => {
    mock.modes = [{ module: 'admissions', mode: 'connect', frozen: false, killed: false }];
    await render('admissions');
    expect(text()).toContain('has not switched this to Semester Core');
    expect(mock.caps).not.toHaveBeenCalled();
    expect(mock.applicants).not.toHaveBeenCalled();
  });

  it('reads a school with no row at all, and a failed read, as Connect', async () => {
    mock.modes = [];
    await render('admissions');
    expect(mock.applicants).not.toHaveBeenCalled();
    mock.modes = 'error';
    forgetModuleModes();
    await act(async () => root.unmount());
    root = createRoot(host);
    await render('admissions');
    expect(text()).toContain('could not read how your school runs this');
    expect(mock.applicants).not.toHaveBeenCalled();
  });

  it('says a pause is a pause, and offers nothing to write while it lasts', async () => {
    mock.modes = [{ module: 'admissions', mode: 'connect', frozen: true, killed: true }];
    await render('admissions');
    expect(text()).toContain('paused its Core modules');
    expect(host.querySelector('[role="alert"]')).not.toBeNull();
    expect(must('Add the applicant').disabled).toBe(true);
    expect(text()).toContain('A-1001');
  });

  it('asks a signed-out visitor to sign in, and reads nothing', async () => {
    mock.user = null;
    await render('admissions');
    expect(text()).toContain('Sign in with your school account');
    expect(mock.applicants).not.toHaveBeenCalled();
  });
});

describe('admissions, for somebody who is not admissions staff', () => {
  it('tells a student, an applicant or a member of faculty only that the page is for staff, and reads no file', async () => {
    mock.caps.mockResolvedValue([grant('record:read')]);
    await render('admissions');
    expect(text()).toContain('for the school’s admissions staff');
    expect(text()).toContain('has no account here');
    expect(mock.applicants).not.toHaveBeenCalled();
    expect(mock.links).not.toHaveBeenCalled();
  });

  it('does not take a grant at another school for one here', async () => {
    mock.caps.mockResolvedValue([{ capability: 'admissions:read', scopeKind: 'school', scopeId: 'elsewhere' }]);
    await render('admissions');
    expect(mock.applicants).not.toHaveBeenCalled();
  });
});

// ── Admissions: the list and the file ────────────────────────────────────

describe('the applicant list', () => {
  it('lists applicants by cycle with the status a person recorded, and a tally of statuses and nothing else', async () => {
    mock.applicants.mockResolvedValue([
      applicant({ id: 'a2', applicantRef: 'A-2002', status: 'admitted' }),
      applicant(),
      applicant({ id: 'a3', cycle: 'Spring 2028', applicantRef: 'A-0001', status: 'submitted' }),
    ]);
    await render('admissions');
    const items = [...host.querySelectorAll('li')].map((li) => li.textContent);
    // Cycle first, then the school's own reference: A-1001 before A-2002.
    expect(items.findIndex((t) => t?.includes('A-1001'))).toBeLessThan(items.findIndex((t) => t?.includes('A-2002')));
    expect(text()).toContain('Fall 2027');
    expect(text()).toContain('Spring 2028');
    expect(text()).toContain('Admitted: 1');
    expect(text()).toContain('A person decides every admission');
  });

  it('shows no score, rank, rating, prediction or recommendation, on the list or in a file', async () => {
    mock.history.mockResolvedValue([entry(), entry({ id: 'h2', seq: 2, fromStatus: 'submitted', toStatus: 'in_review', reason: 'Opened for review' })]);
    await render('admissions');
    expect(text()).not.toMatch(BANNED);
    await press('Open A-1001');
    expect(text()).toContain('Opened for review');
    expect(text()).not.toMatch(BANNED);
    // No column of numbers about an applicant: the only digits are references, cycles, dates and the tally.
    expect(host.querySelector('[role="meter"], progress, meter')).toBeNull();
  });

  it('shows the history with who recorded each entry and why', async () => {
    mock.history.mockResolvedValue([
      entry(),
      entry({ id: 'h2', seq: 2, fromStatus: 'submitted', toStatus: 'in_review', reason: 'Opened for review', recordedBy: 'somebody-else' }),
    ]);
    await render('admissions');
    await press('Open A-1001');
    expect(text()).toContain('You recorded Submitted');
    expect(text()).toContain('A member of staff recorded Submitted to In review');
    expect(text()).toContain('Reason: Opened for review');
    expect(mock.history).toHaveBeenCalledWith('a1');
  });
});

describe('recording a status', () => {
  it('offers only the steps the record allows going forward, and a decision only to somebody who may decide', async () => {
    await render('admissions');
    await press('Open A-1001');
    expect(optionsOf('Next status')).toEqual(['Admitted', 'Denied', 'Waitlisted', 'Withdrawn']);

    mock.caps.mockResolvedValue(RECORDER);
    await act(async () => root.unmount());
    root = createRoot(host);
    await render('admissions');
    await press('Open A-1001');
    expect(optionsOf('Next status')).toEqual(['Withdrawn']);
    expect(has('Record the correction')).toBe(false);
  });

  it('says there is no further step from a denial, and offers the correction to somebody who may decide', async () => {
    mock.applicants.mockResolvedValue([applicant({ status: 'denied' })]);
    await render('admissions');
    await press('Open A-1001');
    expect(text()).toContain('No further step from here');
    expect(has('Record the next status')).toBe(false);
    expect(has('Record the correction')).toBe(true);
  });

  it('refuses a missing reason in the field, and asks the database nothing', async () => {
    await render('admissions');
    await press('Open A-1001');
    type(field('Next status'), 'admitted');
    await press('Record the status');
    expect(text()).toContain('Say why');
    expect(mock.record).not.toHaveBeenCalled();
  });

  it('refuses a social security number or a card number in the reason, and asks the database nothing', async () => {
    await render('admissions');
    await press('Open A-1001');
    type(field('Reason'), 'The applicant read out 123-45-6789 on the phone');
    await press('Record the status');
    expect(text()).toContain('looks like a social security number');
    type(field('Reason'), 'Fee paid with 4111 1111 1111 1111');
    await press('Record the status');
    expect(text()).toContain('looks like a card number');
    expect(mock.record).not.toHaveBeenCalled();
  });

  it('sends the chosen status, the reason and a key, and says it was recorded', async () => {
    await render('admissions');
    await press('Open A-1001');
    type(field('Next status'), 'admitted');
    type(field('Reason'), 'Admitted by the committee');
    await press('Record the status');
    expect(mock.record).toHaveBeenCalledTimes(1);
    expect(mock.record.mock.calls[0].slice(0, 3)).toEqual(['a1', 'admitted', 'Admitted by the committee']);
    expect(mock.record.mock.calls[0][3]).toMatch(/\S{8,}/);
    expect(text()).toContain('Recorded: Admitted.');
  });

  it('keeps one key across a lost reply, and a new key once the server has answered', async () => {
    mock.record.mockRejectedValueOnce(new ServiceError('Failed to fetch', false));
    await render('admissions');
    await press('Open A-1001');
    type(field('Next status'), 'denied');
    type(field('Reason'), 'Denied by the committee');
    await press('Record the status');
    expect(text()).toContain('Try again');
    const first = mock.record.mock.calls[0][3];
    await press('Try again');
    expect(mock.record).toHaveBeenCalledTimes(2);
    expect(mock.record.mock.calls[1][3]).toBe(first);
    type(field('Reason'), 'Denied again');
    await press('Record the status');
    expect(mock.record.mock.calls[2][3]).not.toBe(first);
  });

  it('shows a refusal as the server’s own sentence', async () => {
    mock.record.mockRejectedValueOnce(new ServiceError('That needs admissions:decide at your school.', true));
    await render('admissions');
    await press('Open A-1001');
    type(field('Next status'), 'admitted');
    type(field('Reason'), 'Admitted by the committee');
    await press('Record the status');
    expect(text()).toContain('That needs admissions:decide at your school.');
  });
});

describe('adding an applicant and linking one to a student reference', () => {
  it('refuses an applicant reference of nine digits in the field, and asks the database nothing', async () => {
    await render('admissions');
    type(field('Cycle'), 'Fall 2027');
    type(field('Applicant reference'), '123456789');
    type(field('Program applied to'), 'History, B.A.');
    type(field('How it arrived'), 'Received through the portal');
    await press('Add the applicant');
    expect(text()).toContain('looks like a social security number');
    expect(mock.add).not.toHaveBeenCalled();
  });

  it('adds an applicant with the school’s own reference', async () => {
    await render('admissions');
    type(field('Cycle'), 'Fall 2027');
    type(field('Applicant reference'), 'A-5001');
    type(field('Program applied to'), 'History, B.A.');
    type(field('How it arrived'), 'Received through the portal');
    await press('Add the applicant');
    expect(mock.add.mock.calls[0].slice(0, 4)).toEqual(['Fall 2027', 'A-5001', 'History, B.A.', 'Received through the portal']);
    expect(text()).toContain('The applicant was added as submitted.');
  });

  it('offers the link only to the registrar, only for an admitted applicant who has none, and says no student is created', async () => {
    mock.applicants.mockResolvedValue([applicant({ status: 'admitted' })]);
    await render('admissions');
    await press('Open A-1001');
    expect(text()).toContain('Semester never creates a student');
    type(field('Student reference'), 'S 100');
    await press('Link the applicant');
    expect(mock.link).not.toHaveBeenCalled();
    type(field('Student reference'), 'S100');
    await press('Link the applicant');
    expect(mock.link.mock.calls[0].slice(0, 2)).toEqual(['a1', 'S100']);

    // Once linked, the form is gone and the file says to whom.
    mock.links.mockResolvedValue([{ applicantId: 'a1', studentRef: 'S100', linkedAt: 't' } satisfies ApplicantLink]);
    await act(async () => root.unmount());
    root = createRoot(host);
    await render('admissions');
    await press('Open A-1001');
    expect(text()).toContain('Linked to student reference S100.');
    expect(has('Link the applicant')).toBe(false);
  });

  it('does not offer the link to somebody who may only decide or read', async () => {
    mock.caps.mockResolvedValue(['admissions:read', 'admissions:decide'].map(grant));
    mock.applicants.mockResolvedValue([applicant({ status: 'admitted' })]);
    await render('admissions');
    await press('Open A-1001');
    expect(has('Link the applicant')).toBe(false);
    expect(has('Add the applicant')).toBe(false);
  });
});

// ── Financial aid ────────────────────────────────────────────────────────

describe('aid, when the school has not switched the module to Core', () => {
  it('says so in one sentence and reads nothing', async () => {
    mock.modes = [{ module: 'admissions', mode: 'core', frozen: false, killed: false }];
    await render('aid');
    expect(text()).toContain('has not switched this to Semester Core');
    expect(mock.caps).not.toHaveBeenCalled();
    expect(mock.awards).not.toHaveBeenCalled();
  });
});

describe('a student’s own aid', () => {
  beforeEach(() => {
    mock.user = 'ana-0001-aaaa';
    mock.caps.mockResolvedValue([]);
  });

  it('shows their own awards and what has been paid out, and nothing from the history or an applicant file', async () => {
    mock.disbursements.mockResolvedValue([paid(), paid({ id: 'd2', amountCents: 5000, ledgerEntryId: 'e1' })]);
    await render('aid');
    expect(mock.myRef).toHaveBeenCalledWith('ana-0001-aaaa');
    expect(mock.awards).toHaveBeenCalledWith('S100');
    expect(text()).toContain('Merit Grant');
    expect(text()).toContain('$400.00');
    expect(text()).toContain('$150.00 of $400.00 has been paid out; $250.00 is still to come.');
    expect(text()).toContain('Not yet matched to an aid credit on your student account.');
    expect(text()).toContain('Matched to the aid credit on your student account.');
    expect(mock.awardHistory).not.toHaveBeenCalled();
    expect(mock.applicants).not.toHaveBeenCalled();
    expect(buttons()).toHaveLength(0);
    expect(host.querySelector('input')).toBeNull();
    expect(text()).not.toMatch(BANNED);
  });

  it('says plainly when nothing has been recorded, or the account is not linked to a record', async () => {
    mock.awards.mockResolvedValue([]);
    await render('aid');
    expect(text()).toContain('Your school has recorded no aid award for you');
    mock.myRef.mockResolvedValue(null);
    await act(async () => root.unmount());
    root = createRoot(host);
    await render('aid');
    expect(text()).toContain('has not linked your account to its academic record');
    expect(mock.awards).toHaveBeenCalledTimes(1);
  });
});

describe('staff reading and recording aid', () => {
  beforeEach(() => {
    mock.caps.mockResolvedValue(AID_OFFICER);
  });

  it('reads one student’s awards by reference, and opens one with its history and disbursements', async () => {
    await render('aid');
    expect(mock.awards).not.toHaveBeenCalled();
    type(field('Student reference'), ' ');
    await press('Show this student’s awards');
    expect(text()).toContain('Give the student reference');
    type(field('Student reference'), 'S100');
    await press('Show this student’s awards');
    expect(mock.awards).toHaveBeenCalledWith('S100');
    await press('Open Merit Grant');
    expect(mock.awardHistory).toHaveBeenCalledWith('w1');
    expect(text()).toContain('Reason: Offered by the aid office');
    expect(text()).toContain('$100.00 disbursed, $300.00 not yet.');
    expect(text()).toContain('Not linked to a student-account entry.');
    expect(text()).not.toMatch(BANNED);
  });

  it('refuses a fund name that is an SSN and an amount that is not money, asking the database nothing', async () => {
    await render('aid');
    type(field('Student reference'), 'S100');
    await press('Show this student’s awards');
    type(field('Aid year'), '2026-2028');
    type(field('Fund'), 'Fund 123-45-6789');
    type(field('Amount in dollars'), 'lots');
    type(field('Reason'), 'Offered');
    await press('Record the award');
    expect(text()).toContain('two consecutive years');
    expect(text()).toContain('looks like a social security number');
    expect(text()).toContain('Type an amount in dollars');
    expect(mock.recordAward).not.toHaveBeenCalled();
  });

  it('records an award in whole cents', async () => {
    await render('aid');
    type(field('Student reference'), 'S100');
    await press('Show this student’s awards');
    type(field('Aid year'), '2026-2027');
    type(field('Fund'), 'Dean’s Scholarship');
    type(field('Type'), 'scholarship');
    type(field('Amount in dollars'), '1,250.50');
    type(field('Reason'), 'Offered by the aid office');
    await press('Record the award');
    expect(mock.recordAward.mock.calls[0].slice(0, 6)).toEqual(['S100', '2026-2027', 'Dean’s Scholarship', 'scholarship', 125050, 'Offered by the aid office']);
    expect(text()).toContain('The award was recorded as offered.');
  });

  it('offers a disbursement only against an accepted award, never for more than is left, and says no money moves', async () => {
    await render('aid');
    type(field('Student reference'), 'S100');
    await press('Show this student’s awards');
    await press('Open Merit Grant');
    expect(text()).toContain('No money moves here');
    type(field('Amount paid out, in dollars'), '400');
    await press('Record the disbursement');
    expect(text()).toContain('At most $300.00 of this award is left');
    expect(mock.disburse).not.toHaveBeenCalled();
    type(field('Amount paid out, in dollars'), '300');
    type(field('Student-account aid credit'), 'not an id');
    await press('Record the disbursement');
    expect(mock.disburse).not.toHaveBeenCalled();
    type(field('Student-account aid credit'), '11111111-2222-3333-4444-555555555555');
    await press('Record the disbursement');
    expect(mock.disburse.mock.calls[0].slice(0, 4)).toEqual(['w1', 30000, expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/), '11111111-2222-3333-4444-555555555555']);
    expect(text()).toContain('Nothing was written to the student account.');
  });

  it('does not offer a disbursement for an award that has not been accepted', async () => {
    mock.awards.mockResolvedValue([award({ status: 'offered' })]);
    await render('aid');
    type(field('Student reference'), 'S100');
    await press('Show this student’s awards');
    await press('Open Merit Grant');
    expect(has('Record the disbursement')).toBe(false);
    expect(optionsOf('Next status')).toEqual(['Accepted', 'Declined', 'Cancelled']);
  });

  it('does not offer the approval to the aid officer, though a high award is waiting', async () => {
    mock.awards.mockResolvedValue([award({ highValue: true, status: 'offered' })]);
    await render('aid');
    type(field('Student reference'), 'S100');
    await press('Show this student’s awards');
    await press('Open Merit Grant');
    expect(text()).toContain('until a second person, never the one who recorded it, approves it');
    expect(has('Approve this award')).toBe(false);
  });
});

describe('the second person', () => {
  beforeEach(() => {
    mock.caps.mockResolvedValue(APPROVER);
    mock.awards.mockResolvedValue([award({ highValue: true, status: 'offered', amountCents: 250000 })]);
  });

  async function open() {
    await render('aid');
    type(field('Student reference'), 'S100');
    await press('Show this student’s awards');
    await press('Open Merit Grant');
  }

  it('offers the approval to somebody holding aid:approve_high, and no recording form', async () => {
    await open();
    expect(has('Approve this award')).toBe(true);
    expect(has('Record the award')).toBe(false);
    expect(has('Record the next status')).toBe(false);
    await press('Approve this award');
    expect(mock.approve.mock.calls[0].slice(0, 2)).toEqual(['w1', '']);
    expect(text()).toContain('Approved.');
  });

  it('shows the database’s refusal of the person who recorded the award as its own sentence', async () => {
    mock.approve.mockRejectedValueOnce(new ServiceError('The person who recorded an award does not approve it.', true));
    await open();
    await press('Approve this award');
    expect(text()).toContain('The person who recorded an award does not approve it.');
  });
});
