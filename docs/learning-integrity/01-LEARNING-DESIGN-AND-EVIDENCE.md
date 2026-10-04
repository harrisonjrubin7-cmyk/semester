# 01 · Learning design principles, study methodology and evidence standards

Deliverables covered: **learning design principles**, **study methodology**,
**evidence standards**.

Status column used in every requirement table in this pack:
**Held** = code or a test in the tree enforces it today · **Partial** = some of
it exists, the gap is named · **Absent** = nothing in the tree does it. Paths
are relative to the repository root; "per register" means the claim is taken
from [`LEARNING-ASSESSMENT-GRADEBOOK-REGISTER.md`](../LEARNING-ASSESSMENT-GRADEBOOK-REGISTER.md)
and was not re-read in code for this pack.

## 1. Design principles

Eight principles. Each one is a test a feature must pass before it is built,
not a value to be quoted.

| # | Principle | The question a reviewer asks | Fails when |
| --- | --- | --- | --- |
| P1 | **The student does the thinking.** Tools scaffold; they do not substitute. | After using this, did the student produce something, or only receive something? | A feature's best case is the student leaving having read a finished answer. |
| P2 | **Retrieval before re-exposure.** Ask the student to produce before showing. | Does the flow ask for an attempt, a recall or a prediction before it reveals? | The default path is "show the explanation first." |
| P3 | **Feedback is feedforward.** Feedback exists to change the next attempt. | Is there a next attempt, and does the feedback point at it? | Feedback is a score or a verdict with no way to act. |
| P4 | **Confidence must be calibrated, not inflated.** | Could this make a student feel they know something they do not? | A summary, a streak or a fluent AI answer reads as mastery. |
| P5 | **Private practice stays private.** Practice data never becomes a grade, risk, integrity or advising signal. | Can any consumer read practice data about a named student? | A dashboard, alert or export reads practice attempts. |
| P6 | **Stakes set the controls.** The higher the stakes, the more human judgement, process evidence and appeal. | Is the control proportionate to what a wrong outcome costs the student? | Low-stakes practice is policed, or a final grade has no human in it. |
| P7 | **Access is designed in, never inferred.** Universal design first; individual accommodation second; disclosure never required to get flexibility. | Does this work for a student who never discloses anything? | A feature needs a diagnosis, or guesses at one, to behave well. |
| P8 | **Clarity beats detection.** Make the rules legible and the honest path easy, before building any way to catch the dishonest one. | Does the student know, at the moment of work, what is allowed? | The only integrity control is after-the-fact inspection. |

P1, P4 and P5 are already stated in the tree
([`docs/ai-toolkit/ACTIVE-LEARNING-ENGINE.md`](../ai-toolkit/ACTIVE-LEARNING-ENGINE.md),
`app/src/lib/learninginsights.ts`, `app/src/lib/socratic.ts`). P6 and P8 are
this pack's additions; P7 extends
[`docs/ai-toolkit/UDL-AND-ACCESSIBILITY-IMPLEMENTATION.md`](../ai-toolkit/UDL-AND-ACCESSIBILITY-IMPLEMENTATION.md).

### What the principles forbid, concretely

- A streak, badge or leaderboard whose reward is *coming back*. (A tutor that
  rewards return is optimising the wrong thing; `socratic.ts` already says so.)
- A "readiness" or "mastery" number shown as a single point estimate from
  private practice. The tree shows a **range**, never a grade
  (`app/src/lib/learning-loop.ts`).
- An AI summary of a reading presented as *study*. It may be offered as
  orientation and must say so; it must not be the thing that satisfies a
  study-plan item.
- Any feature whose success metric is minutes in app (see [07](07-METRICS.md)).

## 2. Study methodology

Semester's study tools implement a small set of techniques with strong
evidence and avoid the techniques with weak evidence. This table is the
specification a study feature is held to.

| Technique | What the product does | Product rule | Today |
| --- | --- | --- | --- |
| **Retrieval practice** (testing effect) | Flashcards, practice questions, teach-back, mock paper | Production before display; the answer is revealed after an attempt; wrong answers are kept and returned to | Held: FSRS scheduling `lib/fsrs.ts`; practice paper; `lib/teachback.ts` |
| **Spaced repetition** | FSRS-scheduled reviews | The schedule serves retention, not session length; a due count never becomes a guilt count | Held: `lib/fsrs.ts`, `lib/review.ts` |
| **Interleaving** | Mixed-topic practice | Offered after a block is understood, not to first-time learners of a topic | Held: `lib/interleave.ts` |
| **Worked examples → faded** | Comparable example with different numbers (hint-ladder rung 5) | A worked example is followed by a similar problem the student does | Partial: rung 5 exists in `lib/socratic.ts`; no explicit fading sequence |
| **Elaboration / self-explanation** | "Put it back in your own words" step | The tutor asks before it tells when the student has not tried | Held: `STEPS` in `lib/socratic.ts` |
| **Error analysis** | Mistake classification (8 classes) | A mistake is classified for the *student*, to choose the next practice; never reported onward | Held: `MistakeClassification` in `lib/learning-loop.ts` |
| **Calibration** | Confidence-before-answer, then compare | Show the gap between confidence and correctness back to the student only | Partial: `confidence-mismatch` class exists; no confidence-before-answer capture is evidenced here |
| **Planning, not monitoring** | Work-completion planner, workload view | Plans are the student's; the app never reports study hours to anyone | Held: planner (register L03); `learninginsights.ts` refuses time-based figures |
| **Rereading / highlighting / summary-as-study** | Not offered as study credit | May exist as note-taking; never counted as a study action in a plan | Partial: not counted today, no rule forbids it |

**Why the table leans on retrieval, spacing and interleaving.** These are the
techniques that reviews of the learning-technique literature rate most useful
(Dunlosky et al., 2013, *Psychological Science in the Public Interest*), and
they share a property that matters for product design: they feel harder and
less fluent than rereading, so a tool optimised for how satisfying a session
feels will drift away from them. A product that measures satisfaction will
tune toward the wrong techniques. That is why [07](07-METRICS.md) refuses
satisfaction and time as success measures.

*Citations in this pack are from the author's knowledge of the literature and
have not been re-verified against the sources for this document. Per the
evidence standard in §4, verify before using any of them in a public or
contractual claim.*

### Requirements: study

| ID | Requirement | Today |
| --- | --- | --- |
| LI-DES-01 | Every study mode asks for an attempt before it reveals an answer, unless the student explicitly chooses "show me." | Partial: held in tutor `STEPS`; not stated as a rule for flashcards or practice paper |
| LI-DES-02 | A study plan item can be satisfied only by a retrieval, practice, teach-back or review action, not by opening or summarising material. | Absent as a rule |
| LI-DES-03 | A confidence rating is captured before the answer is revealed and the student sees their own confidence-versus-correctness trend. | Partial |
| LI-DES-04 | No study metric shown to the student uses time online, clicks, streak length or comparison with other students. | Held: `learninginsights.ts`; `src/donotbuild.test.ts` (no unexplained score) |
| LI-DES-05 | Generated study material (guides, questions) is labelled AI-assisted, cites the passage it came from, and its quotations are machine-checked against the source. | Held: `lib/cite.ts`, `lib/studystudio.ts`; labelled in Study |
| LI-DES-06 | Practice data stays on the device unless the student explicitly shares it, and sharing is per-purpose and revocable. | Held for on-device practice: `app/src/lib/learninginsights.ts` (every figure stays on the device); no share-for-research flow exists |

## 3. Accommodation considerations in learning design

Detail is in [05](05-ACCOMMODATIONS.md). The learning-design consequences:

1. **Universal design is the default path.** Multiple means of representation,
   action and engagement exist for everyone (read-aloud, readable density,
   reduced motion, captions) without a request. Held in part:
   `app/src/lib/accessmode.ts` (modes chosen by the user, never inferred).
2. **Flexibility that does not require disclosure.** A limited number of
   no-questions extensions ("flex passes") sit at course level so that most
   students who need slack never have to reveal a reason. Absent.
3. **Study tools respect the same modes.** Spaced-repetition, practice paper and
   tutor all honour the access modes; none depends on colour, timing pressure
   or drag-only input to work. Partial; verify with
   [`docs/accessibility/AT-PASS-PROTOCOL.md`](../accessibility/AT-PASS-PROTOCOL.md).
4. **Assistive use is not "AI help."** Read-aloud, dictation, spell-check and
   captioning can be an accommodation and must not be blocked by a course's
   "no generative AI" setting ([03 §6](03-AI-TUTORING-AND-BOUNDARIES.md)).

## 4. Evidence standards

Semester makes claims about learning to students, faculty and buyers. A claim
may only be made at the level of evidence behind it. This is the same
discipline `PUBLIC-CLAIMS-APPROVAL-REGISTER.md` applies to commercial claims,
applied to pedagogical ones.

| Tier | Name | What it means | What it entitles |
| --- | --- | --- | --- |
| **E0** | Assertion | A belief, a competitor's feature, a founder's view | Nothing. Internal hypothesis only. |
| **E1** | Mechanism-supported | The design rests on named findings from peer-reviewed research, and a learning scientist has reviewed the mapping from finding to feature | "Designed around [technique]." Not "improves learning." |
| **E2** | Behaviour-verified | The feature does what the design says: automated tests, an adversarial/red-team set where relevant, and a human review of sampled outputs | "Hint mode does not give the final answer"; "quotations are checked against your source" |
| **E3** | Locally evidenced | A pre-registered comparison at a real institution (stepped-wedge, randomised encouragement, or matched comparison) using a **learning outcome** (assessed work, delayed test, transfer task), with the analysis plan fixed before the data | "At [institution], students using X [did/did not] show Y on Z." Stated with its limits. |
| **E4** | Replicated | E3 repeated in a second term or institution, analysed independently, with the null and negative results published | "Evidence shows X improves Y in settings like [list]." |

### Rules

| ID | Rule | Today |
| --- | --- | --- |
| LI-EVD-01 | No public, sales or in-product statement that Semester "improves learning," "raises grades," "reduces cheating" or "detects AI" may be made below E3 for that exact claim. Feature descriptions ("designed around retrieval practice") may be made at E1. | Absent: the public-claims register covers commercial claims; no learning-claim tiering is evidenced |
| LI-EVD-02 | Engagement, satisfaction, time-on-task and usage are **never** evidence at any tier. They may be reported as diagnostics only. | Partial: `app/src/lib/learninginsights.ts` refuses them for students; no rule for institutional reports |
| LI-EVD-03 | Every AI feature in `docs/trust/AI-SYSTEM-INVENTORY.md` records its evidence tier for its main learning claim. | Absent |
| LI-EVD-04 | A learning scientist (named role, see [08](08-GOVERNANCE-AND-REQUIREMENTS-TRACE.md)) signs the E1 mapping before a feature ships; faculty or an academic-governance body signs any E3 protocol that involves students. | Absent |
| LI-EVD-05 | Student research data is collected only with consent that is separate from product use, revocable, and covered by the institution's ethics review where one applies. | Absent |
| LI-EVD-06 | A negative or null E3 result is recorded in the same register and constrains what may be claimed. | Absent |

### What the research does and does not license (read before writing any claim)

- Retrieval practice, spacing and interleaving have robust support in
  controlled studies, mostly of memory and, increasingly, of transfer. They
  support "designed around"; they do not on their own support "Semester
  improves grades."
- Evidence on **generative AI tutoring** is early and mixed, and the pattern
  matters for design: controlled studies have reported that unrestricted
  chatbot access can raise practice performance while lowering later
  unassisted performance, and that tutors built on explicit pedagogy and
  guardrails can do better than unguided use (Bastani et al., 2024/2025;
  Kestin et al., 2025, are the two the author would start from). The design
  inference is the one this pack already makes — cap the help, require the
  attempt — but it is an inference, not a result about Semester. **It is an E1
  basis for the hint ladder and nothing more.**
- AI-writing detectors have no validated universal error rate, and the
  repository's own governance page reaches the same conclusion
  (`app/src/lib/governance/grading-ai.ts`: "There is no universal false-positive
  rate for … any AI-grading tool"). This is why [04](04-ACADEMIC-INTEGRITY-CONTROLS.md)
  does not use detector output as evidence.

## 5. Open items for this document

1. A named learning scientist and an academic-governance body do not exist
   yet; LI-EVD-04 cannot be met until they do (see [08](08-GOVERNANCE-AND-REQUIREMENTS-TRACE.md) §1).
2. Every citation above needs verification against the primary source before
   external use.
3. There is no mechanism to collect outcome data beyond what an instructor
   already holds in graded work; see the tension stated in [07 §6](07-METRICS.md).
