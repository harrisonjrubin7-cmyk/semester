# LMS capability map: the blueprint against the repository

Source: *Sortable UX matrix: Duolingo vs Quizlet vs Khanmigo*, a 16-page
product brief that makes three claims:

1. On twenty UX dimensions, Semester's target is 5 everywhere Duolingo,
   Quizlet and Khanmigo sit between 1 and 5.
2. The tutor should be Socratic, with a decision tree, an eight-level hint
   ladder and a fixed feedback contract.
3. To be the platform an institution picks over Canvas, Brightspace and
   Blackboard, Semester needs thirteen layers of LMS capability, delivered
   in five phases.

This file records where each claim stands in the code on 27 September 2026.
It does not restate the brief. The status is what a read of the repository
shows, not what a planning document says.

## 1. The Socratic tutor: built in this change

| Brief | Where it is now |
| --- | --- |
| Ten intent types | `app/src/lib/socratic.ts`: `INTENTS` and `classifyIntent`, using keywords and no model, falling back to `explain` |
| Eight-level hint ladder (0–7) | `HELP_LEVELS`. Each integrity mode has a ceiling, and so does the course. The lower one wins |
| "Graded and direct solution prohibited → Guide mode only" | `helpCeiling`: no mode reaches level 7 on such a task. `taskPolicyFor` reads a course's recorded AI stance, and only `allowed` permits a direct answer. An absent or `unstated` stance counts as no, as it does everywhere else |
| Decision tree | `nextMove`: foundation → attempted? → succeeded? → prerequisite? → hint rung → worked example or a person |
| Feedback contract | `checkFeedback`: validate, one misconception, exactly one question, the source when a course is in context, and a person among the next actions |
| "No AI response without policy/source context in course mode" | The contract goes into the system prompt (`ai/prompt.ts`) for the effective mode. The course policy applies only to questions about the student's own coursework |

**The defect this fixed.** The integrity picker (Explain, Hint, Practice,
Review, Draft) has sat above the chat since the intelligence layer landed. The
mode it recorded was put on the request and on the answer card, but it was
never put in the system prompt. Hint answered exactly as Explain did.
`socratic.test.ts` checks the prompt side and the caller side of that seam.
Both checks were reverted to confirm they go red.

**Still open for the tutor.** The brief's wireframe needs two things this
change does not build: a guided-practice screen and the attempt diagnosis
that `nextMove` expects as input. Both need a structured attempt, not free
chat. `lib/ladder.ts` already gives the practice quiz course-built rungs
without a model, so the next step is to join the two: `nextMove` chooses the
rung, and `ladder.ts` builds it from the guide.

## 2. The prevention model

| Rule | Standing |
| --- | --- |
| No guilt streaks | Holds. The review scheduler's "streak" is FSRS bookkeeping and is not shown as something to protect. `counted` in `lib/revise.ts` explains why |
| No leaderboard pressure | Holds. There is no leaderboard or XP anywhere in `app/src` |
| No opaque mastery score | Partly. `components/MasteryGraph.tsx` shows the evidence behind it |
| No generic answer-first AI | **Now holds in Hint, Practice, Review and Draft** (section 1) |
| No unbounded review queue | See `lib/review.ts` and `lib/fsrs.ts`. Not re-audited here |
| No high-stakes action shown as complete before official confirmation | Holds: `ACTING` in `ai/prompt.ts`. Every tool is a proposal that the student confirms |

## 3. The thirteen layers

Semester today is a student-side companion that sits on top of an LMS, not an
LMS. Most course data is kept on the device, built from an imported
syllabus. The server tables `courses`, `enrollments` and `catalog_sections`
exist but are barely read. "Flagged off" means the code exists behind a
switch that is off by default (`lib/experience-flags.ts`, `lib/flags.ts`).

| # | Layer | What exists | Status | Largest gap |
| --- | --- | --- | --- | --- |
| 1 | Course & enrollment | `lib/term.ts`, `lib/rollover.ts`, `screens/Import.tsx`, mock SIS in `lib/integration/` | Import reachable; SIS mock, flagged off | Real SIS sync, sections, roster roles, course copy |
| 2 | Faculty Course Studio | The faculty role reuses Import, `EditCourse`, `toolkit/templates.ts`, `docversions.ts` | Reachable, but these are student tools | Module builder, templates, publish-to-students |
| 3 | Module & content delivery | `ReadingProgress`, `TravelPack`, `FlightPlanLearning` | Progress reachable; the rest flagged off | Modules, prerequisites, conditional release |
| 4 | Assignments & submissions | `lib/assignment.ts`, `lib/groupwork.ts`, `toolkit/rubric.ts` | Student side only | Builder, submission, receipts, grading workflow |
| 5 | Assessment engine | `lib/quiz.ts`, `lib/exam.ts`, `lib/pretest.ts`, `lib/interleave.ts` | Self-practice only | Question banks, timing, accommodations, QTI |
| 6 | Gradebook & feedback | `lib/grades.ts`, `lib/whatif.ts`, LTI AGS passback `lib/ltiscore.ts` | What-if reachable; passback flagged off | Instructor gradebook, drop rules, grade history |
| 7 | Discussion & collaboration | `lib/rooms.ts`, `lib/roomchat.ts`, `lib/officehours.ts`, `lib/moderation.ts` | Reachable | Course discussions, peer review, office-hours sign-up |
| 8 | Outcomes & mastery | `lib/review.ts`, `MasteryGraph`, `skills-graph.ts`, `concept_evidence` | Mastery reachable; skills graph flagged off | Outcome authoring, alignment, curriculum map |
| 9 | Learning intelligence & AI | `ai/converse.ts`, `lib/socratic.ts`, `lib/ladder.ts`, `lib/fsrs.ts`, `lib/again.ts`, `ai_policy`, gateway audit | Student side reachable; gateway flagged off | An instructor-facing course AI policy |
| 10 | Communication | `Calendar`, `lib/ics.ts`, `lib/notify.ts`, `Mail`, `TodayActionCenter` | Mostly reachable | Messages from instructors to students |
| 11 | Student success bridge | `GetHelp`, `HelpInbox`, `help-routes.ts`, `accommodation_passports`, `consent_record` | Help reachable; `humanHelp` flagged off | Booking; accommodations exist only in the schema |
| 12 | Institutional admin | `role_grants`, SCIM, `governance/hierarchy.ts`, kill switches, audit tables | Server side; console flagged off | A production admin console |
| 13 | Interoperability | LTI 1.3 launch, deep linking and AGS (`supabase/functions/lti`), Canvas token (`lib/canvas.ts`) | Reachable through Connect | OneRoster, QTI, Common Cartridge, NRPS, Blackboard, content migration |

## 4. What to build next, in the brief's phase order

The brief's Phase 1 is "win alongside incumbents", and it is the only phase
the current architecture supports without first moving the course record to
the server. In order:

1. **Guided practice on the tutor engine** (Phase 1, layer 9). Join
   `nextMove` to `ladder.ts` and to the Drill screen, and have the feedback
   contract check what the model returns. This is the differentiator, and it
   needs no server.
2. **An instructor-set course AI policy** (Phase 1 to 2, layer 9). Today the
   student records the stance from the syllabus. The `ai_policy` table and
   the gateway already exist, so what is missing is the faculty side and a
   per-assignment override. `taskPolicyFor` currently assumes the question is
   graded because it cannot yet know.
3. **Server-held courses and enrollments** (the precondition for Phase 2).
   Every instructor-facing layer (2, 4, 6, 7) is blocked on this.
4. **Completing LTI Advantage** (Phase 1, layer 13). NRPS rosters, then
   taking passback to production for one pilot tenant. This is the cheapest
   route to institutional credibility.
5. **An assessment engine grown from practice** (Phase 3, layer 5). Build it
   on `exam.ts` and `quiz.ts`: question banks, timing, and accommodations
   read from `accommodation_passports`, then QTI import and export.

The brief warns against marketing Semester as "better than Canvas". This map
supports that warning. The student-facing layers (9, 10, 11) are ahead, and
the instructor and institution layers are phases away.
