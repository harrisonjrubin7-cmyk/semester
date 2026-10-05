/**
 * The Learning, Assessment and Gradebook Register: the fourteen areas a
 * document of 28 September 2026 asks a native, source-aware learning
 * environment to have — a course home, a syllabus workspace, a work-completion
 * planner, a writing workspace, a study studio, resource intelligence, an
 * assessment builder and delivery engine, a rubric engine, a gradebook, a
 * grading workflow, AI's place in assessment, an integrity layer and ethical
 * analytics — and where the repository stands on each; with the second
 * document's eighteen study tools and eight advanced features marked the same
 * way.
 *
 * `docs/LEARNING-ASSESSMENT-GRADEBOOK-REGISTER.md` is rendered from this file
 * by `learningregister.test.ts`; edit the data, then `npm run registers` from
 * app/.
 *
 * ## How this relates to what is already here
 *
 * `docs/LMS-LEARNING-ROADMAP.md` checked three earlier planning documents item
 * by item and ordered what was left. This register is wider — it covers the
 * faculty side the roadmap called "the largest piece" — and it is data, so a
 * test holds every claim: each cited file exists, each status cites the kind
 * of file it claims, each capability marked present sits in an area with code,
 * every master-register row it names is real, and every AI mode it maps names
 * a mode the tutor actually has.
 *
 * ## What a status may claim
 *
 * The service register's rule: `designed` cites a document, `building` code,
 * `tested` a test that runs on every change, `not-started` at most a document
 * naming the gap. A status is a claim about the *best* piece of an area, so
 * nearly every area is `tested` — the app has a great deal of the student
 * side. What the status cannot say, the capability marks do: each capability
 * the document asks for is marked present or absent, and the page counts them.
 * When this register was written the whole faculty side — the builder, the
 * rubric engine, the gradebook, the grading workflow — was present only as the
 * labelled sandbox in `app/server/institution/sandbox.ts`, which loads only
 * when asked for. Since then a gradebook of record (`app/src/lib/gradebook/`)
 * has landed, and the builder and rubric rules exist as pure libraries; every
 * mark that still rests on the sandbox says so.
 *
 * The supplied PDFs are never cited as evidence. Assessed against
 * `origin/main` `ff52ba4` on 28 September 2026; the assessment builder, rubric
 * engine, gradebook and grading workflow (L07, L09, L10, L11) were assessed
 * again on 30 September 2026 after the gradebook of record and the two rule
 * libraries landed. The other areas have not been reassessed since the 28th and
 * may be stale in the same way.
 *
 * ## The one benchmark
 *
 * Whether every student can reliably answer: what do I need to do, what
 * sources support it, how will it be evaluated, what feedback did I receive,
 * and what should I do next.
 */

import type { IntegrityMode } from '../intelligence/contracts';

export const SOURCES: readonly { path: string; title: string; what: string }[] = [
  {
    path: 'docs/expansion/Learning-Work-Completion-Assessment-and-Gradebook.pdf',
    title: 'Anything else that can be further improved and expanded upon: studying and learning and work-completion tools, LMS tools, grading tools',
    what: 'The fourteen areas, the AI use-case matrix, the standards table, the backend services and data model, the five phases and the release criteria for grading.',
  },
  {
    path: 'docs/expansion/EdTech-Stack-Audit-LTI-AI-Grading-and-API-Extensibility.pdf',
    title: 'EdTech stack audit (more studying features, AI tools and learning tools)',
    what: 'The eighteen study and AI learning tools with their source and safety controls, the eight advanced learning features, and the recommended priorities.',
  },
];

export const BENCHMARK =
  'Every student can reliably answer: what do I need to do, what sources support it, how will it be evaluated, what feedback did I receive, and what should I do next?';

export const GROUPS = {
  learning: 'Learning and study tools',
  assessment: 'Assessment and grading tools',
  governance: 'AI, integrity and analytics',
} as const;

export type Group = keyof typeof GROUPS;

export const STATUSES = ['not-started', 'designed', 'building', 'tested'] as const;
export type Status = (typeof STATUSES)[number];

export interface Capability {
  what: string;
  /** Something of it exists in the tree, per the evidence. */
  have: boolean;
}

export interface Area {
  /** `L01`–`L14`, stable. */
  id: string;
  title: string;
  group: Group;
  /** Why it matters, in one sentence. */
  why: string;
  capabilities: readonly Capability[];
  status: Status;
  evidence: readonly { path: string; shows: string }[];
  gap: string;
  /** Master-register rows that overlap. */
  master: readonly string[];
  /** The document's phase this area is built in, 1–5. */
  phase: 1 | 2 | 3 | 4 | 5;
}

type Cap = string | [what: string, have: false];
const cap = (c: Cap): Capability => (typeof c === 'string' ? { what: c, have: true } : { what: c[0], have: false });
const no = (what: string): Cap => [what, false];

type Row = Omit<Area, 'id' | 'capabilities' | 'evidence'> & { capabilities: readonly Cap[]; evidence: readonly [path: string, shows: string][] };

const SANDBOX = 'app/server/institution/sandbox.ts';
const SANDBOX_TEST = 'app/server/institution/sandbox.test.ts';

const ROWS: readonly Row[] = [
  // ── Learning and study tools ─────────────────────────────────────────────
  {
    title: 'Course learning hub',
    group: 'learning',
    why: 'Every course needs a calm, structured workspace, not a file dump; the student should always see the next action, what it is worth, who owns it and where to get help.',
    capabilities: [
      'What matters now: one recommended next action with its reason',
      no('Course plan for the term'),
      no('Modules mapped to learning outcomes'),
      'Assignment timeline with ahead, missed and done',
      'Study plan for the time available',
      'Materials and source library with per-material AI use',
      'Lecture notes and recordings turned into course material',
      'Practice and retrieval',
      no('Course discussions and collaboration'),
      'Practice assessments',
      'Grades and feedback',
      'Office-hours and help routes',
      'Course AI policy, shown where it applies',
      no('Course-level accessibility options (the modes are app-wide)'),
      'Estimated effort, labelled as an estimate',
      no('Due date with its time zone'),
      no('Submission and feedback state on each assignment'),
    ],
    status: 'tested',
    evidence: [
      ['app/src/components/CourseHub.tsx', 'a per-course hub: banner, what is next, upcoming, past-due and completed counts, and the assignments, study, readings, readiness and locker tabs'],
      ['app/src/lib/nextstep.test.ts', 'one recommended way into a course, with a reason and alternatives'],
      ['app/src/lib/standing.test.ts', 'whether a deadline is ahead, missed or done'],
      ['app/src/lib/help-routes.test.ts', 'tutoring, the writing centre and the library as routes, directory-only'],
      ['app/src/lib/source-locker.test.ts', 'per-material AI use'],
    ],
    gap: 'No term plan, no outcome map (LMS-015), no course discussions (LMS-007), no native submission state (a Canvas-imported label, from `standing` in `lib/canvas.ts`, and released grades on the Gradebook screen exist, but neither sits on the assignment itself) (LMS-004), and no time zone on a due date.',
    master: ['STU-001', 'LMS-003', 'LMS-015'],
    phase: 1,
  },
  {
    title: 'Syllabus-to-course workspace',
    group: 'learning',
    why: 'A syllabus can become a reviewable course structure — but never silently: the instructor or course owner approves the extraction before it is authoritative.',
    capabilities: [
      'Extract dated items, the grading table and the attendance policy from an uploaded syllabus',
      no('Extract learning outcomes, office hours, accessibility notes and the AI policy'),
      'Every extracted item carries its verbatim syllabus quote, checked against the source',
      'Only approved, valid dates become the course calendar',
      no('The instructor or course owner approves the extraction before it is published'),
      'A revised syllabus becomes a change list rather than duplicates',
      no('Students are notified of a change, with version history'),
    ],
    status: 'tested',
    evidence: [
      ['app/src/lib/generate.test.ts', 'dated items with their quotes, the grading table, the attendance policy; nothing is invented'],
      ['app/src/lib/cite.test.ts', 'each quote checked against the source'],
      ['app/src/lib/import-review.test.ts', 'only approved, valid dates may become an active course calendar'],
      ['app/src/lib/changeset.test.ts', 'a revised syllabus as a change list'],
      ['app/src/lib/courserules.test.ts', 'the faculty-published, versioned course AI rules — the one faculty-side publication that exists'],
    ],
    gap: 'The student approves their own import; there is no faculty review or publication of a syllabus except the AI rules in Course Studio (LMS-001, LMS-002). Late and AI policies are recorded by hand, not extracted.',
    master: ['LMS-001', 'LMS-002'],
    phase: 1,
  },
  {
    title: 'Work-completion planner',
    group: 'learning',
    why: 'One of Semester’s strongest student features: an assignment brief becomes a requirements checklist, a rubric in plain words, milestones, work times and a route to feedback.',
    capabilities: [
      'Assignment brief → outputs, rubric, dated steps with minutes, related units and a checklist',
      'Rubric translated into student-friendly criteria that never predict a grade',
      'Milestones and a dated schedule, with runway',
      'Time-block suggestions from the student’s own work windows',
      'Source and material checklist',
      'Draft workspace',
      'Citation and help tools',
      no('Peer or instructor feedback route from the plan'),
      no('Final submission checklist and proof of submission'),
      'Feedback against the rubric without rewriting',
      'Student controls: edit milestones, set work times, pause reminders, ask for support, share a draft',
    ],
    status: 'tested',
    evidence: [
      ['app/src/lib/assignment.test.ts', 'breakDown and critique: the plan and the rubric-gap feedback'],
      ['app/src/lib/steps.test.ts', 'one deadline split into dated actions'],
      ['app/src/lib/project.test.ts', 'milestones, schedule and runway'],
      ['app/src/lib/windows.test.ts', 'the student’s work windows'],
      ['app/src/lib/toolkit/templates.test.ts', 'a stage cannot be marked done without the student’s own note'],
      ['app/src/lib/notify.test.ts', 'quiet hours and caps'],
    ],
    gap: 'No native submission, so no receipt or proof of one (LMS-004, LMS-005): the assignment workspace has a submission checklist, and its last line sends the student to submit through the course’s own system. No route from the plan to an instructor.',
    master: ['STU-002', 'LMS-004', 'LMS-005'],
    phase: 1,
  },
  {
    title: 'Draft and writing workspace',
    group: 'learning',
    why: 'Where the work is done: outline, focus, versions, recovery, sources with anchors, the integrity panel, and export — with AI rewriting never the default.',
    capabilities: [
      'Outline builder',
      'Focus mode with break reminders',
      'Version history of a document',
      'Autosave and recovery, including whole-account snapshots',
      no('Comments and feedback on a draft'),
      'Citation manager: keys, BibTeX and RIS export, gaps',
      'Source cards and quotations with page anchors',
      'Academic-integrity and course-AI-policy panel',
      no('Accessibility checks on a document'),
      no('Document-format and submission checklist'),
      'Export to DOCX and PDF',
      'AI modes that never rewrite by default',
    ],
    status: 'tested',
    evidence: [
      ['app/src/lib/draft.test.ts', 'autosave and recovery'],
      ['app/src/lib/doctools.test.ts', 'the outline'],
      ['app/src/lib/sources.test.ts', 'cite keys, BibTeX, gaps and completeness'],
      ['app/src/lib/toolkit/research.test.ts', 'RIS and BibTeX export; verify and audit'],
      ['app/src/lib/quotes.test.ts', 'quotations located in the source; no scoring, no plagiarism guessing'],
      ['app/src/lib/toolkit/disclosure.test.ts', 'the AI-use declaration per assignment'],
      ['app/src/lib/docx.test.ts', 'DOCX export'],
      ['app/src/lib/pdf.test.ts', 'PDF export'],
      ['app/src/lib/socratic.test.ts', 'the modes, and the policy cap on the top rung'],
    ],
    gap: 'No comments on a draft, and no accessibility or format check on the document itself; the assignment workspace’s submission checklist is a short list of prompts, some shown only when the assignment has sources or the course needs an AI-use declaration, and none of them a check on the document (“Headings in order, figures described, links named” is a reminder). Write deliberately does not format bibliographies.',
    master: ['LMS-004', 'AI-008'],
    phase: 1,
  },
  {
    title: 'Study Studio',
    group: 'learning',
    why: 'Turns authorized material into active learning, and every generated item says where it came from, that it is generated, and what the course policy allows.',
    capabilities: [
      'Source-grounded summaries with page and slide anchors',
      'Vocabulary: terms matched to definitions',
      'Flashcards with explainable spaced repetition',
      'Practice questions with feedback',
      'Teach-back mode',
      'Concept maps',
      'Worked-example mode',
      'Problem decomposition',
      no('Formula and reference sheet'),
      no('Lecture-note organizer'),
      'Audio notes and transcripts',
      'Study-session planner',
      no('Focus timer'),
      'Confidence reflection: confident misses and lucky guesses',
      'Tutor, library and writing-centre handoff',
      'Every generated item shows its source, its generated status and the course policy',
    ],
    status: 'tested',
    evidence: [
      ['app/src/lib/studystudio.test.ts', 'exact quotes per section; page numbers never invented'],
      ['app/src/components/StudyStudio.anchors.test.tsx', 'a PDF page becomes a citation locator'],
      ['app/src/lib/fsrs.test.ts', 'FSRS scheduling'],
      ['app/src/lib/revise.test.ts', 'what to revise in the time you have, and why it is due'],
      ['app/src/lib/quiz.test.ts', 'choice, true-or-false and matching from cards'],
      ['app/src/lib/teachback.test.ts', 'teach-back with no grade'],
      ['app/src/lib/solve.test.ts', 'a problem decomposed'],
      ['app/src/lib/sure.test.ts', 'confidence calibration'],
      ['app/src/lib/transcribe.test.ts', 'a live transcript becomes course material'],
      ['app/src/lib/courserules.test.ts', 'the study gate: what the course’s AI rules allow a study guide to do'],
    ],
    gap: 'No reference sheet, lecture-note organizer or focus timer (the app says in `lib/doing.ts` that there is none to be findable).',
    master: ['AI-004', 'AI-005', 'STU-002'],
    phase: 1,
  },
  {
    title: 'Course-resource intelligence',
    group: 'learning',
    why: 'Helps students find the right materials without exposing private content: what kind of source it is, who may use it, and what it is used in.',
    capabilities: [
      'Search by concept, unit or reading',
      no('Search by week, outcome or assignment'),
      'Source type shown: institution-verified, imported, student-entered, estimated, needs review',
      'Access rights per material, including whether AI may use it',
      no('Access expiry on a material'),
      '“Used in” relationships on a source',
      'Citations and page anchors',
      'Duplicate detection at import',
      no('Outdated-version flag on a course material'),
      no('A recommendation of library, tutor or office-hours support when source coverage is weak'),
    ],
    status: 'tested',
    evidence: [
      ['app/src/lib/find.test.ts', 'one ranker over units, cards and screens'],
      ['app/src/lib/source.test.ts', 'the five labels, held to the database constraint'],
      ['app/src/lib/source-locker.test.ts', 'AI use set per material'],
      ['app/src/lib/changeset.test.ts', 'same and related items at import'],
      ['app/src/lib/unity.ts', 'SourceDetail: origin, freshness, visibility, limitations and used-in'],
    ],
    gap: 'No week or outcome facet (STU-009), no expiry or outdated flag on a course material, and no weak-coverage handoff.',
    master: ['STU-009', 'AI-004', 'TRUST-001'],
    phase: 1,
  },
  // ── Assessment and grading tools ─────────────────────────────────────────
  {
    title: 'Assessment builder',
    group: 'assessment',
    why: 'Faculty need to create assessments without a separate tool: banks, versions, tags, blueprints, pools, previews and QTI 3 in and out.',
    capabilities: [
      'Question banks and reusable item libraries, as rules: an item is validated, reviewed and drawn only when approved (nothing stores a bank)',
      'Question versioning: an edit is the next version, back in draft with its review cleared',
      no('Tags: course, outcome, topic, difficulty, cognitive level, accessibility review'),
      no('Shared stimuli'),
      no('Rubrics attached to items'),
      'Assessment blueprints: slots by outcome, tag and kind, refused when the bank cannot fill one',
      'A seeded random draw of a practice paper, re-sittable from its code',
      no('Sections and rules'),
      'Practice is always labelled practice, never an official assessment',
      no('Question, student and accessibility previews'),
      no('QTI 3 import and export'),
      'Five of the document’s nineteen question types: choice, true-or-false, matching, short answer, essay',
    ],
    status: 'tested',
    evidence: [
      ['app/src/lib/exam.test.ts', 'the paper shape, marks, the seeded draw and the clock'],
      ['app/src/lib/studystudio.ts', 'STUDY_FORMATS: a paper is practice, never an official assessment'],
      ['docs/QTI-3-ASSESSMENT-AND-MIGRATION.md', 'the interaction library against the five kinds the app has'],
      ['app/src/lib/itembank.test.ts', 'an item is approved only by someone other than its author; only an approved, unexpired, newest version is drawn; a test is rebuilt from its seed in any bank order; a written answer is never scored'],
    ],
    gap: 'Rules only, in app/src/lib/itembank.ts: nothing stores an item or a bank, no screen authors one, there is no difficulty or cognitive-level tag, shared stimulus, preview or section, and no QTI (LMS-008, INT-007); the QTI page says what present would mean.',
    master: ['LMS-008', 'INT-007', 'INT-008'],
    phase: 2,
  },
  {
    title: 'Assessment delivery engine',
    group: 'assessment',
    why: 'Timed online testing can create accessibility barriers; delivery supports accommodations, practice, accessible formats and alternatives rather than one timed format.',
    capabilities: [
      'Timed and untimed practice, on the wall clock, which never takes anything away',
      no('Availability windows and time zones'),
      no('Multiple graded attempts'),
      'Practice attempts',
      'Question randomization',
      no('Section sequencing'),
      'Save and resume, and autosave, on the device',
      'A submission receipt, on the device',
      'A late policy with a per-day penalty and a cap',
      no('Accommodation-aware timing and availability'),
      no('Make-up and alternative-assessment workflow'),
      no('Offline contingency instructions'),
      'Secure browser or proctoring only by institutional decision: no unapproved proctoring or surveillance',
      no('Incident or report-issue button'),
      'Accessibility preferences, chosen and never inferred',
    ],
    status: 'tested',
    evidence: [
      ['app/src/lib/examattempt.test.ts', 'autosave, resume, the seed, the wall clock, the receipt; time up takes nothing away'],
      [SANDBOX, 'LatePolicy {perDay, cap} and penalty()'],
      ['app/src/lib/ops/boundaries.test.ts', 'no emotion or facial analysis; no unapproved proctoring or surveillance'],
      ['app/src/lib/accessmode.ts', 'the access modes, user-chosen and never inferred'],
      ['supabase/migrations/20260926150000_expansion_roles_and_features.sql', 'accommodation_passports and shares, never applied to anything yet'],
    ],
    gap: 'A practice paper with no server authority: no windows, attempts, sections or enforced timing, and no accommodation applied to timing or format (LMS-008, LMS-009, LMS-010).',
    master: ['LMS-008', 'LMS-009', 'LMS-010'],
    phase: 2,
  },
  {
    title: 'Rubric engine',
    group: 'assessment',
    why: 'Rubrics are first-class structured data, not a PDF attachment: criteria, levels, points, outcome mapping, student-facing language, versions and calibration.',
    capabilities: [
      'Criterion with a name, marks out of, and what it means',
      'Performance levels, each with its points and its descriptor',
      'Points',
      'Learning-outcome mapping: points and their maximum roll up to each outcome',
      no('Instructor annotations'),
      'Student-facing language, published before work starts',
      no('Exemplars'),
      no('Accessibility notes'),
      no('Reusable templates'),
      no('Version history'),
      no('Calibration mode'),
      no('Rubric preview'),
      'Student self-assessment against the rubric, never a grade prediction',
      no('Peer-review version'),
    ],
    status: 'tested',
    evidence: [
      [SANDBOX, 'Criterion {id, name, outOf, means}; the total is the sum; a box left empty is refused'],
      [SANDBOX_TEST, 'the rubric: refuses a mark the rubric cannot carry; will not accept a rubric with a box left empty'],
      ['app/src/lib/toolkit/rubric.test.ts', 'the student checklist and its disclaimer'],
      ['app/src/lib/assignment.test.ts', 'the rubric extracted from an assignment brief, with weights'],
      ['app/src/lib/rubricengine.test.ts', 'a rubric is scored by level per criterion; an unscored criterion, an unknown level or another version is refused; a rubric with an empty box is refused'],
    ],
    gap: 'Rules only, in app/src/lib/rubricengine.ts: levels, outcome roll-up and a version a mark must match. The sandbox still holds the criteria the grading loop reads, and no rubric table exists in the database (LMS-006 designed): no stored version history, templates, exemplars or calibration.',
    master: ['LMS-006'],
    phase: 2,
  },
  {
    title: 'Gradebook',
    group: 'assessment',
    why: 'Transparent to students, powerful for instructors, and never presenting a speculative number as an official final grade.',
    capabilities: [
      'Assignment groups and weights',
      'Points, percentages and letters',
      no('Competency or mastery scales'),
      'Drop-lowest rules',
      'Excused work: left out of the calculation, never counted as zero',
      'Manual overrides with a reason and an audit record: a change after release is a new version with a kept reason',
      'Late-policy rules',
      'Missing and incomplete status',
      'Grade release controls',
      no('Anonymous grading mode'),
      no('Group grading with individual adjustments'),
      'Rubric-linked scoring',
      'Comment feedback',
      no('Audio or video feedback'),
      'Export',
      'Grade history: every version is kept and never edited',
      'Final-grade calculation preview: what-if, what is needed, the swing',
      no('Student-view preview for the instructor'),
      'LMS sync controls: an institution-gated passback',
      'The student view says its standing is an estimate from released grades only, what is included, what changes it, and the next action',
    ],
    status: 'tested',
    evidence: [
      ['app/src/lib/grades.test.ts', 'category weights, standing, what is needed and what is reachable'],
      ['app/src/lib/drop.test.ts', 'drop-lowest'],
      ['app/src/lib/whatif.test.ts', 'supposing, the swing, then-needs'],
      ['app/src/screens/suppose.test.tsx', 'nothing here is saved or counted anywhere'],
      ['app/src/screens/grades.test.tsx', 'the grades screen'],
      [SANDBOX, 'weight, missing and overdue status, release control; the student standing counts only released marks'],
      ['app/src/lib/ltigate.test.ts', 'the passback gate: kill switches, the writeback flag, an approved connection, the scope'],
      ['app/src/lib/source.test.ts', 'the estimated label'],
      ['app/src/lib/gradebook/gradebook.test.ts', 'weights and drop-lowest, excused work left out and missing counted as zero, a change after release needs a reason, no version ever edited or removed, a student sees only their own released grade'],
      ['app/src/lib/gradebook/passback.test.ts', 'passback sends the released version and never a newer draft, once, and stops when the gate closes'],
      ['supabase/gradebook.check.sql', 'the gradebook tables allowed and denied at the database'],
    ],
    gap: 'An instructor gradebook of record now exists (app/src/lib/gradebook and supabase/migrations/20260929310000_gradebook.sql; this register does not assert the migration is applied), beside the student’s own grades.ts. The sandbox that stood in for it is still in the tree. Not present: anonymous grading, group grading with individual adjustments, mastery scales, audio or video feedback, and a student-view preview for the instructor (LMS-011, LMS-013, LMS-014).',
    master: ['LMS-011', 'LMS-013', 'LMS-014', 'TRUST-004'],
    phase: 2,
  },
  {
    title: 'Grading workflow',
    group: 'assessment',
    why: 'Submission → receipt → rubric scoring → feedback → review → controlled release → student question → audited change → optional sync: every grade has a clear, reviewable human and system trail.',
    capabilities: [
      'Submission with an idempotent receipt and a version check',
      no('Automated integrity and accessibility checks on arrival'),
      no('Anonymous grading assignment'),
      'Rubric scoring, criterion by criterion',
      'Feedback comments',
      no('Audio, video or annotation feedback'),
      no('Calibration and moderation'),
      'Grade review before release: nothing is released before it is marked',
      'Controlled release: a mark is shown to nobody until it is released',
      no('Source-linked feedback the student receives'),
      'A student request for review through a policy workflow: the appeal',
      'A grade-change audit trail: every action in the record’s history, with the prior mark kept',
      'Optional sync to the LMS: quiz scores over AGS, gated',
    ],
    status: 'tested',
    evidence: [
      [SANDBOX, 'the stage machine: published → submitted → graded → released → archived, and what it refuses'],
      [SANDBOX_TEST, 'runs enrol → submit → receipt → mark → release → archive; keeps the order; shows a mark to nobody until it is released; an appeal'],
      ['app/src/lib/ltiags.test.ts', 'the AGS score post'],
      ['docs/LMS-INTEROPERABILITY-MATRIX.md', 'the grade write, preview to audit, at what the AGS post has today'],
      ['app/src/lib/gradebook/gradebook.test.ts', 'a draft held for moderation by a second person and then released; a regrade request filed over a released grade and resolved once'],
    ],
    gap: 'The grading loop now exists in the gradebook of record (draft, moderation by a second person, release, regrade request, a kept reason for every change, passback of released versions through an LmsAdapter): calibration, anonymous assignment, annotation feedback and automated checks on arrival are not present, no implementation of the LmsAdapter is in the tree, and the submission side is still the labelled sandbox (LMS-012, LMS-013, INT-005).',
    master: ['LMS-012', 'LMS-013', 'INT-005'],
    phase: 3,
  },
  // ── AI, integrity and analytics ──────────────────────────────────────────
  {
    title: 'AI in assessment and grading',
    group: 'governance',
    why: 'AI can assist; it must never silently become the grader. Each use case has a permitted role and a required human control.',
    capabilities: [
      'Rubric drafting: criteria and weights suggested from the brief, for the student’s checklist',
      'Question generation from course material, with citations',
      no('Faculty review of generated questions for accuracy, bias and accessibility'),
      'Practice feedback, labelled as generated, citing course sources, never an official grade',
      'Writing feedback that identifies rubric gaps and never rewrites invisibly',
      no('Instructor feedback draft from rubric inputs, edited and approved before release'),
      no('Grading assistance: possible rubric evidence flagged for a human to validate'),
      no('Integrity support: unusual patterns highlighted for human investigation'),
      'Accessibility support: read-aloud of generated material',
      'No AI-only final grade, held by the absence of any grading tool',
    ],
    status: 'tested',
    evidence: [
      ['app/src/lib/assignment.test.ts', 'the rubric extracted; critique names gaps and does not rewrite'],
      ['app/src/lib/quiz-feedback.test.ts', 'the reasons a practice answer is marked as it is'],
      ['app/src/lib/teachback.test.ts', 'no grade'],
      ['app/src/components/spokenlesson.test.tsx', 'a lesson read aloud'],
      ['docs/operating-model/AI-GRADING-AND-INTEGRITY.md', 'the roles matrix at the lifecycle gates, and the two rules at the code'],
    ],
    gap: 'Nothing that helps a grader: no feedback draft, evidence spotting or integrity signal; and no intake refusal names automated grading (AI-006, AI-007). The one faculty-side review rule for AI-drafted material is `app/src/lib/itembank.ts` (a reviewer other than the author, an accessibility review, and the model, prompt version and editor named), which has no accuracy or bias review and is wired to no screen.',
    master: ['AI-006', 'AI-007', 'AI-009'],
    phase: 4,
  },
  {
    title: 'Academic-integrity layer',
    group: 'governance',
    why: 'Integrity as clarity and learning support, not surveillance: policy, disclosure, citation checks, version history, a human review, an appeal, and never an automatic accusation.',
    capabilities: [
      'Course-specific policy panel: assignment → course → school → university precedence',
      'Assignment-specific AI-use declaration',
      'Citation expectations: verify and audit',
      'Version history of a student’s drafts',
      'Authorship and process reflection: the attestation',
      'Permitted-tool disclosure',
      'Source and citation checks against the material',
      no('Similarity or originality integration, if the institution chooses'),
      no('Instructor review queue'),
      'Student explanation and appeal: the sandbox appeal with a reason',
      no('Integrity education modules'),
      'No automatic accusation or penalty: the forbidden measure',
    ],
    status: 'tested',
    evidence: [
      ['app/src/lib/toolkit/policy.test.ts', 'the precedence; an unknown policy is unavailable, not allowed'],
      ['app/src/lib/toolkit/disclosure.test.ts', 'the declaration and its attestation'],
      ['app/src/lib/toolkit/research.test.ts', 'verify and audit'],
      ['app/src/lib/cite.test.ts', 'quotes checked against the source'],
      ['app/src/lib/institution-ops.test.ts', 'refuses a metric that sources a forbidden measure, among them automated integrity accusations'],
      ['app/src/lib/toolkit/safety.test.ts', 'answers for an assessment are refused and redirected'],
      ['GRADESCOPE-TURNITIN.md', 'no legitimate route to Gradescope; Turnitin’s API is a partnership'],
    ],
    gap: 'The declaration is stored on the device and never submitted; no similarity integration, review queue or education module (AI-007).',
    master: ['AI-007', 'LMS-004'],
    phase: 3,
  },
  {
    title: 'Learning analytics, the ethical version',
    group: 'governance',
    why: 'Useful faculty insight without hidden student-risk scores, click-behaviour interventions, employer access, emotion surveillance or opaque ranking.',
    capabilities: [
      'Aggregated patterns only, above a floor of ten',
      no('Assessment item quality: difficulty, discrimination, distractors'),
      no('Rubric and learning-outcome performance'),
      no('Feedback turnaround time'),
      no('Resource and help-route usage'),
      no('Accessibility issue reports'),
      no('Course-content freshness'),
      no('Assessment technical errors'),
      'Prohibited: hidden student-risk scores',
      'Prohibited: automated intervention on click behaviour',
      'Prohibited: employer access to learning analytics',
      'Prohibited: emotion or sentiment surveillance',
      'Prohibited: opaque engagement ranking',
      'Prohibited: accommodation or basic-needs data in performance prediction',
    ],
    status: 'tested',
    evidence: [
      ['app/src/lib/institution-ops.test.ts', 'refuses a per-student grain and every forbidden measure: risk scores, mouse and keystroke tracking, attention inference, AI usage, integrity flags, wellbeing scores, location'],
      ['app/src/lib/cohortfloor.test.ts', 'the floor of ten, in the app and in every migration'],
      ['app/src/lib/ops/boundaries.test.ts', 'no emotion or facial analysis'],
      ['app/src/lib/governance/module-privacy.ts', 'AI never infers mental health, financial distress, disability, academic risk, immigration status or misconduct risk'],
      ['app/src/lib/serviceregister.ts', 'what an employer never receives'],
      ['app/src/donotbuild.test.ts', 'no unexplained score, risk label or recommendation'],
      ['app/src/lib/toolkit/recommend.test.ts', 'GPA and risk scores stripped before a recommendation'],
    ],
    gap: 'Every prohibition is held; none of the useful measures exists (LMS-017): no item quality, outcome performance, turnaround, usage, accessibility reports or freshness.',
    master: ['UOS-008', 'LMS-017', 'AI-001'],
    phase: 4,
  },
];

export const AREAS: readonly Area[] = ROWS.map((r, i) => ({
  ...r,
  id: `L${String(i + 1).padStart(2, '0')}`,
  capabilities: r.capabilities.map(cap),
  evidence: r.evidence.map(([path, shows]) => ({ path, shows })),
}));

export const areaOf = (id: string): Area => AREAS.find((a) => a.id === id)!;

/** How many of an area's capabilities have something in the tree. */
export const present = (a: Area): number => a.capabilities.filter((c) => c.have).length;

// ── The second document's study and AI learning tools ───────────────────────

export interface Tool {
  tool: string;
  does: string;
  control: string;
  /** The file that already does it, or null. */
  have: string | null;
  note: string;
}

export const TOOLS: readonly Tool[] = [
  { tool: 'Teach-back coach', does: 'The student explains a concept; the system identifies gaps and asks follow-up questions', control: 'Uses authorized material; says “review this”, not “you failed”', have: 'app/src/lib/teachback.ts', note: 'No grade.' },
  { tool: 'Retrieval practice generator', does: 'Makes quizzes and flashcards from selected course sources', control: 'Shows the original source anchors and allows correction', have: 'app/src/lib/quiz.ts', note: 'Choice, true-or-false and matching from cards.' },
  { tool: 'Spaced-repetition planner', does: 'Schedules review from student-selected confidence and deadlines', control: 'The student controls the cadence; no pressure streaks', have: 'app/src/lib/revise.ts', note: 'FSRS, with why-it-is-due and exam-deadline weighting; the pressure mechanic the document forbids is refused deliberately in `lib/weekly.ts`.' },
  { tool: 'Worked-example tutor', does: 'Walks through a representative solution step by step', control: 'Labels example against graded work; follows course policy', have: 'app/src/lib/solve.ts', note: 'Problem decomposition; readExamples in `lib/study.ts`.' },
  { tool: 'Error-analysis coach', does: 'Helps the student categorize why a practice answer was wrong', control: 'No ability or intelligence labels', have: 'app/src/lib/learning-loop.ts', note: 'classifyMistake, eight kinds; repeated mistakes in `lib/again.ts`.' },
  { tool: 'Concept-map builder', does: 'Connects terms, claims, evidence, formulas and outcomes', control: 'Editable graph; a source card on every generated connection', have: 'app/src/lib/studystudio.ts', note: 'The map format; a mastery graph in `components/MasteryGraph.tsx`. Not editable.' },
  { tool: 'Reading companion', does: 'Breaks a long reading into sections, vocabulary, questions and notes', control: 'Preserves citations and page anchors; supports text-to-speech', have: null, note: 'A reading plan and progress exist (`lib/reading.ts`); no in-reading companion.' },
  { tool: 'Lecture companion', does: 'Syncs slides, notes, transcript, timestamps and study prompts', control: 'Requires an authorized recording; respects instructor policy', have: null, note: 'A transcript becomes course material (`lib/transcribe.ts`); nothing syncs slides or timestamps.' },
  { tool: 'Problem-set planner', does: 'Breaks a problem set into effort estimates and support checkpoints', control: 'No solution delivery when course policy restricts it', have: 'app/src/lib/assignment.ts', note: 'Steps with minutes; the policy cap in `lib/socratic.ts`.' },
  { tool: 'Exam readiness planner', does: 'Builds a study schedule from scope, date and availability', control: 'Labels estimates; supports accessibility and quiet hours', have: 'app/src/lib/study-readiness.ts', note: 'With the readiness forecast in `lib/learning-loop.ts`.' },
  { tool: 'Office-hours agenda builder', does: 'Creates a concise question list from confusion points', control: 'The student chooses what to share', have: 'app/src/lib/officeagenda.ts', note: 'A question list from the student’s private questions, filed feedback and review-later concepts, each ticked by the student and none pre-selected; copied or saved as text, never sent. Sources are not attached to it yet, and `lib/officehours.ts` remains a nudge about when to go.' },
  { tool: 'Feedback-to-revision coach', does: 'Turns released feedback into a revision checklist', control: 'Uses only the student’s released feedback and selected sources', have: 'app/src/lib/feedbackloop.ts', note: 'Works from comments the student files and the category they choose, and turns each into optional next steps they add to their plan by hand; nothing is read from released gradebook feedback, and no action is inferred from the comment text. `critique` in `lib/assignment.ts` compares a draft to the rubric.' },
  { tool: 'Citation coach', does: 'Explains attribution and source quality; builds a bibliography draft', control: 'The student verifies every citation before use', have: 'app/src/lib/toolkit/research.ts', note: 'verify and audit; Write does not format bibliographies by design.' },
  { tool: 'Accessibility transformation', does: 'Read aloud, captions, plain-language restatement, format checks', control: 'Identifies transformations; preserves original access', have: 'app/src/components/StudyStudio.tsx', note: 'Read-aloud; captions on the podcasts; no plain-language restatement or format check.' },
  { tool: 'Study-group kit', does: 'Shared agenda, roles, practice prompts and resources', control: 'Consent-based sharing; no grade or analytics exposure', have: 'app/src/lib/groupwork.ts', note: 'A group-project split; community sessions; no kit.' },
  { tool: 'Lab or studio notebook', does: 'Time-stamped notes, observations, methods, data links and reflection', control: 'Permissions, export and integrity controls', have: null, note: 'None.' },
  { tool: 'Formula and reference builder', does: 'Student-authored, instructor-approved study sheets', control: 'Course-policy and assessment-permission label', have: null, note: 'None.' },
  { tool: 'Metacognition journal', does: 'Records goals, confidence, strategy and reflection', control: 'Private by default; no behavioural scoring', have: 'app/src/components/StudyJournal.tsx', note: 'With calibration in `lib/sure.ts` and what-worked in `lib/worked.ts`.' },
];

export const ADVANCED: readonly { feature: string; what: string; have: string | null; note: string }[] = [
  { feature: 'Prerequisite refresher paths', what: 'Short instructor-approved bridge modules before difficult topics', have: null, note: 'A prompt line in the tutor; the service register marks the bridge plan absent.' },
  { feature: 'Misconception library', what: 'Faculty-curated common misunderstandings with source-linked corrections', have: null, note: 'Repeated mistakes are tracked per student; no library.' },
  { feature: 'Adaptive practice with transparent rules', what: 'The next item chosen by coverage, confidence, prior response and exam scope — not opaque risk prediction', have: 'app/src/lib/interleave.ts', note: 'With `lib/pretest.ts` and recommendLearningActivity in `lib/learning-loop.ts`.' },
  { feature: 'Learning-outcome navigator', what: 'Which modules, assignments, practice items and feedback connect to each outcome', have: null, note: 'Student mastery only; no outcome authoring or mapping (LMS-015).' },
  { feature: 'Feedback digest', what: 'Released feedback summarized into student-controlled patterns', have: 'app/src/lib/feedbackloop.ts', note: 'Themes across the student’s own filings, spoken only above a floor of three and never ranked (`themes` in `lib/feedbackloop.ts`), kept private on the device; the filings are not read from released gradebook feedback.' },
  { feature: 'Study workload balancer', what: 'A realistic plan across courses from deadlines and declared availability, assumptions visible', have: 'app/src/lib/ahead.ts', note: 'Week pressure, pace and work windows.' },
  { feature: 'Academic-integrity rehearsal', what: 'Practice citation, paraphrase, collaboration and disclosure decisions without punitive grading', have: null, note: 'None.' },
  { feature: 'Exam wrapper', what: 'Strategy before, reflection after, without labelling capability', have: 'app/src/lib/postmortem.ts', note: 'Why marks were lost, and those units brought forward.' },
];

// ── AI modes: the document's eight against the tutor's five ─────────────────

export const AI_MODES: readonly { mode: string; carriedBy: IntegrityMode | null; note: string }[] = [
  { mode: 'Plan', carriedBy: null, note: 'The planner is `lib/assignment.ts`, not a tutor mode (AI-008: no Plan mode).' },
  { mode: 'Explain', carriedBy: 'explain', note: 'The default.' },
  { mode: 'Ask questions', carriedBy: 'hint', note: 'The Socratic ladder, one rung per reply.' },
  { mode: 'Check requirements', carriedBy: null, note: 'critique in `lib/assignment.ts` does this outside the tutor.' },
  { mode: 'Give feedback', carriedBy: 'review', note: 'The feedback contract: what is right, one misconception, one question, the source.' },
  { mode: 'Cite sources', carriedBy: null, note: 'Citations are a property of Study Studio output, not a mode; Ask answers carry none (AI-005).' },
  { mode: 'Improve accessibility', carriedBy: null, note: 'No mode.' },
  { mode: 'Draft with disclosure, where allowed', carriedBy: 'draft', note: 'Governed by the course policy; the declaration is `lib/toolkit/disclosure.ts`.' },
];

// ── Standards, services, data model ──────────────────────────────────────────

export const STANDARDS: readonly { need: string; approach: string }[] = [
  { need: 'Launch into an external LMS', approach: 'LTI 1.3 / LTI Advantage' },
  { need: 'Course roster and roles', approach: 'LTI Names and Role Provisioning Service, or OneRoster' },
  { need: 'Gradebook exchange', approach: 'LTI Assignment and Grade Services' },
  { need: 'Assessment portability', approach: 'QTI 3.0' },
  { need: 'Outcomes and competencies', approach: 'CASE, when competency workflows are mature' },
  { need: 'Identity', approach: 'OIDC or SAML, and SCIM' },
  { need: 'SIS grades', approach: 'An institution-approved integration; preview and audit required' },
  { need: 'Calendar', approach: 'iCal or CalDAV, or an approved Google or Microsoft connector' },
  { need: 'Content migration', approach: 'Imports with source, ownership and rights validation' },
  { need: 'Analytics', approach: 'A privacy-governed event architecture; Caliper only when justified' },
];

export const GRADE_WRITE_RULE = 'Every external grade write is an explicit, previewable, auditable action — never a silent background sync.';

export const SERVICES: readonly string[] = [
  'Identity and tenant context',
  'Course, enrollment and role',
  'Content and versioning',
  'Assignment and submission',
  'Assessment and QTI',
  'Attempt, timing and accommodation',
  'Rubric and grade calculation',
  'Feedback and annotation',
  'Gradebook and grade-history ledger',
  'Integrity and policy',
  'AI policy, retrieval and evaluation',
  'Notification and reminder',
  'Calendar and action sync',
  'Accessibility preference and accommodation application',
  'Analytics with privacy controls',
  'Integration gateway for LTI, OneRoster, SIS and external LMS',
  'Audit, evidence and retention',
];

export const OBJECTS: readonly string[] = [
  'Course', 'Enrollment', 'Assignment group', 'Assessment or assignment', 'Gradebook column', 'Grading scheme', 'Rubric and rubric version', 'Submission and submission version',
  'Attempt', 'Accommodation application', 'Grade entry', 'Grade calculation', 'Feedback item', 'Grade release event', 'Override or adjustment', 'Grade-change request', 'Appeal or review case',
  'External grade-sync job', 'Audit event',
];

/** What every grade-related record includes. */
export const RECORD_FIELDS: readonly string[] = [
  'Tenant id',
  'Course and term',
  'Student or enrollment scope',
  'Authorized grader',
  'Rubric and version',
  'Source calculation',
  'Status: draft, graded, moderated, released, changed, synced',
  'Timestamp',
  'Reason for override or change',
  'Audit correlation id',
  'Retention classification',
];

/** What the student grade view always says, so a speculative number is never presented as official. */
export const STUDENT_VIEW: readonly { line: string; example: string }[] = [
  { line: 'Current standing', example: 'Estimated, based on released grades only' },
  { line: 'Included', example: 'Assignments and weights currently released' },
  { line: 'Not included', example: 'Unreleased work, future assessments, instructor adjustments, and institution-specific final-grade rules' },
  { line: 'What changes this', example: 'Upcoming assessment weight, missing work, replacement rules, drop-lowest rule, or instructor updates' },
  { line: 'Next action', example: 'Review feedback on Essay 1 and attend office hours if needed' },
];

// ── Phases and release criteria ──────────────────────────────────────────────

export const PHASES: readonly { n: 1 | 2 | 3 | 4 | 5; name: string; items: readonly string[] }[] = [
  { n: 1, name: 'Work completion and study value', items: ['Course Home', 'Syllabus review and approval workflow', 'Assignment planner and milestones', 'Action and calendar integration', 'Draft workspace with recovery', 'Study Studio with source-grounded learning aids', 'Office-hours, tutor, library and writing-centre handoffs', 'Accessibility preferences and document checks'] },
  { n: 2, name: 'Native assessment foundation', items: ['Assignment submission', 'Rubrics', 'Manual grading and feedback', 'Basic gradebook', 'Student grade view with estimate labels', 'Grade-release controls', 'Submission receipts and version history', 'Accommodation-aware timing and availability', 'QTI import and export foundation'] },
  { n: 3, name: 'Full instructor workflow', items: ['Question banks', 'Assessment builder', 'Item pools and randomization', 'Multiple assessment types', 'Anonymous grading', 'TA, calibration and moderation', 'Group work and peer review', 'Late-policy engine', 'Grade-change and appeal workflow', 'LTI AGS and SIS or LMS controlled sync'] },
  { n: 4, name: 'Advanced learning value', items: ['Spaced repetition', 'Adaptive practice, with transparent logic', 'Skills and outcomes mapping', 'Item analytics', 'Portfolio and project assessment', 'Credential evidence', 'AI feedback assistance with human approval', 'Course-level AI policy configuration'] },
  { n: 5, name: 'High-risk and specialized capabilities', items: ['Proctoring integrations', 'Secure browser', 'Coding sandboxes', 'Adaptive testing', 'Advanced psychometrics', 'Oral and video assessment', 'External credential issuance'] },
];

export const PHASE5_RULE = 'Only launch these after dedicated accessibility testing, assessment-security controls, privacy and legal review, support capacity, and clear institutional operating models.';

/** Before Semester is used for consequential grading. */
export const RELEASE_CRITERIA: readonly string[] = [
  'A named course or institution owner, and authorized grader roles.',
  'Rubric version and assignment settings locked or versioned.',
  'Student preview and an accessible alternative path verified.',
  'Accommodation rules applied and tested.',
  'Submission autosave, receipt, recovery and audit trail tested.',
  'Grade calculations independently tested, including edge cases.',
  'Grade visibility and release behaviour tested from the student view.',
  'Override and change workflows require a reason and are audited.',
  'No AI-only final grades or automated misconduct decisions.',
  'An appeal and review process configured and visible to students.',
  'LTI or SIS grade sync, if enabled, is previewable, permissioned, retry-safe, reconcilable, and reversible where the destination permits.',
  'Backup, export, retention and incident runbooks tested.',
];

/** The second document's build order. */
export const PRIORITIES: readonly string[] = [
  'Source-grounded work completion: assignment breakdown, rubric checklist, source cards, draft and revision history, submission receipt, recovery centre.',
  'Study Studio: teach-back, retrieval practice, spaced repetition, reading and lecture companion, feedback-to-revision, accessibility tools.',
  'Source-aware gradebook: structured rubrics, criterion-level feedback, audit ledger, release controls, student grade estimate with limits, regrade workflow.',
  'QTI 3 assessment core: item bank, import and export, accessible interaction patterns, versioned scoring, delivery, item analytics.',
  'Human-governed AI assistance: course policy engine, grounded generation, feedback drafting, evidence spotting, integrity review — not AI-only grades.',
  'Advanced practice and outcomes: transparent adaptive practice, misconception library, learning-outcome navigator, portable evidence and credentials.',
];
