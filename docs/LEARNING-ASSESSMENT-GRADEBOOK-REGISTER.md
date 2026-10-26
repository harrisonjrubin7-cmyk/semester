# Learning, Assessment and Gradebook Register

<!-- Rendered from app/src/lib/learningregister.ts by learningregister.test.ts. Edit the data, then run `npm run registers` from app/. -->

> Owner, version, last and next review, status, supersedes and related decisions: [`SEMESTER-OPERATING-SYSTEM.md`](../SEMESTER-OPERATING-SYSTEM.md).

The fourteen areas a document of 28 September 2026 asks a native, source-aware
learning environment to have, and where the repository stands on each; with
the second document’s eighteen study tools and eight advanced features marked
the same way. The [LMS and learning roadmap](LMS-LEARNING-ROADMAP.md) checked
three earlier documents item by item; this register covers the faculty side
the roadmap called the largest piece, and it is data, so a test holds every
claim. Where an area overlaps a row of the
[master register](MASTER-LAUNCH-READINESS-REGISTER.md), it names it.

**The benchmark.** Every student can reliably answer: what do I need to do, what sources support it, how will it be evaluated, what feedback did I receive, and what should I do next?

| Supplied document | What it holds |
| --- | --- |
| [Anything else that can be further improved and expanded upon: studying and learning and work-completion tools, LMS tools, grading tools](expansion/Learning-Work-Completion-Assessment-and-Gradebook.pdf) | The fourteen areas, the AI use-case matrix, the standards table, the backend services and data model, the five phases and the release criteria for grading. |
| [EdTech stack audit (more studying features, AI tools and learning tools)](expansion/EdTech-Stack-Audit-LTI-AI-Grading-and-API-Extensibility.pdf) | The eighteen study and AI learning tools with their source and safety controls, the eight advanced learning features, and the recommended priorities. |

## Where it stands

A status is a claim about the *best* piece of an area — `tested` cites a test
that runs on every change, `building` code, `designed` a document — so nearly
every area is `tested`: the app has a great deal of the student side. What the
status cannot say, the capability marks do: each capability the document asks
for is marked present or absent, and the table counts them. The whole faculty
side — the builder, the rubric engine, the gradebook, the grading workflow —
is present only as the labelled sandbox in `app/server/institution/sandbox.ts`,
which loads only when asked for, and every mark that rests on it says so.
Across the register, 117 of 183 capabilities have something in the tree.
Assessed against `origin/main` `ff52ba4` on 28 September 2026; the supplied
PDFs are never cited as evidence.

| ID | Area | Group | Phase | Status | Present | Master rows |
| --- | --- | --- | ---: | --- | ---: | --- |
| [L01](#l01) | Course learning hub | Learning and study tools | 1 | tested | 11 / 17 | `STU-001`, `LMS-003`, `LMS-015` |
| [L02](#l02) | Syllabus-to-course workspace | Learning and study tools | 1 | tested | 4 / 7 | `LMS-001`, `LMS-002` |
| [L03](#l03) | Work-completion planner | Learning and study tools | 1 | tested | 9 / 11 | `STU-002`, `LMS-004`, `LMS-005` |
| [L04](#l04) | Draft and writing workspace | Learning and study tools | 1 | tested | 9 / 12 | `LMS-004`, `AI-008` |
| [L05](#l05) | Study Studio | Learning and study tools | 1 | tested | 13 / 16 | `AI-004`, `AI-005`, `STU-002` |
| [L06](#l06) | Course-resource intelligence | Learning and study tools | 1 | tested | 6 / 10 | `STU-009`, `AI-004`, `TRUST-001` |
| [L07](#l07) | Assessment builder | Assessment and grading tools | 2 | tested | 6 / 12 | `LMS-008`, `INT-007`, `INT-008` |
| [L08](#l08) | Assessment delivery engine | Assessment and grading tools | 2 | tested | 8 / 15 | `LMS-008`, `LMS-009`, `LMS-010` |
| [L09](#l09) | Rubric engine | Assessment and grading tools | 2 | tested | 6 / 14 | `LMS-006` |
| [L10](#l10) | Gradebook | Assessment and grading tools | 2 | tested | 15 / 20 | `LMS-011`, `LMS-013`, `LMS-014`, `TRUST-004` |
| [L11](#l11) | Grading workflow | Assessment and grading tools | 3 | tested | 8 / 13 | `LMS-012`, `LMS-013`, `INT-005` |
| [L12](#l12) | AI in assessment and grading | AI, integrity and analytics | 4 | tested | 6 / 10 | `AI-006`, `AI-007`, `AI-009` |
| [L13](#l13) | Academic-integrity layer | AI, integrity and analytics | 3 | tested | 9 / 12 | `AI-007`, `LMS-004` |
| [L14](#l14) | Learning analytics, the ethical version | AI, integrity and analytics | 4 | tested | 7 / 14 | `UOS-008`, `LMS-017`, `AI-001` |
| **total** | | | | not-started 0, designed 0, building 0, tested 14 | **117 / 183** | |

## The register

### Learning and study tools

#### L01

**Course learning hub.** Every course needs a calm, structured workspace, not a file dump; the student should always see the next action, what it is worth, who owns it and where to get help.

*Status.* tested, 11 of 17 capabilities present; phase 1.

- [x] What matters now: one recommended next action with its reason
- [ ] Course plan for the term
- [ ] Modules mapped to learning outcomes
- [x] Assignment timeline with ahead, missed and done
- [x] Study plan for the time available
- [x] Materials and source library with per-material AI use
- [x] Lecture notes and recordings turned into course material
- [x] Practice and retrieval
- [ ] Course discussions and collaboration
- [x] Practice assessments
- [x] Grades and feedback
- [x] Office-hours and help routes
- [x] Course AI policy, shown where it applies
- [ ] Course-level accessibility options (the modes are app-wide)
- [x] Estimated effort, labelled as an estimate
- [ ] Due date with its time zone
- [ ] Submission and feedback state on each assignment

| Evidence | Shows |
| --- | --- |
| `app/src/components/CourseHub.tsx` | a per-course hub: banner, what is next, upcoming, past-due and completed counts, and the assignments, study, readings, readiness and locker tabs |
| `app/src/lib/nextstep.test.ts` | one recommended way into a course, with a reason and alternatives |
| `app/src/lib/standing.test.ts` | whether a deadline is ahead, missed or done |
| `app/src/lib/help-routes.test.ts` | tutoring, the writing centre and the library as routes, directory-only |
| `app/src/lib/source-locker.test.ts` | per-material AI use |

*Gap.* No term plan, no outcome map (LMS-015), no course discussions (LMS-007), no native submission state (a Canvas-imported label, from `standing` in `lib/canvas.ts`, and released grades on the Gradebook screen exist, but neither sits on the assignment itself) (LMS-004), and no time zone on a due date.

#### L02

**Syllabus-to-course workspace.** A syllabus can become a reviewable course structure — but never silently: the instructor or course owner approves the extraction before it is authoritative.

*Status.* tested, 4 of 7 capabilities present; phase 1.

- [x] Extract dated items, the grading table and the attendance policy from an uploaded syllabus
- [ ] Extract learning outcomes, office hours, accessibility notes and the AI policy
- [x] Every extracted item carries its verbatim syllabus quote, checked against the source
- [x] Only approved, valid dates become the course calendar
- [ ] The instructor or course owner approves the extraction before it is published
- [x] A revised syllabus becomes a change list rather than duplicates
- [ ] Students are notified of a change, with version history

| Evidence | Shows |
| --- | --- |
| `app/src/lib/generate.test.ts` | dated items with their quotes, the grading table, the attendance policy; nothing is invented |
| `app/src/lib/cite.test.ts` | each quote checked against the source |
| `app/src/lib/import-review.test.ts` | only approved, valid dates may become an active course calendar |
| `app/src/lib/changeset.test.ts` | a revised syllabus as a change list |
| `app/src/lib/courserules.test.ts` | the faculty-published, versioned course AI rules — the one faculty-side publication that exists |

*Gap.* The student approves their own import; there is no faculty review or publication of a syllabus except the AI rules in Course Studio (LMS-001, LMS-002). Late and AI policies are recorded by hand, not extracted.

#### L03

**Work-completion planner.** One of Semester’s strongest student features: an assignment brief becomes a requirements checklist, a rubric in plain words, milestones, work times and a route to feedback.

*Status.* tested, 9 of 11 capabilities present; phase 1.

- [x] Assignment brief → outputs, rubric, dated steps with minutes, related units and a checklist
- [x] Rubric translated into student-friendly criteria that never predict a grade
- [x] Milestones and a dated schedule, with runway
- [x] Time-block suggestions from the student’s own work windows
- [x] Source and material checklist
- [x] Draft workspace
- [x] Citation and help tools
- [ ] Peer or instructor feedback route from the plan
- [ ] Final submission checklist and proof of submission
- [x] Feedback against the rubric without rewriting
- [x] Student controls: edit milestones, set work times, pause reminders, ask for support, share a draft

| Evidence | Shows |
| --- | --- |
| `app/src/lib/assignment.test.ts` | breakDown and critique: the plan and the rubric-gap feedback |
| `app/src/lib/steps.test.ts` | one deadline split into dated actions |
| `app/src/lib/project.test.ts` | milestones, schedule and runway |
| `app/src/lib/windows.test.ts` | the student’s work windows |
| `app/src/lib/toolkit/templates.test.ts` | a stage cannot be marked done without the student’s own note |
| `app/src/lib/notify.test.ts` | quiet hours and caps |

*Gap.* No native submission, so no receipt or proof of one (LMS-004, LMS-005): the assignment workspace has a submission checklist, and its last line sends the student to submit through the course’s own system. No route from the plan to an instructor.

#### L04

**Draft and writing workspace.** Where the work is done: outline, focus, versions, recovery, sources with anchors, the integrity panel, and export — with AI rewriting never the default.

*Status.* tested, 9 of 12 capabilities present; phase 1.

- [x] Outline builder
- [x] Focus mode with break reminders
- [x] Version history of a document
- [x] Autosave and recovery, including whole-account snapshots
- [ ] Comments and feedback on a draft
- [x] Citation manager: keys, BibTeX and RIS export, gaps
- [x] Source cards and quotations with page anchors
- [x] Academic-integrity and course-AI-policy panel
- [ ] Accessibility checks on a document
- [ ] Document-format and submission checklist
- [x] Export to DOCX and PDF
- [x] AI modes that never rewrite by default

| Evidence | Shows |
| --- | --- |
| `app/src/lib/draft.test.ts` | autosave and recovery |
| `app/src/lib/doctools.test.ts` | the outline |
| `app/src/lib/sources.test.ts` | cite keys, BibTeX, gaps and completeness |
| `app/src/lib/toolkit/research.test.ts` | RIS and BibTeX export; verify and audit |
| `app/src/lib/quotes.test.ts` | quotations located in the source; no scoring, no plagiarism guessing |
| `app/src/lib/toolkit/disclosure.test.ts` | the AI-use declaration per assignment |
| `app/src/lib/docx.test.ts` | DOCX export |
| `app/src/lib/pdf.test.ts` | PDF export |
| `app/src/lib/socratic.test.ts` | the modes, and the policy cap on the top rung |

*Gap.* No comments on a draft, and no accessibility or format check on the document itself; the assignment workspace’s submission checklist is a short list of prompts, some shown only when the assignment has sources or the course needs an AI-use declaration, and none of them a check on the document (“Headings in order, figures described, links named” is a reminder). Write deliberately does not format bibliographies.

#### L05

**Study Studio.** Turns authorized material into active learning, and every generated item says where it came from, that it is generated, and what the course policy allows.

*Status.* tested, 13 of 16 capabilities present; phase 1.

- [x] Source-grounded summaries with page and slide anchors
- [x] Vocabulary: terms matched to definitions
- [x] Flashcards with explainable spaced repetition
- [x] Practice questions with feedback
- [x] Teach-back mode
- [x] Concept maps
- [x] Worked-example mode
- [x] Problem decomposition
- [ ] Formula and reference sheet
- [ ] Lecture-note organizer
- [x] Audio notes and transcripts
- [x] Study-session planner
- [ ] Focus timer
- [x] Confidence reflection: confident misses and lucky guesses
- [x] Tutor, library and writing-centre handoff
- [x] Every generated item shows its source, its generated status and the course policy

| Evidence | Shows |
| --- | --- |
| `app/src/lib/studystudio.test.ts` | exact quotes per section; page numbers never invented |
| `app/src/components/StudyStudio.anchors.test.tsx` | a PDF page becomes a citation locator |
| `app/src/lib/fsrs.test.ts` | FSRS scheduling |
| `app/src/lib/revise.test.ts` | what to revise in the time you have, and why it is due |
| `app/src/lib/quiz.test.ts` | choice, true-or-false and matching from cards |
| `app/src/lib/teachback.test.ts` | teach-back with no grade |
| `app/src/lib/solve.test.ts` | a problem decomposed |
| `app/src/lib/sure.test.ts` | confidence calibration |
| `app/src/lib/transcribe.test.ts` | a live transcript becomes course material |
| `app/src/lib/courserules.test.ts` | the study gate: what the course’s AI rules allow a study guide to do |

*Gap.* No reference sheet, lecture-note organizer or focus timer (the app says in `lib/doing.ts` that there is none to be findable).

#### L06

**Course-resource intelligence.** Helps students find the right materials without exposing private content: what kind of source it is, who may use it, and what it is used in.

*Status.* tested, 6 of 10 capabilities present; phase 1.

- [x] Search by concept, unit or reading
- [ ] Search by week, outcome or assignment
- [x] Source type shown: institution-verified, imported, student-entered, estimated, needs review
- [x] Access rights per material, including whether AI may use it
- [ ] Access expiry on a material
- [x] “Used in” relationships on a source
- [x] Citations and page anchors
- [x] Duplicate detection at import
- [ ] Outdated-version flag on a course material
- [ ] A recommendation of library, tutor or office-hours support when source coverage is weak

| Evidence | Shows |
| --- | --- |
| `app/src/lib/find.test.ts` | one ranker over units, cards and screens |
| `app/src/lib/source.test.ts` | the five labels, held to the database constraint |
| `app/src/lib/source-locker.test.ts` | AI use set per material |
| `app/src/lib/changeset.test.ts` | same and related items at import |
| `app/src/lib/unity.ts` | SourceDetail: origin, freshness, visibility, limitations and used-in |

*Gap.* No week or outcome facet (STU-009), no expiry or outdated flag on a course material, and no weak-coverage handoff.

### Assessment and grading tools

#### L07

**Assessment builder.** Faculty need to create assessments without a separate tool: banks, versions, tags, blueprints, pools, previews and QTI 3 in and out.

*Status.* tested, 6 of 12 capabilities present; phase 2.

- [x] Question banks and reusable item libraries, as rules: an item is validated, reviewed and drawn only when approved (nothing stores a bank)
- [x] Question versioning: an edit is the next version, back in draft with its review cleared
- [ ] Tags: course, outcome, topic, difficulty, cognitive level, accessibility review
- [ ] Shared stimuli
- [ ] Rubrics attached to items
- [x] Assessment blueprints: slots by outcome, tag and kind, refused when the bank cannot fill one
- [x] A seeded random draw of a practice paper, re-sittable from its code
- [ ] Sections and rules
- [x] Practice is always labelled practice, never an official assessment
- [ ] Question, student and accessibility previews
- [ ] QTI 3 import and export
- [x] Five of the document’s nineteen question types: choice, true-or-false, matching, short answer, essay

| Evidence | Shows |
| --- | --- |
| `app/src/lib/exam.test.ts` | the paper shape, marks, the seeded draw and the clock |
| `app/src/lib/studystudio.ts` | STUDY_FORMATS: a paper is practice, never an official assessment |
| `docs/QTI-3-ASSESSMENT-AND-MIGRATION.md` | the interaction library against the five kinds the app has |
| `app/src/lib/itembank.test.ts` | an item is approved only by someone other than its author; only an approved, unexpired, newest version is drawn; a test is rebuilt from its seed in any bank order; a written answer is never scored |

*Gap.* Rules only, in app/src/lib/itembank.ts: nothing stores an item or a bank, no screen authors one, there is no difficulty or cognitive-level tag, shared stimulus, preview or section, and no QTI (LMS-008, INT-007); the QTI page says what present would mean.

#### L08

**Assessment delivery engine.** Timed online testing can create accessibility barriers; delivery supports accommodations, practice, accessible formats and alternatives rather than one timed format.

*Status.* tested, 8 of 15 capabilities present; phase 2.

- [x] Timed and untimed practice, on the wall clock, which never takes anything away
- [ ] Availability windows and time zones
- [ ] Multiple graded attempts
- [x] Practice attempts
- [x] Question randomization
- [ ] Section sequencing
- [x] Save and resume, and autosave, on the device
- [x] A submission receipt, on the device
- [x] A late policy with a per-day penalty and a cap
- [ ] Accommodation-aware timing and availability
- [ ] Make-up and alternative-assessment workflow
- [ ] Offline contingency instructions
- [x] Secure browser or proctoring only by institutional decision: no unapproved proctoring or surveillance
- [ ] Incident or report-issue button
- [x] Accessibility preferences, chosen and never inferred

| Evidence | Shows |
| --- | --- |
| `app/src/lib/examattempt.test.ts` | autosave, resume, the seed, the wall clock, the receipt; time up takes nothing away |
| `app/server/institution/sandbox.ts` | LatePolicy {perDay, cap} and penalty() |
| `app/src/lib/ops/boundaries.test.ts` | no emotion or facial analysis; no unapproved proctoring or surveillance |
| `app/src/lib/accessmode.ts` | the access modes, user-chosen and never inferred |
| `supabase/migrations/20260926150000_expansion_roles_and_features.sql` | accommodation_passports and shares, never applied to anything yet |

*Gap.* A practice paper with no server authority: no windows, attempts, sections or enforced timing, and no accommodation applied to timing or format (LMS-008, LMS-009, LMS-010).

#### L09

**Rubric engine.** Rubrics are first-class structured data, not a PDF attachment: criteria, levels, points, outcome mapping, student-facing language, versions and calibration.

*Status.* tested, 6 of 14 capabilities present; phase 2.

- [x] Criterion with a name, marks out of, and what it means
- [x] Performance levels, each with its points and its descriptor
- [x] Points
- [x] Learning-outcome mapping: points and their maximum roll up to each outcome
- [ ] Instructor annotations
- [x] Student-facing language, published before work starts
- [ ] Exemplars
- [ ] Accessibility notes
- [ ] Reusable templates
- [ ] Version history
- [ ] Calibration mode
- [ ] Rubric preview
- [x] Student self-assessment against the rubric, never a grade prediction
- [ ] Peer-review version

| Evidence | Shows |
| --- | --- |
| `app/server/institution/sandbox.ts` | Criterion {id, name, outOf, means}; the total is the sum; a box left empty is refused |
| `app/server/institution/sandbox.test.ts` | the rubric: refuses a mark the rubric cannot carry; will not accept a rubric with a box left empty |
| `app/src/lib/toolkit/rubric.test.ts` | the student checklist and its disclaimer |
| `app/src/lib/assignment.test.ts` | the rubric extracted from an assignment brief, with weights |
| `app/src/lib/rubricengine.test.ts` | a rubric is scored by level per criterion; an unscored criterion, an unknown level or another version is refused; a rubric with an empty box is refused |

*Gap.* Rules only, in app/src/lib/rubricengine.ts: levels, outcome roll-up and a version a mark must match. The sandbox still holds the criteria the grading loop reads, and no rubric table exists in the database (LMS-006 designed): no stored version history, templates, exemplars or calibration.

#### L10

**Gradebook.** Transparent to students, powerful for instructors, and never presenting a speculative number as an official final grade.

*Status.* tested, 15 of 20 capabilities present; phase 2.

- [x] Assignment groups and weights
- [x] Points, percentages and letters
- [ ] Competency or mastery scales
- [x] Drop-lowest rules
- [x] Excused work: left out of the calculation, never counted as zero
- [x] Manual overrides with a reason and an audit record: a change after release is a new version with a kept reason
- [x] Late-policy rules
- [x] Missing and incomplete status
- [x] Grade release controls
- [ ] Anonymous grading mode
- [ ] Group grading with individual adjustments
- [x] Rubric-linked scoring
- [x] Comment feedback
- [ ] Audio or video feedback
- [x] Export
- [x] Grade history: every version is kept and never edited
- [x] Final-grade calculation preview: what-if, what is needed, the swing
- [ ] Student-view preview for the instructor
- [x] LMS sync controls: an institution-gated passback
- [x] The student view says its standing is an estimate from released grades only, what is included, what changes it, and the next action

| Evidence | Shows |
| --- | --- |
| `app/src/lib/grades.test.ts` | category weights, standing, what is needed and what is reachable |
| `app/src/lib/drop.test.ts` | drop-lowest |
| `app/src/lib/whatif.test.ts` | supposing, the swing, then-needs |
| `app/src/screens/suppose.test.tsx` | nothing here is saved or counted anywhere |
| `app/src/screens/grades.test.tsx` | the grades screen |
| `app/server/institution/sandbox.ts` | weight, missing and overdue status, release control; the student standing counts only released marks |
| `app/src/lib/ltigate.test.ts` | the passback gate: kill switches, the writeback flag, an approved connection, the scope |
| `app/src/lib/source.test.ts` | the estimated label |
| `app/src/lib/gradebook/gradebook.test.ts` | weights and drop-lowest, excused work left out and missing counted as zero, a change after release needs a reason, no version ever edited or removed, a student sees only their own released grade |
| `app/src/lib/gradebook/passback.test.ts` | passback sends the released version and never a newer draft, once, and stops when the gate closes |
| `supabase/gradebook.check.sql` | the gradebook tables allowed and denied at the database |

*Gap.* An instructor gradebook of record now exists (app/src/lib/gradebook and supabase/migrations/20260929310000_gradebook.sql; this register does not assert the migration is applied), beside the student’s own grades.ts. The sandbox that stood in for it is still in the tree. Not present: anonymous grading, group grading with individual adjustments, mastery scales, audio or video feedback, and a student-view preview for the instructor (LMS-011, LMS-013, LMS-014).

#### L11

**Grading workflow.** Submission → receipt → rubric scoring → feedback → review → controlled release → student question → audited change → optional sync: every grade has a clear, reviewable human and system trail.

*Status.* tested, 8 of 13 capabilities present; phase 3.

- [x] Submission with an idempotent receipt and a version check
- [ ] Automated integrity and accessibility checks on arrival
- [ ] Anonymous grading assignment
- [x] Rubric scoring, criterion by criterion
- [x] Feedback comments
- [ ] Audio, video or annotation feedback
- [ ] Calibration and moderation
- [x] Grade review before release: nothing is released before it is marked
- [x] Controlled release: a mark is shown to nobody until it is released
- [ ] Source-linked feedback the student receives
- [x] A student request for review through a policy workflow: the appeal
- [x] A grade-change audit trail: every action in the record’s history, with the prior mark kept
- [x] Optional sync to the LMS: quiz scores over AGS, gated

| Evidence | Shows |
| --- | --- |
| `app/server/institution/sandbox.ts` | the stage machine: published → submitted → graded → released → archived, and what it refuses |
| `app/server/institution/sandbox.test.ts` | runs enrol → submit → receipt → mark → release → archive; keeps the order; shows a mark to nobody until it is released; an appeal |
| `app/src/lib/ltiags.test.ts` | the AGS score post |
| `docs/LMS-INTEROPERABILITY-MATRIX.md` | the grade write, preview to audit, at what the AGS post has today |
| `app/src/lib/gradebook/gradebook.test.ts` | a draft held for moderation by a second person and then released; a regrade request filed over a released grade and resolved once |

*Gap.* The grading loop now exists in the gradebook of record (draft, moderation by a second person, release, regrade request, a kept reason for every change, passback of released versions through an LmsAdapter): calibration, anonymous assignment, annotation feedback and automated checks on arrival are not present, no implementation of the LmsAdapter is in the tree, and the submission side is still the labelled sandbox (LMS-012, LMS-013, INT-005).

### AI, integrity and analytics

#### L12

**AI in assessment and grading.** AI can assist; it must never silently become the grader. Each use case has a permitted role and a required human control.

*Status.* tested, 6 of 10 capabilities present; phase 4.

- [x] Rubric drafting: criteria and weights suggested from the brief, for the student’s checklist
- [x] Question generation from course material, with citations
- [ ] Faculty review of generated questions for accuracy, bias and accessibility
- [x] Practice feedback, labelled as generated, citing course sources, never an official grade
- [x] Writing feedback that identifies rubric gaps and never rewrites invisibly
- [ ] Instructor feedback draft from rubric inputs, edited and approved before release
- [ ] Grading assistance: possible rubric evidence flagged for a human to validate
- [ ] Integrity support: unusual patterns highlighted for human investigation
- [x] Accessibility support: read-aloud of generated material
- [x] No AI-only final grade, held by the absence of any grading tool

| Evidence | Shows |
| --- | --- |
| `app/src/lib/assignment.test.ts` | the rubric extracted; critique names gaps and does not rewrite |
| `app/src/lib/quiz-feedback.test.ts` | the reasons a practice answer is marked as it is |
| `app/src/lib/teachback.test.ts` | no grade |
| `app/src/components/spokenlesson.test.tsx` | a lesson read aloud |
| `docs/operating-model/AI-GRADING-AND-INTEGRITY.md` | the roles matrix at the lifecycle gates, and the two rules at the code |

*Gap.* Nothing that helps a grader: no feedback draft, evidence spotting or integrity signal; and no intake refusal names automated grading (AI-006, AI-007). The one faculty-side review rule for AI-drafted material is `app/src/lib/itembank.ts` (a reviewer other than the author, an accessibility review, and the model, prompt version and editor named), which has no accuracy or bias review and is wired to no screen.

#### L13

**Academic-integrity layer.** Integrity as clarity and learning support, not surveillance: policy, disclosure, citation checks, version history, a human review, an appeal, and never an automatic accusation.

*Status.* tested, 9 of 12 capabilities present; phase 3.

- [x] Course-specific policy panel: assignment → course → school → university precedence
- [x] Assignment-specific AI-use declaration
- [x] Citation expectations: verify and audit
- [x] Version history of a student’s drafts
- [x] Authorship and process reflection: the attestation
- [x] Permitted-tool disclosure
- [x] Source and citation checks against the material
- [ ] Similarity or originality integration, if the institution chooses
- [ ] Instructor review queue
- [x] Student explanation and appeal: the sandbox appeal with a reason
- [ ] Integrity education modules
- [x] No automatic accusation or penalty: the forbidden measure

| Evidence | Shows |
| --- | --- |
| `app/src/lib/toolkit/policy.test.ts` | the precedence; an unknown policy is unavailable, not allowed |
| `app/src/lib/toolkit/disclosure.test.ts` | the declaration and its attestation |
| `app/src/lib/toolkit/research.test.ts` | verify and audit |
| `app/src/lib/cite.test.ts` | quotes checked against the source |
| `app/src/lib/institution-ops.test.ts` | refuses a metric that sources a forbidden measure, among them automated integrity accusations |
| `app/src/lib/toolkit/safety.test.ts` | answers for an assessment are refused and redirected |
| `GRADESCOPE-TURNITIN.md` | no legitimate route to Gradescope; Turnitin’s API is a partnership |

*Gap.* The declaration is stored on the device and never submitted; no similarity integration, review queue or education module (AI-007).

#### L14

**Learning analytics, the ethical version.** Useful faculty insight without hidden student-risk scores, click-behaviour interventions, employer access, emotion surveillance or opaque ranking.

*Status.* tested, 7 of 14 capabilities present; phase 4.

- [x] Aggregated patterns only, above a floor of ten
- [ ] Assessment item quality: difficulty, discrimination, distractors
- [ ] Rubric and learning-outcome performance
- [ ] Feedback turnaround time
- [ ] Resource and help-route usage
- [ ] Accessibility issue reports
- [ ] Course-content freshness
- [ ] Assessment technical errors
- [x] Prohibited: hidden student-risk scores
- [x] Prohibited: automated intervention on click behaviour
- [x] Prohibited: employer access to learning analytics
- [x] Prohibited: emotion or sentiment surveillance
- [x] Prohibited: opaque engagement ranking
- [x] Prohibited: accommodation or basic-needs data in performance prediction

| Evidence | Shows |
| --- | --- |
| `app/src/lib/institution-ops.test.ts` | refuses a per-student grain and every forbidden measure: risk scores, mouse and keystroke tracking, attention inference, AI usage, integrity flags, wellbeing scores, location |
| `app/src/lib/cohortfloor.test.ts` | the floor of ten, in the app and in every migration |
| `app/src/lib/ops/boundaries.test.ts` | no emotion or facial analysis |
| `app/src/lib/governance/module-privacy.ts` | AI never infers mental health, financial distress, disability, academic risk, immigration status or misconduct risk |
| `app/src/lib/serviceregister.ts` | what an employer never receives |
| `app/src/donotbuild.test.ts` | no unexplained score, risk label or recommendation |
| `app/src/lib/toolkit/recommend.test.ts` | GPA and risk scores stripped before a recommendation |

*Gap.* Every prohibition is held; none of the useful measures exists (LMS-017): no item quality, outcome performance, turnaround, usage, accessibility reports or freshness.

## The student grade view

What the student always sees, so a speculative number is never presented as
an official final grade. The app’s what-if screen says the same in its own
words: nothing here is saved or counted anywhere.

| Line | Example |
| --- | --- |
| Current standing | Estimated, based on released grades only |
| Included | Assignments and weights currently released |
| Not included | Unreleased work, future assessments, instructor adjustments, and institution-specific final-grade rules |
| What changes this | Upcoming assessment weight, missing work, replacement rules, drop-lowest rule, or instructor updates |
| Next action | Review feedback on Essay 1 and attend office hours if needed |

## AI modes: the document’s eight against the tutor’s five

The tutor has `explain`, `hint`, `practice`, `review`, `draft`. Each mode the document asks for names the one that carries it, or says none does; the test holds the names to the tutor’s list.

| Mode | Carried by | Note |
| --- | --- | --- |
| Plan | — | The planner is `lib/assignment.ts`, not a tutor mode (AI-008: no Plan mode). |
| Explain | `explain` | The default. |
| Ask questions | `hint` | The Socratic ladder, one rung per reply. |
| Check requirements | — | critique in `lib/assignment.ts` does this outside the tutor. |
| Give feedback | `review` | The feedback contract: what is right, one misconception, one question, the source. |
| Cite sources | — | Citations are a property of Study Studio output, not a mode; Ask answers carry none (AI-005). |
| Improve accessibility | — | No mode. |
| Draft with disclosure, where allowed | `draft` | Governed by the course policy; the declaration is `lib/toolkit/disclosure.ts`. |

## The study and AI learning tools

The second document’s eighteen tools, each with its source and safety control; 14 have something in the tree, and each names the file.

| Tool | What it does | Source and safety control | Have | Note |
| --- | --- | --- | --- | --- |
| Teach-back coach | The student explains a concept; the system identifies gaps and asks follow-up questions | Uses authorized material; says “review this”, not “you failed” | `app/src/lib/teachback.ts` | No grade. |
| Retrieval practice generator | Makes quizzes and flashcards from selected course sources | Shows the original source anchors and allows correction | `app/src/lib/quiz.ts` | Choice, true-or-false and matching from cards. |
| Spaced-repetition planner | Schedules review from student-selected confidence and deadlines | The student controls the cadence; no pressure streaks | `app/src/lib/revise.ts` | FSRS, with why-it-is-due and exam-deadline weighting; the pressure mechanic the document forbids is refused deliberately in `lib/weekly.ts`. |
| Worked-example tutor | Walks through a representative solution step by step | Labels example against graded work; follows course policy | `app/src/lib/solve.ts` | Problem decomposition; readExamples in `lib/study.ts`. |
| Error-analysis coach | Helps the student categorize why a practice answer was wrong | No ability or intelligence labels | `app/src/lib/learning-loop.ts` | classifyMistake, eight kinds; repeated mistakes in `lib/again.ts`. |
| Concept-map builder | Connects terms, claims, evidence, formulas and outcomes | Editable graph; a source card on every generated connection | `app/src/lib/studystudio.ts` | The map format; a mastery graph in `components/MasteryGraph.tsx`. Not editable. |
| Reading companion | Breaks a long reading into sections, vocabulary, questions and notes | Preserves citations and page anchors; supports text-to-speech | — | A reading plan and progress exist (`lib/reading.ts`); no in-reading companion. |
| Lecture companion | Syncs slides, notes, transcript, timestamps and study prompts | Requires an authorized recording; respects instructor policy | — | A transcript becomes course material (`lib/transcribe.ts`); nothing syncs slides or timestamps. |
| Problem-set planner | Breaks a problem set into effort estimates and support checkpoints | No solution delivery when course policy restricts it | `app/src/lib/assignment.ts` | Steps with minutes; the policy cap in `lib/socratic.ts`. |
| Exam readiness planner | Builds a study schedule from scope, date and availability | Labels estimates; supports accessibility and quiet hours | `app/src/lib/study-readiness.ts` | With the readiness forecast in `lib/learning-loop.ts`. |
| Office-hours agenda builder | Creates a concise question list from confusion points | The student chooses what to share | `app/src/lib/officeagenda.ts` | A question list from the student’s private questions, filed feedback and review-later concepts, each ticked by the student and none pre-selected; copied or saved as text, never sent. Sources are not attached to it yet, and `lib/officehours.ts` remains a nudge about when to go. |
| Feedback-to-revision coach | Turns released feedback into a revision checklist | Uses only the student’s released feedback and selected sources | `app/src/lib/feedbackloop.ts` | Works from comments the student files and the category they choose, and turns each into optional next steps they add to their plan by hand; nothing is read from released gradebook feedback, and no action is inferred from the comment text. `critique` in `lib/assignment.ts` compares a draft to the rubric. |
| Citation coach | Explains attribution and source quality; builds a bibliography draft | The student verifies every citation before use | `app/src/lib/toolkit/research.ts` | verify and audit; Write does not format bibliographies by design. |
| Accessibility transformation | Read aloud, captions, plain-language restatement, format checks | Identifies transformations; preserves original access | `app/src/components/StudyStudio.tsx` | Read-aloud; captions on the podcasts; no plain-language restatement or format check. |
| Study-group kit | Shared agenda, roles, practice prompts and resources | Consent-based sharing; no grade or analytics exposure | `app/src/lib/groupwork.ts` | A group-project split; community sessions; no kit. |
| Lab or studio notebook | Time-stamped notes, observations, methods, data links and reflection | Permissions, export and integrity controls | — | None. |
| Formula and reference builder | Student-authored, instructor-approved study sheets | Course-policy and assessment-permission label | — | None. |
| Metacognition journal | Records goals, confidence, strategy and reflection | Private by default; no behavioural scoring | `app/src/components/StudyJournal.tsx` | With calibration in `lib/sure.ts` and what-worked in `lib/worked.ts`. |

### Advanced learning features (4 of 8)

| Feature | What | Have | Note |
| --- | --- | --- | --- |
| Prerequisite refresher paths | Short instructor-approved bridge modules before difficult topics | — | A prompt line in the tutor; the service register marks the bridge plan absent. |
| Misconception library | Faculty-curated common misunderstandings with source-linked corrections | — | Repeated mistakes are tracked per student; no library. |
| Adaptive practice with transparent rules | The next item chosen by coverage, confidence, prior response and exam scope — not opaque risk prediction | `app/src/lib/interleave.ts` | With `lib/pretest.ts` and recommendLearningActivity in `lib/learning-loop.ts`. |
| Learning-outcome navigator | Which modules, assignments, practice items and feedback connect to each outcome | — | Student mastery only; no outcome authoring or mapping (LMS-015). |
| Feedback digest | Released feedback summarized into student-controlled patterns | `app/src/lib/feedbackloop.ts` | Themes across the student’s own filings, spoken only above a floor of three and never ranked (`themes` in `lib/feedbackloop.ts`), kept private on the device; the filings are not read from released gradebook feedback. |
| Study workload balancer | A realistic plan across courses from deadlines and declared availability, assumptions visible | `app/src/lib/ahead.ts` | Week pressure, pace and work windows. |
| Academic-integrity rehearsal | Practice citation, paraphrase, collaboration and disclosure decisions without punitive grading | — | None. |
| Exam wrapper | Strategy before, reflection after, without labelling capability | `app/src/lib/postmortem.ts` | Why marks were lost, and those units brought forward. |

## Standards and integrations

| Need | Recommended approach |
| --- | --- |
| Launch into an external LMS | LTI 1.3 / LTI Advantage |
| Course roster and roles | LTI Names and Role Provisioning Service, or OneRoster |
| Gradebook exchange | LTI Assignment and Grade Services |
| Assessment portability | QTI 3.0 |
| Outcomes and competencies | CASE, when competency workflows are mature |
| Identity | OIDC or SAML, and SCIM |
| SIS grades | An institution-approved integration; preview and audit required |
| Calendar | iCal or CalDAV, or an approved Google or Microsoft connector |
| Content migration | Imports with source, ownership and rights validation |
| Analytics | A privacy-governed event architecture; Caliper only when justified |

**Every external grade write is an explicit, previewable, auditable action — never a silent background sync.** The [LMS interoperability matrix](LMS-INTEROPERABILITY-MATRIX.md) holds the grade write, preview to audit, at what the AGS post has today.

## Backend services and the gradebook data model

The critical services: identity and tenant context; course, enrollment and role; content and versioning; assignment and submission; assessment and qti; attempt, timing and accommodation; rubric and grade calculation; feedback and annotation; gradebook and grade-history ledger; integrity and policy; ai policy, retrieval and evaluation; notification and reminder; calendar and action sync; accessibility preference and accommodation application; analytics with privacy controls; integration gateway for lti, oneroster, sis and external lms; audit, evidence and retention.

The objects: Course, Enrollment, Assignment group, Assessment or assignment, Gradebook column, Grading scheme, Rubric and rubric version, Submission and submission version, Attempt, Accommodation application, Grade entry, Grade calculation, Feedback item, Grade release event, Override or adjustment, Grade-change request, Appeal or review case, External grade-sync job, Audit event.

Every grade-related record includes:

- Tenant id
- Course and term
- Student or enrollment scope
- Authorized grader
- Rubric and version
- Source calculation
- Status: draft, graded, moderated, released, changed, synced
- Timestamp
- Reason for override or change
- Audit correlation id
- Retention classification

## What to build, in order

### Phase 1: Work completion and study value

- Course Home
- Syllabus review and approval workflow
- Assignment planner and milestones
- Action and calendar integration
- Draft workspace with recovery
- Study Studio with source-grounded learning aids
- Office-hours, tutor, library and writing-centre handoffs
- Accessibility preferences and document checks

### Phase 2: Native assessment foundation

- Assignment submission
- Rubrics
- Manual grading and feedback
- Basic gradebook
- Student grade view with estimate labels
- Grade-release controls
- Submission receipts and version history
- Accommodation-aware timing and availability
- QTI import and export foundation

### Phase 3: Full instructor workflow

- Question banks
- Assessment builder
- Item pools and randomization
- Multiple assessment types
- Anonymous grading
- TA, calibration and moderation
- Group work and peer review
- Late-policy engine
- Grade-change and appeal workflow
- LTI AGS and SIS or LMS controlled sync

### Phase 4: Advanced learning value

- Spaced repetition
- Adaptive practice, with transparent logic
- Skills and outcomes mapping
- Item analytics
- Portfolio and project assessment
- Credential evidence
- AI feedback assistance with human approval
- Course-level AI policy configuration

### Phase 5: High-risk and specialized capabilities

- Proctoring integrations
- Secure browser
- Coding sandboxes
- Adaptive testing
- Advanced psychometrics
- Oral and video assessment
- External credential issuance

Only launch these after dedicated accessibility testing, assessment-security controls, privacy and legal review, support capacity, and clear institutional operating models.

The second document orders its own six priorities:

1. Source-grounded work completion: assignment breakdown, rubric checklist, source cards, draft and revision history, submission receipt, recovery centre.
2. Study Studio: teach-back, retrieval practice, spaced repetition, reading and lecture companion, feedback-to-revision, accessibility tools.
3. Source-aware gradebook: structured rubrics, criterion-level feedback, audit ledger, release controls, student grade estimate with limits, regrade workflow.
4. QTI 3 assessment core: item bank, import and export, accessible interaction patterns, versioned scoring, delivery, item analytics.
5. Human-governed AI assistance: course policy engine, grounded generation, feedback drafting, evidence spotting, integrity review — not AI-only grades.
6. Advanced practice and outcomes: transparent adaptive practice, misconception library, learning-outcome navigator, portable evidence and credentials.

## Release criteria for consequential grading

- [ ] A named course or institution owner, and authorized grader roles.
- [ ] Rubric version and assignment settings locked or versioned.
- [ ] Student preview and an accessible alternative path verified.
- [ ] Accommodation rules applied and tested.
- [ ] Submission autosave, receipt, recovery and audit trail tested.
- [ ] Grade calculations independently tested, including edge cases.
- [ ] Grade visibility and release behaviour tested from the student view.
- [ ] Override and change workflows require a reason and are audited.
- [ ] No AI-only final grades or automated misconduct decisions.
- [ ] An appeal and review process configured and visible to students.
- [ ] LTI or SIS grade sync, if enabled, is previewable, permissioned, retry-safe, reconcilable, and reversible where the destination permits.
- [ ] Backup, export, retention and incident runbooks tested.

The strongest learning platform is not the one with the most quizzes. It is
one where students understand what they are learning, can complete work
accessibly, receive useful feedback, recover from mistakes, and trust that
every grade has a clear, reviewable human and system trail.
