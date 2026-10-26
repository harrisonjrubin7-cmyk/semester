# AI in grading and integrity

<!-- Rendered from app/src/lib/governance/grading-ai.ts by grading-ai.test.ts. Edit the data, then run `npm run registers` from app/. -->

> Owner, version, last and next review, status, supersedes and related decisions: [`SEMESTER-OPERATING-SYSTEM.md`](../../SEMESTER-OPERATING-SYSTEM.md).

What Gradescope, Turnitin and Copyleaks each are, why no single accuracy or
false-positive number compares them, the institution-controlled evaluation
that does, the procurement pass/fail rules, the roles AI may hold in
assessment and the human control each requires, and the fairness controls a
consequential grade needs — from four documents of 28 September 2026, held to
what the tree already has. [GRADESCOPE-TURNITIN.md](../../GRADESCOPE-TURNITIN.md)
settled that Semester cannot submit into Gradescope and that Turnitin’s API
is a partnership; this page is about governance, not integration. The AI
lifecycle gates are [AI-LIFECYCLE-GATES.md](AI-LIFECYCLE-GATES.md).

**There is no single, universal false-positive rate for Gradescope, Copyleaks, Turnitin or AI grading tools. Results depend on the assignment type, model and version, language, rubric, source material, student population, threshold and what the tool is detecting. Do not compare vendors using an unsupported single percentage.**

| Supplied document | What it holds |
| --- | --- |
| [Gradescope vs Copyleaks vs Turnitin AI grading: accuracy, false-positive rates, and plagiarism integration compared side-by-side](../expansion/Gradescope-Copyleaks-Turnitin-and-QTI-3-Migration.pdf) | The three-product comparison, the vendor test protocol and the deployment preconditions. |
| [Canvas vs Blackboard vs Moodle vs D2L (AI grading comparison)](../expansion/LMS-Sortable-Matrix-and-AI-Grading-Comparison.pdf) | The required vendor-evaluation test and the procurement pass/fail rules. |
| [Anything else that can be further improved (AI in assessment and grading)](../expansion/Learning-Work-Completion-Assessment-and-Gradebook.pdf) | The AI use-case matrix with the permitted role and required control for each, and the grading fairness controls. |
| [EdTech stack audit (AI guardrails for grading)](../expansion/EdTech-Stack-Audit-LTI-AI-Grading-and-API-Extensibility.pdf) | The guardrail table and the source-aware grading workflow. |

## The three products, and Semester

They address different problems: Gradescope is a grading-workflow product;
Turnitin and Copyleaks are integrity-signal products. The test refuses any
cell that quotes a percentage.

| Criterion | Gradescope | Turnitin | Copyleaks | Semester |
| --- | --- | --- | --- | --- |
| **Primary use** | Assisted grading, answer grouping and rubric workflows, especially for structured, fixed-template work | Similarity checking and AI-writing detection; assessment integrations vary by product and licence | AI-content detection, plagiarism and related integrity tooling | Source-aware rubric workflow, formative feedback, a grade ledger and human-controlled integrity review |
| **Rubric-based scoring** | Strong rubric and grading-workflow orientation | Not primarily a rubric-scoring system | Not primarily a rubric-scoring system | Structured rubric, criterion-level evidence, manual or AI-assisted feedback, reviewer sign-off |
| **Automated action** | Assists answer grouping and grading; the instructor controls final grading | Flags similarity and AI-writing concerns for trained human review only | Flags suspected AI or plagiarism concerns for trained human review only | AI may suggest evidence and feedback drafts; it cannot release a final grade or a misconduct finding |
| **False-positive claim** | Not comparable as an AI-writing detector | Require current, independent, scenario-specific evidence | Require current, independent, scenario-specific evidence | Do not accept a single vendor-wide accuracy number |
| **Evidence available to the instructor** | Rubric and response-grouping context | Similarity report and source matches; the AI signal depends on the product | Similarity or AI report, depending on the product | Rubric version, student work, source and citation context, AI-assist trace, reviewer decision |
| **Student due process** | The institution must configure a review process | The institution must provide human review and a response process | The institution must provide human review and a response process | The student sees the policy basis, can respond, request review and appeal; the decision is audited |
| **Data governance question** | Retention, storage, integrations, training and data-use terms | Repository, retention, similarity corpus, AI-detection handling | Retention, repositories, model and data-use terms | No vendor training on student work by default; tenant approval required |
| **Major risk** | Over-reliance on automation and grouping without review | False accusations or overconfident AI-detection conclusions | The same: false positives, unequal impacts, opaque thresholds | Human review, student explanation, audit trail, transparent limitation labels, no automatic penalty |

## The evaluation that does compare them

Require each vendor to support an institution-controlled evaluation on
permissioned, representative samples with multiple trained human reviewers,
and measure:

| Measure | How |
| --- | --- |
| Rubric agreement | Compare the tool suggestion with multiple trained human graders. |
| Inter-rater reliability | Measure human-to-human agreement first; do not treat humans as a perfect ground truth. |
| False positives | How often the tool flags compliant, authentic work as suspect. |
| False negatives | How often it misses work the institution independently determines needs review. |
| Calibration | How results vary by discipline, assignment type, language background, disability and accessibility use, length, format and population. |
| Explainability | Whether an instructor can see why a score or flag appeared and what evidence supports it. |
| Appeal | Whether a student can see enough basis to respond, correct or challenge the result. |
| Data governance | What student work is stored, for how long, in which region, by which subprocessors, and whether it may be used for training. |
| Operational quality | How outages, model changes, threshold changes and disputed cases are handled. |

**The dataset.**

- Permissioned historical assignments or synthetic benchmark materials.
- Multiple disciplines and assignment types.
- Multiple language backgrounds and writing styles.
- Accessibility-tool outputs where relevant.
- Known original, cited or quoted, collaboratively authored, AI-assisted-permitted and policy-violating examples.
- A predefined ground-truth review process with multiple human reviewers.

**What is reported.**

- True-positive, false-positive, true-negative and false-negative counts.
- Precision, recall, false-positive rate and confidence intervals.
- Results by discipline, text length, language and approved assistive-tool use.
- Consistency after vendor, model or threshold updates.
- Explanation quality and reviewer agreement.
- Time saved against additional review burden.
- Student appeal outcomes.

### Procurement pass/fail

Any one fails the procurement.

- No automatic grade release from AI output.
- No automatic academic-misconduct accusation, grade penalty or disciplinary referral.
- No unsupported “99% accurate” claim accepted without current, assignment-specific evidence.
- No use of student work for vendor model training by default.
- No tool deployed without a student notice, a human-review procedure and an appeal route.
- No integration that silently writes grades or sends flags to the official record.

### Before an integrity signal enters a consequential workflow

- A trained human reviews it.
- The student has a way to respond.
- The instructor sees evidence, not only a percentage.
- The institution has an appeal and process policy.
- The tool’s data-retention and training terms are contractually acceptable.
- The institution has tested impacts on multilingual and disabled students.

## The roles AI may hold

AI can assist, and it must never silently become the grader. Each role sits
at the lifecycle gate that owns its function; every row ends in a human, or in no

| Use case | Permitted role | Required control | Gate |
| --- | --- | --- | --- |
| Rubric drafting | Suggest criteria and language | Instructor review before use | G2 |
| Question generation | Draft questions from approved source material | Faculty review; accuracy, bias and accessibility checks | G2 |
| Practice feedback | Give formative feedback, hints and explanations | Clearly labelled as AI; cites course sources; no official grade | G3 |
| Writing feedback | Identify clarity, structure, citation and rubric gaps | Student review; course-policy compliance; no invisible rewriting | G3 |
| Instructor feedback draft | Draft feedback from instructor rubric inputs | Instructor edits and approves before release | G3 |
| Grading assistance | Flag possible rubric evidence or calculate deterministic scores | Human validates; the decision and audit record are preserved | G3 |
| Integrity support | Highlight unusual patterns or citation concerns | No automatic misconduct determination; human investigation | G3 |
| Accessibility support | Generate first-pass alt text, transcript aids and plain-language rewrites | Human validation; academic meaning preserved | G3 |
| Final grading | Not AI-only | An instructor or authorized human remains responsible | G4 |

### The two rules, at the code

A refusal here is an entry of the AI intake’s prohibited starting scope, the
one gate every AI use case passes. No grading workflow holds either rule,
because none exists.

| Rule | Refused by | Note |
| --- | --- | --- |
| No automatic academic-misconduct accusation, grade penalty or disciplinary referral. | at intake: “Disciplinary judgments” in `app/src/lib/governance/ai-lifecycle.ts` | Refused at intake, for any AI use case. No grading workflow enforces it, because none exists; the analytics guard in institution-ops.ts refuses an integrity-flag metric, which is a measure, not an accusation. |
| No AI-only final grade. | nothing at intake (`app/src/lib/governance/ai-assurance.ts`) | MODES_PROHIBITED lists automated grading without human oversight with nothing refusing it at intake; the instructor keeps grading by a Course Studio decision, not by a rule. |

## The source-aware grading workflow

A grader substantiates feedback without pretending the system can infer
learning from a file alone.

1. Open the submission.
2. View the assignment prompt and the rubric version alongside the work.
3. See the relevant course-source references and the student’s citations.
4. Select a criterion.
5. Enter a score and an evidence-based comment.
6. Optionally use AI to suggest possible rubric evidence or draft feedback.
7. Review and edit every AI suggestion.
8. Flag a missing source, an inaccessible file, a policy question or a suspected integrity issue.
9. Submit the draft grade; calibrate or moderate if configured.
10. Release the grade.

Released feedback shows, criterion by criterion: criterion and score; rubric standard; observed in your submission; relevant source; suggested next action; feedback status: who authored it, and whether it is released.

Every grade change records: actor, role, timestamp, reason, prior value, new value, rubric and version, approval, where required, sync status, audit correlation id.

## The fairness controls, where the tree stands

A status is a claim about the best piece of a control: `tested` cites a test
that runs on every change, `building` code, `designed` a document,
`not-started` at most a document naming the gap. The only submit → grade →
release loop in the tree is the labelled sandbox in
`app/server/institution/sandbox.ts`, which loads only when asked for; every
`tested` row below is that sandbox, and its gap says so.

| ID | Control | Status | Evidence | Gap |
| --- | --- | --- | --- | --- |
| F01 | Anonymous grading option | not-started | `docs/MASTER-LAUNCH-READINESS-REGISTER.md`: LMS-012 grading workflow: designed; no anonymous grading | Nothing hides a student’s identity from a grader. |
| F02 | Randomized grading order | not-started | `docs/MASTER-LAUNCH-READINESS-REGISTER.md`: LMS-012: designed | No grading queue exists to randomize. |
| F03 | Rubric-first scoring | tested | `app/server/institution/sandbox.ts`: Criterion {id, name, outOf, means}: per-criterion marks, the total their sum, the student-facing meaning published before work starts<br>`app/server/institution/sandbox.test.ts`: refuses a criterion mark the rubric cannot carry; will not accept a rubric with a box left empty<br>`app/src/lib/toolkit/rubric.ts`: a rubric turned into a student checklist that never predicts a grade<br>`app/src/lib/toolkit/rubric.test.ts`: the checklist and its disclaimer | Sandbox only (LMS-006 designed): no performance levels, outcome mapping, versions or calibration, and no rubric table. |
| F04 | Calibration sets for multiple graders | not-started | `docs/MASTER-LAUNCH-READINESS-REGISTER.md`: LMS-012: designed | The only calibration in the tree is a student’s confidence against their marks. |
| F05 | Inter-rater agreement view | not-started | `docs/MASTER-LAUNCH-READINESS-REGISTER.md`: LMS-012: designed | One grader per record in the sandbox; nothing compares two. |
| F06 | Blind double-marking, where configured | not-started | `docs/MASTER-LAUNCH-READINESS-REGISTER.md`: LMS-012: designed | None. |
| F07 | Moderation or second-review workflow | tested | `app/src/lib/gradebook/ledger.ts`: `moderate`: a second person holding grades:moderate, never the grader, checks a draft grade; `release` holds a draft the scheme says must be moderated<br>`app/src/lib/gradebook/gradebook.test.ts`: is a second person: the grader cannot moderate their own grade; holds a draft the scheme says must be moderated, and releases the moderated one | The moderator is a second human checking a draft in the gradebook of record; nothing in it involves an AI, and there is no blind double-marking, calibration set or inter-rater view. |
| F08 | Grade-change reason and audit trail | tested | `app/server/institution/sandbox.ts`: an appeal keeps the original mark in `was`; every action lands in `history`<br>`app/server/institution/sandbox.test.ts`: refuses an appeal with no reason in it; says how an appeal came out | Sandbox only, and only through an appeal: no override with a reason outside one (LMS-013 designed). |
| F09 | Student-visible feedback timing | tested | `app/server/institution/sandbox.ts`: a mark is shown to nobody until it is released<br>`app/server/institution/sandbox.test.ts`: shows a mark to nobody until it is released; does not show a mark before one has been released | Release is a control; nothing measures turnaround time. |
| F10 | Appeal or regrade request workflow | tested | `app/server/institution/sandbox.ts`: appeal: open → upheld or amended, with a reason and an answer; no archive while one is open<br>`app/server/institution/sandbox.test.ts`: an appeal; will not let a record be archived while an appeal is open<br>`app/src/lib/returned.ts`: the student-side regrade window counted from the day the work came back<br>`app/src/lib/returned.test.ts`: calendar and business days; nothing to say without a recorded window | Sandbox and a window counter; no institutional grade-change request (AM-18: no appeal route). |
| F11 | Accommodation-aware assessment records | building | `supabase/migrations/20260926150000_expansion_roles_and_features.sql`: accommodation_passports: a functional summary, never a diagnosis; shares with an expiry<br>`supabase/expansion.check.sql`: the audited read of a shared accommodation | A passport is stored and shared; nothing applies it to an assessment’s timing or format (LMS-009). |
| F12 | No AI-only final grade for consequential work | building | `app/src/lib/governance/ai-assurance.ts`: MODES_PROHIBITED: automated grading without human oversight, refused by nothing at intake<br>`app/src/ai/prompt.ts`: no tool changes a grade, a dropped score or the grading scale<br>`app/src/lib/toolkit/rubric.ts`: DISCLAIMER: not a grade prediction and not feedback from your instructor<br>`app/src/lib/teachback.ts`: no grade | Held by the absence of any grading tool and by a Course Studio decision (D-100), not by a rule; no intake refusal names automated grading. |
| **total** | | not-started 5, designed 0, building 2, tested 5 | | |
