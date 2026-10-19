# Pilot Agreement - Business Outline for Counsel

> **BUSINESS OUTLINE FOR COUNSEL. NOT LEGAL ADVICE. NOT BINDING. NOT AGREEMENT LANGUAGE. Nothing here may be signed, quoted to a customer or relied on as a term. Paid acceptance is HELD under [`GO-NO-GO-DECISION.md`](../../../GO-NO-GO-DECISION.md).**

| Control | Value |
| --- | --- |
| Status | **[DRAFT] BUSINESS POSITIONS FOR COUNSEL REVIEW - NOT APPROVED. Every section carries [REVIEW: counsel]** |
| Owner | Harrison Rubin (interim; backup unassigned). Counsel: unassigned. Customer counsel: unknown |
| Evidence date | 2026-10-05 at repository revision `5eba494` |
| Labels used | [VERIFIED] [ASSUMPTION] [DRAFT] [INTERNAL] [REVIEW: counsel] [REVIEW: tax] [REVIEW: insurance] [REVIEW: privacy] [REVIEW: security] [REVIEW: accessibility] |
| Audience | [INTERNAL] and counsel. Never sent to a prospect |

Label legend: **[VERIFIED]** repository path proves the stated *status of a document*; **[ASSUMPTION]** planning position; **[DRAFT]** needs review; **[APPROVED]** none; **[INTERNAL]** not sent.

## Relationship to existing artifacts

| Existing artifact | What it already covers | What this document adds | Why a new document |
| --- | --- | --- | --- |
| [`../../legal-drafts/PILOT-AGREEMENT-DRAFT.md`](../../legal-drafts/PILOT-AGREEMENT-DRAFT.md) | Counsel draft v0.1: pilot schedule, governance, success/guardrails, launch/change/pause/closeout, clause blockers | A section-by-section **business position** and the **status of each corresponding draft and trust document**, plus open issues. **That draft is linked, not copied and not duplicated here.** | The draft is compact and clause-light; counsel needs a map from each business point to the exhibit that carries it and what is unresolved |
| [`../../trust/PILOT-AGREEMENT-OUTLINE.md`](../../trust/PILOT-AGREEMENT-OUTLINE.md) | 26-section list for a 26-week pilot and a sample scope | Reconciles it with the gate and the current rules (see "Conflicts" below) | It predates the gate decision and the 10-200 bound |
| [`../../legal-drafts/CONTRACT-NEGOTIATION-PLAYBOOK.md`](../../legal-drafts/CONTRACT-NEGOTIATION-PLAYBOOK.md), [`CONTRACT-DEVIATION-APPROVAL-MATRIX.md`](../../legal-drafts/CONTRACT-DEVIATION-APPROVAL-MATRIX.md), [`COUNSEL-ISSUE-CHECKLISTS.md`](../../legal-drafts/COUNSEL-ISSUE-CHECKLISTS.md) | How to negotiate and approve deviations; counsel fact checklists | Used as the home for deviations and open issues; not rewritten | n/a |
| [`../../PAID-PILOT-FRAMEWORK.md`](../../PAID-PILOT-FRAMEWORK.md), [`../../../app/src/lib/gtm/pilot.ts`](../../../app/src/lib/gtm/pilot.ts) | Lifecycle; `pilotReadiness`, `pilotVerdict`, `PILOT_WEEKS = 26`, decisions `convert/expand/pause/stop` | Business positions consistent with them | Code is authoritative |
| [`../sales/PILOT_PROPOSAL_TEMPLATE.md`](../sales/PILOT_PROPOSAL_TEMPLATE.md) | Customer-facing proposal | This outline is the paper that would follow it | n/a |

## Gate

Per [`GO-NO-GO-DECISION.md`](../../../GO-NO-GO-DECISION.md): **paid institutional pilot = NO-GO/RED.** Counsel work, drafting, redlining preparation and discussion with a prospect's counsel on *non-binding* terms are allowed now; **signing, accepting payment, issuing an order form or activating live data are held.** The design-partner pilot (non-activation) may be papered only as an evaluation/NDA-level arrangement (see section 11 and [`../../legal-drafts/EVALUATION-AGREEMENT-DRAFT.md`](../../legal-drafts/EVALUATION-AGREEMENT-DRAFT.md)), not as a live-data pilot.

## Conflicts counsel should know about **[VERIFIED]**

| Conflict | Sources | Position here |
| --- | --- | --- |
| Pilot length: 26 weeks (code, D-134) versus 8-12 weeks (planning assumption) | `PILOT_WEEKS = 26`; user's brief | **[DECISION OPEN]** (founder); term is a blank in section 3 |
| Cohort size: trust outline sample says "up to 500 students"; framework bound is 10-200; pilot draft says "proposed 50-200" | [`../../trust/PILOT-AGREEMENT-OUTLINE.md`](../../trust/PILOT-AGREEMENT-OUTLINE.md), `PAID-PILOT-FRAMEWORK.md`, `PILOT-AGREEMENT-DRAFT.md` | Use 10-200 (target 50-200); the 500 sample is superseded for this outline |
| Trust outline's sample scope lists SSO and LTI 1.3 as "included" | same | SSO/LTI are **planned, not available** (CLM-005); not offered in section 4 |
| Price on record for individuals differs (D-134 / D-1154 / assumption) | [`../../decisions/D-1154.md`](../../decisions/D-1154.md) | Irrelevant to institutional fees, which are `[PRICE TO BE CONFIRMED]` |
| "extend" (closeout plan) versus `expand` (code `PilotDecision`) | [`../../institutional-readiness/PILOT-CLOSEOUT-AND-CONVERSION-PLAN.md`](../../institutional-readiness/PILOT-CLOSEOUT-AND-CONVERSION-PLAN.md), `pilot.ts` | Counsel should fix the vocabulary: convert / expand / pause / stop in code; "extend" appears only in the closeout doc |

## Section-by-section outline

Each section: **business position** (what the founder proposes counsel express), **existing drafts and status**, **open issues for counsel**, **flag**. All referenced drafts carry the banner "DRAFT FOR QUALIFIED LEGAL REVIEW" **[VERIFIED]**; none is counsel-approved or executed.

### 1. Parties and effective date **[REVIEW: counsel]**

- **Position:** two parties, [SEMESTER ENTITY] and [INSTITUTION ENTITY]; effective date on last signature of authorized signers.
- **Existing:** `PILOT-AGREEMENT-DRAFT.md` (parties/authority blanks). Entity facts: GO-NO-GO blocking item 5 and launch risk FR-001 in [`../../../LAUNCH-RISK-REGISTER.md`](../../../LAUNCH-RISK-REGISTER.md): legal entity, jurisdiction, ownership/IP chain and signing authority are **not confirmed**.
- **Open issues:** which entity contracts; whether an entity exists; university IP/funding captures (strategy risk SR-013); founder's enrollment conflict (SR-007); customer signatory authority and delegation limits.

### 2. Purpose **[REVIEW: counsel]**

- **Position:** one bounded, measurable, reversible pilot to test one workflow with one cohort; not a broad deployment or replacement of an official system.
- **Existing:** plain-language summary in `PILOT-AGREEMENT-DRAFT.md`; [`../../commercial/PILOT-OFFER.md`](../../commercial/PILOT-OFFER.md).
- **Open issues:** whether "pilot" and "evaluation" need different paper; evaluation-only status before activation.

### 3. Term, milestones and termination **[REVIEW: counsel]**

- **Position:** term, implementation window, measurement window, midpoint review and conversion decision date are scheduled dates. **Length is [DECISION OPEN] (26 weeks per code versus 8-12 weeks assumption).** Conversion decision within -14/+30 days of end date (code rule). Either party may stop for convenience on [PLACEHOLDER] notice; Semester may pause for safety, privacy, accessibility or integrity guardrails; consequences of stop: export, revocation, deletion.
- **Existing:** `PILOT-AGREEMENT-DRAFT.md` (launch, change, pause, closeout); [`../../institutional-readiness/PILOT-CLOSEOUT-AND-CONVERSION-PLAN.md`](../../institutional-readiness/PILOT-CLOSEOUT-AND-CONVERSION-PLAN.md).
- **Open issues:** termination rights and notice; effect on prepaid fees; survival clauses; what "activation" means contractually (separate from signature).

### 4. Scope, cohort, permitted use and non-goals **[REVIEW: counsel]**

- **Position:** one cohort of 10-200 students; manual/read-only data; permitted use limited to the pilot purpose; non-goals: official-record writes, live SSO/SIS/LMS/LTI, admissions/aid/disability/health/counseling/immigration/discipline data, individual risk scoring, automated registration, grade prediction, surveillance, system-of-record replacement.
- **Existing:** `PILOT-AGREEMENT-DRAFT.md` (included/excluded); [`../../legal-drafts/INSTITUTIONAL-PILOT-PROPOSAL-TEMPLATE-DRAFT.md`](../../legal-drafts/INSTITUTIONAL-PILOT-PROPOSAL-TEMPLATE-DRAFT.md); [`../../legal-drafts/STATEMENT-OF-WORK-TEMPLATE-DRAFT.md`](../../legal-drafts/STATEMENT-OF-WORK-TEMPLATE-DRAFT.md).
- **Open issues:** minors/guardian authority and jurisdictions before consent clauses (see [`../../legal-drafts/MINORS-AND-GUARDIAN-OPERATIONS-DRAFT.md`](../../legal-drafts/MINORS-AND-GUARDIAN-OPERATIONS-DRAFT.md)); student voluntariness language; scope-change procedure.

### 5. Customer responsibilities **[REVIEW: counsel]**

- **Position:** name sponsor, champion, IT, security, privacy, accessibility, procurement and support contacts; provide lawful authority and minimum data; approve communications; validate sources; perform UAT; attend weekly/midpoint/final reviews; provide baseline data.
- **Existing:** `PILOT-AGREEMENT-DRAFT.md` (governance and responsibilities); [`../../legal-drafts/IMPLEMENTATION-RESPONSIBILITY-MATRIX-DRAFT.md`](../../legal-drafts/IMPLEMENTATION-RESPONSIBILITY-MATRIX-DRAFT.md).
- **Open issues:** consequence of non-performance (dates move, not breach?); customer data-authority warranty.

### 6. Semester responsibilities (verified commitments only) **[REVIEW: counsel]**

- **Position:** only what exists and is evidenced: configure approved scope; provide training and documented support route; supply evidence and aggregate reporting; export, revocation, deletion at close. No commitment to integrations, uptime, response times, certifications or outcomes (CLM-005, -010, -014, -016).
- **Existing:** `PILOT-AGREEMENT-DRAFT.md`; evidence state in [`../../trust/EVIDENCE-REGISTER.md`](../../trust/EVIDENCE-REGISTER.md); [`../../../PUBLIC-CLAIMS-APPROVAL-REGISTER.md`](../../../PUBLIC-CLAIMS-APPROVAL-REGISTER.md).
- **Open issues:** staffing: support, security, implementation owners are unassigned (GO-NO-GO #6); single-founder dependency; subcontracting.

### 7. Fees, invoicing, payment, implementation, taxes, expenses **[REVIEW: counsel] [REVIEW: tax]**

- **Position:** pilot fee, implementation fee, annual conversion price are all **[PRICE TO BE CONFIRMED]**; payment schedule, PO, tax treatment and expenses by authorized paper; no pilot credit unless stated. Planning assumptions for internal use only are in [`../sales/PILOT_PROPOSAL_TEMPLATE.md`](../sales/PILOT_PROPOSAL_TEMPLATE.md) appendix A [INTERNAL].
- **Existing:** [`../../legal-drafts/ORDER-FORM-TEMPLATE-DRAFT.md`](../../legal-drafts/ORDER-FORM-TEMPLATE-DRAFT.md); [`../../legal-drafts/PROFESSIONAL-SERVICES-TERMS-DRAFT.md`](../../legal-drafts/PROFESSIONAL-SERVICES-TERMS-DRAFT.md); [`../../legal-drafts/REFUND-CANCELLATION-AND-RENEWAL-POLICY-DRAFT.md`](../../legal-drafts/REFUND-CANCELLATION-AND-RENEWAL-POLICY-DRAFT.md).
- **Open issues:** entity, tax registration and nexus, sales-tax treatment of software and services, invoicing/billing controls (checkout and billing remain held by code), revenue-recognition review ([`../../commercial/REVENUE-RECOGNITION-REVIEW-CHECKLIST.md`](../../commercial/REVENUE-RECOGNITION-REVIEW-CHECKLIST.md)) [REVIEW: accounting], refund and suspension rights, AI usage limits and any overage. Payment is NO-GO today.

### 8. Success metrics, baseline, reporting and non-guarantee **[REVIEW: counsel]**

- **Position:** 3-5 primary metrics with frozen baseline, source, owner, cadence and a privacy floor of 10; weekly and final reporting; stated limitations; **no guarantee of outcome**; logins alone are not success; no causal claim without design.
- **Existing:** `PILOT-AGREEMENT-DRAFT.md` (success and guardrails); [`../../commercial/PILOT-SUCCESS-PLAN.md`](../../commercial/PILOT-SUCCESS-PLAN.md), [`PILOT-SCORECARD.md`](../../commercial/PILOT-SCORECARD.md); [`WEEKLY_PILOT_REPORT.md`](WEEKLY_PILOT_REPORT.md), [`FINAL_VALUE_REPORT.md`](FINAL_VALUE_REPORT.md).
- **Open issues:** who owns baseline data quality; remedy when baseline is unavailable; limitation-of-liability interaction with reports.

### 9. Data protection **[REVIEW: counsel] [REVIEW: privacy]**

- **Position:** roles (institution controller or school official / Semester processor or vendor, as counsel determines); categories (minimum identity/course/deadline context as approved; excluded sensitive categories); processing purposes limited to the pilot; retention, deletion and return at close; DPA reference; subprocessor list and change notice; AI-provider boundary.
- **Existing:** [`../../legal-drafts/DATA-PROCESSING-ADDENDUM-DRAFT.md`](../../legal-drafts/DATA-PROCESSING-ADDENDUM-DRAFT.md); [`STUDENT-DATA-PRIVACY-ADDENDUM-DRAFT.md`](../../legal-drafts/STUDENT-DATA-PRIVACY-ADDENDUM-DRAFT.md); [`DATA-RETENTION-EXPORT-AND-DELETION-EXHIBIT-DRAFT.md`](../../legal-drafts/DATA-RETENTION-EXPORT-AND-DELETION-EXHIBIT-DRAFT.md); [`SUBPROCESSOR-LIST-TEMPLATE-DRAFT.md`](../../legal-drafts/SUBPROCESSOR-LIST-TEMPLATE-DRAFT.md); [`AI-USE-TERMS-EXHIBIT-DRAFT.md`](../../legal-drafts/AI-USE-TERMS-EXHIBIT-DRAFT.md); trust: [`../../trust/DPA-CHECKLIST.md`](../../trust/DPA-CHECKLIST.md), [`../../trust/SUBPROCESSOR-GOVERNANCE-PROGRAM.md`](../../trust/SUBPROCESSOR-GOVERNANCE-PROGRAM.md), [`../../trust/DATA-RETENTION-AND-DELETION-STANDARD.md`](../../trust/DATA-RETENTION-AND-DELETION-STANDARD.md).
- **Open issues:** FERPA role, state student-privacy statutes, minors, data residency (none promised), backup-tail deletion, legal hold, audit rights.

### 10. Security, incident notification, support, availability, accessibility and service limits **[REVIEW: counsel] [REVIEW: security] [REVIEW: accessibility]**

- **Position:** **only as verified and approved.** Security: state controls as evidenced (repository-tested) and independent assessment as not yet done; incident notice window [PLACEHOLDER - none approved]; support: best-effort hours and channel in writing; availability: no uptime figure; accessibility: automated checks only, known limitations and alternative path; service limits: cohort cap, AI capacity limits as per approved scope.
- **Existing:** [`../../legal-drafts/INFORMATION-SECURITY-ADDENDUM-DRAFT.md`](../../legal-drafts/INFORMATION-SECURITY-ADDENDUM-DRAFT.md); [`SECURITY-INCIDENT-NOTIFICATION-EXHIBIT-DRAFT.md`](../../legal-drafts/SECURITY-INCIDENT-NOTIFICATION-EXHIBIT-DRAFT.md); [`SERVICE-LEVEL-EXPECTATIONS-DRAFT.md`](../../legal-drafts/SERVICE-LEVEL-EXPECTATIONS-DRAFT.md); [`SUPPORT-POLICY-EXHIBIT-DRAFT.md`](../../legal-drafts/SUPPORT-POLICY-EXHIBIT-DRAFT.md); [`ACCESSIBILITY-ROADMAP-EXHIBIT-DRAFT.md`](../../legal-drafts/ACCESSIBILITY-ROADMAP-EXHIBIT-DRAFT.md); trust: [`../../trust/SLA.md`](../../trust/SLA.md) (pilot is best-effort, not credit-bearing), [`../../trust/INCIDENT-RESPONSE-PLAN.md`](../../trust/INCIDENT-RESPONSE-PLAN.md).
- **Open issues:** no independent assessment, DAST, qualified accessibility review or measured uptime exists (GO-NO-GO #2, #3, #6); incident-notice duty and statutory timing by jurisdiction; whether any SLA credit is ever appropriate for a pilot (position: none).

### 11. Confidentiality, IP, feedback, publicity and reference rights, warranties, liability, indemnity, governing law, order of precedence **[REVIEW: counsel] [REVIEW: insurance]**

- **Position:** mutual confidentiality; Semester owns product IP; customer owns its data; feedback licence; **no publicity, logo, quote, reference or case study without separate claim-specific written permission** (CLM-013); warranties limited and non-absolute; liability and indemnity to be allocated by counsel against insurance actually held; governing law and venue by counsel; order of precedence (agreement, DPA, SOW, exhibits).
- **Existing:** [`../../legal-drafts/CONFIDENTIALITY-NDA-MUTUAL-DRAFT.md`](../../legal-drafts/CONFIDENTIALITY-NDA-MUTUAL-DRAFT.md); [`BETA-TERMS-AND-FEEDBACK-AGREEMENT-DRAFT.md`](../../legal-drafts/BETA-TERMS-AND-FEEDBACK-AGREEMENT-DRAFT.md); [`TESTIMONIAL-AND-CASE-STUDY-CONSENT-DRAFT.md`](../../legal-drafts/TESTIMONIAL-AND-CASE-STUDY-CONSENT-DRAFT.md); [`MASTER-SUBSCRIPTION-AGREEMENT-DRAFT.md`](../../legal-drafts/MASTER-SUBSCRIPTION-AGREEMENT-DRAFT.md); [`EVALUATION-AGREEMENT-DRAFT.md`](../../legal-drafts/EVALUATION-AGREEMENT-DRAFT.md); deviation rules in [`CONTRACT-DEVIATION-APPROVAL-MATRIX.md`](../../legal-drafts/CONTRACT-DEVIATION-APPROVAL-MATRIX.md) and [`CONTRACT-NEGOTIATION-PLAYBOOK.md`](../../legal-drafts/CONTRACT-NEGOTIATION-PLAYBOOK.md).
- **Open issues:** cyber/E&O insurance is not bound (GO-NO-GO #5), so any uncapped indemnity or high cap is unmanageable (strategy risk SR-021); university IP policy (SR-013); public-entity customers' governing-law constraints; customer paper precedence.

### 12. Annual conversion option **[REVIEW: counsel]**

- **Position:** **optional, not automatic.** Conversion is a new transaction decided by the customer on the decision date after the final value review; no auto-renewal, no price lock unless a price is separately approved. If counsel advises that a conversion option or pilot credit is unwise before a price book exists, drop it and keep conversion as a non-binding intent.
- **Existing:** [`../../PILOT-TO-ANNUAL-CONVERSION.md`](../../PILOT-TO-ANNUAL-CONVERSION.md); [`../../institutional-readiness/PILOT-CLOSEOUT-AND-CONVERSION-PLAN.md`](../../institutional-readiness/PILOT-CLOSEOUT-AND-CONVERSION-PLAN.md); `pilotVerdict` (no signed decision means no outcome; convert/expand blocked by unresolved high-severity issues).
- **Open issues:** price basis, pilot credit, term, notice, what happens to data if no conversion.

## Counsel issue summary **[INTERNAL]**

| Issue | Blocks | Authority |
| --- | --- | --- |
| Entity, signing authority, IP chain | Any signature | Counsel, founder |
| Insurance bound | Liability/indemnity position | Broker, counsel [REVIEW: insurance] |
| DPA approval, student-privacy regime, minors | Live data | Counsel [REVIEW: privacy] |
| Tax and accounting of fees | Invoice | CPA/tax [REVIEW: tax] |
| Independent security, accessibility evidence | Security/accessibility clauses | Qualified assessors |
| Pilot length decision | Term | Founder (D-<pull request number>) |

## Evidence state

**Repository evidence. [VERIFIED]** All cited drafts exist and are labelled draft for legal review.

**Operational evidence.** No counsel has reviewed any of them; no agreement exists.

**Missing proof.** Counsel approval, executed paper, authority and insurance evidence.

## Claim ceiling

Semester may say it has draft pilot paper under preparation for counsel review.

## Prohibited claims

Do not describe any term as agreed, any draft as approved or standard, or Semester as able to contract, invoice or accept payment today.

## Professional review required

Every section: [REVIEW: counsel]. Plus [REVIEW: tax], [REVIEW: accounting], [REVIEW: insurance], [REVIEW: privacy], [REVIEW: security], [REVIEW: accessibility] where flagged.
