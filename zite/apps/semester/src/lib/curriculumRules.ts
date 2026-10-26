// Curriculum governance (S-70 §2-3, §6; role register: Department Chair "Curriculum", Faculty course design). Pure; mirrors
// lib/curMigration.ts and is unit-tested in tests/curriculum.test.ts.
// Flow: a faculty member proposes a course version with outcomes and a syllabus template -> the department chair endorses ->
// a curriculum-committee member approves -> the version enters the catalog as a proposal that a registrar (not the author)
// publishes with its effective term. The chair is never the author; the committee approver is neither author nor chair.
// Prerequisites must already be published courses and may not create a loop.
export type State = 'submitted' | 'chair_endorsed' | 'committee_approved' | 'returned' | 'withdrawn';
export type Step = 'endorse' | 'approve' | 'return' | 'withdraw';
export type Actor = 'author' | 'chair' | 'committee';

export function next(state: State, step: Step, actor: Actor): State | null {
  if (step === 'endorse') return actor === 'chair' && state === 'submitted' ? 'chair_endorsed' : null;
  if (step === 'approve') return actor === 'committee' && state === 'chair_endorsed' ? 'committee_approved' : null;
  if (step === 'return') return (actor === 'chair' && state === 'submitted') || (actor === 'committee' && state === 'chair_endorsed') ? 'returned' : null;
  if (step === 'withdraw') return actor === 'author' && ['submitted', 'chair_endorsed'].includes(state) ? 'withdrawn' : null;
  return null;
}

export const normCode = (c: string) => c.trim().toUpperCase().replace(/\s+/g, '');
export const CODE_RE = /^[A-Z]{2,6} ?[0-9]{3,4}[A-Z]?$/;
export const codesIn = (text: string) => [...text.toUpperCase().matchAll(/[A-Z]{2,6} ?[0-9]{3,4}[A-Z]?/g)].map((m) => normCode(m[0]));

/** True when adding `prereqs` to `code` would make `code` (transitively) its own prerequisite. graph: code -> its prerequisites. */
export function createsCycle(graph: Record<string, string[]>, code: string, prereqs: string[]) {
  const target = normCode(code);
  const seen = new Set<string>();
  const stack = prereqs.map(normCode);
  while (stack.length) {
    const c = stack.pop()!;
    if (c === target) return true;
    if (seen.has(c)) continue;
    seen.add(c);
    stack.push(...(graph[c] ?? []).map(normCode));
  }
  return false;
}

export type Assessment = { name: string; weight: number };
export type Syllabus = { weeks: number; assessments: Assessment[]; policies: string };
export function syllabusBlocker(s: Syllabus, outcomes: string[]) {
  if (outcomes.length < 1 || outcomes.length > 12) return 'List between 1 and 12 learning outcomes.';
  if (outcomes.some((o) => o.trim().length < 10)) return 'Write each outcome as a full statement (10+ characters).';
  if (!(s.weeks >= 1 && s.weeks <= 30)) return 'A course runs between 1 and 30 weeks.';
  if (s.assessments.length < 1 || s.assessments.length > 12) return 'List between 1 and 12 assessments.';
  if (s.assessments.some((a) => a.name.trim().length < 2 || !(a.weight > 0))) return 'Each assessment needs a name and a weight above 0.';
  const total = s.assessments.reduce((t, a) => t + a.weight, 0);
  if (Math.abs(total - 100) > 0.001) return `Assessment weights must total 100% (now ${total}%).`;
  if (s.policies.trim().length < 20) return 'Add course policies (attendance, late work, integrity, accessibility; 20+ characters).';
  return null;
}

export function prereqBlocker(code: string, prereqs: string[], published: Set<string>, graph: Record<string, string[]>) {
  const c = normCode(code);
  if (prereqs.some((p) => normCode(p) === c)) return 'A course cannot be its own prerequisite.';
  const missing = prereqs.filter((p) => !published.has(normCode(p)));
  if (missing.length) return `Not in the published catalog: ${missing.join(', ')}.`;
  if (createsCycle(graph, c, prereqs)) return 'These prerequisites would create a loop back to this course.';
  return null;
}
