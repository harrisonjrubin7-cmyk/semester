import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * The assignments client's contract with `20260930240000_assignments.sql`:
 * which RPC, which argument names, which columns become which fields; that a
 * course is read through row-level security in one place and other courses'
 * rows are dropped; that every writer's refusal is thrown with the server's
 * sentence and a dropped connection is thrown as "unknown, keep your key".
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
  closeAssignment,
  createAssignment,
  enrolledCourses,
  extendAssignment,
  loadAssignments,
  publishAssignment,
  reviseAssignment,
  submitWork,
  taughtCourses,
} from './client';
import { gradedCourses } from '../gradebook/client';
import type { Draft } from './model';

beforeEach(() => {
  calls.length = 0;
  replies.clear();
});

const grant = (capability: string, scopeId: string, scopeKind = 'course') => ({ capability, scopeKind, scopeId });

describe('who is looking', () => {
  it('reads authoring and review grants on a course and term at this school, and nothing else', () => {
    const grants = [
      grant('assignments:author', 'vu/ECON 1020/2026FA'),
      grant('assignments:review', 'vu/ECON 1020/2026FA'),
      grant('assignments:review', 'vu/HIST 2100/2026FA'),
      // None of these is a course-and-term at this school.
      grant('assignments:author', 'vu/ECON 1020'),
      grant('assignments:author', 'vu/ECON 1020/2026FA/extra'),
      grant('assignments:author', 'vu/econ/2026FA'),
      grant('assignments:author', 'vu/ECON 1020/Fall'),
      grant('assignments:author', 'other/ECON 1020/2026FA'),
      grant('assignments:author', 'vu', 'school'),
      grant('grades:enter', 'vu/ECON 1020/2026FA'),
    ];
    expect(taughtCourses(grants, 'vu')).toEqual([
      { course: 'ECON 1020', term: '2026FA', capabilities: ['assignments:author', 'assignments:review'] },
      { course: 'HIST 2100', term: '2026FA', capabilities: ['assignments:review'] },
    ]);
  });

  it('reads nothing with no school, and offers the newest term first', () => {
    expect(taughtCourses([grant('assignments:author', 'vu/ECON 1020/2026FA')], '')).toEqual([]);
    const two = taughtCourses([grant('assignments:author', 'vu/ECON 1020/2026FA'), grant('assignments:author', 'vu/ECON 1020/2027SP')], 'vu');
    expect(two.map((c) => c.term)).toEqual(['2027SP', '2026FA']);
  });

  it('takes the roster from the gradebook’s, because there is one list of who is in a course', () => {
    expect(enrolledCourses).toBe(gradedCourses);
    expect(enrolledCourses([grant('grades:receive', 'vu/ECON 1020/2026FA')], 'vu')).toEqual([{ course: 'ECON 1020', term: '2026FA' }]);
  });
});

describe('reading a course', () => {
  const asg = (id: string, extra: Record<string, unknown> = {}) => ({
    id, course_code: 'ECON 1020', term: '2026FA', title: `Title ${id}`, instructions: 'Do it.', due_at: '2026-10-08T12:00:00Z',
    closes_at: null, allow_resubmission: true, max_versions: 3, status: 'published', created_at: '2026-10-01T00:00:00Z',
    published_at: '2026-10-01T01:00:00Z', closed_at: null, ...extra,
  });

  it('reads the five tables through row-level security, scoped to the course and term', async () => {
    await loadAssignments('ECON 1020', '2026FA');
    expect(calls.filter((c) => c.kind === 'rpc')).toEqual([]);
    expect(calls.map((c) => c.name).sort()).toEqual(['assignment_events', 'assignment_extensions', 'assignments', 'submission_receipts', 'submission_versions']);
    const a = calls.find((c) => c.name === 'assignments')!;
    expect(a.chain).toContain('eq("course_code","ECON 1020")');
    expect(a.chain).toContain('eq("term","2026FA")');
  });

  it('turns columns into fields and defaults an unknown status to draft', async () => {
    replies.set('from:assignments', { data: [asg('a1'), asg('a2', { status: 'closed', closes_at: '2026-10-09T12:00:00Z', allow_resubmission: false }), asg('a3', { status: 'weird' })] });
    const got = await loadAssignments('ECON 1020', '2026FA');
    expect(got.assignments.map((a) => a.status)).toEqual(['published', 'closed', 'draft']);
    expect(got.assignments[1]).toMatchObject({ allowResubmission: false, closesAt: '2026-10-09T12:00:00Z', dueAt: '2026-10-08T12:00:00Z', maxVersions: 3 });
  });

  it('keeps only rows that belong to this course’s assignments, so one course never shows another’s', async () => {
    replies.set('from:assignments', { data: [asg('a1')] });
    replies.set('from:assignment_extensions', { data: [
      { id: 'e1', assignment_id: 'a1', student_id: 'ana', due_at: '2026-10-10T12:00:00Z', closes_at: null, reason: 'r', at: '2026-10-02T00:00:00Z' },
      { id: 'e2', assignment_id: 'elsewhere', student_id: 'ana', due_at: '2026-10-10T12:00:00Z', closes_at: null, reason: 'r', at: '2026-10-02T00:00:00Z' },
    ] });
    replies.set('from:submission_versions', { data: [
      { id: 'v1', submission_id: 's1', assignment_id: 'a1', student_id: 'ana', version: 1, body: 'x', content_sha256: 'h', due_at_then: 'd', late: true, submitted_at: 't' },
      { id: 'v2', submission_id: 's2', assignment_id: 'elsewhere', student_id: 'ana', version: 1, body: 'y', content_sha256: 'h', due_at_then: 'd', late: false, submitted_at: 't' },
    ] });
    replies.set('from:submission_receipts', { data: [
      { id: 'r1', version_id: 'v1', assignment_id: 'a1', student_id: 'ana', receipt_code: 'SR-000000000001', content_sha256: 'h', submitted_at: 't', due_at_then: 'd', late: true },
      { id: 'r2', version_id: 'v2', assignment_id: 'elsewhere', student_id: 'ana', receipt_code: 'SR-000000000002', content_sha256: 'h', submitted_at: 't', due_at_then: 'd', late: false },
    ] });
    replies.set('from:assignment_events', { data: [
      { id: 'n1', assignment_id: 'a1', action: 'published', actor: 'prof', at: 't' },
      { id: 'n2', assignment_id: 'elsewhere', action: 'created', actor: 'prof', at: 't' },
    ] });
    const got = await loadAssignments('ECON 1020', '2026FA');
    expect(got.extensions.map((e) => e.id)).toEqual(['e1']);
    expect(got.versions.map((v) => v.id)).toEqual(['v1']);
    expect(got.versions[0].late).toBe(true);
    expect(got.receipts.map((r) => r.code)).toEqual(['SR-000000000001']);
    expect(got.events.map((e) => e.id)).toEqual(['n1']);
  });

  it('throws the server’s sentence when any read is refused', async () => {
    replies.set('from:submission_versions', { error: { message: 'semester: no', code: '42501' } });
    await expect(loadAssignments('ECON 1020', '2026FA')).rejects.toBeInstanceOf(ServiceError);
  });
});

describe('the writers', () => {
  const draft: Draft = { title: 'Problem set 1', instructions: 'Do it.', dueAt: '2026-10-08T12:00:00Z', closesAt: '2026-10-09T12:00:00Z', allowResubmission: true, maxVersions: 3 };
  const rpc = (name: string) => calls.find((c) => c.kind === 'rpc' && c.name === name);

  it('creates with the arguments the function takes, and returns the new id', async () => {
    replies.set('rpc:assignments_create', { data: 'new-id' });
    expect(await createAssignment('ECON 1020', '2026FA', draft, 'create-key-0001')).toBe('new-id');
    expect(rpc('assignments_create')?.args).toEqual({
      want_course: 'ECON 1020', want_term: '2026FA', want_title: 'Problem set 1', want_instructions: 'Do it.',
      want_due: '2026-10-08T12:00:00.000Z', want_closes: '2026-10-09T12:00:00.000Z', want_resubmit: true, want_max_versions: 3,
      want_key: 'create-key-0001',
    });
  });

  it('sends an empty closing time as null, not as a date', async () => {
    await createAssignment('ECON 1020', '2026FA', { ...draft, closesAt: null }, 'create-key-0002');
    expect((rpc('assignments_create')!.args as Record<string, unknown>).want_closes).toBeNull();
  });

  it('revises, publishes, closes and extends with their own argument names', async () => {
    await reviseAssignment('a1', draft, 'revise-key-0001');
    await publishAssignment('a1', 'publish-key-0001');
    await closeAssignment('a1', 'close-key-00001');
    await extendAssignment('a1', 'ana', '2026-10-12T12:00:00Z', null, 'Hospital', 'extend-key-0001');
    expect(Object.keys(rpc('assignments_revise')!.args as object)).toEqual(['want_assignment', 'want_title', 'want_instructions', 'want_due', 'want_closes', 'want_resubmit', 'want_max_versions', 'want_key']);
    expect(rpc('assignments_publish')?.args).toEqual({ want_assignment: 'a1', want_key: 'publish-key-0001' });
    expect(rpc('assignments_close')?.args).toEqual({ want_assignment: 'a1', want_key: 'close-key-00001' });
    expect(rpc('assignments_extend')?.args).toEqual({
      want_assignment: 'a1', want_student: 'ana', want_due: '2026-10-12T12:00:00.000Z', want_closes: null, want_reason: 'Hospital', want_key: 'extend-key-0001',
    });
  });

  it('submits and answers the receipt', async () => {
    replies.set('rpc:submissions_submit', { data: { version: 2, receipt: 'SR-ABCDEF012345', submitted_at: '2026-10-07T10:00:00Z', late: false } });
    expect(await submitWork('a1', 'Answer two.', 'submit-key-0001')).toEqual({ version: 2, receipt: 'SR-ABCDEF012345', submittedAt: '2026-10-07T10:00:00Z', late: false });
    expect(rpc('submissions_submit')?.args).toEqual({ want_assignment: 'a1', want_body: 'Answer two.', want_key: 'submit-key-0001' });
  });

  it('throws the server’s own sentence when it refuses, marked as answered', async () => {
    replies.set('rpc:submissions_submit', { error: { message: 'semester: this assignment is closed', code: 'P0001' } });
    const e = await submitWork('a1', 'x', 'submit-key-0002').catch((x: unknown) => x);
    expect(e).toBeInstanceOf(ServiceError);
    expect((e as ServiceError).message).toBe('This assignment is closed.');
    expect((e as ServiceError).answered).toBe(true);
  });

  it('says it does not know, and keeps the key, when no answer came back', async () => {
    replies.set('rpc:submissions_submit', { error: { message: 'fetch failed' } });
    const e = await submitWork('a1', 'x', 'submit-key-0003').catch((x: unknown) => x);
    expect((e as ServiceError).answered).toBe(false);
    expect((e as ServiceError).message).toContain('not known whether');
    // The control: every writer reads the same way, so a refusal of another kind is not special-cased.
    replies.set('rpc:assignments_close', { error: { message: 'semester: only a published assignment can be closed; this one is draft', code: 'P0001' } });
    const f = await closeAssignment('a1', 'close-key-00002').catch((x: unknown) => x);
    expect((f as ServiceError).message).toContain('Only a published assignment can be closed');
    expect((f as ServiceError).answered).toBe(true);
  });
});
