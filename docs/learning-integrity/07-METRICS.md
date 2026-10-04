# 07 · Evaluation metrics that measure learning support, not engagement

Deliverable covered: **evaluation metrics that measure learning support rather
than engagement alone.**

## 1. The rule

**Engagement is not evidence.** Time in app, sessions, streaks, daily actives,
messages sent, cards flipped and satisfaction scores may be reported as
*diagnostics* about product use. They are never a success metric, a target, an
OKR or a claim, at any evidence tier ([01 LI-EVD-02](01-LEARNING-DESIGN-AND-EVIDENCE.md)).
A tutor that is *used a lot* may be doing the students' thinking for them.

The audit's own north-star for students is "Weekly meaningful learning/
progress actions completed" with the gloss "improves student progress, not
merely time spent." This document makes "meaningful" operational.

## 2. Metric families

Each metric states its **question**, **definition**, **source**, **privacy
lane**, **minimum cell size** and **decision it informs**. The minimum cell
size is the repository's floor of ten (`lib/cohortfloor.test.ts`) unless a
stricter one is stated.

### 2.1 Learning outcomes (what students can do)

| ID | Question | Definition | Source | Lane | Decision it informs |
| --- | --- | --- | --- | --- | --- |
| M-OUT-1 | Are students reaching the outcomes? | Share of students at *Proficient* or above, by outcome, at the course's checkpoints ([02 §3](02-ASSESSMENT-MASTERY-AND-FEEDBACK.md)) | Rubric level selections (lane F/G) | Course aggregate | Teaching changes; assessment redesign |
| M-OUT-2 | Does learning last? | Performance on a **delayed** retest of the same outcome, 2–4 weeks after instruction, relative to the immediate test | Instructor-designed delayed items | Course aggregate | Whether retrieval/spacing support works here |
| M-OUT-3 | Does it transfer? | Performance on novel-context items for an outcome | Instructor-designed transfer items | Course aggregate | Surface learning vs understanding |
| M-OUT-4 | How long to mastery? | Median number of reassessment cycles to *Proficient* | Gradebook history | Course aggregate | Whether reassessment paths help |
| M-OUT-5 | Are they calibrated? | Mean gap between students' own confidence and assessed correctness | Student-opted-in confidence ratings + assessed items | Student-only; aggregate only if donated | Metacognitive support |

### 2.2 Learning-support quality (how well the support works)

| ID | Question | Definition | Source | Decision it informs |
| --- | --- | --- | --- | --- |
| M-SUP-1 | Is feedback timely? | Median time from submission to released feedback | Submission and release events | Staffing; assessment load |
| M-SUP-2 | Is feedback used? | Share of feedback followed by a revision, a reflection note, or a reassessment attempt within N days | Revision events | Whether feedback is actionable |
| M-SUP-3 | Does the tutor make students think first? | Share of tutor sessions in which the student made an attempt before the tutor's first substantive step | Tutor event metadata (no content) | Prompt and mode design |
| M-SUP-4 | Is help the right size? | Distribution of the **lowest rung that resolved** a question; share of sessions that reach rung ≥ 6 on graded-linked work | Tutor event metadata | Ceiling and prompt tuning |
| M-SUP-5 | Are sources trustworthy? | Rate of verified quotations; rate of responses with unverified-reference labels; user-reported wrong answers per 1,000 responses | Citation checks; reports | Retrieval and model quality |
| M-SUP-6 | Does assessment discriminate well? | Item difficulty, discrimination and distractor performance | Item responses | Item bank maintenance |
| M-SUP-7 | Are rubrics usable? | Share of students who viewed the rubric before submitting; share of scored criteria with a feedback comment | Rubric views; grading events | Rubric design |
| M-SUP-8 | Do students find a human when the ladder ends? | Share of ladder-exhausted sessions followed by a booked human session or office-hours visit within N days | Handoff + booking events | Handoff design |

### 2.3 Equity (for whom it works)

| ID | Question | Definition | Controls |
| --- | --- | --- | --- |
| M-EQ-1 | Do outcomes differ across groups the institution has approved for analysis? | M-OUT-1..4 disaggregated | Only institution-approved groupings; cell ≥ 10; **aggregate only**, never a per-student view; no accommodation, wellbeing or basic-needs data in the groupings |
| M-EQ-2 | Does support reach everyone? | M-SUP-1, -2, -8 disaggregated | As above |
| M-EQ-3 | Does the integrity process treat groups alike? | Referral rate, outcome and overturn rate by approved grouping | As above; review by the governance body |
| M-EQ-4 | Does access work? | Accessibility issue reports per 1,000 sessions; assessment technical-error rate; alternative-uptake | Aggregates; triage |

### 2.4 Integrity-support outcomes (is the process fair and clear)

| ID | Question | Definition |
| --- | --- | --- |
| M-INT-1 | Do students understand the rules? | Share of students correctly answering a short policy-comprehension check shown with the policy card |
| M-INT-2 | Are declarations being made where required? | Share of assignments with required disclosure that have a completed declaration |
| M-INT-3 | Is the process fast? | Median days acknowledge → decision |
| M-INT-4 | Is it fair? | Share of formal decisions overturned on appeal; student-reported fairness (survey) |
| M-INT-5 | Are false positives being found? | Share of match/other flags that, on review, led to no finding |
| M-INT-6 | Is the informal route working? | Share of concerns resolved informally |

Counts of *accusations* or *cases* are **not** success metrics and are not
targets. A falling count may mean better design or less looking; a rising one
may mean the opposite. The measures above ask whether the process is fast,
clear and fair.

### 2.5 AI safety and boundary integrity

| ID | Question | Definition |
| --- | --- | --- |
| M-AI-1 | Does the gate hold? | **Under-refusal rate** on the adversarial suite ([03 §8](03-AI-TUTORING-AND-BOUNDARIES.md)): share of "do my assessment" cases that received substantive assessed content |
| M-AI-2 | Does it over-refuse? | **Over-refusal rate** on the legitimate-help set: share of permitted requests refused |
| M-AI-3 | Does the model fabricate? | Rate of unverifiable references and misquoted sources on a sampled review set |
| M-AI-4 | Does it stay in role? | Rate of outputs that assert a grade, standing, diagnosis or misconduct |
| M-AI-5 | Does the UI agree with the gate? | Contract-test pass rate (UI vs gateway resolver) |
| M-AI-6 | Do students rely on it too much? | Change in unassisted performance relative to assisted practice, in a pilot design (§4) |

M-AI-1 and M-AI-2 are reported together; a release that improves one at the
cost of the other beyond an agreed bound does not ship.

## 3. Guardrail metrics (watch for harm)

| Guardrail | Signal | Action |
| --- | --- | --- |
| Help-seeking is falling in groups that need it | M-SUP-8 or tutor use declines after a policy change | Review the change; revert if attributable |
| Students avoid the tutor out of fear of being watched | Survey item + unexplained drop in tutor use after an integrity communication | Review communications; restate no-transcript rule |
| Assignment-level policy confusion | M-INT-1 low for an assignment | Revise the policy card |
| Faculty workload | Time to configure policy; grading time per submission | Simplify presets; do not add required fields |
| Learning decline despite engagement | Engagement up, M-OUT-2/-3 flat or down | Treat as a negative result (LI-EVD-06) |

## 4. Evaluation design

An effect on learning can only be claimed from a design that can show one.

| Design | Use when | Notes |
| --- | --- | --- |
| **Stepped-wedge rollout** | Institution wants everyone to get the feature eventually | Randomise or sequence the order of sections; compare before/after across groups |
| **Randomised encouragement** | Feature cannot be withheld but can be nudged | Compare nudged vs not; estimates effect of use on compliers |
| **Matched or difference-in-differences** | Randomisation not possible | State the assumptions; weaker evidence (E3 with explicit caveats) |
| **Within-course A/B of prompt or mode** | Comparing two tutor configurations | Needs consent and review; outcome must be a learning measure |
| **Qualitative review** | Always, alongside | Sampled human review of tutor outputs and feedback |

Requirements:

| ID | Requirement | Today |
| --- | --- | --- |
| LI-MET-01 | Each pilot has a pre-registered plan (outcome, comparison, analysis, stopping rule) recorded before data collection. | Absent |
| LI-MET-02 | The primary outcome is assessed work or a delayed/transfer measure; engagement is never primary. | Absent |
| LI-MET-03 | Student participation in research or experimentation is by consent distinct from product use, with a way to opt out that does not degrade their service. | Absent |
| LI-MET-04 | Where the institution has an ethics review board, a pilot involving students is submitted to it; Semester does not decide that question. | Absent |
| LI-MET-05 | Results, including null and negative, are recorded in the evidence register ([01 §4](01-LEARNING-DESIGN-AND-EVIDENCE.md)) and constrain claims. | Absent |
| LI-MET-06 | No metric may source a forbidden measure; `defineMetric` refuses it. | Held: `app/src/lib/institution-ops.ts` (`FORBIDDEN`, `defineMetric`), `institution-ops.test.ts` |
| LI-MET-07 | Every metric on this page has a defined data source, privacy lane and floor before it is shown anywhere. | Absent |

## 5. What is measurable today

Most of §2 cannot be computed now. Honest state:

| Family | Computable from what exists | Not computable |
| --- | --- | --- |
| Outcomes | Nothing at course level: the gradebook and rubric engine are not wired to a live course | All of M-OUT |
| Support quality | Possibly M-SUP-5 (citation verification exists in client code) | M-SUP-1, -2, -6, -7 (no live faculty workflow); M-SUP-3, -4 (no tutor event stream with rung metadata evidenced) |
| Equity | Nothing | All |
| Integrity | Nothing | All (no process) |
| AI safety | Nothing as a model-behaviour measure | M-AI-1..-6 (no adversarial suite) |

This is not a criticism of the tree; the faculty side is declared a sandbox
in the register. It means **the first deliverable of an evidence programme is
the instrumentation** (events with the right metadata and no content), not a
dashboard.

## 6. The structural tension, stated

Semester's strongest privacy property — practice data stays on the student's
device and is never read by anyone else — is also what makes outcome
measurement hard: the data that would show whether study tools help sits
exactly where nobody may look.

Resolution proposed, in order of preference:

1. **Measure outcomes on assessed work**, which the instructor already holds
   and which the student expects to be counted (M-OUT-1..4). No new data.
2. **Aggregate on-device, release only counts**, with the student's consent: a
   client computes a small, fixed set of summaries (e.g. retrieval attempts
   per outcome per week) and uploads only differentially-private or
   above-floor aggregates. Requires design review.
3. **Opt-in research donation**, per [LI-EVD-05](01-LEARNING-DESIGN-AND-EVIDENCE.md),
   separate from product use, revocable, with the ethics review above.

The one option that is **not** acceptable is quietly sending practice data to
the server "for analytics." That is the hidden-surveillance failure this
pack exists to prevent.

## 7. Dashboards

| Audience | Sees | Never sees |
| --- | --- | --- |
| Student | Their own study coverage, review schedule, mastery levels with explanations, confidence-vs-correctness, feedback turnaround for their work | Anyone else's data; a score of "how they compare" |
| Instructor | Their course's aggregates (above the floor): outcome distribution, item quality, feedback turnaround (own), help-route use, accessibility reports | Individual tutoring content; individual practice data; accommodation reasons; AI-use per student; any risk score |
| Institution (academic governance) | Cross-course aggregates; equity cuts on approved groupings; integrity-process fairness measures; AI safety suite results | Per-student data; per-instructor rankings |
| Semester (product team) | Aggregates with the same floors; model and safety suite results | Per-student content |
