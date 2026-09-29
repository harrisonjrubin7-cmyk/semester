// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * The student account screen, driven against a replaced account service.
 *
 * Under test is what the screen decides between the database's answers: that
 * it stops at one sentence when the module is off or nobody is signed in,
 * that the offices' views appear only for the capabilities the database
 * reports, that every figure it draws is the ledger's own arithmetic with aid
 * kept in two figures, and that a payment which failed in flight is retried
 * with the same idempotency key — so the database recognises the retry
 * rather than starting a second payment.
 */

const mock = vi.hoisted(() => ({
  open: vi.fn(),
  load: vi.fn(),
  pay: vi.fn(),
  respond: vi.fn(),
  seen: vi.fn(),
  post: vi.fn(),
  say: vi.fn(),
  dispatch: vi.fn(),
}));

vi.mock('../state/store', () => ({
  useStore: () => ({ say: mock.say, dispatch: mock.dispatch, state: {} }),
  useNow: () => new Date('2026-09-29T15:00:00Z'),
}));
vi.mock('../lib/studentaccount/client', async (orig) => ({
  ...(await orig<object>()),
  openAccount: mock.open,
  loadAccount: mock.load,
  startPayment: mock.pay,
  respondToAward: mock.respond,
  loadStudentsSeen: mock.seen,
  postEntry: mock.post,
}));

import { StudentAccount } from './StudentAccount';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let host: HTMLDivElement;
let root: Root;

const ON = { on: true, reason: 'On.' };
const context = (patch: Record<string, unknown> = {}) => ({
  kind: 'ready',
  context: { userId: 'stu-1', school: 'vu', moduleState: 'production', settings: undefined, capabilities: [], decision: ON, ...patch },
});

const T = Date.parse('2026-08-20T12:00:00Z');
const entry = (id: string, kind: string, cents: number, what: string, extra: Record<string, unknown> = {}) => ({
  id, term: '2026FA', kind, cents, what, key: `k-${id}`, source: 'bursar', at: T, ...extra,
});

/** Tuition $10,000; a grant of $5,000 with $3,000 disbursed; a loan offered; $1,000 paid. */
const FIXTURE = {
  tenantId: 'vu',
  studentId: 'stu-1',
  entries: [
    entry('e1', 'charge', 1_000_000, 'Tuition, fall'),
    entry('e2', 'aid_disbursement', 300_000, 'Commodore Grant', { source: 'aid_adapter', awardId: 'a1' }),
    entry('e3', 'payment', 100_000, 'Payment through provider', { source: 'provider' }),
  ],
  awards: [
    { id: 'a1', term: '2026FA', externalRef: 'X1', kind: 'grant', what: 'Commodore Grant', offeredCents: 500_000, status: 'accepted', verification: 'complete', sap: 'meeting', sourceVersion: 2, syncedAt: T },
    { id: 'a2', term: '2026FA', externalRef: 'X2', kind: 'loan', what: 'Direct Loan', offeredCents: 400_000, status: 'offered', verification: 'complete', sap: 'meeting', sourceVersion: 1, syncedAt: T },
  ],
  holds: [],
  plans: [],
  intents: [],
  receipts: [],
};

beforeEach(() => {
  vi.clearAllMocks();
  mock.open.mockResolvedValue(context());
  mock.load.mockResolvedValue(FIXTURE);
  mock.pay.mockResolvedValue('intent-1');
  mock.respond.mockResolvedValue('accepted');
  mock.seen.mockResolvedValue([]);
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
  await act(async () => root.render(<StudentAccount />));
  await flush();
}

const buttons = () => [...host.querySelectorAll('button')];
function must(text: string): HTMLButtonElement {
  const b = buttons().find((x) => x.textContent?.trim() === text);
  if (!b) throw new Error(`No button “${text}”; have: ${buttons().map((x) => JSON.stringify(x.textContent?.trim())).join(', ')}`);
  return b;
}
async function press(text: string) {
  await act(async () => must(text).click());
  await flush();
}
function type(el: Element | null | undefined, value: string) {
  if (!el) throw new Error('No control to type into');
  act(() => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set?.call(el, value);
    el.dispatchEvent(new Event('input', { bubbles: true }));
  });
}
const field = (text: string) => [...host.querySelectorAll('label')].find((l) => l.textContent?.trim().startsWith(text))?.querySelector('input');

describe('the gate', () => {
  it('says in one sentence that the school has not turned it on, and reads no ledger', async () => {
    mock.open.mockResolvedValue(context({ moduleState: 'off', decision: { on: false, code: 'module_off', reason: 'off' } }));
    await render();
    expect(host.textContent).toContain('Your school has not turned on student accounts in Semester.');
    expect(host.textContent).toContain('Open your own statement on Money');
    expect(mock.load).not.toHaveBeenCalled();
  });

  it('says why when Semester’s own finance seat is empty, the state of every school on this tree', async () => {
    mock.open.mockResolvedValue(context({ decision: { on: false, code: 'finance_seat_vacant', reason: 'vacant' } }));
    await render();
    expect(host.textContent).toContain('not on at any school yet');
    expect(mock.load).not.toHaveBeenCalled();
  });

  it('shows the permission state when nobody is signed in: what, why, who controls it, what to do', async () => {
    mock.open.mockResolvedValue({ kind: 'signed_out' });
    await render();
    const said = host.querySelector('[role="status"]')?.textContent ?? '';
    expect(said).toContain('private to you and your school’s offices');
    expect(said).toContain('Sign in under You → Account');
    expect(mock.load).not.toHaveBeenCalled();
  });

  it('offers no office view to an account the database gives no office capability', async () => {
    await render();
    expect(host.querySelector('[role="tablist"]')).toBeNull();
    expect(host.textContent).not.toContain('Student accounts office');
    expect(mock.seen).not.toHaveBeenCalled();
  });

  it('offers the bursar’s view, first, only to bursar:post', async () => {
    mock.open.mockResolvedValue(context({ capabilities: ['bursar:post'] }));
    await render();
    const tabs = [...host.querySelectorAll('[role="tab"]')].map((t) => t.textContent);
    expect(tabs).toEqual(['Your account', 'Student accounts office']);
    expect(host.textContent).toContain('Post an entry');
    expect(mock.seen).toHaveBeenCalledTimes(1);
  });
});

describe('a populated account, from a fixture', () => {
  it('derives the balance from the entries and keeps anticipated and disbursed aid apart', async () => {
    await render();
    const text = host.textContent ?? '';
    // $10,000 charged, $3,000 aid and $1,000 paid: $6,000 owed.
    expect(text).toContain('You owe');
    expect(text).toContain('$6,000.00');
    expect(text).toMatch(/Disbursed to your account\s*\$3,000\.00/);
    // $5,000 accepted less $3,000 disbursed; the offered loan is not anticipated until accepted.
    expect(text).toMatch(/Anticipated — accepted, not disbursed, not money yet\s*\$2,000\.00/);
    expect(text).toContain('If every anticipated award lands, the balance would be$4,000.00');
    expect(text).toContain('These are your school’s figures');
    expect(host.querySelectorAll('[data-source="institution_verified"]').length).toBe(2);
    expect(text).toContain('No hold from Student Accounts.');
  });

  it('shows an empty account as empty, not as an error', async () => {
    mock.load.mockResolvedValue({ ...FIXTURE, entries: [], awards: [] });
    await render();
    expect(host.textContent).toContain('Nothing on your account yet');
  });

  it('accepts an offered award only after the confirmation, through respond_to_aid_award', async () => {
    await render();
    const accept = buttons().find((b) => b.getAttribute('aria-label') === 'Accept Direct Loan');
    await act(async () => accept?.click());
    await flush();
    expect(mock.respond).not.toHaveBeenCalled();
    expect(host.querySelector('[role="dialog"]')?.textContent).toContain('A loan is repaid later.');
    await press('Accept the award');
    expect(mock.respond).toHaveBeenCalledWith('a2', true);
  });
});

describe('starting a payment', () => {
  it('confirms first, and a retry after a failure in flight sends the same key', async () => {
    mock.pay.mockRejectedValueOnce(new Error('Your school’s account service did not answer. It may not have gone through; trying again is safe, because the retry is recognised as the same request.'));
    await render();
    type(field('Amount, in dollars'), '250');
    await press('Pay toward Fall 2026');
    expect(mock.pay).not.toHaveBeenCalled();
    expect(host.querySelector('[role="dialog"]')?.textContent).toContain('Nothing is charged in Semester');
    await press('Start the payment');
    expect(mock.pay).toHaveBeenCalledTimes(1);
    expect(host.textContent).toContain('trying again is safe');

    await press('Pay toward Fall 2026');
    await press('Start the payment');
    expect(mock.pay).toHaveBeenCalledTimes(2);
    const [first, second] = mock.pay.mock.calls;
    expect(first.slice(0, 2)).toEqual(['2026FA', 25_000]);
    expect(second[2]).toBe(first[2]);
    expect(mock.say).toHaveBeenCalledWith(expect.stringContaining('Payment of $250.00 started'));

    // Landed: the next payment is a new one, with a new key.
    await press('Pay toward Fall 2026');
    await press('Start the payment');
    expect(mock.pay.mock.calls[2][2]).not.toBe(first[2]);
  });

  it('refuses more than the term owes before asking anything', async () => {
    await render();
    type(field('Amount, in dollars'), '7000');
    await press('Pay toward Fall 2026');
    expect(host.querySelector('[role="dialog"]')).toBeNull();
    expect(host.textContent).toContain('no more than the $6,000.00 this term owes');
    expect(mock.pay).not.toHaveBeenCalled();
  });
});

describe('when a read fails', () => {
  it('says what failed and what still holds, and offers to try again', async () => {
    mock.open.mockRejectedValueOnce(new Error('Could not read whether your school has student accounts on.'));
    await render();
    const alert = host.querySelector('[role="alert"]')?.textContent ?? '';
    expect(alert).toContain('Could not read whether your school has student accounts on.');
    expect(alert).toContain('Nothing on your account was changed.');
    await press('Try again');
    expect(mock.open).toHaveBeenCalledTimes(2);
    expect(host.textContent).toContain('You owe');
  });

  it('never draws an empty ledger where the ledger could not be read', async () => {
    mock.load.mockRejectedValueOnce(new Error('Could not read the account.'));
    await render();
    expect(host.querySelector('[role="alert"]')?.textContent).toContain('Could not read the account.');
    expect(host.textContent).not.toContain('Nothing on your account yet');
  });
});
