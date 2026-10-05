/**
 * The benchmark register: the strategy brief's six public commitments and
 * twenty-five initiatives — the personal academic operating system, the
 * explain panel, the importer, document intelligence, the options planner,
 * the support-network map, AI quality controls, teach-back, instructor AI
 * spaces, accessibility as a feature, accessibility authoring, the
 * orchestration layer, no wrong door, the content quality score, portability,
 * the policy simulator, the synthetic tenant, the Semester Standard, the
 * product quality report, the navigation index, the trust score, control-plane
 * simulation, the customer trust dashboard, the owned vocabulary and the
 * annual event — each broken into the brief's own checkable items and each
 * item marked with what the tree holds.
 *
 * The same three rules as the maturity register: an item that claims to
 * exist cites a file and the file exists; each commitment opens with the
 * stance it is held to; the count is the finding. And one more, from the
 * brief itself: "do not build the appearance of leadership; build evidence
 * that makes leadership obvious" — so an `in-place` here is never a page
 * that describes a thing, only the thing.
 *
 * `docs/operating-model/BENCHMARK.md` is rendered from this file by
 * `benchmark.test.ts`; edit the data, then `npm run registers` from app/.
 */

export const COMMITMENTS = {
  student: 'The clearest student experience',
  transparent: 'The most transparent data and AI experience',
  accessible: 'The most accessible learning platform',
  interoperable: 'The most interoperable university platform',
  reliable: 'The most operationally reliable academic platform',
  accountable: 'The most accountable edtech company',
} as const;

export type Commitment = keyof typeof COMMITMENTS;

export const STANCES: Record<Commitment, string> = {
  student: 'Students always know what matters next, and every recommendation is explainable; the app is calm and essential, never noisy, addictive or surveillance-driven.',
  transparent: 'Every fact has a source, every estimate is honest, every share is controlled, and every AI action is governed and inspectable.',
  accessible: 'Every accessibility need is treated as ordinary product quality, visible everywhere, never hidden in settings.',
  interoperable: 'Every integration is observable, every institution retains authority, and interoperability is a customer right rather than an upsell.',
  reliable: 'Every operational promise has evidence, every staff member sees only what they need, and a change is simulated before it is made.',
  accountable: 'Every public claim has evidence, every gap is disclosed where the claim is, and the standard is operationalised before it is marketed.',
};

export interface Initiative {
  n: number;
  commitment: Commitment;
  title: string;
}

export const INITIATIVES: readonly Initiative[] = [
  { n: 1, commitment: 'student', title: 'Personal academic operating system' },
  { n: 2, commitment: 'student', title: 'Universal “one-click clarity” layer' },
  { n: 3, commitment: 'student', title: '“Bring your whole academic life” importer' },
  { n: 4, commitment: 'student', title: 'Document intelligence with human review' },
  { n: 5, commitment: 'student', title: '“Explain my options” planner' },
  { n: 6, commitment: 'student', title: 'A student “support network” map' },
  { n: 7, commitment: 'transparent', title: 'AI confidence and quality controls visible to users' },
  { n: 8, commitment: 'student', title: '“Teach-back” and metacognition mode' },
  { n: 9, commitment: 'transparent', title: 'Instructor-controlled AI learning spaces' },
  { n: 10, commitment: 'accessible', title: 'Accessibility as a visible product feature' },
  { n: 11, commitment: 'accessible', title: 'Accessibility authoring intelligence' },
  { n: 12, commitment: 'interoperable', title: 'Student experience orchestration layer' },
  { n: 13, commitment: 'student', title: '“No wrong door” support experience' },
  { n: 14, commitment: 'interoperable', title: 'Institutional content quality score' },
  { n: 15, commitment: 'interoperable', title: 'Open data and portability architecture' },
  { n: 16, commitment: 'reliable', title: 'Policy simulator' },
  { n: 17, commitment: 'reliable', title: 'Synthetic data and digital-twin environment' },
  { n: 18, commitment: 'accountable', title: 'Public “Semester Standard”' },
  { n: 19, commitment: 'accountable', title: 'Open product quality report' },
  { n: 20, commitment: 'accountable', title: 'Academic navigation index' },
  { n: 21, commitment: 'reliable', title: '“Trust score” for internal operations, not students' },
  { n: 22, commitment: 'reliable', title: 'Control-plane simulation' },
  { n: 23, commitment: 'accountable', title: 'Customer trust dashboard' },
  { n: 24, commitment: 'accountable', title: 'Own the language' },
  { n: 25, commitment: 'accountable', title: 'An annual flagship event' },
];

export type ItemStatus = 'in-place' | 'partial' | 'owed';

export interface Item {
  id: string;
  initiative: number;
  /** The item, in the brief's words. */
  item: string;
  status: ItemStatus;
  evidence: string | null;
  note: string;
}

const i = (id: string, initiative: number, item: string, status: ItemStatus, evidence: string | null, note: string): Item => ({ id, initiative, item, status, evidence, note });

export const ITEMS: readonly Item[] = [
  // 1 Personal academic operating system
  i('B01-1', 1, 'Morning: today briefing, what changed, next class, deadlines, study prompt, schedule balance.', 'in-place', 'app/src/lib/since.ts', 'Today leads with one next step; “since you last opened” lists what changed with source and freshness; balance and crunch-week are modules.'),
  i('B01-2', 1, 'During the day: course context, assignment work, study support, Ask Semester, meeting prep, quick capture.', 'in-place', 'app/src/ai/shape.ts', 'Every screen hands the assistant what it is showing; courses, study, advising prep and capture are screens.'),
  i('B01-3', 1, 'End of day: review actions, prepare tomorrow, save materials, plan study blocks, reflect and reset.', 'partial', 'app/src/screens/report/Day.tsx', 'The day report reviews what happened; “prepare tomorrow” and “reflect and reset” are not one flow.'),
  i('B01-4', 1, 'Calm and essential — never noisy, addictive or surveillance-driven.', 'in-place', 'app/src/lib/notify.ts', 'Five important and one helpful notification a day, quiet hours, and the engagement rules the ethics document sets.'),
  // 2 One-click clarity
  i('B02-1', 2, 'A consistent explain panel on every object: what, why, where from, how current, who can see, what can I do, what happens if I act, can I undo, who can help.', 'partial', 'app/src/lib/explain.ts', 'About this screen answers four of the nine on every screen, and source/scope/status answers three more per fact. “What happens if I act” and “can I undo” are answered per action, not in the panel.'),
  i('B02-2', 2, 'On every object type: course, requirement, deadline, action, recommendation, AI answer, assignment, grade, source, share, integration, notification, policy, credential.', 'partial', 'app/src/lib/provenance.ts', 'Facts, shares, AI answers and screens carry it; notifications, policies and credentials do not yet.'),
  // 3 Importer
  i('B03-1', 3, 'Import or connect: syllabus, degree audit, transcript, schedule, calendar, PDFs and slides, notes, actions, résumé, portfolio, past projects, course exports.', 'partial', 'app/src/screens/Import.tsx', 'Syllabi, calendars, files, notes and course exports import; degree audit, transcript and résumé do not.'),
  i('B03-2', 3, 'Every import is reviewable, source-labelled, editable, privacy-controlled, revocable, deletable, never auto-applied to official records.', 'in-place', 'app/src/lib/source.test.ts', 'Every imported fact carries its label and is editable and deletable; nothing writes to an official record (no write scope exists).'),
  // 4 Document intelligence
  i('B04-1', 4, 'Upload a syllabus → detect deadlines, policies, outcomes, weights, accessibility notes → extraction review → confirm → create actions, schedule, study plan, companion → preserve page anchors.', 'partial', 'app/src/lib/cite.ts', 'Deadlines, weights and material are extracted with anchors and confirmed on import; accessibility notes and outcomes are not detected.'),
  i('B04-2', 4, 'Works for PDF, DOCX, PPTX, images, audio, video, CSV, spreadsheet, web page, course export.', 'partial', 'app/src/lib/docxin.ts', 'PDF, DOCX, PPTX, CSV, spreadsheets and course exports read; images, audio and video are captured, not read for structure.'),
  // 5 Options planner
  i('B05-1', 5, 'Compare course vs course, major vs major, full- vs part-time, abroad vs campus, minor vs earlier, work vs load, internship vs summer, transfer vs repeat.', 'partial', 'app/src/components/GraduationSimulator.tsx', 'Term-load and summer scenarios compare; major, abroad and transfer comparisons do not exist.'),
  i('B05-2', 5, 'Show requirement, schedule, workload, cost impact, career evidence, source authority, assumptions, what needs official approval; never present an estimate as a guaranteed outcome.', 'partial', 'app/src/lib/graduation.ts', 'Requirement, schedule and cost impact are shown as estimates and never called official; career evidence and “what needs approval” are not in the comparison.'),
  // 6 Support network map
  i('B06-1', 6, 'For a question, the right people: advisor, office hours, tutor, writing center, library, accessibility office, career coach, aid, registrar, international office, accounts, wellbeing through official routes.', 'in-place', 'app/src/lib/help-routes.ts', 'Eleven destination kinds, three directory-only; wellbeing routes to campus counseling and 988 and stores nothing.'),
  i('B06-2', 6, 'Route, prepare and document the next step — not replace professional support.', 'in-place', 'app/src/lib/nowrongdoor.ts', 'A summary to take along and the line that Semester never decides, on every door.'),
  // 7 AI quality controls
  i('B07-1', 7, 'Source strength: strong, limited, none.', 'in-place', 'app/src/ai/quality.test.ts', 'Derived from what the answer read and how many sources were available.'),
  i('B07-2', 7, 'Policy state: allowed, limited, unavailable for this request.', 'in-place', 'app/src/ai/quality.test.ts', 'Derived from the help state the composer already obeys.'),
  i('B07-3', 7, 'Confidence language: what Semester can support, cannot determine, needs official or human confirmation.', 'in-place', 'app/src/ai/Turns.tsx', 'Three sentences under every reply, in a native disclosure.'),
  i('B07-4', 7, 'Feedback: helpful, not helpful, incorrect, source issue, policy issue, accessibility issue.', 'in-place', 'app/src/ai/quality.ts', 'Two local marks and four that open the report the app already sends, on the right kind.'),
  // 8 Teach-back
  i('B08-1', 8, 'Student explains in text, audio or outline → Semester names missing ideas → asks follow-ups → links to source → creates review items → tracks confidence; never scores intelligence.', 'in-place', 'app/src/lib/teachback.ts', 'No grade, no model answer, nothing unquoted, and a contradiction quotes both sides.'),
  // 9 Instructor AI spaces
  i('B09-1', 9, 'Per course: approved source set, allowed AI modes, assignment restrictions, citation style, practice boundaries, feedback rules, retention, course-specific prompts, faculty-approved study packs.', 'partial', 'app/src/lib/coursestudio.ts', 'Rules, packs and versions publish from Course Studio behind a flag; retention and feedback rules per course are not fields yet.'),
  // 10 Accessibility as a feature
  i('B10-1', 10, 'Read aloud, focus mode, high contrast, text spacing, dyslexia support, captions, transcripts, plain-language summaries, reading time, shortcut panel, accessible math, charts, list views, no drag-only planning.', 'partial', 'app/src/lib/aloud.ts', 'Read aloud, focus bar, contrast, spacing, typeface, captions, transcripts, shortcuts and list views exist and sit under Me and About this screen; reading-time estimates and accessible math are not built.'),
  i('B10-2', 10, 'Not hidden in settings: useful everywhere.', 'in-place', 'app/src/lib/mecontrols.ts', 'Accessibility preferences are one row under Me, and About this screen is on every screen.'),
  // 11 Accessibility authoring
  i('B11-1', 11, 'For material creators: heading, alt-text, link-text, contrast, table-header, caption, reading-order, PDF, assessment, slide and chart checks — labelled guidance, not certification.', 'owed', null, 'Nothing checks generated or authored material for structure; the maturity register carries it as GA-01 to GA-03.'),
  // 12 Orchestration
  i('B12-1', 12, 'Official action feed: source approved by office owner, cohort targeting, action-center delivery, student-facing explanation, privacy thresholds, completion aggregation, office handoff, feedback loop.', 'partial', 'docs/OFFICE-ACTION-FEED.md', 'The feed is built behind a flag with source and explanation; cohort targeting at n ≥ 10 and completion aggregation are designed; no office publishes to it.'),
  // 13 No wrong door
  i('B13-1', 13, 'Describe a problem in plain language; Semester clarifies what it can, identifies the owner, prepares a summary, offers safe next actions, routes to official systems or a person; never decides.', 'in-place', 'app/src/lib/nowrongdoor.test.ts', 'The brief’s six sentences route correctly; distress routes first; nothing typed is stored.'),
  // 14 Content quality score
  i('B14-1', 14, 'For campus content: owner, last reviewed, accessibility status, source, freshness, audience, expiry, usage, feedback, broken links, policy relevance.', 'owed', null, 'Tier-1 content settings carry owner and expiry limits; nothing scores an institution’s content. Follows the first published resource.'),
  // 15 Portability
  i('B15-1', 15, 'Student-controlled export, institution export, documented APIs, open standards, no hidden lock-in, migration tools, offboarding support, credential portability, versioned data contracts.', 'partial', 'docs/DATA-PORTABILITY-AND-OFFBOARDING.md', 'Student export and deletion are self-serve on every plan; data contracts are code; institution export, migration tools and credential portability are designed.'),
  // 16 Policy simulator
  i('B16-1', 16, 'Before enabling a policy, simulate: who sees the change, workflows affected, alternatives, support content to update, audit event created.', 'in-place', 'app/src/lib/governance/policysim.test.ts', 'Every module, on screens that exist, with support paths that exist and the reviewers the tier needs.'),
  i('B16-2', 16, 'Retention 365 → 180: data classes affected, exports and deletions that change, contracts to review.', 'in-place', 'app/src/lib/governance/policysim.test.ts', 'Every clock from the retention schedule; a clock on student work is refused, and so is one under its legal floor.'),
  // 17 Synthetic tenant
  i('B17-1', 17, 'A fictional tenant with fictional students, faculty, courses, integrations, source freshness, incidents, support access, AI policy and billing, for demos, UAT, training, accessibility and security testing, drills, integration development and release validation.', 'partial', 'app/src/lib/flight-plan.ts', 'Demo tenants with invented data run every institutional screen; a processing sandbox for sync, incidents and billing is designed in the sync-simulation document.'),
  i('B17-2', 17, 'Real student data is never required for testing or demonstrations.', 'in-place', 'app/src/lib/masterregister.ts', 'PRG-008, demo-data isolation, is tested; the demo is labelled demo data by test on the site.'),
  // 18 Semester Standard
  i('B18-1', 18, '/semester-standard: a public standard with measurable commitments — sources, limitations, sharing control, keyboard, AI context, incident path, export, audit, evidence.', 'in-place', 'app/src/lib/standard.test.ts', 'Eleven lines, four held by a test, seven partly held with the gap printed on the page; annual progress is stated as owed until a year has passed.'),
  // 19 Product quality report
  i('B19-1', 19, '/transparency/product-quality: accessibility, reliability, trust-center changes, security reviews, data-request performance, AI evaluation, integration changes, known limitations, feedback themes — published when real.', 'partial', 'app/src/site/more.tsx', 'The page exists at /trust/product-quality/ with what is checked, known and deliberately not published; no measure is published because none is real yet.'),
  // 20 Navigation index
  i('B20-1', 20, 'Public research on how students navigate registration, where friction appears, what they cannot find, how transparency affects trust, how accessibility affects action, how AI-policy clarity affects course use.', 'partial', 'app/src/site/benchmark.tsx', 'The Academic Friction Index is published as a method with nine questions and no findings; the navigation diagnostic is the self-assessment an institution can run today.'),
  // 21 Trust score
  i('B21-1', 21, 'A readiness score per tenant, connector, release or feature: security, privacy, accessibility, integration health, data quality, support, documentation freshness, SLO health, training, contract alignment — never scoring students.', 'partial', 'app/src/lib/governance/release-readiness.ts', 'Release readiness scores eight dimensions with a floor; data contracts report unstaffed; no per-tenant or per-connector score composes them.'),
  // 22 Control-plane simulation
  i('B22-1', 22, 'Before production changes: preview configuration, run policy, permission, data-quality, accessibility and integration tests, estimate customer impact, require approval, canary, monitor, roll back.', 'partial', 'app/src/components/institutional/ControlPlane.tsx', 'Preview (the simulator), approval by tier and a gateway receipt exist; permission and data-quality tests, canary and rollback of a tenant change are designed.'),
  // 23 Customer trust dashboard
  i('B23-1', 23, 'Per institution: version, modules, integrations and freshness, open issues, limitations, trust documents, accessibility status, maintenance, retention, AI policy, feature changes, usage aggregates.', 'in-place', 'app/src/lib/trustdashboard.test.ts', 'Twelve rows composed from what the app knows, an absence said plainly, usage suppressed under n = 10; a Trust tab on the institution screen.'),
  // 24 Own the language
  i('B24-1', 24, 'Use and repeat: Student Action Layer, Academic Navigation, Source-Aware Student Experience, Governed Campus AI, No Wrong Door, Student Data Agency, Accessible University OS, Decision Packets, Trust by Design.', 'in-place', 'app/src/lib/vocabulary.test.ts', 'Nine terms, each on a home page that a test holds to print it, and one page that explains them all.'),
  // 25 Summit
  i('B25-1', 25, 'An annual flagship event on student clarity, accessible learning, responsible AI, navigation, interoperability, trustworthy edtech and data agency — virtual and small at first.', 'owed', null, 'No date, no programme, no attendee. The clinics and council on the research page are the small start; announcing an event before one exists would break the site’s own rule.'),
];

export interface Coverage {
  inPlace: number;
  partial: number;
  owed: number;
}

export function coverage(items: readonly Item[] = ITEMS): Coverage {
  return {
    inPlace: items.filter((x) => x.status === 'in-place').length,
    partial: items.filter((x) => x.status === 'partial').length,
    owed: items.filter((x) => x.status === 'owed').length,
  };
}

/** The initiatives with nothing in place at all. */
export function bare(items: readonly Item[] = ITEMS): number[] {
  return INITIATIVES.filter((it) => !items.some((x) => x.initiative === it.n && x.status === 'in-place')).map((it) => it.n);
}
