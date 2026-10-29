// Academic facts for athletics eligibility (lib/athMigration.ts evaluates the rules on them). Pure; tests/athleticsFacts.test.ts.
// Inputs are one student's enrolment rows with the course credits, the section's term and the current official grade (if any).
// - term_credits: credits of courses enrolled (or completed) in the review term.
// - completed_credits: credits of completed courses with a passing current official grade.
// - cumulative_gpa: credit-weighted mean on the 4.0 letter scale over current official letter grades; non-letter grades
//   (P, W, I, NR...) are left out; null when there is no letter-graded work, which fails any GPA minimum.
export type EnrolRow = { status: string; term: string | null; credits: number; grade: string | null };
export type Facts = { term_credits: number; completed_credits: number; cumulative_gpa: number | null };

export const POINTS: Record<string, number> = { 'A+': 4, A: 4, 'A-': 3.7, 'B+': 3.3, B: 3, 'B-': 2.7, 'C+': 2.3, C: 2, 'C-': 1.7, 'D+': 1.3, D: 1, 'D-': 0.7, F: 0 };
const PASSING_NON_LETTER = new Set(['P', 'S', 'CR']);

export function gradePoints(g: string | null): number | null {
  if (!g) return null;
  const k = g.trim().toUpperCase();
  return k in POINTS ? POINTS[k] : null;
}

export function passes(g: string | null): boolean {
  if (!g) return false;
  const k = g.trim().toUpperCase();
  const p = gradePoints(k);
  return p !== null ? p > 0 : PASSING_NON_LETTER.has(k);
}

export function computeFacts(rows: EnrolRow[], term: string): Facts {
  const credits = (r: EnrolRow) => (Number.isFinite(r.credits) && r.credits > 0 ? r.credits : 0);
  const sameTerm = (r: EnrolRow) => (r.term ?? '').trim().toLowerCase() === term.trim().toLowerCase();
  const term_credits = rows.filter((r) => sameTerm(r) && (r.status === 'Enrolled' || r.status === 'Completed')).reduce((s, r) => s + credits(r), 0);
  const completed_credits = rows.filter((r) => r.status === 'Completed' && passes(r.grade)).reduce((s, r) => s + credits(r), 0);
  let qp = 0, gc = 0;
  for (const r of rows) {
    const p = gradePoints(r.grade);
    if (p === null || credits(r) === 0 || r.status !== 'Completed') continue;
    qp += p * credits(r); gc += credits(r);
  }
  return { term_credits, completed_credits, cumulative_gpa: gc ? Math.round((qp / gc) * 100) / 100 : null };
}
