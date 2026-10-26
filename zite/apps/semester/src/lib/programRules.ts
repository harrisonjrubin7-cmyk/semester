// Programs and term-by-term pathways (S-70 §2-3; role register: Department Chair "program outcomes", Dean "program review").
// Pure; mirrors lib/prgMigration.ts and is unit-tested in tests/program.test.ts.
// Flow: the department chair proposes a program version -> a curriculum-committee member approves (not the author) -> a
// registrar publishes it (neither author nor approver), superseding the previous published version of that program.
// A pathway lists published courses by term; each course appears once, comes after its in-pathway prerequisites, terms stay
// within the credit cap, the pathway reaches the program's total, and every program outcome maps to pathway courses.
import { normCode } from './curriculumRules';

export type State = 'submitted' | 'committee_approved' | 'published' | 'returned' | 'withdrawn' | 'superseded';
export type Step = 'approve' | 'publish' | 'return' | 'withdraw';
export type Actor = 'author' | 'committee' | 'registrar';
export const CREDENTIALS = ['certificate', 'associate', 'bachelor', 'master', 'doctoral', 'professional'] as const;

export function next(state: State, step: Step, actor: Actor): State | null {
  if (step === 'approve') return actor === 'committee' && state === 'submitted' ? 'committee_approved' : null;
  if (step === 'publish') return actor === 'registrar' && state === 'committee_approved' ? 'published' : null;
  if (step === 'return') return (actor === 'committee' && state === 'submitted') || (actor === 'registrar' && state === 'committee_approved') ? 'returned' : null;
  if (step === 'withdraw') return actor === 'author' && ['submitted', 'committee_approved'].includes(state) ? 'withdrawn' : null;
  return null;
}

export type Catalog = Record<string, { credits: number; prereqs: string[] }>;
export type Outcome = { text: string; courses: string[] };

export function pathwayBlocker(p: { terms: string[][]; totalCredits: number; termCap: number; outcomes: Outcome[] }, catalog: Catalog) {
  if (p.terms.length < 1 || p.terms.length > 16) return 'A pathway has between 1 and 16 terms.';
  if (!(p.termCap > 0 && p.termCap <= 30)) return 'The per-term credit cap is between 1 and 30.';
  const where = new Map<string, number>();
  for (let t = 0; t < p.terms.length; t++) {
    let credits = 0;
    for (const raw of p.terms[t]) {
      const c = normCode(raw);
      if (!catalog[c]) return `Not in the published catalog: ${raw}.`;
      if (where.has(c)) return `${raw} appears in more than one term.`;
      where.set(c, t);
      credits += catalog[c].credits;
    }
    if (credits > p.termCap) return `Term ${t + 1} has ${credits} credits, over the cap of ${p.termCap}.`;
  }
  for (const [c, t] of where) {
    for (const pre of catalog[c].prereqs.map(normCode)) {
      if (where.has(pre) && where.get(pre)! >= t) return `${c} needs ${pre} in an earlier term.`;
    }
  }
  const total = [...where.keys()].reduce((n, c) => n + catalog[c].credits, 0);
  if (total < p.totalCredits) return `The pathway reaches ${total} of the program's ${p.totalCredits} credits.`;
  if (p.outcomes.length < 1 || p.outcomes.length > 12) return 'List between 1 and 12 program outcomes.';
  for (const o of p.outcomes) {
    if (o.text.trim().length < 10) return 'Write each program outcome as a full statement (10+ characters).';
    if (!o.courses.length) return `Map "${o.text.slice(0, 40)}" to at least one course.`;
    const off = o.courses.find((c) => !where.has(normCode(c)));
    if (off) return `Outcome maps to ${off}, which is not in the pathway.`;
  }
  return null;
}
