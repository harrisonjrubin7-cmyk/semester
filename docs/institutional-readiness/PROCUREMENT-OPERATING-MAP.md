# Procurement Operating Map

| Control | Value |
| --- | --- |
| Status | **CONTROLLED PLANNING MAP — NO CUSTOMER, QUOTE, REFERENCE OR CONTRACT ASSERTED** |
| Owner | Harrison Rubin — company-side procurement coordinator; backup, counsel, finance, security, privacy and accessibility reviewers unassigned |
| Evidence date | 2026-10-04 at repository revision `7287ddc` |
| Index it extends | [`INSTITUTIONAL-PROCUREMENT-READINESS.md`](INSTITUTIONAL-PROCUREMENT-READINESS.md) |

## What this is, and why it is short

Most of what a university needs in order to evaluate, approve, buy, implement and renew Semester is already written and gated in this repository. Rewriting it would create a second copy that drifts. This pack does four things instead:

1. **Maps** each of the ten procurement deliverables to its canonical source and says what is still open (§0).
2. **Fills the four gaps** found when checking main: a buyer-side journey with exit gates (§1), a full buying-committee map (§2), an institution-side total-cost-of-ownership model (§9) and a deal-side risk register (§10).
3. **Records the contradictions** between answer sources that a buyer's review would find (§10, R1–R3).
4. **States what only a person can supply** (§11).

Nothing here is a price, a date, an uptime, a certification or a legal conclusion. Where a number appears it is labelled as arithmetic.

## 0. Deliverable crosswalk

| # | Deliverable | Canonical source on main | State | What is still open |
| --- | --- | --- | --- | --- |
| 1 | Procurement journey map | Seller-side stages: [`../commercial/SALES-PIPELINE-DEFINITIONS.md`](../commercial/SALES-PIPELINE-DEFINITIONS.md), `app/src/lib/gtm/stages.ts`. Buyer-side: **§1 here** | Gap filled | A real buyer's process must replace the hypothesis in §1 |
| 2 | Buying-committee map | `COMMITTEE_ROLES` in `app/src/lib/gtm/pilot.ts`; [`../commercial/BUYER-PERSONAS.md`](../commercial/BUYER-PERSONAS.md). **§2 here** maps all eleven requested roles | Gap filled | Four roles have no value of their own in code (§2, R2) |
| 3 | Trust-center and diligence-room content | [`../market-readiness/TRUST-CENTER-CONTENT.md`](../market-readiness/TRUST-CENTER-CONTENT.md), [`../market-readiness/VENDOR-DUE-DILIGENCE-PACK.md`](../market-readiness/VENDOR-DUE-DILIGENCE-PACK.md). **§3 here** adds the artifact-by-artifact state and access tier | Mapped | No approved trust-room disclosure or access-logged grant exercise is evidenced |
| 4 | Security, accessibility, privacy, AI, integration, implementation review responses | §4 table | Mapped | Each package is a draft; each has an open reviewer seat |
| 5 | RFP library and differentiation | [`../HIGHER-ED-RFP-RESPONSE-LIBRARY.md`](../HIGHER-ED-RFP-RESPONSE-LIBRARY.md) (tested by `rfp.test.ts`), [`RFP-RESPONSE-MATRIX.md`](RFP-RESPONSE-MATRIX.md), [`../commercial/COMPETITIVE-POSITIONING.md`](../commercial/COMPETITIVE-POSITIONING.md). **§5 here** | Mapped; PF-4 and CT-1 corrected (R1) | Subprocessor register and contract drafts still await counsel |
| 6 | Contract and SOW requirements, counsel items | [`../legal-drafts/`](../legal-drafts/) drafts, [`../COUNSEL-BRIEF.md`](../COUNSEL-BRIEF.md), [`../../LEGAL-REVIEW-QUEUE.md`](../../LEGAL-REVIEW-QUEUE.md). **§6 here** | Mapped | No counsel assigned; nothing is approved or executed |
| 7 | Pilot, proof-of-value, evaluation, acceptance | [`../PAID-PILOT-FRAMEWORK.md`](../PAID-PILOT-FRAMEWORK.md), [`../commercial/PILOT-SCORECARD.md`](../commercial/PILOT-SCORECARD.md), [`PILOT-GOVERNANCE-CHARTER.md`](PILOT-GOVERNANCE-CHARTER.md). **§7 here** | Mapped | No pilot, baseline or customer exists |
| 8 | Migration, interoperability, exit, change management | [`../DATA-MIGRATION-PLAN.md`](../DATA-MIGRATION-PLAN.md), [`../DATA-PORTABILITY-AND-OFFBOARDING.md`](../DATA-PORTABILITY-AND-OFFBOARDING.md), [`../SCHOOL-OFFBOARDING.md`](../SCHOOL-OFFBOARDING.md). **§8 here** gives the buyer-facing arguments | Mapped | Offboarding is built and rehearsed on synthetic data; never used |
| 9 | ROI and total cost of ownership | Savings side only: [`../decisions/D-1042.md`](../decisions/D-1042.md). Vendor formula: [`../operating-model/COMMERCIAL-GOVERNANCE.md`](../operating-model/COMMERCIAL-GOVERNANCE.md). **§9 here** adds the cost side | Gap filled | No Semester institutional price exists |
| 10 | Procurement risk register | Company risks only: [`../company/RISK-REGISTER.md`](../company/RISK-REGISTER.md). **§10 here** | Gap filled | Owners, dates and ratings are judgement until a deal exists |

## 1. Buyer-side journey with exit gates

The seller-side stage names are the controlled vocabulary in `app/src/lib/gtm/stages.ts` (target_account, discovery, qualified, multi_stakeholder_demo, outcome_workshop, technical_review, security_privacy_accessibility_review, proposal, pilot_or_implementation_SOW, procurement_legal, contracted, implementation, live, renewal, expansion, closed_lost). A stage moves only on its exit evidence, never to improve a forecast. This table is the same journey from the buyer's side.

**Durations are the buyer's.** The only durations this repository fixes are a 26-week pilot (D-134), the deal desk's 6-month ceiling, at least 2 weeks of hypercare, and at least 30 days between export verification and archive. Do not quote a procurement cycle length.

**Review tracks run in parallel, not in series.** Security, privacy and accessibility review usually starts when IT is first shown the product, well before a proposal. Start the diligence-room grant at `technical_review`, not at `proposal`.

| Phase | What the buyer is doing | Stages | Put in front of them | Exit gate (evidence, not a feeling) | Never say |
| --- | --- | --- | --- | --- | --- |
| A. First contact | Deciding whether this is worth a meeting | `target_account`, `discovery` | Positioning one-pager; a synthetic demo | An authorized stakeholder agreed to a conversation; source and owner recorded | Customer counts, outcomes, "replaces" |
| B. Qualify | Naming a sponsor, a problem and a budget path | `qualified` | Discovery notes back to the champion | Champion, stated problem, budget cycle and decision process written down | A price |
| C. Map the committee | Finding who can say no | `multi_stakeholder_demo`, `outcome_workshop` | §2 of this pack; demo scripts | Every committee role mapped to a named person or marked unknown (`unmappedRoles()` is empty) | That a role is optional |
| D. Technical and trust review | IT, security, privacy and accessibility each read evidence | `technical_review`, `security_privacy_accessibility_review` | Diligence-room grant (§3); the six review responses (§4) | Each reviewer's questions logged with owner and date; each answer carries an evidence state; exceptions listed | Certified, compliant, conformant, a pen test, an SLA |
| E. Proposal | Turning a scoped pilot into paper they can route | `proposal`, `pilot_or_implementation_SOW` | Pilot proposal and SOW drafts; acceptance criteria (§7); TCO worksheet (§9) | Deal desk has no refusal; scope names no forbidden data class; stop is a possible decision | Savings or ROI not measured |
| F. Procurement and legal | Redlines, DPA, insurance, accessibility, vendor viability | `procurement_legal` | Counsel-approved terms only (§6) | Redlines, approvals and dependencies tracked; counsel signed off each legal position | That a draft is agreed |
| G. Contract | Signature | `contracted` | Executed order form and exhibits | Both signatures and a deal-desk record. This is the commercial decision, not activation | "Live", "deployed" |
| H. Implementation | Configuring, training, rehearsing | `implementation` | Implementation guide; responsibility matrix; go-live checklist | Named owners both sides; sandbox data until production data is approved; accepted handoff | An integration the register does not show as target-validated |
| I. Go-live | First cohort | `live` | Launch-council record | The council returned GO for this named cohort. It does not mean campus-wide launch | Anything about other cohorts |
| J. Renew or exit | Decide, expand or leave | `renewal`, `expansion`, `closed_lost` | Executive outcome review; conversion plan; offboarding plan | A signed final verdict against the pre-agreed baseline; or an exit that returns the school's data | Causal retention or GPA improvement |

## 2. Buying-committee map

`COMMITTEE_ROLES` in `app/src/lib/gtm/pilot.ts` has ten values: `executive_sponsor`, `operational_owner`, `cio`, `ciso_privacy`, `accessibility`, `registrar_data_governance`, `procurement`, `legal`, `finance`, `champion`. The database check that `schema.test.ts` holds to the same list has the same ten.

The eleven roles asked for map onto them as follows. **Four have no value of their own** (provost, student affairs, faculty, student success) and today must be recorded under `executive_sponsor`, `operational_owner` or `champion`. That loses who actually holds the veto. See R2.

"Likely authority" below is a hypothesis from common practice. It is not a fact about any institution. Confirm each in `outcome_workshop` and record the real person and authority; titles and powers differ by campus.

| Requested role | Code value today | Likely authority (hypothesis) | What they will ask | Put in front of them | Honest limit |
| --- | --- | --- | --- | --- | --- |
| CIO / IT | `cio` | Can block on architecture, identity, integration, operability | Where is data held, how do users sign in, what breaks if it is down, how do we leave | Architecture and data-flow docs; [`INTEGRATION-READINESS-MATRIX.md`](INTEGRATION-READINESS-MATRIX.md); [`IDENTITY-AND-PROVISIONING-READINESS.md`](IDENTITY-AND-PROVISIONING-READINESS.md) | No SIS or LMS adapter in production; SAML is not accepted at any institution; OIDC not implemented |
| Provost / academic affairs | none → `executive_sponsor` | Often the sponsor or the person who must agree the academic scope | Does this touch grading, academic integrity, faculty workload | Scope statement; [`../operating-model/AI-GRADING-AND-INTEGRITY.md`](../operating-model/AI-GRADING-AND-INTEGRITY.md) | Not an official record; no outcome proof |
| Registrar | `registrar_data_governance` | Can block on student-record handling | Does it read or write records; what does it show students about their own record | Capability matrix; known-limitations sheet | Does not register, grade or submit; no rosters requested (INT-4) |
| Student affairs | none → `operational_owner` | May own campus services and student conduct boundaries | Does it profile or surveil; what happens in a crisis message | Student-agency and refusal-to-score statements; [`../CRISIS-RESPONSE-RUNBOOK.md`](../CRISIS-RESPONSE-RUNBOOK.md) | Wellbeing needs route to a crisis line and are not stored as requests (FR-4); a pilot-flagged feature |
| Student success / advising | none → `operational_owner` or `champion` | Usually the day-to-day owner and the person who must use it | Will advisors be better prepared; is this extra work; is it a risk score | First-win demo; advisor meeting mode | Not authoritative advising; no early-alert or risk scoring |
| Finance | `finance` | Approves spend and terms | Total cost, not license; what is recurring; what happens at renewal and exit | §9 worksheet; order form draft | No published institutional price; quote only |
| Accessibility | `accessibility` | Can block on legal-exposure grounds | Is there a conformance report; was it tested with assistive technology | [`INSTITUTIONAL-ACCESSIBILITY-PACKAGE.md`](INSTITUTIONAL-ACCESSIBILITY-PACKAGE.md); [`../compliance/VPAT-ACR-SELF-ASSESSMENT.md`](../compliance/VPAT-ACR-SELF-ASSESSMENT.md) | Self-assessment only; **no ACR**; no recorded manual screen-reader pass (AX-2, AX-3) |
| Procurement | `procurement` | Controls the process, thresholds and required forms | Does this need a bid; are you on a contract vehicle; where are the forms | Cover-letter draft; RFP matrix | Thresholds and vehicles are the institution's and unknown here; no cooperative-contract status asserted |
| Legal / counsel | `legal` | Controls paper and risk positions | DPA, FERPA school-official terms, liability, insurance, AI terms | §6; [`../COUNSEL-BRIEF.md`](../COUNSEL-BRIEF.md) | No executed DPA; Semester gives no legal conclusion on FERPA |
| Security / privacy | `ciso_privacy` | Can block on risk | HECVAT or equivalent; pen test; SOC 2; incident notice; subprocessors | [`HECVAT-QUESTION-BANK-RESPONSE-DRAFT.md`](HECVAT-QUESTION-BANK-RESPONSE-DRAFT.md); [`../SUBPROCESSORS.md`](../SUBPROCESSORS.md) | No pen test, no SOC 2 or ISO, no completed HECVAT workbook |
| Faculty | none → `champion` | Rarely approves; can sink adoption | Does this change my course, my gradebook, my students' conduct | Training sketch; scope exclusions | First pilot deliberately excludes faculty workflow replacement |

Also map the **student representative**. Student government is a de facto stakeholder when a product touches student data, and [`../commercial/BUYER-PERSONAS.md`](../commercial/BUYER-PERSONAS.md) already lists it.

## 3. Trust-center and diligence-room content

The fourteen artifacts below are the audit's list. Tier is a proposal: **P** public, **N** under NDA, **R** restricted and expiring, access-logged.

| Artifact | Canonical file | State | Tier | Gap |
| --- | --- | --- | --- | --- |
| Architecture overview | [`../ARCHITECTURE.md`](../ARCHITECTURE.md) | Engineering document | N | Review for buyer suitability before sharing; no buyer-facing version exists |
| Security overview | [`../market-readiness/SECURITY-OVERVIEW.md`](../market-readiness/SECURITY-OVERVIEW.md) | Draft | P or N | Counsel review of wording |
| Privacy overview | [`../market-readiness/PRIVACY-OVERVIEW.md`](../market-readiness/PRIVACY-OVERVIEW.md) | Draft | P | Notice not counsel-approved |
| Accessibility VPAT or equivalent | [`../compliance/VPAT-ACR-SELF-ASSESSMENT.md`](../compliance/VPAT-ACR-SELF-ASSESSMENT.md) | Self-assessment; **no ACR** | P | A formal evaluation by a qualified evaluator |
| Data processing terms | [`../legal-drafts/DATA-PROCESSING-ADDENDUM-DRAFT.md`](../legal-drafts/DATA-PROCESSING-ADDENDUM-DRAFT.md) | Draft | N | Counsel; **never** present as available terms |
| BC/DR summary | [`../market-readiness/BUSINESS-CONTINUITY-AND-DISASTER-RECOVERY.md`](../market-readiness/BUSINESS-CONTINUITY-AND-DISASTER-RECOVERY.md) | Plan | N | Timed production restore not run; no RTO/RPO stated (SEC-6) |
| Penetration test summary | [`../trust/PENETRATION-TEST-PLAN.md`](../trust/PENETRATION-TEST-PLAN.md) | **Plan only; no test performed** | — | Do not list a summary that does not exist |
| Subprocessor list | [`../SUBPROCESSORS.md`](../SUBPROCESSORS.md) | Register, held to the CSP and Edge Functions by test | P | Counsel review; each provider's terms |
| Integration catalog | [`INTEGRATION-READINESS-MATRIX.md`](INTEGRATION-READINESS-MATRIX.md) | Register; no connection target-validated | P | Keep "Designed" distinct from "Activated" |
| Implementation methodology | [`INSTITUTIONAL-IMPLEMENTATION-GUIDE.md`](INSTITUTIONAL-IMPLEMENTATION-GUIDE.md) | Draft | P | No named owners yet |
| Support SLA | [`../legal-drafts/SERVICE-LEVEL-EXPECTATIONS-DRAFT.md`](../legal-drafts/SERVICE-LEVEL-EXPECTATIONS-DRAFT.md), [`../trust/SLA.md`](../trust/SLA.md) | Framework; no staffed desk; no uptime commitment (SS-2) | N | Do not publish response times |
| Roadmap governance | [`INSTITUTIONAL-ROADMAP-COMMUNICATION-STANDARD.md`](INSTITUTIONAL-ROADMAP-COMMUNICATION-STANDARD.md) | Standard | P | None for a standard; no dates |
| AI governance packet | [`../trust/AI-GOVERNANCE-PROGRAM.md`](../trust/AI-GOVERNANCE-PROGRAM.md), [`../market-readiness/AI_GOVERNANCE.md`](../market-readiness/AI_GOVERNANCE.md) | **Draft, not in force**; no evaluation results (AI-2) | N | Evaluation run and provider terms |
| Security questionnaire library | [`HECVAT-QUESTION-BANK-RESPONSE-DRAFT.md`](HECVAT-QUESTION-BANK-RESPONSE-DRAFT.md), [`../launch-readiness/SECURITY_QUESTIONNAIRE_RESPONSE_PACK.md`](../launch-readiness/SECURITY_QUESTIONNAIRE_RESPONSE_PACK.md) | Draft banks | R | Reverify every fact on the submission date |

A room that lists a document which does not exist (a pen test summary, an ACR, executed terms) fails diligence faster than a room that says so. Show the plan and mark the report absent.

## 4. The six review responses

| Review | Reviewer | Canonical response source | Strongest sentence true today | Gate before anything stronger |
| --- | --- | --- | --- | --- |
| Security | `ciso_privacy` | [`INSTITUTIONAL-SECURITY-PACKAGE.md`](INSTITUTIONAL-SECURITY-PACKAGE.md), [`../trust/SECURITY-QUESTIONNAIRE.md`](../trust/SECURITY-QUESTIONNAIRE.md) | Documented controls and CI checks exist; none is independently audited | A scoped external test or report |
| Accessibility | `accessibility` | [`INSTITUTIONAL-ACCESSIBILITY-PACKAGE.md`](INSTITUTIONAL-ACCESSIBILITY-PACKAGE.md) | Automated audits run in CI at desktop and 320px width; a self-assessment is published | A qualified manual evaluation and an ACR |
| Privacy | `ciso_privacy`, `legal` | [`INSTITUTIONAL-PRIVACY-PACKAGE.md`](INSTITUTIONAL-PRIVACY-PACKAGE.md) | Every table has a retention answer enforced by test; students can export and delete; Semester does not sell data, advertise to students or score them for risk | Counsel-approved notice and DPA |
| AI | `ciso_privacy`, provost | [`../trust/AI-GOVERNANCE-PROGRAM.md`](../trust/AI-GOVERNANCE-PROGRAM.md), [`../trust/AI-SYSTEM-INVENTORY.md`](../trust/AI-SYSTEM-INVENTORY.md) | Institutional AI runs only through a provider the institution approves and is off until turned on | An evaluation run and exact provider terms for the configuration |
| Integration | `cio` | [`INTEGRATION-READINESS-MATRIX.md`](INTEGRATION-READINESS-MATRIX.md) | LTI 1.3 launch, Deep Linking and AGS paths are repository-tested (AGS off for the initial wedge); SAML is implemented in the repository; SCIM is repository-tested and off by default; nothing is activated | Per-connection activation record and target validation |
| Implementation | `operational_owner` | [`INSTITUTIONAL-IMPLEMENTATION-GUIDE.md`](INSTITUTIONAL-IMPLEMENTATION-GUIDE.md), [`IMPLEMENTATION-RESPONSIBILITY-MATRIX.md`](IMPLEMENTATION-RESPONSIBILITY-MATRIX.md), [`GO-LIVE-CHECKLIST.md`](GO-LIVE-CHECKLIST.md) | A 26-week chartered pilot with a baseline, a launch gate and a signed decision | Named owners, a staffed support route, UAT |

**Every response uses the six states already in [`RFP-RESPONSE-MATRIX.md`](RFP-RESPONSE-MATRIX.md):** `VERIFIED — REPOSITORY`, `VERIFIED — EXTERNAL`, `CONDITIONAL`, `PLANNED / NOT AVAILABLE`, `NOT SUPPORTED`, `OWNER TO SUPPLY`. Repository evidence is never target evidence. Answer the exact question asked; a `Yes` to a nearby control is a contradiction waiting to be found.

## 5. RFP library and differentiation

The library and matrix are the answer bank. Use the library's status and the matrix's state together. PF-4 and CT-1 were corrected to match the subprocessor register and the contract drafts (R1); both still depend on counsel.

**Differentiation, in procurement terms.** Each line is a claim a reviewer can test, with the evidence and its limit. Compare workflows and boundaries; do not name competitors or claim superiority ([`../commercial/COMPETITIVE-POSITIONING.md`](../commercial/COMPETITIVE-POSITIONING.md)).

| We say | Evidence | The limit we state with it |
| --- | --- | --- |
| It is additive, not a rip-and-replace | No registration, grade or form is written to a university system (FR-1); manual and read-only first | We replace nothing today |
| The student keeps their work | Export in CSV, Markdown, calendar and restorable JSON; account export and deletion proven by database checks (PF-3) | Backup, legal-hold and tenant-wide limits apply |
| We do not profile students | No sale of data, no advertising, no risk scoring, written down and tested (PF-5) | A statement of the product, not a legal conclusion |
| Our answers are evidence-gated | A test refuses an answer that cites a missing file or uses certification language | This lowers the number of "Yes" answers; that is the point |
| Leaving is designed before entering | An eight-step two-party offboarding exists and was rehearsed on a hosted preview database with synthetic data | Built, not used; no school has been offboarded |

## 6. Contract and SOW requirements; counsel items

**Every row is a position for qualified counsel to decide. Nothing here is a legal conclusion.** Drafts exist for each document; none is approved, none is executed.

| Term | Buyer will ask | Draft | Constraint from the evidence | For counsel |
| --- | --- | --- | --- | --- |
| Master agreement, order form, SOW | Standard paper or ours | [`MASTER-SUBSCRIPTION-AGREEMENT-DRAFT`](../legal-drafts/MASTER-SUBSCRIPTION-AGREEMENT-DRAFT.md), [`ORDER-FORM-TEMPLATE-DRAFT`](../legal-drafts/ORDER-FORM-TEMPLATE-DRAFT.md), [`STATEMENT-OF-WORK-TEMPLATE-DRAFT`](../legal-drafts/STATEMENT-OF-WORK-TEMPLATE-DRAFT.md) | Entity, signing authority and price are unassigned | Whole set |
| Data processing, FERPA school-official terms | Will you sign ours | [`DATA-PROCESSING-ADDENDUM-DRAFT`](../legal-drafts/DATA-PROCESSING-ADDENDUM-DRAFT.md), [`../market-readiness/DPA-ISSUE-LIST.md`](../market-readiness/DPA-ISSUE-LIST.md) | PF-1: none signed; we describe controls and do not claim compliance | Roles, terms, jurisdictions |
| Security and incident notice | Notice window; audit rights | [`INFORMATION-SECURITY-ADDENDUM-DRAFT`](../legal-drafts/INFORMATION-SECURITY-ADDENDUM-DRAFT.md), [`SECURITY-INCIDENT-NOTIFICATION-EXHIBIT-DRAFT`](../legal-drafts/SECURITY-INCIDENT-NOTIFICATION-EXHIBIT-DRAFT.md) | Live alerting and on-call are incomplete | Any numeric window |
| Service levels and support | Uptime credits; response times | [`SERVICE-LEVEL-EXPECTATIONS-DRAFT`](../legal-drafts/SERVICE-LEVEL-EXPECTATIONS-DRAFT.md) | SS-2: no uptime commitment; SS-1: no staffed desk | Whether to commit at all |
| Accessibility | Conformance warranty; remediation | [`ACCESSIBILITY-ROADMAP-EXHIBIT-DRAFT`](../legal-drafts/ACCESSIBILITY-ROADMAP-EXHIBIT-DRAFT.md) | No ACR; no manual screen-reader pass | Any warranty or roadmap dates |
| AI terms | Training on our data; opt-out; provider | [`AI-USE-TERMS-EXHIBIT-DRAFT`](../legal-drafts/AI-USE-TERMS-EXHIBIT-DRAFT.md) | Provider terms for the exact configuration not collected | Provider flow-down |
| Data return and deletion at term end | Format, timing, certificate | [`DATA-RETENTION-EXPORT-AND-DELETION-EXHIBIT-DRAFT`](../legal-drafts/DATA-RETENTION-EXPORT-AND-DELETION-EXHIBIT-DRAFT.md), [`../SCHOOL-OFFBOARDING.md`](../SCHOOL-OFFBOARDING.md) | Purge is authorized by a third person after at least 30 days, never under a legal hold | Backup deletion; timings |
| Subprocessors | Notice of change; approval | [`SUBPROCESSOR-LIST-TEMPLATE-DRAFT`](../legal-drafts/SUBPROCESSOR-LIST-TEMPLATE-DRAFT.md) | Register held to the CSP by test | Change-notice mechanism |
| Insurance, liability, indemnity | Limits and certificates | [`../company/INSURANCE-READINESS-CHECKLIST.md`](../company/INSURANCE-READINESS-CHECKLIST.md) | CP-1: company facts are not in this repository | All of it |
| Renewal, cancellation, refunds | Auto-renewal; notice | [`REFUND-CANCELLATION-AND-RENEWAL-POLICY-DRAFT`](../legal-drafts/REFUND-CANCELLATION-AND-RENEWAL-POLICY-DRAFT.md) | Pilot is 26 weeks; no automatic conversion | Auto-renewal law varies by jurisdiction |
| References, case studies | Name customers | [`TESTIMONIAL-AND-CASE-STUDY-CONSENT-DRAFT`](../legal-drafts/TESTIMONIAL-AND-CASE-STUDY-CONSENT-DRAFT.md) | RF-1: no institutional customer exists; never name one | Consent form |
| Deviations | Redlines | [`CONTRACT-DEVIATION-APPROVAL-MATRIX`](../legal-drafts/CONTRACT-DEVIATION-APPROVAL-MATRIX.md), [`CONTRACT-NEGOTIATION-PLAYBOOK`](../legal-drafts/CONTRACT-NEGOTIATION-PLAYBOOK.md) | Deal desk, `app/src/lib/governance/deal-desk.ts` | Who may approve what |

Also for counsel, not answerable here: whether a purchase needs a competitive bid under the institution's rules, and whether public-institution accessibility or open-records rules apply to a response. Those depend on the institution and jurisdiction.

## 7. Pilot, proof-of-value and acceptance

Templates exist: [`../commercial/PILOT-PROPOSAL-TEMPLATE.md`](../commercial/PILOT-PROPOSAL-TEMPLATE.md), [`PILOT-GOVERNANCE-CHARTER.md`](PILOT-GOVERNANCE-CHARTER.md), [`../commercial/PILOT-SCORECARD.md`](../commercial/PILOT-SCORECARD.md), [`PILOT-WEEKLY-BUSINESS-REVIEW.md`](PILOT-WEEKLY-BUSINESS-REVIEW.md), [`PILOT-EXECUTIVE-OUTCOME-REVIEW.md`](PILOT-EXECUTIVE-OUTCOME-REVIEW.md), [`PILOT-CLOSEOUT-AND-CONVERSION-PLAN.md`](PILOT-CLOSEOUT-AND-CONVERSION-PLAN.md), [`../legal-drafts/EVALUATION-AGREEMENT-DRAFT.md`](../legal-drafts/EVALUATION-AGREEMENT-DRAFT.md). The framework's own rules apply: no forbidden data class (grades, rosters, enrollments, financial aid, health, disability, counseling, conduct and the others it lists); no metric about an individual student; a cohort of at least 10 and at most 200; "stop" is a written option.

The one thing not written down is a **single acceptance-criteria record** that binds a criterion to its evidence class before launch. Use one row per criterion, agreed and dated by both sides **before** the baseline is taken.

| Field | Rule |
| --- | --- |
| Criterion | One observable thing, stated for a cohort, not a person |
| Measure and denominator | Defined before launch; invitations and raw logins are not adoption |
| Baseline and date | Measured, not estimated |
| Threshold | Set by the buyer; Semester does not propose one that flatters it |
| Evidence class | `VERIFIED — REPOSITORY`, `VERIFIED — EXTERNAL`, or buyer-witnessed in their environment |
| Owner, both sides | Named people |
| If missed | Fix, extend once, narrow scope, or stop. Chosen in advance |
| Reported as | Leading indicator only unless the charter set a causal method |

## 8. Migration, interoperability, exit and change management: the arguments

| Argument | Evidence | What we do not say |
| --- | --- | --- |
| **Start beside, not instead.** The first pilot runs manual and read-only; the incumbent stays authoritative | [`../ADDITIVE-UNIVERSITY-OS-MIGRATION-PLAN.md`](../ADDITIVE-UNIVERSITY-OS-MIGRATION-PLAN.md); FR-1 | That any system can be retired. Replacement status needs a parallel run, verification, acceptance and counsel review |
| **We use the standards you already run.** SAML, LTI 1.3 (launch, Deep Linking, AGS), SCIM 2.0 | Integration matrix | SCIM is not reachable in production; OIDC and OneRoster are not implemented; NRPS is deliberately not requested; no SIS or LMS is connected |
| **A failed connector degrades, not strands.** Native workflows keep working; connectors are optional | Manual and synthetic setup path in the integration matrix; local-first design (PS-2) | A measured failure behaviour; no connector is live to measure |
| **Your people can leave with their work.** Self-serve export and deletion | [`../DATA-PORTABILITY-AND-OFFBOARDING.md`](../DATA-PORTABILITY-AND-OFFBOARDING.md) | A single full-account archive: the doc lists it as the remaining gap |
| **Your school can leave with its data.** Two-party offboarding, student notice first, verified export, 30-day minimum before archive, purge blocked by legal hold | [`../SCHOOL-OFFBOARDING.md`](../SCHOOL-OFFBOARDING.md); [`../evidence/offboarding/2026-09-30-hosted-preview-rehearsal.md`](../evidence/offboarding/2026-09-30-hosted-preview-rehearsal.md) | That it has been used. It was rehearsed on synthetic data in a rolled-back transaction |
| **Change is staged and reversible.** Pilot lifecycle with a launch council; rollback runbook | [`../PAID-PILOT-FRAMEWORK.md`](../PAID-PILOT-FRAMEWORK.md); [`../operating-model/CHANGE-MANAGEMENT.md`](../operating-model/CHANGE-MANAGEMENT.md) | A change-management result at any school |
| **Customer data migration is the buyer's hardest cost, and we say so.** | [`../market-readiness/MIGRATION_PLAYBOOK.md`](../market-readiness/MIGRATION_PLAYBOOK.md) is `NOT_STARTED` for customer data | That we migrate from any named system |

## 9. Total cost of ownership and ROI (institution side)

**What exists.** D-1042's stack-consolidation calculator counts the *savings* of retiring a system, only when its contract has ended and a replacement is available. Semester has no published institutional price, so the school types its own number. [`COMMERCIAL-GOVERNANCE.md`](../operating-model/COMMERCIAL-GOVERNANCE.md) holds the vendor's `ROI = (measured benefit − Semester cost) / Semester cost`. **Neither counts what the buyer spends to adopt.** A finance office will, so give them the worksheet first.

This is a worksheet, not code. The calculator at `/tools/stack/` covers the savings rows only. Every Semester-side price is a quote from the deal desk, never a default.

### Cost lines (five-year horizon, matching D-1042)

| Line | Whose cost | Source of the number |
| --- | --- | --- |
| License or subscription | Buyer pays Semester | Quote only |
| Implementation services | Buyer pays Semester | Quote only |
| Buyer IT: identity, SSO, integration, sandbox | Buyer's labor | Buyer's loaded rate × hours |
| Buyer review: security, privacy, accessibility, legal, procurement | Buyer's labor | Buyer's loaded rate × hours; count it, since it is real |
| Training and communications | Buyer's labor + any fee | Buyer |
| Data validation and migration | Buyer's labor | Buyer |
| Parallel run: incumbent plus Semester | Buyer pays both | Incumbent contract + quote |
| Ongoing administration and support uplift | Buyer's labor | Buyer |
| Metered components (for example AI usage), if the quote has any | Buyer pays Semester | Quote and a usage cap |
| Renewal escalator | Buyer pays Semester | Quote; ask for the cap in writing |
| Exit: export, validation, deletion confirmation | Buyer's labor | [`../SCHOOL-OFFBOARDING.md`](../SCHOOL-OFFBOARDING.md) steps |
| Risk reserve | Buyer | Buyer's own policy |

### Benefit lines: three classes, never summed blindly

| Class | Counts toward | Rule |
| --- | --- | --- |
| **Cash** | Net cost | A contract has ended and the replacement is available (D-1042). Otherwise zero |
| **Capacity** | Reported separately | Hours × loaded rate, counted as cash **only if** the budget line is removed or the time is demonstrably redeployed |
| **Outcome** (persistence, completion) | Excluded from the base case | Shown only as a break-even: how many additional persisting students, at the school's own net revenue per student, would cover the net cost. A school-led analysis owns attribution |

```text
TCO_5        = Σ over years 1..5 of (all cost lines)
Net_cash     = CashBenefit_5 − TCO_5
ROI_measured = (MeasuredBenefit − SemesterCost) / SemesterCost      # from COMMERCIAL-GOVERNANCE; measured only
N_breakeven  = max(0, −Net_cash) / NetRevenuePerRetainedStudent     # a threshold, not a forecast
```

### Arithmetic check (placeholder units; **not a price, benchmark or forecast**)

Inputs, in arbitrary units: license 100 per year; implementation 50 in year 1; buyer one-time labor 80 in year 1; ongoing administration 20 per year; parallel run 30 in year 1; exit reserve 10 in year 5; cash savings 120 per year in years 2–5 only (an incumbent contract ended after year 1).

| Year | Cost | Cash benefit | Cumulative net |
| --- | --- | --- | --- |
| 1 | 100 + 50 + 80 + 20 + 30 = 280 | 0 | −280 |
| 2 | 100 + 20 = 120 | 120 | −280 |
| 3 | 120 | 120 | −280 |
| 4 | 120 | 120 | −280 |
| 5 | 100 + 20 + 10 = 130 | 120 | −290 |

`TCO_5 = 770`, `CashBenefit_5 = 480`, `Net_cash = −290`. With a placeholder net revenue of 10 per retained student, `N_breakeven = 290 / 10 = 29`.

The example is negative on cash alone **on purpose**. A model that cannot show a loss is a sales tool, and a finance office will recognize one. The honest sales position is that the case rests on measured capacity and on outcomes the school itself will test, and on nothing else.

**Never** publish `ROI`, savings, payback or "affordable" for Semester without a quote, a measured baseline and approval ([`../commercial/PRICING-AND-PACKAGING.md`](../commercial/PRICING-AND-PACKAGING.md), [`PILOT-EXECUTIVE-OUTCOME-REVIEW.md`](PILOT-EXECUTIVE-OUTCOME-REVIEW.md)).

## 10. Procurement risk register

Likelihood (L) and impact (I) are judgement (H/M/L) until a deal exists; they are not measurements. R1–R3 were **verified against main on 2026-10-04**. The rest are expected failure modes, each tied to the repository fact that creates it.

| ID | Risk | Phase | L / I | Early signal | Mitigation | Source |
| --- | --- | --- | --- | --- | --- | --- |
| R1 | **Answer sources contradicted each other** (resolved in the change after #1150). The RFP library said PF-4 "a published list is planned" (no evidence cited) and CT-1 "not yet drafted", while [`SUBPROCESSORS.md`](../SUBPROCESSORS.md) existed and is test-held, HECVAT PRIV-5 was `IN_PROGRESS`, and a master agreement, DPA, SOW, order form and pilot agreement draft existed (unapproved). The launch kit also quoted CT-1 and said no MSA existed | D, F | L / M now | Recurrence: the same drift can reopen whenever a draft or register changes without the library | PF-4 and CT-1 now say what exists and that counsel has not reviewed it; status unchanged (PRIV-5 is not `READY`, so PF-4 cannot say "Available now"). Change the library, its rendered table and the launch-kit citation together | `app/src/lib/gtm/rfp.ts`; HECVAT register |
| R2 | **Committee blind spot.** `COMMITTEE_ROLES` and its database check have ten values; provost, student affairs, faculty and student success cannot be recorded as themselves, so a veto holder can sit unmapped and `unmappedRoles()` still reports empty | C | M / H | A late "we need the Dean's approval" | Until the enum is widened (a migration and a test change, owner's call), record the true role in the decision-log `question` text and `stakeholderId`. Do not rely on `unmappedRoles()` alone | `pilot.ts`; `schema.test.ts` |
| R3 | **"Replacement" framing** triggers incumbent-vendor defence, scope expansion and a longer review | A–F | M / H | The word appears in the buyer's own email thread | Lead with additive and student-owned; never use replacement language until a parallel run, verification, acceptance and counsel sign-off exist | Audit launch strategy; FR-1 |
| R4 | **Claim drift across channels** (HECVAT, RFP, trust center, website, demo) | D–G | H / H | Two documents give a different state for one control | One owner reconciles before each submission; use the narrower state; queue the stale source | [`RFP-RESPONSE-MATRIX.md`](RFP-RESPONSE-MATRIX.md) |
| R5 | **No independent assurance**: no penetration test, SOC 2 or ISO, no completed HECVAT workbook | D | H / H | The questionnaire marks it mandatory | Disclose directly (SEC-4, SEC-5); offer the plan and the evidence register; commission a scoped test only with owner and budget; never substitute a provider's report | HECVAT register |
| R6 | **No executed DPA or FERPA school-official terms**; no counsel assigned | F | H / H | Legal asks for ours first | Assign counsel; hold the drafts as drafts; no legal conclusion from Semester | §6; PF-1 |
| R7 | **No staffed support, SLA, uptime commitment, RTO or RPO** | D, F | H / M | An RFP makes a numeric SLA mandatory | State SS-1, SS-2, SEC-6 plainly; scope the pilot's support route by name; do not invent targets | RFP library |
| R8 | **No live SIS/LMS connection; no accepted SSO** | D, H | H / M | IT asks for a reference integration | Offer the manual/read-only path; target-validate one connection with a real owner before describing it as available | Integration matrix |
| R9 | **No accessibility conformance report** at a buyer with accessibility exposure | D, F | H / H | Accessibility office or counsel asks for an ACR first | Offer the self-assessment and automated evidence, state the open manual-review gate, commission a qualified evaluation; counsel decides any obligation | AX-2, AX-3 |
| R10 | **AI blocked by the buyer's AI policy**; no evaluation results exist | D | M / H | A policy requires model evaluation or opt-out proof | Lead with AI off by default and non-AI paths; deliver an evaluation run before asking for AI approval | AI-2 `NOT_STARTED` |
| R11 | **Vendor-viability screen**: entity, financials and insurance are not in the repository | F | H / H | A vendor-risk form asks for financial statements | Owner supplies from authorized records; never infer from code | CP-1; insurance checklist |
| R12 | **No institutional reference** | D, F | H / M | Reference check is a stage | Offer a design-partner conversation with written consent only; never name a prospect | RF-1 |
| R13 | **Price asked before a quote exists**; fiscal-year and bid thresholds are the buyer's | E, F | M / M | "Send pricing" in the first call | Route to the deal desk; ask for the budget cycle and process in `qualified` | PR-1; deal-desk |
| R14 | **Pilot read as a free trial or as a commitment to buy** | E, J | M / M | Sponsor assumes automatic conversion | Charter states the decision options including stop; conversion is a separate signed decision | [`../PILOT-TO-ANNUAL-CONVERSION.md`](../PILOT-TO-ANNUAL-CONVERSION.md) |
| R15 | **Scope creep into forbidden data** (grades, rosters, accommodations) under pressure to show value | E, H | M / H | A request to "just pull the roster" | Refuse in writing; the readiness check names the classes; INT-4 | [`../PAID-PILOT-FRAMEWORK.md`](../PAID-PILOT-FRAMEWORK.md) |
| R16 | **Single-person dependency**: one owner on nearly every row; backups unassigned | All | H / H | A review slips because the owner is unavailable | Appoint backups before the first questionnaire; the ownership matrix is [`../../OWNER-AND-ACCOUNTABILITY-MATRIX.md`](../../OWNER-AND-ACCOUNTABILITY-MATRIX.md) | Control tables across this folder |
| R17 | **Perceived surveillance** by students or student government | C, H | M / H | A student-body objection or a press question | Publish the refusal to score; plain-language controls; student representative in the committee | PF-5 |
| R18 | **Exit disputed**: completeness of the export, legal hold, timing | J | L / H | Disagreement on what "all data" means | Agree the dependency inventory at kickoff, not at exit; offboarding refuses an export that omits a table | [`../SCHOOL-OFFBOARDING.md`](../SCHOOL-OFFBOARDING.md) |
| R19 | **Renewal without evidence**: outcomes unmeasured, so the case rests on opinion | J | M / H | Renewal meeting has no baseline | Acceptance record (§7) before launch; a signed final verdict is the renewal gate | `stages.ts` `renewal` |

## 11. What only a person can supply

In order of what blocks the most rows above:

1. **Counsel**, named: entity, signing authority, DPA, FERPA position, insurance, liability, auto-renewal (R6, R11).
2. **Backup owners** for procurement, security, privacy and accessibility (R16).
3. **Counsel review of the subprocessor register and the contract drafts**, which is what PF-4 and CT-1 now wait on (R1).
4. **Decide whether to widen `COMMITTEE_ROLES`** (a database check change) or adopt the interim recording rule (R2).
5. **A scoped penetration test** and **a qualified accessibility evaluation**, if the budget exists (R5, R9).
6. **A timed production restore**, to state or decline RTO and RPO (R7).
7. **One design-partner institution** and its real procurement process, to replace the hypotheses in §1 and §2.
8. **A deal-desk quote**, so §9 can carry a real Semester number.

## Evidence state

**Repository evidence.** Every row above cites a file or a code path that exists at the revision above. The 232-row finalization crosswalk was not edited.

**Operational evidence.** None. No customer, questionnaire, quote, reference, counsel, contract or reviewer is evidenced; every phase, authority and risk rating is a hypothesis.

**Missing proof.** Run one real, scoped questionnaire through §3 and §4; interview a named committee; replace the placeholder arithmetic in §9 with the school's inputs and a quote.

## Claim ceiling

Semester may say it maintains an evidence-gated procurement process, a diligence index that marks absent reports as absent, and a worksheet that counts the buyer's adoption costs as well as the savings.

## Prohibited claims

Do not describe this pack as procurement approval, a security, accessibility, FERPA or other compliance position, a price, an uptime or recovery commitment, an integration, a customer or reference, a savings or ROI figure, or evidence that any system can be replaced.
