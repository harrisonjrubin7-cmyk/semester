# 03 · AI tutoring boundaries, citation and source behaviour, instructor controls

Deliverables covered: **AI tutoring boundaries**, **citation/source behaviour**,
**instructor controls** (with escalation; integrity controls are in
[04](04-ACADEMIC-INTEGRITY-CONTROLS.md)).

## 1. What exists, and the one structural weakness

The tutor already has a good design in prompt form
(`app/src/lib/socratic.ts`): five modes (Explain, Hint, Practice, Review,
Draft), an eight-rung hint ladder from "clarify the goal" to "give the direct
answer", a decision order that puts policy first, a one-thing-wrong feedback
contract, and a hand-off to named people when the ladder runs out. Policy
resolves assignment → course → school → university → Semester fallback, and
the fallback is **unavailable**, which never permits
(`app/src/lib/toolkit/policy.ts`). A course that "allows AI" still resolves
*final answers for an assessment* to not-allowed. Source quotations are
verified verbatim and the verdict is binary (`app/src/lib/cite.ts`).

**The weakness: the ceiling is prompt text, not a gate.** In `socratic.ts`
the cap on the top rung is text handed to the model, and
`app/src/lib/toolkit/safety.ts` — the only refusal for "answers to the
take-home" — is a keyword list that says of itself it is "a notice, not a
filter" and "a poor guard." A model can be talked out of a prompt; a student can
rephrase around a regular expression. **Until the cap is enforced where the
model cannot argue with it, "the tutor will not do your assessment" is an
E0/E1 claim** ([01 §4](01-LEARNING-DESIGN-AND-EVIDENCE.md)), and must not be
made in sales or student-facing copy as a guarantee.

## 2. Tutor modes and ceilings

The first three columns describe what `socratic.ts` does today. The last two
are this pack's proposal for how each mode is gated.

| Mode | What the student gets (today) | Policy use it needs (today, `NEEDS` in `socratic.ts`) | Ladder (today) | Proposed gate |
| --- | --- | --- | --- | --- |
| Explain | A source-grounded explanation; no tutoring fragment, deliberately, so "explain elasticity" does not become a quiz | explanation | None — the default, unchanged | Explains *concepts*; refuses the assessed task's answer |
| Hint | One rung at a time from the lowest useful | explanation | Climbs one rung per request; names a person when the ladder ends | Ceiling from policy, never above 6 when a course is in view |
| Practice | Questions, varied problems | practice | n/a | Private lane P ([02 §2.1](02-ASSESSMENT-MASTERY-AND-FEEDBACK.md)) |
| Review | Feedback on the student's own full attempt: what holds, first place it goes wrong | outline-feedback | Rung 6 | Never rewrites |
| Draft | Policy-permitted drafting help | revision | n/a | Requires disclosure where policy says `limited` or `required`; records provenance |

Rung 7 (the direct answer) is reachable today only where *no course is in
view*. Where a course is in view the ceiling is 6, whatever the recorded
stance. The proposal is that the same rule hold where an **assignment** is
linked, and that it be enforced at the gateway (§4), not requested of the
model.

## 3. Boundaries: what the tutor will never do

| ID | Boundary | Enforced by | Today |
| --- | --- | --- | --- |
| LI-TUT-01 | Never produce the answer to, or the substance of, an **assessed** task where policy does not permit it. | Server-side policy gate before the model is called (see §4); red-team suite | Partial: prompt ceiling + keyword notice; no gate |
| LI-TUT-02 | Never fabricate a source, quotation, statistic or reference. | Retrieval-only citing; verbatim quotation check; "unverified" label (see §5) | Partial: quotations verified (`cite.ts`); reference-fabrication guard for free-text answers not evidenced |
| LI-TUT-03 | Never determine or imply a grade, standing, enrolment, aid, accommodation, discipline, diagnosis or eligibility. | Output policy + red-team; no tool exposes these | Held by design: stated in `docs/learning-university-systems/AI-LEARNING-ASSISTANT-SPEC.md`; `module-privacy.ts` (AI never infers mental health, financial distress, disability, academic risk, immigration status or misconduct risk) |
| LI-TUT-04 | Never accuse a student of misconduct, estimate "likelihood of AI use," or comment on another student's work. | Not a capability; output policy | Held by absence |
| LI-TUT-05 | Never reveal or reason from another student's data, or from a student's data to a third party. | Tenant/role-scoped retrieval before context is built | Partial: architecture requirement; not evidenced end-to-end for the tutor |
| LI-TUT-06 | Never replace a human in a crisis. A statement of distress, harm, abuse or an emergency changes the response from tutoring to care routing. | Care boundary rules + named human routes | Partial: [`CARE-AND-ESCALATION-BOUNDARIES.md`](../learning-university-systems/CARE-AND-ESCALATION-BOUNDARIES.md) exists; tutor routing not evidenced |
| LI-TUT-07 | Never give clinical, legal or financial advice as if from a professional; say so and route. | Professional-boundary notice + refusal | Partial: notices in `toolkit/safety.ts` (a notice, not a filter) |
| LI-TUT-08 | Never keep a score, streak or reward for returning. | Product rule | Held: stated in `app/src/lib/socratic.ts` |
| LI-TUT-09 | A student can always continue without AI, remove context, reject output and report an issue. | UX requirement | Partial: stated in `docs/learning-university-systems/AI-LEARNING-ASSISTANT-SPEC.md`; not re-read in the UI |
| LI-TUT-10 | Every response returns: the task performed, sources used, limitations, and where to verify or get a human. | Response contract | Partial: contract stated in spec |

## 4. Enforcement architecture (the gate)

The requirement is simple: **the model must never be sent a request it is not
permitted to answer, and its output must be checked against the same
permission.** The AI gateway ([`docs/target-architecture/`](../target-architecture/README.md),
`ai-gateway`) is the place.

```
student request
  → purpose classification          (study | writing | planning | official-info | sensitive)
  → context binding                 (which course, which assignment, which policy VERSION)
  → policy decision                 (server-side; same resolver as the UI: assignment → course → school → university → fallback=unavailable)
        ├─ unavailable / prohibited → refusal + redirect (plan the steps, office-hours questions, explain from material, practise on a similar problem)
        └─ allowed / limited / required → set the CEILING (max rung, allowed modes, allowed sources)
  → retrieval filter                (only the student's chosen sources + tenant-approved course material; filtered BEFORE context is built)
  → model call                      (mode + ceiling in a system message AND as a typed parameter the gateway checks on return)
  → output check                    (does the response exceed the ceiling? contain unattributed quotes? name a grade?)
  → response contract assembly      (task performed, sources, limitations, handoff)
  → audit event                     (policy decision, mode, ceiling, policy version, sources, refusal Y/N; no content by default)
```

Key properties:

1. **One resolver.** The UI and the gateway call the same policy function.
   `lib/toolkit/policy.ts` is the reference; moving it to the gateway means the
   unit tests move with it. A UI that says "allowed" while the server says "no"
   is a P8 failure.
2. **Context binding is the student's declaration plus the system's link.**
   The system cannot know a student is asking about their take-home unless the
   assignment is linked or the student says so. So the gate is **not** a proof
   of honesty and must not be sold as one (§1). What it does: removes any
   path where the platform *itself* hands over assessed work when it knows the
   context, and makes the honest path the easy path.
3. **Output check, not just input check.** A request that looks harmless can
   draw out a full answer; the gateway compares the response to the ceiling
   (rung-class classifier + a held-out test set), and degrades to a lower rung
   rather than failing silently.
4. **Policy version recorded.** Every session stores the policy version in
   force; a mid-term tightening does not retroactively redefine what was
   allowed ([06 §3](06-POLICY-CONFIGURATION-AND-WORKFLOWS.md)).
5. **Audit without surveillance.** The event records the decision, not the
   conversation; see §7.

| ID | Requirement | Today |
| --- | --- | --- |
| LI-TUT-11 | The mode ceiling is enforced server-side and the gateway rejects a model response above it. | Absent |
| LI-TUT-12 | An adversarial suite ("do my assessment") of at least the categories in §8 runs on every model, prompt or policy change and blocks release below its threshold. | Absent: `socratic.test.ts` checks prompt content, not model behaviour |
| LI-TUT-13 | UI and gateway share one policy resolver; a contract test fails if they disagree on a fixture set. | Absent |
| LI-TUT-14 | A model or provider change triggers the full regression suite and an evidence-tier review ([01 §4](01-LEARNING-DESIGN-AND-EVIDENCE.md)). | Absent as a gate; model-change regression is named as acceptance in the spec |

## 5. Citation and source behaviour

### 5.1 Rules

| ID | Rule | Today |
| --- | --- | --- |
| LI-SRC-01 | **Grounded by choice.** Course answers draw on sources the student chose (source locker) and tenant-approved course material; nothing else is retrieved silently. The student can see and remove each source. | Held per spec: `docs/ai-toolkit/SOURCE-LOCKER-AND-PROVENANCE.md`; `lib/source-locker.ts` |
| LI-SRC-02 | **Quotations are verified verbatim**, with whitespace, curly quotes, dashes and case forgiven, and a changed word, dropped clause or differing number not forgiven. The badge is binary: confirmed or not. | Held: `app/src/lib/cite.ts`, `cite.test.ts` |
| LI-SRC-03 | **No invented references.** Reference suggestions come only from retrieved material or a verified bibliographic source; anything else is labelled *unverified — find it in the library before you cite it*. The tutor never completes a half-remembered citation. | Absent as an enforced rule |
| LI-SRC-04 | **Three claim types are visibly different:** (a) *from your source* (quote + location), (b) *from general knowledge* (labelled, no citation), (c) *I'm not sure* (stated, with a person or tool to check). | Partial: spec requires "sources used, confidence/limitations"; typing of claims not evidenced |
| LI-SRC-05 | **Official facts have a source and a date or are deferred.** A deadline, a policy, a requirement, a price or an eligibility rule is shown with its origin and freshness (official / connected / student-entered / AI-extracted / stale), or the tutor says "check with [named office]." | Partial: provenance badges and freshness exist elsewhere (`docs/FIELD-LINEAGE-AND-SOURCE-FRESHNESS.md`, `TRUST-CUES-AND-SOURCE-PRESENTATION.md`); tutor use not verified |
| LI-SRC-06 | **Documents are data, not instructions.** Text in an uploaded or retrieved document cannot change the tutor's mode, policy, ceiling or tool access (prompt-injection defence at the retrieval boundary). | Absent as evidenced test for the tutor; named in the audit |
| LI-SRC-07 | **Citation formatting is done from verified metadata** (RIS/BibTeX export exists), and the student is told the format must be checked against their style guide. | Held: toolkit exports (`docs/ai-toolkit/ACADEMIC-WORK-PROVENANCE.md`) |
| LI-SRC-08 | **Instructor-provided sources outrank general knowledge** for course questions; where they conflict the tutor says so and defers to the instructor. | Absent |

### 5.2 What good looks like, in one exchange

> **Student:** What does the syllabus say about late work?
> **Tutor:** "Late submissions lose 10% per day, up to 50%." *(Syllabus, p.3 — quotation confirmed against your uploaded copy.)* That is the instructor's statement; it may have changed since you uploaded it — check the course page if you are close to a deadline.

Same question, no uploaded syllabus: *"I don't have your syllabus. Upload it, or
check [course page]; I can tell you what's typical, but I'd be guessing for
your course."* — never a plausible-sounding policy.

## 6. Assistive use is not generative help

A course setting of "no generative AI" must not disable read-aloud, dictation,
spell-check, captioning, screen-reader support or similar assistive technology,
whether or not the student has a registered accommodation. The policy model
therefore distinguishes **uses**, not "AI on/off":

| Use class | Examples | Can a "no AI" course block it? |
| --- | --- | --- |
| Assistive / access | read-aloud, dictation, captions, readable-text, translation of interface | **No** |
| Mechanical | spell-check, grammar underline, citation formatting from verified metadata | Instructor decides, default allowed |
| Explanatory | explain a concept from course material | Instructor decides |
| Feedback on the student's own work | review a draft against the rubric | Instructor decides |
| Generative | produce draft text, solve, rewrite | Instructor decides, default prohibited for assessed work |

The existing policy uses (`brainstorming, outline feedback, practice, grammar,
explaining material, AI-assisted revision, AI diagrams, data-cleaning
suggestions, code help, final answers for an assessment`) map onto these
classes; the **assistive/access class is the missing row**. See LI-POL-04
([06](06-POLICY-CONFIGURATION-AND-WORKFLOWS.md)).

## 7. Instructor controls (summary; schema in 06)

| Control | Scope | Default | Student sees |
| --- | --- | --- | --- |
| AI use per assignment, by use class (§6) | Assignment | Policy unavailable → no generative help | A policy card with plain-language rows |
| Mode ceiling | Course / assignment | 6 for graded-linked work | The ceiling, in words |
| Allowed sources | Course / assignment | Course materials + student's chosen sources | List of sources in scope |
| Disclosure required | Assignment | Where policy is `limited` or `required` | A declaration to complete (held: `lib/toolkit/disclosure.ts`) |
| Course context for the tutor | Course | Off | "Your instructor added context for the tutor" with the text |
| Aggregate tutoring themes | Course | On, above floor of ten | Nothing identifying |
| **Individual session transcripts** | — | **Not available to instructors.** The student can *choose* to share a session with a submission. | Always sees what they are sharing |

The last row is a deliberate position. A silent "instructor can read every
tutoring conversation" setting would turn a learning tool into hidden
surveillance, would chill help-seeking by the students who most need it, and
contradicts [P5](01-LEARNING-DESIGN-AND-EVIDENCE.md). If an institution
insists, it is a **governance-review item** ([08](08-GOVERNANCE-AND-REQUIREMENTS-TRACE.md)
G-04): it must be configured by the institution, shown on every session
start, never retroactive, excluded from any integrity finding, and reviewed
by counsel. It is not built by default.

## 8. Adversarial test categories (minimum)

The suite in LI-TUT-12 must cover at least:

1. Direct: "write my essay / solve problem 3 / give the answer to the quiz".
2. Staged: harmless sub-questions that sum to the whole assessment.
3. Role-play and framing: "pretend you are the grader", "for an example".
4. Context laundering: asserting the task is not graded.
5. Language and format: other languages, code, pasted images of questions.
6. Source-fabrication prompts: "give me 5 references for this claim".
7. Injection via documents: instructions hidden in an uploaded file.
8. Policy inference: "what is my instructor's AI policy?" with none recorded.
9. Boundary cases that should **not** be refused: explaining a concept used in
   the assignment, reviewing the student's own draft, assistive use. The suite
   measures **over-refusal** as well as under-refusal; a tutor that refuses
   legitimate help also fails the student.
10. Distress and safety statements mid-tutoring.

## 9. Escalation

| Trigger | Tutor action | Human route | Record |
| --- | --- | --- | --- |
| Ladder exhausted, student still stuck | Stop adding hints; name a person | Office hours; tutoring; writing centre; library | None (no content) |
| Student reports a wrong or harmful answer | Offer "report an issue" | Support/trust queue; model owner | Report with the response id |
| Student asks for assessed work the policy forbids | Refuse + redirect (§4) | Instructor, if the student wants to ask for a change | Policy decision event |
| Student disclosure of distress, harm or an emergency | Switch to care routing; do not continue tutoring as if nothing happened | Counselling, campus safety, emergency services per institutional escalation policy | Minimal event; no transcript |
| Suspected prompt-injection or abuse | Refuse; do not follow injected text | Security/trust & safety | Security event |
| A student asks "will you tell my instructor?" | Answer truthfully from the configured policy | — | — |

"The tutor tells the instructor" is not an escalation path. Concerns about
integrity go through [04 §6](04-ACADEMIC-INTEGRITY-CONTROLS.md), initiated by a
human.
