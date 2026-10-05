import { finite, isoDay, obj, textValue } from './device-library';

/**
 * A study-abroad plan: the programmes being weighed, the courses each would
 * count as at home, and the three stretches of work around going.
 *
 * Career already has a nine-step checklist (`ABROAD_STEPS` in `career.ts`),
 * which says what to do and not which programme it is for or whether the
 * credit will count. The question a student is actually stuck on is the
 * second: "if I go to Madrid in the spring, do I still graduate on time?" —
 * and the answer lives in which of their host courses are approved to count
 * as which home courses. So that is the centre of this file.
 *
 * ## Whose word an approval is
 *
 * Every approval here is **what the student recorded**, with where they
 * recorded it from. Semester is not the study abroad office and never says a
 * course *is* approved; it says "you recorded this as pre-approved, from
 * <where>". Only the credits a student has recorded as pre-approved are
 * counted as credits they can plan on; pending and estimated credit is shown,
 * and kept apart, because planning a graduation date on an estimate is how a
 * student comes home a semester short.
 *
 * Costs are the student's own figures in the programme's own currency and
 * are never converted or added across programmes — the same rule `pathway.ts`
 * keeps for application costs, for the same reason.
 *
 * Kept on this device, per account, and in the workspace backup.
 */

export const ABROAD_PREFIX = 'semester.abroad.v1';
export const abroadKey = (accountId: string | undefined) => `${ABROAD_PREFIX}:${accountId || 'device'}`;

export const APPROVALS = ['pre-approved', 'pending', 'estimated', 'not-approved'] as const;
export type Approval = (typeof APPROVALS)[number];

export const APPROVAL_TEXT: Record<Approval, string> = {
  'pre-approved': 'Pre-approved',
  pending: 'Pending',
  estimated: 'Estimated',
  'not-approved': 'Not approved',
};

/** What each state means, said so a student cannot mistake one for another. */
export const APPROVAL_MEANING: Record<Approval, string> = {
  'pre-approved': 'You recorded a pre-approval. Keep the written decision; only it counts.',
  pending: 'Submitted for review. Do not plan on this credit yet.',
  estimated: 'Your own guess at a match. Nobody has reviewed it.',
  'not-approved': 'Recorded as not approved. It will not count toward this course.',
};

export interface AbroadProgram {
  id: string;
  name: string;
  /** Host university or provider. */
  host: string;
  city: string;
  country: string;
  /** "Spring 2027", as the programme names its term. */
  term: string;
  /** Application deadline, as the student found it. */
  deadline: string;
  /** The student's own figure, in `currency`, for the whole programme. Null when not known. */
  cost: number | null;
  currency: string;
  /** Credits the student hopes to bring home. */
  credits: number;
  url: string;
  notes: string;
}

export interface CourseMatch {
  id: string;
  programId: string;
  /** The course abroad. */
  host: string;
  /** What it would count as at home: a course code, or "Elective", or a requirement. */
  counts: string;
  credits: number;
  status: Approval;
  /** Where the student recorded the status from: "Global Education email, 3 Oct". */
  from: string;
}

export const STAGES = ['application', 'departure', 'return'] as const;
export type Stage = (typeof STAGES)[number];

export const STAGE_TITLE: Record<Stage, string> = {
  application: 'Applying',
  departure: 'Before you go',
  return: 'Coming home',
};

/**
 * The steps, in the order the deadlines fall. The same verbs as
 * `ABROAD_STEPS` and `PATHWAY_TEMPLATES`: review, confirm, request, record —
 * never "submit" or "approve", which are not things this app does. Anything
 * with an authority names it; passports and visas point at official sources,
 * because this app must never be what a student believed about a visa.
 */
export const STAGE_STEPS: Record<Stage, string[]> = {
  application: [
    'Meet your study abroad office about this program',
    'Check eligibility: GPA, language, class year',
    'Review official costs and funding, including scholarships for study abroad',
    'List the courses you would take and what each would count as',
    'Request course pre-approvals from your department or advisor',
    'Prepare application materials and recommendations',
    'Record the official application receipt',
  ],
  departure: [
    'Confirm passport and visa requirements with official sources',
    'Confirm enrollment and credit arrangements in writing',
    'Complete approved health, safety and insurance preparation',
    'Arrange housing and travel',
    'Plan next term’s registration from abroad',
    'Record local emergency and support contacts',
  ],
  return: [
    'Request the host transcript be sent',
    'Confirm each course was posted as approved',
    'Follow up on any course still pending or posted differently',
    'Check your degree audit for the credit',
    'Record what you would tell the next student',
  ],
};

export interface AbroadPlan {
  programs: AbroadProgram[];
  courses: CourseMatch[];
  /** Ticked steps, per programme: `{ [programId]: { [step]: true } }`. */
  steps: Record<string, Record<string, boolean>>;
}

export const EMPTY_ABROAD: AbroadPlan = { programs: [], courses: [], steps: {} };

export const ABROAD_LIMITS = { programs: 12, courses: 120, text: 200, notes: 4000, url: 2000 } as const;

export const newProgram = (): AbroadProgram => ({
  id: crypto.randomUUID(),
  name: '',
  host: '',
  city: '',
  country: '',
  term: '',
  deadline: '',
  cost: null,
  currency: 'USD',
  credits: 15,
  url: '',
  notes: '',
});

export const newCourse = (programId: string): CourseMatch => ({
  id: crypto.randomUUID(),
  programId,
  host: '',
  counts: '',
  credits: 3,
  status: 'estimated',
  from: '',
});

const t = (v: unknown, max: number = ABROAD_LIMITS.text): v is string => textValue(v, max);
const approvals = new Set<string>(APPROVALS);
const allSteps = new Set(STAGES.flatMap((s) => STAGE_STEPS[s]));

/** Validated on every read. Anything that does not parse is dropped, never guessed at. */
export function readAbroad(value: unknown): AbroadPlan {
  if (!obj(value)) return EMPTY_ABROAD;
  const programs: AbroadProgram[] = [];
  for (const p of Array.isArray(value.programs) ? value.programs.slice(0, ABROAD_LIMITS.programs) : []) {
    if (!obj(p) || !t(p.id, 100) || !p.id || programs.some((x) => x.id === p.id)) continue;
    if (!t(p.name) || !t(p.host) || !t(p.city) || !t(p.country) || !t(p.term) || !t(p.currency, 10)) continue;
    if (!isoDay(p.deadline) || !t(p.url, ABROAD_LIMITS.url) || !t(p.notes, ABROAD_LIMITS.notes)) continue;
    if (!(p.cost === null || finite(p.cost, 0, 10_000_000)) || !finite(p.credits, 0, 60)) continue;
    programs.push({
      id: p.id, name: p.name, host: p.host, city: p.city, country: p.country, term: p.term,
      deadline: p.deadline, cost: p.cost as number | null, currency: p.currency, credits: p.credits,
      url: p.url, notes: p.notes,
    });
  }
  const ids = new Set(programs.map((p) => p.id));
  const courses: CourseMatch[] = [];
  for (const c of Array.isArray(value.courses) ? value.courses.slice(0, ABROAD_LIMITS.courses) : []) {
    if (!obj(c) || !t(c.id, 100) || !c.id || courses.some((x) => x.id === c.id)) continue;
    // A course whose programme is gone is dropped with it rather than left orphaned.
    if (!t(c.programId, 100) || !ids.has(c.programId)) continue;
    if (!t(c.host) || !t(c.counts) || !t(c.from) || !finite(c.credits, 0, 30)) continue;
    if (typeof c.status !== 'string' || !approvals.has(c.status)) continue;
    courses.push({ id: c.id, programId: c.programId, host: c.host, counts: c.counts, credits: c.credits, status: c.status as Approval, from: c.from });
  }
  const steps: AbroadPlan['steps'] = {};
  if (obj(value.steps)) {
    for (const [pid, ticks] of Object.entries(value.steps)) {
      if (!ids.has(pid) || !obj(ticks)) continue;
      steps[pid] = Object.fromEntries(Object.entries(ticks).filter(([k, v]) => allSteps.has(k) && v === true).map(([k]) => [k, true]));
    }
  }
  return { programs, courses, steps };
}

export interface CreditPicture {
  /** Credits the student hopes to bring home. */
  planned: number;
  /** Recorded as pre-approved: the only credit to plan a graduation on. */
  approved: number;
  pending: number;
  estimated: number;
  /** Planned credit with no course matched to it at all. */
  unmatched: number;
}

/** What a programme's credit looks like, kept apart by whose word it is. */
export function creditPicture(plan: AbroadPlan, programId: string): CreditPicture {
  const program = plan.programs.find((p) => p.id === programId);
  const mine = plan.courses.filter((c) => c.programId === programId);
  const sum = (s: Approval) => mine.filter((c) => c.status === s).reduce((n, c) => n + c.credits, 0);
  const matched = mine.filter((c) => c.status !== 'not-approved').reduce((n, c) => n + c.credits, 0);
  const planned = program?.credits ?? 0;
  return {
    planned,
    approved: sum('pre-approved'),
    pending: sum('pending'),
    estimated: sum('estimated'),
    unmatched: Math.max(0, planned - matched),
  };
}

/** One line saying what can be counted on, and what cannot yet. */
export function creditLine(c: CreditPicture): string {
  const parts = [`${c.approved} of ${c.planned} credits recorded as pre-approved`];
  if (c.pending) parts.push(`${c.pending} pending`);
  if (c.estimated) parts.push(`${c.estimated} estimated, not reviewed`);
  if (c.unmatched) parts.push(`${c.unmatched} with no course matched yet`);
  return parts.join(' · ');
}

/** The approval list as text, for the student to copy to their advisor themselves. */
export function approvalText(plan: AbroadPlan, programId: string): string {
  const p = plan.programs.find((x) => x.id === programId);
  if (!p) return '';
  const rows = plan.courses.filter((c) => c.programId === programId);
  return [
    `Study abroad course plan: ${p.name || 'Program'}${p.host ? `, ${p.host}` : ''}${p.term ? ` (${p.term})` : ''}`,
    '',
    ...(rows.length
      ? rows.map((c) => `- ${c.host || '(course)'} → ${c.counts || '(not matched)'} · ${c.credits} cr · ${APPROVAL_TEXT[c.status]}${c.from ? ` (recorded from ${c.from})` : ''}`)
      : ['(no courses listed yet)']),
    '',
    creditLine(creditPicture(plan, programId)),
    '',
    'A planning note I kept myself. Approvals listed are as I recorded them; the written decisions are what count.',
  ].join('\n');
}

export function stageProgress(plan: AbroadPlan, programId: string, stage: Stage): { done: number; total: number } {
  const ticks = plan.steps[programId] ?? {};
  const total = STAGE_STEPS[stage].length;
  return { done: STAGE_STEPS[stage].filter((s) => ticks[s]).length, total };
}
