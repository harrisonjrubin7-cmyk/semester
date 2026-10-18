# Budget Process and Purchasing Path

| Control | Value |
| --- | --- |
| Status | **CONTROLLED PLAYBOOK — GENERAL PATTERNS ONLY; EVERY THRESHOLD IS DISCOVERED PER ACCOUNT** |
| Owner | Harrison Rubin — company-side procurement owner; counsel, finance and customer-success reviewers unassigned |
| Evidence date | 2026-10-04 at repository revision `7287ddc` |
| Sources | [`../market-readiness/PROCUREMENT-QUESTIONNAIRE-PROCESS.md`](../market-readiness/PROCUREMENT-QUESTIONNAIRE-PROCESS.md), [`../market-readiness/PROCUREMENT_CHECKLIST.md`](../market-readiness/PROCUREMENT_CHECKLIST.md), [`../HIGHER-ED-RFP-RESPONSE-LIBRARY.md`](../HIGHER-ED-RFP-RESPONSE-LIBRARY.md), [`../legal-drafts/CONTRACT-NEGOTIATION-PLAYBOOK.md`](../legal-drafts/CONTRACT-NEGOTIATION-PLAYBOOK.md), `app/src/lib/ops/claims.ts` |

Institutions differ, and public institutions differ again by state law. Nothing below is a fact about a particular buyer. Each item is a question to ask and a record to keep. A threshold, calendar or rule is written on the account only after the buyer has stated it; a value from memory or from another account is never copied in.

## Questions that set the path

Ask in `discovery`, record before `qualified` (which requires a budget cycle and a decision process):

| Question | Why it decides the plan |
| --- | --- |
| When does the fiscal year start and end, and when are budget requests due for the next year? | many institutions budget months before the year they spend in; a decision after the request deadline waits a full cycle |
| Whose budget pays: department discretionary funds, a central line, a student-fee or activity-fee board, a grant with a period of performance, or a donor-restricted fund? | each has its own approval, timing and allowed use |
| What is the purchasing threshold below which a department may buy directly, the one above which quotes are needed, and the one above which a formal bid, RFP or board action is required? | decides whether the path is days or months; thresholds are set by the institution and, for public bodies, by law |
| Can the institution buy through an existing cooperative or consortium contract, or must it run its own competition? | Semester holds no cooperative contract and does not claim one |
| Is a sole-source or single-source justification available? | it requires a defensible uniqueness rationale; Semester does not assert uniqueness it cannot prove |
| What vendor registration, tax forms, insurance certificates and contract templates are required before a first payment? | insurance readiness is tracked in `../company/INSURANCE-READINESS-CHECKLIST.md`; a missing certificate can stop an otherwise approved deal |
| Which reviews run for a no-fee term? | review follows the data, not the price: a $0 design-partner term that touches student data still needs the data, security, accessibility and legal reviews |
| What are the gift, ethics and conflict-of-interest rules? | no gift, discount or benefit is offered to an individual; a discount is an institutional term approved on the deal-desk ladder |

## Reviews and what Semester can put in front of each

Reviews run in parallel after `qualified` where the buyer allows it. Semester answers from the RFP library and labels each answer with the status the library gives it; it never answers from memory.

| Review | Customer owner (typical) | Semester artifact | Status today | Owner on Semester's side |
| --- | --- | --- | --- | --- |
| Security | information security office | RFP library, `HECVAT-EVIDENCE-MATRIX.md`, `../trust/SECURITY-WHITEPAPER.md` (v0.1 draft), `../legal-drafts/INFORMATION-SECURITY-ADDENDUM-DRAFT.md` | HECVAT draft written, not sent; no penetration test, no SOC 2 report and none planned before a first pilot; recovery objectives not stated | owner, with security reviewer unassigned |
| Accessibility | accessibility or disability services | `../market-readiness/ACCESSIBILITY-OVERVIEW.md`, `../market-readiness/ACCESSIBILITY-CONFORMANCE-PLAN.md` | automated audits of critical journeys in CI; no accessibility conformance report; no recorded screen-reader pass; no conformance claim | owner, with accessibility reviewer unassigned |
| Privacy | privacy officer, registrar for education records | `../market-readiness/PRIVACY-OVERVIEW.md`, `../trust/FERPA-CONSENT-WORKFLOW.md`, `../legal-drafts/STUDENT-DATA-PRIVACY-ADDENDUM-DRAFT.md` | drafts exist; none counsel-approved; no compliance claim | owner and counsel (unassigned) |
| Legal | counsel and procurement | `../legal-drafts/MASTER-SUBSCRIPTION-AGREEMENT-DRAFT.md`, `ORDER-FORM-TEMPLATE-DRAFT.md`, `DATA-PROCESSING-ADDENDUM-DRAFT.md`, `PILOT-AGREEMENT-DRAFT.md`, `CONTRACT-NEGOTIATION-PLAYBOOK.md` | all drafts; none approved or in force | counsel (unassigned) |
| IT integration | identity and systems teams | `app/src/lib/integration/catalog.ts`, RFP rows SEC-1, INT-1 to INT-4 | SSO and SCIM in preparation, LTI and SIS planned; nothing is connected to a real system; manual and read-only first | owner |
| Implementation | the champion and program staff | `../market-readiness/IMPLEMENTATION_PLAYBOOK.md`, `../market-readiness/PILOT-IMPLEMENTATION-PLAYBOOK.md` | written, not run with a customer | owner |
| Budget | department head, finance, purchasing | this document, the quote, [`ROI-MODEL-AND-BUSINESS-CASE.md`](ROI-MODEL-AND-BUSINESS-CASE.md) | no approved price book; quote carries explicit placeholders | owner and finance (unassigned) |

If a reviewer requires something the table shows as absent (a SOC 2 report, a conformance report, a penetration-test summary), record it as an accepted prerequisite with an owner and a date, or as a disqualifier, in the `security_privacy_accessibility_review` exit. Do not offer a substitute that implies the missing thing.

## Timeline

Do not state a typical duration for any review. Record the actual elapsed days of each review on each account (stage-entered to stage-exited). After an approved minimum number of closed cycles, replace this paragraph with measured medians and the count behind them.

Fit the pilot to the calendar rather than the reverse:

- A pilot is exactly 26 weeks, and its conversion date falls between two weeks before and thirty days after the end date (`pilotReadiness`). The annual budget request for the conversion therefore has to be filed before the pilot's learning phase ends. Work backwards from the buyer's request deadline to choose the start term.
- A proposal's validity date is set to the buyer's approval calendar, not to Semester's quarter. An expired proposal is a hygiene exception.
- Renewal begins one budget cycle before the term ends, from the quarterly business review record (`../PILOT-TO-ANNUAL-CONVERSION.md`).

## Order of paper

1. Evaluation or pilot agreement (no-fee or fee), scoped to a cohort, a data plan and an offboarding path.
2. Order form and, where data flows, the data-processing and student-data addenda.
3. Master subscription agreement for an annual term.

Deviations go through the register in `../legal-drafts/CONTRACT-DEVIATION-APPROVAL-MATRIX.md`; amounts and discounts follow the deal-desk ladder. Counsel approves paper; Semester does not state a legal conclusion.

## Evidence state

**Repository evidence.** The questionnaire process, procurement checklist, RFP library, contract drafts and insurance checklist exist, and the RFP library is enforced against the claims register.

**Operational evidence.** No buyer's budget cycle, threshold, vendor registration or purchasing vehicle has been recorded, and no review has been run with a customer.

**Missing test/proof.** Run discovery with several institutions, record each buyer's actual path and elapsed times, complete vendor and insurance prerequisites and have counsel approve the paper.

## Claim ceiling

Semester may describe this as its discovery questions and its procurement-readiness map, with each artifact shown at the status above.

## Prohibited claims

Do not state a typical procurement timeline, a purchasing threshold, a cooperative or consortium contract, a sole-source basis, an approved agreement, or a completed review, certification or conformance claim.
