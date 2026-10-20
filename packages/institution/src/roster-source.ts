import type { WorkflowDefinition } from './workflow.ts';

/**
 * The boundary every roster source sits behind — a SIS export, OneRoster, or
 * a transitional Clever Secure Sync connection — and the shape it must hand
 * the database.
 *
 * `supabase/migrations/20261020013100_roster_completeness_and_projection.sql`
 * is the authority: `private.roster_stage_batch` stages, `roster_validate`
 * checks the manifest, `roster_promote` makes it live and turns it into
 * course-and-term grants. This module decides the same things in TypeScript so
 * a worker names a refusal before it calls, and it does no I/O: an adapter
 * fetches, this shapes, the worker sends.
 *
 * Three rules it keeps, each tested:
 *
 *  - **Completeness is said, never assumed.** A batch is `complete`,
 *    `partial` or `unknown`. Only a complete batch can speak for absence, and
 *    even then only when the school has turned on absence-means-removal. An
 *    adapter that cannot prove it read every page says `partial`.
 *  - **Minimum data by construction.** A staged row carries only the keys
 *    the database allows for its entity. A Clever section or user carries
 *    more (email, SIS ids, demographics); none of it is copied.
 *  - **Provider ids are source ids, not identities.** A Clever user id
 *    becomes a roster `sourcedId`. Which Semester account that is comes only
 *    from an explicit binding (`roster_bind_identity`), never from email.
 */

export const ROSTER_SOURCE_VERSION = 'semester.roster-batch.v1';

export type Completeness = 'complete' | 'partial' | 'unknown';
export const COMPLETENESS: readonly Completeness[] = ['complete', 'partial', 'unknown'];

export type RosterEntity = 'orgs' | 'users' | 'classes' | 'enrollments';
export const ROSTER_ENTITIES: readonly RosterEntity[] = ['orgs', 'users', 'classes', 'enrollments'];

/** The keys each entity may carry: `private.roster_allowed_keys`, as of 20261020013100. */
export const ALLOWED_KEYS: Readonly<Record<RosterEntity, readonly string[]>> = {
  orgs: ['name', 'type', 'status', 'parentSourcedId'],
  users: ['status', 'role', 'givenName', 'familyName', 'orgSourcedIds'],
  classes: ['title', 'courseCode', 'status', 'orgSourcedId', 'termSourcedId', 'termCode'],
  enrollments: ['userSourcedId', 'classSourcedId', 'role', 'status'],
};

export interface StagedRow {
  entity: RosterEntity;
  sourcedId: string;
  payload: Record<string, unknown>;
}

/** Where a batch came from, and whose word it is. */
export interface SourceProvenance {
  connectionId: string;
  /** "clever-secure-sync", "sis-export", "oneroster-rest"… */
  sourceSystem: string;
  /** The office whose record this is: usually the registrar. Clever delivers; it is not the authority. */
  authorityOwner: string;
  /** ISO timestamp the source was read. The database refuses to promote a batch older than the live one. */
  observedAt: string;
}

export interface SourceBatch<T> {
  records: T[];
  completeness: Completeness;
  /** The source's own version or export id, when it has one. */
  sourceVersion?: string;
  /** Where the next incremental read starts. Advanced only after the batch is promoted. */
  nextCursor?: string;
  provenance: SourceProvenance;
}

/** One transport. Read-only: it fetches, and nothing it does changes the source. */
export interface RosterAdapter<T> {
  fetch(input: { connectionId: string; cursor?: string }): Promise<SourceBatch<T>>;
}

// ── Row checks: the database's, said first ──────────────────────────────────

/** Why a row would be refused by `private.roster_row_problem`, or null. */
export function rowProblem(row: StagedRow): string | null {
  if (!ROSTER_ENTITIES.includes(row.entity)) return 'unknown entity';
  if (typeof row.sourcedId !== 'string' || row.sourcedId.length < 1 || row.sourcedId.length > 200) return 'row has no sourcedId';
  if (row.payload === null || typeof row.payload !== 'object' || Array.isArray(row.payload)) return 'payload is not an object';
  for (const k of Object.keys(row.payload)) {
    if (!ALLOWED_KEYS[row.entity].includes(k)) return `key ${k} is not allowed on ${row.entity}`;
  }
  if (row.entity === 'enrollments' && (!row.payload.userSourcedId || !row.payload.classSourcedId)) {
    return 'an enrollment names a user and a class';
  }
  if (JSON.stringify(row.payload).length > 4000) return 'row is larger than 4000 characters';
  return null;
}

/** Every problem in a batch, including a sourcedId used twice for one entity. */
export function batchProblems(rows: readonly StagedRow[]): { index: number; problem: string }[] {
  const out: { index: number; problem: string }[] = [];
  const seen = new Set<string>();
  rows.forEach((row, index) => {
    const p = rowProblem(row);
    if (p) {
      out.push({ index, problem: p });
      return;
    }
    const key = `${row.entity}:${row.sourcedId}`;
    if (seen.has(key)) out.push({ index, problem: 'duplicate sourcedId in this batch' });
    seen.add(key);
  });
  return out;
}

// ── Course and term codes the projection can use ────────────────────────────

const CODE = /^[A-Z]{2,4} [0-9]{3,4}[A-Z]?$/;
const TERM = /^[0-9]{4}(FA|SP|SU)$/;

/** "BIO110", "bio 110", "BIO-110" → "BIO 110"; null when it is not a course code. */
export function normalizeCourseCode(raw: string | null | undefined): string | null {
  const m = /^\s*([A-Za-z]{2,4})[\s_-]*([0-9]{3,4}[A-Za-z]?)\s*$/.exec(raw ?? '');
  if (!m) return null;
  const code = `${m[1].toUpperCase()} ${m[2].toUpperCase()}`;
  return CODE.test(code) ? code : null;
}

/** A term code the gradebook keys on ("2026FA"), or null. */
export function termCode(raw: string | null | undefined): string | null {
  const t = (raw ?? '').trim().toUpperCase();
  return TERM.test(t) ? t : null;
}

// ── A Clever-style section, shaped into roster rows ─────────────────────────

/**
 * The fields of a Clever API v3 section this connector reads. Clever documents
 * more (subject, grade, periods, ext); none of it is copied. A section's
 * `teacher` is its primary teacher and `teachers` every teacher, co-teachers
 * included.
 */
export interface CleverSection {
  id: string;
  school?: string;
  course?: string;
  term_id?: string;
  sis_id?: string;
  name?: string;
  teacher?: string;
  teachers?: string[];
  students?: string[];
}

export interface CleverMapping {
  /** The course code for a section, e.g. from its SIS id; null leaves the class without one (no grants). */
  courseCodeOf: (s: CleverSection) => string | null;
  /** Clever term id → "2026FA"; null leaves the class without one (no grants). */
  termCodeOf: (termId: string | undefined) => string | null;
  /** Users the school says are teaching assistants rather than teachers. */
  aides?: ReadonlySet<string>;
}

/**
 * Sections → class, user and enrollment rows. A person on several sections
 * is one user row. Every teacher in `teachers` (and the primary `teacher`) is
 * enrolled as `teacher`, so co-teachers each get their own grant; anybody in
 * `aides` as `aide`.
 */
export function cleverSectionsToRows(sections: readonly CleverSection[], map: CleverMapping): StagedRow[] {
  const users = new Map<string, string>();
  const classes: StagedRow[] = [];
  const enrollments: StagedRow[] = [];
  const enrol = (user: string, cls: string, role: string) => {
    enrollments.push({ entity: 'enrollments', sourcedId: `${user}@${cls}`, payload: { userSourcedId: user, classSourcedId: cls, role, status: 'active' } });
  };
  for (const s of sections) {
    const code = map.courseCodeOf(s);
    const term = map.termCodeOf(s.term_id);
    const payload: Record<string, unknown> = { title: s.name ?? s.id, status: 'active' };
    if (code) payload.courseCode = code;
    if (term) payload.termCode = term;
    if (s.term_id) payload.termSourcedId = s.term_id;
    if (s.school) payload.orgSourcedId = s.school;
    classes.push({ entity: 'classes', sourcedId: s.id, payload });

    const teachers = [...new Set([...(s.teacher ? [s.teacher] : []), ...(s.teachers ?? [])])];
    for (const t of teachers) {
      const role = map.aides?.has(t) ? 'aide' : 'teacher';
      users.set(t, users.get(t) === 'teacher' ? 'teacher' : role);
      enrol(t, s.id, role);
    }
    for (const st of new Set(s.students ?? [])) {
      if (!users.has(st)) users.set(st, 'student');
      enrol(st, s.id, 'student');
    }
  }
  const userRows: StagedRow[] = [...users].map(([id, role]) => ({ entity: 'users', sourcedId: id, payload: { status: 'active', role } }));
  return [...userRows, ...classes, ...enrollments];
}

// ── The sync run's lifecycle ────────────────────────────────────────────────

export const ROSTER_SYNC_STATES = [
  'fetching',
  'staged',
  'validated',
  'rejected',
  'held',
  'promoted',
  'failed',
  'rolled_back',
] as const;
export type RosterSyncState = (typeof ROSTER_SYNC_STATES)[number];

/**
 * One run, from fetch to live roster. `held` is the database's removal
 * threshold waiting for a second person; `failed` is a fetch or transport
 * error, which leaves the live roster and the cursor where they were.
 */
export const ROSTER_SYNC: WorkflowDefinition<RosterSyncState> = {
  type: 'roster_sync',
  initial: 'fetching',
  terminal: ['rejected', 'failed', 'rolled_back'],
  transitions: {
    fetching: ['staged', 'failed'],
    staged: ['validated', 'rejected'],
    validated: ['held', 'promoted', 'rejected'],
    held: ['promoted', 'rejected'],
    promoted: ['rolled_back'],
    rejected: [],
    failed: [],
    rolled_back: [],
  },
  exceptional: [
    ['fetching', 'failed'],
    ['staged', 'rejected'],
    ['validated', 'rejected'],
    ['held', 'rejected'],
    ['promoted', 'rolled_back'],
  ],
};

/**
 * Whether a promoted batch can end access by absence — the database's rule,
 * said in TypeScript for the operator screen. An explicit inactive status
 * ends access whatever this answers.
 */
export function absenceCanRemove(completeness: Completeness, schoolApproved: boolean): boolean {
  return completeness === 'complete' && schoolApproved;
}

/**
 * The arguments for `private.roster_stage_batch`, minus the manifest (whose
 * digests the database computes the same way on validate). Refuses a batch
 * with any problem, so a worker never stages one the database would reject.
 */
export function stageArguments(
  tenant: string,
  batch: SourceBatch<StagedRow>,
): { ok: true; args: { want_tenant: string; want_rows: StagedRow[]; want_completeness: Completeness; want_source_version: string | null; want_observed_at: string } } | { ok: false; problems: { index: number; problem: string }[] } {
  if (!COMPLETENESS.includes(batch.completeness)) return { ok: false, problems: [{ index: -1, problem: 'completeness must be complete, partial or unknown' }] };
  const problems = batchProblems(batch.records);
  if (problems.length) return { ok: false, problems };
  return {
    ok: true,
    args: {
      want_tenant: tenant,
      want_rows: batch.records,
      want_completeness: batch.completeness,
      want_source_version: batch.sourceVersion ?? null,
      want_observed_at: batch.provenance.observedAt,
    },
  };
}
