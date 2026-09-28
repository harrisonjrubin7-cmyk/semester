/**
 * The Transfer Transition Hub: the product promise, the student experience,
 * the home structure, the core workflows and their boundaries, the credit-
 * preparation workspace, the labels, the onboarding timeline and the council —
 * from a document of 28 September 2026, held to what the tree already has for
 * a transfer student.
 *
 * Transfer success research points to cross-campus collaboration, streamlined
 * procedures, dependable communication, peer support and a central one-stop
 * model. Semester's origin story is the fragmentation transfer students face,
 * so this is its natural wedge — and the hub must make no official transfer-
 * credit or degree-completion decision: it organizes evidence, identifies
 * questions, surfaces authoritative information and prepares the student for
 * the official evaluation.
 *
 * `docs/TRANSFER-TRANSITION-HUB.md` is rendered from this file by
 * `transferhub.test.ts`; edit the data, then `npm run registers` from app/.
 *
 * ## What is held to what
 *
 * - Each of the six labels the hub uses names the source label in
 *   `lib/source.ts` that already carries it, or says none does; the test
 *   holds the names to `SOURCE_LABELS`.
 * - Each workflow cites the kind of file its status claims, under the
 *   expansion register's rule, and every cited path exists.
 * - The `transfer_evaluations` table already refuses a student any status but
 *   `estimated` or `submitted`; the test reads the migration to hold the
 *   boundary the document asks for to the constraint that enforces it.
 */

import type { SourceLabel } from './source';

export const SOURCES: readonly { path: string; title: string; what: string }[] = [
  {
    path: 'docs/expansion/Transfer-Hub-Career-Safe-AI-and-Basic-Needs.pdf',
    title: 'Show me the transfer transition hub details',
    what: 'The promise, the home structure, the workflows and boundaries, the credit-preparation workspace, the labels, the timeline and the council.',
  },
];

export const PROMISE =
  'I can see what I need to do, what is official, what is still uncertain, who owns each answer, and what my next best action is.';

/** The hub's home, top to bottom. */
export const HOME: readonly string[] = [
  'My transition timeline',
  'Credits and academic planning',
  'Requirements and official-review checklist',
  'Orientation and campus setup',
  'Financial-aid and billing handoffs',
  'Advisor meeting preparation',
  'Community and transfer-peer connection',
  'Course readiness and study support',
  'Career and portfolio continuity',
  'Transfer-specific help center',
  'My documents, shares and data controls',
];

export const STATUSES = ['not-started', 'designed', 'building', 'tested'] as const;
export type Status = (typeof STATUSES)[number];

export interface Workflow {
  /** `TH-nn`, stable. */
  id: string;
  workflow: string;
  flow: string;
  boundary: string;
  status: Status;
  evidence: readonly { path: string; shows: string }[];
  gap: string;
}

type Row = [workflow: string, flow: string, boundary: string, status: Status, evidence: [path: string, shows: string][], gap: string];

const ROWS: readonly Row[] = [
  ['Transfer readiness', 'Select a prospective institution or program → see official transfer resources, dates, prerequisites and questions to ask', 'No admissions prediction or unofficial credit guarantee',
    'building', [['app/src/lib/learner-pathways.ts', 'the transfer pathway: which courses count, what the official evaluation says, and who to ask'], ['app/src/lib/learner-pathways.test.ts', 'where a decision is somebody else’s, the pathway says so']], 'One pathway for the student’s own school; no prospective-institution view and no official resources per program.'],
  ['Credit-preparation workspace', 'Upload or list prior courses and documents → map against published pathways → flag uncertainty → prepare the official evaluation packet', 'Clearly label student-entered and estimated matches',
    'building', [['supabase/migrations/20260926150000_expansion_roles_and_features.sql', 'transfer_evaluations: a student writes only estimated or submitted; the decision arrives through the service role; articulation_rules draft, proposed, approved'], ['supabase/expansion.check.sql', 'the articulation and evaluation policies, in SQL']], 'The tables exist; no screen lists prior courses, maps them against a published pathway or assembles a packet.'],
  ['Academic plan', 'Compare possible term plans, required courses, workload and dependencies', 'Not an official degree audit or registration action',
    'tested', [['app/src/lib/degree.test.ts', 'student-entered requirement rows and whether a course fits them; nothing built in'], ['app/src/lib/scenario-compare.test.ts', 'plans compared side by side']], 'No comparison of the old school’s requirements against the new one’s.'],
  ['Advisor agenda', 'Compile unresolved credit questions, course options, supporting documents and the desired outcome', 'The student controls what is shared and for how long',
    'tested', [['app/src/lib/advisor-meeting.test.ts', 'the agenda carries only what the student ticked; never a field for notes, history or grades'], ['app/src/lib/advisor-shares.test.ts', 'every share expires within 120 days; a revoke cannot be undone'], ['supabase/advisor.check.sql', 'held in SQL']], 'A general advising agenda; no transfer-credit question type and no document attachment beyond one scenario and saved courses.'],
  ['Campus setup', 'Complete orientation, SSO, transit, library, accessibility, clubs, support offices and key dates', 'Links route to official systems',
    'tested', [['app/src/lib/launchpad.ts', 'the transfer type adds a credit-evaluation step and transfer orientation; every official step names its office'], ['app/src/lib/journey.guards.test.ts', 'a student type only ever adds steps; every step an office decides names the office']], 'Two transfer-only steps; SSO, library and accessibility setup are the general list.'],
  ['Community connection', 'Join transfer circles, opt into a peer mentor program, find transfer-friendly clubs and events', 'No default public transfer status',
    'tested', [['app/src/lib/mentors.test.ts', 'mentors matched on listed topics and ticked interests, nothing else'], ['app/src/lib/launchpad.ts', '“Transferring in” as a mentor topic'], ['supabase/mentor-rosters.check.sql', 'requests need consent from both sides']], 'No transfer circle or transfer-friendly club filter; being a transfer student is a mentor topic, not a community.'],
  ['First-term support', 'Course readiness, action planning, tutoring, writing and library referrals, and week-one check-ins', 'No hidden “transfer risk” score',
    'tested', [['app/src/lib/study-readiness.test.ts', 'readiness is the student’s own status and confidence; never a prediction'], ['app/src/lib/help-routes.test.ts', 'tutoring, writing center and library requests sent only on confirm'], ['app/src/lib/institution-ops.test.ts', 'any per-student risk metric is refused']], 'No week-one check-in and nothing transfer-specific in the first term.'],
  ['Continuity archive', 'Preserve selected projects, skills evidence, portfolio links and past plan documents', 'The student decides what carries forward',
    'tested', [['app/src/lib/termtransition.test.ts', 'end-of-term checklist: keep, export, plan the next term'], ['app/src/lib/career-evidence.test.ts', 'portfolio items only from what the student confirmed']], 'No archive of a previous school’s work or plans; the export is per device, not a carried-forward record.'],
];

export const WORKFLOWS: readonly Workflow[] = ROWS.map(([workflow, flow, boundary, status, evidence, gap], i) => ({
  id: `TH-${String(i + 1).padStart(2, '0')}`,
  workflow, flow, boundary, status,
  evidence: evidence.map(([path, shows]) => ({ path, shows })),
  gap,
}));

/** The credit-preparation workspace is an evidence and questions workspace, not an automated credit-decision engine. */
export const MATERIALS: Readonly<Record<'student' | 'institution' | 'output', readonly string[]>> = {
  student: ['Unofficial transcript', 'Course titles and descriptions', 'Syllabi', 'Catalog links', 'Prior assignments or work samples where relevant', 'Articulation agreement links', 'Student notes and questions'],
  institution: ['Published transfer pathways', 'Course equivalencies', 'Major requirements', 'Catalog year', 'Official deadlines and policy links', 'Official evaluator or registrar route'],
  output: ['Organized comparison table', 'Source anchors', '“Likely comparable”, “insufficient information” or “needs official review”', 'Missing-document checklist', 'Advisor or evaluator agenda', 'Versioned plan scenarios'],
};

/** The six labels the hub uses, and the source label that already carries each, or null. */
export const LABELS: readonly { label: string; carriedBy: SourceLabel | null; note: string }[] = [
  { label: 'Institution verified', carriedBy: 'institution_verified', note: 'The same word the database enforces.' },
  { label: 'Published policy', carriedBy: null, note: 'A policy is not a fact about the student; the closest is an official notice with its source.' },
  { label: 'Student provided', carriedBy: 'student_entered', note: 'Same meaning, older wording.' },
  { label: 'Semester estimate', carriedBy: 'estimated', note: 'Worked out by Semester; never official.' },
  { label: 'Needs official review', carriedBy: 'needs_review', note: 'Also the only status a transfer evaluation has before submission.' },
  { label: 'Expired or possibly stale', carriedBy: null, note: 'Freshness is a date beside the label (official notices), not a label of its own.' },
];

/** The onboarding timeline, window by window. */
export const TIMELINE: readonly { window: string; does: string }[] = [
  { window: '90+ days before term', does: 'Confirm admission and official requirements, request evaluation, compare pathways, plan finances, prepare accessibility and housing or service handoffs.' },
  { window: '30–60 days', does: 'Review evaluation status, draft a term plan, connect SSO and campus systems, complete orientation steps, identify the advisor and support offices.' },
  { window: 'First 14 days', does: 'Confirm enrolled courses, attend transfer orientation and peer connection, review the syllabus and academic policies, establish study and support routines.' },
  { window: 'Weeks 3–8', does: 'Check unresolved credit questions, prepare the advising agenda, use tutoring and the library, join one relevant academic or community connection.' },
  { window: 'Term end', does: 'Archive selected work, update portfolio evidence, review the plan, prepare next-term questions, update the transfer transition reflection.' },
];

/** A formal hub is owned by a cross-functional council. */
export const COUNCIL: readonly string[] = [
  'Admissions and records', 'Articulation or transfer-credit evaluators', 'Advising', 'Financial aid', 'Student affairs', 'IT', 'Accessibility and disability services', 'Library', 'Career services', 'Transfer-student representatives',
];

/** The MVP, in the document's order. */
export const MVP: readonly string[] = ['Verified timeline', 'Official-resource directory', 'Questions and document checklist', 'Advisor agenda', 'First-term dashboard', 'Transfer peer and community discovery'];

/** The statuses a student may write to `transfer_evaluations`. The test reads the migration to confirm. */
export const STUDENT_MAY_WRITE: readonly string[] = ['estimated', 'submitted'];
