// What-if for major and minor exploration (role app "Undergraduate Student": major and minor exploration). Pure: no I/O.
// Compares what a student has completed or is taking now with a published program's pathway (prg_programs.terms: an
// ordered list of terms, each a list of catalog codes). Read-only estimate: it changes no declaration and no record.
export type Pathway = { code: string; name: string; credential: string; totalCredits: number; termCap: number; terms: string[][] };

export function whatIf(p: Pathway, credits: Record<string, number>, done: Set<string>, now: Set<string>) {
  const all = p.terms.flat();
  const counted = all.filter((c) => done.has(c));
  const inProgress = all.filter((c) => now.has(c) && !done.has(c));
  const remaining = all.filter((c) => !done.has(c) && !now.has(c));
  const cr = (list: string[]) => list.reduce((n, c) => n + (credits[c] ?? 0), 0);
  const countedCredits = cr(counted), inProgressCredits = cr(inProgress);
  const remainingCredits = Math.max(0, p.totalCredits - countedCredits - inProgressCredits);
  return {
    code: p.code, name: p.name, credential: p.credential, totalCredits: p.totalCredits,
    countedCredits, inProgressCredits, remainingCredits,
    percent: p.totalCredits ? Math.min(100, Math.round(((countedCredits + inProgressCredits) / p.totalCredits) * 100)) : 0,
    estimatedTerms: p.termCap > 0 ? Math.ceil(remainingCredits / p.termCap) : null,
    counted, inProgress, remaining,
  };
}

/** Programs ordered by least left to do, then by code; ties never depend on input order. */
export function compare(rows: ReturnType<typeof whatIf>[]) {
  return [...rows].sort((a, b) => a.remainingCredits - b.remainingCredits || a.code.localeCompare(b.code));
}
