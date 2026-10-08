# 02 · Assessment model, mastery, feedback, rubrics and gradebook

Deliverables covered: **assessment model**, **feedback model**, and the
**requirements for assignments, assessments, rubrics, mastery and gradebook**.
Status vocabulary as in [01](01-LEARNING-DESIGN-AND-EVIDENCE.md).

## 1. The honest starting point

From the register ([`LEARNING-ASSESSMENT-GRADEBOOK-REGISTER.md`](../LEARNING-ASSESSMENT-GRADEBOOK-REGISTER.md),
assessed against `ff52ba4`, 28 September 2026): the **student side** is broad —
planner, study, practice paper, writing workspace — and the **faculty side**
is "present only as the labelled sandbox in `app/server/institution/sandbox.ts`,
which loads only when asked for." The assessment builder, rubric engine,
gradebook and grading workflow exist as tested pure libraries
(`itembank.ts`, `rubricengine.ts`, `lib/gradebook/`) that are **wired to no
screen**. Nothing here should be read as "an instructor can run a course in
Semester today." It is the specification for making that true without breaking
the guarantees already written.

## 2. The assessment model

### 2.1 Three lanes, and a firewall between them

Every piece of assessment-like activity belongs to exactly one lane. The lane
decides who sees it, what it may feed, and what controls apply.

| Lane | Purpose | Owner | Visible to instructor? | May feed grade? | May feed alerts / analytics / integrity? |
| --- | --- | --- | --- | --- | --- |
| **P — Practice** | Learning by retrieval and error | Student | **No** (default) | **Never** | **Never** (aggregates above the floor only if the student's data is explicitly donated) |
| **F — Formative, shared** | Low-stakes work the instructor asked for, to guide teaching | Instructor, with student | Yes, for that item | Optionally, at a published low weight or completion-only | Course-level aggregates only |
| **G — Graded** | Evidence of outcomes that counts | Instructor | Yes | Yes | Human-reviewed cases only; never automatic |

**The firewall:** data may move P → F only by a student action ("submit this
to my instructor"); never F/G → P-lane inference about a student, never P →
G/alerts/integrity. This restates the repository rule that practice data "is
never a risk, ability, admissions, aid, employment or advising score"
(`docs/ai-toolkit/ACTIVE-LEARNING-ENGINE.md`) and makes it a lane boundary a
test can hold: a query that joins lane-P tables to any other lane is a build
failure.

### 2.2 Designing assessment so that AI help is a design input, not a surprise

Policy and detection cannot be the only response to generative AI
([04](04-ACADEMIC-INTEGRITY-CONTROLS.md)). The assessment model gives faculty
structural options, ordered from least to most intrusive:

1. **Make the task harder to outsource:** local data, in-class prompts,
   course-specific sources, personal reflection tied to the course, staged
   deliverables (proposal → draft → revision → defence).
2. **Make the process part of the evidence:** version history, a short
   author's note on decisions taken, annotated source use. Student-held and
   student-submitted, announced in the assignment before work begins.
3. **Check understanding directly:** a short oral or in-class follow-up on a
   sample, a live explanation, a changed-parameters variant.
4. **Change the conditions:** in-person or supervised for the small number of
   assessments where the individual's unaided performance is what the
   outcome requires.

The assignment builder must make these options *visible choices at authoring
time* (see LI-ASM-03), because the cheapest fix is the one made before the
assignment is given.

### 2.3 Requirements: assignments and assessments

| ID | Requirement | Today |
| --- | --- | --- |
| LI-ASM-01 | Every assessment item belongs to a lane (P/F/G) recorded on the item; a lane-P item cannot be attached to a gradebook column. | Absent as a field; practice paper and exam are separate code paths (`lib/quiz.ts`, `lib/exam.ts`) |
| LI-ASM-02 | An item can be drawn only if approved, unexpired and at its newest approved version; an edit returns it to draft; the author cannot approve; an AI-drafted item names model, prompt version and human editor. | Held: `app/src/lib/itembank.ts`, `itembank.test.ts` (wired to no screen) |
| LI-ASM-03 | The assignment builder presents, at authoring time, the §2.2 options and records which were chosen, with the AI-use policy ([06](06-POLICY-CONFIGURATION-AND-WORKFLOWS.md)) attached to the assignment, not only the course. | Absent |
| LI-ASM-04 | Faculty review of AI-generated items covers accuracy, bias and accessibility, by a reviewer other than the author. | Partial: other-reviewer and accessibility review held in `itembank.ts`; accuracy and bias review absent (register L12 gap) |
| LI-ASM-05 | An assessment is built from a blueprint mapped to outcomes; a blueprint the bank cannot fill is refused, never silently shortened; the same bank, blueprint, seed and date reproduce the same test. | Held: `app/src/lib/itembank.ts` |
| LI-ASM-06 | Written answers (short answer, essay) are never scored by a rule; they return `needs_marking`. | Held: `app/src/lib/itembank.ts`; practice paper |
| LI-ASM-07 | Delivery is server-authoritative for time and attempts: windows, attempt limits, sections, enforced timing. Autosave, resume and a receipt issued only after server acceptance. | Partial: autosave, resume, receipt, wall-clock held on the device (`lib/examattempt.ts`, `examattempt.test.ts`); no server authority, windows, sections or attempts (register L08, LMS-008..010) |
| LI-ASM-08 | Time up never discards work. Late policy is explicit (per-day penalty, cap) and visible to the student before the deadline. | Held: `examattempt.test.ts`; `LatePolicy` in `server/institution/sandbox.ts` |
| LI-ASM-09 | A technical failure has a student-initiated "report an issue" path that records the time, state and device, and a documented make-up or alternative-assessment workflow. | Absent (register L08 gaps) |
| LI-ASM-10 | Accommodations are applied automatically to timing, availability and format ([05](05-ACCOMMODATIONS.md)). | Absent |
| LI-ASM-11 | A bad response (corrupt, unreadable) is distinguished from a wrong one. | Held: `app/src/lib/itembank.ts` |

## 3. The mastery model

**Mastery is evidence against an outcome, set by the instructor — not a study
state.** The two must never share a name or a store.

| | Study state (private) | Mastery (instructor-owned) |
| --- | --- | --- |
| What it is | The student's own `unseen → introduced → practising → retained → needs-review` view of a concept | A level on a published outcome, from assessed work |
| Source | Practice and review the student chose to do | Rubric level selections on lane-F/G work |
| Who decides | The student's own practice | The instructor's rubric and aggregation rule |
| Visible to | The student | The student and authorised course staff |
| Used for | Choosing what to review next | Reporting attainment; progression; the gradebook when the course is mastery-graded |

`app/src/lib/learning-loop.ts` implements the study-state column and is
correct to keep it private. Naming that column "mastery" in any UI would be a
P4 violation (a student's self-practice is not an assessed attainment).

### 3.1 The outcome record

Each outcome in a course has: an identifier and description; the levels
(default four: *Not yet · Developing · Proficient · Advanced*, instructor-
renamable, each with a descriptor — no empty boxes); and an **aggregation
rule** chosen by the instructor and published in the syllabus.

| Aggregation rule | Plain-language form shown to students | Typical use |
| --- | --- | --- |
| Most recent | "Your level is where you are now." | Skills that build (language, maths, writing) |
| Highest sustained | "Your level is the highest you have shown on at least two pieces." | Competence with repeat evidence |
| Weighted recent | "Recent work counts more, earlier work still counts." | Mixed courses |
| Mean | "Your level is the average." | Only where explicitly justified; a poor fit for mastery because it punishes early learning |

Constraints (each testable):

- **A mark is a level, not a number.** The points a student receives are the
  ones the rubric published; an unscored criterion, a level the criterion
  lacks, or a selection against another rubric version is refused. *(Held:
  `app/src/lib/rubricengine.ts`.)*
- **The rule is explainable on screen.** The student sees which pieces of work
  counted, at what level, under which rule, and what would change the result.
  *(Absent.)*
- **No hidden algorithm.** No weighting, decay or smoothing that is not in the
  published rule. A model-derived estimate is never a mastery level.
- **A reassessment path exists** wherever the rule is "most recent" or
  "highest sustained"; the instructor sets limits, the system does not
  silently decide who may retry.
- **Mastery and the study state may be displayed side by side** ("you rated
  yourself confident; your assessed level is Developing") only to the student,
  as the calibration feedback in [01 §2](01-LEARNING-DESIGN-AND-EVIDENCE.md).

| ID | Requirement | Today |
| --- | --- | --- |
| LI-MAS-01 | An outcome is a first-class record with levels, descriptors and a published aggregation rule; no mastery view exists without one. | Absent |
| LI-MAS-02 | Mastery levels are computed only from lane-F/G rubric selections; the computation is deterministic and reproduces from the ledger. | Partial: level scoring held in `rubricengine.ts`; outcome aggregation absent |
| LI-MAS-03 | The student sees an explanation of every mastery level (counted work, rule, what would change it). | Absent |
| LI-MAS-04 | The study-state vocabulary and the mastery vocabulary are disjoint in code, copy and exports. | Partial: separate modules; no copy audit |
| LI-MAS-05 | Course-level mastery reports are aggregates above the floor of ten; no per-student mastery export to anyone but the student and authorised course staff. | Held for analytics: `lib/cohortfloor.test.ts`; per-student export rules not specified |

## 4. The feedback model

### 4.1 Principles

1. **Feedback about the task and process, with a next step** — what holds, the
   first place it goes wrong, one question to take away — rather than about the
   person. (The model is the well-known task / process / self-regulation /
   self distinction from Hattie & Timperley, 2007; see the citation check in
   [01 §4](01-LEARNING-DESIGN-AND-EVIDENCE.md).) `app/src/lib/socratic.ts` encodes the one-thing-wrong
   contract for the tutor (`FEEDBACK`).
2. **One main thing.** A list of every flaw is a rewrite with extra steps.
3. **Tied to criteria the student could see in advance.** A rubric that arrives
   with the grade arrives too late to be used (a point the repository already
   makes in `rubricengine.ts`).
4. **Acted on.** The design target is *revision*, not receipt. Where the
   course allows it, the workflow includes a revise-and-resubmit or a
   reflection on what changed, and the metric is uptake ([07](07-METRICS.md)).
5. **Honest about its source.** Every piece of feedback is labelled: *from the
   instructor*, *from a tutor*, *generated practice feedback (not a grade)*, or
   *self-check from the rubric's own words*. Generated feedback is never shown
   in the same visual form as instructor feedback.

### 4.2 Who may give which feedback

| Feedback | Author | Becomes official? | Controls |
| --- | --- | --- | --- |
| Practice feedback | AI, from course sources | **Never** | Labelled; cites source; no score; private (lane P) |
| Rubric self-check | System, from the rubric's own words | **Never** | Disclaimer above checklist; "not a grade prediction" (held: `lib/toolkit/rubric.ts`) |
| Writing feedback | AI | **Never** | Identifies rubric gaps; never rewrites invisibly (held per register: `assignment.test.ts`) |
| Instructor feedback draft | AI, from the instructor's own rubric selections and notes | Only after the instructor edits and releases | Draft is visibly unreleased; edit and approval recorded; **never auto-released** |
| Grading assistance | AI flags possible rubric evidence | **Never** by itself | A human validates every flag; the flag does not alter any score |
| Tutor feedback (human) | Tutor | No (support, not grade) | Student-visible session notes |

| ID | Requirement | Today |
| --- | --- | --- |
| LI-FBK-01 | Every feedback artefact carries a source label from the table above; generated feedback is visually distinct from instructor feedback. | Partial: labelled in Study and toolkit; no cross-product standard |
| LI-FBK-02 | No generated feedback contains a grade, score, percentile or pass/fail prediction. | Held: `lib/teachback.test.ts` (no grade); `lib/toolkit/rubric.test.ts` (no prediction language) |
| LI-FBK-03 | An instructor feedback draft is generated only from instructor-entered rubric selections and notes, cannot be released without an explicit instructor action, and records the draft, the edit and the release as three events. | Absent (register L12 gap) |
| LI-FBK-04 | Feedback release is controlled per assignment (immediate, after the window closes, after the instructor releases) and visible to the student before submission. | Absent |
| LI-FBK-05 | Feedback turnaround (submission → released feedback) is measured per course and reported as an aggregate; the instructor sees their own course's figure. | Absent |
| LI-FBK-06 | Where the course allows revision, the student can attach a short "what I changed and why" note, and the instructor can see revision history. | Partial: version history in Write exists; no revise-and-resubmit workflow |
| LI-FBK-07 | Edit-distance between an AI draft and the released instructor feedback is measured only as a course-level quality aggregate and is never ranked or shown across instructors. | Absent |

**LI-FBK-07 is a guardrail on ourselves.** A rubber-stamp indicator is useful
for catching a drift toward unreviewed AI feedback; used against individual
faculty it is workplace surveillance. It is shown only to the instructor about
their own course, and in institution-wide aggregates above the floor.

## 5. Rubrics

| ID | Requirement | Today |
| --- | --- | --- |
| LI-RUB-01 | Rubrics are versioned; a score is bound to the version it was made against; editing creates a new version and never mutates scored history. | Held: `app/src/lib/rubricengine.ts` (refuses selections against another version) |
| LI-RUB-02 | Every level of every criterion has a descriptor; a rubric with an empty box is refused. | Held: `app/src/lib/rubricengine.ts` |
| LI-RUB-03 | Criteria map to outcomes ([§3](#3-the-mastery-model)); the mapping is visible to the student before work begins. | Partial: outcome mapping named as a gap in register L09; not wired |
| LI-RUB-04 | The rubric is visible to the student when the assignment is published, in an accessible form. | Partial: student can paste a rubric for self-check; instructor-published rubric absent |
| LI-RUB-05 | Rubrics may include a criterion for *process* (use of sources, evidence of revision, disclosure), never a criterion that rewards or penalises the *volume* of AI use. | Absent |
| LI-RUB-06 | A rubric can be reused, shared across a department, and exported (QTI/LTI path as institutions require). | Partial: see [`docs/QTI-3-ASSESSMENT-AND-MIGRATION.md`](../QTI-3-ASSESSMENT-AND-MIGRATION.md) |

## 6. Gradebook

The gradebook of record is `app/src/lib/gradebook/` (ledger, compute, tables
with row-level security). Overlap with `rubricengine.ts`'s own small ledger is
recorded in that file's header and is **not** to be resolved here.

| ID | Requirement | Today |
| --- | --- | --- |
| LI-GRD-01 | History is append-only: no version of a grade is edited or removed. | Held: `lib/gradebook/gradebook.test.ts` |
| LI-GRD-02 | Excused work leaves the calculation; missing counts as zero unless policy says otherwise; the only item is never dropped. | Held: `app/src/lib/gradebook/gradebook.test.ts` |
| LI-GRD-03 | A change to a *released* grade requires a reason that is kept, and the released grade stays visible until the change is released. | Held: `app/src/lib/gradebook/gradebook.test.ts` |
| LI-GRD-04 | A final-grade change needs dual control and an audit event (the instructor's request and a second authorised approver). | Absent as a workflow (the audit's governance matrix asks for it) |
| LI-GRD-05 | The student sees how every number was computed, with a what-if for remaining work. | Partial: student grade view exists (register); what-if status not re-read |
| LI-GRD-06 | A grade never changes because of an integrity signal, an AI output or a study-tool event; only a human decision recorded in the integrity process ([04](04-ACADEMIC-INTEGRITY-CONTROLS.md)) can. | Held by absence: no grading tool exists (register L12); not guarded by a test |
| LI-GRD-07 | Regrade and appeal: a student can request review of any released grade with a reason; the request is routed to a human who is not the original grader where the policy requires; the outcome and reasoning are recorded. | Partial: sandbox appeal with a reason exists (register L13); no routing or non-original-grader rule |
| LI-GRD-08 | LTI AGS / SIS grade passback, where enabled, is previewable, permissioned, retry-safe, reconcilable and reversible where the destination permits. | Absent (see register release criteria) |
| LI-GRD-09 | The register's twelve **release criteria for consequential grading** are satisfied before any grade in Semester is treated as an institution's record. | Absent: all twelve unchecked in the register |

**Rule for this pack:** the register's release criteria
([`LEARNING-ASSESSMENT-GRADEBOOK-REGISTER.md`](../LEARNING-ASSESSMENT-GRADEBOOK-REGISTER.md)
§"Release criteria for consequential grading") are adopted unchanged as the
gate for LI-GRD-09; this pack adds LI-GRD-04, -06 and -07 to them and
nothing else.
