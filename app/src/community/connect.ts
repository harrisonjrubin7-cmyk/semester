/**
 * Semester Connect: the community layer as a contextual experience, and the
 * rules the brief of 29 September 2026 holds it to.
 *
 * The brief ("anything else I can add to the company site and/or app to
 * expand on social media, connection, social platform and community
 * building") asks for a social layer that helps a student find people,
 * groups, events, mentors, study partners and opportunities at the moment
 * those are useful — and not for a feed. Its answer to "what is it" is one
 * line, `POSITIONING`; its answer to "what is it not" is `INSTEAD`; and its
 * five questions are what the hub exists to answer.
 *
 * ## How this relates to what is already here
 *
 * `governance.ts` says how the community layer may grow and what it will
 * never be; `circles.ts`, `mentorship.ts`, `questions.ts` and the rest hold
 * the rules of one community shape each; `lib/communitiesregister.ts`
 * records where the four blueprints stand. None of them says where the
 * community layer *appears*, what a suggestion may say about why it
 * appeared, what a student publishes and to whom, what a collaboration room
 * is made of, or which recognition is never a measure. That is this file.
 * `lib/connectregister.ts` records where each of the brief's items stands.
 *
 * Every rule here is data or a pure function so a screen cannot cross it by
 * accident: `explainSuggestion` refuses an input it does not know,
 * `publish` refuses a visibility nobody chose, `openRoom` refuses a room
 * about nothing, and `recognise` refuses a badge nobody verified.
 */
import type { Screen } from '../lib/types';

export const POSITIONING = 'Semester Connect: the trusted network for campus life, learning, opportunity, and belonging.';

/** What the hub helps a student answer, in the brief's words. */
export const QUESTIONS = [
  'Who else is taking this course or preparing for this exam?',
  'Where can I find a study group, mentor, club, event, or campus community?',
  'What opportunities fit my interests, skills, pathway, or goals?',
  'How can I contribute a project, question, recommendation, or useful resource?',
  'Which people or organizations can help me take the next step?',
] as const;

/** The distinction the brief draws: what a generic social network does, and what is built instead. */
export const INSTEAD = [
  { avoid: 'An endless, engagement-driven feed', build: 'Relevant updates connected to courses, interests, goals and campus moments' },
  { avoid: 'Anonymous broad chat', build: 'Verified, opt-in, contextual community spaces' },
  { avoid: 'Student popularity rankings', build: 'Discovery, contribution and helpfulness without public comparison' },
  { avoid: 'Social activity used for risk scoring', build: 'Private, student-controlled participation only' },
  { avoid: 'Open direct messages between anyone', build: 'Consent-based requests, group channels and safe boundaries' },
  { avoid: 'A generic “friends” network', build: 'Study groups, clubs, cohorts, mentors, project teams and professional connections' },
] as const;

// ── Where the hub appears ───────────────────────────────────────────────────

/**
 * The hub is contextual: it appears inside screens that already exist and is
 * never a permanent navigation destination of its own (DO-NOT-BUILD rule 1).
 * The brief names Search, the campus hub and Me; here those are the search
 * shell, the Community screen and Me.
 */
export const HUB_HOMES: readonly Screen[] = ['search', 'community', 'me'];

export interface HubSection {
  id: string;
  /** What the section is called on the screen. */
  title: string;
  /** One line, in the second person, saying what is there. */
  sub: string;
  /** Which of the five questions it answers (index into QUESTIONS). */
  answers: 0 | 1 | 2 | 3 | 4;
  /** The screen that already holds the thing, or null while none does. */
  screen: Screen | null;
  /** Why there is no screen yet; empty when there is one. */
  gap: string;
}

/**
 * The hub's sections, in the order the brief lists them. A section with a
 * screen is a row that opens it; a section without one is not drawn, because
 * a door marked "coming soon" is a dead end with a label on it.
 */
export const HUB_SECTIONS: readonly HubSection[] = [
  { id: 'classmates', title: 'Who else is in your classes', sub: 'The people in each of your courses, as a chat you can leave', answers: 0, screen: 'classmates', gap: '' },
  { id: 'study', title: 'Study groups and course spaces', sub: 'Purpose-built spaces for a course, a study group or a support group', answers: 1, screen: 'community', gap: '' },
  { id: 'events', title: 'Clubs, events and everything that is not a class', sub: 'Your commitments on the same week as your classes, and the campus directory where your school supplies one', answers: 1, screen: 'activities', gap: '' },
  { id: 'projects', title: 'Project teams', sub: 'Group work: who owns which part, and whether the group is on pace', answers: 3, screen: 'groupwork', gap: '' },
  { id: 'mentors', title: 'Peer and alumni mentors', sub: 'Ask a mentor who opted in; only they can say yes', answers: 4, screen: 'launchpad', gap: '' },
  { id: 'opportunities', title: 'Research, internships, jobs, funding and study abroad', sub: 'One tracker, each kind with its office’s own checklist', answers: 2, screen: 'opportunities', gap: '' },
  { id: 'people', title: 'People who will write about you', sub: 'The relationships a recommendation letter rests on, started early', answers: 4, screen: 'people', gap: '' },
  { id: 'map', title: 'Campus map', sub: 'Buildings, offices and how to get there', answers: 1, screen: 'maps', gap: '' },
  { id: 'showcase', title: 'Your projects and portfolio', sub: 'Work you chose to show, to the people you chose', answers: 3, screen: null, gap: 'Evidence is saved privately (lib/career-evidence.ts); nothing publishes it to a chosen audience yet.' },
  { id: 'communities', title: 'Verified campus communities', sub: 'Every recognised organization, department, lab and office, with who stands behind it', answers: 1, screen: null, gap: 'Organizations exist in the database with no screen that lists them (communities register ORG-001).' },
  { id: 'saved', title: 'Saved communities, events, people and opportunities', sub: 'What you kept, in one place', answers: 1, screen: null, gap: 'Saved events live on the directory and saved opportunities on the tracker; nothing gathers them.' },
];

/** The sections a screen draws: those with somewhere to go. */
export const hubRows = (sections: readonly HubSection[] = HUB_SECTIONS): (HubSection & { screen: Screen })[] =>
  sections.filter((s): s is HubSection & { screen: Screen } => s.screen !== null);

// ── Why a suggestion appeared ───────────────────────────────────────────────

/**
 * The only things a community, event, people or opportunity suggestion may be
 * explained from, each with the words it is explained in. Every one is
 * something the student typed, ticked or joined on purpose. DO-NOT-BUILD
 * rule 3 wants the reason, the inputs and the limits beside anything
 * suggested; this is the reason's vocabulary.
 */
export const SUGGESTION_INPUTS = {
  interest: (v: string) => `you saved “${v}” as an interest`,
  career_interest: (v: string) => `you saved “${v}” as a career interest`,
  enrolled_course: (v: string) => `you are enrolled in ${v}`,
  opted_in: (v: string) => `you opted into ${v}`,
  goal: (v: string) => `you chose the goal “${v}”`,
  community_member: (v: string) => `you are a member of ${v}`,
  programme: (v: string) => `you told Semester you are in ${v}`,
} as const;

export type SuggestionInput = keyof typeof SUGGESTION_INPUTS;

/**
 * Never an input to a suggestion, by key, so a screen that tries is refused
 * rather than quietly ignored. Grades and attendance are the student's
 * record, not their choice; the rest is what the brief calls hidden
 * profiling.
 */
export const FORBIDDEN_SUGGESTION_INPUTS = [
  'grade', 'gpa', 'attendance', 'risk_label', 'academic_standing', 'disability', 'accommodation', 'health', 'financial', 'ai_history',
  'private_notes', 'schedule', 'location', 'messages', 'study_behaviour', 'usage',
] as const;

export const SUGGESTION_LIMITS =
  'Suggestions read only what you chose to tell Semester. Nothing about grades, attendance, health, money, where you are or what you wrote is used, and removing an interest stops the suggestion.';

export interface Explained {
  /** "Recommended because …" — one sentence a screen shows as it stands. */
  reason: string;
  /** The inputs, in words, one each. */
  inputs: string[];
  limits: string;
}

/**
 * The sentence beside a suggestion. Throws on an input this vocabulary does
 * not know, forbidden or merely unknown, and on no input at all — a
 * suggestion with no reason is one the brief forbids.
 */
export function explainSuggestion(inputs: readonly { kind: string; value: string }[]): Explained {
  if (inputs.length === 0) throw new Error('A suggestion needs at least one reason.');
  const words = inputs.map(({ kind, value }) => {
    if (!(kind in SUGGESTION_INPUTS)) throw new Error(`“${kind}” may not explain a suggestion.`);
    return SUGGESTION_INPUTS[kind as SuggestionInput](value);
  });
  const joined = words.length === 1 ? words[0] : `${words.slice(0, -1).join(', ')} and ${words[words.length - 1]}`;
  return { reason: `Recommended because ${joined}.`, inputs: words, limits: SUGGESTION_LIMITS };
}

// ── The showcase: what a student publishes, and to whom ─────────────────────

/** From nobody to everybody, in the brief's order. */
export const SHOWCASE_VISIBILITY = ['private', 'advisor', 'group', 'campus', 'public', 'employers'] as const;
export type ShowcaseVisibility = (typeof SHOWCASE_VISIBILITY)[number];

export const VISIBILITY_MEANS: Record<ShowcaseVisibility, string> = {
  private: 'Only you',
  advisor: 'You and an advisor you named',
  group: 'A course or project group you are in',
  campus: 'Signed-in students at your school',
  public: 'Anyone with the link, as your public portfolio',
  employers: 'Employers your school approved, while your talent profile is switched on',
};

export const SHOWCASE_KINDS = [
  'Research poster', 'Design work', 'Writing sample', 'Coding project', 'Lab work', 'Presentation', 'Community-service project',
  'Club or leadership work', 'Capstone project', 'Startup or entrepreneurial work', 'Competition submission', 'Academic reflection',
] as const;

/** Employer visibility rests on the talent-profile opt-in, which expires (expansion SQL: 180 days). */
export const EMPLOYER_OPT_IN_DAYS = 180;

export interface ShowcaseItem {
  id: string;
  title: string;
  kind: (typeof SHOWCASE_KINDS)[number];
  visibility: ShowcaseVisibility;
  /** Who set the visibility. Only the student may; null means nobody has, and the item is private. */
  chosenBy: 'student' | null;
  /** When the employer opt-in ends, ISO; required for `employers`. */
  talentOptInUntil?: string;
}

/** A new item is private and nobody has chosen otherwise. */
export function newShowcaseItem(id: string, title: string, kind: ShowcaseItem['kind']): ShowcaseItem {
  return { id, title, kind, visibility: 'private', chosenBy: null };
}

/**
 * The student sets where an item is seen. Anything but the student asking is
 * refused, and `employers` is refused without a live opt-in — the brief's
 * "consent time-limited" for employer access.
 */
export function publish(item: ShowcaseItem, to: ShowcaseVisibility, by: 'student' | 'advisor' | 'institution' | 'system', at: Date, optInUntil?: string): ShowcaseItem {
  if (by !== 'student') throw new Error('Only the student publishes their own work.');
  if (to === 'employers') {
    // A date that does not parse is NaN, and every comparison with NaN is
    // false: without the finite check it would pass both bounds and never end.
    const until = optInUntil ? new Date(optInUntil).getTime() : NaN;
    if (!Number.isFinite(until) || until <= at.getTime()) throw new Error('Employer visibility needs a talent profile that is switched on and has not expired.');
    const days = (until - at.getTime()) / 86_400_000;
    if (days > EMPLOYER_OPT_IN_DAYS) throw new Error(`A talent-profile opt-in lasts ${EMPLOYER_OPT_IN_DAYS} days at most.`);
    return { ...item, visibility: to, chosenBy: 'student', talentOptInUntil: optInUntil };
  }
  const { talentOptInUntil: _gone, ...rest } = item;
  return { ...rest, visibility: to, chosenBy: 'student' };
}

/** Items visible beyond the student that no student chose: must always be none. */
export const publishedWithoutChoice = (items: readonly ShowcaseItem[]): ShowcaseItem[] =>
  items.filter((i) => i.visibility !== 'private' && i.chosenBy !== 'student');

/**
 * What an item is visible as right now. An employer opt-in that has expired,
 * or whose date does not parse, makes the item private: the student chose
 * employers, and falling back to any wider audience would be a disclosure
 * nobody chose.
 */
export function visibleAs(item: ShowcaseItem, at: Date): ShowcaseVisibility {
  if (item.visibility !== 'employers') return item.visibility;
  const until = item.talentOptInUntil ? new Date(item.talentOptInUntil).getTime() : NaN;
  return Number.isFinite(until) && until > at.getTime() ? 'employers' : 'private';
}

export const NEVER_INFERRED = 'A portfolio claim is never inferred from coursework. The student writes it, links the evidence, and says who may see it.';

// ── Collaboration rooms ─────────────────────────────────────────────────────

/** What a room is made of. Every part is drawn; none is a separate app. */
export const ROOM_PARTS = [
  { id: 'agenda', label: 'Shared agenda' },
  { id: 'actions', label: 'Actions and who owns each' },
  { id: 'files', label: 'Shared files and links' },
  { id: 'meetings', label: 'Meeting scheduling' },
  { id: 'notes', label: 'Notes' },
  { id: 'calendar', label: 'Calendar events' },
  { id: 'threads', label: 'Discussion threads' },
  { id: 'timeline', label: 'Event or project timeline' },
  { id: 'members', label: 'An explicit member list and role permissions' },
  { id: 'closure', label: 'Clear archive and deletion rules' },
] as const;

/** A room is about something. These are the somethings. */
export const ROOM_PURPOSES = ['course', 'study_group', 'organization', 'event', 'project', 'mentorship'] as const;
export type RoomPurpose = (typeof ROOM_PURPOSES)[number];

export const ROOM_EXAMPLES = [
  'BIO 201 Exam 2 Study Group', 'Entrepreneurship Club Event Team', 'Capstone Project Team', 'Transfer Student Mentor Circle',
  'Career Fair Preparation Group', 'Study Abroad Cohort', 'Residence Hall Service Project',
] as const;

export interface RoomSpec {
  name: string;
  purpose: { kind: RoomPurpose; ref: string };
  members: readonly { id: string; role: 'lead' | 'member' }[];
  /** ISO date the room closes; a room is for a term or a project, not for ever. */
  ends: string;
  /** What happens at the end. */
  closure: 'archive' | 'delete';
}

/** The most a room can last: a year covers any term, any project and any mentorship. */
export const ROOM_MAX_DAYS = 366;

/**
 * Every bound a room breaks, in words; an empty list is a room that may open.
 * "More useful than direct messaging alone because each conversation
 * connects to a real purpose": the purpose is required, and so is the end.
 */
export function openRoom(spec: RoomSpec, at: Date): string[] {
  const broken: string[] = [];
  if (!spec.name.trim()) broken.push('A room needs a name.');
  if (!ROOM_PURPOSES.includes(spec.purpose.kind) || !spec.purpose.ref.trim()) broken.push('A room is about a course, a study group, an organization, an event, a project or a mentorship, and says which.');
  if (spec.members.length < 2) broken.push('A room has at least two members; a room of one is a notebook.');
  if (!spec.members.some((m) => m.role === 'lead')) broken.push('Somebody leads the room, so there is a person to answer for it.');
  const ends = new Date(spec.ends).getTime();
  if (!Number.isFinite(ends) || ends <= at.getTime()) broken.push('A room has an end date in the future.');
  else if ((ends - at.getTime()) / 86_400_000 > ROOM_MAX_DAYS) broken.push(`A room lasts ${ROOM_MAX_DAYS} days at most; open another when the next thing starts.`);
  if (spec.closure !== 'archive' && spec.closure !== 'delete') broken.push('A room says whether it is archived or deleted when it ends.');
  return broken;
}

// ── The mentor flow ─────────────────────────────────────────────────────────

/** The structured flow, in order; each step is what happens, not a screen. */
export const MENTOR_FLOW = [
  'The student chooses a goal',
  'Semester shows verified, opt-in mentors for it',
  'The student sends a structured connection request',
  'The mentor accepts or declines; nothing happens until they answer',
  'Semester opens a time-limited connection space',
  'The student writes their questions and a meeting agenda',
  'Both can schedule, meet, and record follow-up actions',
  'The connection expires, or continues only with consent from both',
] as const;

export const MENTOR_KINDS = [
  'First-year and orientation mentors', 'Transfer student mentors', 'Major or department mentors', 'International student mentors',
  'Student-athlete mentors', 'Graduate student mentors', 'Career and internship mentors', 'Study-abroad mentors', 'Alumni mentors',
  'Peer tutors and subject-area ambassadors',
] as const;

/** What a mentor is never shown. They receive only what the student shares on purpose. */
export const MENTOR_NEVER_SEES = ['the full plan', 'grades', 'private notes', 'financial data', 'medical information', 'AI history'] as const;

// ── Challenges and milestones ───────────────────────────────────────────────

/** Optional, outcome-shaped, and private unless the student shares a milestone. */
export const CHALLENGES = [
  { id: 'first_term', name: 'Plan your first term', outcome: 'A term plan with every deadline on it' },
  { id: 'registration', name: 'Registration-readiness week', outcome: 'A schedule, backups for sections that fill, and the checklist done' },
  { id: 'study', name: 'Study with intention', outcome: 'A study plan for one exam, followed' },
  { id: 'portfolio', name: 'Resume and portfolio week', outcome: 'One piece of evidence written up and ready to use' },
  { id: 'event', name: 'Attend a campus event', outcome: 'One event saved, attended and reflected on' },
  { id: 'clubs', name: 'Explore three clubs', outcome: 'Three organizations looked at; one joined or not, by choice' },
  { id: 'welcome', name: 'Peer mentor welcome series', outcome: 'A first conversation with a mentor' },
  { id: 'career_fair', name: 'Career fair preparation', outcome: 'A target list, a resume and three questions' },
  { id: 'transfer', name: 'Transfer student onboarding', outcome: 'Credits reviewed, an advisor met, a community found' },
  { id: 'reflection', name: 'End-of-term reflection', outcome: 'What the term taught, written down' },
  { id: 'wrapped', name: 'Semester Wrapped', outcome: 'A private recap of milestones you selected, shared only if you choose' },
] as const;

export const REWARDS = [
  'A completion badge', 'A campus-recognised certificate', 'Portfolio evidence', 'Verified participation', 'Event access',
  'Campus perks, only where a school chooses to offer them',
] as const;

export const CHALLENGE_RULES = {
  participation: 'Optional, and private by default',
  sharing: 'Selected milestones only, by the student',
  comparison: 'Never a public comparison of students: no leaderboard, no study-time or grade table, no popularity count',
  leaving: 'Opt out at any time, with nothing lost',
} as const;

/**
 * How far along a challenge is, said to the one student it is about. A count
 * of their own steps and never a comparison, so the sentence has no
 * percentage of anybody in it.
 */
export function milestoneLine(done: number, total: number): string {
  if (total <= 0) throw new Error('A challenge has steps.');
  const n = Math.max(0, Math.min(done, total));
  if (n === 0) return `${total} steps, none started yet`;
  if (n === total) return `All ${total} steps done`;
  return `${n} of ${total} steps done`;
}

// ── Contribution and recognition ────────────────────────────────────────────

/** Recognition rewards helpfulness. Each signal says who can vouch for it. */
export const CONTRIBUTION_SIGNALS = [
  { id: 'officer', signal: 'Verified club officer', verifiedBy: 'organization_role' },
  { id: 'mentor', signal: 'Peer mentor', verifiedBy: 'organization_role' },
  { id: 'resource', signal: 'Resource contributor', verifiedBy: 'human_review' },
  { id: 'organizer', signal: 'Event organizer', verifiedBy: 'organization_role' },
  { id: 'facilitator', signal: 'Study-group facilitator', verifiedBy: 'human_review' },
  { id: 'collaborator', signal: 'Project collaborator', verifiedBy: 'human_review' },
  { id: 'ambassador', signal: 'Campus ambassador', verifiedBy: 'organization_role' },
  { id: 'alumni_mentor', signal: 'Alumni mentor', verifiedBy: 'organization_role' },
  { id: 'answer', signal: 'Helpful answer, accepted by the student who asked', verifiedBy: 'student_acceptance' },
  { id: 'accessibility', signal: 'Accessibility advocate', verifiedBy: 'human_review' },
  { id: 'service', signal: 'Volunteer or community-service contributor', verifiedBy: 'human_review' },
] as const;

export type Verifier = (typeof CONTRIBUTION_SIGNALS)[number]['verifiedBy'];

/** What recognition is never used as. */
export const NOT_A_MEASURE = [
  'a follower count as the central measure',
  'a public ranking of students',
  'an inference of academic ability or eligibility',
] as const;

export interface Recognition {
  signal: (typeof CONTRIBUTION_SIGNALS)[number]['id'];
  verifiedBy: Verifier;
  /** Hidden from the public profile: the student's choice, at any time. */
  hidden: boolean;
}

/** A recognition, only from the verifier the signal names. Anything else is a self-declared badge, refused. */
export function recognise(signal: Recognition['signal'], by: Verifier): Recognition {
  const s = CONTRIBUTION_SIGNALS.find((x) => x.id === signal);
  if (!s) throw new Error(`No such signal: ${signal}.`);
  if (s.verifiedBy !== by) throw new Error(`“${s.signal}” is verified by ${s.verifiedBy.replace('_', ' ')}, not ${by.replace('_', ' ')}.`);
  return { signal, verifiedBy: by, hidden: false };
}

export const hide = (r: Recognition, hidden = true): Recognition => ({ ...r, hidden });

/** What a public profile shows: only recognitions the student has not hidden, and never a count of followers. */
export const shown = (rs: readonly Recognition[]): Recognition[] => rs.filter((r) => !r.hidden);

// ── The order things are built ──────────────────────────────────────────────

/** The brief's rollout order: density around useful, verified connections before anything broad. */
export const ROLLOUT = [
  'Verified clubs, organizations, events and campus opportunities',
  'Event calendar, RSVP handoff, saved events and Action Center reminders',
  'Course-based opt-in study-group matching',
  'Structured collaboration rooms for study groups and projects',
  'Peer mentors and orientation communities',
  'Alumni mentors and career communities',
  'Student-controlled project and portfolio showcases',
  'Moderated course reviews and shared study resources',
  'Ambassador programme and creator community',
  'Optional marketplace, employer talent pool and broader alumni network',
] as const;

/** The step that waits on dedicated trust-and-safety, financial and legal infrastructure (community phase 5), and is last. */
export const ROLLOUT_LAST = ROLLOUT.length;
