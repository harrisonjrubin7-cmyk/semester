// Degree plan check (dpl-001). Pure: no I/O. A plan is an ordered list of future terms, each with planned course ids.
// The check is advisory: it never registers anyone or changes a record; it tells the student and advisor what the plan
// would do to each requirement and what in it will not work as written.
export type PlanTerm = { term: string; courseIds: string[] };
export type PlanCourse = { code: string; credits: number; satisfies: string[]; prerequisites: string[] };
export type PlanRequirement = { id: string; name: string; required: number; earned: number; pending: number };
export type PlanIssue = { term: string | null; courseId: string | null; kind: 'unknown_course' | 'duplicate' | 'already_taken' | 'prerequisite' | 'over_cap' | 'empty_term'; text: string };

export const MAX_TERMS = 12;
export const MAX_COURSES_PER_TERM = 10;

export function checkPlan(p: {
  terms: PlanTerm[]; courses: Record<string, PlanCourse>; completed: Set<string>; inProgress: Set<string>;
  requirements: PlanRequirement[]; maxCredits: number | null;
}) {
  const issues: PlanIssue[] = [];
  const seen = new Set<string>();
  const before = new Set([...p.completed, ...p.inProgress]);
  const planned: string[] = [];
  const terms = p.terms.map((t) => {
    let credits = 0;
    if (!t.courseIds.length) issues.push({ term: t.term, courseId: null, kind: 'empty_term', text: `${t.term} has no courses.` });
    for (const id of t.courseIds) {
      const c = p.courses[id];
      if (!c) { issues.push({ term: t.term, courseId: id, kind: 'unknown_course', text: `A course in ${t.term} is not in this institution's catalog.` }); continue; }
      if (p.completed.has(id) || p.inProgress.has(id)) { issues.push({ term: t.term, courseId: id, kind: 'already_taken', text: `${c.code} is already completed or in progress.` }); continue; }
      if (seen.has(id)) { issues.push({ term: t.term, courseId: id, kind: 'duplicate', text: `${c.code} is planned more than once.` }); continue; }
      const missing = c.prerequisites.filter((x) => !before.has(x));
      if (missing.length) issues.push({ term: t.term, courseId: id, kind: 'prerequisite', text: `${c.code} needs ${missing.map((x) => p.courses[x]?.code ?? 'a prerequisite').join(', ')} in an earlier term.` });
      seen.add(id); planned.push(id); credits += c.credits;
    }
    if (p.maxCredits != null && credits > p.maxCredits) issues.push({ term: t.term, courseId: null, kind: 'over_cap', text: `${t.term} plans ${credits} credits; the limit is ${p.maxCredits} without an approved overload.` });
    // Prerequisites count once the term that holds them is over, so they are added after the term is checked.
    for (const id of t.courseIds) if (p.courses[id]) before.add(id);
    return { term: t.term, credits };
  });
  const requirements = p.requirements.map((r) => {
    const plannedCredits = planned.filter((id) => p.courses[id].satisfies.includes(r.id)).reduce((n, id) => n + p.courses[id].credits, 0);
    const projected = Math.min(r.required, r.earned + r.pending + plannedCredits);
    return { ...r, planned: plannedCredits, projected, short: Math.max(0, r.required - projected) };
  });
  return { terms, requirements, issues, complete: requirements.every((r) => r.short === 0) };
}

/** Normalise what the client sent: trimmed names, unique terms, bounded sizes. Returns a refusal text or the plan. */
export function cleanPlan(raw: PlanTerm[]): PlanTerm[] | string {
  if (raw.length > MAX_TERMS) return `A plan holds at most ${MAX_TERMS} terms.`;
  const names = new Set<string>();
  const out: PlanTerm[] = [];
  for (const t of raw) {
    const term = t.term.trim();
    if (term.length < 3 || term.length > 40) return 'Name each term (3 to 40 characters).';
    if (names.has(term.toLowerCase())) return `${term} appears twice.`;
    if (t.courseIds.length > MAX_COURSES_PER_TERM) return `${term} holds more than ${MAX_COURSES_PER_TERM} courses.`;
    names.add(term.toLowerCase());
    out.push({ term, courseIds: [...t.courseIds] });
  }
  return out;
}
