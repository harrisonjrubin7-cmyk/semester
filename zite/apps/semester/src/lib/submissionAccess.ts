// Who may open a submission and what a student sees of its grading (S-92 §7 P01–P03). Pure: learn.ts calls these with
// facts it read on the server (owner, state, the frozen group, the viewer's course role in the submission's own section).
// Tested in tests/submissionAccess.test.ts.
export type CourseRole = 'instructor' | 'delegate' | null;
export type SubmissionFacts = { owner: string; state: string; groupMembers: string[] | null };

/** The owner always; a frozen group member or course staff of the submission's own section only once it is submitted. */
export function canOpenSubmission(viewer: string, s: SubmissionFacts, roleInItsSection: CourseRole): boolean {
  if (viewer === s.owner) return true;
  if (s.state === 'Private Draft') return false;
  if (s.groupMembers?.includes(viewer)) return true;
  return roleInItsSection === 'instructor' || roleInItsSection === 'delegate';
}

/** What a student is shown of grading: nothing until the instructor releases it. Staff see the full record. */
export function gradingFor<T extends { state: string; score: number | null; feedback: string }>(x: T, isStaff: boolean): T {
  if (isStaff || x.state === 'Released') return x;
  return { ...x, score: null, feedback: '' };
}
