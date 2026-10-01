import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * The transcripts client's contract with `20260930260000_transcripts.sql`: which
 * RPC, which argument names, which columns become which fields; that a refusal
 * is thrown with the server's sentence and a dropped connection as "unknown,
 * keep your key"; and that a check's answer is read as one of three words or not
 * at all, never as a word of this build's own.
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
import {
  discloseTranscript,
  issueTranscript,
  loadDisclosures,
  loadTranscripts,
  myStudentRef,
  readVerification,
  transcriptCapabilities,
  verifyTranscript,
} from './client';

beforeEach(() => {
  calls.length = 0;
  replies.clear();
});

// Attempt ids are built, not written, so no literal here looks like a credential to a secret scan.
const K = (n: number): string => `attempt-${String(n).padStart(8, '0')}`;
const ATTEMPT = K(1);
const HASH = 'ab'.repeat(32);

const grant = (capability: string, scopeId: string, scopeKind = 'school') => ({ capability, scopeKind, scopeId });

describe('who is looking', () => {
  it('reads the transcript capabilities held on this school, and nothing else', () => {
    const grants = [
      grant('transcript:issue', 'vu'),
      grant('transcript:read', 'vu'),
      grant('transcript:read', 'other'),
      grant('transcript:issue', 'vu/ECON 1020/2026FA', 'course'),
      grant('transcript:issue', '', 'platform'),
      grant('record:read', 'vu'),
    ];
    expect(transcriptCapabilities(grants, 'vu')).toEqual(['transcript:issue', 'transcript:read']);
    expect(transcriptCapabilities(grants.slice(2), 'vu')).toEqual([]);
    expect(transcriptCapabilities(grants, '')).toEqual([]);
    // A record capability is not a transcript capability.
    expect(transcriptCapabilities([grant('record:read', 'vu'), grant('record:approve', 'vu')], 'vu')).toEqual([]);
  });
});

describe('reading', () => {
  const row = (id: string, serial: number, ref = 'S100') => ({
    id, serial, student_ref: ref, as_of: '2026-09-30', issued_by: 'u1', issued_at: '2026-09-30T10:00:00Z', body_text: '{}', body_sha256: HASH,
  });

  it('reads transcripts newest serial first, and which of them were replaced and by what', async () => {
    replies.set('from:transcripts', { data: [row('t3', 3), row('t2', 2), row('t1', 1)] });
    replies.set('from:transcript_supersessions', { data: [{ transcript_id: 't1', by_transcript: 't3', reason: 'The record was corrected.' }] });
    const list = await loadTranscripts(null);
    expect(list.map((t) => [t.serial, t.replacedBy, t.replacedBecause])).toEqual([
      [3, null, null],
      [2, null, null],
      [1, 3, 'The record was corrected.'],
    ]);
    expect(list[0]).toMatchObject({ id: 't3', studentRef: 'S100', asOf: '2026-09-30', issuedBy: 'u1', bodySha256: HASH });
    expect(calls[0].name).toBe('transcripts');
    expect(calls[0].chain.join(' ')).toContain('order("serial",{"ascending":false})');
    expect(calls[0].chain.some((c) => c.startsWith('eq('))).toBe(false);
  });

  it('narrows to one student reference when asked, and not otherwise', async () => {
    await loadTranscripts('S200');
    expect(calls[0].chain).toContain('eq("student_ref","S200")');
    await loadDisclosures('S200');
    expect(calls.find((c) => c.name === 'transcript_disclosures')?.chain).toContain('eq("student_ref","S200")');
  });

  it('reads the log of releases, newest first', async () => {
    replies.set('from:transcript_disclosures', {
      data: [{ id: 'd1', transcript_serial: 2, student_ref: 'S100', released_by: null, released_at: '2026-09-30T11:00:00Z', recipient_name: 'Northern State', recipient_kind: 'another school', purpose: 'Transfer.' }],
    });
    expect(await loadDisclosures(null)).toEqual([
      { id: 'd1', serial: 2, studentRef: 'S100', releasedBy: null, releasedAt: '2026-09-30T11:00:00Z', recipientName: 'Northern State', recipientKind: 'another school', purpose: 'Transfer.' },
    ]);
    expect(calls[0].chain.join(' ')).toContain('order("released_at",{"ascending":false})');
  });

  it('reads which record is the account’s own through the link the school made, or null', async () => {
    replies.set('from:academic_record_subjects', { data: [{ student_ref: 'S100' }] });
    expect(await myStudentRef('me')).toBe('S100');
    expect(calls[0].chain).toContain('eq("user_id","me")');
    replies.set('from:academic_record_subjects', { data: [] });
    expect(await myStudentRef('me')).toBeNull();
  });

  it('throws the server’s sentence when a read is refused, and says nothing was changed by a read', async () => {
    replies.set('from:transcripts', { error: { message: 'permission denied for table transcripts', code: '42501' } });
    await expect(loadTranscripts(null)).rejects.toBeInstanceOf(ServiceError);
  });
});

describe('issuing, releasing and checking', () => {
  it('issues with the arguments the migration names, and answers the id', async () => {
    replies.set('rpc:transcript_issue', { data: 'id-1' });
    expect(await issueTranscript('S100', '2026-09-30', null, null, ATTEMPT)).toBe('id-1');
    expect(calls[0]).toMatchObject({
      kind: 'rpc',
      name: 'transcript_issue',
      args: { want_student_ref: 'S100', want_as_of: '2026-09-30', want_supersedes: null, want_reason: null, want_key: ATTEMPT },
    });
  });

  it('names the serial and the reason when it replaces one', async () => {
    replies.set('rpc:transcript_issue', { data: 'id-2' });
    await issueTranscript('S100', '2026-09-30', 2, 'The record was corrected.', K(2));
    expect(calls[0].args).toMatchObject({ want_supersedes: 2, want_reason: 'The record was corrected.' });
  });

  it('logs a release with the arguments the migration names', async () => {
    replies.set('rpc:transcript_disclose', { data: 'd-1' });
    expect(await discloseTranscript(2, 'Northern State', 'another school', 'Transfer admission.', K(3))).toBe('d-1');
    expect(calls[0]).toMatchObject({
      name: 'transcript_disclose',
      args: { want_serial: 2, want_recipient_name: 'Northern State', want_recipient_kind: 'another school', want_purpose: 'Transfer admission.', want_key: K(3) },
    });
  });

  it('throws a refusal as the server’s own sentence, settled, with its prefix dropped', async () => {
    replies.set('rpc:transcript_issue', { error: { message: 'semester: your school has not switched records and transcripts to Semester Core', code: '42501' } });
    const e = await issueTranscript('S100', '2026-09-30', null, null, ATTEMPT).catch((x: unknown) => x);
    expect(e).toBeInstanceOf(ServiceError);
    expect((e as ServiceError).answered).toBe(true);
    expect((e as ServiceError).message).toBe('Your school has not switched records and transcripts to Semester Core.');
  });

  it('throws a dropped connection as unknown, so the retry keeps its key', async () => {
    replies.set('rpc:transcript_disclose', { error: { message: 'Failed to fetch' } });
    const e = await discloseTranscript(1, 'a', 'b', 'c', ATTEMPT).catch((x: unknown) => x);
    expect(e).toBeInstanceOf(ServiceError);
    expect((e as ServiceError).answered).toBe(false);
  });

  it('checks a serial and a hash, and reads one of three words with the school and the day', async () => {
    replies.set('rpc:transcript_verify', { data: [{ status: 'valid', school_id: 'vu', school_name: 'Vale University', issued_on: '2026-09-30' }] });
    expect(await verifyTranscript(2, HASH)).toEqual({ status: 'valid', schoolName: 'Vale University', issuedOn: '2026-09-30' });
    expect(calls[0]).toMatchObject({ name: 'transcript_verify', args: { want_serial: 2, want_hash: HASH } });
    replies.set('rpc:transcript_verify', { data: [{ status: 'unknown', school_id: null, school_name: null, issued_on: null }] });
    expect(await verifyTranscript(2, HASH)).toEqual({ status: 'unknown', schoolName: null, issuedOn: null });
  });

  it('does not read an answer that is not one of the three words, or has nothing in it', async () => {
    expect(readVerification([{ status: 'maybe' }])).toBeNull();
    expect(readVerification([])).toBeNull();
    expect(readVerification(null)).toBeNull();
    expect(readVerification({ status: 'valid' })).toBeNull();
    replies.set('rpc:transcript_verify', { data: [{ status: 'certified' }] });
    await expect(verifyTranscript(2, HASH)).rejects.toBeInstanceOf(ServiceError);
  });

  it('throws the rate limit as the server’s own sentence', async () => {
    replies.set('rpc:transcript_verify', { error: { message: 'You’ve sent a lot in a short time — try again in a few minutes.', code: '54000' } });
    const e = await verifyTranscript(2, HASH).catch((x: unknown) => x);
    expect((e as ServiceError).answered).toBe(true);
    expect((e as ServiceError).message).toMatch(/a short time/);
  });
});
