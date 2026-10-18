/**
 * The first complete student–faculty slice: an assignment, a private draft, a
 * submission with a receipt, faculty assessment, and feedback released to the
 * student. Nothing here is transport. The gateway calls these commands; the
 * tests call them directly.
 *
 * Every consequential command runs the same order: validate → resolve the
 * assignment or submission → authorize against membership in its course → replay
 * or claim the idempotency key → check the current version and window → write
 * everything at once. Each refusal is thrown before the first write, so a
 * refused command leaves no draft, submission, receipt, grade or outbox row.
 *
 * Two rules follow from the specification and are tested rather than assumed:
 *
 *  - Authority is checked before a replay is answered. A revoked student who
 *    retries a submission they made last week is refused, not handed the old
 *    receipt.
 *  - A replay is answered before the version and window checks. The draft a
 *    submission consumed is no longer the current draft, and a retry after the
 *    deadline is still the same recorded outcome, not a new late submission.
 *
 * The lifecycle of a submission is the `ASSESSMENT_SUBMISSION` workflow in
 * `workflow.ts`; `submitAssignment` walks its happy path and checks the walk.
 * Event names come from the registry in `events.ts`
 * (`submission.finalized`, `grade.posted`), not new ones.
 *
 * `MemorySubmissionStore` is the in-memory port. A Postgres adapter needs the
 * same ownership rules as database constraints (see `database/TENANT_ISOLATION_MATRIX.md`)
 * and must store the idempotency fingerprint as a digest, which this module
 * compares as the exact canonical string.
 */

import { Refusal, type Receipt } from './index.ts';
import { makeEvent, MemoryOutbox } from './events.ts';
import type { PolicyEnvironment } from './policy.ts';
import { ASSESSMENT_SUBMISSION, walk, type AssessmentSubmissionState } from './workflow.ts';

export const SUBMISSION_CODES = [
  'invalid_input',
  'not_found',
  'not_enrolled',
  'not_teaching',
  'membership_revoked',
  'window_closed',
  'stale_version',
  'idempotency_conflict',
  'already_submitted',
  'invalid_state',
] as const;
export type SubmissionCode = (typeof SUBMISSION_CODES)[number];

/** A refusal with a code the gateway and the screens can branch on. */
export class SubmissionRefusal extends Refusal {
  readonly code: SubmissionCode;

  constructor(code: SubmissionCode, message: string) {
    super(message);
    this.code = code;
    this.name = 'SubmissionRefusal';
  }
}

export interface SubmissionActor {
  userId: string;
  institutionId: string;
}

export interface Assignment {
  id: string;
  institutionId: string;
  courseId: string;
  closesAt: string;
}

export interface CourseMembership {
  userId: string;
  institutionId: string;
  courseId: string;
  role: 'student' | 'faculty';
  status: 'active' | 'revoked';
}

export interface Draft {
  assignmentId: string;
  userId: string;
  version: number;
  body: string;
  updatedAt: string;
}

export interface Submission {
  id: string;
  assignmentId: string;
  institutionId: string;
  userId: string;
  body: string;
  state: AssessmentSubmissionState;
  submittedAt: string;
  receiptId: string;
}

export interface Assessment {
  submissionId: string;
  graderId: string;
  grade: number;
  feedback: string;
  recordedAt: string;
  releasedAt: string | null;
}

interface Claim {
  fingerprint: string;
  receiptId: string;
}

const draftKey = (userId: string, assignmentId: string): string => `${userId}|${assignmentId}`;
const claimKey = (userId: string, command: string, key: string): string => `${userId}|${command}|${key}`;

/**
 * The in-memory port. Plain maps, so a test can seed a population and inspect
 * every write; `outbox` is the same `MemoryOutbox` the registry tests use.
 */
export class MemorySubmissionStore {
  readonly assignments = new Map<string, Assignment>();
  readonly memberships: CourseMembership[] = [];
  readonly drafts = new Map<string, Draft>();
  readonly submissions = new Map<string, Submission>();
  readonly assessments = new Map<string, Assessment>();
  readonly claims = new Map<string, Claim>();
  readonly receipts = new Map<string, Receipt>();
  readonly outbox = new MemoryOutbox();

  membership(userId: string, courseId: string): CourseMembership | undefined {
    return this.memberships.find((m) => m.userId === userId && m.courseId === courseId);
  }

  submissionFor(userId: string, assignmentId: string): Submission | undefined {
    return [...this.submissions.values()].find((s) => s.userId === userId && s.assignmentId === assignmentId);
  }
}

export interface SubmissionServiceOptions {
  /** Stamped on every event. Preview and staging never share production values. */
  environment: PolicyEnvironment;
  now?: () => Date;
  /** Identifiers for submissions and receipts. Event ids are always UUIDs. */
  newId?: () => string;
  newEventId?: () => string;
  producer?: string;
}

export interface DraftInput {
  assignmentId: string;
  body: string;
  expectedVersion: number;
}

export interface SubmitInput {
  assignmentId: string;
  draftVersion: number;
  idempotencyKey: string;
}

export interface AssessInput {
  submissionId: string;
  grade: number;
  feedback: string;
  idempotencyKey: string;
}

export interface ReleaseInput {
  submissionId: string;
  idempotencyKey: string;
}

/** What a student is allowed to see. Nothing about an unreleased grade, not even that it exists. */
export type FeedbackView = { released: false } | { released: true; grade: number; feedback: string };

export interface FacultySubmissionView {
  submissionId: string;
  studentId: string;
  body: string;
  submittedAt: string;
  assessment: { grade: number; feedback: string; released: boolean } | null;
}

const ID_PATTERN = /^[A-Za-z0-9_-]{1,128}$/;
/** Same shape the dining payment keys use: a client may not send an unbounded or unsafe key. */
const KEY_PATTERN = /^[A-Za-z0-9_.:-]{8,64}$/;
const BODY_LIMIT = 50_000;
const FEEDBACK_LIMIT = 10_000;
const MAX_VERSION = 1_000_000_000;

const requireId = (value: unknown, field: string): string => {
  if (typeof value !== 'string' || !ID_PATTERN.test(value)) {
    throw new SubmissionRefusal('invalid_input', `${field} is not an identifier`);
  }
  return value;
};

const requireKey = (value: unknown): string => {
  if (typeof value !== 'string' || !KEY_PATTERN.test(value)) {
    throw new SubmissionRefusal('invalid_input', 'idempotencyKey must be 8 to 64 letters, digits, dots, colons, underscores or dashes');
  }
  return value;
};

const requireVersion = (value: unknown, field: string, min: number): number => {
  if (!Number.isInteger(value) || (value as number) < min || (value as number) > MAX_VERSION) {
    throw new SubmissionRefusal('invalid_input', `${field} must be an integer from ${min}`);
  }
  return value as number;
};

const requireText = (value: unknown, field: string, limit: number): string => {
  if (typeof value !== 'string' || value.length > limit) {
    throw new SubmissionRefusal('invalid_input', `${field} must be text of at most ${limit} characters`);
  }
  return value;
};

/**
 * The exact request, as a canonical string. Two requests match only when this
 * string is identical, so the check cannot be fooled by a hash collision.
 */
const fingerprintOf = (fields: Record<string, string | number>): string =>
  JSON.stringify(Object.keys(fields).sort().map((k) => [k, fields[k]]));

export class AssignmentSubmissionService {
  private readonly store: MemorySubmissionStore;
  private readonly environment: PolicyEnvironment;
  private readonly now: () => Date;
  private readonly newId: () => string;
  private readonly newEventId: () => string;
  private readonly producer: string;

  constructor(store: MemorySubmissionStore, options: SubmissionServiceOptions) {
    this.store = store;
    this.environment = options.environment;
    this.now = options.now ?? (() => new Date());
    this.newId = options.newId ?? (() => crypto.randomUUID());
    this.newEventId = options.newEventId ?? (() => crypto.randomUUID());
    this.producer = options.producer ?? 'institution.assignment-submission';
  }

  /** The student's private working copy. Versioned, so two open tabs cannot overwrite each other. */
  async saveDraft(actor: SubmissionActor, input: DraftInput): Promise<{ version: number; updatedAt: string }> {
    const assignmentId = requireId(input.assignmentId, 'assignmentId');
    const body = requireText(input.body, 'body', BODY_LIMIT);
    const expectedVersion = requireVersion(input.expectedVersion, 'expectedVersion', 0);

    const assignment = this.loadAssignment(actor, assignmentId);
    this.enrolledStudent(actor, assignment);
    this.refuseIfSubmitted(actor.userId, assignmentId);
    this.refuseIfClosed(assignment);

    const key = draftKey(actor.userId, assignmentId);
    const currentVersion = this.store.drafts.get(key)?.version ?? 0;
    if (expectedVersion !== currentVersion) {
      throw new SubmissionRefusal('stale_version', 'This draft changed since you last loaded it');
    }
    const updatedAt = this.now().toISOString();
    const version = currentVersion + 1;
    this.store.drafts.set(key, { assignmentId, userId: actor.userId, version, body, updatedAt });
    return { version, updatedAt };
  }

  /**
   * The caller's own draft, or null. There is no parameter that names somebody
   * else's draft, so a teacher or another student gets null for a draft they
   * cannot see rather than a refusal that says one exists.
   */
  async readDraft(actor: SubmissionActor, assignmentId: string): Promise<Draft | null> {
    const id = requireId(assignmentId, 'assignmentId');
    const assignment = this.store.assignments.get(id);
    if (!assignment || assignment.institutionId !== actor.institutionId) return null;
    return this.store.drafts.get(draftKey(actor.userId, id)) ?? null;
  }

  /** Freeze the draft at `draftVersion` into a submission and issue a receipt. */
  async submitAssignment(actor: SubmissionActor, input: SubmitInput): Promise<Receipt> {
    const assignmentId = requireId(input.assignmentId, 'assignmentId');
    const draftVersion = requireVersion(input.draftVersion, 'draftVersion', 1);
    const key = requireKey(input.idempotencyKey);

    const assignment = this.loadAssignment(actor, assignmentId);
    this.enrolledStudent(actor, assignment);

    const fingerprint = fingerprintOf({ assignmentId, draftVersion });
    const replay = this.replayOrNull(actor.userId, 'submit_assignment', key, fingerprint);
    if (replay) return replay;

    this.refuseIfSubmitted(actor.userId, assignmentId);
    this.refuseIfClosed(assignment);

    const draft = this.store.drafts.get(draftKey(actor.userId, assignmentId));
    if (!draft) throw new SubmissionRefusal('invalid_state', 'Save a draft before submitting');
    if (draft.version !== draftVersion) {
      throw new SubmissionRefusal('stale_version', 'The draft changed after you chose to submit. Review it and submit again.');
    }

    const path: AssessmentSubmissionState[] = ['in_progress', 'ready_to_submit', 'submission_requested', 'finalized', 'receipt_issued'];
    if (!walk(ASSESSMENT_SUBMISSION, 'not_started', path).ok) {
      throw new Error('assessment submission workflow no longer walks to receipt_issued');
    }

    // Every check has passed. Nothing above this line has written anything.
    const submissionId = this.newId();
    const receipt = this.issueReceipt('Your submission was received.');
    const submittedAt = this.now().toISOString();
    this.store.submissions.set(submissionId, {
      id: submissionId,
      assignmentId,
      institutionId: assignment.institutionId,
      userId: actor.userId,
      body: draft.body,
      state: 'receipt_issued',
      submittedAt,
      receiptId: receipt.id,
    });
    this.claim(actor.userId, 'submit_assignment', key, fingerprint, receipt.id);
    this.emit({
      eventType: 'submission.finalized',
      actorId: actor.userId,
      tenantId: assignment.institutionId,
      subjectId: submissionId,
      correlationId: `submission-${submissionId}`,
      payload: { submissionId, assignmentId, version: 1 },
    });
    return receipt;
  }

  /** Faculty of the course record a grade. Saved, not visible to the student. */
  async recordAssessment(actor: SubmissionActor, input: AssessInput): Promise<Receipt> {
    const submissionId = requireId(input.submissionId, 'submissionId');
    const key = requireKey(input.idempotencyKey);
    const grade = input.grade;
    if (typeof grade !== 'number' || !Number.isFinite(grade) || grade < 0 || grade > 100) {
      throw new SubmissionRefusal('invalid_input', 'grade must be a number from 0 to 100');
    }
    const feedback = requireText(input.feedback, 'feedback', FEEDBACK_LIMIT);

    const { assignment } = this.loadSubmission(actor, submissionId);
    this.teacher(actor, assignment);

    const fingerprint = fingerprintOf({ submissionId, grade, feedback });
    const replay = this.replayOrNull(actor.userId, 'record_assessment', key, fingerprint);
    if (replay) return replay;
    if (this.store.assessments.has(submissionId)) {
      throw new SubmissionRefusal('invalid_state', 'An assessment is already recorded for this submission');
    }

    const receipt = this.issueReceipt('Assessment saved. The student cannot see it until feedback is released.');
    this.store.assessments.set(submissionId, {
      submissionId,
      graderId: actor.userId,
      grade,
      feedback,
      recordedAt: this.now().toISOString(),
      releasedAt: null,
    });
    this.claim(actor.userId, 'record_assessment', key, fingerprint, receipt.id);
    return receipt;
  }

  /** The moment a grade becomes visible. Posts `grade.posted` exactly once. */
  async releaseFeedback(actor: SubmissionActor, input: ReleaseInput): Promise<Receipt> {
    const submissionId = requireId(input.submissionId, 'submissionId');
    const key = requireKey(input.idempotencyKey);

    const { submission, assignment } = this.loadSubmission(actor, submissionId);
    this.teacher(actor, assignment);

    const fingerprint = fingerprintOf({ submissionId, action: 'release' });
    const replay = this.replayOrNull(actor.userId, 'release_feedback', key, fingerprint);
    if (replay) return replay;

    const assessment = this.store.assessments.get(submissionId);
    if (!assessment) throw new SubmissionRefusal('invalid_state', 'Record an assessment before releasing feedback');
    if (assessment.releasedAt) throw new SubmissionRefusal('invalid_state', 'Feedback was already released');

    assessment.releasedAt = this.now().toISOString();
    const receipt = this.issueReceipt('Feedback released to the student.');
    this.claim(actor.userId, 'release_feedback', key, fingerprint, receipt.id);
    this.emit({
      eventType: 'grade.posted',
      actorId: actor.userId,
      tenantId: assignment.institutionId,
      subjectId: submission.id,
      correlationId: `release-${submission.id}`,
      payload: { submissionId: submission.id, assignmentId: assignment.id },
    });
    return receipt;
  }

  /** The author's view of their own feedback. Unreleased, it reports only that. */
  async readFeedback(actor: SubmissionActor, submissionId: string): Promise<FeedbackView> {
    const { submission, assignment } = this.loadSubmission(actor, requireId(submissionId, 'submissionId'));
    if (submission.userId !== actor.userId) throw new SubmissionRefusal('not_found', 'No such submission');
    this.enrolledStudent(actor, assignment);

    const assessment = this.store.assessments.get(submission.id);
    if (!assessment || !assessment.releasedAt) return { released: false };
    return { released: true, grade: assessment.grade, feedback: assessment.feedback };
  }

  /** The submitted work, for faculty of the course. Students use `readFeedback`, not this. */
  async readSubmissionForFaculty(actor: SubmissionActor, submissionId: string): Promise<FacultySubmissionView> {
    const { submission, assignment } = this.loadSubmission(actor, requireId(submissionId, 'submissionId'));
    this.teacher(actor, assignment);
    const assessment = this.store.assessments.get(submission.id);
    return {
      submissionId: submission.id,
      studentId: submission.userId,
      body: submission.body,
      submittedAt: submission.submittedAt,
      assessment: assessment
        ? { grade: assessment.grade, feedback: assessment.feedback, released: assessment.releasedAt !== null }
        : null,
    };
  }

  private loadAssignment(actor: SubmissionActor, assignmentId: string): Assignment {
    const assignment = this.store.assignments.get(assignmentId);
    if (!assignment || assignment.institutionId !== actor.institutionId) {
      throw new SubmissionRefusal('not_found', 'No such assignment');
    }
    return assignment;
  }

  private loadSubmission(actor: SubmissionActor, submissionId: string): { submission: Submission; assignment: Assignment } {
    const submission = this.store.submissions.get(submissionId);
    const assignment = submission ? this.store.assignments.get(submission.assignmentId) : undefined;
    if (!submission || !assignment || submission.institutionId !== actor.institutionId || assignment.institutionId !== actor.institutionId) {
      throw new SubmissionRefusal('not_found', 'No such submission');
    }
    return { submission, assignment };
  }

  private enrolledStudent(actor: SubmissionActor, assignment: Assignment): CourseMembership {
    const membership = this.store.membership(actor.userId, assignment.courseId);
    if (!membership || membership.institutionId !== actor.institutionId || membership.role !== 'student') {
      throw new SubmissionRefusal('not_enrolled', 'You are not enrolled as a student in this course');
    }
    if (membership.status !== 'active') {
      throw new SubmissionRefusal('membership_revoked', 'Your access to this course has been revoked');
    }
    return membership;
  }

  private teacher(actor: SubmissionActor, assignment: Assignment): CourseMembership {
    const membership = this.store.membership(actor.userId, assignment.courseId);
    if (!membership || membership.institutionId !== actor.institutionId || membership.role !== 'faculty') {
      throw new SubmissionRefusal('not_teaching', 'You do not teach this course');
    }
    if (membership.status !== 'active') {
      throw new SubmissionRefusal('membership_revoked', 'Your access to this course has been revoked');
    }
    return membership;
  }

  private refuseIfClosed(assignment: Assignment): void {
    if (this.now().getTime() > Date.parse(assignment.closesAt)) {
      throw new SubmissionRefusal('window_closed', 'The submission window for this assignment has closed');
    }
  }

  private refuseIfSubmitted(userId: string, assignmentId: string): void {
    if (this.store.submissionFor(userId, assignmentId)) {
      throw new SubmissionRefusal('already_submitted', 'You have already submitted this assignment');
    }
  }

  /** The recorded receipt for a repeated request; a refusal for a key reused with a different request. */
  private replayOrNull(userId: string, command: string, key: string, fingerprint: string): Receipt | null {
    const claim = this.store.claims.get(claimKey(userId, command, key));
    if (!claim) return null;
    if (claim.fingerprint !== fingerprint) {
      throw new SubmissionRefusal('idempotency_conflict', 'This key was already used for a different request');
    }
    const receipt = this.store.receipts.get(claim.receiptId);
    if (!receipt) throw new Error(`idempotency claim ${key} has no receipt`);
    return receipt;
  }

  private claim(userId: string, command: string, key: string, fingerprint: string, receiptId: string): void {
    this.store.claims.set(claimKey(userId, command, key), { fingerprint, receiptId });
  }

  private issueReceipt(message: string): Receipt {
    const receipt: Receipt = { id: this.newId(), status: 'completed', message, recordedAt: this.now().toISOString() };
    this.store.receipts.set(receipt.id, receipt);
    return receipt;
  }

  private emit(input: {
    eventType: 'submission.finalized' | 'grade.posted';
    actorId: string;
    tenantId: string;
    subjectId: string;
    correlationId: string;
    payload: Record<string, string | number>;
  }): void {
    this.store.outbox.append(
      makeEvent({
        eventId: this.newEventId(),
        eventType: input.eventType,
        producer: this.producer,
        environment: this.environment,
        tenantId: input.tenantId,
        actor: { id: input.actorId, type: 'user' },
        subject: { type: 'submission', id: input.subjectId },
        correlationId: input.correlationId,
        payload: input.payload,
      }),
    );
  }
}
