/**
 * One operating system: the two briefs of 29 September 2026 that say what
 * makes Semester different — everything from the start, one central school
 * operating system, and every capability feeling like one system rather than
 * a collection of screens — held to what the tree already has for each.
 *
 * The first brief gives the positioning and the one-system principles: one
 * identity, one object model, one Action Center, one search, one intelligence
 * layer; the shell, the context bar, the detail panel, the journeys, the
 * event layer, the design system, the vocabulary, the role homes, the command
 * palette, the graph, the timeline, the passport, the workspace and the
 * institution console; and a final eight-question test. The second lists
 * what else to add to the app, the company site and the console, and the
 * company infrastructure behind them, with a shortlist of ten.
 *
 * `docs/ONE-OPERATING-SYSTEM.md` is rendered from this file by `oneos.test.ts`;
 * edit the data, then `npm run registers` from app/. Two public pages print
 * from it as well: `/platform/one-operating-system/` and
 * `/platform/why-not-another-tool/` (`site/oneos.tsx`).
 *
 * ## The finding
 *
 * The brief's claim is that Semester "has everything from the start and is
 * fully built". The tree does not say that, and this page does not say it for
 * the tree: most of what the briefs name exists as a part — a component, a
 * module, a table — and the join is what is missing. The rendered page counts
 * the rows at each status. The public pages print the positioning as the
 * briefs wrote it and, under it, this register's word for every area, so the
 * site cannot say "fully built" where the tree says "building".
 *
 * ## What is held to what
 *
 * - The five destinations are held to `FIVE_LABELS` in `lib/tabbar.ts`, name
 *   for name and screen for screen.
 * - Every shared object names the module that carries it, or says none does.
 * - Every "avoid this" word that the retired-word rule already refuses names
 *   its entry in `content/terms.ts` `RETIRED`; the rest are noted as unheld.
 * - Every palette command names the destination that carries it, or says none
 *   does; the app refuses verb commands by design (`components/Command.tsx`),
 *   and this page keeps that decision rather than re-arguing it.
 * - Every site page names its route in `site/render.tsx`, or says none exists.
 * - Every row's status cites the kind of file it claims, and every cited path
 *   exists. A supplied PDF is never evidence.
 * - The ten highest-impact additions name rows on this page.
 */

import type { Screen } from './types';

export const SOURCES: readonly { path: string; title: string; what: string }[] = [
  {
    path: 'docs/expansion/One-Operating-System-Core-and-One-System-Principles.pdf',
    title: 'The core of what makes Semester different (… what else can be done to make it feel like one system)',
    what: 'The positioning; one identity, one object model, one Action Center, one search, one intelligence layer; the shell, the context bar, the detail panel, five journeys, the event layer, the design system, the vocabulary; the role homes, the command palette, the graph, the timeline, the passport, the workspace, the institution console; the headline and messages; the final test.',
  },
  {
    path: 'docs/expansion/Anything-Else-for-App-Company-Site-and-Console.pdf',
    title: 'Anything else to add or improve upon on app, company site and/or console',
    what: 'Eight app additions, seven company-site pages, seven console features, the company infrastructure (commercial, support, security, credibility), the ten highest-impact additions and the final standard.',
  },
];

// ── The positioning, as the briefs wrote it ─────────────────────────────────

export const HEADLINE = 'One Operating System for University Life.';

export const STATEMENT =
  'Semester is the unified operating system for higher education. One connected platform for every part of university life: academics, learning, planning, campus services, career development, student support, communication, and institutional operations. Semester replaces the disconnected university experience with one intelligent, connected system.';

export const MESSAGES: readonly { audience: string; text: string }[] = [
  {
    audience: 'Supporting paragraph',
    text: 'Semester is not another point solution. It is designed as one connected university platform — academic planning, native learning tools, course workspaces, AI, advising, campus services, career development, communications, payments and institutional operations in one secure ecosystem — where every experience is connected through one identity, one action layer, one data model and one shared understanding of the student journey.',
  },
  {
    audience: 'Student-facing',
    text: 'College is complicated. Your experience should not be. Semester brings your classes, plans, deadlines, study tools, support, campus life and future goals into one place — so you always know where you are, what matters, and what to do next.',
  },
  {
    audience: 'Institution-facing',
    text: 'Replace fragmented student experiences with one connected university system. Semester gives institutions a unified platform for student experience, learning, planning, support, campus engagement and operations — without losing governance, privacy, accessibility or control.',
  },
];

/** What the briefs say most edtech products do instead, one line each. */
export const POINT_SOLUTIONS: readonly string[] = [
  'An LMS delivers courses.',
  'An SIS manages records and registration.',
  'A calendar manages time.',
  'An advising system manages appointments and notes.',
  'A tutoring tool supports learning.',
  'A career platform manages jobs and resumes.',
  'A housing or dining system manages transactions.',
  'A student-success platform sends alerts.',
  'An AI study tool generates explanations and quizzes.',
];

export const STATUSES = ['not-started', 'designed', 'building', 'tested'] as const;
export type Status = (typeof STATUSES)[number];

/** The word the public pages print for each status. Colour is never the only carrier. */
export const STATUS_WORD: Record<Status, string> = {
  tested: 'Held by a test',
  building: 'Being built',
  designed: 'Designed',
  'not-started': 'Not started',
};

export const STATUS_MEANING: Record<Status, string> = {
  tested: 'a test that runs on every change holds the best piece of it',
  building: 'code exists; nothing holds it yet, or the join is missing',
  designed: 'a document says how; no code does',
  'not-started': 'at most a document naming the gap',
};

export interface Held {
  /** A slug, stable. */
  id: string;
  what: string;
  status: Status;
  evidence: readonly { path: string; shows: string }[];
  gap: string;
}

type Row = Omit<Held, 'evidence'> & { evidence: readonly [path: string, shows: string][] };
const held = (rows: readonly Row[]): readonly Held[] => rows.map((r) => ({ ...r, evidence: r.evidence.map(([path, shows]) => ({ path, shows })) }));

/** One row by id; a page that names a row that does not exist fails to render. */
export function row(id: string): Held {
  const found = ALL.find((h) => h.id === id);
  if (!found) throw new Error(`No row ${id}`);
  return found;
}

/** The weakest row among those named, which is the only honest word for a group — and its gap is what the page prints. */
const RANK: Record<Status, number> = { 'not-started': 0, designed: 1, building: 2, tested: 3 };
export function weakestRow(ids: readonly string[]): Held {
  if (ids.length === 0) throw new Error('No rows');
  let out = row(ids[0]);
  for (const id of ids) {
    const r = row(id);
    if (RANK[r.status] < RANK[out.status]) out = r;
  }
  return out;
}
export const weakest = (ids: readonly string[]): Status => weakestRow(ids).status;

// ── The five destinations ────────────────────────────────────────────────────

export interface DestinationMap {
  label: string;
  /** The screen `FIVE_LABELS` in `lib/tabbar.ts` gives that label. */
  screen: Screen;
  note: string;
}

export const DESTINATIONS_MAP: readonly DestinationMap[] = [
  { label: 'Today', screen: 'home', note: 'The briefing, the Action Center behind its flag, Notices under it.' },
  { label: 'My Path', screen: 'degree', note: 'The degree, registration, term deadlines, the pathway and applications file under it.' },
  { label: 'Search', screen: 'search', note: 'The overlay, Ask Semester, help and the directory.' },
  { label: 'Plan', screen: 'calendar', note: 'The calendar, the runway, money, meals, housing, the map and activities.' },
  { label: 'Me', screen: 'me', note: 'The directory of everything else, and the controls.' },
];

/** Rollback gate for the canonical five destinations. On in a normal build. */
export const DESTINATIONS_FLAG = 'journeyNavigation';

// ── The five one-system principles ───────────────────────────────────────────

export const PRINCIPLES: readonly Held[] = held([
  { id: 'identity', what: 'One identity: one account carries profile, program, classes, files, calendar, skills, privacy choices, permissions and sharing across the whole ecosystem', status: 'tested', evidence: [['packages/institution/src/identity.ts', 'the claims and their minimization'], ['packages/institution/src/identity.test.ts', 'held'], ['app/src/lib/role.ts', 'ten roles on one account, each with what it needs before it is ready'], ['app/src/lib/role.test.ts', 'the roles']], gap: 'Students, yes; institutional roles arrive by SAML or LTI, with no OIDC and no account linking, so a launch from a learning system is its own identity until a ticket links it.' },
  { id: 'objects', what: 'One universal object model: every module uses the same core objects', status: 'building', evidence: [['app/src/components/unity/ObjectCard.tsx', 'the Universal Object Card: nine kinds, one rhythm'], ['app/src/lib/integration/catalog.ts', 'thirty-three canonical entities, for integration'], ['docs/ONE-SYSTEM-PLATFORM-GRAMMAR.md', 'the envelope no table carries whole']], gap: 'The briefs’ eleven objects are held below, one by one; no single entity type carries them, and a goal has no object at all.' },
  { id: 'action-center', what: 'One Action Center: every module proposes; the student sees one prioritized, explainable list', status: 'tested', evidence: [['app/src/components/ActionCenter.tsx', 'one most important, up to three next, the rest behind View all'], ['app/src/lib/actions.ts', 'eight states, a transition table, a scored ranking with its parts visible'], ['app/src/components/ActionCenter.test.tsx', 'the list, the source, the explanation, done, snooze, correction, help'], ['app/src/lib/office-actions.ts', 'a campus office proposes into the same list']], gap: 'Production default with an explicit rollback flag. Deadlines, the path, registration and office actions propose; finances, career, housing and support do not.' },
  { id: 'search', what: 'One global search over the student’s whole university world, answering with context and an action', status: 'tested', evidence: [['app/src/lib/find.ts', 'findEverything: one ranker over deadlines, courses, units, notes, actions, appointments, documents and screens'], ['app/src/lib/find.test.ts', 'the ranking'], ['app/src/components/Command.tsx', 'the overlay: “Ask Semester, search, or add something…”'], ['app/src/ai/Panel.tsx', 'Ask Semester: an answer with proposed actions the student presses']], gap: 'Device data only: people, offices, services, campus resources and messages are not indexed. A result is a place to open; the answer-with-action is the assistant’s, one press further.' },
  { id: 'intelligence', what: 'One intelligence layer built into every workflow, not a separate AI app', status: 'tested', evidence: [['app/src/lib/context.ts', 'what leaves the device when a question is asked, and nothing else'], ['app/src/lib/context.test.ts', 'no key, no token, no note body, nobody else’s name; the date and the course list'], ['app/src/ai/quality.ts', 'source strength from material actually read, the policy state, the limits, under every reply'], ['app/src/ai/quality.test.ts', 'the line'], ['app/src/lib/courserules.ts', 'a course’s own rules, shown before the assistant answers']], gap: 'One panel that knows the screen it was opened from. The course workspace, the Studio and the registrar hand it their objects; the degree plan, the schedule, advising, money and Campus Hub do not.' },
]);

// ── The shared objects ───────────────────────────────────────────────────────

export interface SharedObject {
  object: string;
  usedAcross: string;
  /** The module that carries it, or null. */
  carriedBy: string | null;
  note: string;
}

export const SHARED_OBJECTS: readonly SharedObject[] = [
  { object: 'Person', usedAcross: 'Student, faculty, advisor, tutor, parent/supporter, staff, employer, alumni', carriedBy: 'app/src/lib/role.ts', note: 'Ten roles on one account; a supporter is the Family plan; tutor and employer are not roles.' },
  { object: 'Course', usedAcross: 'Planning, schedule, LMS, study tools, assignments, grades, skills, career evidence', carriedBy: 'app/src/lib/types.ts', note: 'One Course type, from the syllabus in; the hub, the calendar, the Studio and career evidence read it.' },
  { object: 'Term', usedAcross: 'Registration, deadlines, finances, plan, calendar, housing, study load', carriedBy: 'app/src/components/TermSwitch.tsx', note: 'A term is a string on the state and a switcher; not an object with dates of its own.' },
  { object: 'Action', usedAcross: 'Things to do, holds, assignments, applications, support follow-ups, registration steps', carriedBy: 'app/src/lib/actions.ts', note: 'Derived, never stored; only the student’s choice about one is kept.' },
  { object: 'Goal', usedAcross: 'Degree progress, academic goals, career targets, financial goals, study goals', carriedBy: null, note: 'No goal object. The path snapshot and the career directions are the nearest things.' },
  { object: 'Plan', usedAcross: 'Degree plan, term plan, weekly plan, study plan, career plan, financial plan', carriedBy: 'app/src/lib/registration.ts', note: 'A term plan with backups; the graduation scenarios are a second plan shape; the week is a third.' },
  { object: 'Event', usedAcross: 'Class, deadline, appointment, campus event, interview, exam, study session', carriedBy: 'app/src/lib/kinds.ts', note: 'The event kinds the calendar draws.' },
  { object: 'Resource', usedAcross: 'Tutor, advisor, office, service, document, policy, scholarship, campus opportunity', carriedBy: 'app/src/lib/help-routes.ts', note: 'Routes to people and offices; a document is a source, not a resource; no scholarship.' },
  { object: 'Skill / evidence', usedAcross: 'Coursework, projects, credentials, portfolio artifacts, verified experiences', carriedBy: 'app/src/lib/skills-graph.ts', note: 'Suggested, student-confirmed or institution-verified, each with its evidence.' },
  { object: 'Conversation / meeting', usedAcross: 'Advising agenda, office hours, tutoring, support case, career meeting', carriedBy: 'app/src/lib/threads.ts', note: 'Assistant conversations; a meeting is a calendar event and a share, not an object.' },
  { object: 'Source', usedAcross: 'Institution-verified, imported, student-entered, estimated, or needs review', carriedBy: 'app/src/lib/source.ts', note: 'The five labels, enforced by the database.' },
];

/** The briefs’ own example, kept as the test of the object model. */
export const OBJECT_EXAMPLE =
  'A student adds BIO 201 to their term plan. Semester understands that BIO 201 has a meeting schedule, assignments, study materials, an instructor, tutoring options, degree-requirement impact, lab deadlines, career-relevant skills and an advisor conversation context.';

// ── The Action Center ────────────────────────────────────────────────────────

export const ACTION_CENTER: readonly Held[] = held([
  { id: 'ac-most', what: 'One Most Important action', status: 'tested', evidence: [['app/src/components/ActionCenter.test.tsx', 'one most important, three next, and the rest behind View all']], gap: 'None.' },
  { id: 'ac-next', what: 'Three to five Next Actions', status: 'tested', evidence: [['app/src/lib/actions.ts', 'the ranking'], ['app/src/components/ActionCenter.test.tsx', 'three next']], gap: 'Three, not five.' },
  { id: 'ac-timeline', what: 'A unified timeline of deadlines, appointments, applications, study work, financial dates and campus opportunities', status: 'building', evidence: [['app/src/components/TodayDecisionSurface.tsx', 'a seven-day timeline of deadlines and appointments']], gap: 'Deadlines and appointments; not applications, financial dates or campus opportunities.' },
  { id: 'ac-why', what: 'Why each action matters', status: 'tested', evidence: [['app/src/components/ExplanationSheet.tsx', '“Why this?” with the working'], ['app/src/components/ActionCenter.test.tsx', 'opens the whole explanation with its working in a sheet']], gap: 'None.' },
  { id: 'ac-source', what: 'Where the information came from, and whether it is official, imported, student-entered, estimated or needs review', status: 'tested', evidence: [['app/src/lib/source.ts', 'the five labels'], ['app/src/lib/source.test.ts', 'held to the check constraint'], ['app/src/components/ActionCenter.test.tsx', 'shows the source']], gap: 'None.' },
  { id: 'ac-consequence', what: 'What happens if the student acts or delays', status: 'building', evidence: [['app/src/lib/actions.ts', 'priority from the deadline and the kind; the parts of the score are shown']], gap: 'No sentence says what delay costs; the score says how urgent.' },
  { id: 'ac-safe', what: 'A safe next action: open, plan, schedule, ask for help, prepare, share, save, or an official handoff', status: 'tested', evidence: [['app/src/components/ActionCenter.tsx', 'start, snooze, dismiss, correct, ask for help'], ['app/src/components/ActionCenter.test.tsx', 'with offline mode on, does not open an official site offline']], gap: 'Open, snooze, help and the handoff; not plan, schedule, prepare, share or save.' },
  { id: 'ac-envelope', what: 'Every action carries source, deadline, reason, privacy state, priority, lifecycle and its safe primary action', status: 'tested', evidence: [['app/src/lib/actions.test.ts', 'every action with a why and a source; the lifecycle table']], gap: 'No privacy state on an action.' },
]);

// ── Global search ────────────────────────────────────────────────────────────

export const SEARCH_ASKS: readonly string[] = [
  'What do I need to do before registration?',
  'Find tutoring for chemistry.',
  'Can I take this course next semester?',
  'Where is my professor’s office hour?',
  'Show scholarships due this month.',
  'What assignments do I have this week?',
  'What should I study for my exam?',
  'Find internships connected to data analytics.',
  'What does this hold mean?',
  'Who do I contact about my financial-aid checklist?',
];

export const SEARCH_UNIFIES: readonly Held[] = held([
  { id: 'search-courses', what: 'Courses and requirements', status: 'tested', evidence: [['app/src/lib/find.test.ts', 'courses found by code and name']], gap: 'Requirements are not indexed.' },
  { id: 'search-plans', what: 'Student plans and calendars', status: 'tested', evidence: [['app/src/lib/find.test.ts', 'deadlines and appointments']], gap: 'The registration plan and the scenarios are not indexed.' },
  { id: 'search-documents', what: 'Documents and study materials', status: 'tested', evidence: [['app/src/lib/find.ts', 'notes, documents, sheets, decks and study units'], ['app/src/lib/find.test.ts', 'found by keyword']], gap: 'None.' },
  { id: 'search-campus', what: 'Campus departments, offices, policies, services and events', status: 'building', evidence: [['app/src/lib/help-routes.ts', 'the routes to offices'], ['app/src/screens/Directory.tsx', 'the directory']], gap: 'A screen of their own, not in the ranker.' },
  { id: 'search-people', what: 'Advisors, faculty, tutors and mentors', status: 'building', evidence: [['app/src/screens/People.tsx', 'people and letters']], gap: 'Not indexed.' },
  { id: 'search-opportunities', what: 'Opportunities, scholarships, internships, jobs and programs', status: 'building', evidence: [['app/src/lib/skills-graph.ts', 'searchOpportunities, on the career screen']], gap: 'A second search; no scholarships.' },
  { id: 'search-personal', what: 'Personal content: notes, saved plans, drafts and actions', status: 'tested', evidence: [['app/src/lib/find.test.ts', 'notes and actions']], gap: 'None.' },
]);

// ── The intelligence layer, in context ───────────────────────────────────────

export const INTELLIGENCE: readonly Held[] = held([
  { id: 'ai-course', what: 'In a course, explains material using approved course sources', status: 'tested', evidence: [['app/src/lib/context.test.ts', 'carries the date and the course list, and no coursework at all'], ['app/src/ai/quality.test.ts', 'source strength from what was read']], gap: 'None.' },
  { id: 'ai-degree', what: 'In a degree plan, explains why a requirement is still open', status: 'building', evidence: [['app/src/lib/explain.ts', 'the four questions, answered per screen, the degree among them']], gap: 'A screen explanation, not a requirement’s.' },
  { id: 'ai-schedule', what: 'In a schedule, identifies conflicts and helps create alternate plans', status: 'tested', evidence: [['app/src/lib/registration.test.ts', 'a plan with backups, checked for time conflicts'], ['app/src/lib/registration-day.test.ts', 'ranked backups, clash-free']], gap: 'Deterministic, which is the right kind; the assistant is not asked.' },
  { id: 'ai-advising', what: 'In an advising flow, drafts a student-reviewed meeting agenda', status: 'building', evidence: [['app/src/site/tools/Tools.tsx', 'the advisor meeting planner, a public tool'], ['app/src/lib/advisor-shares.ts', 'a plan shared to an advisor, with an expiry']], gap: 'The student writes the agenda; nothing drafts it, and the tool is on the site.' },
  { id: 'ai-career', what: 'In career tools, maps student-confirmed coursework and experiences to skills without inventing claims', status: 'tested', evidence: [['app/src/lib/skills-graph.test.ts', 'suggested, then confirmed'], ['app/src/lib/career-evidence.test.ts', 'contain no word or number the student did not supply']], gap: 'None.' },
  { id: 'ai-campus', what: 'In Campus Hub, explains which office or resource can help and why', status: 'tested', evidence: [['app/src/lib/nowrongdoor.ts', 'describe the problem; be sent to the right door'], ['app/src/lib/nowrongdoor.test.ts', 'crisis wording routes to counseling first; nothing typed is stored']], gap: 'None.' },
  { id: 'ai-money', what: 'In a financial workflow, turns a deadline or a status into a checklist and an official handoff', status: 'building', evidence: [['app/src/screens/Costs.tsx', 'the bill and spending'], ['docs/FINANCIAL-READINESS-WORKSPACE.md', 'the workspace as designed']], gap: 'No checklist from a deadline; the aid office’s action arrives through the office feed instead.' },
  { id: 'ai-studio', what: 'In Study Studio, generates source-linked practice from the student’s materials under the course policy', status: 'tested', evidence: [['app/src/components/StudyStudio.tsx', 'the Studio'], ['app/src/ai/quality.test.ts', 'the policy state and the sources under every reply'], ['app/src/lib/courserules.test.ts', 'the course’s rules']], gap: 'None.' },
]);

// ── The shell ────────────────────────────────────────────────────────────────

export const SHELL: readonly Held[] = held([
  { id: 'shell-rail', what: 'Persistent left navigation on desktop', status: 'tested', evidence: [['app/src/App.tsx', 'the Rail'], ['app/src/mediumrail.test.tsx', 'collapses on a medium width, never disappears']], gap: 'None.' },
  { id: 'shell-tabs', what: 'A compact bottom or tab navigation on mobile', status: 'tested', evidence: [['app/src/lib/tabbar.ts', 'the canonical five, with a rollback to the legacy student tabs'], ['app/src/lib/tabbar.test.ts', 'the bar'], ['app/src/lib/fivedestinations.test.ts', 'draws Today, My Path, Search, Plan, Me']], gap: 'The legacy tab collection remains only as the explicit rollback path.' },
  { id: 'shell-search', what: 'Global Search / Ask Semester from every screen', status: 'tested', evidence: [['app/src/lib/keys.test.ts', '`/` and ⌘K open the overlay'], ['app/src/components/Command.tsx', 'the overlay over the screen, which stays']], gap: '⌘K has two owners: the overlay and the assistant.' },
  { id: 'shell-actions', what: 'A persistent notification and Action Center entry', status: 'building', evidence: [['app/src/screens/Hub.tsx', 'Notices, under Today'], ['app/src/components/TodayActionCenter.tsx', 'the Action Center on Today, behind its flag']], gap: 'Neither is in the chrome; both are on Today.' },
  { id: 'shell-context', what: 'Current term and current student context', status: 'tested', evidence: [['app/src/components/unity/SystemContextBar.tsx', 'one persistent strip with term, canonical place, workflow, Continue and health'], ['app/src/components/unity/SystemContextBar.test.tsx', 'holds the term switch, canonical route, Continue, workflow and health'], ['app/src/components/TermSwitch.tsx', 'the detailed term control'], ['app/src/components/SchoolPicker.tsx', 'the school']], gap: 'Intentionally quiet on full-canvas search, directory, assistant, mail, call and onboarding surfaces.' },
  { id: 'shell-me', what: 'Profile, privacy, support and accessibility controls in one familiar location', status: 'tested', evidence: [['app/src/lib/mecontrols.ts', 'fourteen rows under Me'], ['app/src/lib/mecontrols.test.ts', 'the rows, each with a screen']], gap: 'None.' },
  { id: 'shell-panel', what: 'A consistent right-side context panel on desktop', status: 'building', evidence: [['app/src/components/unity/UnityLayer.tsx', 'the Source & details drawer, mounted once'], ['app/src/components/desk/Sidebar.tsx', 'the workspace sidebar']], gap: 'A drawer opened per item, not a panel that stays.' },
  { id: 'shell-visual', what: 'One visual hierarchy, spacing, typography, components, icons, motion and language', status: 'tested', evidence: [['app/src/styles/tokens.css', 'the tokens'], ['app/src/styles/tokens.test.ts', 'held'], ['app/src/lib/onecontrol.test.ts', 'one control pattern'], ['app/scripts/styles.mjs', 'the style audit on every lint']], gap: 'None as a system; the vocabulary rows below say where the words drift.' },
]);

// ── The context bar ──────────────────────────────────────────────────────────

export const CONTEXT_EXAMPLE = 'Fall 2026  /  Biology B.S.  /  BIO 201  /  Week 6';

export const CONTEXT: readonly Held[] = held([
  { id: 'context-bar', what: 'The current context shown the same way at the top of relevant screens', status: 'tested', evidence: [['app/src/components/unity/SystemContextBar.tsx', 'term → canonical destination → specialist surface, in the shared shell'], ['app/src/components/unity/SystemContextBar.test.tsx', 'holds the shared context elements'], ['app/src/components/unity/ContextBar.tsx', 'context → object → source, freshness, save → one primary action; on six workspaces'], ['app/src/components/CourseHub.tsx', '`CODE · Term` as the context']], gap: 'The global strip does not yet carry program or week.' },
  { id: 'context-carries', what: 'Changing the context updates schedule, deadlines, materials, requirement impact, tutoring, career connections and actions without losing the place', status: 'building', evidence: [['app/src/components/CoursePicker.tsx', 'a course picker'], ['app/src/lib/parent.ts', 'one level up, and why there is no breadcrumb']], gap: 'The switchers are separate components; the course is re-chosen per screen.' },
]);

/** Where BIO 201 shows up, in the briefs’ example, and the screen that carries each. */
export const CONTEXT_FOLLOWS: readonly { where: string; shows: string; screen: Screen }[] = [
  { where: 'Plan', shows: 'BIO 201 in the weekly schedule', screen: 'calendar' },
  { where: 'Study', shows: 'BIO 201 materials and quizzes', screen: 'study' },
  { where: 'My Path', shows: 'the requirement BIO 201 fulfils', screen: 'degree' },
  { where: 'Career', shows: 'the concepts and skills the course may support', screen: 'career' },
  { where: 'Today', shows: 'its upcoming exam and a study action', screen: 'home' },
];

// ── The detail panel ─────────────────────────────────────────────────────────

export const DETAIL: readonly Held[] = held([
  { id: 'detail-what', what: 'What it is', status: 'tested', evidence: [['app/src/components/unity/ObjectCard.tsx', 'eyebrow, heading, why, metadata'], ['app/src/components/unity/unity.test.tsx', 'the one rhythm']], gap: 'None.' },
  { id: 'detail-why', what: 'Why it matters to this student', status: 'tested', evidence: [['app/src/components/ExplanationSheet.tsx', '“Why this?”'], ['app/src/components/ActionCenter.test.tsx', 'the explanation with its working']], gap: 'Actions and cards; not every item.' },
  { id: 'detail-source', what: 'Source and last-updated information', status: 'tested', evidence: [['app/src/components/SourceBadge.tsx', 'source and freshness, on twenty-six screens'], ['app/src/components/SourceBadge.test.tsx', 'the badge'], ['app/src/lib/unity.ts', 'SourceDetail: origin, source name, freshness, used in, limitations']], gap: 'None.' },
  { id: 'detail-deadlines', what: 'Relevant deadlines and impact', status: 'building', evidence: [['app/src/components/CourseDetailV2.tsx', 'planImpact and clashLine, on the catalog view']], gap: 'The catalog view only, behind `course_detail_v2`.' },
  { id: 'detail-related', what: 'Related courses, plans, people, resources and documents', status: 'building', evidence: [['app/src/components/CourseDetailV2.tsx', 'relatedFuture and careerDirections']], gap: 'Related courses and directions; not people, resources or documents.' },
  { id: 'detail-primary', what: 'One primary next action', status: 'tested', evidence: [['app/src/components/unity/ObjectCard.tsx', 'one primary, one quiet secondary'], ['app/src/components/unity/unity.test.tsx', 'holds its primary while the action is already running']], gap: 'None.' },
  { id: 'detail-secondary', what: 'Secondary actions: save, add to plan, schedule, ask for help, share, view official source', status: 'building', evidence: [['app/src/components/unity/OpenIn.tsx', 'open in another place'], ['app/src/components/unity/ObjectCard.tsx', 'one secondary']], gap: 'Each exists somewhere (the table below); no card offers the set.' },
  { id: 'detail-privacy', what: 'Privacy and sharing context where applicable', status: 'tested', evidence: [['app/src/components/unity/Visibility.tsx', 'only me, course, collaborators, portfolio'], ['app/src/components/SharingList.test.tsx', 'who sees what, until when']], gap: 'None.' },
]);

export const SECONDARY: readonly { action: string; carriedBy: string; note: string }[] = [
  { action: 'Save', carriedBy: 'app/src/components/CourseDetailV2.tsx', note: 'The shortlist, on the catalog view.' },
  { action: 'Add to plan', carriedBy: 'app/src/components/CourseDetailV2.tsx', note: 'The cart, after a preview.' },
  { action: 'Schedule', carriedBy: 'app/src/screens/Calendar.tsx', note: 'The calendar; nothing schedules from a card.' },
  { action: 'Ask for help', carriedBy: 'app/src/components/ActionCenter.tsx', note: 'On an action; the note goes with the request.' },
  { action: 'Share', carriedBy: 'app/src/components/SharingList.tsx', note: 'A plan to an advisor or a supporter, with an expiry.' },
  { action: 'View official source', carriedBy: 'app/src/components/ConfirmDialog.tsx', note: 'The external tone: “You are leaving Semester”, and never offline.' },
];

// ── Connected journeys ───────────────────────────────────────────────────────

export interface Journey extends Held {
  steps: readonly string[];
}

const journeys = (rows: readonly (Row & { steps: readonly string[] })[]): readonly Journey[] => rows.map((r) => ({ ...held([r])[0], steps: r.steps }));

export const JOURNEYS: readonly Journey[] = journeys([
  { id: 'journey-registration', what: 'Registration', status: 'tested', steps: ['Requirement still open', 'Eligible courses', 'Compare sections', 'See schedule impact', 'Choose primary course and backups', 'Detect conflict', 'Build advising questions', 'Prepare registration checklist', 'Open official registration handoff', 'Confirm plan and update Today'], evidence: [['app/src/lib/registration.test.ts', 'a plan with backups, checked for conflicts'], ['app/src/lib/registration-day.test.ts', 'the checklist and the ranked backups'], ['app/src/components/RegistrationDay.tsx', 'the countdown, the copy of the section list, the official handoff']], gap: 'Advising questions are not a step, and nothing asks what happened after the handoff.' },
  { id: 'journey-support', what: 'Academic support', status: 'building', steps: ['Student sees a difficult assignment', 'Opens course context', 'Reviews source-linked explanation', 'Creates study plan', 'Adds practice questions', 'Books or prepares for tutoring', 'Adds follow-up to Action Center', 'Reflects on what still needs help'], evidence: [['app/src/components/CourseHub.tsx', 'the readiness tab and the Studio, from the course'], ['app/src/lib/help-routes.ts', 'tutoring as a route']], gap: 'No follow-up is written to the Action Center, and no reflection step.' },
  { id: 'journey-career', what: 'Career', status: 'tested', steps: ['Student completes a course project', 'Saves project artifact', 'Maps student-confirmed skills', 'Adds evidence to portfolio', 'Updates resume draft', 'Finds related internship opportunities', 'Prepares application materials', 'Tracks interview and follow-up actions'], evidence: [['app/src/lib/career-evidence.test.ts', 'artifacts tied to something the student did; a résumé from confirmed skills only'], ['app/src/lib/career.ts', 'what is open, what you have done, who you have spoken to']], gap: 'A finished project does not lead to an application; the two halves are joined by the student.' },
  { id: 'journey-campus', what: 'Campus support', status: 'tested', steps: ['Student sees an important deadline or issue', 'Understands what it means', 'Finds the correct office', 'Sees required documents and checklist', 'Prepares questions', 'Schedules or opens official handoff', 'Tracks follow-up in Action Center'], evidence: [['app/src/lib/nowrongdoor.test.ts', 'the right door, with a summary to take'], ['app/src/lib/office-actions.test.ts', 'an office’s action, with its source and link'], ['app/src/components/OfficeActionFeed.test.tsx', 'ranked in the Action Center']], gap: 'No documents checklist; the follow-up is the office action itself, not a step after it.' },
  { id: 'journey-money', what: 'Financial and life planning', status: 'building', steps: ['Student considers a course-load change', 'Sees schedule and degree impact', 'Views estimated timeline and cost context', 'Finds scholarship or aid deadlines', 'Prepares questions for the right office', 'Uses official portal for transactions', 'Keeps the follow-up action in Semester'], evidence: [['app/src/lib/graduation.ts', 'term-by-term projection and the cost of delay'], ['app/src/screens/Costs.tsx', 'the bill'], ['docs/FINANCIAL-READINESS-WORKSPACE.md', 'the rest, as designed']], gap: 'No scholarship or aid deadlines, and the handoff leaves no follow-up.' },
]);

export const JOURNEY_RULE = 'Every journey begins somewhere and ends in the Action Center, the plan, the calendar, the workspace or a verified official handoff.';

// ── The event layer ──────────────────────────────────────────────────────────

export interface Fanout extends Held {
  updates: readonly string[];
}

const fanout = (rows: readonly (Row & { updates: readonly string[] })[]): readonly Fanout[] => rows.map((r) => ({ ...held([r])[0], updates: r.updates }));

export const EVENTS: readonly Fanout[] = fanout([
  { id: 'event-course', what: 'Student adds a course', status: 'tested', updates: ['Degree plan', 'Term plan', 'Schedule', 'Study workspace', 'Course context', 'Deadlines', 'Career skills'], evidence: [['app/src/state/slices/library.ts', 'addCourse: one reducer; the calendar, the hub and the Studio derive from it'], ['app/src/lib/handoff.test.ts', 'a course arrives whole: deadlines, guide, figures']], gap: 'The degree plan and the term plan do not read it; career skills only behind `career_evidence`.' },
  { id: 'event-deadline', what: 'A deadline is added or confirmed', status: 'tested', updates: ['Today', 'Action Center', 'Calendar', 'Study plan', 'Notifications', 'Workload forecast'], evidence: [['app/src/lib/today-actions.test.ts', 'a deadline becomes an action'], ['app/src/lib/notify.test.ts', 'warns two days out'], ['app/src/lib/life-balance.test.ts', 'the week’s hours']], gap: 'None.' },
  { id: 'event-agenda', what: 'Student creates an advisor agenda', status: 'building', updates: ['Calendar', 'Action Center', 'Meeting workspace', 'Shared plan', 'Follow-up actions'], evidence: [['app/src/lib/advisor-shares.ts', 'a plan shared with an advisor']], gap: 'No agenda object; nothing lands on the calendar or in the Action Center.' },
  { id: 'event-material', what: 'Course material is uploaded', status: 'tested', updates: ['Study Studio', 'Course workspace', 'Search', 'Citation system', 'AI context'], evidence: [['app/src/lib/bundle.ts', 'a folder of readings, dropped in at once'], ['app/src/lib/find.test.ts', 'found by keyword'], ['app/src/ai/quality.test.ts', 'source strength from material actually read']], gap: 'None.' },
  { id: 'event-project', what: 'Student completes a project', status: 'tested', updates: ['Portfolio', 'Skills record', 'Career workspace', 'Resume prompts', 'Reflection'], evidence: [['app/src/lib/career-evidence.test.ts', 'an artifact tied to an entry, tagged with confirmed skills, in the résumé']], gap: 'No reflection.' },
  { id: 'event-goal', what: 'Student changes a goal', status: 'not-started', updates: ['Today recommendations', 'Path scenarios', 'Plan priorities', 'Career suggestions'], evidence: [['docs/ONE-SYSTEM-PLATFORM-GRAMMAR.md', 'no goal object']], gap: 'There is no goal to change.' },
  { id: 'event-office', what: 'A campus office publishes a deadline', status: 'tested', updates: ['Search', 'Relevant students’ Action Centers', 'Calendar', 'Resource directory'], evidence: [['app/src/components/OfficeActionFeed.test.tsx', 'ranks an office action in the Action Center; the first three on Today; only the students it reaches']], gap: 'Not in search, the calendar or the directory.' },
  { id: 'event-share', what: 'Student shares a plan', status: 'tested', updates: ['Advisor view', 'Audit history', 'Expiration controls', 'Shared meeting context'], evidence: [['app/src/lib/advisor-shares.test.ts', 'the share, its expiry, its revoke'], ['app/src/components/SharingList.test.tsx', 'who sees what, until when']], gap: 'No meeting context.' },
  { id: 'event-disconnect', what: 'Student disconnects an account', status: 'building', updates: ['Imported data controls', 'Source state', 'Privacy settings', 'Sync status'], evidence: [['app/src/screens/Connect.tsx', 'connect and unlink'], ['app/src/lib/syncstatus.ts', 'what each sync state is called']], gap: 'Imported rows keep their label; nothing marks them as from a source no longer connected.' },
]);

export const EVENT_RULE = 'Event-driven synchronization, audit history, source precedence and conflict-resolution rules: a change is reflected everywhere it matters, while preserving student ownership and clear source labelling.';

// ── The design system, across surfaces ───────────────────────────────────────

export const DESIGN_SURFACES: readonly Held[] = held([
  { id: 'design-site', what: 'Public marketing website', status: 'tested', evidence: [['app/src/site/site.css', 'the app’s @font-face rules prepended at build'], ['app/src/site/site.test.tsx', 'the site’s colours equal the app’s :root tokens']], gap: 'None.' },
  { id: 'design-app', what: 'Student app', status: 'tested', evidence: [['app/src/styles/tokens.test.ts', 'the tokens'], ['app/src/lib/look.test.ts', 'the palette, thirteen grounds, both faded strengths']], gap: 'None.' },
  { id: 'design-staff', what: 'Faculty and advisor tools', status: 'building', evidence: [['app/src/components/institutional/RoleWorkspace.tsx', 'twelve role workspaces, in the preview']], gap: 'Preview only.' },
  { id: 'design-console', what: 'Institution admin console', status: 'tested', evidence: [['app/src/screens/Console.tsx', 'the operations console, in the app’s own components'], ['app/src/screens/console.test.tsx', 'the console']], gap: 'The operators’ console; the institution’s views are University tabs.' },
  { id: 'design-support', what: 'Support center', status: 'building', evidence: [['app/src/components/HelpInbox.tsx', 'the staff help inbox'], ['app/src/site/pages.tsx', '/help/: a short FAQ']], gap: 'No help center beyond the FAQ.' },
  { id: 'design-email', what: 'Email templates', status: 'building', evidence: [['app/src/site/more.tsx', 'the campus launch kit: email, announcement, signage and social templates as text'], ['docs/market-readiness/INCIDENT_COMMUNICATION_TEMPLATES.md', 'the incident templates']], gap: 'Text to adapt; no rendered template, and nothing sends.' },
  { id: 'design-notifications', what: 'In-app notifications', status: 'tested', evidence: [['app/src/lib/notify.ts', 'tiers, caps, the why line'], ['app/src/lib/notify.test.ts', 'held']], gap: 'None.' },
  { id: 'design-mobile', what: 'Mobile application', status: 'tested', evidence: [['app/src/a11y/axe.test.tsx', 'every route at phone width'], ['docs/ADAPTIVE-DEVICE-EXPERIENCE.md', 'the rule: the same things on a phone, a tablet or a computer']], gap: 'A progressive web app; no store app.' },
  { id: 'design-status', what: 'Status page and trust center', status: 'tested', evidence: [['app/public/status.html', 'the status page'], ['app/src/lib/statuspage.test.ts', 'probes the project the app is built against']], gap: 'Trust material is on ten pages; there is no one center.' },
]);

// ── The vocabulary ───────────────────────────────────────────────────────────

export interface Word {
  use: string;
  avoid: readonly string[];
  /** Entries in `RETIRED` (`content/terms.ts`) that already refuse an avoided word. */
  retired: readonly string[];
  /** Where the used word lives, or null. */
  carriedBy: string | null;
  note: string;
}

export const VOCABULARY: readonly Word[] = [
  { use: 'Next Step', avoid: ['task', 'to-do', 'alert', 'item', 'ticket'], retired: ['task', 'to-do'], carriedBy: 'app/src/lib/actions.ts', note: 'The app’s word is “action”, and the rule retires both avoided words in its favour. “Next Step” is the site’s phrase.' },
  { use: 'My Path', avoid: ['degree audit', 'roadmap', 'progression view', 'planner'], retired: ['roadmap'], carriedBy: 'app/src/lib/tabbar.ts', note: 'The five’s word for the degree screen, behind the flag; the screen itself is “The degree”.' },
  { use: 'Plan', avoid: ['schedule builder', 'course cart', 'term map'], retired: [], carriedBy: 'app/src/lib/tabbar.ts', note: 'The five’s word for the calendar; the registration screen still says cart.' },
  { use: 'Action Center', avoid: ['notifications', 'inbox', 'alerts', 'task list'], retired: ['task'], carriedBy: 'app/src/components/ActionCenter.tsx', note: 'Notices, Alerts and Email keep their names as separate surfaces.' },
  { use: 'Ask Semester', avoid: ['chatbot', 'assistant', 'AI tutor', 'copilot'], retired: [], carriedBy: 'app/src/ai/Panel.tsx', note: 'The panel’s title; the code and the settings row still say assistant.' },
  { use: 'Source', avoid: ['verification', 'origin', 'provenance', 'reference'], retired: [], carriedBy: 'app/src/lib/source.ts', note: 'One word on every fact; the module that models scope and status is called provenance.' },
  { use: 'Needs Review', avoid: ['error', 'questionable', 'unverified', 'bad data'], retired: ['unverified'], carriedBy: 'app/src/lib/source.ts', note: 'A source label; the status list has no word for it.' },
  { use: 'Official Handoff', avoid: ['external link', 'portal link', 'redirect'], retired: [], carriedBy: 'app/src/components/ConfirmDialog.tsx', note: 'The external tone exists; the pattern has no name in the app.' },
  { use: 'Workspace', avoid: ['files', 'documents', 'drafts', 'notes', 'projects'], retired: [], carriedBy: 'app/src/lib/drivehome.ts', note: 'The drive’s home; files, documents and notes remain the words on its screens.' },
];

// ── Semester Home, by role ───────────────────────────────────────────────────

export const HOME_ROLES: readonly Held[] = held([
  { id: 'home-student', what: 'Students see path, actions, deadlines, schedule, study priorities, opportunities and support', status: 'tested', evidence: [['app/src/lib/today-decision.ts', 'the decision surface, for students'], ['app/src/lib/today-center.test.ts', 'the three sentences, the words it may not use']], gap: 'Opportunities and support are widgets to pin, not there by default.' },
  { id: 'home-advisor', what: 'Advisors see only student-consented plans, agendas, meetings and follow-up', status: 'building', evidence: [['app/src/components/institutional/RoleWorkspace.tsx', 'the advisor workspace, in the preview'], ['app/src/lib/advisor-shares.ts', 'the consented plans']], gap: 'Preview data; no advisor home in production.' },
  { id: 'home-faculty', what: 'Faculty see the course workspace, approved materials, course policy and teaching actions', status: 'building', evidence: [['app/src/lib/courserules.ts', 'Course Studio: what an instructor publishes beside the course'], ['app/src/components/institutional/RoleWorkspace.tsx', 'the faculty workspace, in the preview']], gap: 'Course Studio is on for no institution; the workspace is a preview.' },
  { id: 'home-offices', what: 'Support offices see only the actions and content they may publish or manage', status: 'tested', evidence: [['app/src/components/OfficeActionDesk.tsx', 'the desk, for an office’s own actions'], ['app/src/components/OfficeActionFeed.test.tsx', 'is not there for an account that may not publish; never offers approving your own']], gap: 'Behind `office_action_feed`.' },
  { id: 'home-leaders', what: 'Institution leaders see aggregate, privacy-protected operational insights', status: 'building', evidence: [['app/src/components/institutional/OperationsStudio.tsx', 'aggregates from pasted data'], ['app/src/lib/institution-ops.ts', 'n ≥ 10, forbidden measures refused']], gap: 'Hidden for everyone; reads pasted data.' },
  { id: 'home-admins', what: 'Administrators see tenant settings, integrations, roles, content governance, audit health and support operations', status: 'tested', evidence: [['app/src/screens/console.test.tsx', 'the operators’ console'], ['app/src/components/institutional/ControlPlane.tsx', 'the institution’s control plane, on University']], gap: 'Two consoles: operators at #/console, the institution on University tabs.' },
]);

// ── The command palette ──────────────────────────────────────────────────────

export interface Command {
  command: string;
  /** The destination that carries it, or null. */
  carriedBy: Screen | null;
  note: string;
}

export const PALETTE_COMMANDS: readonly Command[] = [
  { command: 'Ask Semester', carriedBy: 'ask', note: 'Also from the overlay’s button.' },
  { command: 'Search courses', carriedBy: 'search', note: 'The overlay.' },
  { command: 'Open My Path', carriedBy: 'degree', note: '' },
  { command: 'Add a course', carriedBy: 'import', note: 'From a syllabus.' },
  { command: 'Build a schedule', carriedBy: 'yes', note: 'Registration: a plan with backups.' },
  { command: 'Prepare for advising', carriedBy: null, note: 'The advisor planner is a site tool; in the app a plan is shared.' },
  { command: 'Find tutoring', carriedBy: 'support', note: 'A help route.' },
  { command: 'Create a study plan', carriedBy: 'study', note: '' },
  { command: 'Upload course material', carriedBy: 'update', note: 'Add a reading.' },
  { command: 'Find scholarships', carriedBy: null, note: 'No scholarship screen.' },
  { command: 'Open career workspace', carriedBy: 'career', note: '' },
  { command: 'View privacy controls', carriedBy: 'privacy', note: '' },
  { command: 'Contact support', carriedBy: 'help', note: 'The problem in your own words, then the right door.' },
];

export const PALETTE_RULE =
  'The overlay is a search, deliberately not a palette that runs verbs: an action that changes data says what it will do before it does it, on a screen with a preview, and a list that mixes “go to the calendar” with “delete this course” is a list where one wrong Enter is unrecoverable. So every command above is a destination the overlay finds by name, and the three quick actions it does carry change nothing that cannot be seen and undone.';

// ── The rest of the one-system feeling ───────────────────────────────────────

export const EXPAND: readonly Held[] = held([
  { id: 'graph', what: 'Semester Graph: Student → Goal → Requirement → Course → Assignment → Skill → Artifact → Opportunity, and Student → Need → Resource → Appointment → Follow-up → Outcome', status: 'building', evidence: [['app/src/lib/skills-graph.ts', 'course, project, work → skill → evidence → opportunity fit'], ['app/src/components/SkillsGraph.tsx', 'drawn, behind `careerSkillsGraph`']], gap: 'Skills only. No goal, no requirement, no need, no appointment, no outcome.' },
  { id: 'timeline', what: 'Semester Timeline: registration windows, milestones, deadlines, exams, study blocks, advising, aid and scholarship dates, housing, campus events, applications, interviews, study abroad, personal goals', status: 'building', evidence: [['app/src/components/TodayDecisionSurface.tsx', 'seven days'], ['app/src/screens/Runway.tsx', 'the exam runway'], ['app/src/screens/Calendar.tsx', 'the calendar']], gap: 'Three views of the academic calendar; nothing joins registration windows, money, career or campus events on one line.' },
  { id: 'workspace', what: 'Semester Workspace: documents, notes, slides, tables, projects and agendas in one place with shared tags — course, term, goal, assignment, project, career path, advisor meeting, opportunity', status: 'building', evidence: [['app/src/lib/drivehome.ts', 'the drive’s home: the folders with something happening, the files with a reason'], ['app/src/screens/Work.tsx', 'work on it']], gap: 'Folders are the tags; a project does not link to a requirement, a skill, a résumé bullet or an application.' },
]);

// ── The institution console, as the first brief lists it ─────────────────────

export const INSTITUTION_CONSOLE: readonly Held[] = held([
  { id: 'ic-tenant', what: 'Tenant configuration and branding', status: 'building', evidence: [['app/src/components/institutional/ControlPlane.tsx', 'ten status tiles'], ['app/src/lib/control-plane.ts', 'the viewed tenant']], gap: 'Preview; no branding.' },
  { id: 'ic-structure', what: 'Campus structure: schools, colleges, departments, programs, offices, locations', status: 'tested', evidence: [['app/src/lib/governance/hierarchy.ts', 'system → campus → school → program → course'], ['app/src/lib/governance/hierarchy.test.ts', 'policy inheritance down the tree']], gap: 'A policy tree, not a directory: no offices, locations or cohorts as nodes.' },
  { id: 'ic-roles', what: 'Roles, permissions, approval workflows and delegated administration', status: 'tested', evidence: [['supabase/console-approvals.check.sql', 'self-approval refused; two approvers where the duty says'], ['app/src/lib/ops/consoleduties.test.ts', 'the duties matrix']], gap: 'Platform operators; an institution’s admins have no delegation view.' },
  { id: 'ic-integrations', what: 'Integration connections, sync health, data mappings and source freshness', status: 'tested', evidence: [['app/src/components/institutional/IntegrationDashboard.test.tsx', 'every domain with status and health; counts exported, never ids']], gap: 'School staff, behind `integrationDashboard`.' },
  { id: 'ic-content', what: 'Content governance for catalog data, policies, resources, events and opportunities', status: 'tested', evidence: [['app/src/lib/launch/content.ts', 'thirteen content kinds: source, owner, review interval, visibility, expiry, correction route'], ['app/src/lib/launch/content.test.ts', 'held']], gap: 'A register; no workflow.' },
  { id: 'ic-flags', what: 'Feature flags by campus, school, program, role, cohort and pilot', status: 'tested', evidence: [['app/src/lib/flags.ts', 'the registry'], ['app/src/lib/flags.test.ts', 'every flag named'], ['app/src/lib/governance/rollout.ts', 'per tenant']], gap: 'Per tenant and per build; no cohort, program or console view.' },
  { id: 'ic-ai', what: 'AI policies by institution, school, course and assignment', status: 'tested', evidence: [['supabase/migrations/20260923210000_intelligence_policy.sql', 'ai_policy per tenant: modes, providers, sources, retention'], ['app/src/lib/governance/policysim.test.ts', 'a change simulated before it is made'], ['app/src/lib/courserules.test.ts', 'the course’s rules']], gap: 'Tenant and course; no school or assignment layer, and no console view.' },
  { id: 'ic-a11y', what: 'Accessibility and content-quality workflows', status: 'designed', evidence: [['docs/WCAG-UI-AUDIT-SCORECARD.md', 'the scorecard'], ['docs/operating-model/ACCESSIBILITY-GOVERNANCE.md', 'the governance']], gap: 'No workflow and no issue record.' },
  { id: 'ic-support', what: 'Support operations and secure consent-based access', status: 'tested', evidence: [['supabase/support-access.check.sql', 'a read needs a live grant, and the grant expires'], ['app/src/components/HelpInbox.test.tsx', 'the staff inbox']], gap: 'None.' },
  { id: 'ic-audit', what: 'Audit logs, security events, privacy requests, retention workflows and incident response', status: 'tested', evidence: [['supabase/console-control-plane.check.sql', 'the hash-chained audit; a read is itself audited'], ['app/src/lib/retention.test.ts', 'every table has a retention line'], ['app/src/components/DataRightsRequests.test.tsx', 'student rights-request intake and status history'], ['docs/DATA-RIGHTS-REQUEST-RUNBOOK.md', 'the handling and escalation procedure'], ['app/src/lib/ops/warroom.test.ts', 'the war room']], gap: 'The privacy-request staff handling surface is not built, and neither that process nor an incident has been drilled.' },
  { id: 'ic-analytics', what: 'Aggregate institution analytics with privacy thresholds', status: 'tested', evidence: [['app/src/lib/institution-ops.ts', 'n ≥ 10; forbidden measures'], ['app/src/lib/institution-ops.test.ts', 'held']], gap: 'On pasted data; the tab is hidden for everyone.' },
  { id: 'ic-pilot', what: 'Pilot setup, implementation playbooks, training resources and deployment status', status: 'building', evidence: [['app/src/lib/governance/rollout.ts', 'directory → pilot → production'], ['docs/operating-model/PILOT-TO-PRODUCTION.md', 'what lets a school move']], gap: 'No console view of where a school stands.' },
]);

// ── The final test ───────────────────────────────────────────────────────────

export const FINAL_TEST: readonly Held[] = held([
  { id: 'test-what', what: '1. What it is', status: 'tested', evidence: [['app/src/components/unity/unity.test.tsx', 'the one rhythm: eyebrow, heading, why, metadata, one primary']], gap: 'None.' },
  { id: 'test-why', what: '2. Why it matters to them', status: 'tested', evidence: [['app/src/components/ActionCenter.test.tsx', 'the explanation with its working']], gap: 'Actions; not every item.' },
  { id: 'test-connects', what: '3. What it connects to', status: 'building', evidence: [['app/src/components/CourseDetailV2.tsx', 'related courses and career directions']], gap: 'Courses only.' },
  { id: 'test-next', what: '4. What they should do next', status: 'tested', evidence: [['app/src/components/ActionCenter.test.tsx', 'one most important']], gap: 'None.' },
  { id: 'test-who', what: '5. Who can help', status: 'tested', evidence: [['app/src/lib/help-routes.test.ts', 'the routes'], ['app/src/lib/nowrongdoor.test.ts', 'the right door']], gap: 'None.' },
  { id: 'test-changes', what: '6. What changes elsewhere when they act', status: 'not-started', evidence: [['docs/ACTION-EXPLAINABILITY-AND-STUDENT-CONTROL.md', 'the model; nothing says what an action changes']], gap: 'No action says what it changes elsewhere.' },
  { id: 'test-source', what: '7. Where the information came from', status: 'tested', evidence: [['app/src/lib/source.test.ts', 'the five labels and the line a fact prints']], gap: 'None.' },
  { id: 'test-control', what: '8. What they can control, share or revoke', status: 'tested', evidence: [['app/src/components/SharingList.test.tsx', 'who sees what, until when, and how to take it back'], ['app/src/lib/mecontrols.test.ts', 'the rows under Me']], gap: 'None.' },
]);

// ── The second brief: add to the app ─────────────────────────────────────────

export const APP_ADDITIONS: readonly Held[] = held([
  { id: 'home', what: 'Semester OS home: Today as the desktop — path, the one action, today’s classes and blocks, milestones, “continue where you left off”, recent documents, a weekly check-in, Ask Semester', status: 'tested', evidence: [['app/src/screens/Today.tsx', 'Today'], ['app/src/components/TodayDecisionSurface.tsx', 'the next decision, the path snapshot, seven days'], ['app/src/components/unity/CommandCenter.tsx', 'three to five widgets the student pins'], ['app/src/lib/today-center.test.ts', 'the calm wording']], gap: 'No “continue where you left off”, no recent documents, no weekly check-in; students only; the Action Center behind its flag.' },
  { id: 'notifications', what: 'Unified notification intelligence: what happened, why now, what to do, how urgent, its source, snooze, grouping, quiet hours, digest, device preferences, never-miss rules, “why am I seeing this?”', status: 'tested', evidence: [['app/src/lib/notify.ts', 'tiers with caps, quiet hours, the seen set, the why line'], ['app/src/lib/notify.test.ts', 'held'], ['app/src/lib/comms.ts', 'admit: a source on every message; priority; digest groups'], ['app/src/lib/comms.test.ts', 'a required notice through quiet hours; a digest by day and week']], gap: 'Snooze is on actions, not notifications; no delivery history; no per-device preference; no never-miss rule; the digest is grouped, not sent.' },
  { id: 'inbox', what: 'Universal inbox: official notices, advisor and professor messages, drafts, agendas, support requests, replies tied to the course, plan or action, with needs-reply and needs-action filters', status: 'building', evidence: [['app/src/screens/Hub.tsx', 'Notices: one list, labelled by channel'], ['app/src/lib/mailbox.ts', 'the mailbox: folders, rows, the message'], ['app/src/lib/comms.ts', 'official, course and Semester channels']], gap: 'Three surfaces; no needs-reply or needs-action; a message does not point at its object.' },
  { id: 'cross-device', what: 'Cross-device continuity: web for depth, phone for Today and checklists, tablet for study, widgets, lock-screen updates, offline mode, voice', status: 'tested', evidence: [['app/src/lib/offline-mode.test.ts', 'syncs on reconnect only with an account and something waiting'], ['app/src/lib/syncstatus.test.ts', 'one table for every sync state'], ['app/src/lib/voiceloop.test.ts', 'ask and hear the answer'], ['app/src/lib/device.test.ts', 'the lock screen, the icon badge, the wake lock'], ['docs/CROSS-DEVICE-CONTINUITY.md', 'what carries, how, and where it falls short']], gap: 'No home-screen widget; the tablet is the phone layout widened; offline mode behind its flag.' },
  { id: 'passport', what: 'Semester Passport: a portable, student-controlled record of path, courses, skills, artifacts, career, involvement, credentials, reflections, with sharing per item', status: 'building', evidence: [['app/src/lib/career-evidence.ts', 'skills, artifacts, bullets and résumé versions the student controls'], ['app/src/lib/sharing.ts', 'every share ends, and can be taken back'], ['app/src/lib/export.ts', 'everything, in files'], ['docs/CREDENTIAL-WALLET.md', 'the wallet, Tier 2, Phase 3']], gap: 'Not one record; sharing is by relationship, not per item; no credential is issued.' },
  { id: 'course-workspace', what: 'Connected course workspace: overview, syllabus, assignments, notes, study tools, timeline, requirement impact, support, skills and career, advisor notes, AI policy, official links', status: 'tested', evidence: [['app/src/components/CourseHub.tsx', 'overview, assignments, study, readiness, readings, sources, syllabus; the context bar'], ['app/src/lib/courserules.test.ts', 'the course’s AI policy'], ['app/src/components/CourseDetailV2.test.tsx', 'every section and where each came from, on the catalog view']], gap: 'Requirement impact, support and career connections are on the catalog view, not the enrolled hub; no advisor notes.' },
  { id: 'life-load', what: 'Life-load and capacity planner: classes, exams, work, commute, athletics, caregiving, sleep and study windows, with neutral guidance and no scoring of the student', status: 'tested', evidence: [['app/src/lib/life-balance.ts', 'class, work, commute, study, personal, athletics and open hours; the crunch forecast'], ['app/src/lib/life-balance.test.ts', 'each minute once; the rest floor'], ['app/src/components/CrunchWeekCard.tsx', 'three or more deadlines in six days, as an action'], ['app/src/components/Capacity.tsx', 'whether the week is possible']], gap: 'Behind two flags; no sleep window; the guidance is one line, not a plan.' },
  { id: 'handoffs', what: 'Official handoffs: “you are about to continue in the university’s system”, what Semester prepared, copy identifiers, export, open, return with “what happened?”, mark complete, blocked or needs help', status: 'building', evidence: [['app/src/components/ConfirmDialog.tsx', 'the external tone, never offline'], ['app/src/components/RegistrationDay.tsx', 'copy the section list and the course references'], ['app/src/lib/returnto.ts', 'return after sign-in']], gap: 'No shared pattern with a name; no return prompt; no complete, blocked or needs-help outcome.' },
]);

// ── The second brief: add to the company site ────────────────────────────────

export interface SitePage extends Held {
  /** The route in `site/render.tsx`, or null. */
  route: string | null;
}

const pages = (rows: readonly (Row & { route: string | null })[]): readonly SitePage[] => rows.map((r) => ({ ...held([r])[0], route: r.route }));

export const SITE_ADDITIONS: readonly SitePage[] = pages([
  { id: 'architecture', what: '“One Operating System. Every Student Moment.”: the student at the centre, nine areas around them, each with the problem, the workflow, who benefits, what connects, what stays official, and how it connects back', status: 'tested', route: '/platform/one-operating-system/', evidence: [['app/src/site/oneos.tsx', 'the page, printed from this register'], ['app/src/lib/oneos.test.ts', 'every area at the weakest status of the rows it rests on']], gap: 'Script-free: an area opens as a disclosure, not a map.' },
  { id: 'why-not', what: '“Why not another tool?”: the traditional approach beside the Semester approach', status: 'tested', route: '/platform/why-not-another-tool/', evidence: [['app/src/site/oneos.tsx', 'the eight rows, each with this register’s word'], ['app/src/lib/oneos.test.ts', 'every row rests on rows that exist']], gap: 'None.' },
  { id: 'role-pages', what: 'Role-specific pages: students, prospective students, advising, student success, faculty, registrar, career services, campus life, IT and procurement, leadership, employers and alumni, parents', status: 'building', route: '/students/', evidence: [['app/src/site/pages.tsx', '/students/ and /institutions/; the home page routes six answers to real pages']], gap: 'Two pages; ten of the twelve roles route to one of them.' },
  { id: 'demos', what: 'Interactive guided demos — plan a term, resolve a conflict, prepare an agenda, a syllabus into a study plan — labelled as sample data', status: 'building', route: '/demo/', evidence: [['app/src/site/more.tsx', '/demo/: the sample institution, and a next step per audience'], ['app/src/components/InstitutionalPreviewBar.tsx', '“Demo environment · No real student data”'], ['app/src/site/tools/Tools.tsx', 'five tools that run in the page']], gap: 'A persona switcher and five tools, not scripted scenarios.' },
  { id: 'trust-center', what: 'A Trust Center: security, privacy and FERPA, data minimization, AI governance, accessibility and VPAT, architecture, integrations, subprocessors, retention, incident response, status, support policy, DPA contact, changelog', status: 'building', route: null, evidence: [['app/src/site/benchmark.tsx', 'Data & AI Transparency, the integrations registry'], ['app/src/site/pages.tsx', 'security, privacy, accessibility, legal, product quality']], gap: 'Ten pages, no hub; no SLA; the subprocessors are a table on one page.' },
  { id: 'implementation-center', what: 'An Implementation Center: pilot scope, stakeholders, integrations, SSO and roles, training, onboarding, support, success metrics, pilot to campus-wide', status: 'building', route: '/start/', evidence: [['app/src/site/more.tsx', '/start/: the nine steps of a pilot; /launch/: what a launch site holds']], gap: 'No stakeholders, no success metrics, no path from pilot to campus-wide.' },
  { id: 'outcomes', what: 'A proof and outcomes page, with limitations and method, and no retention or graduation claim until the evidence exists', status: 'tested', route: '/proof/', evidence: [['app/src/lib/ops/claims.test.ts', 'is what the proof page promises'], ['app/src/site/pages.tsx', '/proof/: the rules, written before there is proof']], gap: 'The policy only; no outcome yet, which is what the brief asks.' },
]);

// ── The second brief: add to the institution console ─────────────────────────

export const CONSOLE_ADDITIONS: readonly Held[] = held([
  { id: 'campus-graph', what: 'Campus configuration graph: university → college → department → program → course → office → role → location → event source → policy → cohort, each with owner, source, last reviewed, verification, permissions, cohorts, connections, quality checks', status: 'building', evidence: [['app/src/lib/governance/hierarchy.ts', 'the policy tree'], ['app/src/lib/integration/catalog.ts', 'the entities'], ['supabase/migrations/20260928302000_office_action_feed.sql', 'twelve offices, each with its publishing roles']], gap: 'No graph with an owner, a source, a review date and a verification per node.' },
  { id: 'action-publisher', what: 'Institution Action Publisher: offices publish standardized actions into the right students’ Action Centers, with target, owner, source, dates, priority, required action, support contact, accessibility review, approval history, aggregate completion', status: 'tested', evidence: [['app/src/lib/office-actions.test.ts', 'a complete row, with its office, link, source and dates'], ['app/src/components/OfficeActionFeed.test.tsx', 'publishes only after a preview; never approving your own; no count below ten'], ['supabase/officeactions.check.sql', 'draft → review → published; a second person approves'], ['docs/OFFICE-ACTION-FEED.md', 'the design']], gap: 'Behind `office_action_feed`; no support contact, accessibility review, explicit expiry or multi-step approval history.' },
  { id: 'integration-center', what: 'Integration command center: SIS, LMS, SSO and SCIM, Google and Microsoft, calendar and meetings, and every source with status, last sync, categories, fields, scopes, modules, owner, fallback, known issues, disconnect', status: 'tested', evidence: [['app/src/components/institutional/IntegrationDashboard.test.tsx', 'every domain; counts exported, never ids'], ['app/src/lib/integration/dashboard.ts', 'connections with status, last sync, classification ceiling, freshness target, scopes with expiry, field mappings']], gap: 'No Google or Microsoft entry; no fallback, known-issues or disconnect.' },
  { id: 'content-governance', what: 'Content governance studio: draft, review, approve, publish, archive and scheduled review for resources, offices, policies, events, opportunities, scholarships, programs, FAQs and AI source packs', status: 'tested', evidence: [['app/src/lib/launch/content.test.ts', 'thirteen kinds, each with an owner, an interval and an expiry']], gap: 'A register; no workflow, no version history, no freshness alert.' },
  { id: 'role-consent', what: 'Role and consent center: roles and scope, consented sharing, advisor and tutor access, supporter sharing with expiry, data classification, MFA, audit, export and deletion, retention, legal holds', status: 'tested', evidence: [['supabase/support-access.check.sql', 'a support read needs a live grant'], ['app/src/lib/sharing.test.ts', 'the consent rules every share follows'], ['app/src/lib/mecontrols.test.ts', 'the student’s side, under Me']], gap: 'The student’s side and the server; no admin center joins them, and legal holds exist on integration tables only.' },
  { id: 'ai-policy', what: 'AI policy and quality console: institution, school, course and assignment rules; allowed and prohibited assistance; providers; data categories; source grounding; citation; human confirmation; retention; integrity flows; disclosure; feedback', status: 'tested', evidence: [['supabase/migrations/20260923210000_intelligence_policy.sql', 'ai_policy, approved_source, tenant_policy_audit_event'], ['app/src/lib/governance/policysim.test.ts', 'a module switch-off simulated before it is made'], ['app/src/lib/courserules.test.ts', 'the course layer']], gap: 'Tenant and course only; no console screen; integrity flows and disclosure text are documents.' },
  { id: 'health-dashboard', what: 'Student-experience health dashboard: aggregate only — readiness by cohort, searches with no result, top resources, stale content, failed handoffs, snooze patterns, support categories, accessibility errors, integration failures', status: 'building', evidence: [['app/src/lib/institution-ops.ts', 'aggregates at n ≥ 10; no per-student measure'], ['app/src/lib/ops/leadership.ts', 'the seven knowledge signals, marked not surfaced']], gap: 'Rules and a list; none of the signals is measured.' },
]);

// ── The second brief: company infrastructure ─────────────────────────────────

export interface CompanyRow extends Held {
  group: 'Commercial readiness' | 'Support readiness' | 'Security readiness' | 'Company credibility';
}

const company = (group: CompanyRow['group'], rows: readonly Row[]): readonly CompanyRow[] => held(rows).map((h) => ({ ...h, group }));

export const COMPANY: readonly CompanyRow[] = [
  ...company('Commercial readiness', [
    { id: 'co-pilot-package', what: 'A clear institutional pilot package and statement of work', status: 'tested', evidence: [['docs/trust/PILOT-AGREEMENT-OUTLINE.md', 'the outline'], ['app/src/lib/launchkit.test.ts', 'the package and the statement of work, held field by field']], gap: 'Nothing may be signed; the entity is an attestation.' },
    { id: 'co-agreement', what: 'A standard subscription agreement', status: 'designed', evidence: [['docs/legal/TERMS-OF-SERVICE-DRAFT.md', 'the draft, its not-in-force banner intact']], gap: 'Not reviewed by counsel; no party to sign it.' },
    { id: 'co-dpa', what: 'A Data Processing Addendum', status: 'designed', evidence: [['docs/trust/DPA-CHECKLIST.md', 'what the agreement must settle']], gap: 'No agreement language.' },
    { id: 'co-questionnaire', what: 'Security and privacy questionnaire responses', status: 'designed', evidence: [['docs/market-readiness/HECVAT_READINESS.md', 'each question, against the tree']], gap: 'The workbook is not filled in or reviewed.' },
    { id: 'co-pricing', what: 'A pricing model by size, scope, integrations, implementation, support and AI usage', status: 'tested', evidence: [['app/src/lib/plans.test.ts', 'every price planned; nothing takes money'], ['app/src/lib/governance/deal-desk.test.ts', 'the deal desk’s minimums']], gap: 'No price decided.' },
    { id: 'co-plans', what: 'Individual Free, Plus, Pro and institution-sponsored plans', status: 'tested', evidence: [['app/src/lib/plans.test.ts', 'export, deletion and saved plans on every plan, including Free']], gap: 'Plus and Pro are not on sale.' },
    { id: 'co-billing', what: 'Hosted billing, invoices, cancellation, refunds, export and account deletion', status: 'tested', evidence: [['app/src/lib/billing/checkout.test.ts', 'checkout'], ['app/src/lib/billing/webhook.test.ts', 'an event applied once'], ['supabase/deletion.check.sql', 'deletion removes the rows from every table']], gap: 'Billing is off until keyed; nothing charged; no reconciliation.' },
    { id: 'co-partners', what: 'A partner program for universities, departments, service providers and content partners', status: 'designed', evidence: [['docs/PROVIDER-MATURITY-CERTIFICATION-PARTNERSHIPS.md', 'the partnerships, as designed']], gap: 'No partner.' },
    { id: 'co-success', what: 'Customer-success playbooks and quarterly business-review templates', status: 'designed', evidence: [['docs/INSTITUTIONAL-GTM-PLAYBOOK.md', 'target account to renewal']], gap: 'No customer.' },
  ]),
  ...company('Support readiness', [
    { id: 'co-help', what: 'A public help center', status: 'building', evidence: [['app/src/site/pages.tsx', '/help/: the questions students ask first'], ['app/src/lib/guidebook.ts', 'the in-app guidebook']], gap: 'A short FAQ.' },
    { id: 'co-feedback', what: 'In-product support and feedback', status: 'tested', evidence: [['app/src/lib/tickethandoff.test.ts', 'the seven things a ticket carries, and what is never attached'], ['app/src/lib/supporttickets.test.ts', 'the tickets']], gap: 'None.' },
    { id: 'co-escalation', what: 'Ticketing and support escalation', status: 'tested', evidence: [['app/src/components/HelpInbox.test.tsx', 'the staff inbox'], ['supabase/functions/_shared/escalation.ts', 'a signed escalation webhook']], gap: 'No on-call rota behind it.' },
    { id: 'co-sla', what: 'Service-level commitments', status: 'tested', evidence: [['app/src/lib/sla.test.ts', 'the formula against the document’s worked example'], ['docs/trust/SLA.md', 'not started as a commitment; the framework drafted']], gap: 'No uptime number is offered.' },
    { id: 'co-incident-comms', what: 'Incident communication templates', status: 'tested', evidence: [['app/src/lib/governance/incident-comms.test.ts', 'communications by audience'], ['docs/market-readiness/INCIDENT_COMMUNICATION_TEMPLATES.md', 'the phases']], gap: 'Never used.' },
    { id: 'co-runbooks', what: 'Internal runbooks for login, sync, billing, data access, security and accessibility', status: 'tested', evidence: [['docs/RUNBOOKS.md', 'the runbooks'], ['app/src/lib/runbooklinks.test.ts', 'every link goes to a file that exists']], gap: 'Billing and accessibility runbooks are thin.' },
    { id: 'co-onboarding', what: 'Customer onboarding checklists', status: 'building', evidence: [['app/src/site/more.tsx', '/start/ and the campus launch kit']], gap: 'Text; no checklist a customer works through.' },
    { id: 'co-training', what: 'Training for students, advisors, faculty and administrators', status: 'designed', evidence: [['docs/FACULTY-ENABLEMENT.md', 'faculty enablement']], gap: 'No training exists for anyone.' },
    { id: 'co-tours', what: 'In-app guided tours and contextual help', status: 'tested', evidence: [['app/src/lib/explain.ts', 'the four questions, answered per screen'], ['app/src/components/unity/ScreenGuide.tsx', 'in the same place on every screen'], ['app/src/lib/welcome.test.ts', 'the first-run welcome']], gap: 'Contextual help, yes; no guided tour.' },
  ]),
  ...company('Security readiness', [
    { id: 'co-sdlc', what: 'A secure software-development lifecycle', status: 'tested', evidence: [['.github/workflows/ci.yml', 'every gate, on every change'], ['app/src/lib/ops/boundaries.test.ts', 'no secret in anything a browser loads']], gap: 'No threat model per change.' },
    { id: 'co-secrets', what: 'Private repositories and secrets management', status: 'tested', evidence: [['SECRETS.md', 'where each secret lives'], ['app/src/lib/ops/boundaries.test.ts', 'held']], gap: 'The repository is public by decision.' },
    { id: 'co-deps', what: 'Dependency scanning and vulnerability management', status: 'building', evidence: [['.github/dependabot.yml', 'weekly updates'], ['.github/workflows/ci.yml', 'gitleaks over every change']], gap: 'No SCA gate; no SLA on a finding.' },
    { id: 'co-observability', what: 'Logging, alerting, monitoring, backups and restore tests', status: 'tested', evidence: [['app/src/lib/rehearsal.test.ts', 'the restore rehearsal runs in CI'], ['MONITORING.md', 'what is watched'], ['RESTORE.md', 'the procedure']], gap: 'Production has never been restored; no alerting on call.' },
    { id: 'co-pentest', what: 'A penetration-testing plan', status: 'tested', evidence: [['docs/trust/PENETRATION-TEST-PLAN.md', 'scope, firm selection, findings register'], ['app/src/lib/trust/vendorrisk.test.ts', 'says plainly that no external test has been performed; names every Edge Function in scope']], gap: 'No firm engaged.' },
    { id: 'co-mfa', what: 'Admin MFA', status: 'tested', evidence: [['supabase/console-control-plane.check.sql', 'a fresh second factor on every sensitive action'], ['app/src/components/MfaStep.tsx', 'the step']], gap: 'Operators only; no student MFA.' },
    { id: 'co-isolation', what: 'Tenant isolation testing', status: 'tested', evidence: [['supabase/access.check.sql', 'what a second account can and cannot read'], ['app/src/isolation.test.ts', 'the client side']], gap: 'None.' },
    { id: 'co-ir', what: 'An incident-response plan and tabletop exercises', status: 'tested', evidence: [['docs/CRISIS-RESPONSE-RUNBOOK.md', 'the runbook'], ['app/src/lib/ops/warroom.test.ts', 'the war room']], gap: 'No tabletop has been run.' },
    { id: 'co-dr', what: 'A disaster-recovery plan', status: 'designed', evidence: [['RESTORE.md', 'the restore'], ['RETENTION.md', 'the backups’ lifecycle']], gap: 'Recovery time unmeasured.' },
    { id: 'co-vendors', what: 'A vendor and subprocessor review process', status: 'tested', evidence: [['app/src/lib/trust/vendorrisk.test.ts', 'one row per subprocessor; no review claimed while none is filed'], ['docs/trust/VENDOR-RISK-REGISTER.md', 'the register']], gap: 'No vendor assessed.' },
    { id: 'co-disclosure', what: 'A security-contact channel and a responsible-disclosure policy', status: 'designed', evidence: [['SECURITY.md', 'reporting a problem from outside']], gap: 'One address, read by a person.' },
  ]),
  ...company('Company credibility', [
    { id: 'co-domain', what: 'A real company domain and professional email addresses', status: 'not-started', evidence: [['ops/claims/README.md', 'company-addresses: planned, with the company that owns the domain']], gap: 'One address for everything.' },
    { id: 'co-identity', what: 'A clear company identity, leadership page and contact routes', status: 'building', evidence: [['app/src/site/pages.tsx', '/about/ and /contact/: each topic routed to a seat']], gap: 'No leadership page; four of twelve seats held, all by the founder.' },
    { id: 'co-careers', what: 'A careers page and candidate process', status: 'building', evidence: [['app/src/site/pages.tsx', '/careers/']], gap: 'No process.' },
    { id: 'co-ambassadors', what: 'An advisor and university-partner program, and a student ambassador program', status: 'building', evidence: [['app/src/site/benchmark.tsx', '/research/: the design-partner council and the student advisory network, each marked not yet running']], gap: 'Neither is running.' },
    { id: 'co-consent', what: 'A case-study process and a testimonial consent process', status: 'tested', evidence: [['app/src/lib/ops/claims.test.ts', 'is what the proof page promises'], ['app/src/lib/ops/claims.ts', 'the proof rules: no invented metric, no unapproved logo, consent before a quote']], gap: 'No case study to run it on.' },
    { id: 'co-roadmap', what: 'Product-plan principles that never promise an unbuilt feature as current', status: 'tested', evidence: [['docs/PRODUCT-ROADMAP.md', 'the plan'], ['app/src/lib/ops/claims.test.ts', 'a word above what the register supports is refused']], gap: 'None.' },
    { id: 'co-changelog', what: 'A public changelog and product-status updates', status: 'tested', evidence: [['CHANGELOG.md', 'what a tester will see'], ['app/src/lib/whatsnew.test.ts', 'the in-app What changed'], ['app/src/lib/statuspage.test.ts', 'the status page']], gap: 'No uptime history.' },
    { id: 'co-social', what: 'Consistent social content: real workflows, student stories, product philosophy', status: 'building', evidence: [['app/src/site/more.tsx', 'the launch kit’s social templates']], gap: 'Templates; no channel.' },
  ]),
];

// ── The nine areas of the architecture page ──────────────────────────────────

export interface Area {
  id: string;
  name: string;
  problem: string;
  workflow: string;
  benefits: string;
  connects: string;
  official: string;
  /** The foundations it connects back to. */
  backTo: readonly string[];
  /** Rows on this page its status rests on. */
  rests: readonly string[];
}

export const AREAS: readonly Area[] = [
  { id: 'path', name: 'Academic Path', problem: 'A student cannot tell whether they are on track without an appointment.', workflow: 'A Path Snapshot from the requirements and credits they entered, and the next requirement still open.', benefits: 'Students first; advisors when a plan is shared.', connects: 'Courses, the term plan, the graduation scenarios, the Action Center.', official: 'The registrar’s degree audit. Semester never says a degree is complete.', backTo: ['Today', 'Action Center', 'Plan'], rests: ['journey-registration', 'ai-degree', 'test-connects'] },
  { id: 'learning', name: 'Courses and Learning', problem: 'A course lives in five places and none of them knows the others.', workflow: 'One course workspace: the syllabus, the assignments, the readings, the study tools, the course’s own AI rules.', benefits: 'Students; faculty through Course Studio.', connects: 'The calendar, the Studio, search, career skills.', official: 'The learning system holds the submissions and the grades.', backTo: ['Workspace', 'Search', 'Semester Intelligence'], rests: ['course-workspace', 'ai-course', 'ai-studio', 'event-material'] },
  { id: 'planning', name: 'Schedule and Planning', problem: 'A week is survivable or not, and nobody can tell before it starts.', workflow: 'The week in hours, the crunch forecast, the registration plan with backups checked for clashes.', benefits: 'Students.', connects: 'Deadlines, commitments, work and commute hours, the Action Center.', official: 'Registration itself happens in the university’s system.', backTo: ['Plan', 'Today', 'Action Center'], rests: ['life-load', 'ai-schedule', 'event-deadline', 'timeline'] },
  { id: 'advising', name: 'Advising and Support', problem: 'The meeting is spent catching up instead of deciding.', workflow: 'A plan shared with an advisor, with an expiry; the problem described in the student’s own words, sent to the right door.', benefits: 'Students and advisors.', connects: 'The path, the plan, the help routes, the Action Center.', official: 'The advisor’s notes and the office’s decisions stay theirs.', backTo: ['Action Center', 'Search'], rests: ['journey-support', 'ai-advising', 'ai-campus', 'event-agenda'] },
  { id: 'campus', name: 'Campus Life', problem: 'An office’s deadline reaches the students it applies to by email, if at all.', workflow: 'An office publishes an action; the students it reaches see it ranked with everything else, labelled Institution verified.', benefits: 'Students and campus offices.', connects: 'Today, the Action Center, Key dates.', official: 'The office’s own page is the link; Semester holds no student record for it.', backTo: ['Action Center', 'Today'], rests: ['action-publisher', 'event-office', 'journey-campus'] },
  { id: 'career', name: 'Career and Portfolio', problem: 'Coursework never becomes evidence unless the student rewrites it.', workflow: 'Skills suggested from courses and experiences, confirmed by the student; artifacts tied to what they did; a résumé from confirmed skills only.', benefits: 'Students.', connects: 'Courses, projects, opportunities, sharing.', official: 'Grades never become a career or employer data source.', backTo: ['Workspace', 'Search'], rests: ['journey-career', 'ai-career', 'event-project', 'passport', 'graph'] },
  { id: 'money', name: 'Money and Important Dates', problem: 'A course-load change has a cost nobody shows.', workflow: 'The term-by-term projection and the cost of delay; the bill; the aid office’s action when it publishes one.', benefits: 'Students and supporters, with consent.', connects: 'The path, the plan, the Action Center.', official: 'Transactions happen in the university’s portal; Semester never stores a card.', backTo: ['Plan', 'Action Center'], rests: ['journey-money', 'ai-money'] },
  { id: 'community', name: 'Community and Opportunities', problem: 'Opportunities are found by whoever already knows where to look.', workflow: 'Opportunities matched to confirmed skills, with the missing skill named; communities on the Beyond shelf.', benefits: 'Students.', connects: 'Skills, courses, the career workspace.', official: 'Membership and eligibility are the organisation’s.', backTo: ['Search', 'Workspace'], rests: ['search-opportunities', 'graph'] },
  { id: 'operations', name: 'Institution Operations', problem: 'Every module ships its own admin tool.', workflow: 'One console for operators — approvals, break-glass, audit, customers, figures, evidence — and the institution’s views on University: control plane, integrations, campaigns, the action desk.', benefits: 'Operators and institution staff.', connects: 'Identity, permissions, audit, support access.', official: 'Governance stays the institution’s; the console records, it does not decide.', backTo: ['Semester Intelligence', 'Action Center'], rests: ['ic-roles', 'ic-integrations', 'ic-audit', 'campus-graph', 'health-dashboard'] },
];

// ── The comparison: “Why not another tool?” ──────────────────────────────────

export interface Comparison {
  id: string;
  traditional: string;
  semester: string;
  rests: readonly string[];
}

export const COMPARISON: readonly Comparison[] = [
  { id: 'cmp-portals', traditional: 'Separate portals for separate jobs', semester: 'One connected platform', rests: ['shell-tabs', 'shell-rail', 'identity', 'objects'] },
  { id: 'cmp-look', traditional: 'Students must know where to look', semester: 'Semester surfaces the next relevant action', rests: ['action-center', 'ac-most'] },
  { id: 'cmp-silos', traditional: 'Data stays inside departmental silos', semester: 'Shared context with role-based permissions', rests: ['ic-roles', 'ic-support', 'role-consent'] },
  { id: 'cmp-logins', traditional: 'Multiple logins and interfaces', semester: 'One identity and one familiar experience', rests: ['identity', 'shell-visual'] },
  { id: 'cmp-alerts', traditional: 'Alerts arrive independently', semester: 'One prioritized Action Center', rests: ['notifications', 'action-center', 'inbox'] },
  { id: 'cmp-ai', traditional: 'AI works without context', semester: 'Source-aware intelligence with permissions and controls', rests: ['intelligence', 'ai-course', 'ic-ai'] },
  { id: 'cmp-support', traditional: 'Support depends on navigating an org chart', semester: 'Relevant resources and safe handoffs appear in context', rests: ['ai-campus', 'test-who', 'handoffs'] },
  { id: 'cmp-career', traditional: 'Students manually connect coursework to careers', semester: 'Student-controlled course-to-skill-to-career pathways', rests: ['ai-career', 'journey-career'] },
];

// ── The ten highest-impact additions, and the standard ───────────────────────

export const TOP_TEN: readonly string[] = ['home', 'action-center', 'search', 'course-workspace', 'passport', 'action-publisher', 'integration-center', 'content-governance', 'ai-policy', 'architecture'];

export const FINAL_STANDARD =
  'Does it connect to the student’s identity, goals, courses, term, plan, calendar, Action Center, Search, Workspace, intelligence layer, permissions and source data — or is it merely another isolated screen? If it connects, it strengthens the operating system. If it is isolated, it is redesigned, merged into an existing workflow, or removed.';

export const ALL: readonly Held[] = [
  ...PRINCIPLES, ...ACTION_CENTER, ...SEARCH_UNIFIES, ...INTELLIGENCE, ...SHELL, ...CONTEXT, ...DETAIL, ...JOURNEYS, ...EVENTS, ...DESIGN_SURFACES, ...HOME_ROLES, ...EXPAND,
  ...INSTITUTION_CONSOLE, ...FINAL_TEST, ...APP_ADDITIONS, ...SITE_ADDITIONS, ...CONSOLE_ADDITIONS, ...COMPANY,
];

/** Counts, for the header and the test. */
export function counts(): Record<Status, number> {
  const out: Record<Status, number> = { 'not-started': 0, designed: 0, building: 0, tested: 0 };
  for (const h of ALL) out[h.status] += 1;
  return out;
}
