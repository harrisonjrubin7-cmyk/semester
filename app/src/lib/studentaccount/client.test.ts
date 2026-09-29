import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * The student account client's contract with
 * `20260929320000_student_accounts.sql`: which RPC, which argument names,
 * which columns become which fields, and that a refusal is thrown in plain
 * words rather than rendered as an empty ledger.
 *
 * The account service is replaced by a recorder: each call is a chain whose
 * every method returns itself and which resolves to the reply set for it.
 */

interface Reply {
  data?: unknown;
  error?: { message: string } | null;
}

const calls: { kind: 'rpc' | 'from'; name: string; args?: unknown; chain: string[] }[] = [];
const replies = new Map<string, Reply>();
const who = vi.hoisted(() => ({ user: 'stu-1' as string | null, school: 'vu', grants: [] as { capability: string; scopeKind: string; scopeId: string }[] }));

function chain(kind: 'rpc' | 'from', name: string, args?: unknown) {
  const call = { kind, name, args, chain: [] as string[] };
  calls.push(call);
  const reply = () => replies.get(`${kind}:${name}`) ?? { data: null, error: null };
  const self: Record<string, unknown> = {
    then: (ok: (r: Reply) => unknown, bad?: (e: unknown) => unknown) => Promise.resolve(reply()).then(ok, bad),
  };
  for (const m of ['select', 'order', 'eq', 'limit', 'gte']) {
    self[m] = (...a: unknown[]) => {
      call.chain.push(`${m}(${a.map((x) => JSON.stringify(x)).join(',')})`);
      return self;
    };
  }
  return self;
}

vi.mock('../cloud', () => ({
  cloudConfigured: true,
  cloud: async () => ({
    auth: { getUser: async () => ({ data: { user: who.user ? { id: who.user } : null } }) },
    rpc: (name: string, args?: unknown) => chain('rpc', name, args),
    from: (name: string) => chain('from', name),
  }),
}));
vi.mock('../schoolclaim', () => ({ claimedSchoolOrThrow: async () => who.school }));
vi.mock('../capabilities', async (orig) => ({ ...(await orig<object>()), loadMyCapabilities: async () => who.grants }));

import {
  cents,
  createPlan,
  loadAccount,
  openAccount,
  placeHold,
  plainError,
  postEntry,
  readCents,
  recordDisbursement,
  refundCredit,
  releaseHold,
  respondToAward,
  reverseEntry,
  screenGate,
  startPayment,
} from './client';

beforeEach(() => {
  calls.length = 0;
  replies.clear();
  who.user = 'stu-1';
  who.school = 'vu';
  who.grants = [];
});

describe('money', () => {
  it('formats integer cents for the locale and reads typed dollars back to integer cents', () => {
    expect(cents(1_234_567)).toBe('$12,345.67');
    expect(readCents('$1,250.5')).toBe(125_050);
    expect(readCents('12.345')).toBeNull();
    expect(readCents('-4')).toBeNull();
    expect(readCents('')).toBeNull();
  });
});

describe('the gate', () => {
  it('is off when the module is off, whoever asks', () => {
    expect(screenGate('off', undefined, 'someone')).toMatchObject({ on: false, code: 'module_off' });
  });

  it('is off while Semester’s council finance seat is vacant, which it is on this tree', () => {
    expect(screenGate('production', undefined)).toMatchObject({ on: false, code: 'finance_seat_vacant' });
  });

  it('leaves the finance owner to the database for a student, and holds an office to it', () => {
    expect(screenGate('production', undefined, 'A. Holder')).toMatchObject({ on: true });
    const settings = { financeOwner: null, thresholdCents: 0, graceDays: 10, updatedAt: 0 };
    expect(screenGate('production', settings, 'A. Holder')).toMatchObject({ on: false, code: 'no_finance_owner' });
    expect(screenGate('production', { ...settings, financeOwner: 'u-9' }, 'A. Holder')).toMatchObject({ on: true });
  });

  it('asks feature_state for module.student_accounts at the caller’s school, and reads grants over that school', async () => {
    replies.set('rpc:feature_state', { data: 'production' });
    who.grants = [
      { capability: 'bursar:post', scopeKind: 'school', scopeId: 'vu' },
      { capability: 'aid:manage', scopeKind: 'school', scopeId: 'elsewhere' },
    ];
    replies.set('from:student_account_settings', { data: [{ finance_owner: 'u-9', hold_threshold_cents: 5000, late_grace_days: 14, updated_at: '2026-09-01T00:00:00Z' }] });
    const opening = await openAccount();
    expect(calls.find((c) => c.name === 'feature_state')?.args).toEqual({ want_capability: 'module.student_accounts', want_tenant: 'vu' });
    expect(opening.kind).toBe('ready');
    if (opening.kind !== 'ready') return;
    expect(opening.context.capabilities).toEqual(['bursar:post']);
    expect(opening.context.settings).toEqual({ financeOwner: 'u-9', thresholdCents: 5000, graceDays: 14, updatedAt: Date.parse('2026-09-01T00:00:00Z') });
  });

  it('gives a student no settings, rather than settings saying nobody owns the module', async () => {
    replies.set('rpc:feature_state', { data: 'production' });
    const opening = await openAccount();
    expect(opening.kind === 'ready' && opening.context.settings).toBeUndefined();
  });

  it('throws when the module state cannot be read: a dropped request is not "off"', async () => {
    replies.set('rpc:feature_state', { error: { message: 'Failed to fetch' } });
    await expect(openAccount()).rejects.toThrow('did not answer');
  });

  it('answers signed out and no school without reading anything else', async () => {
    who.user = null;
    expect(await openAccount()).toEqual({ kind: 'signed_out' });
    who.user = 'stu-1';
    who.school = '';
    expect(await openAccount()).toEqual({ kind: 'no_school' });
    expect(calls.filter((c) => c.name === 'feature_state')).toEqual([]);
  });
});

describe('reading an account', () => {
  it('reads the five tables for one student and maps their columns', async () => {
    replies.set('from:student_ledger_entries', {
      data: [{ id: 'e1', term: '2026FA', kind: 'reversal', cents: 500, what: 'Reverses fee', idempotency_key: 'k', source: 'bursar', aid_award_id: null, reverses: 'e0', posted_at: '2026-09-01T00:00:00Z' }],
    });
    replies.set('from:student_aid_awards', {
      data: [{ id: 'a1', term: '2026FA', external_ref: 'X', kind: 'loan', what: 'Loan', offered_cents: '400000', status: 'offered', verification: 'complete', sap: 'meeting', source_version: 3, decided_at: null, synced_at: '2026-09-02T00:00:00Z' }],
    });
    replies.set('from:student_payment_plans', { data: [{ id: 'p1', term: '2026FA', total_cents: 900, parts: 3, first_due: '2026-10-01', every_months: 1, idempotency_key: 'pk', created_at: '2026-09-03T00:00:00Z', cancelled_at: null }] });
    const a = await loadAccount('stu-1', 'vu');
    const reads = calls.filter((c) => c.kind === 'from').map((c) => [c.name, c.chain.find((x) => x.startsWith('eq'))]);
    expect(reads).toEqual([
      ['student_ledger_entries', 'eq("student_id","stu-1")'],
      ['student_aid_awards', 'eq("student_id","stu-1")'],
      ['student_account_holds', 'eq("student_id","stu-1")'],
      ['student_payment_plans', 'eq("student_id","stu-1")'],
      ['student_payment_intents', 'eq("student_id","stu-1")'],
    ]);
    expect(a.entries[0]).toMatchObject({ kind: 'reversal', cents: 500, reverses: 'e0', awardId: undefined, at: Date.parse('2026-09-01T00:00:00Z') });
    expect(a.awards[0]).toMatchObject({ kind: 'loan', offeredCents: 400_000, status: 'offered', sourceVersion: 3, syncedAt: Date.parse('2026-09-02T00:00:00Z') });
    expect(a.plans[0]).toMatchObject({ first: '2026-10-01', parts: 3, everyMonths: 1, cancelledAt: undefined });
  });

  it('throws on a refused read instead of returning an empty ledger', async () => {
    replies.set('from:student_account_holds', { error: { message: 'permission denied for table student_account_holds' } });
    await expect(loadAccount('stu-1', 'vu')).rejects.toThrow('Permission denied for table student_account_holds.');
  });
});

describe('writes', () => {
  it('sends each RPC its argument names, with the key given', async () => {
    replies.set('rpc:respond_to_aid_award', { data: 'accepted' });
    expect(await respondToAward('a1', true)).toBe('accepted');
    await startPayment('2026FA', 25_000, 'key-1');
    await postEntry('stu-2', '2026FA', 'charge', 100, 'Lab fee', 'key-2');
    await reverseEntry('e1', null, 'Reverses Lab fee', 'key-3');
    await refundCredit('stu-2', '2026FA', 300, 'key-4');
    await placeHold('stu-2', 'Balance over threshold');
    await releaseHold('h1', 'Paid');
    await createPlan('stu-2', '2026FA', 4, '2026-10-01', 1, 'key-5');
    await recordDisbursement('a1', 2000, 'key-6');
    expect(calls.map((c) => [c.name, c.args])).toEqual([
      ['respond_to_aid_award', { want_award: 'a1', want_accept: true }],
      ['start_student_payment', { want_term: '2026FA', want_cents: 25_000, want_key: 'key-1' }],
      ['post_student_ledger_entry', { want_student: 'stu-2', want_term: '2026FA', want_kind: 'charge', want_cents: 100, want_what: 'Lab fee', want_key: 'key-2' }],
      ['reverse_student_ledger_entry', { want_entry: 'e1', want_cents: null, want_what: 'Reverses Lab fee', want_key: 'key-3' }],
      ['refund_student_credit', { want_student: 'stu-2', want_term: '2026FA', want_cents: 300, want_key: 'key-4' }],
      ['place_student_hold', { want_student: 'stu-2', want_reason: 'Balance over threshold' }],
      ['release_student_hold', { want_hold: 'h1', want_reason: 'Paid' }],
      ['create_student_payment_plan', { want_student: 'stu-2', want_term: '2026FA', want_parts: 4, want_first: '2026-10-01', want_every_months: 1, want_key: 'key-5' }],
      ['record_aid_disbursement', { want_award: 'a1', want_cents: 2000, want_key: 'key-6' }],
    ]);
  });

  it('maps the server’s refusals to plain words', async () => {
    replies.set('rpc:start_student_payment', { error: { message: 'semester: 2026FA owes 600000 cents; a payment is more than nothing and no more than that' } });
    await expect(startPayment('2026FA', 1, 'k')).rejects.toThrow('A payment has to be more than nothing and no more than this term owes.');
    expect(plainError('semester: that needs bursar:post at your school', 'x')).toBe(
      'Your account does not hold the permission this needs at your school, so nothing was changed.',
    );
    expect(plainError('semester: something new', 'x')).toBe('Something new.');
    expect(plainError('', 'The fallback.')).toBe('The fallback.');
  });
});
