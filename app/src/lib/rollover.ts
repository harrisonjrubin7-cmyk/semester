/**
 * Closing a term out, so the next one starts clean and the last one counts.
 *
 * A semester ends and nothing happens. The courses stay in the switcher, their
 * deadlines fall out of Today because the dates have gone by, and the one
 * thing that should have come out of four months — a row per course in the
 * transcript the degree screen reads — never gets written, because writing it
 * means opening a different screen and typing five courses in by hand. So the
 * degree screen can only ever describe this semester, which is the least
 * interesting one it could describe.
 *
 * This is the five minutes that fixes it, offered once, at the end.
 *
 * ## What it will not do
 *
 * **It will not guess a grade.** The app holds a projection from weights a
 * model read off a syllabus; the transcript holds what the registrar actually
 * awarded, and those are different numbers with different authority. Writing
 * the projection into `taken` would put a fabricated grade into a cumulative
 * GPA and nobody would ever know. Every grade here is typed, and a course
 * without one is carried as still in progress rather than filled in.
 *
 * **It will not delete anything.** Archiving a term hides nothing: the guides,
 * cards, notes and papers stay exactly where they are, and the term switcher
 * still opens it. Archived means finished, not gone.
 *
 * **It will not carry work forward.** A new term starts empty. The alternative
 * — copying last term's courses in — produces a semester somebody has to
 * dismantle before they can build theirs.
 *
 * ## No migration, and that is not a shortcut
 *
 * The plan that asked for this expected terms to become a stored list, courses
 * to gain a `termId`, and a migration to wrap the existing single `term`. Two
 * of those three already exist: a course has carried `course.term` since terms
 * were added, with `LEGACY_TERM` as the fallback, and `state.term` is already
 * the active term id. Terms themselves are *derived* from the courses rather
 * than stored, which is why there is nothing to migrate — the only genuinely
 * new state is which terms have been closed, and an empty list of those is
 * exactly what every existing store already means.
 */

import { LEGACY_TERM, readTerm, sortTerms, termId, type Term } from './term';
import type { CourseModule } from './types';
import type { Taken } from './degree';

/** Autumn rolls into spring; spring into autumn. Summer and winter are bridges. */
const NEXT: Record<string, { code: string; sameYear: boolean }> = {
  SP: { code: 'FA', sameYear: true },
  SU: { code: 'FA', sameYear: true },
  FA: { code: 'SP', sameYear: false },
  WI: { code: 'SP', sameYear: false },
};

/**
 * The term after this one, in the ordinary two-semester rhythm.
 *
 * Summer and winter roll into the next full term rather than into each other:
 * somebody closing a summer session is going back to the autumn, and offering
 * them a winter session they do not take would be a wrong default in the one
 * place a wrong default is annoying to undo.
 */
export function nextTerm(id: string): Term {
  const t = readTerm(id);
  const season = /^\d{4}(SP|SU|FA|WI)$/i.exec(t.id)?.[1]?.toUpperCase() ?? 'FA';
  const step = NEXT[season] ?? NEXT.FA;
  return readTerm(termId(step.sameYear ? t.year : t.year + 1, step.code));
}

/** One course as it stands at the end of a term, waiting for its grade. */
export interface Closing {
  courseId: string;
  code: string;
  title: string;
  /** Credit hours, as the course states them. Zero when it says nothing. */
  hours: number;
  /** What has been typed for it so far. Empty means not yet given. */
  grade: string;
}

function hoursOf(m: CourseModule): number {
  const n = parseFloat(m.course.credits ?? '');
  return Number.isFinite(n) && n > 0 ? n : 0;
}

/** Every course in the term being closed, in the order they read. */
export function closing(modules: CourseModule[], term: string, grades: Record<string, string>): Closing[] {
  return modules
    // The same fallback the store uses to derive the term list. A course
    // saved before terms existed carries no `term` at all, and comparing
    // against an empty string quietly matched none of them — which made the
    // whole feature say "no courses in Fall 2026" for the one person it was
    // built for.
    .filter((m) => (m.course.term ?? LEGACY_TERM) === term)
    .map((m) => ({
      courseId: m.course.id,
      code: m.course.code,
      title: m.course.name,
      hours: hoursOf(m),
      grade: grades[m.course.id] ?? '',
    }))
    .sort((a, b) => a.code.localeCompare(b.code));
}

/**
 * The transcript rows a close produces.
 *
 * A course with no grade typed comes across as `current: true` rather than
 * being dropped or given a blank letter — `lib/degree.ts` already leaves those
 * out of a GPA and counts them as in progress, which is the truth about a
 * course whose grade has not been posted yet.
 */
export function asTaken(rows: Closing[], term: string): Taken[] {
  const label = readTerm(term).label;
  return rows.map((r) => ({
    id: `${term}:${r.courseId}`,
    code: r.code,
    title: r.title,
    term: label,
    hours: r.hours,
    grade: r.grade.trim(),
    current: r.grade.trim() === '',
  }));
}

/** Terms that have been closed, newest first, for a switcher to grey out. */
export function archivedTerms(ids: string[]): Term[] {
  return sortTerms(ids);
}

export function isArchived(term: string, archived: string[]): boolean {
  return archived.includes(term);
}

/** What the offer says, before anything has been typed. */
export function offerLine(rows: Closing[], term: string): string {
  const label = readTerm(term).label;
  if (rows.length === 0) return `No courses in ${label} to close out.`;
  const n = rows.length;
  return `${n} ${n === 1 ? 'course' : 'courses'} in ${label}. Put in the grades your registrar actually posted — the app will not use its own projection, because a projection is not a transcript — and they move into your record. Nothing is deleted, and ${nextTerm(term).label} starts empty.`;
}

/** What is said once grades are in, before the button is pressed. */
export function readyLine(rows: Closing[]): string {
  const graded = rows.filter((r) => r.grade.trim() !== '').length;
  const hours = rows.reduce((n, r) => n + r.hours, 0);
  if (graded === 0) {
    return `Nothing typed yet. Closing now files all ${rows.length} as still in progress, which is right if the grades have not been posted — you can put them in later.`;
  }
  if (graded < rows.length) {
    return `${graded} of ${rows.length} have a grade. The rest go in as still in progress and stay out of the GPA until you fill them in.`;
  }
  return `All ${rows.length} have a grade, ${hours} credit ${hours === 1 ? 'hour' : 'hours'} in total. They go into your record and count towards the cumulative figure.`;
}

/** What the term switcher says about a term that has been closed. */
export const ARCHIVED_LINE =
  'Closed out. Its courses are in your record, and its guides, cards, notes and papers are all still here — closing a term files it, it does not delete anything.';
