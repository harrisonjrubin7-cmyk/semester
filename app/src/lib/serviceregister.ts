/**
 * The Service Expansion Register: the twenty-six service layers a document of
 * 28 September 2026 proposes beyond coursework — student-life, academic,
 * career, institutional, platform-and-trust and commercial — and where the
 * repository stands on each.
 *
 * `docs/SERVICE-EXPANSION-REGISTER.md` is rendered from this file by
 * `serviceregister.test.ts`; edit the data, then `npm run registers` from app/.
 *
 * ## How this relates to what is already here
 *
 * `expansionregister.ts` is the long-horizon *governance* register: supply
 * chain, credentials, councils, benchmark. This is the *service* register: the
 * things a student or an office would use. Where a module overlaps an area
 * there, or a row of the master launch readiness register, it names them
 * rather than restating them, and the test holds every name to a real id.
 *
 * ## What a status may claim
 *
 * The expansion register's rule and its four lower statuses: `designed`
 * cites a document, `building` cites code, `tested` cites a test that runs on
 * every change, `not-started` cites at most a document naming the gap. A
 * status is a claim about the *best* piece of a module, so nearly every module
 * here is `tested` — the app already has a checklist, a directory entry or a
 * screen for part of it. What the status cannot say, the capability marks do:
 * each capability the document asks for is marked present or absent, and the
 * rendered page counts them. A module that is `tested` at 3 of 12 is mostly
 * not there, and the page says so.
 *
 * The supplied PDFs are never cited as evidence. Assessed against
 * `origin/main` `92952f0` on 28 September 2026.
 *
 * ## The one principle
 *
 * Do not add features because they are popular. Add services that eliminate
 * a real point of student friction, preserve institutional authority, improve
 * accessibility, and create measurable value for institutions.
 */

export const SOURCES: readonly { path: string; title: string; what: string }[] = [
  {
    path: 'docs/expansion/Service-Layers-Beyond-Coursework.pdf',
    title: 'Any other services, features and capabilities that can be further developed',
    what: 'The twenty-six service layers, their boundaries, the twelve questions every proposed service answers, and the strategic sequence.',
  },
  {
    path: 'docs/expansion/Transfer-Hub-Career-Safe-AI-and-Basic-Needs.pdf',
    title: 'Show me the transfer transition hub details (with career, safe AI and basic needs)',
    what: 'The Career OS boundaries, the skills-evidence ladder, the workforce-partner line and the six-step delivery order.',
  },
];

export const PRINCIPLE =
  'Do not add features because they are popular. Add services that eliminate a real point of student friction, preserve institutional authority, improve accessibility, and create measurable value for institutions.';

export const GROUPS = {
  'student-life': 'Student-life services',
  academic: 'Academic and learning services',
  career: 'Career and lifelong-value services',
  institutional: 'Institutional services',
  'platform-trust': 'Platform and trust services',
  commercial: 'Commercial and ecosystem services',
} as const;

export type Group = keyof typeof GROUPS;

export const STATUSES = ['not-started', 'designed', 'building', 'tested'] as const;
export type Status = (typeof STATUSES)[number];

export interface Capability {
  what: string;
  /** Something of it exists in the tree, per the evidence. */
  have: boolean;
}

export interface Module {
  /** `S01`–`S26`, stable. */
  id: string;
  title: string;
  group: Group;
  /** Why it matters, in one sentence. */
  why: string;
  capabilities: readonly Capability[];
  /** What the module must never do or decide. */
  boundary: string;
  status: Status;
  evidence: readonly { path: string; shows: string }[];
  gap: string;
  /** Master-register rows that overlap. */
  master: readonly string[];
  /** Strategic-expansion areas that overlap. */
  areas: readonly string[];
}

type Cap = string | [what: string, have: false];
const cap = (c: Cap): Capability => (typeof c === 'string' ? { what: c, have: true } : { what: c[0], have: false });
const no = (what: string): Cap => [what, false];

type Row = Omit<Module, 'id' | 'capabilities' | 'evidence'> & { capabilities: readonly Cap[]; evidence: readonly [path: string, shows: string][] };

const ROWS: readonly Row[] = [
  // ── Student-life services ────────────────────────────────────────────────
  {
    title: 'Basic-needs and crisis-resource navigator',
    group: 'student-life',
    why: 'Many students struggle because the right help is hard to find, eligibility is unclear, or the official route is buried across websites.',
    capabilities: [
      'Institution-verified resource directory (food, housing, transportation, technology, childcare, emergency funds, aid, health, legal, international, disability, supplies)',
      no('Eligibility and documentation checklist per resource'),
      no('Hours, location, languages, cost and accessibility details per resource'),
      'Appointment and official-portal handoff',
      no('Save-for-later and reminder controls'),
      'Private personal action checklist',
      no('“Last reviewed” and content-owner labels on resources'),
      no('Broken-link and outdated-information report'),
    ],
    boundary: 'Do not collect unnecessary sensitive details, diagnose a crisis, or replace emergency, health, legal, financial-aid or counseling professionals.',
    status: 'tested',
    evidence: [
      ['app/src/lib/support.ts', 'food, emergency housing, emergency grants, transport, childcare and legal aid, each with an office, a privacy level and a “never” list'],
      ['app/src/lib/journey.guards.test.ts', 'every entry names an office, a line or a screen and states its privacy; no score, no tracking'],
      ['app/src/lib/help-routes.test.ts', 'financial aid and accessibility are directory-only: nothing is stored'],
      ['app/src/lib/campusdirectory.ts', 'a school-imported departments-and-offices directory with hours, appointments and walk-in fields'],
    ],
    gap: 'The entries are generic office pointers, not an institution-verified directory: no per-resource eligibility, documents, hours, cost, language or accessibility, no owner or review date, no save-for-later, no broken-link report. The object model is docs/BASIC-NEEDS-NAVIGATOR.md.',
    master: ['STU-012', 'UOS-002'],
    areas: ['CGV', 'SVC'],
  },
  {
    title: 'Transfer-student transition hub',
    group: 'student-life',
    why: 'Semester’s origin story is the fragmentation transfer students face; a one-stop, source-aware hub is its natural wedge.',
    capabilities: [
      'Transfer credit preparation checklist',
      no('Major and requirement comparison workspace (old school against new)'),
      'Orientation timeline',
      'Campus systems glossary',
      'Transfer peer mentorship',
      no('“Where do I go for this?” navigator, transfer-specific'),
      'Community and club discovery',
      'Advisor meeting preparation',
      'Course and workload planning',
      no('Scholarship and financial-aid handoff for transfers'),
      'Career and portfolio continuity',
      no('Term-to-term transition archive of past plans and work'),
    ],
    boundary: 'No official transfer-credit or degree-completion decision. Organize evidence, identify questions, surface authoritative information, and prepare the student for the official evaluation.',
    status: 'tested',
    evidence: [
      ['app/src/lib/launchpad.ts', 'the transfer type adds a credit-evaluation step and transfer orientation; the campus-terms glossary'],
      ['app/src/lib/learner-pathways.test.ts', 'the transfer pathway offers credit-evaluation and program-change checklists, and names the registrar or advisor as the one who decides'],
      ['app/src/lib/advisor-meeting.test.ts', 'the advisor agenda shares only what the student ticked'],
      ['app/src/lib/mentors.test.ts', 'mentor matching on listed topics and ticked interests, nothing else'],
      ['app/src/lib/termtransition.test.ts', 'start- and end-of-term checklists, each opening an existing screen'],
      ['supabase/migrations/20260926150000_expansion_roles_and_features.sql', 'articulation_rules (draft, proposed, approved) and transfer_evaluations'],
    ],
    gap: 'The transfer pieces are checklist steps spread across launchpad, pathway and learner-pathways; no comparison workspace, no transfer navigator, no archive. The hub’s structure is docs/TRANSFER-TRANSITION-HUB.md.',
    master: ['STU-003', 'STU-004', 'STU-008'],
    areas: ['PRF'],
  },
  {
    title: 'Commuter, working, parenting and adult-learner mode',
    group: 'student-life',
    why: 'Most campus technology assumes students live on or near campus with flexible daytime schedules.',
    capabilities: [
      'Commuter travel-time planning',
      no('Parking and transit information'),
      no('Hybrid and asynchronous event filtering'),
      no('Childcare and family-resource directory'),
      'Evening and weekend service availability (course sections)',
      no('Asynchronous club and study-group options'),
      'Work-schedule-aware study planning',
      no('Low-bandwidth mode'),
      'Downloadable and offline material access where permitted',
      no('Caregiver-friendly reminder controls'),
    ],
    boundary: 'Chosen, never inferred: a student says they commute, work or care for someone; the app never guesses it from behaviour.',
    status: 'tested',
    evidence: [
      ['app/src/lib/life-balance.test.ts', 'the weekly hours count a stated commute, work and class, and suggest study blocks without placing them'],
      ['app/src/lib/windows.test.ts', 'work windows the student sets replace the assumed sixteen-hour day'],
      ['app/src/lib/learner-pathways.test.ts', 'working and caregiver pathways; sections filtered to evening, weekend, online or hybrid'],
      ['app/src/lib/journey.guards.test.ts', 'leaveBy: travel time plus a buffer, doubled on bad-weather days'],
      ['app/src/lib/travelpack.test.ts', 'a course’s audio, decks and handouts downloaded ahead for offline use'],
    ],
    gap: 'No parking or transit data, no hybrid or asynchronous filters for events and clubs, no family directory, no low-bandwidth mode, no caregiver reminder controls.',
    master: ['STU-007', 'STU-010'],
    areas: [],
  },
  {
    title: 'International-student navigation layer',
    group: 'student-life',
    why: 'Compliance, documents, time zones and language are a second campus to learn, and the office that answers is easy to miss.',
    capabilities: [
      'International orientation checklist',
      'Institution-approved compliance reminders (office-targeted)',
      no('Travel and document-preparation checklists with expiry tracking'),
      'International-office handoffs',
      no('Language support (translated interface)'),
      no('Time-zone-aware scheduling for the home zone'),
      no('Cultural and community discovery'),
      'Emergency-information routing',
      no('Career, internship and work-authorization resource handoffs'),
    ],
    boundary: 'Never offer legal or immigration advice as AI output. Label official information, preserve freshness dates, and route to the designated international office or qualified adviser.',
    status: 'tested',
    evidence: [
      ['app/src/lib/learner-pathways.ts', 'the international pathway routes to the office and says Semester gives no immigration, work or tax advice'],
      ['app/src/lib/pathway.ts', 'an international-arrival checklist: official instructions, document and travel deadlines, advisor appointment'],
      ['app/src/lib/office-actions.test.ts', 'offices reach students who chose the international eligibility; the student is told the match was their own choice'],
      ['app/src/lib/locale.test.ts', 'a student-chosen locale for dates and numbers; nothing inferred'],
      ['docs/LOCALIZATION-PLAIN-LANGUAGE-INTERNATIONALIZATION.md', 'the message catalogue that does not exist yet'],
    ],
    gap: 'No translated interface, no document-expiry or travel tracker, no home-zone scheduling, no community discovery, and nothing on CPT or OPT.',
    master: ['STU-002', 'STU-012'],
    areas: [],
  },
  {
    title: 'Veteran and military-connected student navigator',
    group: 'student-life',
    why: 'Benefits certification, military credit and deployment planning each have an office and a deadline, and a student new to campus meets all three at once.',
    capabilities: [
      'Benefits-office routing',
      'Military-credit documentation checklist',
      'Deployment and absence planning handoff',
      no('Veteran community discovery'),
      no('Career translation resources'),
      no('Counseling and wellness resource handoff, veteran-specific'),
      no('Flexible and asynchronous resource filters'),
    ],
    boundary: 'Configurable by institution and built only with appropriate stakeholder input; never calculates a benefit.',
    status: 'tested',
    evidence: [
      ['app/src/components/LearnerPathways.test.tsx', 'ticking “veteran, service member” shows the military checklist; the choice stays on the device'],
      ['app/src/lib/learner-pathways.test.ts', 'pathway steps never say submit, approve or eligible'],
      ['app/src/lib/learner-pathways.ts', 'benefit certification, credit for military training, a deployment plan, withdrawal and readmission rules, routed to the certifying official'],
      ['app/src/lib/office-actions.ts', 'a Veterans Services office label and a veteran_benefits eligibility'],
    ],
    gap: 'No benefits office with a real address, no document store, no veteran community, no career translation, no veteran-specific counseling handoff.',
    master: ['STU-002'],
    areas: [],
  },
  // ── Academic and learning services ───────────────────────────────────────
  {
    title: 'Course readiness and skills bridge',
    group: 'academic',
    why: 'Before a term starts, a student can assess readiness without receiving a punitive label.',
    capabilities: [
      'Prerequisite and source review',
      'Self-selected confidence check',
      'Optional diagnostic practice',
      'Accessible learning resources',
      no('Bridge study plan tying a prerequisite gap to refresher material'),
      'Tutoring, writing and library referral',
      'Instructor-approved refreshers, when available',
    ],
    boundary: 'Do not create hidden “at-risk” scores or automatically notify faculty or advisors based on a student’s participation.',
    status: 'tested',
    evidence: [
      ['app/src/lib/study-readiness.test.ts', 'per topic, the student sets status and confidence; practice shows as counts; it never predicts a grade or compares the student'],
      ['app/src/lib/pretest.test.ts', 'optional practice before a unit, never scored'],
      ['app/src/lib/course-detail.test.ts', 'prerequisite and corequisite codes read from the catalog'],
      ['app/src/lib/help-routes.test.ts', 'requests to tutoring, writing center and library, sent only on confirm'],
      ['app/src/lib/institution-ops.test.ts', 'any metric built on an individual risk score is refused'],
      ['app/src/lib/coursestudio.test.ts', 'instructors publish study packs and guidance'],
    ],
    gap: 'Readiness covers upcoming assessments in the current course; no bridge plan and no prerequisite diagnostic bank.',
    master: [],
    areas: [],
  },
  {
    title: 'Study accessibility and learning-strategy studio',
    group: 'academic',
    why: 'These should be ordinary quality features, not tools that require a diagnosis or a disclosure.',
    capabilities: [
      'Read aloud and text-to-speech (flash cards)',
      'Focus reading mode and presets',
      'Font, spacing, colour and contrast preferences',
      'Plain-language explanation mode',
      no('Vocabulary support'),
      no('Citation-supported summaries'),
      no('Audio note capture tied to readings'),
      'Speech-to-text drafting',
      no('Outline and visual planning tools'),
      no('Accessible math and chart descriptions'),
      'Study-time estimates',
      'Pomodoro and focus sessions, optional',
      no('Distraction-minimized reading workspace'),
      'Executive-function planning supports (dated steps)',
    ],
    boundary: 'Never inferred: a mode is turned on by the student, and nothing guesses a disability from how the app is used.',
    status: 'tested',
    evidence: [
      ['app/src/lib/accessmode.ts', 'plain language, one step at a time, predictable layout, sensory-friendly; Focus, Easier reading and Lower load presets'],
      ['app/src/lib/contrast.test.ts', 'every accent and background pair legible; line height, reading width and a hyperlegible face in look.ts'],
      ['app/src/lib/speak.test.ts', 'browser text-to-speech reads a card aloud and is silent where no voice exists'],
      ['app/src/lib/transcribe.test.ts', 'speech-to-text for lectures and any field'],
      ['app/src/lib/breaks.test.ts', 'a focus-mode break reminder, suggested, never enforced'],
      ['app/src/lib/pace.test.ts', 'study-time estimates from the student’s own past durations'],
    ],
    gap: 'No vocabulary builder, no reader for PDFs or documents, no audio notes tied to readings, no chart descriptions, and Study Studio summaries cite no sources.',
    master: [],
    areas: ['WFA'],
  },
  {
    title: 'Library and research navigator',
    group: 'academic',
    why: 'Partner with libraries rather than trying to replace them.',
    capabilities: [
      'Research question → librarian and service route',
      no('Database and subject-guide discovery'),
      'Citation and source-evaluation help',
      no('Course-reserve linking'),
      no('Copyright, fair-use and permissions guidance'),
      no('Research appointment scheduling'),
      'Peer-reviewed and source-type education',
      'Reading-list organization',
      'Citation manager export',
      no('Research data-management handoff'),
    ],
    boundary: 'Sources are found, not generated; an AI summary is never “verified”, and the librarian is the route for a question the app cannot answer.',
    status: 'tested',
    evidence: [
      ['app/src/lib/research.test.ts', 'web-search sources are found, not generated; peer-reviewed sources separated; a librarian pointed to'],
      ['app/src/lib/sources.test.ts', 'a source list per course or project, BibTeX export, reading-list titling'],
      ['app/src/lib/toolkit/research.test.ts', '“verified” needs the original opened and a complete citation; AI summaries never are'],
      ['app/src/lib/cite.test.ts', 'a quote checked strictly against its source text'],
      ['app/src/lib/help-routes.ts', 'the library as a help-request destination'],
    ],
    gap: 'No course reserves, subject guides, appointment booking, copyright guidance or data-management handoff.',
    master: [],
    areas: [],
  },
  {
    title: 'Assessment and feedback literacy',
    group: 'academic',
    why: 'Students often receive grades or comments without understanding how to improve.',
    capabilities: [
      'Assignment brief → student checklist',
      'Rubric explanation in plain language',
      no('Instructor-approved examples'),
      'Submission-preparation checklist',
      no('Feedback organizer'),
      no('Revision plan built from feedback'),
      no('Office-hours agenda builder'),
      'Academic-integrity policy reminders',
      'Grade scenario planner, clearly marked as estimated',
    ],
    boundary: 'Predicts nothing: no output mentions a score, grade or points earned, and a what-if never touches a stored grade.',
    status: 'tested',
    evidence: [
      ['app/src/lib/toolkit/rubric.test.ts', 'a rubric becomes a checklist in its own words, and predicts nothing'],
      ['app/src/lib/toolkit/templates.test.ts', 'assignment workspaces by stage; an AI-use declaration when policy requires one'],
      ['app/src/lib/assignment.test.ts', 'instructions become a dated step plan; never writes the work'],
      ['app/src/lib/whatif.test.ts', 'a supposed score lies over a real one and never touches stored grades'],
      ['app/src/lib/returned.test.ts', 'days left to query a returned grade, with no opinion on the mark'],
      ['docs/ai-toolkit/RUBRIC-AND-AI-USE-POLICY.md', 'the rubric self-check and layered AI-use policy'],
    ],
    gap: 'No organizer for instructor feedback, no revision plan from it, no office-hours agenda (only the advisor one), and the what-if says “supposed” rather than “estimated”.',
    master: [],
    areas: [],
  },
  {
    title: 'Research, project and team-workspace layer',
    group: 'academic',
    why: 'Valuable with native LMS features, and still compatible with an external LMS workflow.',
    capabilities: [
      no('Project charter'),
      'Role definitions (template stages)',
      'Accessible action board (shared checklist)',
      no('Source library shared across the team'),
      'Meeting agenda (template stage)',
      no('Decision log'),
      no('Peer feedback templates'),
      no('Version history shared across the team'),
      'Evidence and portfolio export',
      'Institutional data-classification prompt',
      'Academic-integrity and AI-use disclosure',
      no('Team closure and reflection'),
    ],
    boundary: 'Do not turn peer evaluation into an opaque reputation score; instructors choose whether and how any assessed peer review is enabled.',
    status: 'tested',
    evidence: [
      ['app/src/lib/groupwork.test.ts', 'a shared checklist with claimed and unclaimed parts; the per-person view sorts by name, not output'],
      ['supabase/groups.check.sql', 'row-level security for group rooms and shared parts'],
      ['app/src/lib/toolkit/templates.ts', 'group-project stages: scope, roles, milestones, agenda, contribution log, peer review, integration'],
      ['app/src/lib/toolkit/classification.test.ts', 'unclassified material is T3 and kept out of AI, share and export'],
      ['app/src/lib/toolkit/disclosure.test.ts', 'a student-written AI-use declaration naming the kind of material, never its contents'],
    ],
    gap: 'No charter, decision log, peer-feedback templates, reflection, shared source library or shared version history; the template stages are individual notes.',
    master: [],
    areas: ['RES'],
  },
  // ── Career and lifelong-value services ───────────────────────────────────
  {
    title: 'Skills evidence and learner-owned record',
    group: 'career',
    why: 'Coursework, projects, employment, service, leadership, research and credentials become understandable, portable evidence the student owns.',
    capabilities: [
      'Skill or competency → evidence artifact',
      no('Student reflection on the artifact'),
      'Optional faculty, advisor or issuer verification',
      no('Criterion and issue date on a verified record'),
      'Private learner record',
      'Student-controlled sharing (employer opt-in)',
      'Resume, portfolio or application export',
      no('Optional verifiable badge or credential (Open Badges, CLR, CASE)'),
    ],
    boundary: 'Distinguish self-claimed skill, reflection, verified participation, verified contribution, assessed competency and issuer credential; never treat attendance or a self-description as a validated skill.',
    status: 'tested',
    evidence: [
      ['supabase/migrations/20260926150000_expansion_roles_and_features.sql', 'skill_records: self-reported → verification requested → verified or declined, scoped to skill:verify; talent_profiles opt-in that expires'],
      ['supabase/expansion.check.sql', 'the verifier policies and the opt-in, in SQL'],
      ['supabase/migrations/20260923211000_evidence_graphs.sql', 'skill_claim with evidence references'],
      ['app/src/lib/skills-graph.test.ts', 'skills suggested from courses, projects, work and organizations, with evidence links and a stale flag'],
      ['app/src/lib/career-evidence.test.ts', 'the student confirms or rejects skills; an artifact must cite a course or experience'],
      ['docs/CREDENTIAL-WALLET.md', 'private by default, share and revoke, sensitive classes out; then Open Badges and CLR — none built'],
    ],
    gap: 'No reflection, criterion or issue date, named-recipient share, issuer revocation or standards export; the states do not separate participation, contribution, competency and credential.',
    master: ['UOS-004', 'UOS-007', 'LMS-015'],
    areas: ['CRD', 'PRF', 'EVG'],
  },
  {
    title: 'Career exploration laboratory',
    group: 'career',
    why: 'Turn “what could I do?” into questions, evidence and appointments rather than a verdict.',
    capabilities: [
      no('Role and industry exploration'),
      'Skills-gap map, explainable and editable',
      no('Portfolio readiness checklist'),
      no('Informational-interview preparation'),
      'Alumni mentor matching',
      no('Employer office hours'),
      'Job and internship opportunity tracker',
      'Interview practice',
      no('Offer-comparison worksheet'),
      'Graduate-school planning (tracker)',
      'Application calendar',
      'Career-center handoff',
    ],
    boundary: 'Never score an individual’s employability or sell student academic data to employers; the student chooses whether to create a profile or share an artifact.',
    status: 'tested',
    evidence: [
      ['app/src/screens/career.test.tsx', 'self-entered opportunities, experiences, contacts with permission recorded, resume and cover-letter scaffolds, interview practice'],
      ['app/src/lib/skills-graph.test.ts', 'explainFit and missingSkillPlan: an explainable gap per opportunity'],
      ['app/src/lib/apply.test.ts', 'a job, internship and grad-school tracker with stages, no probability or fit score, fed to the deadline calendar'],
      ['app/src/lib/mentors.test.ts', 'peer and alumni mentors matched only on ticked topics'],
      ['app/src/lib/help-routes.test.ts', 'a request to the career center after a preview'],
    ],
    gap: 'No role explorer, portfolio-readiness checklist, informational-interview prep, employer office hours or offer comparison; and no written rule against employability scoring — the ordering score in career.ts is never displayed, but nothing forbids displaying one.',
    master: ['UOS-004'],
    areas: ['EVG'],
  },
  {
    title: 'Micro-experience marketplace',
    group: 'career',
    why: 'Institution-approved, well-described opportunities: research, faculty projects, micro-internships, consulting, service, startups, competitions, tutoring, leadership, workshops, alumni projects.',
    capabilities: [
      'Institution-approved listings, moderated before publication',
      'Deadline and eligibility, in the office’s own words',
      no('Compensation disclosed on every listing'),
      no('Time commitment disclosed'),
      no('Supervisor or owner disclosed'),
      no('Accessibility accommodation contact'),
      'Source verification (https, publisher scope)',
      no('Learning and career value stated'),
      no('The listing kinds: faculty projects, micro-internships, campus consulting, competitions, peer tutoring, alumni projects'),
    ],
    boundary: 'Eligibility is shown as the office wrote it and never evaluated; the publisher cannot self-publish.',
    status: 'tested',
    evidence: [
      ['supabase/migrations/20260926150000_expansion_roles_and_features.sql', 'opportunities: job, internship, scholarship, deal, program, housing; draft → pending review → published'],
      ['supabase/listings.check.sql', 'the publisher cannot self-publish; a student sees only published listings at their school'],
      ['app/src/lib/listings.test.ts', 'eligibility shown as written and never judged; https only'],
      ['app/src/lib/journey.guards.test.ts', 'the student-side tracker with office-ordered checklists, hours per week and a time budget'],
      ['app/src/screens/Opportunities.tsx', 'the Opportunities screen'],
    ],
    gap: 'A listing has no required compensation, time, supervisor, accessibility contact or learning-value field, and the kinds stop at job, internship, scholarship, deal, program and housing.',
    master: ['UOS-005'],
    areas: [],
  },
  {
    title: 'Alumni lifelong-access layer',
    group: 'career',
    why: 'After graduation Semester can remain useful without retaining data indefinitely or turning alumni into a marketing audience by default.',
    capabilities: [
      no('Portable credentials and project archive'),
      'Alumni mentoring',
      no('Career and job resources for alumni'),
      no('Continuing-education discovery'),
      no('Professional community groups'),
      no('Transcript and official-record handoff'),
      no('Portfolio maintenance after graduation'),
      'Data-export and account-transition tools',
    ],
    boundary: 'No indefinite retention and no marketing audience by default; an alumnus keeps what they chose to keep.',
    status: 'tested',
    evidence: [
      ['supabase/mentor-rosters.check.sql', 'alumni mentor offers and requests needing consent from both sides'],
      ['app/src/components/MentorFinder.test.tsx', 'finding and requesting a peer or alumni mentor'],
      ['supabase/migrations/20260929010000_account_erasure_and_export.sql', 'export_my_data() and erase_account, recorded in data_requests'],
      ['app/src/lib/erasure.test.ts', 'export and erasure held to the same data map'],
      ['docs/CAREER-PORTABILITY-AND-LIFELONG-ACCESS.md', 'alumni_transitions and portfolio visibility, not built'],
    ],
    gap: 'Nothing moves a graduating student into an alumni account or keeps access after the institutional login ends; no archive with a manifest, no credential carry-over, no transcript handoff.',
    master: ['LEG-004'],
    areas: ['PRF', 'CRD'],
  },
  // ── Institutional services ───────────────────────────────────────────────
  {
    title: 'Student-service content operations',
    group: 'institutional',
    why: 'Most institutions have good resources but poor discoverability and stale pages; a governed publishing system improves the experience without a SIS replacement.',
    capabilities: [
      'Content owner',
      'Audience (approved roles, terms, eligibility the student chose)',
      'Eligibility, in the office’s words',
      'Official source',
      'Review date',
      'Expiry date',
      no('Accessibility checklist per item'),
      no('Translations'),
      no('Related workflows'),
      no('Search keywords'),
      no('Usage and failed-search insights'),
      no('Broken-link alerts'),
      no('Student feedback per item'),
      'Approval and version history (office actions; Course Studio)',
    ],
    boundary: 'A second person approves; nothing publishes with no source, no owner or a plain-http link.',
    status: 'tested',
    evidence: [
      ['supabase/migrations/20260928302000_office_action_feed.sql', 'an office action needs an office, an https official link, a source note and an updated_at; draft → review → published, a second person approving'],
      ['supabase/officeactions.check.sql', 'office scope, second-person approval and the required fields'],
      ['app/src/lib/office-actions.test.ts', 'incomplete rows refused; the audience named; expires a day after its date'],
      ['app/src/lib/launch/content.test.ts', 'thirteen institutional content kinds, each with source type, owner, review interval, visibility, expiry and correction route'],
      ['docs/FIELD-LINEAGE-AND-SOURCE-FRESHNESS.md', 'lineage and freshness per field, planned'],
    ],
    gap: 'Governed publishing exists for office actions and launch content, not for general office pages: no accessibility checklist, translations, keywords, failed-search or broken-link signals, or per-item feedback.',
    master: ['TRUST-002', 'UOS-001'],
    areas: ['CGV', 'DQC'],
  },
  {
    title: 'Campus process builder',
    group: 'institutional',
    why: 'Authorized offices configure safe, clear workflows — tutoring request, library consultation, career coaching, scholarship checklist — that route and prepare, never decide.',
    capabilities: [
      'Appointment or help request, previewed and sent by the student',
      no('Document checklist an office configures'),
      'Referral (student-initiated, to a named destination)',
      no('Service intake form an office configures'),
      'Status tracker (help request statuses)',
      no('Reminder step'),
      'Handoff to the official system',
      no('Escalation step'),
      'Closure (withdraw, answer)',
      no('Feedback step'),
      no('An office configuring any of the above without code'),
    ],
    boundary: 'Route and prepare — never determine eligibility or make an official decision; nobody is referred automatically.',
    status: 'tested',
    evidence: [
      ['supabase/migrations/20260927230000_help_requests.sql', 'send_help_request: the student’s own previewed request to an office; staff read it through an inbox and a logged open'],
      ['supabase/help-requests.check.sql', 'the request and inbox refusals'],
      ['app/src/lib/help-routes.test.ts', 'need → question → preview → send or withdraw; nobody referred automatically'],
      ['packages/institution/src/workflow.test.ts', 'fixed state machines: assessment submission, support access, data deletion, grade passback'],
      ['app/src/components/OfficeActionFeed.test.tsx', 'submit, approve, return, withdraw on the office side'],
    ],
    gap: 'Every flow is hard-coded; nothing lets an office configure steps, checklists, intake, reminders, escalation or feedback.',
    master: ['STU-012', 'SUP-001'],
    areas: ['SVC'],
  },
  {
    title: 'Institutional communications orchestration',
    group: 'institutional',
    why: 'Every communication answers: who sent this, why am I receiving it, what action is needed, where is the official source, how do I change preferences.',
    capabilities: [
      'Verified office announcements',
      'Audience segmentation by approved roles and terms, never inferred behaviour',
      'Student notification preferences (mute, quiet hours, digests)',
      no('Accessibility-compliant message templates'),
      no('Multi-channel delivery (email, SMS)'),
      no('Message scheduling'),
      no('Delivery and action metrics'),
      no('Duplicate-message suppression across offices'),
      no('Emergency communications handoff'),
      'Archive and expiry controls (a notice expires a day after its date)',
    ],
    boundary: 'No source, no message: a message with no source or sponsored content is dropped, and Required is only for a current official message.',
    status: 'tested',
    evidence: [
      ['app/src/lib/journey.guards.test.ts', 'admit drops messages with no source and sponsored content; Required only for current official messages; quiet hours hold only optional ones'],
      ['app/src/lib/official-notices.test.ts', 'school records become official messages with freshness and source, downgraded when stale'],
      ['app/src/lib/office-actions.test.ts', 'whyYouSee: the audience came from the student’s own choice'],
      ['app/src/lib/push.test.ts', 'web push from a queue'],
      ['app/src/screens/Hub.tsx', 'the Notices hub: Official, Courses and Semester channels'],
    ],
    gap: 'No announcement composer for offices, no templates, no email or SMS, no scheduling, no metrics, no duplicate suppression, no emergency handoff.',
    master: ['STU-002'],
    areas: [],
  },
  {
    title: 'Service design intelligence',
    group: 'institutional',
    why: 'Offices get aggregate, privacy-protected visibility into friction without any monitoring of individual students.',
    capabilities: [
      no('Most-searched unanswered questions'),
      no('Common failed handoffs'),
      no('Stale information'),
      no('Broken links'),
      'Appointment and course demand patterns (consented, at ten or more)',
      no('Accessibility barriers reported'),
      no('Resource discovery gaps'),
      no('Repeated service-navigation issues'),
      'Small-cell suppression',
    ],
    boundary: 'Never a per-student grain; every aggregate a university reads is suppressed below ten, and the next-smallest cell beside a published total is suppressed too.',
    status: 'tested',
    evidence: [
      ['app/src/lib/institution-ops.test.ts', 'MIN_COHORT ten, complementary suppression, question themes without ids, forbidden per-student metrics'],
      ['app/src/lib/cohortfloor.test.ts', 'the app floor equals every SQL floor in the migrations'],
      ['app/src/lib/course-demand.test.ts', 'demand from consenting students, published only at ten or more'],
      ['supabase/demand.check.sql', 'staff read counts in their own scope, never a person'],
      ['docs/PRODUCT-ANALYTICS-DATA-ETHICS.md', 'what is measured and what is promised never to be'],
    ],
    gap: 'No telemetry for failed searches, failed handoffs, stale pages, broken links or reported barriers; workflow_friction is a definition with no data source.',
    master: ['UOS-008'],
    areas: ['PPA'],
  },
  // ── Platform and trust services ──────────────────────────────────────────
  {
    title: 'Consent and data-agency center',
    group: 'platform-trust',
    why: 'A visual control center where every control says what changes, who loses or gains access, what remains due to retention, and how to reverse or appeal it.',
    capabilities: [
      'Connected accounts',
      'Data categories and what AI may not use',
      'Active shares, revocable after saying what happens',
      no('Mentorship and club visibility controls'),
      'Employer and alumni profile visibility (opt-in)',
      'AI settings and history (delete conversations)',
      'Notification settings',
      'Exports',
      'Deletion requests',
      no('Support-access history on screen'),
      no('Consent and policy history on screen'),
      no('Each control stating what changes, who gains or loses, what retention keeps, how to reverse or appeal'),
    ],
    boundary: 'Every control is the student’s; nothing here reads what a student did to decide what to show them.',
    status: 'tested',
    evidence: [
      ['app/src/components/TrustCenter.test.tsx', 'what is connected, what the labels mean and what AI may not use; a share revoked only after saying what happens; conversations deleted after a confirm; export one tap away'],
      ['app/src/components/DataRightsRequests.test.tsx', 'a signed-in student files and tracks formal access, correction, restriction and assisted-erasure requests'],
      ['app/src/lib/privacy.test.ts', 'the privacy claims are checked data, and whatDeletionLeaves() says what survives'],
      ['app/src/lib/deleteaccount.test.ts', 'delete-account with an authenticated token only'],
      ['supabase/support-access.check.sql', 'support access granted by the student, time-boxed and audited'],
      ['docs/DATA-RIGHTS-REQUEST-RUNBOOK.md', 'daily handling, escalation, evidence and quarterly rehearsal procedure'],
    ],
    gap: 'No screen shows consent or policy history or support-access history, the staff handling surface is not built, and not every control states in a structured way who gains or loses access and how to reverse it.',
    master: ['STU-011', 'UOS-007', 'IAM-010'],
    areas: ['DQC'],
  },
  {
    title: 'Source freshness and institutional verification network',
    group: 'platform-trust',
    why: 'Semester’s signature institutional capability: not simply showing content, but ensuring students can rely on it.',
    capabilities: [
      'Source owner (per content kind and per connection)',
      'Verification date (source labels; freshness on notices)',
      'Review cycle (per content kind and per connection)',
      'Expiry date',
      no('Change history per resource'),
      no('Linked workflows'),
      no('Student-reported issue queue per resource'),
      no('Accessibility status'),
      no('Language availability'),
      no('Usage and search demand'),
    ],
    boundary: 'Five source labels, the same five the database enforces; nothing says “verified” unless the institution’s own system did.',
    status: 'tested',
    evidence: [
      ['app/src/lib/launch/content.test.ts', 'each content kind has a source type, steward owner, review interval, visibility, expiry and correction route'],
      ['supabase/integration-quality.check.sql', 'an owner, a backup owner and a review cadence per connection'],
      ['app/src/lib/source.test.ts', 'the five source labels held to the database constraint'],
      ['app/src/lib/official-notices.test.ts', 'freshness text and a stale item that cannot claim Required'],
      ['app/src/lib/governance/data-contracts.test.ts', 'owner, steward, freshness and correction per domain, unstaffed until named'],
      ['docs/FIELD-LINEAGE-AND-SOURCE-FRESHNESS.md', 'source_records, snapshots and freshness events, planned'],
    ],
    gap: 'Ownership and review cadence exist per content kind and per connection, not per resource; campus links are hard-coded; no change history, issue queue, accessibility or language status per resource.',
    master: ['TRUST-001', 'TRUST-002'],
    areas: ['CGV', 'DQC'],
  },
  {
    title: 'Safe AI workspace for institutions',
    group: 'platform-trust',
    why: 'AI policy needs to be understandable at the moment students act — not hidden in a PDF.',
    capabilities: [
      'Approved AI tools and modes per tenant',
      'Source restrictions (approved sources; course sources only)',
      'Course-specific instructions (course AI rules)',
      'Student-facing policy display (assignment → course → school → university)',
      no('Citation and attribution expectations as a setting'),
      no('Human-review requirements as a setting'),
      'Data-retention settings per tenant',
      'Prompt and output safeguards (kill switch; classification)',
      no('Feedback and incident reporting that reaches an owner'),
      'Usage transparency (what each answer used)',
    ],
    boundary: 'No autonomous or consequential decision about a student, refused at intake; the matrix and checklist are docs/operating-model/AI-ASSURANCE.md.',
    status: 'tested',
    evidence: [
      ['supabase/intelligence-policy.check.sql', 'ai_policy: allowed modes and providers, course sources only, web allowed, retention days, policy version; approved_source per course'],
      ['app/src/lib/coursestudio.test.ts', 'faculty publish per-course AI rules for ten uses, versioned and append-only'],
      ['app/src/lib/toolkit/policy.test.ts', 'policy resolves assignment → course → school → university; unknown is not allowed'],
      ['app/src/lib/aikillswitch.test.ts', 'the global and per-tenant switch fails closed'],
      ['app/src/lib/governance/ai-lifecycle.test.ts', 'gates in order; consequential scopes refused at intake'],
      ['app/src/intelligence/Disclosure.test.tsx', 'each answer shows what it used'],
    ],
    gap: 'The claude edge function enforces neither ai_policy nor course_ai_rules nor the tenant switch row; no admin authoring screen; no citation or human-review setting; no report that reaches an owner.',
    master: ['AI-001', 'AI-006', 'AI-012', 'AI-013'],
    areas: [],
  },
  {
    title: 'Accessibility quality-assurance service',
    group: 'platform-trust',
    why: 'A continuous operational service, not a one-time VPAT document.',
    capabilities: [
      'Automated accessibility checks',
      no('Manual assistive-technology testing, completed'),
      no('Accessibility issue tracker'),
      no('Remediation workflow'),
      no('Accessible-content authoring guidance'),
      'Release accessibility gate (definition of ready and done)',
      no('Current ACR or VPAT materials'),
      'Student feedback route (a support-ticket category)',
      no('Quarterly accessibility quality report'),
    ],
    boundary: 'No certification claim: Semester has no ACR, and says so.',
    status: 'tested',
    evidence: [
      ['app/src/a11y/axe.test.tsx', 'axe-core over the rendered app, beside label, landmark, focus, motion and title guards'],
      ['app/scripts/accessibility-smoke.mjs', 'the browser smoke CI runs'],
      ['app/src/lib/governance/quality-gates.test.ts', 'accessibility criteria in the definition of ready and done; defect aging a metric'],
      ['docs/accessibility/AT-PASS-PROTOCOL.md', 'the manual screen-reader protocol, not yet done'],
      ['docs/operating-model/ACCESSIBILITY-GOVERNANCE.md', 'champions, a severity backlog and a paid assistive-tech panel, no members'],
      ['docs/trust/HECVAT-VPAT-PLAN.md', 'the ninety-day plan for an ACR; none exists'],
    ],
    gap: 'Beyond the automated checks nothing runs: no tracker, no remediation workflow, no completed manual pass, no ACR, no quarterly report.',
    master: [],
    areas: ['WFA'],
  },
  // ── Commercial and ecosystem services ────────────────────────────────────
  {
    title: 'Implementation academy',
    group: 'commercial',
    why: 'Lowers implementation risk and gives institutions a reason to choose Semester over a tool that requires them to invent their own operating model.',
    capabilities: [
      'Administrator onboarding (in progress)',
      no('Student-affairs playbooks'),
      no('Faculty and advisor enablement, delivered'),
      no('Accessibility and AI governance training'),
      no('Integration certification'),
      no('Office-hours clinics'),
      'Launch communications kit',
      'Pilot measurement guide',
      no('Annual maturity review, institution-facing'),
    ],
    boundary: 'Training and communications finish before a cohort launches; the ninety-day program refuses a launch marked done ahead of its prerequisites.',
    status: 'tested',
    evidence: [
      ['app/src/lib/launch/content.test.ts', 'the launch package: seventeen guides with status; faculty and advisor quick-starts not started'],
      ['app/src/lib/launch/ninety-day.test.ts', 'owned, ordered actions; training and communications before the cohort launches'],
      ['docs/launch/ANNOUNCEMENT-TEMPLATES.md', 'the campus announcement kit'],
      ['docs/operating-model/CHANGE-MANAGEMENT.md', 'the institutional change path; training tracking marked designed'],
      ['docs/FACULTY-ENABLEMENT.md', 'the faculty plan, almost none of it built'],
    ],
    gap: 'No curriculum, no training tracking, no certification program, no clinics, no playbooks, no institution maturity review; what exists is checklists, templates and plans.',
    master: ['IMP-001', 'SUP-003'],
    areas: ['KNW', 'CNL'],
  },
  {
    title: 'Campus innovation lab',
    group: 'commercial',
    why: 'A paid or strategically subsidized design partnership creates trusted relationships before a full enterprise commitment.',
    capabilities: [
      no('Journey mapping'),
      'Student, faculty and staff research cadence',
      no('Accessibility review as part of the partnership'),
      no('Service-directory cleanup'),
      no('AI governance workshop'),
      'Pilot design (readiness, baselines, sponsor, champion, data plan)',
      'Success metrics with baselines',
      no('Implementation plan template'),
      no('Executive readout'),
    ],
    boundary: 'A pilot is not a free trial: three to five metrics with baselines, a sponsor, a champion and a signed conversion decision.',
    status: 'building',
    evidence: [
      ['app/src/lib/gtm/pilot.test.ts', 'pilotReadiness needs a baseline per metric, a sponsor, a champion and a data plan; the verdict needs a signed decision'],
      ['docs/operating-model/RESEARCH-AND-SERVICE-DESIGN.md', 'interviews, workflow maps, an assistive-tech review, a usability benchmark and a trust survey — owned roles, no staff'],
      ['docs/trust/PILOT-AGREEMENT-OUTLINE.md', 'the pilot agreement’s sections and scorecard'],
      ['PILOT.md', 'the student pilot: owner, cohort, consent, end conditions'],
      ['docs/INSTITUTIONAL-GTM-PLAYBOOK.md', 'the buying committee and stages'],
    ],
    gap: 'No packaged design-partnership offering: no journey-mapping method, directory cleanup, workshop kit, plan template or executive readout; only pilot mechanics and a research cadence.',
    master: ['COM-002'],
    areas: ['CNL', 'OUT'],
  },
  {
    title: 'Interoperability marketplace',
    group: 'commercial',
    why: 'A curated connector ecosystem where each listing shows data direction, scope, permissions, freshness, version, certification, limitations, owner, health and how to disconnect.',
    capabilities: [
      'Connector catalog: LMS, SIS, identity, calendar, library, career, events and more',
      'Data direction and scope per student-connectable account',
      'Freshness and sync class per domain',
      'Certification only with dated, person-verified evidence',
      'Health status on a staff dashboard',
      no('Fields and scope, version, limitations, setup guide, owner and disconnect process on one listing'),
      no('Room reservations, credential providers, payments and accessibility tools as domains'),
      no('Third-party connectors, and the governance for admitting one'),
    ],
    boundary: 'A do-not-ingest list per provider; a matched record is a count, never a discrepancy row with a person in it.',
    status: 'tested',
    evidence: [
      ['supabase/functions/_shared/integration/catalog.ts', 'twenty-one provider domains with canonical entities, freshness, sync classes and a do-not-ingest list'],
      ['app/src/lib/integration/quality.test.ts', 'the maturity ladder; “certified” only with dated, person-verified evidence that lapses'],
      ['app/src/components/institutional/IntegrationDashboard.test.tsx', 'every domain with status and health; pausing needs a reason'],
      ['app/src/lib/connect.scopes.test.ts', 'each account says what it reads and writes'],
      ['supabase/integration-control-plane.check.sql', 'connections and source records under tenant RLS'],
      ['docs/EXTENSION-ECOSYSTEM-GOVERNANCE.md', 'third-party extension governance, none of it existing'],
    ],
    gap: 'No listing surface combining scope, version, limitations, setup guide, owner, health and disconnect; no third-party connectors; four domains missing.',
    master: ['INT-001', 'INT-014'],
    areas: ['IOP', 'VND'],
  },
  {
    title: 'Open benchmark and research program',
    group: 'commercial',
    why: 'Makes Semester a category-defining authority rather than only a vendor.',
    capabilities: [
      no('Academic Friction Index'),
      no('Student digital access and accessibility benchmark'),
      no('AI policy clarity benchmark'),
      no('Campus resource discoverability report'),
      no('Interoperability maturity model'),
      no('Student data-agency benchmark'),
      'A minimum cell size on every aggregate',
    ],
    boundary: 'Never rank institutions using private operational data without express agreement; publish methodology, consent, aggregation and limitations.',
    status: 'designed',
    evidence: [
      ['app/src/lib/expansionregister.ts', 'BEN: the benchmark programme designed with no methodology; OUT: no research protocol'],
      ['docs/operating-model/DEFENSIBILITY.md', 'benchmarks only from aggregated, consented, privacy-preserving outcomes with a minimum cell size'],
      ['docs/PRODUCT-ANALYTICS-DATA-ETHICS.md', 'what is measured and what is promised never to be'],
      ['app/src/lib/cohortfloor.test.ts', 'the floor of ten in the app and in every migration'],
    ],
    gap: 'None of the six benchmarks exists, there is no methodology or data-sharing agreement, and no written rule against ranking institutions on private data beyond the cell-size floor.',
    master: [],
    areas: ['BEN', 'OUT'],
  },
];

export const MODULES: readonly Module[] = ROWS.map((r, i) => ({
  ...r,
  id: `S${String(i + 1).padStart(2, '0')}`,
  capabilities: r.capabilities.map(cap),
  evidence: r.evidence.map(([path, shows]) => ({ path, shows })),
}));

export const moduleOf = (id: string): Module => MODULES.find((m) => m.id === id)!;

/** How many of a module's capabilities have something in the tree. */
export const present = (m: Module): number => m.capabilities.filter((c) => c.have).length;

// ── What to evaluate next: score every proposed service before adding it ─────

export const EVALUATION: readonly { question: string; why: string }[] = [
  { question: 'What concrete student or institutional friction does this remove?', why: 'Prevents feature accumulation' },
  { question: 'Who is the accountable owner?', why: 'Prevents ungoverned modules' },
  { question: 'What remains officially decided elsewhere?', why: 'Protects institutional authority' },
  { question: 'What data is necessary, optional, sensitive, or prohibited?', why: 'Preserves privacy and trust' },
  { question: 'What are the accessibility requirements?', why: 'Makes inclusion foundational' },
  { question: 'What could go wrong or be abused?', why: 'Forces safety design early' },
  { question: 'What is the human escalation path?', why: 'Avoids false automation' },
  { question: 'How does a user correct, export, delete, revoke, or recover?', why: 'Builds student agency' },
  { question: 'What evidence will prove value?', why: 'Avoids vanity metrics' },
  { question: 'Can this be built through standards and integration rather than replacement?', why: 'Reduces implementation cost and lock-in' },
  { question: 'Does this increase or reduce operational burden?', why: 'Protects scale and margins' },
  { question: 'Is it a short-term feature or a defensible platform capability?', why: 'Keeps the plan strategic' },
];

// ── The strategic sequence ───────────────────────────────────────────────────

export const SEQUENCE: readonly { rank: number; what: string; why: string; modules: readonly string[] }[] = [
  { rank: 1, what: 'Transfer and life-transition hub', why: 'A natural, differentiated wedge for Semester.', modules: ['S02', 'S03', 'S04', 'S05'] },
  { rank: 2, what: 'Basic-needs and student-service navigator', why: 'High student value with clear institutional ownership.', modules: ['S01'] },
  { rank: 3, what: 'Accessibility and learning-strategy studio', why: 'A defensible core product strength.', modules: ['S07'] },
  { rank: 4, what: 'Library and research navigator, and feedback literacy', why: 'Connects learning to expert human support.', modules: ['S08', 'S09'] },
  { rank: 5, what: 'Student-service content operations', why: 'Improves campus information quality and discoverability.', modules: ['S15', 'S20'] },
  { rank: 6, what: 'Skills evidence, portfolio and learner-owned record', why: 'Connects university life to career value.', modules: ['S11', 'S12'] },
  { rank: 7, what: 'Implementation academy and interoperability marketplace', why: 'Reduces institutional buying and adoption risk.', modules: ['S23', 'S25'] },
  { rank: 8, what: 'Open research and benchmark program', why: 'Makes Semester a category-defining authority rather than only a vendor.', modules: ['S26'] },
];

/** The second document's delivery order for its four modules and their governance. */
export const DELIVERY_ORDER: readonly string[] = [
  'Transfer Hub MVP: verified timeline, official-resource directory, questions and document checklist, advisor agenda, first-term dashboard, transfer peer and community discovery.',
  'Basic-Needs Navigator MVP: resource directory, source, owner and freshness model, private save and checklist, official handoff, accessibility and language metadata, broken-link reporting.',
  'Safe AI foundation: policy engine, source, scope and status UX, approved retrieval, no-write-by-default, audit and feedback, human routing.',
  'Career Evidence MVP: opportunity tracker, private project and evidence workspace, resume and portfolio export, career-center handoff.',
  'Institutional governance: council, policies, data inventory, content operations, risk register, launch gates and recurring evidence review.',
  'Advanced expansion: peer mentoring, verified contribution records, alumni and employer opt-in network, portable credentials, institution-approved workflow automation.',
];

// ── Career OS: what Semester does, and does not ──────────────────────────────

export const CAREER_OS: readonly { capability: string; does: string; doesNot: string }[] = [
  { capability: 'Career exploration', does: 'Maps roles, industries, pathways, skills and questions to explore', doesNot: 'Declare a career “best” for a student' },
  { capability: 'Skills evidence map', does: 'Connects coursework, projects, clubs, work, research and service to student-selected skills', doesNot: 'Infer hidden traits or rank students' },
  { capability: 'Portfolio builder', does: 'Organizes artifacts, contribution statements, reflections and links', doesNot: 'Publish work without student approval' },
  { capability: 'Opportunity tracker', does: 'Tracks internships, jobs, research, fellowships, events and deadlines', doesNot: 'Guarantee job outcomes or hide compensation' },
  { capability: 'Application workspace', does: 'Resume tailoring, cover-letter drafting, interview practice, action calendar', doesNot: 'Submit applications automatically without review' },
  { capability: 'Mentor and alumni tools', does: 'Helps students request informational conversations and prepare agendas', doesNot: 'Expose academic records to alumni or employers' },
  { capability: 'Credential wallet', does: 'Stores and exports eligible verified achievements and evidence', doesNot: 'Treat a badge as proof of competence without stated criteria' },
  { capability: 'Career-center routing', does: 'Finds appointments, workshops, official services and accessibility support', doesNot: 'Replace career professionals' },
];

/** A skills record distinguishes these, in this order, so attendance or a self-description is never a validated skill. */
export const EVIDENCE_LADDER: readonly string[] = [
  'Self-claimed skill',
  'Student reflection',
  'Verified participation',
  'Verified contribution',
  'Assessed competency',
  'Issuer credential',
];

/** What an employer never receives, whatever it pays for. */
export const EMPLOYER_NEVER: readonly string[] = [
  'Student grades',
  'Course performance',
  'Accommodation information',
  'Mental-health or basic-needs information',
  'Private club or mentorship activity',
  'Hidden engagement scores',
  'AI conversation history',
  'Unapproved student data exports',
];
