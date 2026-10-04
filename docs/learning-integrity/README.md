# Semester learning science and academic integrity — role pack

Status: **proposed**, written 2026-10-04 against `origin/main` `dac31c9`.
Author role: Learning Science and Academic Integrity Lead (acting). Nothing
here is accepted until the bodies named in [08](08-GOVERNANCE-AND-REQUIREMENTS-TRACE.md)
accept it, and nothing here is a legal conclusion.

Input: the external rebuild audit and its role prompt for this role ("ensure
Semester's native learning, study, assessment, tutoring, AI, and feedback
systems improve learning while supporting institutional academic-integrity
policies … do not design AI or study tools that encourage unauthorized work,
false confidence, or hidden surveillance"), the audit's *shared preamble*
(page 68), and a read of this repository. Where the audit and the repository
disagree, this pack says so.

## The answer in ten lines

1. **Three lanes with a firewall.** Practice (private), formative-shared and
   graded work are separate lanes; practice data never feeds a grade, alert,
   risk or integrity path ([02 §2.1](02-ASSESSMENT-MASTERY-AND-FEEDBACK.md)).
2. **Mastery is the instructor's evidence against an outcome, never the
   student's private study state**, and it is explainable on screen
   ([02 §3](02-ASSESSMENT-MASTERY-AND-FEEDBACK.md)).
3. **The tutor's ceiling is currently prompt text and a keyword notice.** It
   must become a server-side gate with an adversarial suite that measures
   over-refusal as well as under-refusal, and until then Semester must not say
   the tutor "won't do your assessment" as a guarantee ([03 §1, §4](03-AI-TUTORING-AND-BOUNDARIES.md)).
4. **No detector, no behavioural analytics, no hidden collection.** Integrity
   rests on clarity, assessment design, student-held process evidence and a
   human due process; a signal is a question for a person, never a finding
   ([04](04-ACADEMIC-INTEGRITY-CONTROLS.md)).
5. **Semester builds no proctoring.** An institution may connect one under 13
   conditions, including notice at enrolment, a no-questions alternative, no
   emotion or face inference, and flags that are never findings ([04 §5](04-ACADEMIC-INTEGRITY-CONTROLS.md)).
6. **Accommodations are effects, applied automatically, and never lost to a
   "no AI" setting.** Today the passport is a sentence nothing reads
   ([05](05-ACCOMMODATIONS.md)).
7. **Assistive use is a class of its own** and cannot be blocked at any policy
   layer ([03 §6](03-AI-TUTORING-AND-BOUNDARIES.md)).
8. **Policy is versioned, layered, bounded and generated into the text
   students read**; a mid-term tightening never traps work already begun
   ([06](06-POLICY-CONFIGURATION-AND-WORKFLOWS.md)).
9. **Engagement is never evidence.** Metrics measure outcomes, support quality,
   equity, process fairness and AI boundary integrity; learning claims need a
   pre-registered comparison (E3) ([01 §4](01-LEARNING-DESIGN-AND-EVIDENCE.md), [07](07-METRICS.md)).
10. **The repository is strongest where it prohibits and weakest where it must
    enable:** of 137 requirements, 29 are held, 34 partial, 74 absent
    ([08 §5](08-GOVERNANCE-AND-REQUIREMENTS-TRACE.md)).

## Contents

| Doc | Deliverable requested |
| --- | --- |
| [01 Learning design and evidence](01-LEARNING-DESIGN-AND-EVIDENCE.md) | Learning design principles · study methodology · accommodation considerations · evidence standards |
| [02 Assessment, mastery and feedback](02-ASSESSMENT-MASTERY-AND-FEEDBACK.md) | Assessment model · feedback model · requirements for assignments, assessments, rubrics, mastery, gradebook |
| [03 AI tutoring and boundaries](03-AI-TUTORING-AND-BOUNDARIES.md) | AI tutoring boundaries · citation/source behaviour · instructor controls · escalation |
| [04 Academic-integrity controls](04-ACADEMIC-INTEGRITY-CONTROLS.md) | Academic-integrity controls · proctoring/integrity integrations · escalation and due process |
| [05 Accommodations](05-ACCOMMODATIONS.md) | Accommodation requirements across assignments, assessments, gradebook, proctoring |
| [06 Policy configuration and workflows](06-POLICY-CONFIGURATION-AND-WORKFLOWS.md) | Faculty/tutor workflows · policy configuration requirements |
| [07 Metrics](07-METRICS.md) | Evaluation metrics that measure learning support rather than engagement |
| [08 Governance and requirements trace](08-GOVERNANCE-AND-REQUIREMENTS-TRACE.md) | Risks requiring academic governance and human review · requirement roll-up · build order |

## How this relates to what already exists

This pack **indexes and extends**; it does not restate. The existing material
it builds on, read for this pack:

| Existing | What it already settles |
| --- | --- |
| [`learning-university-systems/AI-ACADEMIC-INTEGRITY-SPEC.md`](../learning-university-systems/AI-ACADEMIC-INTEGRITY-SPEC.md), [`AI-LEARNING-ASSISTANT-SPEC.md`](../learning-university-systems/AI-LEARNING-ASSISTANT-SPEC.md), [`EARLY-ALERT-AND-HUMAN-REVIEW-SPEC.md`](../learning-university-systems/EARLY-ALERT-AND-HUMAN-REVIEW-SPEC.md) | The principles, in a paragraph each. This pack turns each paragraph into controls, tests and a due-process path. |
| [`ai-toolkit/`](../ai-toolkit/README.md) (policy precedence, rubric self-check, AI-use declaration, provenance, UDL, active learning) | The student-side mechanics, and the rule that practice data is never a risk score. |
| [`LEARNING-ASSESSMENT-GRADEBOOK-REGISTER.md`](../LEARNING-ASSESSMENT-GRADEBOOK-REGISTER.md) (L01–L14) | What exists on the student and faculty sides, and the twelve release criteria for consequential grading, which this pack adopts unchanged. |
| `app/src/lib/` — `socratic.ts`, `cite.ts`, `learning-loop.ts`, `learninginsights.ts`, `rubricengine.ts`, `itembank.ts`, `accessmode.ts`, `toolkit/policy.ts`, `governance/grading-ai.ts`, `institution-ops.ts`, `lib/ops/boundaries.test.ts` | The code that already enforces a prohibition or a rule. |
| [`trust/`](../trust/COMPLIANCE-CROSSWALK.md) (`AI-GOVERNANCE-PROGRAM.md`, `AI-HUMAN-OVERSIGHT-STANDARD.md`, `AI-RISK-ASSESSMENT.md`) | The AI governance program that this pack's gates (08 §3) should be folded into. |
| [`GRADESCOPE-TURNITIN.md`](../../GRADESCOPE-TURNITIN.md) | Why there is no legitimate route to push into Gradescope, and that Turnitin's API is a partnership. |
| [`target-architecture/`](../target-architecture/README.md) (CTO pack) | The `ai-gateway` and policy decision point this pack's enforcement design uses. |

### Mapping to the register

No register is edited by this pack: no capability's status changed.

| This pack | Register area | Gap this pack names |
| --- | --- | --- |
| 02 assessment, rubrics, gradebook | L07, L08, L09, L10, L11 | Faculty side is sandbox; accommodations not applied; lane field; outcome records |
| 03 tutoring, citation | L05, L12 | Ceiling is prompt-only; reference-fabrication guard; claim typing |
| 04 integrity, proctoring | L13 | Declaration device-only; no review queue, referral, similarity or education |
| 05 accommodations | L08 (accommodation-aware timing), migration `20260926150000` | Effects not machine-readable; never applied |
| 07 metrics | L14 | "None of the useful measures exists" |

## Outputs the shared preamble requires

**Assumptions.** (1) The first institution is a US higher-education
institution with a disability-services office and an integrity office; other
jurisdictions are not assumed. (2) The `ai-gateway` of the CTO pack is built;
without it, 03 §4 has no home. (3) The faculty-side libraries stay "wired to no
screen" until a faculty UI is built; this pack does not assume they are live.
(4) The numbers proposed in this pack (30-day recording retention, 3-day
acknowledgements, the E3 comparison designs) are starting points for the
owning body, not findings.

**Risks and unresolved questions.** [08 §2](08-GOVERNANCE-AND-REQUIREMENTS-TRACE.md)
(18 risks), [08 §3](08-GOVERNANCE-AND-REQUIREMENTS-TRACE.md) (12 review gates),
[08 §7](08-GOVERNANCE-AND-REQUIREMENTS-TRACE.md) (7 open questions). The ones
that block everything else: Q1 (a named learning scientist and an advisory body
do not exist yet) and the absence of a server-side policy store.

**Files changed or proposed.** Added: this pack (`docs/learning-integrity/`,
nine files), `app/src/lib/ops/learningintegrity.test.ts`, and a decision
record under `docs/decisions/`. Proposed, not made: a server-side policy store
and resolver; a tutor gate at the gateway; accommodation effects columns and
an effects-applying delivery path; outcome and mastery tables; a referral and
decision workflow; instrumentation events (metadata, no content). No source,
migration or flag is changed.

**Tests added.** `app/src/lib/ops/learningintegrity.test.ts`, six tests: every
requirement id unique with a status; a Held row names a file that exists or
says it is held by absence or by design; every path and link the pack cites
resolves; the roll-up in 08 is the count of the rows; two controls show the
parser sees a bad row and a missing path. The guard was shown to fail: a Held
row citing a missing file, a Held row naming nothing, and a typed figure in the
roll-up each turned it red, and restoring them turned it green. It also
caught 16 Held rows that cited no resolvable file and one wrong path in this
pack's own first draft; those were corrected (several downgraded to Partial).
It does **not** run the tests it cites.

**Accessibility implications.** The assistive-use class (03 §6) and the
effects model (05) are the substance. Also: accessible alternatives are
required for every proctored assessment (LI-PRC-04, -06); policy cards and
syllabus text must be plain-language and screen-reader-ready (LI-POL-06);
every faculty and tutor workflow must pass the AT protocol (LI-WRK-04);
timed assessment delivery must apply time, break and format effects
automatically (LI-ACC-02). No conformance claim is made.

**Security and privacy implications.** The lane firewall (02 §2.1) and
reader-allowlist tests on accommodation tables (LI-ACC-08); no individual
tutoring transcript to instructors by default (03 §7, gate G-04); integrity
and accommodation records are student-record class with institution-set
retention and legal hold (LI-INT-21, AC-3); no on-device practice data leaves
the device without consent (07 §6); the tutor gate treats uploaded documents as
untrusted data (LI-SRC-06); vendors for match and proctoring tools enter the
vendor register with a privacy review (LI-INT-08, LI-PRC-03). Legal
conclusions are routed to `LEGAL-REVIEW-QUEUE.md`.

**Operational and runbook implications.** The adversarial suite (03 §8)
becomes a release gate for any model, prompt or policy change (LI-TUT-12,
-14), and `docs/trust/AI-INCIDENT-AND-KILL-SWITCH-RUNBOOK.md` needs a tutor-gate
section (kill the ceiling to a lower rung, not just the feature). Integrity
referral and appeal need staffed queues with acknowledgement targets
(LI-INT-22); accommodation issuance and share expiry need an
owner in disability services; policy changes need a student-notification step
(LI-POL-10); support needs macros for "why can't I use the tutor on this
assignment" that read from the policy store; faculty, tutors and integrity-
office staff need training before a feature is enabled for them (LI-ADM-05).

**Traceability matrix updates.** The requirement ids (`LI-*`) are the matrix
for this role: 137 rows with status and evidence, rolled up in
[08 §5](08-GOVERNANCE-AND-REQUIREMENTS-TRACE.md) and held to the tree by the
test above. The register mapping is in the table above. No existing matrix is
edited.

## What was and was not verified

See [08 §8](08-GOVERNANCE-AND-REQUIREMENTS-TRACE.md). In one line: the cited
files exist and say what the pack says they say (checked by a test for
existence, by reading for content); no cited test was run for this pack;
the four research citations were checked on 2026-10-04 (one error and one
overreach corrected; three papers not read in full, see 01 §4) and still need a
full read before external use; every legal conclusion is for qualified counsel.
