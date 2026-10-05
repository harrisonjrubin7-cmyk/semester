/**
 * The instructor's gradebook of record: the shapes, and how a decision is
 * answered.
 *
 * This is not `lib/grades.ts`. That file is a student's own arithmetic about
 * what they need on the final, over numbers they typed in, and nothing it
 * says is a record. This directory is the faculty side: what a grader
 * entered, who checked it, when it was released, what a student contested
 * and what was done about it — the rows
 * `supabase/migrations/20260929310000_gradebook.sql` keeps, decided here the
 * way that migration decides them so a refusal is named before a call rather
 * than after one. The database is the authority; this is its mirror.
 *
 * ## Three rules every function here keeps
 *
 * - **No clock and no network inside a decision.** The time is a parameter
 *   (`at`), and the only function that talks to anything is the passback
 *   runner, which is handed its adapter.
 * - **Every mutation carries an idempotency key.** The same key with the same
 *   request replays the first answer and changes nothing; the same key with a
 *   different request, or from somebody else, is refused.
 * - **Every answer says why.** A `Decision` is either a value and a reason,
 *   or a refusal code and a reason — never a bare boolean.
 */

/** What a grader can say about a mark besides the number. */
export type Mark = 'late' | 'excused' | 'incomplete' | 'missing';
export const MARKS: readonly Mark[] = ['late', 'excused', 'incomplete', 'missing'];

/**
 * Where one version of a grade stands. A student sees only `released`; a
 * change after release is a new `draft` version, so the released one stays
 * what the student sees until the change is itself released.
 */
export type Status = 'draft' | 'moderated' | 'released';

/** What made a version. `changed` is an edit of a grade that had been released. */
export type Action = 'entered' | 'changed' | 'moderated' | 'released' | 'regraded';

/**
 * The capabilities, as the migration names them. Held at course scope
 * (`<school>/<CODE>`); export also at school scope, where the registrar's
 * grant sits. `grades:receive`, the roster, is `Gradebook.roster` here.
 */
export type GradeCapability = 'grades:enter' | 'grades:moderate' | 'grades:release' | 'grades:export';

export interface Category {
  /** Stable, lower-case: `problem-sets`. Items name their category by it. */
  key: string;
  name: string;
  /** Percent of the final grade. The categories' weights sum to exactly 100. */
  weight: number;
  /** How many of the lowest-scoring items to leave out. Never all of them. */
  dropLowest: number;
}

export interface LetterStep {
  letter: string;
  /** The lowest percentage that earns it. Strictly descending; the last is 0. */
  min: number;
}

export interface Scheme {
  categories: readonly Category[];
  letters: readonly LetterStep[];
  /** A second person must moderate a grade before it can be released. */
  moderationRequired: boolean;
}

export interface Item {
  id: string;
  categoryKey: string;
  title: string;
  pointsPossible: number;
  /** The LMS line item this passes back to, when there is one. */
  lineItem: string | null;
}

/** One version of one student's grade on one item. Never edited, only followed. */
export interface Entry {
  id: string;
  itemId: string;
  studentId: string;
  version: number;
  score: number | null;
  mark: Mark | null;
  comment: string;
  status: Status;
  action: Action;
  /** Who set this score — carried forward by moderation and release. */
  gradedBy: string;
  /** Who made this version. */
  actor: string;
  reason: string;
  /** The regrade request this version answers, when it answers one. */
  regradeId: string | null;
  operation: string;
  at: string;
}

export interface RegradeRequest {
  id: string;
  itemId: string;
  studentId: string;
  /** The released version the student contested. */
  contestedEntry: string;
  reason: string;
  at: string;
}

export interface RegradeResolution {
  requestId: string;
  outcome: 'upheld' | 'changed';
  note: string;
  /** The new draft version, when the outcome changed the grade. */
  entryId: string | null;
  resolvedBy: string;
  at: string;
}

/** What an idempotency key was spent on, and what it answered. */
export interface Operation {
  actor: string;
  kind: string;
  request: string;
  result: unknown;
}

export interface Gradebook {
  course: string;
  term: string;
  scheme: Scheme;
  items: readonly Item[];
  /** Who receives grades here: a live student grant on this course. */
  roster: ReadonlySet<string>;
  entries: readonly Entry[];
  regrades: readonly RegradeRequest[];
  resolutions: readonly RegradeResolution[];
  operations: Readonly<Record<string, Operation>>;
}

/** The person asking, with the capabilities verified for this course. */
export interface Actor {
  id: string;
  capabilities: readonly GradeCapability[];
}

export type Refusal =
  | 'not-authorised'
  | 'bad-key'
  | 'key-reused'
  | 'unknown-item'
  | 'not-on-roster'
  | 'self-grade'
  | 'bad-score'
  | 'reason-required'
  | 'unchanged'
  | 'nothing-to-moderate'
  | 'self-moderation'
  | 'nothing-to-release'
  | 'no-released-grade'
  | 'regrade-open'
  | 'unknown-request'
  | 'already-resolved'
  | 'bad-scheme';

export type Decision<T> =
  | { ok: true; value: T; reason: string; replayed: boolean }
  | { ok: false; refusal: Refusal; reason: string };

export const refuse = (refusal: Refusal, reason: string): { ok: false; refusal: Refusal; reason: string } => ({
  ok: false,
  refusal,
  reason,
});

export const holds = (a: Actor, c: GradeCapability): boolean => a.capabilities.includes(c);
