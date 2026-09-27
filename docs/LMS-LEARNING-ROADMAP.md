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
| LTI 1.3 / Advantage | exists | `lib/lti*.ts`, `supabase/functions/lti` |
| QTI / Common Cartridge import | missing | |
| Duolingo / Quizlet / Khanmigo matrix route | missing | The documents themselves call it "future" |

## Suggested order for what is left

The order follows the documents' phases: student layer, then teaching layer,
then assessment layer.

1. **Exam autosave and a submission receipt.** Keep the practice-paper answers
   in `Exam.tsx` through `lib/draft.ts`, the way the essay screen does. The
   documents' own line is "no lost work", and it is the smallest item left.
2. **Let `open_screen` reach Get help,** so the tutor's handoff is a button
   rather than a sentence.
3. **Objective map:** unit → objective → assignment. The objective map, the
   prerequisite graph and the "how does this help my assignment" link all
   depend on it.
4. **Personal weekly goals** with no penalty for missing one.
5. **Course Studio, question banks and QTI / Common Cartridge.** This is the
   faculty layer, and the largest piece.
