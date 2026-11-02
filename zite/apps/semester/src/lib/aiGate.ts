// Ask Semester's policy gate. Pure functions (no database access) so they can be unit-tested.
// Order of checks, from the spec's AI workflow: user asks → course/tenant AI policy checked →
// data classification checked → sources and limits shown.

export type CoursePolicy = 'Allowed' | 'Outlining Only' | 'Not Allowed';
export type SectionRef = { id: string; code: string; title: string; policy: CoursePolicy };
export type GateLevel = 'allowed' | 'outline' | 'blocked';
export type GateDecision = { level: GateLevel; course: string | null; rule: string; reason: string };

const RANK: Record<CoursePolicy, number> = { Allowed: 0, 'Outlining Only': 1, 'Not Allowed': 2 };

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '');

/** Sections the question names, by course code ("HIST 214", "hist214", "HIST-214") or by full title. */
export function matchCourses(question: string, sections: SectionRef[]): SectionRef[] {
  const q = norm(question);
  const words = ` ${question.toLowerCase().replace(/[^a-z0-9]+/g, ' ')} `;
  return sections.filter((s) => {
    const code = norm(s.code);
    if (code.length >= 4 && q.includes(code)) return true;
    const title = s.title.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
    return title.length >= 6 && words.includes(` ${title} `);
  });
}

const GRADED = /\b(write|draft|finish|complete|do|solve|answer|generate|compose)\b[^.?!]{0,60}\b(essay|paper|assignment|homework|problem set|pset|lab report|report|response|discussion post|reflection|quiz|exam|test|take-home|code|program)\b/i;

/** True when the question asks Semester to produce work that would be graded. */
export const asksForGradedWork = (question: string) => GRADED.test(question);

/** Applies the strictest course AI rule among the courses the question names. */
export function gate(question: string, sections: SectionRef[]): GateDecision {
  const matched = matchCourses(question, sections);
  const graded = asksForGradedWork(question);
  if (matched.length) {
    const strictest = matched.reduce((a, b) => (RANK[b.policy] > RANK[a.policy] ? b : a));
    if (strictest.policy === 'Not Allowed') {
      return { level: 'blocked', course: strictest.code, rule: 'Not Allowed', reason: `${strictest.code} does not allow AI help. Ask Semester won't answer questions about it. Your instructor, a tutor or the course materials can help instead.` };
    }
    if (strictest.policy === 'Outlining Only') {
      return { level: 'outline', course: strictest.code, rule: 'Outlining Only', reason: `${strictest.code} allows outlining only. Ask Semester can point to sources and outline steps, but it won't write graded work.` };
    }
    return { level: graded ? 'outline' : 'allowed', course: strictest.code, rule: 'Allowed', reason: graded ? `${strictest.code} allows AI help, but Semester never writes graded work for you. It can outline and point to sources.` : `${strictest.code} allows AI help.` };
  }
  if (graded) {
    return { level: 'outline', course: null, rule: 'Unknown course', reason: 'This looks like graded work, and no course was named, so its AI rules could not be checked. Ask Semester will only outline. Name the course to apply its rules.' };
  }
  return { level: 'allowed', course: null, rule: 'No course named', reason: 'No course named, so course AI rules do not apply. Your institution AI policy still applies.' };
}

// ---- data classification ----
export type DataClass = 'Public catalog' | 'Your own record' | 'Your own education record' | 'Restricted';

const RESTRICTED = new Set(['Case', 'Referral', 'Moderation Report', 'Accommodation', 'Counseling', 'Health', 'Conduct']);
const EDUCATION = new Set(['Course', 'Assignment', 'Hold', 'Approval Request', 'Grade', 'Enrollment']);
const CATALOG = new Set(['Catalog', 'Requirement', 'Event', 'Club', 'Community', 'Study Group', 'Group']);

export function classify(kind: string): DataClass {
  if (RESTRICTED.has(kind)) return 'Restricted';
  if (EDUCATION.has(kind)) return 'Your own education record';
  if (CATALOG.has(kind)) return 'Public catalog';
  return 'Your own record';
}

/** Student-record no-egress policy (Book 1; master blueprint "AI" rule): only public catalog data may be sent to an
 *  AI provider. Student records, the student's own work and anything restricted stay inside Semester and are shown
 *  to the student as sources without AI synthesis. Widening this needs an owner decision (see docs/execution/conflicts-and-decisions.md). */
export const sendableToAI = (c: DataClass) => c === 'Public catalog';

/** Extra system-prompt rule for a gate decision. Empty when nothing extra applies. */
export function promptRule(d: GateDecision): string {
  if (d.level !== 'outline') return '';
  return `Course AI rule${d.course ? ` for ${d.course}` : ''}: outlining only. Do NOT write, draft, complete or solve any graded work (essays, problem sets, code, answers). Give at most a short outline of steps and point to the numbered sources.`;
}
