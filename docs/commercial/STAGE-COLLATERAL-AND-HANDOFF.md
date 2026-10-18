# Stage Collateral, Evidence Artifacts and Sales-to-Implementation Handoff

| Control | Value |
| --- | --- |
| Status | **CONTROLLED MAP — EVERY ARTIFACT IS SHOWN AT ITS ACTUAL STATUS; NONE IS A CUSTOMER-READY ASSURANCE REPORT** |
| Owner | Harrison Rubin — company-side commercial owner; implementation lead, claims reviewers and counsel unassigned |
| Evidence date | 2026-10-04 at repository revision `7287ddc` |
| Sources | [`SALES-PIPELINE-DEFINITIONS.md`](SALES-PIPELINE-DEFINITIONS.md), [`../COMMERCIAL-CORE.md`](../COMMERCIAL-CORE.md), [`../market-readiness/VENDOR-DUE-DILIGENCE-PACK.md`](../market-readiness/VENDOR-DUE-DILIGENCE-PACK.md), [`../market-readiness/TRUST-CENTER-CONTENT.md`](../market-readiness/TRUST-CENTER-CONTENT.md), [`../../PUBLIC-CLAIMS-APPROVAL-REGISTER.md`](../../PUBLIC-CLAIMS-APPROVAL-REGISTER.md) |

An artifact that exists as a draft is shown as a draft. A buyer who asks for the thing in the **Absent** list is told it does not exist, with the plan, and is never given a stand-in that reads like it.

## Collateral by stage

| Stage | Use | Artifact | Status |
| --- | --- | --- | --- |
| `target_account` | choose and prepare | [`MARKET-SEGMENTATION.md`](MARKET-SEGMENTATION.md), [`IDEAL-CUSTOMER-PROFILE.md`](IDEAL-CUSTOMER-PROFILE.md), [`ACCOUNT-SCORING-AND-FORECAST.md`](ACCOUNT-SCORING-AND-FORECAST.md) | internal hypotheses |
| `discovery` | learn the problem | [`../market-readiness/DISCOVERY-CALL-PLAYBOOK.md`](../market-readiness/DISCOVERY-CALL-PLAYBOOK.md), [`../market-readiness/OBJECTION-HANDLING.md`](../market-readiness/OBJECTION-HANDLING.md), [`../market-readiness/BUYER-ONE-PAGERS.md`](../market-readiness/BUYER-ONE-PAGERS.md) | controlled drafts |
| `qualified` | decide to invest | [`../market-readiness/SALES-QUALIFICATION-SCORECARD.md`](../market-readiness/SALES-QUALIFICATION-SCORECARD.md) | internal |
| `multi_stakeholder_demo` | show on synthetic data | [`../market-readiness/DEMO-PLAYBOOK.md`](../market-readiness/DEMO-PLAYBOOK.md), [`DEMO-SCRIPT-EXECUTIVE.md`](DEMO-SCRIPT-EXECUTIVE.md), [`DEMO-SCRIPT-OPERATIONAL.md`](DEMO-SCRIPT-OPERATIONAL.md), [`DEMO-SCRIPT-TECHNICAL.md`](DEMO-SCRIPT-TECHNICAL.md) | controlled scripts; synthetic data only |
| `outcome_workshop` | agree the measures | [`ROI-MODEL-AND-BUSINESS-CASE.md`](ROI-MODEL-AND-BUSINESS-CASE.md), [`PILOT-SCORECARD.md`](PILOT-SCORECARD.md), [`SEGMENT-MOTIONS-AND-BUYING-COMMITTEES.md`](SEGMENT-MOTIONS-AND-BUYING-COMMITTEES.md) | worksheet; blank until measured |
| `technical_review` | answer architecture | [`../HIGHER-ED-RFP-RESPONSE-LIBRARY.md`](../HIGHER-ED-RFP-RESPONSE-LIBRARY.md), `app/src/lib/integration/catalog.ts` | library enforced against the claims register |
| `security_privacy_accessibility_review` | answer diligence | [`../market-readiness/HECVAT-EVIDENCE-MATRIX.md`](../market-readiness/HECVAT-EVIDENCE-MATRIX.md), [`../market-readiness/INFORMATION-SECURITY-QUESTIONNAIRE.md`](../market-readiness/INFORMATION-SECURITY-QUESTIONNAIRE.md), [`../trust/SECURITY-WHITEPAPER.md`](../trust/SECURITY-WHITEPAPER.md), [`../market-readiness/PRIVACY-OVERVIEW.md`](../market-readiness/PRIVACY-OVERVIEW.md), [`../market-readiness/ACCESSIBILITY-OVERVIEW.md`](../market-readiness/ACCESSIBILITY-OVERVIEW.md), [`../trust/AI-GOVERNANCE-PROGRAM.md`](../trust/AI-GOVERNANCE-PROGRAM.md), [`../trust/BUSINESS-CONTINUITY-AND-DISASTER-RECOVERY-PLAN.md`](../trust/BUSINESS-CONTINUITY-AND-DISASTER-RECOVERY-PLAN.md), [`../SUBPROCESSORS.md`](../SUBPROCESSORS.md) | drafts; the HECVAT is written and not sent; the whitepaper is v0.1 |
| `proposal` | propose | [`PILOT-PROPOSAL-TEMPLATE.md`](PILOT-PROPOSAL-TEMPLATE.md), [`PILOT-OFFER.md`](PILOT-OFFER.md), [`../legal-drafts/STATEMENT-OF-WORK-TEMPLATE-DRAFT.md`](../legal-drafts/STATEMENT-OF-WORK-TEMPLATE-DRAFT.md) | placeholders for price; no approved price book |
| `pilot_or_implementation_SOW` | scope | [`../legal-drafts/PILOT-AGREEMENT-DRAFT.md`](../legal-drafts/PILOT-AGREEMENT-DRAFT.md), [`../legal-drafts/EVALUATION-AGREEMENT-DRAFT.md`](../legal-drafts/EVALUATION-AGREEMENT-DRAFT.md), [`../legal-drafts/IMPLEMENTATION-RESPONSIBILITY-MATRIX-DRAFT.md`](../legal-drafts/IMPLEMENTATION-RESPONSIBILITY-MATRIX-DRAFT.md) | drafts for counsel |
| `procurement_legal` | sign | [`../legal-drafts/MASTER-SUBSCRIPTION-AGREEMENT-DRAFT.md`](../legal-drafts/MASTER-SUBSCRIPTION-AGREEMENT-DRAFT.md), [`../legal-drafts/ORDER-FORM-TEMPLATE-DRAFT.md`](../legal-drafts/ORDER-FORM-TEMPLATE-DRAFT.md), [`../legal-drafts/DATA-PROCESSING-ADDENDUM-DRAFT.md`](../legal-drafts/DATA-PROCESSING-ADDENDUM-DRAFT.md), [`../legal-drafts/CONTRACT-NEGOTIATION-PLAYBOOK.md`](../legal-drafts/CONTRACT-NEGOTIATION-PLAYBOOK.md), [`BUDGET-AND-PURCHASING-PATH.md`](BUDGET-AND-PURCHASING-PATH.md) | drafts; none approved or in force |
| `implementation` | deliver | [`../market-readiness/PILOT-IMPLEMENTATION-PLAYBOOK.md`](../market-readiness/PILOT-IMPLEMENTATION-PLAYBOOK.md), [`INSTITUTIONAL-IMPLEMENTATION-PLAYBOOK.md`](INSTITUTIONAL-IMPLEMENTATION-PLAYBOOK.md), [`CUSTOMER-ONBOARDING-PLAYBOOK.md`](CUSTOMER-ONBOARDING-PLAYBOOK.md) | written, not run with a customer |
| `live`, `renewal` | run and decide | [`CUSTOMER-HEALTH-SCORE.md`](CUSTOMER-HEALTH-SCORE.md), [`RENEWAL-AND-EXPANSION-PLAYBOOK.md`](RENEWAL-AND-EXPANSION-PLAYBOOK.md), [`../PILOT-TO-ANNUAL-CONVERSION.md`](../PILOT-TO-ANNUAL-CONVERSION.md), [`../market-readiness/PILOT-OFFBOARDING-PLAYBOOK.md`](../market-readiness/PILOT-OFFBOARDING-PLAYBOOK.md) | controlled drafts |
| any | after a consented customer exists | [`CUSTOMER-REFERENCE-PROGRAM-DRAFT.md`](CUSTOMER-REFERENCE-PROGRAM-DRAFT.md), [`../market-readiness/CASE-STUDY-TEMPLATE.md`](../market-readiness/CASE-STUDY-TEMPLATE.md) | no customer, reference or case study exists |

## Absent

| Artifact | Status | What a buyer is told |
| --- | --- | --- |
| SOC 2 report | not planned before a first pilot | RFP row SEC-5: none, and the HECVAT readiness register is offered instead |
| Penetration-test report | planned (`../trust/PENETRATION-TEST-PLAN.md`) | RFP row SEC-4: none yet |
| Accessibility conformance report (VPAT) | planned | RFP row AX-2: none yet; no conformance claim |
| Signed data-processing agreement | draft only | RFP row PF-1 |
| Insurance certificates | not evidenced | `../company/INSURANCE-READINESS-CHECKLIST.md` |
| Executive deck, reference sheet | not built; a reference sheet waits for a consenting customer (CLM-013) | built from approved claims only, when needed |
| Published subprocessor list, status page, support desk with response times | in preparation or planned | RFP rows PF-4 and SS-1 |

## Handoff: sales to implementation

`contracted` is the successful commercial decision. The signed order creates the tenant plan, an `implementation_projects` row and a renewal opportunity 120 days before the term ends through the controlled commercial trigger (`../COMMERCIAL-CORE.md`). That is a record, not an accepted handoff. The opportunity enters `implementation` only when the implementation lead accepts this checklist in writing.

| # | Handoff item | Source |
| --- | --- | --- |
| 1 | signed order, paper version and the deviation register with every approver named | `procurement_legal` |
| 2 | deal-desk review with no refusals; net annual value, discount, pilot credit and implementation fee as signed | `governance/deal-desk.ts` |
| 3 | the problem in the champion's words, the milestone and its date | discovery |
| 4 | scope: cohort and its size, workflow, data (minimum necessary, read-only first), integrations (manual or read-only unless an adapter is installed) | proposal and SOW |
| 5 | named sponsor, champion and a backup for each, with the customer's reviewers for privacy, security, accessibility and IT | outcome workshop |
| 6 | three to five measures with frozen baselines, targets, owners and sources; the privacy threshold and stop thresholds | [`PILOT-SCORECARD.md`](PILOT-SCORECARD.md) |
| 7 | midpoint review, conversion and offboarding dates | `pilotReadiness` |
| 8 | **every promise made in the sale**, each tied to the claims register or flagged as outside it | the seller's notes against `../../PUBLIC-CLAIMS-APPROVAL-REGISTER.md` |
| 9 | open review items, exceptions and accepted prerequisites, each with an owner and date | `security_privacy_accessibility_review` |
| 10 | support routing, student-communications owner and billing contact | onboarding playbook |
| 11 | data-processing status and the data-rights path | `procurement_legal` |
| 12 | reference and publicity status (none unless a signed permission exists) | [`CUSTOMER-REFERENCE-PROGRAM-DRAFT.md`](CUSTOMER-REFERENCE-PROGRAM-DRAFT.md) |

**Acceptance rule.** The implementation lead refuses the handoff if item 8 lists a promise outside the registry, if any item is blank, or if `pilotReadiness` returns a problem. A refused handoff returns to the seller with the reason; the opportunity stays in `contracted`. Acceptance sets the tenant to sandbox data mode, and launch waits for the launch council's go.

## Evidence state

**Repository evidence.** Every artifact above exists at the status shown, and a test fails if a document in the map is moved or deleted.

**Operational evidence.** No artifact has been delivered to a customer, no handoff has been accepted and no assurance report exists.

**Missing test/proof.** Run one handoff on a real signed scope, record what was missing and have counsel approve each paper before use.

## Claim ceiling

Semester may describe this as its internal collateral map and handoff checklist, and may share a draft only as a draft.

## Prohibited claims

Do not present a draft, template or plan as an approved agreement, assurance report, conformance report, certification or customer-ready evidence, and do not state that a handoff, implementation or launch has occurred.
