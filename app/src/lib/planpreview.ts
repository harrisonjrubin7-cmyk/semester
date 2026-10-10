import { blankCourse } from './edit';
import type { CourseModule } from './types';

/**
 * A registration plan made before an account exists.
 *
 * The plan is the student's own list — a term and the courses they are
 * considering — not an enrollment and not the registrar's record. An account
 * is what keeps the same list on another device. It is not what makes the
 * list exist.
 */

export interface PlanDraft {
  term: string;
  codes: string[];
}

export type PlanProblem = { ok: false; field: 'term' | 'courses'; error: string };
export type PlanRead = { ok: true; draft: PlanDraft } | PlanProblem;

const CODE = /^[A-Za-z]{2,8}\s+\d{2,4}[A-Za-z]?$/;

/** At most a first term's worth. More can be added on the plan itself. */
const MAX_COURSES = 12;

/**
 * Read a term and a box of course codes.
 *
 * Codes may be separated by commas or new lines. A code is a department and
 * a number, the way a student writes it ("ECON 1020"), not a sentence.
 */
export function readPlanDraft(termRaw: string, coursesRaw: string): PlanRead {
  const term = termRaw.trim().replace(/\s+/g, ' ');
  if (!term) return { ok: false, field: 'term', error: 'Name the term this plan is for.' };
  if (term.length > 40) return { ok: false, field: 'term', error: 'Use a shorter term name.' };

  const parts = coursesRaw
    .split(/[\n,]+/)
    .map((part) => part.trim().replace(/\s+/g, ' '))
    .filter(Boolean);
  if (parts.length === 0) {
    return { ok: false, field: 'courses', error: 'Add at least one course, like ECON 1020.' };
  }

  const codes: string[] = [];
  const seen = new Set<string>();
  for (const part of parts) {
    if (!CODE.test(part)) {
      return {
        ok: false,
        field: 'courses',
        error: `"${part}" is not a course code. Write it like ECON 1020.`,
      };
    }
    const code = part.toUpperCase();
    if (seen.has(code)) continue;
    seen.add(code);
    codes.push(code);
  }
  if (codes.length > MAX_COURSES) {
    return {
      ok: false,
      field: 'courses',
      error: `A first plan holds ${MAX_COURSES} courses. Add the rest from the plan.`,
    };
  }
  return { ok: true, draft: { term, codes } };
}

/**
 * One empty course per code, ids unique against courses already kept.
 *
 * Empty on purpose: a code the student typed is not a syllabus, a meeting
 * time, or a seat.
 */
/** The same course, however the file spaces or capitalizes the code. */
export function courseCodeKey(code: string): string {
  return code.trim().replace(/\s+/g, ' ').toUpperCase();
}

/**
 * Named codes the imported file does not contain.
 *
 * A match is a section whose code is the same. The returned rows are the
 * student's own codes: this does not add a section, a meeting time, or a seat.
 */
export function unmatchedNamed<T extends { code: string }>(named: readonly T[], catalog: readonly { code: string }[]): T[] {
  const present = new Set(catalog.map((course) => courseCodeKey(course.code)).filter(Boolean));
  return named.filter((course) => {
    const key = courseCodeKey(course.code);
    return key.length > 0 && !present.has(key);
  });
}

export function coursesForPlan(draft: PlanDraft, taken: Iterable<string> = []): CourseModule[] {
  const ids = [...taken];
  return draft.codes.map((code) => {
    const module = blankCourse(code, draft.term, ids);
    ids.push(module.course.id);
    return module;
  });
}
