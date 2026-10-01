import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * The degree audit client's contract with `20260930250000_degree_audit.sql`:
 * which RPC, which argument names, which columns become which fields; that a
 * refusal is thrown with the server's sentence and a dropped connection as
 * "unknown, keep your key"; and that a kept result this build cannot read is
 * read as unreadable rather than as a verdict of its own.
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
import type { AuditResult } from './audit';
import {
  addRequirement,
  createProgram,
  degreeCapabilities,
  loadAudits,
  loadPrograms,
  myStudentRef,
  publishProgram,
  readAudit,
  readResult,
  retireProgram,
  runAudit,
} from './client';
import fixtures from './fixtures.json';

beforeEach(() => {
  calls.length = 0;
  replies.clear();
});

// Attempt ids are built, not written, so no literal here looks like a credential to a secret scan.
const K = (n: number): string => `attempt-${String(n).padStart(8, '0')}`;
const ATTEMPT = K(1);

const grant = (capability: string, scopeId: string, scopeKind = 'school') => ({ capability, scopeKind, scopeId });

describe('who is looking', () => {
  it('reads the degree capabilities held on this school, and nothing else', () => {
    const grants = [
      grant('degree:audit', 'vu'),
      grant('degree:author', 'vu'),
      grant('degree:audit', 'other'),
      grant('degree:author', 'vu/ECON 1020/2026FA', 'course'),
      grant('degree:author', '', 'platform'),
      grant('record:read', 'vu'),
    ];
    expect(degreeCapabilities(grants, 'vu')).toEqual(['degree:audit', 'degree:author']);
    expect(degreeCapabilities(grants.slice(2), 'vu')).toEqual([]);
    expect(degreeCapabilities(grants, '')).toEqual([]);
  });
});

describe('reading', () => {
  it('reads programs through row-level security, newest catalog year first', async () => {
    replies.set('from:degree_programs', {
      data: [{ id: 'p1', code: 'ECON-BA', title: 'Economics, B.A.', catalog_year: 2026, version: 2, state: 'published', passing_grades: ['A', 'B'], published_at: '2026-09-01T00:00:00Z' }],
    });
    const list = await loadPrograms();
    expect(list).toEqual([
      { id: 'p1', code: 'ECON-BA', title: 'Economics, B.A.', catalogYear: 2026, version: 2, state: 'published', passingGrades: ['A', 'B'], publishedAt: '2026-09-01T00:00:00Z' },
    ]);
    expect(calls[0].name).toBe('degree_programs');
    expect(calls[0].chain.join(' ')).toContain('order("catalog_year",{"ascending":false})');
  });

  it('reads a state it does not know as retired, never as published', async () => {
    replies.set('from:degree_programs', { data: [{ id: 'p1', code: 'X', title: 'X', catalog_year: 2026, version: 1, state: 'something', passing_grades: [] }] });
    expect((await loadPrograms())[0].state).toBe('retired');
  });

  it('reads the audits of one student reference, newest first', async () => {
    replies.set('from:degree_audits', { data: [] });
    await loadAudits('S100');
    expect(calls[0].chain).toContain('eq("student_ref","S100")');
    expect(calls[0].chain.join(' ')).toContain('order("requested_at",{"ascending":false})');
  });

  it('reads the student reference the school linked to this account, or null', async () => {
    replies.set('from:academic_record_subjects', { data: [{ student_ref: 'S100' }] });
    expect(await myStudentRef('me-1')).toBe('S100');
    expect(calls[0].chain).toContain('eq("user_id","me-1")');
    replies.set('from:academic_record_subjects', { data: [] });
    expect(await myStudentRef('me-1')).toBeNull();
  });

  it('throws the server’s sentence when a read is refused', async () => {
    replies.set('from:degree_audits', { data: null, error: { message: 'semester: nope', code: '42501' } });
    await expect(loadAudits('S100')).rejects.toMatchObject({ name: 'ServiceError', answered: true, message: 'Nope.' });
  });

  it('reads a kept result back exactly as the fixtures keep it', () => {
    for (const f of fixtures) {
      expect(readResult(f.expected.result)).toEqual(f.expected.result);
    }
  });

  it('reads a kept result it does not understand as unreadable, with no verdict of its own', () => {
    expect(readResult(null)).toBeNull();
    expect(readResult({ verdict: 'complete' })).toBeNull();
    expect(readResult({ verdict: 'graduated', requirements: [], courses: [] })).toBeNull();
    expect(readResult({ verdict: 'complete', requirements: [7], courses: [] })).toBeNull();
    const audit = readAudit({ id: 'a1', student_ref: 'S1', verdict: 'complete', result: { verdict: 'x' }, as_of: '2026-09-01' });
    expect(audit.result).toBeNull();
  });

  it('maps a kept audit’s columns', () => {
    const result = fixtures[1].expected.result as unknown as AuditResult;
    const a = readAudit({
      id: 'a1', student_ref: 'S100', program_id: 'p1', program_code: 'ECON-BA', program_title: 'Economics, B.A.', catalog_year: 2026,
      program_version: 2, as_of: '2026-09-01', requested_by: null, requested_at: '2026-09-01T10:00:00Z', inputs_sha256: 'a'.repeat(64),
      inputs_count: 7, verdict: 'complete', result,
    });
    expect(a).toMatchObject({ studentRef: 'S100', programVersion: 2, asOf: '2026-09-01', requestedBy: null, inputsCount: 7, verdict: 'complete' });
    expect(a.result?.requirements).toHaveLength(2);
  });
});

describe('running an audit', () => {
  it('calls degree_audit_run with the arguments the migration names and answers the audit id', async () => {
    replies.set('rpc:degree_audit_run', { data: 'audit-1' });
    expect(await runAudit('p1', 'S100', '2026-09-01', ATTEMPT)).toBe('audit-1');
    expect(calls[0]).toMatchObject({
      kind: 'rpc',
      name: 'degree_audit_run',
      args: { want_program: 'p1', want_student_ref: 'S100', want_as_of: '2026-09-01', want_key: ATTEMPT },
    });
  });

  it('throws a refusal as an answered ServiceError with the server’s sentence', async () => {
    replies.set('rpc:degree_audit_run', { data: null, error: { message: 'semester: you can audit your own record, or any record if your school gave you degree:audit', code: '42501' } });
    const e = await runAudit('p1', 'S200', '2026-09-01', ATTEMPT).catch((x: unknown) => x);
    expect(e).toBeInstanceOf(ServiceError);
    expect(e).toMatchObject({ answered: true });
    expect((e as Error).message).toMatch(/^You can audit your own record/);
  });

  it('throws a dropped connection as unknown, so the retry keeps its key', async () => {
    replies.set('rpc:degree_audit_run', { data: null, error: { message: 'Failed to fetch' } });
    const e = await runAudit('p1', 'S100', '2026-09-01', ATTEMPT).catch((x: unknown) => x);
    expect(e).toMatchObject({ answered: false });
    expect((e as Error).message).toMatch(/same key/);
  });
});

describe('the author’s writers', () => {
  it('sends each RPC the arguments the migration names', async () => {
    replies.set('rpc:degree_program_create', { data: 'prog-1' });
    replies.set('rpc:degree_requirement_add', { data: 'req-1' });
    expect(await createProgram('ECON-BA', 'Economics', 2026, ['A', 'B'], null, K(2))).toBe('prog-1');
    expect(await addRequirement('prog-1', { name: 'Core', need: 'courses', count: 2, accepts: ['ECON'], minGrade: 'B' }, K(3))).toBe('req-1');
    await publishProgram('prog-1', K(4));
    await retireProgram('prog-1', K(5));
    expect(calls.map((c) => c.name)).toEqual(['degree_program_create', 'degree_requirement_add', 'degree_program_publish', 'degree_program_retire']);
    expect(calls[0].args).toEqual({ want_code: 'ECON-BA', want_title: 'Economics', want_catalog_year: 2026, want_passing: ['A', 'B'], want_copy_from: null, want_key: K(2) });
    expect(calls[1].args).toEqual({ want_program: 'prog-1', want_name: 'Core', want_need: 'courses', want_count: 2, want_accepts: ['ECON'], want_min_grade: 'B', want_key: K(3) });
    expect(calls[2].args).toEqual({ want_program: 'prog-1', want_key: K(4) });
    expect(calls[3].args).toEqual({ want_program: 'prog-1', want_key: K(5) });
  });

  it('throws every refusal as the server’s sentence', async () => {
    replies.set('rpc:degree_program_publish', { data: null, error: { message: 'semester: a program with no requirements cannot be published', code: '23514' } });
    await expect(publishProgram('p', K(4))).rejects.toMatchObject({ answered: true, message: 'A program with no requirements cannot be published.' });
  });
});
