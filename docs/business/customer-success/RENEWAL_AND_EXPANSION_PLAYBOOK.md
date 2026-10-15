# Renewal and Expansion Playbook (process, timeline, NRR)

| Control | Value |
| --- | --- |
| Status | **DRAFT - PREPARED PROCESS; NO RENEWAL, EXPANSION, ANNUAL CONVERSION, CUSTOMER OR REFERENCE EXISTS** |
| Owner | Harrison Rubin (interim; backup unassigned). Finance, counsel, customer approvers unassigned |
| Evidence date | 2026-10-05 at repository revision `5eba494` |
| Labels used | [VERIFIED] [ASSUMPTION] [DRAFT] [INTERNAL] [DECISION OPEN] [REVIEW: counsel] [REVIEW: accounting] [REVIEW: tax] |
| Audience | Internal. Customer-facing proposals are built from approved wording with `[PLACEHOLDER]` for price and dates, marked as non-binding drafts pending counsel review. |

> This is an operating document, not legal, tax or accounting advice. No price, order form or renewal term here is approved.

**Label legend.** [VERIFIED] proven by a repository path. [ASSUMPTION] timing, rate or threshold. [DRAFT] needs review. [INTERNAL] not for customers. [DECISION OPEN] founder decision. [APPROVED] count: zero.

## Relationship to existing artifacts

| Existing artifact | What it already covers | What this document adds | Why a new document |
| --- | --- | --- | --- |
| [`../../commercial/RENEWAL-AND-EXPANSION-PLAYBOOK.md`](../../commercial/RENEWAL-AND-EXPANSION-PLAYBOOK.md) | Decisions set before launch; ongoing/midpoint/pre-decision/final cadence; the narrow-extension rule (`renewal_date` = term end minus 120 days); conversion preconditions | T-minus timeline, evidence pack, expansion motions, NRR formula, QBR and sponsor cadence, stage mapping | Controlled doc is a 38-line decision cadence; it is not edited |
| [`../../PILOT-TO-ANNUAL-CONVERSION.md`](../../PILOT-TO-ANNUAL-CONVERSION.md), [`../../institutional-readiness/PILOT-CLOSEOUT-AND-CONVERSION-PLAN.md`](../../institutional-readiness/PILOT-CLOSEOUT-AND-CONVERSION-PLAN.md) | Four outcomes; decision meeting agenda; annual proposal rules; closeout checklist | Order-form preparation held state; evidence pack contents | Linked |
| [`../../commercial/CHURN-AND-RISK-PLAYBOOK.md`](../../commercial/CHURN-AND-RISK-PLAYBOOK.md) | Risk domains, response, exit capture | Trigger-to-action table tied to the health score | Linked |
| [`../../commercial/CUSTOMER-REFERENCE-PROGRAM-DRAFT.md`](../../commercial/CUSTOMER-REFERENCE-PROGRAM-DRAFT.md), [`../../market-readiness/CASE-STUDY-TEMPLATE.md`](../../market-readiness/CASE-STUDY-TEMPLATE.md), [`../../legal-drafts/TESTIMONIAL-AND-CASE-STUDY-CONSENT-DRAFT.md`](../../legal-drafts/TESTIMONIAL-AND-CASE-STUDY-CONSENT-DRAFT.md) | Eligibility, permission record, workflow, consent draft | Pointer and gate summary only | Do not duplicate |
| [`../../finance/04-UNIT-ECONOMICS.md`](../../finance/04-UNIT-ECONOMICS.md) | NRR in the model: (ARR at start + expansion - churn) / ARR at start; data source line | Explicit contraction term, GRR, data requirements, worked example | Finance doc is the model; this is the CS-side definition |
| [`../../institutional-implementation/EXECUTIVE-BUSINESS-REVIEW.md`](../../institutional-implementation/EXECUTIVE-BUSINESS-REVIEW.md), [`../../institutional-implementation/SUCCESS-SYSTEM.md`](../../institutional-implementation/SUCCESS-SYSTEM.md) | Review content and cadence | QBR link | Linked |

## Gate (what is allowed now versus held)

Source: [`../../../GO-NO-GO-DECISION.md`](../../../GO-NO-GO-DECISION.md). [VERIFIED]

| Allowed NOW | HELD until the named gate flips |
| --- | --- |
| Maintain this playbook; draft an evidence-pack shell and a proposal shell with `[PLACEHOLDER]` price and dates; rehearse on synthetic data; discuss the process in design-partner scoping | Price quote, order form, invoice, payment (paid pilot NO-GO/RED; CLM-015); annual conversion; renewal or expansion proposal to a real account; live data; tenant activation; case study, reference, logo or testimonial (CLM-013, CLM-014 PROHIBITED TODAY) |

## 1. Stage mapping [VERIFIED: `app/src/lib/gtm/stages.ts`]

| Event in this playbook | `SALES_STAGES` identifier | Gate (`SALES_EXIT`) | Account status |
| --- | --- | --- | --- |
| Pilot results and decision | `live` to `renewal` | `renewal`: "The pilot has a signed, final verdict (pilotVerdict in #817) with outcomes measured." | `customer` |
| Renewal or annual conversion in negotiation | `renewal` | same | `customer` |
| Adjacent scope sold | `expansion` (no gate in `SALES_EXIT`) | Owner convention: own readiness check and launch-council go per new cohort ([`../../PILOT-TO-ANNUAL-CONVERSION.md`](../../PILOT-TO-ANNUAL-CONVERSION.md)) | `customer` |
| Stop, decline or no decision | `closed_lost` (reopens only as a new `target_account`) | none | `closed_lost` |
| Pause | any stage; `paused` account status | none | `paused` |

A narrow extension is not a final outcome: keep the renewal opportunity non-decided with outcome `pending`, record purpose, price, scope and risk in the decision record, and set `renewal_date` to the new term end minus 120 days. [VERIFIED rule: controlled renewal playbook]

## 2. Renewal timeline (T-minus) [ASSUMPTION]

T is the term end of an **annual** agreement (none exists). The controlled commercial trigger opens the renewal opportunity 120 days before term end [VERIFIED: `../../commercial/STAGE-COLLATERAL-AND-HANDOFF.md`], which fixes T-120; the other offsets are planning assumptions. For a **pilot**, T is the pilot end date: the conversion date must fall between end minus 14 days and end plus 30 days (`pilotReadiness`), and T-180 would equal the pilot start under the 26-week rule, so use only the offsets that fit the pilot length actually decided ([`ONBOARDING_WORKFLOW.md`](ONBOARDING_WORKFLOW.md) section 1.2, [DECISION OPEN]).

| Offset | Activity | Owner | Output | System of record |
| --- | --- | --- | --- | --- |
| T-180 | Renewal-readiness review: confirm contract end, notice terms, decision authority, budget cycle; success-plan status; health score review | CS | Renewal calendar entry; risk list | `gtm_*` opportunity |
| T-120 | Renewal opportunity opens (system trigger); stakeholder map refresh; evidence pack outline | CS, founder | Opportunity record; stakeholder map | `gtm_*` |
| T-90 | Executive sponsor review of value to date (QBR-style); open risks; scope hypothesis for next term; confirm price approval path **HELD** | Founder, sponsor | Sponsor note; decision on scope hypothesis | `gtm_*` decision log |
| T-60 | Evidence pack final; deal-desk review of proposed terms; counsel review of paper changes [REVIEW: counsel]; capacity check | Founder, finance | Draft proposal (non-binding, `[PLACEHOLDER]` price) | Evidence folder |
| T-30 | Decision meeting; order or change preparation; data-disposition plan if not renewing | Founder, sponsor | Signed decision or documented no-decision | `gtm_pilot_outcomes` / decision log |
| T-0 and after | Execute renewal or clean offboarding; report extension separately | Founder, CS | Signed order or offboarding record | `gtm_*`; billing system (not live) |

No auto-renewal, no urgency manufactured, no continuing data access outside approved terms. [VERIFIED rule: controlled renewal playbook]

## 3. Pilot-to-annual conversion process [DRAFT] [REVIEW: counsel]

1. **Decision meeting** with champion and sponsor: agenda as in [`../../PILOT-TO-ANNUAL-CONVERSION.md`](../../PILOT-TO-ANNUAL-CONVERSION.md) (metrics vs baseline at cohort level; support per 100 students and accessibility reports; cost to serve; limitations; Semester's recommendation, which may be stop).
2. **Evidence pack** (assembled before the meeting): final report from [`PILOT_SUCCESS_PLAN.md`](PILOT_SUCCESS_PLAN.md) with ACTUAL/ESTIMATE labels and missingness; health score history ([`CUSTOMER_HEALTH_SCORE.md`](CUSTOMER_HEALTH_SCORE.md)); issue and incident log with P0/P1 closure; accessibility record; support summary; rights and offboarding readiness; cost to serve (implementation hours, AI usage); open-risk register; signed midpoint record.
3. **Signed verdict**: `pilotVerdict` needs decision, signer and date, and refuses convert or expand while a high-severity issue is open. [VERIFIED: `app/src/lib/gtm/pilot.ts`]
4. **Order-form preparation is HELD.** Allowed now: draft shell with `[PLACEHOLDER]` price, scope, term. Held: quoting, issuing or signing an order form until the paid-pilot and pricing gates flip (price approval, counsel-approved paper, entity/tax authority; GO-NO-GO blocking items; CLM-015) and until the deal desk (`review()` in `app/src/lib/governance/deal-desk.ts`) returns no refusals. Inputs for price: [`../finance/PRICING_AND_PACKAGING.md`](../finance/PRICING_AND_PACKAGING.md) (planning assumptions only).
5. **Execute or offboard**: new order, capacity and launch gate for new scope; otherwise export, revocation, deletion and confirmation ([`../../market-readiness/PILOT-OFFBOARDING-PLAYBOOK.md`](../../market-readiness/PILOT-OFFBOARDING-PLAYBOOK.md)).

## 4. Expansion motions [DRAFT]

Every expansion is a new scope: new readiness check, new launch-council go, new approvals; none is assumed from a pilot result. Healthy-score alone never triggers an expansion proposal.

| Motion | Trigger | Prerequisites | Approvals | Notes |
| --- | --- | --- | --- | --- |
| New cohort (same workflow) | Sponsor and champion request; prior cohort metrics reviewed | Cohort within 10-200 for pilots; baseline for the cohort; support capacity | Launch council go per cohort; deal desk if price changes | Lowest risk |
| New department or program | Dean or department head interest, with executive sponsor sponsorship | Buying committee mapped for the new unit; data scope reviewed again | Deal desk, security/privacy if data changes | Department tier minimum is a proposed default in `DEAL_POLICY` |
| New campus | System or provost request | Multi-campus governance ([`../../operating-model/MULTI-CAMPUS.md`](../../operating-model/MULTI-CAMPUS.md)); tenant isolation evidence | Deal desk, security/privacy, legal | Only after repeated deployments; broad enterprise is NO-GO |
| New workflow or module | Customer need beyond the pilot workflow | Product capability register shows it live; accessibility review; training | Product, deal desk | Sell only what the capability register shows live |
| Integration add | Customer request | Integration feasibility, read-only first, security review | Security, deal desk (scope changes data) | Integrations are not evidenced as live |
| Support tier | Customer request | Staffed support evidenced (GO-NO-GO priority 6) | Finance, deal desk | Not sellable until support is staffed |

## 5. Churn-risk process [DRAFT]

Policy and domains: [`../../commercial/CHURN-AND-RISK-PLAYBOOK.md`](../../commercial/CHURN-AND-RISK-PLAYBOOK.md). Operating loop: a signal from [`CUSTOMER_HEALTH_SCORE.md`](CUSTOMER_HEALTH_SCORE.md) section 3 raises a flag; CS validates data with the customer within the week; owner and date named; sponsor conversation if Red; correct, reduce, pause or offboard. P0/P1, isolation, rights or accessibility failures are incident and stop events, not save campaigns. Exit capture uses an approved limited reason taxonomy; export and revocation are never withheld; payment status never limits data rights. Churn is reported only against an eligible-contract denominator.

| Trigger | First response (within a week) | Escalation |
| --- | --- | --- |
| Sponsor disengages | Request alternate sponsor; confirm decision authority | Founder call |
| Activation below agreed threshold | Review invitation path with champion; accessibility and clarity check | Rescope cohort or pause |
| Outcome metrics flat or worse for three reports | Validate data; discuss value hypothesis honestly | Midpoint decision: correct or stop |
| Repeated unresolved friction | Problem record with owner; product escalation | Hold launch of new scope |
| Champion departs | Backup takes role; re-run RACI | Executive sponsor review |

## 6. Reference and case-study workflow (permission first) [DRAFT] [REVIEW: counsel] [REVIEW: privacy]

**Gate today: none permitted.** CLM-013 (named institution, logo, quote, endorsement, live pilot, case study) and CLM-014 (outcome, ROI, time-savings claims) are PROHIBITED TODAY in `../../../PUBLIC-CLAIMS-APPROVAL-REGISTER.md`; no customer or completed pilot exists. [VERIFIED]

| Step | Rule |
| --- | --- |
| 1 Eligibility | Authorized customer with accepted scope, no unresolved P0/P1 or dispute; participation optional and independent of pricing, support, renewal ([`../../commercial/CUSTOMER-REFERENCE-PROGRAM-DRAFT.md`](../../commercial/CUSTOMER-REFERENCE-PROGRAM-DRAFT.md)) |
| 2 Ask permission first | Before drafting anything: request a claim-specific permission using [`../../legal-drafts/TESTIMONIAL-AND-CASE-STUDY-CONSENT-DRAFT.md`](../../legal-drafts/TESTIMONIAL-AND-CASE-STUDY-CONSENT-DRAFT.md); record entity, signer, exact use, channels, term, withdrawal |
| 3 Substantiate | Claims owner checks every statement against measured, labelled data (CLM-014); individuals' identities, images and quotes need their own authority |
| 4 Review | Legal, Privacy, Communications, Accessibility; customer approves final wording and visuals |
| 5 Publish | Only approved version, channels and term; log use; no blanket future permission |
| 6 Withdraw | On expiry, withdrawal, correction or incident, remove from every controlled channel and record completion |

Template: [`../../market-readiness/CASE-STUDY-TEMPLATE.md`](../../market-readiness/CASE-STUDY-TEMPLATE.md). A discount or contract term can never be exchanged for a favorable statement.

## 7. QBR cadence and executive sponsor engagement [DRAFT]

- **QBR**: quarterly after a customer has converted to an annual agreement (none exists); written, sent to the sponsor; content and template: [`../templates/QBR_TEMPLATE.md`](../templates/QBR_TEMPLATE.md). Pilot customers have weekly reports, a midpoint review and a final value review instead ([`PILOT_SUCCESS_PLAN.md`](PILOT_SUCCESS_PLAN.md)).
- **Executive sponsor engagement**: confirm sponsor, decision authority and backup at kickoff; sponsor attends midpoint and final reviews and signs the verdict; between reviews a short written update monthly; sponsor disengagement is a health trigger and a risk-register entry. Never go around a sponsor to pressure a champion; never substitute a Semester executive for the customer's decision-maker.

## 8. Net revenue retention (NRR) [DRAFT] [REVIEW: accounting]

**Formula** (annual cohort):

NRR = (Starting ARR + Expansion ARR - Contraction ARR - Churned ARR) / Starting ARR

where Starting ARR is the annualised recurring contract value of customers active at the start of the window; Expansion, Contraction and Churned are changes in recurring value from **those same customers only** over 12 months; new-logo ARR is excluded. Gross revenue retention (GRR) = (Starting ARR - Contraction - Churned) / Starting ARR, capped at 100%. The finance model's formula omits an explicit contraction term ([`../../finance/04-UNIT-ECONOMICS.md`](../../finance/04-UNIT-ECONOMICS.md)); fold contraction into churn there or add it, and record which. [DECISION OPEN: finance owner]

**Data NRR needs** (none of it exists today):

| Input | Source | Rule |
| --- | --- | --- |
| Signed recurring contracts, value, term, start and end | Billing system joined to the `gtm_*` contract record (finance doc 04 data-source line) | Only live, signed recurring contracts count; pilots and one-time fees are excluded unless contractually recurring [REVIEW: accounting] |
| Price changes, add-ons, seat or enrolment true-ups | Order and change history | Separate expansion from price uplift if reporting both |
| Usage and AI overage | Metering | Report separately; not recurring ARR unless committed |
| Cohort definition and window | Finance | Same customers at start and end; 12 months [ASSUMPTION] |
| Currency, credits, discounts | Order forms | Use net recurring value after contractual discounts |

ILLUSTRATIVE (fictional): three customers with Starting ARR $300,000; Expansion $60,000; Contraction $15,000; Churn $30,000. NRR = (300,000 + 60,000 - 15,000 - 30,000) / 300,000 = 315,000 / 300,000 = **105%**. GRR = (300,000 - 15,000 - 30,000) / 300,000 = **85%**. Invented numbers, not a forecast or benchmark.

NRR is **not computable** today: no customer, contract or recurring revenue exists. Do not quote any NRR, including the finance model's planning output, as a result.

## 9. Operating cadence summary [DRAFT]

| When | What | Doc |
| --- | --- | --- |
| Weekly | Health review, risk list | [`CUSTOMER_HEALTH_SCORE.md`](CUSTOMER_HEALTH_SCORE.md) |
| Midpoint, final | Executive reviews, verdict | [`PILOT_SUCCESS_PLAN.md`](PILOT_SUCCESS_PLAN.md) |
| T-180 to T-0 | Renewal steps | Section 2 |
| Quarterly (post-conversion) | QBR | [`../templates/QBR_TEMPLATE.md`](../templates/QBR_TEMPLATE.md) |

## Evidence state

**Repository evidence.** [VERIFIED] verdict and stage code, controlled renewal, churn, reference and consent documents.
**Operational evidence.** None: no contract, renewal, expansion, NRR reading, reference or QBR.
**Missing proof.** One pilot taken to a signed verdict; approved price and paper; billing-to-CRM join; finance sign-off on the NRR definition.

## Claim ceiling

Semester may describe a planned, transparent renewal, expansion or offboarding process.

## Prohibited claims

No claim of retention, renewal, expansion, annual conversion, recurring revenue, NRR, reference rights or customer value from a proposal, discussion, extension or unsigned order.

## Professional review required

[REVIEW: counsel] order forms, renewal and notice terms, reference permissions; [REVIEW: accounting] NRR and ARR definitions, revenue recognition; [REVIEW: tax] indirect tax on renewals; [REVIEW: privacy] case-study data.
