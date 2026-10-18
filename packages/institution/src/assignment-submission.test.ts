import { describe, expect, it } from 'vitest';
import { Refusal } from './index.ts';
import { validateEvent } from './events.ts';
import { ASSESSMENT_SUBMISSION, walk } from './workflow.ts';
import {
  AssignmentSubmissionService,
  MemorySubmissionStore,
  SubmissionRefusal,
  type SubmissionCode,
} from './assignment-submission.ts';

/**
 * Two institutions, each with a course and an assignment, and a student and a
 * teacher in each. The second institution exists so every test that could
 * leak across tenants has a real population to leak into.
 */
function fixture(start = '2026-10-18T12:00:00Z') {
  const store = new MemorySubmissionStore();
  let now = new Date(start);
  const ids = { n: 0 };
  const service = new AssignmentSubmissionService(store, {
    environment: 'demo',
    now: () => now,
    newId: () => `id-${String(++ids.n).padStart(4, '0')}`,
  });

  store.assignments.set('a1', { id: 'a1', institutionId: 'inst-a', courseId: 'course-a1', closesAt: '2026-10-20T23:59:00Z' });
  store.assignments.set('b1', { id: 'b1', institutionId: 'inst-b', courseId: 'course-b1', closesAt: '2026-10-20T23:59:00Z' });
  store.memberships.push(
    { userId: 'stu-1', institutionId: 'inst-a', courseId: 'course-a1', role: 'student', status: 'active' },
    { userId: 'stu-2', institutionId: 'inst-a', courseId: 'course-a1', role: 'student', status: 'active' },
    { userId: 'stu-3', institutionId: 'inst-a', courseId: 'course-a1', role: 'student', status: 'revoked' },
    { userId: 'fac-1', institutionId: 'inst-a', courseId: 'course-a1', role: 'faculty', status: 'active' },
    { userId: 'fac-2', institutionId: 'inst-a', courseId: 'course-a2', role: 'faculty', status: 'active' },
    { userId: 'stu-b', institutionId: 'inst-b', courseId: 'course-b1', role: 'student', status: 'active' },
    { userId: 'fac-b', institutionId: 'inst-b', courseId: 'course-b1', role: 'faculty', status: 'active' },
  );

  const as = (userId: string, institutionId = 'inst-a') => ({ userId, institutionId });
  const KEY_1 = 'submit-key-0001';
  const KEY_2 = 'submit-key-0002';
  return { store, service, as, KEY_1, KEY_2, setNow: (iso: string) => { now = new Date(iso); } };
}

/** The refusal code, or `null` if the call succeeded. */
async function codeOf(run: () => unknown): Promise<SubmissionCode | null> {
  try {
    await run();
    return null;
  } catch (e) {
    if (e instanceof SubmissionRefusal) return e.code;
    throw e;
  }
}

describe('submitting an assignment', () => {
  it('a submitted draft gets a receipt, and one outbox event that carries ids and no work', async () => {
    const { service, store, as, KEY_1 } = fixture();
    await service.saveDraft(as('stu-1'), { assignmentId: 'a1', body: 'my essay text', expectedVersion: 0 });
    const receipt = await service.submitAssignment(as('stu-1'), { assignmentId: 'a1', draftVersion: 1, idempotencyKey: KEY_1 });

    expect(receipt.status).toBe('completed');
    expect(store.submissions.size).toBe(1);
    expect(store.outbox.rows).toHaveLength(1);
    const [row] = store.outbox.rows;
    expect(row.event.eventType).toBe('submission.finalized');
    expect(validateEvent(row.event).ok).toBe(true);
    expect(JSON.stringify(row.event)).not.toContain('my essay text');
  });

  it('repeating the same command with the same key returns the same receipt and adds nothing', async () => {
    const { service, store, as, KEY_1, setNow } = fixture();
    await service.saveDraft(as('stu-1'), { assignmentId: 'a1', body: 'v1', expectedVersion: 0 });
    const first = await service.submitAssignment(as('stu-1'), { assignmentId: 'a1', draftVersion: 1, idempotencyKey: KEY_1 });
    const second = await service.submitAssignment(as('stu-1'), { assignmentId: 'a1', draftVersion: 1, idempotencyKey: KEY_1 });
    expect(second).toEqual(first);
    expect(store.submissions.size).toBe(1);
    expect(store.outbox.rows).toHaveLength(1);

    // A retry that arrives after the window closed is still the same recorded outcome.
    setNow('2026-10-25T09:00:00Z');
    const late = await service.submitAssignment(as('stu-1'), { assignmentId: 'a1', draftVersion: 1, idempotencyKey: KEY_1 });
    expect(late).toEqual(first);
  });

  it('the same key with a different payload is a conflict, and writes nothing', async () => {
    const { service, store, as, KEY_1 } = fixture();
    await service.saveDraft(as('stu-1'), { assignmentId: 'a1', body: 'v1', expectedVersion: 0 });
    await service.submitAssignment(as('stu-1'), { assignmentId: 'a1', draftVersion: 1, idempotencyKey: KEY_1 });

    expect(await codeOf(() => service.submitAssignment(as('stu-1'), { assignmentId: 'a1', draftVersion: 2, idempotencyKey: KEY_1 })))
      .toBe('idempotency_conflict');
    expect(store.outbox.rows).toHaveLength(1);
  });

  it('a second submission under a new key is refused, because one assignment takes one submission', async () => {
    const { service, as, KEY_1, KEY_2 } = fixture();
    await service.saveDraft(as('stu-1'), { assignmentId: 'a1', body: 'v1', expectedVersion: 0 });
    await service.submitAssignment(as('stu-1'), { assignmentId: 'a1', draftVersion: 1, idempotencyKey: KEY_1 });
    expect(await codeOf(() => service.submitAssignment(as('stu-1'), { assignmentId: 'a1', draftVersion: 1, idempotencyKey: KEY_2 })))
      .toBe('already_submitted');
  });

  it('a draft version that is no longer current is refused, and nothing is written', async () => {
    const { service, store, as, KEY_1 } = fixture();
    await service.saveDraft(as('stu-1'), { assignmentId: 'a1', body: 'v1', expectedVersion: 0 });
    await service.saveDraft(as('stu-1'), { assignmentId: 'a1', body: 'v2', expectedVersion: 1 });
    expect(await codeOf(() => service.submitAssignment(as('stu-1'), { assignmentId: 'a1', draftVersion: 1, idempotencyKey: KEY_1 })))
      .toBe('stale_version');
    expect(store.submissions.size).toBe(0);
    expect(store.outbox.rows).toHaveLength(0);
  });

  it('a submission after the window closes is refused', async () => {
    const { service, store, as, KEY_1, setNow } = fixture();
    await service.saveDraft(as('stu-1'), { assignmentId: 'a1', body: 'v1', expectedVersion: 0 });
    setNow('2026-10-21T00:00:00Z');
    expect(await codeOf(() => service.submitAssignment(as('stu-1'), { assignmentId: 'a1', draftVersion: 1, idempotencyKey: KEY_1 })))
      .toBe('window_closed');
    expect(store.submissions.size).toBe(0);
  });

  it('submitting with no draft is refused', async () => {
    const { service, as, KEY_1 } = fixture();
    expect(await codeOf(() => service.submitAssignment(as('stu-1'), { assignmentId: 'a1', draftVersion: 1, idempotencyKey: KEY_1 })))
      .toBe('invalid_state');
  });

  it('a student who is not enrolled in the course is refused', async () => {
    const { service, as, KEY_1 } = fixture();
    expect(await codeOf(() => service.submitAssignment(as('stu-b'), { assignmentId: 'a1', draftVersion: 1, idempotencyKey: KEY_1 })))
      .toBe('not_enrolled');
  });

  it('faculty cannot submit as a student', async () => {
    const { service, as, KEY_1 } = fixture();
    expect(await codeOf(() => service.submitAssignment(as('fac-1'), { assignmentId: 'a1', draftVersion: 1, idempotencyKey: KEY_1 })))
      .toBe('not_enrolled');
  });

  it('an actor from another institution cannot see the assignment at all', async () => {
    const { service, as, KEY_1 } = fixture();
    expect(await codeOf(() => service.submitAssignment(as('stu-1', 'inst-b'), { assignmentId: 'a1', draftVersion: 1, idempotencyKey: KEY_1 })))
      .toBe('not_found');
  });

  it('a revoked membership stops a new submission and also a replay of an earlier one', async () => {
    const { service, store, as, KEY_1 } = fixture();
    await service.saveDraft(as('stu-1'), { assignmentId: 'a1', body: 'v1', expectedVersion: 0 });
    await service.submitAssignment(as('stu-1'), { assignmentId: 'a1', draftVersion: 1, idempotencyKey: KEY_1 });

    const membership = store.memberships.find((m) => m.userId === 'stu-1');
    if (!membership) throw new Error('fixture missing stu-1');
    membership.status = 'revoked';

    expect(await codeOf(() => service.submitAssignment(as('stu-1'), { assignmentId: 'a1', draftVersion: 1, idempotencyKey: KEY_1 })))
      .toBe('membership_revoked');
  });
});

describe('drafts are private until they are submitted', () => {
  it('only the author reads a draft; faculty and other students see nothing', async () => {
    const { service, as } = fixture();
    await service.saveDraft(as('stu-1'), { assignmentId: 'a1', body: 'private notes', expectedVersion: 0 });
    expect((await service.readDraft(as('stu-1'), 'a1'))?.body).toBe('private notes');
    expect(await service.readDraft(as('stu-2'), 'a1')).toBeNull();
    expect(await service.readDraft(as('fac-1'), 'a1')).toBeNull();
  });

  it('a draft save with a stale expected version is refused', async () => {
    const { service, as } = fixture();
    await service.saveDraft(as('stu-1'), { assignmentId: 'a1', body: 'v1', expectedVersion: 0 });
    expect(await codeOf(() => service.saveDraft(as('stu-1'), { assignmentId: 'a1', body: 'v2', expectedVersion: 0 })))
      .toBe('stale_version');
  });
});

describe('faculty assessment and released feedback', () => {
  async function submitted() {
    const f = fixture();
    await f.service.saveDraft(f.as('stu-1'), { assignmentId: 'a1', body: 'essay', expectedVersion: 0 });
    await f.service.submitAssignment(f.as('stu-1'), { assignmentId: 'a1', draftVersion: 1, idempotencyKey: f.KEY_1 });
    const [submission] = [...f.store.submissions.values()];
    return { ...f, submissionId: submission.id };
  }

  it('faculty can record a grade, and the student cannot see it until it is released', async () => {
    const { service, store, as, submissionId, KEY_1 } = await submitted();
    await service.recordAssessment(as('fac-1'), { submissionId, grade: 88, feedback: 'Strong argument.', idempotencyKey: KEY_1 });

    const before = await service.readFeedback(as('stu-1'), submissionId);
    expect(before).toEqual({ released: false });
    expect(store.outbox.rows.map((r) => r.event.eventType)).toEqual(['submission.finalized']);
  });

  it('releasing feedback makes it visible to the author and posts grade.posted once', async () => {
    const { service, store, as, submissionId, KEY_1, KEY_2 } = await submitted();
    await service.recordAssessment(as('fac-1'), { submissionId, grade: 88, feedback: 'Strong argument.', idempotencyKey: KEY_1 });
    const released = await service.releaseFeedback(as('fac-1'), { submissionId, idempotencyKey: KEY_2 });
    expect(released.status).toBe('completed');

    expect(await service.readFeedback(as('stu-1'), submissionId)).toEqual({ released: true, grade: 88, feedback: 'Strong argument.' });
    expect(store.outbox.rows.map((r) => r.event.eventType)).toEqual(['submission.finalized', 'grade.posted']);

    expect(await service.releaseFeedback(as('fac-1'), { submissionId, idempotencyKey: KEY_2 })).toEqual(released);
    expect(store.outbox.rows).toHaveLength(2);
  });

  it('a second, different release is refused: feedback is released once', async () => {
    const { service, as, submissionId, KEY_1, KEY_2 } = await submitted();
    await service.recordAssessment(as('fac-1'), { submissionId, grade: 88, feedback: 'ok', idempotencyKey: KEY_1 });
    await service.releaseFeedback(as('fac-1'), { submissionId, idempotencyKey: KEY_2 });
    expect(await codeOf(() => service.releaseFeedback(as('fac-1'), { submissionId, idempotencyKey: 'release-key-0003' })))
      .toBe('invalid_state');
  });

  it('a student cannot read another student\'s feedback, even when it is released', async () => {
    const { service, as, submissionId, KEY_1, KEY_2 } = await submitted();
    await service.recordAssessment(as('fac-1'), { submissionId, grade: 88, feedback: 'ok', idempotencyKey: KEY_1 });
    await service.releaseFeedback(as('fac-1'), { submissionId, idempotencyKey: KEY_2 });
    expect(await codeOf(() => service.readFeedback(as('stu-2'), submissionId))).toBe('not_found');
  });

  it('a student cannot assess or release', async () => {
    const { service, as, submissionId, KEY_1, KEY_2 } = await submitted();
    expect(await codeOf(() => service.recordAssessment(as('stu-1'), { submissionId, grade: 100, feedback: 'me', idempotencyKey: KEY_1 })))
      .toBe('not_teaching');
    expect(await codeOf(() => service.releaseFeedback(as('stu-1'), { submissionId, idempotencyKey: KEY_2 }))).toBe('not_teaching');
  });

  it('a teacher of a different course in the same institution cannot assess the submission', async () => {
    const { service, as, submissionId, KEY_1 } = await submitted();
    expect(await codeOf(() => service.recordAssessment(as('fac-2'), { submissionId, grade: 90, feedback: 'x', idempotencyKey: KEY_1 })))
      .toBe('not_teaching');
  });

  it('a teacher in another institution cannot see the submission', async () => {
    const { service, as, submissionId, KEY_1 } = await submitted();
    expect(await codeOf(() => service.recordAssessment(as('fac-b', 'inst-b'), { submissionId, grade: 90, feedback: 'x', idempotencyKey: KEY_1 })))
      .toBe('not_found');
  });

  it('faculty read the submitted work; the student cannot use that path', async () => {
    const { service, as, submissionId } = await submitted();
    const work = await service.readSubmissionForFaculty(as('fac-1'), submissionId);
    expect(work.body).toBe('essay');
    expect(await codeOf(() => service.readSubmissionForFaculty(as('stu-1'), submissionId))).toBe('not_teaching');
  });
});

describe('the submission walks the assessment workflow', () => {
  it('the states a submission passes through are a valid path to receipt_issued', async () => {
    const path = ['in_progress', 'ready_to_submit', 'submission_requested', 'finalized', 'receipt_issued'] as const;
    const verdict = walk(ASSESSMENT_SUBMISSION, 'not_started', path);
    expect(verdict.ok).toBe(true);

    const { service, store, as, KEY_1 } = fixture();
    await service.saveDraft(as('stu-1'), { assignmentId: 'a1', body: 'v1', expectedVersion: 0 });
    await service.submitAssignment(as('stu-1'), { assignmentId: 'a1', draftVersion: 1, idempotencyKey: KEY_1 });
    expect([...store.submissions.values()][0].state).toBe('receipt_issued');
  });
});

describe('refusals are typed and still count as refusals', () => {
  it('a SubmissionRefusal is a Refusal, so the gateway maps it like every other refusal', async () => {
    const { service, as, KEY_1 } = fixture();
    const err = await service.submitAssignment(as('stu-b'), { assignmentId: 'a1', draftVersion: 1, idempotencyKey: KEY_1 }).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(SubmissionRefusal);
    expect(err).toBeInstanceOf(Refusal);
  });

  it('a malformed idempotency key is refused as invalid input before anything is looked up', async () => {
    const { service, as } = fixture();
    expect(await codeOf(() => service.submitAssignment(as('stu-1'), { assignmentId: 'a1', draftVersion: 1, idempotencyKey: 'short' })))
      .toBe('invalid_input');
  });
});
