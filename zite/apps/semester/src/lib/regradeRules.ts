// Regrade rules (pilot workflow "Resolve regrade"). Pure functions, unit-tested in tests/regrade.test.ts.
export const GRADES = ['A', 'A-', 'B+', 'B', 'B-', 'C+', 'C', 'C-', 'D', 'F', 'W', 'I'] as const;
export type Outcome = 'Grade Changed' | 'Grade Upheld';

/** Returns why a student may not request a regrade, or null when they may. */
export function requestBlocker(e: { studentId: string | null; released: boolean; grade: string }, uid: string, openRequest: boolean): string | null {
  if (e.studentId !== uid) return 'You can only ask for a regrade of your own grade.';
  if (!e.released || !e.grade) return 'Only released grades can be regraded. Until release, talk to your instructor.';
  if (openRequest) return 'You already have an open regrade request for this course.';
  return null;
}

/** Returns why this person may not decide the request, or null when they may.
 *  Deciders: an instructor of the section, or registrar staff (Staff/Administrator). Never the student. */
export function decideBlocker(p: { deciderId: string; studentId: string | null; isInstructor: boolean; roles: string[]; status: string }): string | null {
  if (p.status !== 'Pending') return 'This request has already been decided.';
  if (p.deciderId === p.studentId) return 'You cannot decide your own regrade request.';
  const registrar = p.roles.includes('Staff') || p.roles.includes('Administrator');
  if (!(p.isInstructor && p.roles.includes('Faculty')) && !registrar) return 'Only the course instructor or the Registrar can decide regrades.';
  return null;
}

/** Validates the decision itself. */
export function decisionBlocker(outcome: Outcome, current: string, newGrade: string | undefined, note: string): string | null {
  if (note.trim().length < 5) return 'Write a short note for the student explaining the decision.';
  if (outcome === 'Grade Changed') {
    if (!newGrade || !(GRADES as readonly string[]).includes(newGrade)) return 'Pick the new grade.';
    if (newGrade === current) return 'The new grade is the same as the current one. Choose "Uphold" instead.';
  }
  return null;
}
