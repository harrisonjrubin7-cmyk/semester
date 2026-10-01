/**
 * What a kept degree audit says, in words, and what a form may ask before it
 * asks the database.
 *
 * Pure: it takes the result the database kept and the form's own fields, and
 * returns sentences and problems. It computes no verdict of its own. The
 * verdict, every figure and every list a screen prints were worked out by the
 * database (`private.degree_audit_compute`) and kept; this only phrases them.
 *
 * ## The two things it will not say
 *
 * It never calls a program "complete" as though a degree were conferred: the
 * audit does not read the conferral on the record, and "complete" means the
 * requirements the school published are met by what the record shows on the
 * date. And it never rolls in-progress work into done: they are two figures,
 * always, for the reason `lib/degree.ts` gives — rolling them together is how
 * somebody arrives at their last semester one course short.
 */
import { formatNumber } from '../locale';
import { STUDENT_REF } from '../record/ledger';
import type { CourseResult, Item, NotCounted, RequirementResult, Verdict } from './audit';

const n = (v: number): string => formatNumber(v, { maximumFractionDigits: 2 });

export const VERDICT_TEXT: Record<Verdict, string> = {
  complete: 'Every requirement of this program is met by what the record shows on this date.',
  complete_if_in_progress_passes:
    'Not every requirement is met yet. Each one that is not would be met if the courses in progress are passed.',
  incomplete: 'Some requirements are not met, even counting the courses in progress.',
};

export const VERDICT_LABEL: Record<Verdict, string> = {
  complete: 'Requirements met',
  complete_if_in_progress_passes: 'Met if in-progress courses pass',
  incomplete: 'Requirements outstanding',
};

/** The unit that agrees with what is *needed*: "1 of 2 course" is the fault this avoids. */
function unit(r: RequirementResult): string {
  return r.need === 'hours' ? 'hours' : r.count === 1 ? 'course' : 'courses';
}

/** One requirement's line: finished, then in progress, then what is left. */
export function requirementLine(r: RequirementResult): string {
  const u = unit(r);
  if (r.met) return `Met: ${n(r.have)} of ${n(r.count)} ${u} finished.`;
  const doing = r.will_have - r.have;
  const head = `${n(r.have)} of ${n(r.count)} ${u} finished`;
  if (r.meets_after) return `${head}, and ${n(doing)} in progress would cover the rest.`;
  if (doing > 0) return `${head}, ${n(doing)} in progress, ${n(r.left)} still to find.`;
  return `${head}. ${n(r.left)} still to find.`;
}

/** What a requirement accepts, in the school's own codes. */
export function acceptsLine(r: RequirementResult): string {
  const what = r.accepts.length === 0 ? 'Any course' : r.accepts.join(', ');
  return r.min_grade ? `${what}, with a grade of ${r.min_grade} or better` : what;
}

/** One counted course: which, with what grade, for how many hours. */
export function courseLine(i: Item): string {
  const grade = i.source === 'transfer' ? 'transfer credit' : i.grade ? `grade ${i.grade}` : 'in progress';
  const hours = i.hours === null ? 'hours not on the record' : `${n(i.hours)} ${i.hours === 1 ? 'hour' : 'hours'}`;
  return `${i.key}: ${grade}, ${hours}`;
}

/** Why a line on the record was not counted. */
export const NOT_COUNTED_TEXT: Record<NotCounted, string> = {
  no_course_code: 'It names no course, so the audit could not place it.',
  grade_not_passing: 'Its grade is not one of the passing grades the school listed for this program.',
  no_grade_or_enrollment: 'The record has credit hours for it but no grade and no enrollment.',
  hours_unreadable: 'The hours on the record are not a number the audit can read.',
};

/** A kept requirement's note on finished courses its minimum grade kept out. */
export function unmetLine(i: Item & { why: 'below_minimum' | 'no_grade' }, min: string | null): string {
  return i.why === 'no_grade'
    ? `${i.key}: transfer credit has no grade, so it cannot meet a minimum of ${min ?? 'a grade'}.`
    : `${i.key}: grade ${i.grade ?? ''} is below the minimum of ${min ?? 'a grade'}.`;
}

/** Courses that counted in more than one requirement: double counting, stated and not silently applied. */
export function doubleCounted(courses: readonly CourseResult[]): CourseResult[] {
  return courses.filter((c) => c.counted_in.length > 1);
}

/** Finished or in-progress courses that counted towards nothing: a free elective, or a requirement not written down. */
export function countedNowhere(courses: readonly CourseResult[]): CourseResult[] {
  return courses.filter((c) => c.state !== 'not_counted' && c.counted_in.length === 0);
}

/** Lines the audit read and did not count, each with its reason. */
export function notCounted(courses: readonly CourseResult[]): CourseResult[] {
  return courses.filter((c) => c.state === 'not_counted');
}

/** The first twelve characters of the digest of what was read, for a person to compare. */
export function fingerprint(sha256: string): string {
  return sha256.slice(0, 12);
}

/** Today as `YYYY-MM-DD` in the caller's own calendar: what the date field holds and what an audit is "as of". */
export function todayIso(now: Date): string {
  const p = (x: number): string => String(x).padStart(2, '0');
  return `${now.getFullYear()}-${p(now.getMonth() + 1)}-${p(now.getDate())}`;
}

/** What is wrong with the as-of date, in the form's words, before the database is asked. */
export function asOfProblem(asOf: string, today: string): string | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(asOf) || Number.isNaN(Date.parse(asOf))) return 'Give the date the audit is as of.';
  if (asOf > today) return 'An audit is as of today or an earlier date, never a later one.';
  if (asOf < '1900-01-01') return 'That is not a date an audit can be as of.';
  return null;
}

/** What is wrong with a student reference, as the migration's check allows it. */
export function studentRefProblem(ref: string): string | null {
  if (ref.trim() === '') return 'Give the student’s reference, as your school writes it.';
  if (!STUDENT_REF.test(ref.trim())) return 'A student reference is letters, digits, dots, dashes or underscores, up to 64.';
  return null;
}
