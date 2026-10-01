/**
 * The degree audit's reads and writes, typed, over the account service.
 *
 * Every function is one RPC or one table, and
 * `supabase/migrations/20260930250000_degree_audit.sql` is the authority: who
 * may author, who may audit whom, which mode the school is in, what a
 * published program may no longer do, what an audit reads and keeps, and the
 * idempotency are all decided there. Row-level security decides what a read
 * returns: a student reads the published programs of their own school and the
 * audits of the record the school linked to their account and nothing else; an
 * advisor, a dean or a registrar reads every audit at the school.
 *
 * Every writer here *raises* to refuse. A refusal arrives as a thrown
 * `ServiceError` carrying the server's sentence (`answered: true`), and a
 * network failure as one with `answered: false`, whose outcome is unknown and
 * whose retry must keep its key (`lib/attempt.ts`).
 *
 * This is not `lib/degree.ts`, and nothing here reads or writes it.
 */

import { cloud } from '../cloud';
import type { Grant } from '../capabilities';
import { serviceError } from '../attempt';
import type { AuditResult, CourseResult, Item, RequirementResult, Unmet, Verdict } from './audit';
import type { AuditRecord, DegreeCapability, Program, ProgramState } from './model';

type Row = Record<string, unknown>;
const text = (v: unknown): string => (v == null ? '' : String(v));
const num = (v: unknown): number => (typeof v === 'number' ? v : Number.parseFloat(text(v)) || 0);
const maybe = (v: unknown): string | null => (v == null || v === '' ? null : String(v));
const rows = (data: unknown): Row[] => (Array.isArray(data) ? (data as Row[]) : []);
const isRow = (v: unknown): v is Row => !!v && typeof v === 'object' && !Array.isArray(v);
const strings = (v: unknown): string[] => (Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : []);

// ── Who is looking, from their grants ────────────────────────────────────

/** The degree capabilities this person holds on their own school. A grant on anything else is not one. */
export function degreeCapabilities(grants: readonly Grant[], school: string): DegreeCapability[] {
  const held = new Set<string>();
  for (const g of grants) if (school !== '' && g.scopeKind === 'school' && g.scopeId === school) held.add(g.capability);
  return (['degree:audit', 'degree:author'] as const).filter((c) => held.has(c));
}

// ── Reading ──────────────────────────────────────────────────────────────

const STATES: readonly ProgramState[] = ['draft', 'published', 'retired'];

export function readProgram(r: Row): Program {
  const state = STATES.includes(r.state as ProgramState) ? (r.state as ProgramState) : 'retired';
  return {
    id: text(r.id),
    code: text(r.code),
    title: text(r.title),
    catalogYear: num(r.catalog_year),
    version: num(r.version),
    state,
    passingGrades: strings(r.passing_grades),
    publishedAt: maybe(r.published_at),
  };
}

const VERDICTS: readonly Verdict[] = ['complete', 'complete_if_in_progress_passes', 'incomplete'];

function readItem(v: unknown): Item | null {
  if (!isRow(v)) return null;
  return {
    key: text(v.key),
    code: text(v.code),
    term: text(v.term),
    source: v.source === 'transfer' ? 'transfer' : 'course',
    grade: maybe(v.grade),
    hours: v.hours == null ? null : num(v.hours),
  };
}

const items = (v: unknown): Item[] => (Array.isArray(v) ? v.map(readItem).filter((x): x is Item => x !== null) : []);

function readRequirement(v: unknown): RequirementResult | null {
  if (!isRow(v)) return null;
  return {
    sort: num(v.sort),
    name: text(v.name),
    need: v.need === 'hours' ? 'hours' : 'courses',
    count: num(v.count),
    min_grade: maybe(v.min_grade),
    accepts: strings(v.accepts),
    have: num(v.have),
    will_have: num(v.will_have),
    left: num(v.left),
    met: v.met === true,
    meets_after: v.meets_after === true,
    done: items(v.done),
    doing: items(v.doing),
    unmet_grade: (Array.isArray(v.unmet_grade) ? v.unmet_grade : []).flatMap((u): Unmet[] => {
      const i = readItem(u);
      return i && isRow(u) ? [{ ...i, why: u.why === 'no_grade' ? 'no_grade' : 'below_minimum' }] : [];
    }),
  };
}

const REASONS = ['no_course_code', 'grade_not_passing', 'no_grade_or_enrollment', 'hours_unreadable'] as const;

function readCourse(v: unknown): CourseResult | null {
  const i = readItem(v);
  if (!i || !isRow(v)) return null;
  const state = v.state === 'done' || v.state === 'in_progress' ? v.state : 'not_counted';
  const reason = REASONS.find((x) => x === v.reason) ?? null;
  return { ...i, state, reason, counted_in: strings(v.counted_in) };
}

/**
 * What the database kept as the result, or null when it is not in a shape this
 * build knows. A screen that cannot read an audit says so; it never shows a
 * verdict of its own in place of the one that was kept.
 */
export function readResult(v: unknown): AuditResult | null {
  if (!isRow(v) || !VERDICTS.includes(v.verdict as Verdict) || !Array.isArray(v.requirements) || !Array.isArray(v.courses)) return null;
  const requirements = v.requirements.map(readRequirement);
  const courses = v.courses.map(readCourse);
  if (requirements.some((r) => r === null) || courses.some((c) => c === null)) return null;
  return {
    verdict: v.verdict as Verdict,
    requirements: requirements as RequirementResult[],
    courses: courses as CourseResult[],
  };
}

export function readAudit(r: Row): AuditRecord {
  const verdict = VERDICTS.includes(r.verdict as Verdict) ? (r.verdict as Verdict) : 'incomplete';
  return {
    id: text(r.id),
    studentRef: text(r.student_ref),
    programId: text(r.program_id),
    programCode: text(r.program_code),
    programTitle: text(r.program_title),
    catalogYear: num(r.catalog_year),
    programVersion: num(r.program_version),
    asOf: text(r.as_of),
    requestedBy: maybe(r.requested_by),
    requestedAt: text(r.requested_at),
    inputsSha256: text(r.inputs_sha256),
    inputsCount: num(r.inputs_count),
    verdict,
    result: readResult(r.result),
  };
}

const PROGRAM_COLUMNS = 'id,code,title,catalog_year,version,state,passing_grades,published_at';
const AUDIT_COLUMNS =
  'id,student_ref,program_id,program_code,program_title,catalog_year,program_version,as_of,requested_by,requested_at,inputs_sha256,inputs_count,verdict,result';

/** The programs this person may read: published and retired ones at their school, and drafts too for an author. */
export async function loadPrograms(): Promise<Program[]> {
  const db = await cloud();
  const { data, error } = await db
    .from('degree_programs')
    .select(PROGRAM_COLUMNS)
    .order('catalog_year', { ascending: false })
    .order('code')
    .order('version', { ascending: false });
  if (error) throw serviceError(error, 'Could not load your school’s degree programs.');
  return rows(data).map(readProgram);
}

/** The audits kept for one student reference, newest first. Row-level security says which of them this caller may read. */
export async function loadAudits(studentRef: string): Promise<AuditRecord[]> {
  const db = await cloud();
  const { data, error } = await db
    .from('degree_audits')
    .select(AUDIT_COLUMNS)
    .eq('student_ref', studentRef)
    .order('requested_at', { ascending: false })
    .limit(50);
  if (error) throw serviceError(error, 'Could not load the audits.');
  return rows(data).map(readAudit);
}

/**
 * The student reference the school linked to this account, or null when it has
 * not. The link is made by the school's record approvers
 * (`academic_record_subjects`); a student cannot make or change it, and an
 * audit of any other reference is refused by the database.
 */
export async function myStudentRef(me: string): Promise<string | null> {
  const db = await cloud();
  const { data, error } = await db.from('academic_record_subjects').select('student_ref').eq('user_id', me).limit(1);
  if (error) throw serviceError(error, 'Could not read which academic record is yours.');
  const first = rows(data)[0];
  return first ? maybe(first.student_ref) : null;
}

// ── Running an audit ─────────────────────────────────────────────────────

/**
 * Audit one student reference against one published program as of a date. The
 * answer is the kept audit's id; a replay of the same key answers the same id.
 * Nothing is written to the academic record.
 */
export async function runAudit(programId: string, studentRef: string, asOf: string, key: string): Promise<string> {
  const db = await cloud();
  const { data, error } = await db.rpc('degree_audit_run', {
    want_program: programId,
    want_student_ref: studentRef,
    want_as_of: asOf,
    want_key: key,
  });
  if (error) throw serviceError(error, 'The audit was not run.');
  return text(data);
}

// ── The author's writers ─────────────────────────────────────────────────
//
// The screen does not offer these yet: a program is authored through the
// database's own functions, and an authoring screen is the next slice. They
// are here, typed and held to the migration's argument names, so that slice
// has nothing to guess.

export interface RequirementDraft {
  name: string;
  need: 'courses' | 'hours';
  count: number;
  accepts: string[];
  minGrade: string | null;
}

/** Returns the new draft's id. `copyFrom` starts it with an earlier version's requirements. */
export async function createProgram(
  code: string,
  title: string,
  catalogYear: number,
  passingGrades: string[] | null,
  copyFrom: string | null,
  key: string,
): Promise<string> {
  const db = await cloud();
  const { data, error } = await db.rpc('degree_program_create', {
    want_code: code,
    want_title: title,
    want_catalog_year: catalogYear,
    want_passing: passingGrades,
    want_copy_from: copyFrom,
    want_key: key,
  });
  if (error) throw serviceError(error, 'The program was not created.');
  return text(data);
}

export async function addRequirement(programId: string, d: RequirementDraft, key: string): Promise<string> {
  const db = await cloud();
  const { data, error } = await db.rpc('degree_requirement_add', {
    want_program: programId,
    want_name: d.name,
    want_need: d.need,
    want_count: d.count,
    want_accepts: d.accepts,
    want_min_grade: d.minGrade,
    want_key: key,
  });
  if (error) throw serviceError(error, 'The requirement was not added.');
  return text(data);
}

export async function publishProgram(programId: string, key: string): Promise<void> {
  const db = await cloud();
  const { error } = await db.rpc('degree_program_publish', { want_program: programId, want_key: key });
  if (error) throw serviceError(error, 'The program was not published.');
}

export async function retireProgram(programId: string, key: string): Promise<void> {
  const db = await cloud();
  const { error } = await db.rpc('degree_program_retire', { want_program: programId, want_key: key });
  if (error) throw serviceError(error, 'The program was not retired.');
}
