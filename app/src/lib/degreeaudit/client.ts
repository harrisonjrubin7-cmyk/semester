/**
 * The official degree audit, typed, over the account service.
 *
 * `supabase/migrations/20261001040000_degree_audit.sql` is the authority: who
 * writes and publishes a program's requirements, which catalog year a student
 * is held to, the engine that reads the academic-record ledger, and the
 * two-person rule on waivers and substitutions, all only while the school runs
 * `degree_audit` in Core (`lib/modulemode.ts`). This file asks.
 *
 * `lib/degree.ts` is a student's own Path Snapshot, a planning estimate
 * labelled as one. Nothing here reads or changes it. The audit is a rule
 * applied to a record: it cites the courses behind every line, predicts
 * nothing, and no model decides any of it.
 */

import { cloud } from '../cloud';
import type { Grant } from '../capabilities';
import { serviceError } from '../attempt';

type Row = Record<string, unknown>;
const text = (v: unknown): string => (v == null ? '' : String(v));
const rows = (data: unknown): Row[] => (Array.isArray(data) ? (data as Row[]) : []);
const num = (v: unknown): number | null => (v == null || v === '' || Number.isNaN(Number(v)) ? null : Number(v));

export type DegreeCapability = 'degree:author' | 'degree:declare' | 'degree:propose' | 'degree:approve' | 'degree:read';

/** The degree capabilities this person holds over exactly their school. */
export function degreeCapabilities(grants: readonly Grant[], school: string): Set<DegreeCapability> {
  const held = new Set<DegreeCapability>();
  if (school === '') return held;
  for (const g of grants) {
    if (g.scopeKind === 'school' && g.scopeId === school && g.capability.startsWith('degree:')) held.add(g.capability as DegreeCapability);
  }
  return held;
}

export interface GroupDraft {
  name: string;
  kind: 'all' | 'n_of' | 'credits';
  need?: number;
  rules: { course?: string; prefix?: string; min?: number; max?: number }[];
}

const COURSE = /^[A-Z]{2,4} [0-9]{3,4}[A-Z]?$/;
const PREFIX = /^[A-Z]{2,4}$/;

/**
 * Requirements as an author types them, one group per line:
 *
 *     Core | all | ECON 1010, ECON 1020
 *     Electives | 2 of | ECON 2000-4999
 *     Breadth | 6 credits | HIST, ECON 2000-4999
 *
 * A rule is a course (`ECON 1010`), a subject (`HIST`) or a subject with a
 * number range (`ECON 2000-4999`). Returns the groups or the first line that is
 * not one, said by number; the database re-checks every part.
 */
export function parseGroups(input: string): { groups: GroupDraft[] } | { error: string } {
  const groups: GroupDraft[] = [];
  const lines = input.split('\n').map((l) => l.trim()).filter((l) => l !== '');
  if (lines.length === 0) return { error: 'Write at least one requirement group.' };
  for (const [i, line] of lines.entries()) {
    const at = `Line ${i + 1}`;
    const parts = line.split('|').map((p) => p.trim());
    if (parts.length !== 3 || parts[0] === '') return { error: `${at}: write “Name | all, 2 of or 6 credits | rules”.` };
    const [name, how, ruleText] = parts;
    const kindMatch = /^(all|([0-9]{1,3}) of|([0-9]+(?:\.[0-9]+)?) credits)$/i.exec(how);
    if (!kindMatch) return { error: `${at}: the second part is “all”, “2 of” or “6 credits”.` };
    const rules: GroupDraft['rules'] = [];
    for (const raw of ruleText.split(',').map((r) => r.trim().toUpperCase()).filter((r) => r !== '')) {
      const range = /^([A-Z]{2,4})(?: ([0-9]{1,4})-([0-9]{1,4}))?$/.exec(raw);
      if (COURSE.test(raw)) rules.push({ course: raw });
      else if (range && PREFIX.test(range[1])) {
        const min = range[2] === undefined ? undefined : Number(range[2]);
        const max = range[3] === undefined ? undefined : Number(range[3]);
        if (min !== undefined && max !== undefined && min > max) return { error: `${at}: “${raw}” has its range backwards.` };
        rules.push({ prefix: range[1], ...(min === undefined ? {} : { min }), ...(max === undefined ? {} : { max }) });
      } else return { error: `${at}: “${raw}” is not a course, a subject or a subject with a range.` };
    }
    if (rules.length === 0) return { error: `${at}: a group needs at least one rule.` };
    if (kindMatch[1].toLowerCase() === 'all') groups.push({ name, kind: 'all', rules });
    else if (kindMatch[2] !== undefined) groups.push({ name, kind: 'n_of', need: Number(kindMatch[2]), rules });
    else groups.push({ name, kind: 'credits', need: Number(kindMatch[3]), rules });
  }
  return { groups };
}

export interface Version {
  id: string;
  program: string;
  programName: string;
  kind: string;
  catalogYear: number;
  totalCredits: number;
  minGpa: number;
  status: 'draft' | 'published';
}

export async function loadVersions(school: string): Promise<Version[]> {
  const db = await cloud();
  const { data: progs, error: pe } = await db.from('degree_programs').select('id,code,name,kind').eq('tenant_id', school);
  if (pe) throw serviceError(pe, 'The programs could not be read.');
  const { data, error } = await db
    .from('degree_versions')
    .select('id,program_id,catalog_year,total_credits,min_gpa,status')
    .eq('tenant_id', school).order('catalog_year', { ascending: false });
  if (error) throw serviceError(error, 'The catalog years could not be read.');
  const by = new Map(rows(progs).map((p) => [text(p.id), p]));
  return rows(data).flatMap((r) => {
    const p = by.get(text(r.program_id));
    if (!p) return [];
    return [{
      id: text(r.id), program: text(p.code), programName: text(p.name), kind: text(p.kind), catalogYear: Number(r.catalog_year) || 0,
      totalCredits: Number(r.total_credits) || 0, minGpa: Number(r.min_gpa) || 0, status: r.status === 'published' ? 'published' as const : 'draft' as const,
    }];
  }).sort((a, b) => a.program.localeCompare(b.program) || b.catalogYear - a.catalogYear);
}

export interface Exception {
  id: string;
  studentRef: string;
  versionId: string;
  groupId: string;
  kind: 'waive' | 'substitute';
  courseCode: string;
  credits: number | null;
  reason: string;
  status: 'proposed' | 'approved' | 'rejected';
  note: string;
  proposedAt: string;
  mine: boolean;
}

export async function loadExceptions(school: string, student: string, me: string): Promise<Exception[]> {
  const db = await cloud();
  const { data, error } = await db
    .from('degree_exceptions')
    .select('id,student_ref,version_id,group_id,kind,course_code,credits,reason,status,note,proposed_at,proposed_by')
    .eq('tenant_id', school).eq('student_ref', student).order('proposed_at', { ascending: false });
  if (error) throw serviceError(error, 'The exceptions could not be read.');
  return rows(data).map((r) => ({
    id: text(r.id), studentRef: text(r.student_ref), versionId: text(r.version_id), groupId: text(r.group_id),
    kind: r.kind === 'substitute' ? 'substitute' : 'waive', courseCode: text(r.course_code), credits: num(r.credits), reason: text(r.reason),
    status: r.status === 'approved' ? 'approved' : r.status === 'rejected' ? 'rejected' : 'proposed', note: text(r.note), proposedAt: text(r.proposed_at),
    mine: me !== '' && text(r.proposed_by) === me,
  }));
}

/** The record reference the school has linked to this account, if it has. */
export async function myStudentRef(school: string): Promise<string | null> {
  const db = await cloud();
  const { data, error } = await db.from('academic_record_subjects').select('student_ref').eq('tenant_id', school).limit(1);
  if (error) throw serviceError(error, 'Your record link could not be read.');
  const first = rows(data)[0];
  return first ? text(first.student_ref) : null;
}

export interface AuditGroup {
  position: number;
  name: string;
  kind: 'all' | 'n_of' | 'credits';
  need: number;
  have: number;
  met: boolean;
  waived: boolean;
  courses: string[];
  substituted: string[];
}

export interface Audit {
  program: string;
  programName: string;
  catalogYear: number;
  asOf: string;
  status: 'complete' | 'in_progress';
  credits: { have: number; need: number; met: boolean };
  gpa: { have: number | null; need: number; met: boolean };
  groups: AuditGroup[];
  unmet: string[];
  unused: string[];
  warnings: string[];
  whatIf: boolean;
  saved: string | null;
  version: string;
}

const strings = (v: unknown): string[] => (Array.isArray(v) ? v.map(text) : []);

export function readAudit(data: unknown): Audit {
  const r = (data ?? {}) as Row;
  const c = (r.credits ?? {}) as Row;
  const g = (r.gpa ?? {}) as Row;
  return {
    program: text(r.program), programName: text(r.program_name), catalogYear: Number(r.catalog_year) || 0, asOf: text(r.as_of),
    status: r.status === 'complete' ? 'complete' : 'in_progress',
    credits: { have: Number(c.have) || 0, need: Number(c.need) || 0, met: c.met === true },
    gpa: { have: num(g.have), need: Number(g.need) || 0, met: g.met === true },
    groups: Array.isArray(r.groups) ? (r.groups as Row[]).map((x) => ({
      position: Number(x.position) || 0, name: text(x.name), kind: x.kind === 'n_of' ? 'n_of' as const : x.kind === 'credits' ? 'credits' as const : 'all' as const,
      need: Number(x.need) || 0, have: Number(x.have) || 0, met: x.met === true, waived: x.waived === true,
      courses: strings(x.courses), substituted: strings(x.substituted),
    })) : [],
    unmet: strings(r.unmet), unused: strings(r.unused), warnings: strings(r.warnings),
    whatIf: r.what_if === true, saved: r.saved == null ? null : text(r.saved), version: text(r.version),
  };
}

/** A group's requirement in words: “all 2 courses”, “2 courses”, “6 credits”. */
export function needWords(g: Pick<AuditGroup, 'kind' | 'need'>): string {
  if (g.kind === 'credits') return `${g.need} credit${g.need === 1 ? '' : 's'}`;
  return g.kind === 'all' ? `all ${g.need} course${g.need === 1 ? '' : 's'}` : `${g.need} course${g.need === 1 ? '' : 's'}`;
}

export async function runAudit(student: string, version: string | null, save: boolean, key: string): Promise<Audit> {
  const db = await cloud();
  const { data, error } = await db.rpc('degree_audit_run', { want_student: student, want_version: version, want_save: save, want_key: key });
  if (error) throw serviceError(error, 'The audit could not be run.');
  return readAudit(data);
}

export async function saveVersion(
  v: { program: string; name: string; kind: 'major' | 'minor' | 'certificate'; year: number; total: number; minGpa: number; groups: GroupDraft[] }, key: string,
): Promise<string> {
  const db = await cloud();
  const { data, error } = await db.rpc('degree_version_save', {
    want_program: v.program, want_name: v.name, want_kind: v.kind, want_year: v.year, want_total: v.total, want_min_gpa: v.minGpa,
    want_groups: v.groups.map((g) => ({ name: g.name, kind: g.kind, need: g.need, rules: g.rules })), want_key: key,
  });
  if (error) throw serviceError(error, 'The catalog year was not saved.');
  return text(((data ?? {}) as Row).id);
}

export async function publishVersion(id: string, key: string): Promise<void> {
  const db = await cloud();
  const { error } = await db.rpc('degree_version_publish', { want_id: id, want_key: key });
  if (error) throw serviceError(error, 'The catalog year was not published.');
}

export async function declareStudent(student: string, version: string, key: string): Promise<void> {
  const db = await cloud();
  const { error } = await db.rpc('degree_declare', { want_student: student, want_version: version, want_key: key });
  if (error) throw serviceError(error, 'The student was not held to that catalog year.');
}

export async function proposeException(
  e: { student: string; version: string; position: number; kind: 'waive' | 'substitute'; course: string; credits: number | null; reason: string }, key: string,
): Promise<void> {
  const db = await cloud();
  const { error } = await db.rpc('degree_exception_propose', {
    want_student: e.student, want_version: e.version, want_position: e.position, want_kind: e.kind,
    want_course: e.kind === 'substitute' ? e.course : null, want_credits: e.kind === 'substitute' ? e.credits : null, want_reason: e.reason, want_key: key,
  });
  if (error) throw serviceError(error, 'The exception was not proposed.');
}

export async function decideException(id: string, approve: boolean, note: string, key: string): Promise<void> {
  const db = await cloud();
  const { error } = await db.rpc('degree_exception_decide', { want_exception: id, want_approve: approve, want_note: note, want_key: key });
  if (error) throw serviceError(error, 'The exception was not decided.');
}
