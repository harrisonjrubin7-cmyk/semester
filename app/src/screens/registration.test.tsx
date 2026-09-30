// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ServiceError } from '../lib/attempt';

/**
 * Enrollment, driven against a replaced account service.
 *
 * The gate is the real one (`lib/modulegate.ts`) over a fake database, so the
 * off, stopped and permission states are what the screen does with real
 * answers to `feature_state` and the kill-switch table. The registration
 * client's reads and writes are replaced, so what is under test is the
 * screen's reasoning: that it stops at the gate without reading anything,
 * that a hold names its office and never a reason, that the registrar's half
 * appears only with the capability, that a refusal is shown in words, and
 * that a retry after a lost reply carries the same idempotency key while a
 * new attempt carries a new one.
 */

const DAY = 86_400_000;
const now = Date.now();

const mock = vi.hoisted(() => ({
  configured: true,
  user: 'stu-1' as string | null,
  school: 'vu' as string | null,
  flag: 'production' as string,
  switches: [] as { switch_key: string; tenant_id: string | null; engaged: boolean }[],
  caps: vi.fn(),
  terms: vi.fn(),
  sections: vi.fn(),
  mine: vi.fn(),
  hold: vi.fn(),
  enroll: vi.fn(),
  drop: vi.fn(),
  withdraw: vi.fn(),
  pending: vi.fn(),
  decide: vi.fn(),
  override: vi.fn(),
  dispatch: vi.fn(),
  say: vi.fn(),
  cart: [] as unknown[],
}));

function table(name: string) {
  const self: Record<string, unknown> = {};
  self.select = () => self;
  self.eq = () => self;
  self.maybeSingle = async () => ({ data: name === 'profiles' && mock.school ? { school_id: mock.school } : null, error: null });
  self.then = (ok: (r: unknown) => unknown) => Promise.resolve({ data: name === 'feature_kill_switch' ? mock.switches : [], error: null }).then(ok);
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
vi.mock('../lib/capabilities', async (orig) => ({ ...(await orig<object>()), loadMyCapabilitiesOrThrow: mock.caps }));
vi.mock('../lib/registration-plan', () => ({ useRegistrationPlan: () => ({ cart: mock.cart }) }));
vi.mock('../lib/enrollment/client', async (orig) => ({
  ...(await orig<object>()),
  loadTerms: mock.terms,
  loadSections: mock.sections,
  loadMyRegistration: mock.mine,
  loadMyHold: mock.hold,
  enroll: mock.enroll,
  drop: mock.drop,
  withdraw: mock.withdraw,
  loadPending: mock.pending,
  decide: mock.decide,
  grantOverride: mock.override,
}));

import { Registration } from './Registration';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let host: HTMLDivElement;
let root: Root;

const TERM = {
  term: '2026FA',
  opensAt: new Date(now - 30 * DAY).toISOString(),
  addDropEndsAt: new Date(now + 10 * DAY).toISOString(),
  withdrawEndsAt: new Date(now + 60 * DAY).toISOString(),
  maxCredits: 18,
};

const sec = (patch: Record<string, unknown> = {}) => ({
  id: 's-econ',
  term: '2026FA',
  courseCode: 'ECON 1020',
  section: '01',
  title: 'Principles of Economics',
  credits: 3,
  capacity: 30,
  waitlistCapacity: 5,
  seatsTaken: 12,
  waiting: 0,
  meetings: [{ days: [1, 3], start: 540, end: 590 }],
  prerequisites: [],
  requiresApproval: false,
  version: 3,
  ...patch,
});

const SECTIONS = [
  sec(),
  sec({ id: 's-hist', courseCode: 'HIST 1100', title: 'World History', seatsTaken: 40, capacity: 40, waiting: 1, meetings: [{ days: [2, 4], start: 600, end: 675 }] }),
  sec({ id: 's-math', courseCode: 'MATH 1300', title: 'Calculus', meetings: [{ days: [5], start: 540, end: 590 }] }),
];

const MINE = [
  { enrollmentId: 'e-1', sectionId: 's-math', courseCode: 'MATH 1300', section: '01', state: 'enrolled', grade: null, waitPosition: null },
  { enrollmentId: 'e-2', sectionId: 's-hist', courseCode: 'HIST 1100', section: '01', state: 'waitlisted', grade: null, waitPosition: 2 },
];

const answer = (patch: Record<string, unknown> = {}) => ({
  ok: true,
  outcome: 'enrolled',
  reason: 'ok',
  message: 'Enrolled in ECON 1020 01.',
  serverMessage: 'Enrolled in ECON 1020 01.',
  replayed: false,
  promoted: 0,
  waitPosition: null,
  seatsTaken: 13,
  capacity: 30,
  hold: null,
  ...patch,
});

beforeEach(() => {
  vi.resetAllMocks();
  mock.configured = true;
  mock.user = 'stu-1';
  mock.school = 'vu';
  mock.flag = 'production';
  mock.switches = [];
  mock.cart = [];
  mock.caps.mockResolvedValue([]);
  mock.terms.mockResolvedValue([TERM]);
  mock.sections.mockResolvedValue(SECTIONS);
  mock.mine.mockResolvedValue(MINE);
  mock.hold.mockResolvedValue({ held: false, office: '', link: '' });
  mock.enroll.mockResolvedValue(answer());
  mock.pending.mockResolvedValue([]);
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
    root.render(<Registration />);
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

describe('when the school has not turned it on', () => {
  it('says so in one sentence, reads nothing, and offers the plan', async () => {
    mock.flag = 'off';
    await render();
    expect(text()).toContain('Your school has not turned on registration in Semester');
    expect(mock.terms).not.toHaveBeenCalled();
    expect(mock.sections).not.toHaveBeenCalled();
    await press('Open your registration plan');
    expect(mock.dispatch).toHaveBeenCalledWith({ type: 'go', screen: 'yes' });
  });

  it('says the same with no account service at all — the state every dev build is in', async () => {
    mock.configured = false;
    await render();
    expect(text()).toContain('Your school has not turned on registration in Semester');
  });

  it('counts anything short of production as off', async () => {
    mock.flag = 'preview';
    await render();
    expect(text()).toContain('has not turned on registration');
  });

  it('says it is paused, and by which switch, when a kill switch is engaged', async () => {
    mock.switches = [{ switch_key: 'kill.writeback', tenant_id: null, engaged: true }];
    await render();
    expect(host.querySelector('[role="alert"]')?.textContent).toMatch(/paused registration.*kill\.writeback/);
    expect(mock.sections).not.toHaveBeenCalled();
  });
});

describe('who may see it', () => {
  it('asks a signed-out person to sign in, and names why', async () => {
    mock.user = null;
    await render();
    expect(text()).toContain('Sign in with your school account to use registration');
    await press('Open your account');
    expect(mock.dispatch).toHaveBeenCalledWith({ type: 'go', screen: 'account' });
  });

  it('asks an account with no school to choose one, and says the school decides', async () => {
    mock.school = null;
    await render();
    expect(text()).toMatch(/not linked to a school yet.*your school decides whether registration is turned on/);
  });

  it('offers the registrar’s half only to registration:administer at this school', async () => {
    await render();
    expect(host.querySelector('[role="tablist"]')).toBeNull();
    await act(async () => root.unmount());
    root = createRoot(host);
    mock.caps.mockResolvedValue([{ capability: 'registration:administer', scopeKind: 'school', scopeId: 'other' }]);
    await render();
    expect(host.querySelector('[role="tablist"]')).toBeNull();
    await act(async () => root.unmount());
    root = createRoot(host);
    mock.caps.mockResolvedValue([{ capability: 'registration:administer', scopeKind: 'school', scopeId: 'vu' }]);
    mock.pending.mockResolvedValue([{ enrollmentId: 'e-9', student: 'stu-2-abcdef', sectionId: 's-econ', courseCode: 'ECON 1020', section: '01', title: 'Principles of Economics', term: '2026FA', requestedAt: TERM.opensAt }]);
    await render();
    const tab = [...host.querySelectorAll('[role="tab"]')].find((t) => t.textContent === 'Registrar') as HTMLElement;
    expect(tab).toBeTruthy();
    await act(async () => tab.click());
    await flush();
    expect(mock.pending).toHaveBeenCalledWith('2026FA');
    expect(text()).toContain('Requests waiting for approval');
    expect(text()).toContain('Student account stu-2-ab…');
    expect(buttons().filter((b) => b.classList.contains('btn-primary')).map((b) => b.textContent)).toEqual(['Grant override']);
  });

  it('says so when the permission check fails, keeps the student’s half, and checks again on request', async () => {
    mock.caps.mockRejectedValueOnce(new Error('Could not reach your school’s account service.'));
    await render();
    expect(text()).toContain('Could not reach your school’s account service.');
    expect(text()).toContain('registrar’s office, its views stay hidden until this loads');
    expect(host.querySelector('[role="tablist"]')).toBeNull();
    expect(text()).toContain('ECON 1020');
    mock.caps.mockResolvedValue([{ capability: 'registration:administer', scopeKind: 'school', scopeId: 'vu' }]);
    await press('Check again');
    expect(mock.caps).toHaveBeenCalledTimes(2);
    expect([...host.querySelectorAll('[role="tab"]')].map((t) => t.textContent)).toContain('Registrar');
    expect(text()).not.toContain('Could not reach your school’s account service.');
  });

  it('says the section list did not load rather than showing a term with none, and loads it again', async () => {
    mock.caps.mockResolvedValue([{ capability: 'registration:administer', scopeKind: 'school', scopeId: 'vu' }]);
    await render();
    mock.sections.mockRejectedValueOnce(new Error('Could not load the sections.'));
    const tab = [...host.querySelectorAll('[role="tab"]')].find((t) => t.textContent === 'Registrar') as HTMLElement;
    await act(async () => tab.click());
    await flush();
    expect(text()).toContain('The section list below is empty because it did not load');
    await press('Load the sections again');
    expect(text()).not.toContain('did not load');
    expect(host.querySelector('select option[value="s-econ"]')).toBeTruthy();
  });
});

describe('a student’s term', () => {
  it('shows their courses, their place in line and the sections, beside their own plan', async () => {
    mock.cart = [{ id: 'c1', code: 'ECON 1020', section: '01', title: '', term: '', department: '', credits: 3, instructor: '', location: '', description: '', prerequisites: '', seats: null, meetings: [] }];
    await render();
    expect(mock.sections).toHaveBeenCalledWith('2026FA');
    expect(mock.mine).toHaveBeenCalledWith('2026FA');
    expect(text()).toContain('Add/drop is open until');
    expect(text()).toContain('On the waitlist — number 2 in line');
    expect(text()).toContain('In your plan');
    expect(text()).toContain('3 credits of 18');
    // Already in MATH and HIST: no Review for those, one for ECON.
    expect(buttons().map((b) => b.textContent)).toEqual(expect.arrayContaining(['Review ECON 1020 01', 'Drop MATH 1300 01', 'Leave the waitlist HIST 1100 01']));
    expect(buttons().some((b) => b.textContent === 'Review MATH 1300 01')).toBe(false);
    // No primary until something is being confirmed.
    expect(host.querySelectorAll('.btn-primary')).toHaveLength(0);
  });

  it('names the hold’s office and link, and never a reason', async () => {
    mock.hold.mockResolvedValue({ held: true, office: 'Student Accounts', link: 'https://accounts.example.edu' });
    await render();
    const alert = host.querySelector('[role="alert"]');
    expect(alert?.textContent).toMatch(/hold on your account stops you adding courses\. Student Accounts can clear it/);
    const link = alert?.querySelector('a');
    expect(link?.getAttribute('href')).toBe('https://accounts.example.edu');
    expect(link?.getAttribute('target')).toBe('_blank');
    expect(link?.textContent).toMatch(/opens outside Semester/);
  });

  it('says so when there is nothing yet', async () => {
    mock.mine.mockResolvedValue([]);
    mock.sections.mockResolvedValue([]);
    await render();
    expect(text()).toContain('Nothing yet this term');
    expect(text()).toContain('No sections yet');
  });

  it('says so when no term is open', async () => {
    mock.terms.mockResolvedValue([]);
    await render();
    expect(text()).toContain('No registration term yet');
  });
});

describe('enrolling', () => {
  it('reviews first, then sends what the review expected', async () => {
    await render();
    await press('Review ECON 1020 01');
    expect(text()).toContain('There is a seat (12 of 30 taken). Confirming enrolls you now.');
    expect(document.activeElement?.textContent).toBe('Review before you enroll');
    await press('Confirm enrollment');
    expect(mock.enroll).toHaveBeenCalledTimes(1);
    const [section, key, expectSeat, where] = mock.enroll.mock.calls[0];
    expect([section, expectSeat, where]).toEqual(['s-econ', 'seat', 'ECON 1020 01']);
    expect(key).toMatch(/^[A-Za-z0-9:._-]{8,128}$/);
    expect(mock.say).toHaveBeenCalledWith('Enrolled in ECON 1020 01.');
    // Read again after the write, so the seat count is the committed one.
    expect(mock.sections).toHaveBeenCalledTimes(2);
  });

  it('keeps the key across a retry after a lost reply, and makes a new one for the next attempt', async () => {
    mock.enroll
      .mockRejectedValueOnce(new ServiceError('The enrollment was not sent. The connection to your school’s service did not answer, so it is not known whether the change was made.', false))
      .mockResolvedValueOnce(answer({ replayed: true }))
      .mockResolvedValueOnce(answer({ ok: false, outcome: 'refused', reason: 'already_enrolled', message: 'You are already enrolled in ECON 1020 01.' }));
    await render();
    await press('Review ECON 1020 01');
    await press('Confirm enrollment');
    expect(host.querySelector('[role="alert"]')?.textContent).toMatch(/not known whether the change was made/);
    await press('Try again');
    expect(mock.enroll).toHaveBeenCalledTimes(2);
    const first = mock.enroll.mock.calls[0][1];
    const retry = mock.enroll.mock.calls[1][1];
    expect(retry).toBe(first);
    expect(text()).toContain('Already done — nothing was sent twice.');

    await press('Review ECON 1020 01');
    await press('Confirm enrollment');
    expect(mock.enroll.mock.calls[2][1]).not.toBe(first);
  });

  it('shows a refusal in plain words and changes nothing on screen but the notice', async () => {
    mock.enroll.mockResolvedValue(answer({ ok: false, outcome: 'refused', reason: 'stale_seat_count', message: 'The seats in ECON 1020 01 changed since you last looked. Check the section again and confirm.' }));
    await render();
    await press('Review ECON 1020 01');
    await press('Confirm enrollment');
    expect(host.querySelector('[role="alert"]')?.textContent).toBe('The seats in ECON 1020 01 changed since you last looked. Check the section again and confirm.');
    expect(mock.say).not.toHaveBeenCalled();
  });

  it('offers the waitlist, not a seat, when the section is full', async () => {
    mock.mine.mockResolvedValue([]);
    await render();
    await press('Review HIST 1100 01');
    expect(text()).toContain('Confirming puts you on the waitlist, number 2 in line');
    await press('Join the waitlist');
    expect(mock.enroll.mock.calls[0][2]).toBe('waitlist');
  });
});

describe('leaving', () => {
  it('asks before dropping, says what happens, and never styles it as the primary', async () => {
    mock.drop.mockResolvedValue(answer({ outcome: 'dropped', message: 'Dropped MATH 1300 01.' }));
    await render();
    await press('Drop MATH 1300 01');
    expect(text()).toContain('You lose your seat in MATH 1300 01, and the next person waiting may get it. No W is recorded.');
    expect(host.querySelectorAll('.btn-primary')).toHaveLength(0);
    await press('Drop — confirm');
    expect(mock.drop).toHaveBeenCalledWith('s-math', expect.stringMatching(/^drop:s-math\./), 'MATH 1300 01');
  });

  it('withdraws, with a W, once add/drop has ended', async () => {
    mock.terms.mockResolvedValue([{ ...TERM, addDropEndsAt: new Date(now - DAY).toISOString() }]);
    mock.withdraw.mockResolvedValue(answer({ outcome: 'withdrawn', message: 'Withdrew from MATH 1300 01. A W is recorded; the enrollment is kept.' }));
    await render();
    expect(text()).toContain('Add/drop has ended. You can withdraw until');
    await press('Withdraw MATH 1300 01');
    expect(text()).toContain('a W is recorded on your transcript');
    await press('Withdraw — confirm');
    expect(mock.withdraw).toHaveBeenCalledTimes(1);
  });
});

describe('when a read fails', () => {
  it('says what failed and what still works, and offers to load again', async () => {
    mock.sections.mockRejectedValueOnce(new ServiceError('Could not load this term’s sections.', true));
    await render();
    const alert = host.querySelector('[role="alert"]');
    expect(alert?.textContent).toMatch(/^Could not load this term’s sections\. Your plan on the Registration screen is still there\./);
    await press('Load again');
    expect(text()).toContain('Sections this term');
  });
});
