// Grade moderation before release (Semester Faculty "grade moderation and release"; S-60 §5/§13; W10).
// Mirrors asm-003 in lib/asmMigration.ts; unit-tested in tests/moderation.test.ts.
// A moderation counts only if it is newer than the attempt's last grading, so re-grading after review needs a new review.
export const moderationNeeded = (graded: number, pct: number) => (pct <= 0 || graded <= 0 ? 0 : Math.ceil((graded * Math.min(pct, 100)) / 100));

export type Att = { id: number; state: string; gradedAt: number | null; gradedBy: string | null; student: string };
export type Mod = { attemptId: number; moderator: string; at: number };

/** Attempts with a current (post-grading) moderation. */
export function moderated(atts: Att[], mods: Mod[]): Set<number> {
  const ok = new Set<number>();
  for (const a of atts) if (a.state === 'graded' && a.gradedAt != null && mods.some((m) => m.attemptId === a.id && m.at >= a.gradedAt!)) ok.add(a.id);
  return ok;
}
/** How many more attempts must be moderated before release; 0 means release may proceed. */
export function releaseShortfall(atts: Att[], mods: Mod[], pct: number): number {
  const graded = atts.filter((a) => a.state === 'graded');
  return Math.max(0, moderationNeeded(graded.length, pct) - moderated(graded, mods).size);
}
/** Who may moderate an attempt: a second person, never its grader or its student. */
export function moderatorBlocker(a: Att, moderator: string): string | null {
  if (a.state !== 'graded') return 'Only graded, unreleased attempts can be moderated.';
  if (moderator === a.student) return 'You cannot moderate your own attempt.';
  if (a.gradedBy && moderator === a.gradedBy) return 'A second person must moderate; you graded this attempt.';
  return null;
}
