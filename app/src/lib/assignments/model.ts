/**
 * The vocabulary of assignments and submissions, typed.
 *
 * `supabase/migrations/20261001094000_assignments.sql` is the authority on
 * every limit and every state here, and `assignments.test.ts` reads that file
 * and holds these constants equal to it. They exist so a screen can refuse
 * before a call — a title of 201 characters is named before it is sent — and
 * never so a screen can allow what the database would not.
 *
 * This is not `lib/assignment.ts`, which is a student's own planner over work
 * they typed in. Nothing here reads or writes it.
 */

/** A limit the database enforces, repeated so a screen can name it first. */
export const LIMITS = {
  title: 200,
  instructions: 20000,
  reason: 500,
  body: 50000,
  versionsMax: 20,
  versionsDefault: 5,
} as const;

export type Status = 'draft' | 'published' | 'closed';

export const STATUSES: readonly Status[] = ['draft', 'published', 'closed'];

export const STATUS_TEXT: Record<Status, string> = {
  draft: 'Draft',
  published: 'Published',
  closed: 'Closed',
};

/** The two capabilities the database checks on a course and term. */
export type AssignmentCapability = 'assignments:author' | 'assignments:review';

export interface Assignment {
  id: string;
  course: string;
  term: string;
  title: string;
  instructions: string;
  dueAt: string;
  /** Null when work is accepted, marked late, until somebody closes it. */
  closesAt: string | null;
  allowResubmission: boolean;
  maxVersions: number;
  status: Status;
  createdAt: string;
  publishedAt: string | null;
  closedAt: string | null;
}

/** One student's own due time, with the reason it was moved. */
export interface Extension {
  id: string;
  assignmentId: string;
  studentId: string;
  dueAt: string;
  closesAt: string | null;
  reason: string;
  at: string;
}

/** One version of a student's work. Nothing about it is ever changed. */
export interface Version {
  id: string;
  submissionId: string;
  assignmentId: string;
  studentId: string;
  version: number;
  body: string;
  contentSha256: string;
  dueAtThen: string;
  late: boolean;
  submittedAt: string;
}

/** What the student keeps: proof of what was taken, and when. */
export interface Receipt {
  id: string;
  versionId: string;
  assignmentId: string;
  studentId: string;
  code: string;
  contentSha256: string;
  submittedAt: string;
  dueAtThen: string;
  late: boolean;
}

export interface AssignmentEvent {
  id: string;
  assignmentId: string;
  action: 'created' | 'revised' | 'published' | 'closed' | 'extended';
  actor: string | null;
  at: string;
}

/** What `submissions_submit` answered. */
export interface Submitted {
  version: number;
  receipt: string;
  submittedAt: string;
  late: boolean;
}

/** The fields an instructor sets on an assignment. Times are ISO strings. */
export interface Draft {
  title: string;
  instructions: string;
  dueAt: string;
  closesAt: string | null;
  allowResubmission: boolean;
  maxVersions: number;
}
