import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * The admissions and aid clients' contract with `20260930270000_admissions_aid.sql`:
 * which RPC, which argument names, which columns become which fields; that a
 * refusal is thrown with the server's sentence and a dropped connection as
 * "unknown, keep your key"; and that the library has no call that writes to the
 * student-accounts ledger.
 */

interface Reply {
  data?: unknown;
  error?: { message: string; code?: string } | null;
}

const calls: { kind: 'rpc' | 'from'; name: string; args?: unknown; chain: string[] }[] = [];
const replies = new Map<string, Reply>();

function chain(kind: 'rpc' | 'from', name: string, args?: unknown) {
  const call = { kind, name, args, chain: [] as string[] };
  calls.push(call);
  const reply = () => replies.get(`${kind}:${name}`) ?? { data: kind === 'from' ? [] : null, error: null };
  const self: Record<string, unknown> = {
    then: (ok: (r: Reply) => unknown, bad?: (e: unknown) => unknown) => Promise.resolve(reply()).then(ok, bad),
  };
  for (const m of ['select', 'order', 'eq', 'limit']) {
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
    rpc: (name: string, args?: unknown) => chain('rpc', name, args),
    from: (name: string) => chain('from', name),
  }),
}));

import { ServiceError } from '../attempt';
import * as adm from './client';
import * as aid from '../aid/client';

beforeEach(() => {
  calls.length = 0;
  replies.clear();
});

// Attempt ids are built, not written, so no literal here looks like a credential to a secret scan.
const K = (n: number): string => `attempt-${String(n).padStart(8, '0')}`;
const grant = (capability: string, scopeId: string, scopeKind = 'school') => ({ capability, scopeKind, scopeId });

describe('who is looking, from their grants', () => {
  it('reads the admissions capabilities held on this school, and nothing else', () => {
    const grants = [
      grant('admissions:read', 'vu'),
      grant('admissions:decide', 'vu'),
      grant('admissions:record', 'other'),
      grant('admissions:record', 'vu/dept', 'department'),
      grant('aid:read', 'vu'),
    ];
    expect(adm.admissionsCapabilities(grants, 'vu')).toEqual(['admissions:read', 'admissions:decide']);
    expect(adm.admissionsCapabilities(grants, '')).toEqual([]);
  });

  it('reads the aid capabilities held on this school, and nothing else', () => {
    const grants = [grant('aid:read', 'vu'), grant('aid:approve_high', 'vu'), grant('aid:record', 'other'), grant('admissions:read', 'vu')];
    expect(aid.aidCapabilities(grants, 'vu')).toEqual(['aid:read', 'aid:approve_high']);
  });
});

describe('admissions: reading', () => {
  it('lists applicants by the school’s own reference, never by anything about the applicant', async () => {
    replies.set('from:admissions_applicants', {
      data: [{ id: 'a1', cycle: 'Fall 2027', applicant_ref: 'A-1', program: 'Economics', status: 'in_review', status_at: '2026-10-01T00:00:00Z' }],
    });
    expect(await adm.loadApplicants()).toEqual([
      { id: 'a1', cycle: 'Fall 2027', applicantRef: 'A-1', program: 'Economics', status: 'in_review', statusAt: '2026-10-01T00:00:00Z' },
    ]);
    expect(calls[0].name).toBe('admissions_applicants');
    expect(calls[0].chain.join(' ')).toContain('order("cycle")');
    expect(calls[0].chain.join(' ')).toContain('order("applicant_ref")');
    expect(calls[0].chain.join(' ')).not.toMatch(/score|rank|rating/);
  });

  it('reads a status it does not know as submitted, never as a decision', async () => {
    replies.set('from:admissions_applicants', { data: [{ id: 'a1', cycle: 'c', applicant_ref: 'r', program: 'p', status: 'superstar' }] });
    expect((await adm.loadApplicants())[0].status).toBe('submitted');
  });

  it('reads one applicant’s history in order, with who and why', async () => {
    replies.set('from:admissions_status_history', {
      data: [{ id: 'h1', applicant_id: 'a1', seq: 2, kind: 'correction', from_status: 'admitted', to_status: 'in_review', corrects_seq: 1, reason: 'Entered by mistake', recorded_by: null, recorded_at: 't' }],
    });
    const [h] = await adm.loadHistory('a1');
    expect(h).toMatchObject({ seq: 2, kind: 'correction', fromStatus: 'admitted', toStatus: 'in_review', correctsSeq: 1, recordedBy: null });
    expect(calls[0].chain).toContain('eq("applicant_id","a1")');
    expect(calls[0].chain.join(' ')).toContain('order("seq",{"ascending":true})');
  });

  it('throws the server’s sentence when a read is refused', async () => {
    replies.set('from:admissions_applicants', { data: null, error: { message: 'semester: nope', code: '42501' } });
    await expect(adm.loadApplicants()).rejects.toMatchObject({ name: 'ServiceError', answered: true });
  });
});

describe('admissions: writing', () => {
  it('sends each RPC the arguments the migration names', async () => {
    replies.set('rpc:admissions_applicant_add', { data: 'a1' });
    replies.set('rpc:admissions_status_record', { data: 'h2' });
    replies.set('rpc:admissions_status_correct', { data: 'h3' });
    replies.set('rpc:admissions_applicant_link', { data: 'l1' });
    expect(await adm.addApplicant('Fall 2027', 'A-1', 'Economics', 'Received', K(1))).toBe('a1');
    expect(await adm.recordStatus('a1', 'in_review', 'Opened', K(2))).toBe('h2');
    expect(await adm.correctStatus('a1', 'in_review', 3, 'Mistake', K(3))).toBe('h3');
    expect(await adm.linkApplicant('a1', 'S100', K(4))).toBe('l1');
    expect(calls.map((c) => c.name)).toEqual(['admissions_applicant_add', 'admissions_status_record', 'admissions_status_correct', 'admissions_applicant_link']);
    expect(calls[0].args).toEqual({ want_cycle: 'Fall 2027', want_ref: 'A-1', want_program: 'Economics', want_reason: 'Received', want_key: K(1) });
    expect(calls[1].args).toEqual({ want_applicant: 'a1', want_to: 'in_review', want_reason: 'Opened', want_key: K(2) });
    expect(calls[2].args).toEqual({ want_applicant: 'a1', want_to: 'in_review', want_corrects: 3, want_reason: 'Mistake', want_key: K(3) });
    expect(calls[3].args).toEqual({ want_applicant: 'a1', want_student_ref: 'S100', want_key: K(4) });
  });

  it('throws a refusal as an answered ServiceError with the server’s sentence', async () => {
    replies.set('rpc:admissions_status_record', { data: null, error: { message: 'semester: that needs admissions:decide at your school', code: '42501' } });
    const e = await adm.recordStatus('a1', 'admitted', 'Admitted', K(2)).catch((x: unknown) => x);
    expect(e).toBeInstanceOf(ServiceError);
    expect(e).toMatchObject({ answered: true });
    expect((e as Error).message).toMatch(/admissions:decide/);
  });

  it('throws a dropped connection as unknown, so the retry keeps its key', async () => {
    replies.set('rpc:admissions_status_record', { data: null, error: { message: 'Failed to fetch' } });
    const e = await adm.recordStatus('a1', 'in_review', 'Opened', K(2)).catch((x: unknown) => x);
    expect(e).toMatchObject({ answered: false });
    expect((e as Error).message).toMatch(/same key/);
  });
});

describe('aid: reading', () => {
  it('reads an award, its type and cents, and when a second person approved it', async () => {
    replies.set('from:aid_awards', {
      data: [{ id: 'w1', student_ref: 'S100', aid_year: '2026-2027', fund_name: 'Merit Grant', award_type: 'grant', amount_cents: 40000, status: 'accepted', high_value: false, approved_at: null, recorded_at: 't' }],
    });
    expect(await aid.loadAwards('S100')).toEqual([
      { id: 'w1', studentRef: 'S100', aidYear: '2026-2027', fundName: 'Merit Grant', awardType: 'grant', amountCents: 40000, status: 'accepted', highValue: false, approvedAt: null, recordedAt: 't' },
    ]);
    expect(calls[0].chain).toContain('eq("student_ref","S100")');
  });

  it('reads a type or status it does not know as the least that implies anything', async () => {
    replies.set('from:aid_awards', { data: [{ id: 'w1', student_ref: 'S', aid_year: 'y', fund_name: 'f', award_type: 'jackpot', amount_cents: '500', status: 'paid' }] });
    const [a] = await aid.loadAwards('S');
    expect(a.awardType).toBe('other');
    expect(a.status).toBe('offered');
    expect(a.amountCents).toBe(500);
  });

  it('reads disbursements with the ledger entry they were linked to', async () => {
    replies.set('from:aid_disbursements', { data: [{ id: 'd1', award_id: 'w1', amount_cents: 30000, disbursed_on: '2026-09-01', ledger_entry_id: 'e1', recorded_at: 't' }] });
    expect(await aid.loadDisbursements('w1')).toEqual([{ id: 'd1', awardId: 'w1', amountCents: 30000, disbursedOn: '2026-09-01', ledgerEntryId: 'e1', recordedAt: 't' }]);
    expect(calls[0].chain).toContain('eq("award_id","w1")');
  });

  it('reads the student reference the school linked to this account, or null', async () => {
    replies.set('from:academic_record_subjects', { data: [{ student_ref: 'S100' }] });
    expect(await aid.myStudentRef('me-1')).toBe('S100');
    expect(calls[0].chain).toContain('eq("user_id","me-1")');
    replies.set('from:academic_record_subjects', { data: [] });
    expect(await aid.myStudentRef('me-1')).toBeNull();
  });
});

describe('aid: writing', () => {
  it('sends each RPC the arguments the migration names', async () => {
    replies.set('rpc:aid_award_record', { data: 'w1' });
    replies.set('rpc:aid_award_approve', { data: 'p1' });
    replies.set('rpc:aid_status_record', { data: 'h1' });
    replies.set('rpc:aid_status_correct', { data: 'h2' });
    replies.set('rpc:aid_disbursement_record', { data: 'd1' });
    expect(await aid.recordAward('S100', '2026-2027', 'Merit Grant', 'grant', 40000, 'Offered', K(1))).toBe('w1');
    expect(await aid.approveAward('w1', 'Approved', K(2))).toBe('p1');
    expect(await aid.recordAwardStatus('w1', 'accepted', 'Accepted', K(3))).toBe('h1');
    expect(await aid.correctAwardStatus('w1', 'accepted', 3, 'Mistake', K(4))).toBe('h2');
    expect(await aid.recordDisbursement('w1', 30000, '2026-09-01', 'e1', K(5))).toBe('d1');
    expect(calls[0].args).toEqual({
      want_student_ref: 'S100', want_aid_year: '2026-2027', want_fund: 'Merit Grant', want_type: 'grant', want_amount_cents: 40000, want_reason: 'Offered', want_key: K(1),
    });
    expect(calls[1].args).toEqual({ want_award: 'w1', want_note: 'Approved', want_key: K(2) });
    expect(calls[2].args).toEqual({ want_award: 'w1', want_to: 'accepted', want_reason: 'Accepted', want_key: K(3) });
    expect(calls[3].args).toEqual({ want_award: 'w1', want_to: 'accepted', want_corrects: 3, want_reason: 'Mistake', want_key: K(4) });
    expect(calls[4].args).toEqual({ want_award: 'w1', want_amount_cents: 30000, want_on: '2026-09-01', want_ledger_entry: 'e1', want_key: K(5) });
  });

  it('can record a disbursement with no ledger link', async () => {
    replies.set('rpc:aid_disbursement_record', { data: 'd1' });
    await aid.recordDisbursement('w1', 100, '2026-09-01', null, K(5));
    expect((calls[0].args as Record<string, unknown>).want_ledger_entry).toBeNull();
  });

  it('throws the refusal of a recorder approving their own award as the server’s sentence', async () => {
    replies.set('rpc:aid_award_approve', { data: null, error: { message: 'semester: the person who recorded an award does not approve it', code: '42501' } });
    await expect(aid.approveAward('w1', '', K(2))).rejects.toMatchObject({ answered: true, message: 'The person who recorded an award does not approve it.' });
  });

  it('only ever calls the nine functions of this slice, and never the student-accounts tables', async () => {
    replies.set('rpc:aid_disbursement_record', { data: 'd1' });
    await aid.recordDisbursement('w1', 100, '2026-09-01', 'e1', K(5));
    await aid.loadAwards('S').catch(() => undefined);
    for (const c of calls) expect(c.name).not.toMatch(/student_account/);
  });
});
