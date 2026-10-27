// Recruiting and appointments (S-76 E06). Pure rules mirrored by lib/rcrMigration.ts. Visibility is decided here so the endpoint
// and the tests share it: references and evaluations are confidential to the search, recusal hides them per applicant, and an
// applicant only ever sees their own statement and offer.
export type Viewer = { authority: boolean; member: boolean; recused: boolean; applicant: boolean };

export const seesConfidential = (v: Viewer) => (v.authority || v.member) && !v.recused && !v.applicant;
export const seesApplication = (v: Viewer) => v.authority || v.member || v.applicant;

/** Evaluations that count toward the two needed for a selection: current committee members who are not recused. */
export function countingEvaluations(evals: { member: string }[], committee: string[], recused: string[]): number {
  return new Set(evals.map((e) => e.member).filter((m) => committee.includes(m) && !recused.includes(m))).size;
}

/** An applicant may accept only the approved, current version they actually read. */
export function acceptBlocker(p: { state: string; readHash: string; currentHash: string }): string | null {
  if (p.state !== 'approved') return 'This offer is not open for a response.';
  if (p.readHash !== p.currentHash) return 'The offer changed. Reload and read the current terms.';
  return null;
}
