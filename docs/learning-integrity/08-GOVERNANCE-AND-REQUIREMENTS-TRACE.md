# 08 · Governance, risks requiring human review, and the requirements trace

Deliverable covered: **risks requiring academic governance and human review**,
plus the roll-up of every requirement in this pack and the order to build it.

## 1. Who decides

This pack proposes rules; it cannot approve them. Four of the bodies it relies
on **do not exist yet** in the repository's own records, and the pack's
requirements that name them (LI-EVD-04, LI-ADM-01..02, LI-INT-17) cannot be met
until they do.

| Body | Role | Exists today? |
| --- | --- | --- |
| **Academic governance council** (per institution, and a Semester-level advisory one) | Approves policy floors/ceilings, integrity process design, any item in §3, and the evidence register | Not evidenced. Institutions have their own; Semester's advisory body would be new |
| **Learning scientist (named role)** | Signs E1 mappings, reviews E3 protocols, owns the evidence register | Not evidenced |
| **Disability-services representative** | Owns the effect list and accommodation rules ([05](05-ACCOMMODATIONS.md)) | Institution-side; no Semester interface beyond the migration |
| **Integrity-office representative** | Owns the referral and decision process ([04 §6](04-ACADEMIC-INTEGRITY-CONTROLS.md)) | Institution-side |
| **Student representation** | Reviews student-facing copy, policy cards, the process-evidence design | Not evidenced |
| **Privacy and legal counsel** | Every legal conclusion; proctoring and match-tool vendors; retention; minors | Routed to `LEGAL-REVIEW-QUEUE.md`; conclusions require qualified counsel |
| **Accessibility specialist** | Conformance claims and AT testing | `docs/accessibility/AT-PASS-PROTOCOL.md` exists as a protocol |

`docs/trust/AI-HUMAN-OVERSIGHT-STANDARD.md`, `AI-GOVERNANCE-PROGRAM.md` and
`AI-RISK-ASSESSMENT.md` already describe an AI governance program; this pack
adds the **pedagogical and integrity** decisions to it and should be folded
into that program's agenda, not run beside it.

### Suggested RACI for the decisions in this pack

R responsible · A accountable · C consulted · I informed.

| Decision | Learning scientist | Governance council | Disability services | Integrity office | Counsel | Faculty (instructor) | Semester product | Students |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Policy floors/ceilings | C | A | C | C | C | C | R | C |
| Effect list for accommodations | C | I | A/R | I | C | C | R | C |
| Enable proctoring integration | C | A | C | C | R | C | R | C |
| Enable match/similarity tool | C | A | C | R | C | C | R | C |
| Enable any transcript visibility | C | A | C | C | R | C | I | C |
| Integrity referral process | C | A | I | R | C | C | R | C |
| Evidence tier for a public claim | A/R | C | I | I | C | I | R | I |
| E3 pilot protocol | A/R | C | I | I | C | C | R | I |
| Mastery aggregation rule | C | I | I | I | I | A/R | R | C |

## 2. Risk register

Likelihood and impact are the author's judgement for a first institution, not
measurements. Owner is a role. "Control" refers to this pack.

| # | Risk | Harm | L | I | Control | Owner |
| --- | --- | --- | --- | --- | --- | --- |
| R-01 | Tutor ceiling is prompt-only; a student or a model update bypasses it | Platform hands over assessed work; claims about integrity are false | H | H | LI-TUT-11..14, gateway enforcement; do not claim a guarantee until E2 | Product + learning scientist |
| R-02 | Detector or match output treated as proof | False accusation; disparate harm to second-language writers | M | H | No detector built; C9 as report only; LI-INT-10..12, -18 | Integrity office + counsel |
| R-03 | Hidden collection (transcripts, keystrokes, practice data) creeps in "for analytics" | Loss of trust; legal exposure; chilling of help-seeking | M | H | P5; §2.1 of 04; [07 §6](07-METRICS.md); reader-allowlist tests | CISO + governance |
| R-04 | Accommodation not applied (the gap in [05 §2](05-ACCOMMODATIONS.md)) | Student loses time/format in a high-stakes assessment | H | H | LI-ACC-01..03; do not run a consequential timed assessment without them | Product + disability services |
| R-05 | "No AI" course policy blocks assistive technology | Disability discrimination risk; access harm | M | H | Assistive class never blockable (LI-POL-04, LI-ACC-04) | Product + disability services + counsel |
| R-06 | Mastery shown to students from a hidden or opaque rule | Students cannot contest or plan | M | M | LI-MAS-01..03 | Instructor + product |
| R-07 | Private "readiness" read as a prediction by students or faculty | False confidence; or labelling | M | M | Range not point; label; keep out of faculty views | Learning scientist |
| R-08 | A learning claim is made without evidence | Misrepresentation; procurement and legal exposure | M | H | LI-EVD-01..06; public-claims register | CEO/CPO + counsel |
| R-09 | Over-refusal makes the tutor useless for legitimate help | Students stop using it; equity harm | M | M | M-AI-2; suite category 9 | Product |
| R-10 | Policy changes mid-term trap students | Unfair outcome | M | H | LI-POL-08..10; LI-INT-07 | Product + governance |
| R-11 | Proctoring adopted by default or without alternatives | Privacy, equity and legal harm | M | H | LI-PRC-01..13 as conditions of enabling | Governance + counsel |
| R-12 | Integrity process slow, opaque or biased | Student harm; legitimacy lost | M | H | LI-INT-14..23; M-INT-3..5; M-EQ-3 | Integrity office |
| R-13 | Faculty-side features exist as sandbox and are mistaken for a live system | Institution relies on an unfinished gradebook | M | H | State plainly in sales and pilots; register's twelve release criteria (LI-GRD-09) | CEO + CPO |
| R-14 | AI-generated items or feedback with accuracy or bias errors reach students | Wrong content graded or taught | M | H | LI-ASM-04, LI-FBK-03 | Faculty + product |
| R-15 | Rubber-stamped AI feedback | Quality fall; deskilling | M | M | LI-FBK-03, -07 | Faculty |
| R-16 | Research or experimentation on students without consent or review | Ethical and legal exposure | L | H | LI-EVD-05, LI-MET-03..04 | Learning scientist + counsel |
| R-17 | Evidence is E1 for the hint ladder but sold as proven | As R-08 | M | M | E1 labelling | Product marketing |
| R-18 | Minors or dual-enrolled students in scope | Different consent and records rules | L | H | Counsel; age-aware controls | Counsel |

## 3. Decisions that require a human body before anything ships

Each is a **review gate**: the feature does not go to a tenant until the
named body has recorded a decision. These are the items the user's brief
called "risks requiring academic governance and human review."

| Gate | Decision | Body | Approval looks like |
| --- | --- | --- | --- |
| G-01 | Any AI tutor mode above Explain is enabled for graded-linked work | Governance council + learning scientist | Adversarial-suite results (M-AI-1, -2) at or above agreed thresholds, recorded |
| G-02 | Any AI feedback or grading assistance is shown to instructors | Governance council + faculty representatives | Review of accuracy and bias on a sampled set; the "never auto-release" rule tested |
| G-03 | Any matching/similarity integration | Governance council + integrity office + counsel | Controlled evaluation per `lib/governance/grading-ai.ts`; student notice text approved |
| G-04 | Any visibility of tutoring sessions to instructors | Governance council + counsel + student representatives | Written justification, student-visible banner, retention, exclusion from findings |
| G-05 | Any proctoring or lockdown integration | Governance council + counsel + accessibility | All of LI-PRC-01..04 complete; alternatives defined |
| G-06 | Accommodation effect list and the instructor read path | Disability services + counsel | Effect list approved; reader-allowlist test green |
| G-07 | Aggregation rules offered for mastery | Faculty representatives | Plain-language forms approved |
| G-08 | Analytics beyond the floor-of-ten aggregates | Governance council + counsel | None proposed |
| G-09 | On-device aggregate upload (07 §6, option 2) | Governance council + privacy counsel | Design review and a consent flow approved |
| G-10 | Any public learning-outcome claim | Learning scientist + counsel | Evidence tier ≥ E3 for that claim |
| G-11 | Integrity referral and decision workflow | Integrity office + governance council | Process mapped to the institution's own policy |
| G-12 | Institution-level retention of integrity and accommodation records | Counsel + institution | Schedule recorded; legal-hold behaviour tested |

## 4. Human review inside the product (not just before shipping)

| Where | Human | What they review | Cannot be skipped because |
| --- | --- | --- | --- |
| Item bank | Reviewer other than the author | Accuracy, bias, accessibility of every AI-drafted item | A wrong item is graded work |
| Instructor feedback draft | The instructor | Edit and explicit release | Feedback is a professional judgement |
| Grade change after release | Second authorised person | The reason and the change | Dual control |
| Integrity referral | Decision-maker who is not the referrer | The evidence, with the student's response | Due process |
| Proctoring flag | Trained reviewer | A segment, with reasons recorded | A flag is not a finding |
| AI incident (harmful/wrong output) | Model owner + trust & safety | Report, response, fix, regression test | Safety |
| Accommodation issuance | Disability services | Eligibility and effect | Only they decide |

## 5. Requirements trace (counts)

Computed by script over this pack's tables (`LI-*` rows in docs 01–07).
**Held** means the requirement's own table row cites code or a test, or a
specification, that exists in the tree; a few Held rows rest on the register
or a spec rather than on re-reading code, and each says so in its row. **LI-PRC**
(13 conditions for enabling a proctoring integration) are not counted:
no integration exists, so none is yet applicable.

| Area | Requirements | Held | Partial | Absent |
| --- | ---: | ---: | ---: | ---: |
| DES — study and design | 6 | 3 | 2 | 1 |
| EVD — evidence | 6 | 0 | 1 | 5 |
| ASM — assignments, assessments | 11 | 5 | 2 | 4 |
| MAS — mastery | 5 | 1 | 2 | 2 |
| FBK — feedback | 7 | 1 | 2 | 4 |
| RUB — rubrics | 6 | 2 | 3 | 1 |
| GRD — gradebook | 9 | 4 | 2 | 3 |
| TUT — tutoring boundaries | 14 | 3 | 7 | 4 |
| SRC — citation and source | 8 | 3 | 2 | 3 |
| INT — integrity (+ match tools, escalation) | 23 | 1 | 3 | 19 |
| ACC — accommodations | 14 | 1 | 4 | 9 |
| POL — policy configuration | 12 | 3 | 2 | 7 |
| WRK — tutor workflows | 4 | 0 | 1 | 3 |
| ADM — administrator | 5 | 1 | 1 | 3 |
| MET — metrics | 7 | 1 | 0 | 6 |
| **Total** | **137** | **29** | **34** | **74** |

Read this as: **the repository is strongest where it prohibits** (no AI-only
grade, no emotion/face analysis, no per-student risk score, floor of ten,
unknown policy = unavailable, quotations verified) **and weakest where it must
enable** (instructor workflows, accommodation application, integrity referral,
policy source, outcome measurement). That is the right order of failure for a
product that must not hurt students, and the wrong place to stop for a product
that must serve institutions.

## 6. Build order

Ordered by dependency and by harm avoided. Each item states what it unblocks.
None is a commitment.

| # | Work | Requirements | Unblocks |
| --- | --- | --- | --- |
| 1 | Server-side policy store and the single resolver at the gateway; assistive class | LI-POL-01..04, -08..10, LI-TUT-13 | Everything that depends on a policy a student can trust |
| 2 | Tutor gate: server-enforced ceiling, output check, adversarial suite with over- and under-refusal | LI-TUT-11, -12, -14 | Any honest statement about what the tutor will do (G-01) |
| 3 | Accommodation effects model and application to delivery | LI-ACC-01..03, -05, -08 | Any consequential timed assessment; proctoring eligibility |
| 4 | Wire the item bank, rubric engine and gradebook to the faculty UI; adopt the twelve release criteria | LI-ASM-*, LI-RUB-*, LI-GRD-* | An instructor can run a course |
| 5 | Outcome and mastery records with explainable aggregation | LI-MAS-01..03 | Mastery-graded courses; M-OUT metrics |
| 6 | Assignment builder with design options and announced process evidence; submittable declaration | LI-ASM-03, LI-INT-01..04 | Integrity by design |
| 7 | Feedback workflow: release control, instructor draft with approval, turnaround | LI-FBK-01..06 | M-SUP metrics |
| 8 | Referral and decision workflow (human-initiated) with due-process properties | LI-INT-14..23 | Institution can run its own process on Semester |
| 9 | Evidence register, claim tiers, instrumentation (events with metadata, no content) | LI-EVD-*, LI-MET-* | Any claim about learning |
| 10 | Match-tool and proctoring *integrations*, only if an institution decides, under the conditions | LI-INT-08..13, LI-PRC-* | Institution-specific need |

Items 1–3 are prerequisites for being able to say, truthfully, that Semester
supports an institution's integrity policy and treats students fairly. Items
8–10 are the only ones that need an institution to exist first.

## 7. Open questions that need a person

| # | Question | Owner |
| --- | --- | --- |
| Q1 | Who is the named learning scientist, and does an academic advisory body exist or must it be created? | CEO |
| Q2 | Which presets (§4 of [06](06-POLICY-CONFIGURATION-AND-WORKFLOWS.md)) does the first institution want, and is *Scaffolded* an acceptable default? | First institution's governance |
| Q3 | Is the first institution willing to run an E3 pilot (stepped-wedge) and submit it for ethics review? | First institution |
| Q4 | Does the first institution require proctoring or a match tool at all? If so, which, and has counsel reviewed it? | First institution + counsel |
| Q5 | Will the first institution accept "no individual tutoring transcript visibility" as the default? | First institution + student reps |
| Q6 | Which accommodation effects, and what read path for instructors, does disability services want? | Disability services |
| Q7 | Is a research-donation or on-device-aggregate path acceptable at all ([07 §6](07-METRICS.md)), and under whose review? | Governance + counsel |

## 8. What was and was not verified

- **Read for this pack:** the audit PDF (86 pages): pages 1–52 (audit,
  architecture, AI governance, integration, security, metrics, roles) and
  67–86 (quality gates, the shared preamble, the role prompts); **pages 53–66
  — the authorisation and tenant schema, deployment pipeline and
  incident/support runbooks — were not read**, as they belong to other roles;
  `docs/learning-university-systems/AI-ACADEMIC-INTEGRITY-SPEC.md`,
  `AI-LEARNING-ASSISTANT-SPEC.md`, `EARLY-ALERT-AND-HUMAN-REVIEW-SPEC.md`;
  `docs/ai-toolkit/RUBRIC-AND-AI-USE-POLICY.md`, `ACTIVE-LEARNING-ENGINE.md`,
  `ACADEMIC-WORK-PROVENANCE.md`; register sections L12–L14 and the release
  criteria; the headers of `lib/socratic.ts`, `cite.ts`, `learning-loop.ts`,
  `learninginsights.ts`, `rubricengine.ts`, `itembank.ts`, `accessmode.ts`,
  `governance/grading-ai.ts`, `toolkit/safety.ts`, `lib/ops/boundaries.test.ts`;
  and the accommodation tables in migration `20260926150000`.
- **Run:** `src/lib/ops/learningintegrity.test.ts` (this pack's own guard),
  including three deliberate breakages that each turned it red.
- **Not run:** any test a Held row cites. A Held row means a test or code
  **exists** and states the property, not that it was run for this document.
- **Not verified:** that UI screens match what library headers say they do
  (several libraries are "wired to no screen"); production behaviour (none
  exists to observe); research citations (the four sources were each checked against a
  full-text copy on 2026-10-04 and two claims corrected — see
  [01 §4](01-LEARNING-DESIGN-AND-EVIDENCE.md); Bastani was read from the
  author-hosted version, not the published text);
  proposed numbers (30-day retention, 3-day acknowledgements, floors other
  than the repository's ten) are starting points for the owning body.
- **Not decided here:** every legal conclusion (FERPA and equivalent, ADA /
  504, biometric and recording laws, minors, cross-border transfer,
  accessibility conformance claims) — for qualified counsel, routed to
  `LEGAL-REVIEW-QUEUE.md`.
