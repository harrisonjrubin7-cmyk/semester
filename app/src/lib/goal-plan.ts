import { dateToIso, isoToDate, shiftIso } from './date';
import type { NeedId } from './help-routes';

/**
 * From a goal in the student's own words to a plan they can change.
 *
 * "Get my registration sorted", "do well on the chem midterm", "find an
 * internship" are each a sentence and a month of work. This turns the sentence
 * into a few dated milestones, the actions under them, some places a study or
 * work block could go, and a person to ask, and then gets out of the way.
 *
 * ## Rules, not a model
 *
 * Classification is keyword rules in a fixed order. The same goal gives the
 * same plan on every device, in tests and offline, and when it is wrong the
 * reason is a line in `RULES` that anyone can read. A model could write nicer
 * milestones and could also invent a deadline; this cannot.
 *
 * ## The student holds the plan
 *
 * What comes back is plain data: no locked field, no step that cannot be
 * removed, no state the app keeps for itself. Each `edit` helper returns a new
 * plan and accepts any change, including deleting everything. Calendar blocks
 * are proposals (`proposal: true`) in minutes; nothing here writes to a
 * calendar, and a block only becomes an event when the student places it.
 *
 * ## It does not refuse
 *
 * A goal no rule recognises gets a generic three-milestone scaffold, not an
 * error. "Learn to juggle" and "be less tired" are goals too.
 *
 * ## Registration, counted back
 *
 * Registration is the one template with fixed shape (review open requirements,
 * create a primary schedule, save two backups per course, prepare an advisor
 * agenda, complete the official handoff) and dates counted back from the
 * registration date: 21, 14, 10, 7 and 0 days before. When there are fewer
 * than 21 days left the offsets are squeezed in proportion, so the order holds
 * and nothing is dated in the past. The last step is a handoff because
 * Semester does not register anyone; the institution's own system does.
 */

export const CATEGORIES = ['academic', 'learning', 'career', 'practical', 'support', 'registration'] as const;
export type Category = (typeof CATEGORIES)[number];
export type PlanKind = Category | 'general';

/**
 * Keyword stems per category, and the order ties are settled in. A stem
 * matches the start of a word, so `regist` finds register, registered and
 * registration; one ending in `=` must be the whole word, so `lab=` does not
 * find "label" and `final=` does not find "finally". More specific purposes come first: someone planning
 * registration who also mentions "help" is planning registration.
 */
export const RULES: readonly { category: Category; stems: readonly string[] }[] = [
  { category: 'registration', stems: ['regist', 'enrol', 'enroll', 'waitlist', 'add/drop', 'add or drop', 'course selection', 'pick classes', 'choose classes', 'build my schedule'] },
  { category: 'career', stems: ['internship', 'job=', 'jobs=', 'career', 'resume', 'résumé', 'cv=', 'interview', 'network', 'linkedin', 'portfolio', 'co-op', 'coop'] },
  { category: 'support', stems: ['tutor', 'help', 'counsel', 'wellbeing', 'well-being', 'stress', 'anxi', 'accessib', 'accommodat', 'office hours', 'advisor', 'adviser', 'mentor', 'support'] },
  { category: 'practical', stems: ['housing', 'rent=', 'rental', 'budget', 'money', 'financial', 'scholarship', 'visa', 'commut', 'bus=', 'parking', 'meal', 'laundry', 'moving', 'sleep', 'routine'] },
  { category: 'academic', stems: ['exam', 'midterm', 'final=', 'finals=', 'essay', 'paper', 'assignment', 'thesis', 'gpa', 'grade', 'lab=', 'labs=', 'quiz', 'course', 'class', 'lecture', 'homework', 'study', 'revise', 'revision'] },
  { category: 'learning', stems: ['learn', 'skill', 'practice', 'practise', 'improve', 'get better', 'master', 'language', 'python', 'coding', 'read more', 'habit'] },
];

/** The category a goal falls in, or null when no rule matches. Most matches win; a tie goes to the earlier rule. */
export function classifyGoal(goal: string): Category | null {
  const text = ` ${goal.toLowerCase().replace(/\s+/g, ' ')} `;
  let best: { category: Category; hits: number } | null = null;
  for (const { category, stems } of RULES) {
    const hits = stems.filter((s) => {
      const whole = s.endsWith('=');
      const stem = (whole ? s.slice(0, -1) : s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      return new RegExp(`(?:^|[^\\p{L}\\p{N}])${stem}${whole ? '(?:$|[^\\p{L}\\p{N}])' : ''}`, 'u').test(text);
    }).length;
    if (hits > (best?.hits ?? 0)) best = { category, hits };
  }
  return best?.category ?? null;
}

export interface Milestone {
  id: string;
  title: string;
  /** YYYY-MM-DD, or null when the goal has no date to count from. */
  by: string | null;
}

export interface Action {
  id: string;
  title: string;
  /** Which milestone it belongs under, or null. */
  milestone: string | null;
  done: boolean;
}

export interface CalendarBlock {
  id: string;
  title: string;
  /** YYYY-MM-DD */
  day: string;
  minutes: number;
  /** Always true: a place a block could go, not an event. */
  proposal: true;
}

export interface SourceLink {
  label: string;
  /** Where in the institution's own material to look. Not a URL: Semester does not invent addresses. */
  where: string;
}

export interface HumanRoute {
  need: NeedId;
  label: string;
  note: string;
}

export interface GoalPlan {
  goal: string;
  kind: PlanKind;
  /** The date the goal is aimed at, if the student gave one. */
  target: string | null;
  milestones: Milestone[];
  actions: Action[];
  calendarBlocks: CalendarBlock[];
  sourceLinks: SourceLink[];
  /** YYYY-MM-DD: when to look at how it is going. */
  progressReview: string;
  humanRoute: HumanRoute;
}

export interface GoalInput {
  goal: string;
  /** YYYY-MM-DD the goal is aimed at, optional. */
  by?: string | null;
  /** YYYY-MM-DD registration opens for this student; used by the registration template. */
  registrationDate?: string | null;
  now: Date;
}

interface Template {
  /** Milestone titles with the share of the way to the target each falls at. */
  milestones: readonly { title: string; at: number; actions: readonly string[] }[];
  minutes: number;
  sources: readonly SourceLink[];
  route: HumanRoute;
}

const TEMPLATES: Record<Exclude<PlanKind, 'registration'>, Template> = {
  academic: {
    milestones: [
      { title: 'Gather what is due and when', at: 0.2, actions: ['List the assignments or topics involved', 'Check each date against the syllabus'] },
      { title: 'Do a first pass', at: 0.6, actions: ['Work through the main material once', 'Note the parts that are unclear'] },
      { title: 'Review and finish', at: 1, actions: ['Go back to the unclear parts', 'Finish and check it'] },
    ],
    minutes: 90,
    sources: [{ label: 'Course syllabus', where: 'The syllabus for this course' }, { label: 'Course page', where: 'Your learning platform’s course page' }],
    route: { need: 'course', label: 'Your instructor or TA', note: 'Office hours are the quickest way to check what is expected.' },
  },
  learning: {
    milestones: [
      { title: 'Pick a resource and a pace', at: 0.2, actions: ['Choose one place to learn from', 'Decide how often you will practise'] },
      { title: 'Practise regularly', at: 0.65, actions: ['Do the short sessions you planned', 'Note what is getting easier'] },
      { title: 'Show what you can do', at: 1, actions: ['Explain it to someone, or make one small thing with it'] },
    ],
    minutes: 45,
    sources: [{ label: 'Library guides', where: 'Your library’s subject guides' }],
    route: { need: 'course', label: 'A tutor or your instructor', note: 'Someone who knows the subject can point at the next step.' },
  },
  career: {
    milestones: [
      { title: 'Update your résumé or profile', at: 0.3, actions: ['Add what you have done recently', 'Ask someone to read it'] },
      { title: 'Reach out to two people', at: 0.65, actions: ['Pick two people or organisations', 'Send a short message to each'] },
      { title: 'Apply or follow up', at: 1, actions: ['Submit one application, or follow up on one you sent'] },
    ],
    minutes: 60,
    sources: [{ label: 'Career centre', where: 'Your career centre’s listings and guides' }],
    route: { need: 'career', label: 'A career coach', note: 'Career centres usually review résumés and practise interviews for free.' },
  },
  practical: {
    milestones: [
      { title: 'List what has to be sorted', at: 0.25, actions: ['Write down what needs to happen and who handles it'] },
      { title: 'Make the first call or form', at: 0.6, actions: ['Contact the office or fill in the form'] },
      { title: 'Confirm it is done', at: 1, actions: ['Check you have the confirmation in writing'] },
    ],
    minutes: 30,
    sources: [{ label: 'Student services', where: 'Your institution’s student services pages' }],
    route: { need: 'money', label: 'The office that handles it', note: 'Student services can say which office that is.' },
  },
  support: {
    milestones: [
      { title: 'Find the right person or office', at: 0.25, actions: ['Look up who offers this support'] },
      { title: 'Book a time', at: 0.6, actions: ['Send a message or book an appointment'] },
      { title: 'Go, and note what comes next', at: 1, actions: ['Write down anything they suggest'] },
    ],
    minutes: 30,
    sources: [{ label: 'Support directory', where: 'Your institution’s student support directory' }],
    route: { need: 'wellbeing', label: 'Your institution’s support services', note: 'Semester only points to the directory. It does not keep requests for this.' },
  },
  general: {
    milestones: [
      { title: 'Decide what done looks like', at: 0.25, actions: ['Write one sentence about what you want to be true'] },
      { title: 'Take the first step', at: 0.6, actions: ['Choose the smallest first step and do it'] },
      { title: 'Check in on how it is going', at: 1, actions: ['Look at what changed, and adjust the plan'] },
    ],
    minutes: 45,
    sources: [],
    route: { need: 'community', label: 'Someone you trust on campus', note: 'An advisor, instructor or student services can help you shape this.' },
  },
};

/** Days before the registration date, in the order the steps happen. */
export const REGISTRATION_OFFSETS = [21, 14, 10, 7, 0] as const;

const REGISTRATION_STEPS: readonly { title: string; actions: readonly string[]; minutes: number }[] = [
  { title: 'Review your open requirements', actions: ['Open your degree audit', 'List what is still needed this term'], minutes: 45 },
  { title: 'Create your primary schedule', actions: ['Build the schedule you would most like', 'Check it for time clashes'], minutes: 60 },
  { title: 'Save two backups for each course', actions: ['Pick two other sections or courses for each one'], minutes: 45 },
  { title: 'Prepare your advisor agenda', actions: ['Write your questions', 'Bring your schedule and backups'], minutes: 30 },
  { title: 'Complete the official handoff', actions: ['Register in your institution’s own system at your time. Semester does not register you.'], minutes: 30 },
];

const REGISTRATION_ROUTE: HumanRoute = {
  need: 'registration',
  label: 'Your advisor or the registrar',
  note: 'They can confirm requirements, holds and when your time opens.',
};

const REGISTRATION_SOURCES: SourceLink[] = [
  { label: 'Degree audit', where: 'Your institution’s degree audit' },
  { label: 'Registration dates', where: 'The registrar’s academic calendar' },
  { label: 'Course listings', where: 'The registrar’s course search' },
];

const ISO = /^\d{4}-\d{2}-\d{2}$/;
const validDay = (s: string | null | undefined): s is string => typeof s === 'string' && ISO.test(s) && dateToIso(isoToDate(s)) === s;
const daysBetween = (from: string, to: string) => Math.round((isoToDate(to).getTime() - isoToDate(from).getTime()) / 86_400_000);
const GOAL_MAX = 200;

/**
 * Build the plan. Pure: the same input gives the same plan.
 *
 * A date that is not a real YYYY-MM-DD is treated as no date, and a date
 * already past is too, rather than dating milestones before today.
 */
export function draftPlan(input: GoalInput): GoalPlan {
  const goal = input.goal.trim().slice(0, GOAL_MAX) || 'My goal';
  const today = dateToIso(input.now);
  const future = (s: string | null | undefined) => (validDay(s) && s >= today ? s : null);
  const category = classifyGoal(goal);
  const kind: PlanKind = category ?? 'general';

  if (kind === 'registration') return registrationPlan(goal, today, future(input.registrationDate) ?? future(input.by));

  const target = future(input.by);
  const t = TEMPLATES[kind];
  const span = target ? daysBetween(today, target) : null;
  const milestones = t.milestones.map((m, i): Milestone => ({
    id: `m${i + 1}`,
    title: m.title,
    by: span === null ? null : shiftIso(today, Math.round(span * m.at)),
  }));
  const actions = t.milestones.flatMap((m, i) => m.actions.map((title) => ({ title, milestone: `m${i + 1}`, done: false as boolean })));
  return {
    goal,
    kind,
    target,
    milestones,
    actions: actions.map((a, i) => ({ id: `a${i + 1}`, ...a })),
    calendarBlocks: spacedBlocks(today, span, t.minutes, goal),
    sourceLinks: t.sources.map((s) => ({ ...s })),
    progressReview: reviewDate(today, target),
    humanRoute: { ...t.route },
  };
}

function reviewDate(today: string, target: string | null): string {
  const week = shiftIso(today, 7);
  return target && target < week ? target : week;
}

/**
 * Up to six blocks, three days apart from tomorrow, stopping at the target.
 * With no date it proposes the first two, so there is somewhere to start.
 */
function spacedBlocks(today: string, span: number | null, minutes: number, goal: string): CalendarBlock[] {
  const count = span === null ? 2 : Math.min(6, Math.floor((span - 1) / 3) + 1);
  return Array.from({ length: Math.max(count, 0) }, (_, i) => ({
    id: `b${i + 1}`,
    title: `Work on: ${goal}`,
    day: shiftIso(today, 1 + i * 3),
    minutes,
    proposal: true as const,
  }));
}

function registrationPlan(goal: string, today: string, registration: string | null): GoalPlan {
  const left = registration ? daysBetween(today, registration) : null;
  // Fewer than 21 days left: squeeze the offsets in proportion so none lands before today.
  const scale = left === null ? 1 : Math.min(1, left / REGISTRATION_OFFSETS[0]);
  const day = (offset: number): string | null =>
    registration ? shiftIso(registration, -Math.round(offset * scale)) : null;
  const milestones = REGISTRATION_STEPS.map((s, i): Milestone => ({ id: `m${i + 1}`, title: s.title, by: day(REGISTRATION_OFFSETS[i]) }));
  const actions = REGISTRATION_STEPS.flatMap((s, i) => s.actions.map((title) => ({ title, milestone: `m${i + 1}`, done: false as boolean })));
  return {
    goal,
    kind: 'registration',
    target: registration,
    milestones,
    actions: actions.map((a, i) => ({ id: `a${i + 1}`, ...a })),
    // One block on each milestone's day, except the handoff, which happens in the official system.
    calendarBlocks: registration
      ? REGISTRATION_STEPS.slice(0, -1).map((s, i) => ({ id: `b${i + 1}`, title: s.title, day: milestones[i].by!, minutes: s.minutes, proposal: true as const }))
      : [],
    sourceLinks: REGISTRATION_SOURCES.map((s) => ({ ...s })),
    progressReview: reviewDate(today, registration),
    humanRoute: { ...REGISTRATION_ROUTE },
  };
}

/* ---- Edits: each returns a new plan, and none refuses ---- */

const nextId = (prefix: string, ids: readonly string[]) =>
  `${prefix}${ids.reduce((n, id) => Math.max(n, Number(id.slice(prefix.length)) || 0), 0) + 1}`;

export const renameGoal = (p: GoalPlan, goal: string): GoalPlan => ({ ...p, goal: goal.trim().slice(0, GOAL_MAX) });

export const setProgressReview = (p: GoalPlan, day: string): GoalPlan => (validDay(day) ? { ...p, progressReview: day } : p);

export const editMilestone = (p: GoalPlan, id: string, patch: Partial<Pick<Milestone, 'title' | 'by'>>): GoalPlan => ({
  ...p,
  milestones: p.milestones.map((m) =>
    m.id === id
      ? { ...m, title: patch.title ?? m.title, by: patch.by === undefined ? m.by : patch.by === null || validDay(patch.by) ? patch.by : m.by }
      : m,
  ),
});

export const addMilestone = (p: GoalPlan, title: string, by: string | null = null): GoalPlan => ({
  ...p,
  milestones: [...p.milestones, { id: nextId('m', p.milestones.map((m) => m.id)), title, by: validDay(by) ? by : null }],
});

/** Removes the milestone and leaves its actions, which become unattached rather than lost. */
export const removeMilestone = (p: GoalPlan, id: string): GoalPlan => ({
  ...p,
  milestones: p.milestones.filter((m) => m.id !== id),
  actions: p.actions.map((a) => (a.milestone === id ? { ...a, milestone: null } : a)),
});

export const addAction = (p: GoalPlan, title: string, milestone: string | null = null): GoalPlan => ({
  ...p,
  actions: [...p.actions, { id: nextId('a', p.actions.map((a) => a.id)), title, milestone, done: false }],
});

export const toggleAction = (p: GoalPlan, id: string): GoalPlan => ({
  ...p,
  actions: p.actions.map((a) => (a.id === id ? { ...a, done: !a.done } : a)),
});

export const removeAction = (p: GoalPlan, id: string): GoalPlan => ({ ...p, actions: p.actions.filter((a) => a.id !== id) });

export const moveBlock = (p: GoalPlan, id: string, patch: Partial<Pick<CalendarBlock, 'day' | 'minutes'>>): GoalPlan => ({
  ...p,
  calendarBlocks: p.calendarBlocks.map((b) =>
    b.id === id
      ? {
          ...b,
          day: patch.day !== undefined && validDay(patch.day) ? patch.day : b.day,
          minutes: patch.minutes !== undefined && Number.isFinite(patch.minutes) && patch.minutes > 0 ? Math.round(patch.minutes) : b.minutes,
        }
      : b,
  ),
});

export const removeBlock = (p: GoalPlan, id: string): GoalPlan => ({ ...p, calendarBlocks: p.calendarBlocks.filter((b) => b.id !== id) });
