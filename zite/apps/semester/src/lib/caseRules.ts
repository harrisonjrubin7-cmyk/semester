// Advising case lifecycle (APP-003; book gap register P0 "Conduct term review", "Close or transition case"). Pure; tested in
// tests/caseRules.test.ts. Case notes stay staff-only; what a student sees is an explicit, separate summary.
export const STANDINGS = ['on_track', 'needs_support', 'at_risk'] as const;
export const OUTCOMES = ['goals_met', 'referred_out', 'student_withdrew', 'no_response'] as const;
export type Standing = (typeof STANDINGS)[number];
export type Outcome = (typeof OUTCOMES)[number];

const REVIEW_MARK = '· Term review ';
const label = (s: string) => s.replace(/_/g, ' ');

export function reviewNote(day: string, term: string, standing: Standing, steps: string[]): string {
  return `${day} ${REVIEW_MARK}${term.trim()} · ${label(standing)} · next: ${steps.map((s) => s.trim()).join('; ')}`;
}

export function countReviews(notes: string | null | undefined): number {
  return (notes ?? '').split('\n').filter((l) => l.includes(REVIEW_MARK)).length;
}

export function reviewBlocker(term: string, steps: string[]): string | null {
  if (term.trim().length < 4) return 'Name the term being reviewed.';
  const real = steps.map((s) => s.trim()).filter((s) => s.length >= 3);
  if (!real.length) return 'Agree at least one next step.';
  if (real.length > 8) return 'Keep it to eight next steps or fewer.';
  return null;
}

/** "Goals met" needs a term review on record; every close needs a summary a successor could act on. */
export function closeBlocker(outcome: Outcome, summary: string, notes: string | null | undefined): string | null {
  if (summary.trim().length < 20) return 'Write a closing summary (20+ characters).';
  if (outcome === 'goals_met' && countReviews(notes) === 0) return 'Record at least one term review before closing with goals met.';
  return null;
}

/** What the student is told, when the advisor chooses to share: standing and next steps only, never staff notes. */
export function studentSummary(term: string, standing: Standing, steps: string[]): string {
  return `Your advisor's ${term.trim()} review: ${label(standing)}. Next steps: ${steps.map((s) => s.trim()).filter(Boolean).join('; ')}.`;
}
