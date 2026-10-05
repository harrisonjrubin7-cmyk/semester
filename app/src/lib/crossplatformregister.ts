/**
 * The Cross-platform Features Register: the fifteen features a document of
 * 30 September 2026 proposes to connect Semester's existing systems — a
 * commitments layer, a decision journal, change detection, an inbox workflow,
 * templates, a resource guarantee, workload transparency and fairness,
 * retrospectives, "prepare me", handoff packs, skills transfer, an archive,
 * focus modes and learning continuity — and where the repository stands on
 * each.
 *
 * `docs/CROSS-PLATFORM-FEATURES-REGISTER.md` is rendered from this file by
 * `crossplatformregister.test.ts`; edit the data, then `npm run registers` from
 * app/.
 *
 * ## What a status may claim
 *
 * The same rule as the service register: `tested` cites a test that runs on
 * every change, `building` cites code, `designed` a document, `not-started`
 * cites at most a document naming the gap. A status describes the *best* piece
 * of a feature, so the capability marks are what say how much is there: a
 * capability is present only where something in the tree does it now, and a
 * capability the student cannot yet set on a screen is marked absent even when
 * the model for it exists.
 *
 * The supplied document is never cited as evidence.
 */

export const SOURCE = {
  title: 'Anything else or any feature, function and/or capability, screen or service that can be further hardened, deepened and strengthened',
  what: 'Fifteen cross-platform features and the ten it says to prioritise.',
};

export const STATUSES = ['not-started', 'designed', 'building', 'tested'] as const;
export type Status = (typeof STATUSES)[number];

export interface Capability {
  what: string;
  /** Something of it does this in the tree today. */
  have: boolean;
}

export interface Evidence {
  /** Repository-relative. */
  path: string;
  shows: string;
}

export interface Feature {
  /** `X01`–`X15`, stable, in the document's order. */
  id: string;
  title: string;
  /** Where it lives, or would. */
  home: string;
  status: Status;
  /** The document's priority rank, 1–10, or null when it did not rank it. */
  priority: number | null;
  capabilities: readonly Capability[];
  evidence: readonly Evidence[];
  /** What is not done, said plainly. */
  gap: string;
  /** Other work this touches: open pull requests, existing modules. */
  overlaps: string;
}

const c = (what: string, have: boolean): Capability => ({ what, have });
const e = (path: string, shows: string): Evidence => ({ path, shows });

export const FEATURES: readonly Feature[] = [
  {
    id: 'X01',
    title: 'My Commitments',
    home: 'Plan → My Commitments; a card on Today',
    status: 'tested',
    priority: 1,
    capabilities: [
      c('Classes and meetings on one day', true),
      c('Deadlines, exams and projects', true),
      c('Work shifts, athletics, rehearsals and club or research obligations', true),
      c('Advising and personal appointments', true),
      c('Registration, aid, housing and graduation steps', true),
      c('Caregiving and family blocks as their own kind', false),
      c('Required versus optional, used to suggest what can give', true),
      c('Fixed versus flexible, set by the student on a screen', false),
      c('Estimated duration', true),
      c('Energy level, set by the student on a screen', false),
      c('Location and commute, set by the student on a screen', false),
      c('Privacy: private or busy-only, set by the student on a screen', false),
      c('Conflict state derived from stated times', true),
      c('Recovery options that are moves the data supports', true),
    ],
    evidence: [
      e('app/src/lib/dayplan.ts', 'One plan item shape; overlap, tight-commute and floating states; free windows; recovery; a busy-only shared view'),
      e('app/src/lib/dayplan.test.ts', 'Overlap, commute, windows, recovery and privacy held by tests'),
      e('app/src/components/DayPlanNote.tsx', 'A card on Today, silent unless the day overlaps and in the sample semester'),
      e('app/src/lib/activities.ts', 'The recurring commitments the plan reads'),
    ],
    gap: 'Flexible, energy, commute and privacy have a model and no way for the student to set them; nothing carries deadlines into the plan; caregiving is not a kind. It shows today only, and only on overlap.',
    overlaps: 'lib/clash.ts and lib/activities.ts already detect heavy weeks and class clashes; lib/ops/commitments.ts is the unrelated company register. Open PR #1014 (life events) may define a shared item model.',
  },
  {
    id: 'X02',
    title: 'Academic decision journal',
    home: 'My Path → Decision Journal',
    status: 'not-started',
    priority: null,
    capabilities: [
      c('A decision with its goal and the options considered', false),
      c('Verified facts kept apart from assumptions and unknowns', false),
      c('Advice received, with its source', false),
      c('The chosen option and the reason', false),
      c('A later outcome or reflection', false),
      c('Private to the student, never surfaced to staff', false),
    ],
    evidence: [],
    gap: 'Nothing holds a student-authored academic decision. lib/journal.ts is an activity trail, not decisions; advisor-meeting.ts follow-ups are the nearest thing.',
    overlaps: 'lib/advisor-meeting.ts (follow-ups) could link to an entry.',
  },
  {
    id: 'X03',
    title: 'What Changed',
    home: 'Today → What Changed; Course Home → Course Changes',
    status: 'tested',
    priority: 2,
    capabilities: [
      c('New, moved, retimed, reweighted and removed course deadlines', true),
      c('Previous value, new value, source, effective date, impact and action on every change', true),
      c('The acknowledged reading is kept and synced', true),
      c('Silent on a first reading and in the sample semester', true),
      c('Registration-window changes', false),
      c('Catalog policy and requirement-mapping changes', false),
      c('Course meeting-time changes', false),
      c('Faculty announcements and updated resources', false),
      c('AI-policy and credential-status changes', false),
      c('My Path → Plan Changes', false),
    ],
    evidence: [
      e('app/src/lib/whatchanged.ts', 'The comparison and the acknowledged-reading helpers'),
      e('app/src/lib/whatchanged.test.ts', 'Each kind of change, ordering, first-reading silence and malformed saved data'),
      e('app/src/components/WhatChanged.test.tsx', 'The card on screen, the seeding effect and "Got it"'),
      e('app/src/state/slices/seen.test.ts', 'Seeding versus acknowledging in the reducer'),
      e('app/src/components/WhatChanged.tsx', 'The card on Today and on a course page'),
    ],
    gap: 'Deadlines only. The other change sources in the document have no baseline to compare against yet.',
    overlaps: 'screens/Changes.tsx ingests outside emails and calendars; this reports what differs between two readings of a course.',
  },
  {
    id: 'X04',
    title: 'Inbox-zero for the university inbox',
    home: 'Today → University Inbox',
    status: 'not-started',
    priority: null,
    capabilities: [
      c('Suggest an action, deadline or reminder from a message, never creating one unreviewed', false),
      c('Link a message to a course', false),
      c('Mute a source', false),
      c('Report a message as incorrect', false),
      c('Archive and save', false),
    ],
    evidence: [],
    gap: 'Mail is read-only and has folders, archive and rules (lib/mailbox.ts, lib/mailrules.ts); nothing turns a message into a suggestion.',
    overlaps: 'Open PRs #725 (automation centre) and #1018 (Workflow Builder): keep this suggest-only.',
  },
  {
    id: 'X05',
    title: 'Academic template library',
    home: 'Workspace → Templates',
    status: 'tested',
    priority: null,
    capabilities: [
      c('Writing skeletons', true),
      c('Assignment workflow stages', true),
      c('Advisor agenda', true),
      c('Study plan, exam preparation, lab notebook and project plan', false),
      c('Literature review, research matrix and group contract', false),
      c('Scholarship, internship and graduate-school trackers', false),
      c('Editable, versioned copies', false),
      c('Export as one library', false),
    ],
    evidence: [
      e('app/src/lib/doctemplates.test.ts', 'Writing skeletons'),
      e('app/src/lib/toolkit/templates.test.ts', 'Assignment workflow stages'),
    ],
    gap: 'Two template sets exist and neither is a library: no catalogue, no versioned student copies, no export.',
    overlaps: 'Open PR #1010 (course agreement) may add a group contract.',
  },
  {
    id: 'X06',
    title: 'Resource guarantee',
    home: 'Search → Resource Guarantee; Support Navigator → Alternative Help',
    status: 'tested',
    priority: 4,
    capabilities: [
      c('Owner, last-reviewed date, contact route, accessibility information and official link on every listing', true),
      c('A report-an-issue count', true),
      c('Stale listings are flagged and still shown', true),
      c('Availability stated by the owner, lapsing when a closure ends', true),
      c('An owner-chosen fallback, then the next approved listing, when a route is closed', true),
      c('A dead end is named for the office that owns the category', true),
      c('A screen that shows it to a student', false),
      c('Every public office, policy and event entry held to the guarantee', false),
    ],
    evidence: [
      e('app/src/community/services.ts', 'The listing rules, availability, fallback and the guarantee'),
      e('app/src/community/services.test.ts', 'Closed and waitlisted listings, fallback order, lapsed closures and fallback faults'),
    ],
    gap: 'Nothing in the app reads the directory yet, so a student cannot see the guarantee. Offices, policies and events are not held to it.',
    overlaps: 'lib/support.ts and lib/help-routes.ts are static maps of who to talk to.',
  },
  {
    id: 'X07',
    title: 'Course workload contract',
    home: 'Course Detail → Workload & Expectations',
    status: 'not-started',
    priority: 5,
    capabilities: [
      c('Credit, meeting time and modality with their sources', false),
      c('An estimated weekly work range from published expectations', false),
      c('Assessment types, major deadlines and required materials', false),
      c('Attendance, technology, accessibility and AI policy', false),
      c('Prerequisites and corequisites', false),
      c('No difficulty score', false),
    ],
    evidence: [],
    gap: 'screens/settings/Workload.tsx is the student’s own capacity, not a course contract. The course record has no field for it.',
    overlaps: 'Open PR #1010 (course agreement, start-here check) probably covers part of it; fold into it once it lands.',
  },
  {
    id: 'X08',
    title: 'Workload fairness engine',
    home: 'Institution → Curriculum & Workload; Faculty → Course Calendar',
    status: 'not-started',
    priority: 5,
    capabilities: [
      c('Clustered major assessments in one week across a cohort', false),
      c('Missing due dates', false),
      c('Release too close to the deadline', false),
      c('Conflicts with campus closures', false),
      c('Aggregate only, with small cells suppressed', false),
    ],
    evidence: [],
    gap: 'lib/clash.ts and lib/ahead.ts are per-student. Nothing looks across a cohort, and it must never read an individual.',
    overlaps: 'None found.',
  },
  {
    id: 'X09',
    title: 'Semester retrospectives',
    home: 'Me → Semester Reflection; Faculty → Course Reflection; Institution → Term Review',
    status: 'tested',
    priority: 9,
    capabilities: [
      c('A private recap of the student’s own chosen outcomes', true),
      c('A term-transition checklist', true),
      c('Student reflection prompts and kept answers', false),
      c('Faculty course reflection', false),
      c('Institution term review', false),
    ],
    evidence: [
      e('app/src/lib/wrapped.test.ts', 'The private recap'),
      e('app/src/lib/termtransition.test.ts', 'The term-end checklist'),
    ],
    gap: 'No place to write what worked or what to change; faculty and institution versions do not exist.',
    overlaps: 'Open PR #1014 (moment feedback) may overlap.',
  },
  {
    id: 'X10',
    title: 'Prepare me',
    home: 'A button on an event or deadline',
    status: 'tested',
    priority: 3,
    capabilities: [
      c('Gather the student’s own notes, marked confusions, attempts and questions for eleven kinds of event', true),
      c('Report what is missing instead of filling it in', true),
      c('Quote the course AI policy with its source, and show none when none is stated', true),
      c('Offer values to a matching handoff pack, each still needing a tick', true),
      c('A button on an event or deadline', false),
      c('Pull from the student’s notes and study guide automatically', false),
    ],
    evidence: [
      e('app/src/lib/prepare.ts', 'The gatherer and the handoff mapping'),
      e('app/src/lib/prepare.test.ts', 'Missing slots, policy quoting, private confusion marks and pack hand-off'),
    ],
    gap: 'A function with no screen: nothing calls it yet, and nothing fills its context from the student’s notes.',
    overlaps: 'lib/advisor-meeting.ts holds the advising version.',
  },
  {
    id: 'X11',
    title: 'Expert-service handoff packs',
    home: 'Support Navigator → Handoff Pack',
    status: 'tested',
    priority: 6,
    capabilities: [
      c('A fixed list of fields for each of nine destinations', true),
      c('Only ticked fields that have something in them', true),
      c('A field a destination may not receive cannot be added', true),
      c('The review says what stays private', true),
      c('A frozen snapshot with the time it was made', true),
      c('A screen to build and review a pack', false),
      c('Sending, with the student’s confirmation', false),
    ],
    evidence: [
      e('app/src/lib/expertpack.ts', 'The per-destination allowlists and the pack'),
      e('app/src/lib/expertpack.test.ts', 'Allowlist, snapshot, preview and what is left out'),
      e('app/src/lib/advisor-meeting.ts', 'The share-payload pattern this generalises'),
    ],
    gap: 'A function with no screen and no way to send. It must not become a second sharing system beside advisor-meeting.ts.',
    overlaps: 'lib/handoff.ts (classmate pack), lib/aihandoff.ts and lib/tickethandoff.ts are different destinations.',
  },
  {
    id: 'X12',
    title: 'Cross-course skills transfer',
    home: 'Me → Skills Across Courses; Career → Evidence Builder',
    status: 'tested',
    priority: null,
    capabilities: [
      c('Skill claims that are student-confirmed or institution-verified', true),
      c('Only confirmed skills travel', true),
      c('A view of where a skill was used across courses', false),
      c('A suggested next place to apply it, confirmed by the student', false),
    ],
    evidence: [
      e('app/src/lib/skills-graph.test.ts', 'Claims and their verification'),
      e('app/src/lib/career-evidence.test.ts', 'Suggested, confirmed and rejected skills'),
    ],
    gap: 'No course-to-course view, and no suggestion the student can confirm.',
    overlaps: 'Open PRs #988 (transfer credit) and #1010 (learning map) are adjacent.',
  },
  {
    id: 'X13',
    title: 'Personal academic archive',
    home: 'Me → Academic Archive',
    status: 'tested',
    priority: 10,
    capabilities: [
      c('A whole-account export that can be read back', true),
      c('A term-transition checklist of what to keep', true),
      c('A curated per-term archive the student selects', false),
      c('A manifest of what an archive holds', false),
      c('Only materials the student is permitted to retain', false),
      c('Learner-record and credential export together', false),
    ],
    evidence: [
      e('app/src/lib/export.test.ts', 'The account export'),
      e('app/src/lib/termtransition.test.ts', 'What to keep at the end of a term'),
    ],
    gap: 'There is an export of everything, and no archive the student chooses.',
    overlaps: 'docs/DATA-PORTABILITY-AND-OFFBOARDING.md covers leaving; this is keeping.',
  },
  {
    id: 'X14',
    title: 'Focus modes',
    home: 'A mode switch across the app',
    status: 'tested',
    priority: 7,
    capabilities: [
      c('A focused layout and break reminders', true),
      c('Named modes: today, study, registration, assignment, advising, career, finals, recovery', false),
      c('A mode changes emphasis, not navigation or data', false),
    ],
    evidence: [e('app/src/lib/breaks.test.ts', 'Break reminders in the focused layout, the nearest existing piece')],
    gap: 'Not started here: open PR #725 already carries Focus Mode and would duplicate.',
    overlaps: 'Open PR #725 (AI routing, Focus Mode, automation centre).',
  },
  {
    id: 'X15',
    title: 'Learning continuity across terms',
    home: 'Course Home → refresh plan',
    status: 'not-started',
    priority: 8,
    capabilities: [
      c('Prior-course concepts linked to the next course’s prerequisites', false),
      c('A refresh plan from earlier notes and worked examples', false),
      c('Targeted review of what was weak', false),
    ],
    evidence: [],
    gap: 'Terms are isolated: notes and study progress do not carry forward.',
    overlaps: 'Open PR #1010 (learning map) and #988 (transfer credit).',
  },
];

export const present = (f: Feature) => f.capabilities.filter((x) => x.have).length;

export const featureOf = (id: string) => FEATURES.find((f) => f.id === id);
