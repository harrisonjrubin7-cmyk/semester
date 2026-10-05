import type { Screen } from './types';
import type { OfficeId } from './offices';

/**
 * From "you're in" to the fifth week of the first term.
 *
 * The weeks between an offer and the first class are where students lose the
 * thread: six offices each send their own email, each with its own portal and
 * its own deadline, and nobody puts them in one list in the order they fall.
 * This is that list. It is a checklist a student keeps, not a record the
 * university keeps — ticking "deposit paid" here pays nothing and tells
 * admissions nothing, and every step that an office decides names the office.
 *
 * ## Stages are what the student says
 *
 * `stage` is chosen, never inferred. A prospective student and an enrolled one
 * see different steps because they said which they are, and a school-verified
 * account is a separate fact (`verified`) that only a connected school can set.
 * The screen shows both and never lets one stand in for the other.
 *
 * ## Student types add steps, never remove them
 *
 * Transfer, international, online, adult, commuter and veteran students each
 * have steps a first-year does not — credit evaluation, an immigration check-in,
 * a parking plan. Choosing a type *adds* those. Nothing is withheld because of a
 * type, and a type is never used for anything but this list: it is not sent
 * anywhere, not shown to staff, and not a segment. `launchpad.test.ts` holds
 * that the first-year list is a subset of every other list.
 */

export const STAGES = [
  { id: 'prospect', label: 'Exploring', says: 'Still deciding where to go.' },
  { id: 'admitted', label: 'Admitted', says: 'Have an offer, have not confirmed.' },
  { id: 'confirmed', label: 'Confirmed', says: 'Deposit paid, getting ready.' },
  { id: 'arriving', label: 'Arriving', says: 'Orientation and move-in.' },
  { id: 'first-term', label: 'First term', says: 'Classes have started.' },
] as const;

export type Stage = (typeof STAGES)[number]['id'];

export const STUDENT_TYPES = [
  { id: 'first-year', label: 'First-year' },
  { id: 'transfer', label: 'Transfer' },
  { id: 'international', label: 'International' },
  { id: 'online', label: 'Online' },
  { id: 'adult', label: 'Adult learner' },
  { id: 'commuter', label: 'Commuter' },
  { id: 'veteran', label: 'Veteran or military' },
] as const;

export type StudentType = (typeof STUDENT_TYPES)[number]['id'];

/** Whether a step is done at an office, planned by you, or learned. */
export type StepKind = 'official' | 'plan' | 'learn';

export interface Step {
  id: string;
  title: string;
  detail: string;
  kind: StepKind;
  /** The earliest stage this step belongs to. */
  stage: Stage;
  /** Who decides it. Present on every `official` step. */
  office?: OfficeId;
  /** Where in this app the step can be worked on, if anywhere. */
  screen?: Screen;
  /** Only for these student types. Absent means everybody. */
  only?: readonly StudentType[];
}

/*
 * The order the deadlines usually fall in. Usually: a school that wants the
 * housing form before the deposit will say so, and the step says "the office
 * decides" for exactly that reason.
 */
export const STEPS: readonly Step[] = [
  // ── Exploring ───────────────────────────────────────────────────────────
  { id: 'explore-majors', stage: 'prospect', kind: 'plan', title: 'Explore majors and programs', detail: 'Read what each program requires in the first year, and which courses open it.', screen: 'degree' },
  { id: 'preview-term', stage: 'prospect', kind: 'learn', title: 'See what a first semester looks like', detail: 'Class hours, study hours and what a week holds — an estimate, below.' },
  { id: 'compare-costs', stage: 'prospect', kind: 'plan', title: 'Compare the real cost', detail: 'Put each offer side by side, with loans counted as loans.', screen: 'pathway' },

  // ── Admitted ────────────────────────────────────────────────────────────
  { id: 'confirm', stage: 'admitted', kind: 'official', office: 'admissions', title: 'Confirm your enrollment', detail: 'Accept the offer by the date in your admission letter.' },
  { id: 'deposit', stage: 'admitted', kind: 'official', office: 'admissions', title: 'Pay the enrollment deposit', detail: 'Or ask admissions about a deposit waiver — many schools have one.' },
  { id: 'aid-accept', stage: 'admitted', kind: 'official', office: 'financialaid', title: 'Review and accept your aid offer', detail: 'Accept, reduce or decline each award in the aid portal. Loans are optional.', screen: 'costs' },
  { id: 'accounts', stage: 'admitted', kind: 'official', office: 'it', title: 'Activate your school accounts', detail: 'Email, single sign-on and multi-factor authentication.' },

  // ── Confirmed ───────────────────────────────────────────────────────────
  { id: 'transcripts', stage: 'confirmed', kind: 'official', office: 'admissions', title: 'Send final transcripts', detail: 'Your last school sends them; admissions confirms receipt.' },
  { id: 'immunization', stage: 'confirmed', kind: 'official', office: 'health', title: 'Submit immunization records', detail: 'Student health lists which records are required and by when.' },
  { id: 'insurance', stage: 'confirmed', kind: 'official', office: 'health', title: 'Enroll in or waive health insurance', detail: 'A waiver usually needs your own plan’s details.' },
  { id: 'placement', stage: 'confirmed', kind: 'official', office: 'advising', title: 'Take any placement tests', detail: 'Math and language placement decide which first courses you can take.' },
  { id: 'housing-app', stage: 'confirmed', kind: 'official', office: 'housing', title: 'Apply for housing', detail: 'Or confirm you are living off campus.', screen: 'housing' },
  { id: 'orientation-register', stage: 'confirmed', kind: 'official', office: 'orientation', title: 'Register for orientation', detail: 'Sessions fill; the earlier dates go first.' },
  { id: 'advisor-meet', stage: 'confirmed', kind: 'official', office: 'advising', title: 'Meet your advisor', detail: 'Bring the list of courses you are thinking about.', screen: 'people' },
  { id: 'first-courses', stage: 'confirmed', kind: 'plan', title: 'Choose first-term courses', detail: 'Build a cart and backups before your registration time.', screen: 'yes' },
  { id: 'id-card', stage: 'confirmed', kind: 'official', office: 'it', title: 'Upload your ID card photo', detail: 'So the card is ready at move-in.' },

  // ── Arriving ────────────────────────────────────────────────────────────
  { id: 'arrival-plan', stage: 'arriving', kind: 'plan', title: 'Plan arrival and move-in', detail: 'Date, time slot and what to bring.', screen: 'pathway' },
  { id: 'campus-tour', stage: 'arriving', kind: 'learn', title: 'Walk your first-day route', detail: 'Find your classrooms, the library and a place to eat before classes start.', screen: 'maps' },
  { id: 'tools', stage: 'arriving', kind: 'learn', title: 'Learn the course site and Semester', detail: 'Where syllabi, assignments and grades live — and import each syllabus here.', screen: 'import' },
  { id: 'emergency', stage: 'arriving', kind: 'plan', title: 'Save emergency contacts', detail: 'Campus safety, the crisis line and who to call after hours.', screen: 'support' },

  // ── First term ──────────────────────────────────────────────────────────
  { id: 'integrity', stage: 'first-term', kind: 'learn', title: 'Complete the academic integrity module', detail: 'What counts as your own work, and what each course allows — including AI.' },
  { id: 'office-hours', stage: 'first-term', kind: 'learn', title: 'Go to one office hour', detail: 'Any course, any question. It is what they are for.', screen: 'people' },
  { id: 'tutoring', stage: 'first-term', kind: 'learn', title: 'Find tutoring and writing support', detail: 'Know where they are before you need them.', screen: 'support' },
  { id: 'study-plan', stage: 'first-term', kind: 'plan', title: 'Build your first study plan', detail: 'Put every deadline in and see the weeks that pile up.', screen: 'work' },
  { id: 'one-event', stage: 'first-term', kind: 'plan', title: 'Go to one campus event', detail: 'A club fair, a talk, a game — one is enough to start.', screen: 'activities' },
  { id: 'reflect', stage: 'first-term', kind: 'plan', title: 'Look back on the first month', detail: 'Four questions, private to you. Below.' },

  // ── By student type ─────────────────────────────────────────────────────
  { id: 'transfer-credit', stage: 'admitted', kind: 'official', office: 'registrar', only: ['transfer'], title: 'Request your transfer credit evaluation', detail: 'See which of your courses count, and toward what.', screen: 'degree' },
  { id: 'transfer-orientation', stage: 'confirmed', kind: 'official', office: 'orientation', only: ['transfer'], title: 'Register for transfer orientation', detail: 'Often separate from first-year orientation.' },
  { id: 'immigration-docs', stage: 'admitted', kind: 'official', office: 'international', only: ['international'], title: 'Start your immigration documents', detail: 'Your international office issues the form your visa application needs. Their advice, not this app’s.' },
  { id: 'intl-arrival', stage: 'arriving', kind: 'official', office: 'international', only: ['international'], title: 'Check in with international student services', detail: 'Most schools require it within days of arrival.' },
  { id: 'online-tech', stage: 'confirmed', kind: 'learn', only: ['online'], title: 'Check your device, camera and connection', detail: 'Before the first live session, not during it.' },
  { id: 'online-orientation', stage: 'arriving', kind: 'official', office: 'orientation', only: ['online'], title: 'Attend virtual orientation', detail: 'Recorded sessions count at some schools; check.' },
  { id: 'prior-learning', stage: 'admitted', kind: 'official', office: 'continuing', only: ['adult', 'veteran'], title: 'Ask about credit for prior learning', detail: 'Work, military training and exams can count toward a degree.' },
  { id: 'childcare', stage: 'confirmed', kind: 'plan', only: ['adult'], title: 'Plan childcare around class times', detail: 'Campus childcare and family resources are in Support.', screen: 'support' },
  { id: 'commute-plan', stage: 'confirmed', kind: 'plan', only: ['commuter'], title: 'Plan the commute', detail: 'Parking or transit, and how early to leave on a bad-weather day.', screen: 'support' },
  { id: 'va-certify', stage: 'admitted', kind: 'official', office: 'registrar', only: ['veteran'], title: 'Ask the certifying official to certify your benefits', detail: 'Education benefits are certified per term, by the school.' },
];

/** Every step this student would see, in stage order, first-year steps first. */
export function stepsFor(types: readonly StudentType[]): Step[] {
  const order = STAGES.map((s) => s.id);
  return STEPS.filter((s) => !s.only || s.only.some((t) => types.includes(t))).sort(
    (a, b) => order.indexOf(a.stage) - order.indexOf(b.stage),
  );
}

/** The steps at or before this stage that are not done yet. */
export function openSteps(steps: readonly Step[], stage: Stage, done: Readonly<Record<string, string>>): Step[] {
  const at = STAGES.findIndex((s) => s.id === stage);
  return steps.filter((s) => STAGES.findIndex((x) => x.id === s.stage) <= at && !done[s.id]);
}

/** Done out of all, for the stages the student has reached. */
export function progress(steps: readonly Step[], stage: Stage, done: Readonly<Record<string, string>>) {
  const at = STAGES.findIndex((s) => s.id === stage);
  const reached = steps.filter((s) => STAGES.findIndex((x) => x.id === s.stage) <= at);
  const n = reached.filter((s) => done[s.id]).length;
  return { done: n, of: reached.length };
}

/**
 * A first semester in hours — an estimate, and labelled as one everywhere.
 *
 * The two-hours-outside-per-credit rule is a convention many catalogs state,
 * not a measurement of anybody. It is here so a student can see that fifteen
 * credits is not fifteen hours a week, which is the surprise it prevents.
 */
export function semesterPreview(credits: readonly number[], outsidePerCredit = 2) {
  const inClass = credits.reduce((a, c) => a + (Number.isFinite(c) && c > 0 ? c : 0), 0);
  const outside = inClass * outsidePerCredit;
  return { courses: credits.length, inClass, outside, total: inClass + outside };
}

/** Plain definitions of the words every office assumes you know. */
export const GLOSSARY: readonly { term: string; plain: string }[] = [
  { term: 'Registrar', plain: 'The office that keeps your official record: classes, grades, enrollment.' },
  { term: 'Bursar', plain: 'The office that bills you. Also called student accounts.' },
  { term: 'Credit hour', plain: 'A unit of a course. Usually one hour in class each week for a term.' },
  { term: 'Syllabus', plain: 'A course’s rules: what is due, when, and how it is graded.' },
  { term: 'Office hours', plain: 'Times a professor or TA sets aside for students to drop in. Any question counts.' },
  { term: 'TA', plain: 'Teaching assistant — often a graduate student who runs sections and grades.' },
  { term: 'Add/drop', plain: 'The first weeks, when you can change classes without it showing on your record.' },
  { term: 'Withdrawal', plain: 'Leaving a course after add/drop. It shows as a W, not a grade.' },
  { term: 'Prerequisite', plain: 'A course you must finish before you can take another.' },
  { term: 'Hold', plain: 'A block on your account — often a form or payment — that stops registration.' },
  { term: 'Pass/fail', plain: 'A grading option where you get P or F instead of a letter. Rules vary.' },
  { term: 'GPA', plain: 'Your grade point average — each grade turned into points, weighted by credits.' },
  { term: 'Major / minor', plain: 'Your main field of study, and an optional smaller second one.' },
  { term: 'Advisor', plain: 'The person who helps you plan courses and checks you are on track to graduate.' },
  { term: 'LMS', plain: 'The course website — Brightspace, Canvas or similar — where materials and grades live.' },
  { term: 'FAFSA', plain: 'The U.S. federal form that decides most financial aid. Filed every year.' },
  { term: 'Work-study', plain: 'A form of aid you earn by working a campus job. Eligibility comes from financial aid.' },
  { term: 'Dean', plain: 'The head of a school or college within the university.' },
  { term: 'Provost', plain: 'The university’s chief academic officer.' },
  { term: 'Audit', plain: 'Attending a course without credit or a grade.' },
];

/** Short explainers — the things nobody says out loud in the first week. */
export const EXPLAINERS: readonly { id: string; title: string; body: string }[] = [
  { id: 'faculty', title: 'Professors, TAs and office hours', body: 'Professors design the course and give lectures. TAs usually run smaller sections and do much of the grading. Both hold office hours, and both expect students to come — with a question, a confusion, or just to introduce yourself. Nobody keeps score of who comes.' },
  { id: 'integrity', title: 'Academic integrity', body: 'Each course sets what help is allowed: working together, using notes, using AI. The syllabus says, and when it does not, ask before, not after. Citing where an idea came from is never wrong.' },
  { id: 'syllabus', title: 'Reading a syllabus', body: 'The syllabus is the course’s contract: dates, weights, late rules, and what counts as an excuse. Import it here and every date lands in your calendar.' },
  { id: 'email', title: 'Emailing a professor', body: 'Use your school address. Say which course and section. Ask one thing. Sign with your name. A short, specific email gets a faster answer than a long apology.' },
  { id: 'help', title: 'Asking for help is normal', body: 'Tutoring, writing centers, advisors and office hours exist because nearly everyone uses them. Using them early is what students who do well tend to do — it is not a sign that something is wrong.' },
];

/** Private first-month reflection. Never scored, never sent. */
export const REFLECTION_PROMPTS: readonly { id: string; prompt: string }[] = [
  { id: 'surprise', prompt: 'What surprised you most about how classes work here?' },
  { id: 'working', prompt: 'What is working that you want to keep doing?' },
  { id: 'help', prompt: 'Where would one conversation with somebody help?' },
  { id: 'next', prompt: 'One thing to try in the next month.' },
];

/** What a supporter might want to know — with no access to your records. */
export const SUPPORTER_TOPICS: readonly { title: string; body: string }[] = [
  { title: 'Key dates', body: 'Move-in, breaks and exam weeks from the published academic calendar.' },
  { title: 'Paying the bill', body: 'How payment plans and authorized payers work at the student accounts office.' },
  { title: 'Privacy law', body: 'In the U.S., FERPA means a school does not share a student’s record with family without the student’s consent.' },
  { title: 'Where to send them', body: 'The care network is the right first call when a supporter is worried.' },
];

/**
 * A peer mentor, matched only on what the student chose.
 *
 * Interests are ticked by the student; nothing is inferred from use of the
 * app. A mentor is proposed, not introduced — contact happens only when both
 * accept, through the program, which is why a match here carries no email.
 */
export interface Mentor {
  id: string;
  name: string;
  interests: readonly string[];
  /** The student types this mentor volunteered to support. */
  supports: readonly StudentType[];
}

export const MENTOR_INTERESTS = [
  'Choosing a major',
  'Study habits',
  'Finding friends',
  'Campus jobs',
  'Research',
  'Commuting',
  'Being first in my family',
  'Transferring in',
  'Coming from abroad',
] as const;

export function matchMentors(
  interests: readonly string[],
  types: readonly StudentType[],
  mentors: readonly Mentor[],
  limit = 3,
): { mentor: Mentor; shared: string[] }[] {
  if (!interests.length) return [];
  return mentors
    .map((mentor) => ({
      mentor,
      shared: mentor.interests.filter((i) => interests.includes(i)),
      supports: mentor.supports.some((t) => types.includes(t)),
    }))
    .filter((m) => m.shared.length > 0)
    .sort((a, b) => b.shared.length - a.shared.length || Number(b.supports) - Number(a.supports) || a.mentor.name.localeCompare(b.mentor.name))
    .slice(0, limit)
    .map(({ mentor, shared }) => ({ mentor, shared }));
}

export interface LaunchpadLibrary {
  stage: Stage;
  types: StudentType[];
  /** Step id → the ISO date it was ticked. */
  done: Record<string, string>;
  reflection: Record<string, string>;
  mentorOptIn: boolean;
  interests: string[];
}

export const EMPTY_LAUNCHPAD: LaunchpadLibrary = {
  stage: 'admitted',
  types: ['first-year'],
  done: {},
  reflection: {},
  mentorOptIn: false,
  interests: [],
};

const STAGE_IDS = new Set<string>(STAGES.map((s) => s.id));
const TYPE_IDS = new Set<string>(STUDENT_TYPES.map((t) => t.id));
const STEP_IDS = new Set(STEPS.map((s) => s.id));

function strings(v: unknown, keep: (s: string) => boolean, max: number): string[] {
  return Array.isArray(v) ? [...new Set(v.filter((x): x is string => typeof x === 'string' && keep(x)))].slice(0, max) : [];
}

function record(v: unknown, keep: (k: string) => boolean, max: number): Record<string, string> {
  if (!v || typeof v !== 'object' || Array.isArray(v)) return {};
  const out: Record<string, string> = {};
  for (const [k, x] of Object.entries(v)) {
    if (typeof x === 'string' && keep(k)) out[k] = x.slice(0, max);
  }
  return out;
}

/** Whatever was stored, made safe to draw. Unknown ids are dropped. */
export function readLaunchpad(v: unknown): LaunchpadLibrary {
  if (!v || typeof v !== 'object') return EMPTY_LAUNCHPAD;
  const o = v as Record<string, unknown>;
  const types = strings(o.types, (t) => TYPE_IDS.has(t), STUDENT_TYPES.length) as StudentType[];
  return {
    stage: typeof o.stage === 'string' && STAGE_IDS.has(o.stage) ? (o.stage as Stage) : EMPTY_LAUNCHPAD.stage,
    types: types.length ? types : ['first-year'],
    done: record(o.done, (k) => STEP_IDS.has(k), 32),
    reflection: record(o.reflection, (k) => REFLECTION_PROMPTS.some((p) => p.id === k), 2000),
    mentorOptIn: o.mentorOptIn === true,
    interests: strings(o.interests, (i) => (MENTOR_INTERESTS as readonly string[]).includes(i), MENTOR_INTERESTS.length),
  };
}
