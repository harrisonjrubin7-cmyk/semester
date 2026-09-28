import type { Action, Priority } from './actions';
import { UNCALM } from './today-center';

/**
 * The campus office action feed (`office_action_feed`, Phase J, D-048),
 * against `supabase/migrations/20260928302000_office_action_feed.sql`.
 *
 * An office (Registrar, Financial Aid, …) publishes an action: what to do,
 * why it matters, when, and a link to the official page. The student sees the
 * ones that reach them, each labelled "Institution verified" with the office
 * and when it was updated, and the Action Center ranks them alongside
 * everything else.
 *
 * - **Only complete actions are shown.** `readOfficeAction` refuses a row
 *   without an office, an https link, a source or an update time. The
 *   database refuses those too; this is the second lock, so an old or
 *   malformed row never reaches a student looking official.
 * - **Who it reaches is said out loud.** `whyYouSee` names the audience, and
 *   for a program or an eligibility says it was the student's own choice.
 * - **Nothing is inferred.** An office reaches a student by school, cohort, or
 *   a program or eligibility the student chose. Semester never guesses
 *   either, and the office never learns who matched.
 * - **Completion is the student's to share.** Marking done is a separate,
 *   explicit button; the office sees a count only at ten or more.
 */

export const OFFICE_LABELS: Record<string, string> = {
  registrar: 'Registrar',
  financial_aid: 'Financial Aid',
  student_accounts: 'Student Accounts',
  international: 'International Student Services',
  veterans: 'Veterans Services',
  residence_life: 'Residence Life',
  career_center: 'Career Center',
  disability_services: 'Disability Services',
  athletics_compliance: 'Athletics Compliance',
  study_abroad: 'Study Abroad',
  first_year: 'First-Year Experience',
  counseling: 'Counseling Center',
  learning_center: 'Learning Center',
};

/**
 * What a student can say applies to them. Nothing about health or disability:
 * a student never has to tell Semester that to see an office's reminders.
 * The same list is a check constraint in the migration.
 */
export const ELIGIBILITY = [
  { key: 'aid_applicant', label: 'I applied for financial aid' },
  { key: 'international', label: 'I am an international student' },
  { key: 'veteran_benefits', label: 'I use veteran or military education benefits' },
  { key: 'varsity_athlete', label: 'I am on a varsity team' },
  { key: 'campus_housing', label: 'I live in campus housing' },
  { key: 'study_abroad', label: 'I am studying abroad or applying to' },
  { key: 'first_year', label: 'This is my first year' },
  { key: 'transfer', label: 'I transferred in' },
  { key: 'graduating', label: 'I plan to graduate this year' },
] as const;
export type EligibilityKey = (typeof ELIGIBILITY)[number]['key'];
export const isEligibility = (v: unknown): v is EligibilityKey => ELIGIBILITY.some((e) => e.key === v);

export const ACTION_TYPES = [
  'deadline', 'hold', 'compliance', 'certification', 'registration',
  'aid', 'billing', 'housing', 'eligibility', 'resource', 'event',
] as const;
export type OfficeActionType = (typeof ACTION_TYPES)[number];

export type Audience = 'tenant' | 'cohort' | 'program' | 'eligibility' | 'student';

export interface OfficeAction {
  id: string;
  office: string;
  officeLabel: string;
  type: OfficeActionType;
  audience: Audience;
  program: string | null;
  eligibility: EligibilityKey | null;
  title: string;
  why: string;
  dueAt: number | null;
  url: string;
  sourceNote: string;
  updatedAt: number;
  publishedAt: number | null;
  /** When this student marked it done, if they did. */
  doneAt: number | null;
}

const text = (v: unknown) => (typeof v === 'string' ? v.trim() : '');
const time = (v: unknown): number | null => {
  if (typeof v !== 'string' || !v) return null;
  const t = Date.parse(v);
  return Number.isFinite(t) ? t : null;
};
export const isHttps = (v: string) => /^https:\/\/[^\s]+$/.test(v);

/** A row from `my_office_actions()`, or null when anything the student is owed is missing. */
export function readOfficeAction(row: unknown): OfficeAction | null {
  if (!row || typeof row !== 'object') return null;
  const r = row as Record<string, unknown>;
  const id = text(r.id);
  const office = text(r.office);
  const url = text(r.official_url);
  const sourceNote = text(r.source_note);
  const title = text(r.title);
  const why = text(r.why_it_matters);
  const updatedAt = time(r.updated_at);
  const type = text(r.action_type) as OfficeActionType;
  const audience = text(r.audience_kind) as Audience;
  if (!id || !office || !title || !why || !sourceNote || updatedAt === null) return null;
  if (!isHttps(url)) return null;
  if (!ACTION_TYPES.includes(type)) return null;
  if (!['tenant', 'cohort', 'program', 'eligibility', 'student'].includes(audience)) return null;
  // The database refuses these words; a row that has them anyway is not shown.
  if (UNCALM.test(title) || UNCALM.test(why)) return null;
  const eligibility = isEligibility(r.target_eligibility) ? r.target_eligibility : null;
  return {
    id,
    office,
    officeLabel: text(r.office_label) || OFFICE_LABELS[office] || office,
    type,
    audience,
    program: text(r.target_program) || null,
    eligibility,
    title: title.slice(0, 200),
    why: why.slice(0, 1000),
    dueAt: time(r.due_at),
    url,
    sourceNote: sourceNote.slice(0, 300),
    updatedAt,
    publishedAt: time(r.published_at),
    doneAt: time(r.done_at),
  };
}

export function readOfficeActions(rows: unknown): OfficeAction[] {
  return Array.isArray(rows) ? rows.map(readOfficeAction).filter((a): a is OfficeAction => a !== null) : [];
}

/** "economics" from "vanderbilt/economics", for display. */
export const programName = (p: string) => {
  const slug = p.includes('/') ? p.slice(p.indexOf('/') + 1) : p;
  return slug.replace(/[-_]+/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
};

/** Who the office sent it to, and for a choice of the student's, that it was theirs. */
export function whyYouSee(a: OfficeAction): string {
  const from = `${a.officeLabel} sent this`;
  switch (a.audience) {
    case 'tenant':
      return `${from} to every student at your school.`;
    case 'cohort':
      return `${from} to a group you belong to at your school.`;
    case 'program':
      return `${from} to students in ${a.program ? programName(a.program) : 'a program'}. You chose that program in Semester.`;
    case 'eligibility': {
      const said = ELIGIBILITY.find((e) => e.key === a.eligibility)?.label;
      return `${from} to students who said “${said ?? 'this applies to me'}”. You chose that in Semester.`;
    }
    case 'student':
      return `${from} to you.`;
  }
}

const DAY = 86_400_000;

/**
 * The priority the Action Center ranks it by, from what the office said it is
 * and nothing else: an obligation with a date inside two weeks is high, an
 * obligation otherwise normal, a resource or event low.
 */
export function officePriority(a: OfficeAction, now: number): Priority {
  if (a.type === 'resource' || a.type === 'event') return 'low';
  if (a.dueAt !== null && a.dueAt - now <= 14 * DAY) return 'high';
  return 'normal';
}

/**
 * The office action as one of the Action Center's actions. Its id is stable,
 * so the student's snooze, dismissal or "this is wrong" stays with it; opening
 * the official page confirms first, like every hand-off.
 */
export function officeActionToAction(a: OfficeAction, now: number): Action {
  return {
    id: `office:${a.id}`,
    type: 'office',
    title: a.title,
    whyItMatters: a.why,
    priority: officePriority(a, now),
    dueAt: a.dueAt,
    // A day's grace after the date, then it leaves the list on its own.
    expiresAt: a.dueAt === null ? null : a.dueAt + DAY,
    group: 'From campus offices',
    source: { label: 'institution_verified', system: `${a.officeLabel} · ${a.sourceNote}`, at: a.updatedAt },
    explanation: {
      trigger: a.dueAt === null ? `${a.officeLabel} published this.` : `${a.officeLabel} published this, with a date.`,
      factors: [whyYouSee(a), `Source: ${a.sourceNote}`],
      expectedImpact: a.why,
      limitations: [
        'Semester shows what the office published. The official page is the record.',
        'Semester does not know whether you have already done this unless you mark it done.',
      ],
      alternatives: [
        `Ask ${a.officeLabel} directly.`,
        'Dismiss it if it does not apply to you.',
      ],
    },
    primary: { label: 'Open official page', kind: 'external', target: a.url, requiresConfirmation: true },
  };
}

/** What the office sees about completion: a count at ten or more, or why not. */
export function completionLine(completed: number | null | undefined): string {
  if (typeof completed === 'number' && completed >= 10) {
    return `${completed} students marked this done.`;
  }
  return 'Fewer than 10 students have marked this done, so no count is shown.';
}

// ── The publish workflow (the office desk) ────────────────────────────────

export type DeskStatus = 'draft' | 'in_review' | 'published' | 'withdrawn';
export type DeskStep = 'submit' | 'approve' | 'return' | 'withdraw';

export const STATUS_TEXT: Record<DeskStatus, string> = {
  draft: 'Draft',
  in_review: 'Waiting for review',
  published: 'Published',
  withdrawn: 'Withdrawn',
};

/**
 * The buttons a desk row offers. The database decides; this only leaves out
 * the ones it would refuse — in particular, approving your own.
 */
export function deskSteps(status: DeskStatus, mine: boolean): DeskStep[] {
  switch (status) {
    case 'draft':
      return ['submit', 'withdraw'];
    case 'in_review':
      return mine ? ['withdraw'] : ['approve', 'return', 'withdraw'];
    case 'published':
      return ['withdraw'];
    case 'withdrawn':
      return [];
  }
}

export interface Draft {
  office: string;
  scopeKind: string;
  scopeId: string;
  type: OfficeActionType;
  audience: Exclude<Audience, 'student'>;
  target: string;
  title: string;
  why: string;
  /** YYYY-MM-DD, or empty. */
  due: string;
  url: string;
  source: string;
}

/** What is missing or not allowed, in the order the form asks. Empty when it can be saved. */
export function draftProblems(d: Draft, resourceOnly: boolean): string[] {
  const out: string[] = [];
  if (!d.office) out.push('Choose the office publishing this.');
  if (resourceOnly && d.type !== 'resource' && d.type !== 'event') out.push('Your role can publish resources and events only.');
  if (!d.title.trim()) out.push('Add a title.');
  if (!d.why.trim()) out.push('Say why it matters.');
  if (UNCALM.test(d.title) || UNCALM.test(d.why)) out.push('Rephrase without “at risk”, “failing” or “behind”.');
  if (!isHttps(d.url.trim())) out.push('Add the official page, starting https://.');
  if (!d.source.trim()) out.push('Say where this comes from.');
  if (d.audience !== 'tenant' && !d.target.trim()) out.push(`Name the ${d.audience} this is for.`);
  if (d.audience === 'eligibility' && d.target && !isEligibility(d.target)) out.push('Choose an eligibility from the list.');
  if (d.due && !/^\d{4}-\d{2}-\d{2}$/.test(d.due)) out.push('Use a date like 2026-10-15.');
  return out;
}

/** The due date as the end of that day, UTC, for the database; null when none. */
export const dueInstant = (due: string) => (due ? `${due}T23:59:00Z` : null);
