# LMS and learning roadmap: where the app stands

Three planning documents asked Semester to become the most attractive LMS
against Canvas, Brightspace and Blackboard, using what works in Duolingo,
Quizlet and Khanmigo while avoiding their traps:

- the sortable UX comparison,
- the UX heuristic matrix,
- "expand Semester's LMS capabilities".

This page checks each thing they ask for against the code as of 27 September
2026. Paths are under `app/src/`. Status is one of:

- **exists**: built and tested.
- **partial**: there is something, with the gap named.
- **missing**: nothing yet.

## What this change built

**The tutor now tutors** (`lib/socratic.ts`). The Ask screen already had a mode
picker (Explain, Hint, Practice, Review, Draft), but on the local path the
chosen mode never reached the system prompt, so Hint answered like Explain.
The picker was also hidden unless the institution gateway was on. Now:

- **Hint** runs the documents' Socratic decision order:
  - policy first;
  - then whether the student needs the idea before the problem;
  - then whether they have tried;
  - then whether the wrong turn is a missing prerequisite;
  - then a transfer problem once they succeed.

  It climbs the 0–7 hint ladder one rung per reply.
- **Practice** and **Review** follow the documents' feedback contract. Each
  reply:
  1. says what in the student's reasoning is right;
  2. names one misconception;
  3. asks one question;
  4. names its source.
- **Human help.** When the ladder runs out, the tutor names office hours,
  tutoring, the writing centre and the library, rather than giving the answer.
- **Policy limits.** The top rung (the direct answer) is governed by the AI
  policy the student recorded for the course. It uses the same resolver as the
  toolkit (`lib/toolkit/policy.ts`), so:
  - Any course in view caps the tutor at rung 6.
  - A course with no recorded policy keeps every mode but never gives the
    final answer.
  - A course that bans AI offers no mode and lists only the non-AI
    alternatives.
- **Explain** is untouched. It is the default, and it is what every question
  got before.

## Item by item

### Tutor and learning intelligence

| Item | Status | Where / gap |
|---|---|---|
| Socratic decision order | exists | `lib/socratic.ts` `STEPS` |
| Hint ladder 0–7 in Ask | exists | `lib/socratic.ts` `RUNGS`. The offline quiz ladder is `lib/ladder.ts` |
| Feedback contract | exists | `lib/socratic.ts` `FEEDBACK` |
| Tutor modes | partial | explain / hint / practice / review / draft exist. No separate research, prepare or escalate modes; escalation is inside Hint |
| Course → assignment AI-policy engine | partial | `lib/toolkit/policy.ts` resolves assignment → course → school → university. Only the student-recorded course layer has data; no program layer |
| Human-help handoffs | partial | `lib/help-routes.ts`, `components/GetHelp.tsx`. The tutor names them, but `open_screen` cannot reach the University screen |
| Explainable spaced repetition | exists | FSRS in `lib/fsrs.ts`. "Why it is due" and exam-deadline weighting in `lib/revise.ts`. 25-card sitting cap in `lib/review.ts` |
| Confidence check | partial | `lib/sure.ts`: three levels (guess / think / know), not 1–5 |
| Mistake notebook | exists | `components/StudyJournal.tsx`, `lib/again.ts`, `lib/learning-loop.ts` |
| Objective / prerequisite graph | partial | Units only. Concept prerequisites are demo data (`lib/flight-plan.ts`). No objective → assignment map |

### Motivation design

| Item | Status | Where / gap |
|---|---|---|
| No streaks, XP or leaderboards | exists | Refused deliberately; see `lib/weekly.ts`, `lib/you.ts` |
| Readiness shown with its evidence | exists | `readinessForecast` in `lib/learning-loop.ts` |
| Personal weekly goals, no penalty | missing | `lib/weekly.ts` looks back only |

### Grades and assessment

| Item | Status | Where / gap |
|---|---|---|
| What-if grade planner | exists | `lib/whatif.ts`, `components/Suppose.tsx` |
| Assessment autosave and recovery | partial | `lib/draft.ts` covers essays and solutions; `screens/Exam.tsx` answers are in memory only |
| Submission receipts | missing | |

### Instructor tools

| Item | Status |
|---|---|
| Course Studio (instructor authoring) | missing |
| Question banks | missing |
| Instructor rubrics | missing |

### Interoperability and strategy

| Item | Status | Where / gap |
|---|---|---|
| LTI 1.3 / Advantage | partial | Launch, Deep Linking and Assignment and Grade Services exist (`lib/lti*.ts`, `supabase/functions/lti`). Names and Role Provisioning Services (NRPS, the roster service) does not; launches check the school's own membership table instead |
| QTI / Common Cartridge import | missing | |
| Duolingo / Quizlet / Khanmigo matrix route | missing | The documents themselves call it "future" |

## Suggested order for what is left

The order follows the documents' phases: student layer, then teaching layer,
then assessment layer.

1. ~~**Exam autosave and a submission receipt.**~~ **Done, 28 Sep 2026.** The
   practice paper is kept on the device through `lib/examattempt.ts` (its own
   slot rather than a draft: the questions, the seed and the clock go with the
   answers), offered back on Setup, and receipted when finished. The clock is
   the wall clock, so a paper closed with twelve minutes left and reopened an
   hour later has none — which is what a paper does.
2. **Let `open_screen` reach Get help,** so the tutor's handoff is a button
   rather than a sentence.
3. **Objective map:** unit → objective → assignment. The objective map, the
   prerequisite graph and the "how does this help my assignment" link all
   depend on it.
4. **Personal weekly goals** with no penalty for missing one.
5. **Course Studio, question banks and QTI / Common Cartridge.** This is the
   faculty layer, and the largest piece.

## Read next, 28 September 2026

Seven further documents of 28 September are held to the tree as data with a
test each, the way this page checked its three:
[`LEARNING-ASSESSMENT-GRADEBOOK-REGISTER.md`](LEARNING-ASSESSMENT-GRADEBOOK-REGISTER.md)
covers the fourteen areas, the faculty side included, capability by capability;
[`QTI-3-ASSESSMENT-AND-MIGRATION.md`](QTI-3-ASSESSMENT-AND-MIGRATION.md) says
what "QTI import" and "question banks" above would have to mean;
[`LMS-INTEROPERABILITY-MATRIX.md`](LMS-INTEROPERABILITY-MATRIX.md) is the
four-LMS comparison and the grade write, preview to audit;
[`operating-model/AI-GRADING-AND-INTEGRITY.md`](operating-model/AI-GRADING-AND-INTEGRITY.md)
is AI's place in grading; and
[`ONE-SYSTEM-PLATFORM-GRAMMAR.md`](ONE-SYSTEM-PLATFORM-GRAMMAR.md) is what
makes the whole feel like one system.

## The thirteen layers

The capability map in the "expand" document is organised as thirteen layers
rather than as the items above. This section reads it that way, so the gap to
a full LMS can be seen in one table.

Semester today is a student companion that sits alongside an LMS, not an LMS
itself. Most course data is kept on the device, built from an imported
syllabus. The server tables `courses`, `enrollments` and `catalog_sections`
exist, but little of the app reads them. "Off" means the code exists behind a
switch that is off by default (`lib/experience-flags.ts`, `lib/flags.ts`).

| # | Layer | What exists | Standing | Largest gap |
|---|---|---|---|---|
| 1 | Course and enrollment | `lib/term.ts`, `lib/rollover.ts`, `screens/Import.tsx`, mock SIS in `lib/integration/` | Import reachable; SIS mock, off | Real SIS sync, sections, roster roles, course copy |
| 2 | Faculty Course Studio | The faculty role reuses Import, `EditCourse`, `toolkit/templates.ts`, `lib/docversions.ts` | Student tools, reused | Module builder, templates, publishing to students |
| 3 | Module and content delivery | `ReadingProgress`, `TravelPack`, `FlightPlanLearning` | Progress reachable; the rest off | Modules, prerequisites, conditional release |
| 4 | Assignments and submissions | `lib/assignment.ts`, `lib/groupwork.ts`, `toolkit/rubric.ts` | Student side only | Assignment builder, submission, receipts, grading workflow |
| 5 | Assessment engine | `lib/quiz.ts`, `lib/exam.ts`, `lib/pretest.ts`, `lib/interleave.ts` | Self-practice only | Question banks, timing, accommodations, QTI |
| 6 | Gradebook and feedback | `lib/grades.ts`, `lib/whatif.ts`, grade passback in `lib/ltiscore.ts` | What-if reachable; passback off | Instructor gradebook, drop rules, grade history |
| 7 | Discussion and collaboration | `lib/rooms.ts`, `lib/roomchat.ts`, `lib/officehours.ts`, `lib/moderation.ts` | Reachable | Course discussions, peer review, office-hours sign-up |
| 8 | Outcomes and mastery | `lib/review.ts`, `MasteryGraph`, `lib/skills-graph.ts`, table `concept_evidence` | Mastery reachable; skills graph off | Outcome authoring, alignment, curriculum map |
| 9 | Learning intelligence and AI | `ai/converse.ts`, `lib/socratic.ts`, `lib/ladder.ts`, `lib/fsrs.ts`, `lib/again.ts`, `lib/toolkit/policy.ts` | Student side reachable; gateway off | A course AI policy that instructors set |
| 10 | Communication | `Calendar`, `lib/ics.ts`, `lib/notify.ts`, `Mail`, `TodayActionCenter` | Mostly reachable | Messages from instructors to students |
| 11 | Student success bridge | `GetHelp`, `HelpInbox`, `lib/help-routes.ts`, tables `accommodation_passports` and `consent_record` | Help reachable; `humanHelp` off | Booking; accommodations exist only in the schema |
| 12 | Institutional administration | `role_grants`, SCIM, `lib/governance/hierarchy.ts`, kill switches, audit tables | Server side; console off | An admin console in production |
| 13 | Interoperability and migration | LTI launch, Deep Linking and grade services (`supabase/functions/lti`), Canvas token (`lib/canvas.ts`) | Reachable through Connect | NRPS, OneRoster, QTI, Common Cartridge, Blackboard, content migration |

Read against the phases in the "expand" document, the student layers (9, 10
and 11) are ahead of the rest. Every layer that needs an instructor (2, 4, 6
and 7) waits on one precondition: the course record has to live on the
server rather than on each student's device. That makes it the largest item
not already in the list above. The quickest gain for institutions is layer
13: build NRPS, then take grade passback to production for one pilot school.

