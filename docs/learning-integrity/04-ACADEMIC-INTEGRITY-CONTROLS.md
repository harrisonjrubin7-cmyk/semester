# 04 · Academic-integrity controls, proctoring integrations and escalation

Deliverables covered: **academic-integrity controls**, **proctoring/integrity
integrations**, **escalation**. The governing sentence is the one already in
[`AI-ACADEMIC-INTEGRITY-SPEC.md`](../learning-university-systems/AI-ACADEMIC-INTEGRITY-SPEC.md):
*Semester uses scaffolding, not substitution… The system does not infer
misconduct or plagiarism from probabilistic output.* This document turns that
paragraph into controls, integrations and a due-process path.

## 1. Position, stated plainly

1. **Semester supports an institution's integrity policy; it does not enforce
   one by watching students.** The platform makes the rules legible, makes the
   honest path easy, lets students show their work, and gives humans the
   information they need to run a fair process. It does not decide guilt.
2. **No hidden measures.** Everything Semester records about a student for
   integrity purposes is something the student was told about *before* the
   work began and can see afterwards. There is no covert collection, no
   inference from behaviour, no silent scoring.
3. **Design out before you detect.** The first-line control is assessment
   design ([02 §2.2](02-ASSESSMENT-MASTERY-AND-FEEDBACK.md)) and clear policy.
   Detection is a last resort and a weak instrument.
4. **A signal is a question for a human, never a finding.** No automated
   action — no grade change, no flag visible to peers, no notification to an
   office — follows from any signal.
5. **A false accusation is a serious harm.** Controls are tuned to avoid it
   even at the cost of missing some real cases.

## 2. Control catalogue

| # | Control | What it does | Student-visible? | Today |
| --- | --- | --- | --- | --- |
| C1 | **Policy card** | Plain-language rows per use class, with source and "verified by instructor / the student's own record" labelling; unknown = *Policy unavailable — ask your instructor*, never permissive | Yes | Held: `lib/toolkit/policy.ts`, `policy.test.ts` |
| C2 | **Syllabus-text generation from policy** | The policy statement a student reads is generated from the same data the system enforces, so text and behaviour cannot drift | Yes | Absent |
| C3 | **Prohibited-assessment redirect** | Offers: plan the steps yourself · write questions for office hours · explain the concept from course material · practise on a similar problem; each AI alternative is itself checked against policy | Yes | Held: `redirect()` in `policy.ts` |
| C4 | **AI-use declaration** | Student declares tool, version, dates, uses, purpose, kind of material (never its content), output used, sources checked, edits, limitations, and attests; download disabled until complete | Yes | Held: `lib/toolkit/disclosure.ts`; **stored on the device and never submitted** (register L13 gap) |
| C5 | **Authorship checkpoints & version history** | Draft versions, "what I changed and why" notes | Yes | Partial: version history in Write; no staged-submission workflow |
| C6 | **Source and citation checks** | Quotations verified against the source; references verified or marked unverified | Yes | Held in part: `lib/cite.ts`; reference-verification gap in [03 LI-SRC-03](03-AI-TUTORING-AND-BOUNDARIES.md) |
| C7 | **Process packet (student-initiated)** | The student chooses to submit declaration + version history + source list with the work, where the assignment asked for it in advance | Yes, and chosen | Absent |
| C8 | **Instructor review queue** | A place where an instructor who has a concern can see the *student-submitted* process evidence for one submission, and open a case | Yes (student told a case was opened — §6) | Absent (register L13 gap) |
| C9 | **Match report (optional, institutional)** | A similarity/matching report from an institution-chosen tool, shown to a human reviewer as a report of matches, never a verdict | Yes — the student is told the tool is in use before submission | Absent; Turnitin is a partnership, not a public API (`GRADESCOPE-TURNITIN.md`) |
| C10 | **Appeal and explanation** | Student can respond and appeal at every stage | Yes | Partial: sandbox appeal with a reason (register L13) |
| C11 | **Integrity education** | Short, in-flow explanation of the course's rules and of citation practice, offered at the moment of work | Yes | Absent |
| C12 | **No automatic accusation or penalty** | The platform contains no path from a signal to a consequence | n/a | Held: `lib/institution-ops.ts` refuses a metric that sources automated integrity accusations; `lib/institution-ops.test.ts` |

### 2.1 What is deliberately not on the list

| Not built | Why |
| --- | --- |
| **An AI-writing detector, or a "likelihood this was AI" score** | No detector has a validated universal error rate (the repository's own finding: `lib/governance/grading-ai.ts`). Error is not evenly distributed: writers working in a second language, and students who write in a plain or formulaic register, are at higher risk of being misread. A score shown to a person who then decides is an accusation with a number on it. |
| **Keystroke, mouse, typing-cadence or "behavioural" analysis** | Hidden or semi-hidden surveillance; invalid as evidence; disproportionately mis-flags students with motor or cognitive differences, assistive technology and shared devices. Forbidden: `lib/institution-ops.ts` (mouse and keystroke tracking, attention inference). |
| **Webcam, face, voice or emotion analysis** | Held by test: `lib/ops/boundaries.test.ts` (no face library, no emotion or facial analysis). |
| **Silent copying of tutoring transcripts to instructors** | [03 §7](03-AI-TUTORING-AND-BOUNDARIES.md). |
| **Cross-course or cross-student comparison of writing style** | Profiling; cannot be explained to the student; no due-process basis. |
| **A per-student integrity "risk" or "trust" score** | Forbidden measure; also a P5 violation. |

## 3. Process evidence: how it works without becoming surveillance

The only integrity evidence Semester collects is the evidence the student
*makes* — and it is held by the student until the student submits it.

| Evidence | Created by | Held by | Instructor sees it when |
| --- | --- | --- | --- |
| AI-use declaration | Student | Student's device | The student submits it with the work, because the assignment asked for it in advance |
| Version history | Student's own editing in Write | Student | The student submits it, or a case is open and the process in §6 entitles the reviewer |
| Source list and checked quotations | Student, system-checked | Student | As above |
| "What I changed and why" note | Student | Student | As above |
| Tutoring session | Student + tutor | Student | Only if the student chooses to share it |

**Rules**

| ID | Rule | Today |
| --- | --- | --- |
| LI-INT-01 | The assignment announces, before work begins, which process evidence it will ask for and why. A requirement announced after submission is void. | Absent |
| LI-INT-02 | Process evidence is requested only where the assignment's design needs it (§2.2 option 2), not by default on every submission. | Absent |
| LI-INT-03 | Absence of process evidence is never, by itself, evidence of misconduct. It may prompt a conversation. | Absent as a stated rule in product |
| LI-INT-04 | The declaration moves from device-only to submittable, as a student action, with receipt. | Absent (register L13 gap) |
| LI-INT-05 | Nothing in this table is read by any analytics, alert, recommendation or support-prioritisation system. | Partial: `recommend.test.ts` strips GPA and risk scores; no test names integrity data as an excluded input |
| LI-INT-06 | The instructor review queue shows only student-submitted evidence plus the instructor's own concern note, and cannot query any other student-level data. | Absent |
| LI-INT-07 | Policy is checked at the time of the work: the policy version in force when the student started is the policy that governs, not a later tightening. | Absent |

## 4. Similarity and matching integrations (C9)

Only by institutional decision, only after a documented evaluation, only as a
report to a human.

| ID | Requirement | Today |
| --- | --- | --- |
| LI-INT-08 | Enabled per tenant by an institutional decision recorded in the policy store, with the vendor in the vendor register and a privacy review complete. | Absent |
| LI-INT-09 | Students are told, in the assignment and at the submit step, that a matching tool is used, what it receives, whether the work is retained by the vendor, and how long. | Absent |
| LI-INT-10 | Output is shown to authorised reviewers as *a report of text matches with sources*, with the vendor's own caveats displayed, and never as a percentage-led verdict. | Absent |
| LI-INT-11 | No match or detector output is stored on the student's record, shown to other students, or used in any score. It lives only on the case, if a case exists. | Absent |
| LI-INT-12 | Before enabling, the institution runs the controlled evaluation described in `lib/governance/grading-ai.ts` (permissioned representative samples, several trained human reviewers) and records the result. | Partial: `app/src/lib/governance/grading-ai.ts` states the procurement pass/fail rules; no enablement gate enforces them |
| LI-INT-13 | Student work is not retained by a third party beyond the institution's stated period, and not used to train vendor models, unless the student's institution has decided so and told students first. | Absent; counsel item |

## 5. Proctoring and lockdown integrations

**Semester builds no proctoring.** The repository holds this as a boundary
(`lib/ops/boundaries.test.ts`: no face library; `PROCTORING_FEATURE` pattern
guard; `LEARNING-ASSESSMENT-GRADEBOOK-REGISTER.md`: "no unapproved proctoring
or surveillance"). Where an institution decides to use an external
proctoring or lockdown service, Semester may *connect* to it under these
requirements. Every one is a condition of enabling the integration; none is
optional.

### 5.1 Before it is enabled (institution)

| ID | Requirement |
| --- | --- |
| LI-PRC-01 | A written institutional decision naming the assessments, the necessity, and the less-invasive options considered first (open-book or applied design, oral follow-up, in-person, randomised variants). Proctoring is the exception to be justified, not a default. |
| LI-PRC-02 | A privacy impact assessment and counsel review, including the law of every jurisdiction where students sit the assessment (biometric, recording and consent laws vary and some carry private rights of action — **counsel decides which apply**). |
| LI-PRC-03 | Vendor in the vendor register with data flows, retention, sub-processors, model-training use, and incident terms reviewed. |
| LI-PRC-04 | An accessibility review of the vendor tool with assistive technology, completed before the first live use, and an accessible alternative defined. |

### 5.2 For every proctored assessment (course)

| ID | Requirement |
| --- | --- |
| LI-PRC-05 | The student is told **in the syllabus and at enrolment in the course**, not only on the day: that proctoring is used, what is captured, who can see it, how long it is kept, and what the alternatives are. |
| LI-PRC-06 | An alternative (an equivalent non-recorded assessment, a different venue, or an in-person option) is offered to any student who objects on privacy, safety, equipment, bandwidth, household or disability grounds, without needing to disclose the reason. |
| LI-PRC-07 | Accommodations are applied automatically ([05](05-ACCOMMODATIONS.md)); the proctoring service receives the **effect** (e.g. extended time, breaks, assistive technology permitted), never the reason. |
| LI-PRC-08 | No emotion, face-matching, "suspicious-behaviour," gaze or eye-tracking inference is used. A vendor that cannot turn these off is not eligible. |
| LI-PRC-09 | No device scanning beyond what the disclosure named; no access to files, other applications or other networked devices beyond the assessment. |
| LI-PRC-10 | Automated flags are **never** findings. A flag may prompt a trained human to look at a short segment of the recording; the human's judgement, with reasons, is the only output. |
| LI-PRC-11 | A technical failure (power, network, device) is treated as a platform event, not a student fault; the student has a one-step path to report it and a documented resit or alternative. |
| LI-PRC-12 | Recordings are retained for the shortest period the institution can justify (a default of 30 days unless a case is open is proposed here as a starting point, **to be set by the institution and counsel**), then deleted, and are excluded from any analytics or training. |
| LI-PRC-13 | Equity: the course reports (in aggregate, above the floor) flag rates, technical-failure rates and alternative-uptake by the groupings the institution has approved; a disparity triggers review of the integration. |

## 6. Escalation and due process

Semester is not the forum. It supplies a **referral and evidence-handling
path** into the institution's own process, and does so with the following
properties.

```
instructor/TA concern (human) ─▶ informal conversation first ─▶ resolved? ─▶ record only if the institution's policy requires it
                                       │ no
                                       ▼
                       formal referral to the institution's integrity office
                                       │
        student notified, shown what the concern rests on, given time and a way to respond
                                       │
                trained human reviewer(s), not the referring instructor alone
                                       │
                  decision + reasons recorded ─▶ appeal to a different human or panel
```

| ID | Requirement | Today |
| --- | --- | --- |
| LI-INT-14 | A concern is raised only by a human with a course role; the system cannot open a case. | Held by absence |
| LI-INT-15 | An informal route exists and is the default first step, with no record beyond what the institution's policy requires. | Absent |
| LI-INT-16 | The student is told a formal referral has been made, by whom (role), and what material it rests on, **before** any decision, in time to respond. | Absent |
| LI-INT-17 | The referring instructor does not decide alone; the institution configures the decision-maker role. | Absent |
| LI-INT-18 | Every decision records reasons, the evidence considered and the policy version; evidence that is a detector or similarity output is marked as such and cannot be the sole basis. | Absent |
| LI-INT-19 | The student can appeal to a person who was not the decision-maker, and the appeal is tracked to resolution. | Partial: sandbox appeal (register L13) |
| LI-INT-20 | A grade affected by a decision changes only through the grade-change workflow with dual control ([02 LI-GRD-04](02-ASSESSMENT-MASTERY-AND-FEEDBACK.md)). | Absent |
| LI-INT-21 | Case data is classified student-record, retained and deleted per the institution's schedule, subject to legal hold, and excluded from every analytics path. | Absent; counsel item |
| LI-INT-22 | Time targets are configured per institution and displayed to the student (acknowledge → decision), because a case that hangs unresolved is itself a harm. | Absent |
| LI-INT-23 | Concerns about the integrity process itself (bias, delay, mishandling) have a route outside the original decision-makers. | Absent |

## 7. Fairness risks in this area (to be examined by governance)

| Risk | Why it matters | Control |
| --- | --- | --- |
| Second-language and plain-register writers mis-flagged by matching or detection | Higher base rate of false suspicion | No detector scores; human review; sampled case review by group |
| Students with assistive technology or accommodations flagged as anomalous | Assistive output looks "unusual" | Accommodation effects applied and disclosed to reviewers only as effects; assistive use exempt from "no AI" ([03 §6](03-AI-TUTORING-AND-BOUNDARIES.md)) |
| Chilling effect on asking for help | Students who fear tutor logs stop using the tutor | No transcript visibility by default |
| Unequal access to the compliant path | Students without reliable devices or quiet spaces fail a proctored test | LI-PRC-06, -11, -13 |
| Policy ambiguity as a trap | A course that "allows AI" but forbids the same use in an assignment | Assignment-level policy; policy-at-time-of-work (LI-INT-07) |
| Different treatment by instructor | Informal discretion varies | Decision-maker is configured and not the referrer; outcome reporting in aggregate |
