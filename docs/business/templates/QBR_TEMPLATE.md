# Quarterly Business Review (QBR) Template - Annual Customer

| Control | Value |
| --- | --- |
| Status | **[DRAFT] BLANK TEMPLATE - NO ANNUAL CUSTOMER, QBR OR RENEWAL EXISTS** |
| Owner | Customer success [unassigned]; Harrison Rubin (interim; backup unassigned) |
| Evidence date | 2026-10-05 at repository revision `5eba494` |
| Labels used | [VERIFIED] [ASSUMPTION] [DRAFT] [INTERNAL] [REVIEW: counsel] [REVIEW: privacy] [REVIEW: security] |
| Audience | Customer sponsor and champion (sections 1-9 once approved); the internal pre-read and renewal-risk notes are [INTERNAL] |

> Operating document, not legal advice. Roadmap items are plans, not commitments.

Label legend: **[VERIFIED]** proved by path; **[ASSUMPTION]** planning value; **[DRAFT]** needs review; **[APPROVED]** none; **[INTERNAL]** not sent. Value labels: `ACTUAL`, `ESTIMATE`, `NOT MEASURED`, `SUPPRESSED`.

## Relationship to existing artifacts

| Existing artifact | What it already covers | What this document adds | Why new |
| --- | --- | --- | --- |
| [`../../commercial/CUSTOMER-SUCCESS-PLAYBOOK.md`](../../commercial/CUSTOMER-SUCCESS-PLAYBOOK.md) | Success function, lifecycle; notes no accepted QBR exists | The QBR agenda and one-page structure | The playbook has no meeting template |
| [`../../commercial/CUSTOMER-HEALTH-SCORE.md`](../../commercial/CUSTOMER-HEALTH-SCORE.md) | Proposed health dimensions and weights; human-reviewed, account-level; the nightly `compute_account_health()` is **not** an implementation of it | Section 1 uses its dimensions as a *narrative checklist*, not an automated score | Avoids implying a validated health score |
| [`../../commercial/RENEWAL-AND-EXPANSION-PLAYBOOK.md`](../../commercial/RENEWAL-AND-EXPANSION-PLAYBOOK.md), [`CHURN-AND-RISK-PLAYBOOK.md`](../../commercial/CHURN-AND-RISK-PLAYBOOK.md) | Renewal/expansion decision cadence; churn signals | Sections 8-9 operationalize them each quarter | n/a |
| [`FINAL_VALUE_REPORT.md`](FINAL_VALUE_REPORT.md), [`WEEKLY_PILOT_REPORT.md`](WEEKLY_PILOT_REPORT.md) | Pilot-period reporting | QBR continues the same metric ids and suppression rules after conversion | One definition |
| [`../../institutional-readiness/INSTITUTIONAL-ROADMAP-COMMUNICATION-STANDARD.md`](../../institutional-readiness/INSTITUTIONAL-ROADMAP-COMMUNICATION-STANDARD.md) | How roadmap may be communicated | Section 6 follows it | n/a |

## Gate

An annual customer requires a signed pilot verdict, a new agreement, readiness and activation (`renewal` stage per `SALES_EXIT`); annual conversion, price and live data are **HELD** (GO-NO-GO paid pilot NO-GO/RED). Today this template is for rehearsal only.

## Cadence and agenda (60 minutes, quarterly) **[DRAFT]**

| Min | Item |
| --- | --- |
| 0-5 | Agenda, last quarter's actions |
| 5-15 | Usage and health narrative (section 1) |
| 15-25 | Outcomes versus plan (section 2) |
| 25-32 | Support and operations (section 3) |
| 32-38 | Security, privacy, accessibility and compliance changes (section 4) |
| 38-43 | Roadmap, with disclaimers (section 5) |
| 43-50 | Expansion opportunities and renewal outlook (sections 6-7) |
| 50-60 | Action plan, owners, dates (section 8) |

## QBR document - [Institution] - Q[n] [YEAR] **[DRAFT]**

**Contract term:** [dates] **Renewal/notice date:** [DATE] **Sponsor:** [..] **Champion:** [..] **Semester owner:** [..] **Attendees (role):** [..]

### 1. Usage and health (narrative, account-level, human-reviewed)
Start with scope, evidence, missing data and what changed; only then any composite. Dimensions from the health-score document, each with source and `ACTUAL/ESTIMATE/NOT MEASURED`.

| Dimension | This quarter | Prior quarter | Evidence / source | Note |
| --- | --- | --- | --- | --- |
| Agreed outcome trajectory | | | | |
| Implementation / readiness | | | | |
| Meaningful adoption (aggregate; raw logins excluded; suppress < 10) | | | | |
| Reliability / recovery (no SLA inference) | | | | |
| Support burden and resolution | | | | |
| Sponsor / champion engagement (factual record, not personality) | | | | |
| Open customer gates and exceptions (with expiry) | | | | |

Show "unavailable" for absent evidence, never neutral. A P0/P1 security, privacy, accessibility, safety, legal/rights, tenant-isolation or integrity issue overrides any score.

### 2. Outcomes versus plan
| Metric (ids from [`../sales/PILOT_PROPOSAL_TEMPLATE.md`](../sales/PILOT_PROPOSAL_TEMPLATE.md)) | Baseline | Annual target [ASSUMPTION] | This quarter | Num / den | Source label | Variance and explanation |
| --- | --- | --- | --- | --- | --- | --- |

Business-case line (if the customer maintains one): scenario ROI per [`ROI_CALCULATOR_INPUTS.md`](ROI_CALCULATOR_INPUTS.md), labelled scenario estimate, not a guarantee. No retention, GPA, graduation or wellbeing claims.

### 3. Support and operations
Tickets by theme (aggregate), response and resolution **against the written commitment only**, repeat issues, open defects, change requests, incidents and post-incident actions, AI usage against the pooled allowance **[planning assumption 2,400 requests per enrolled student per year is internal; use the contractual figure only once one exists]**.

### 4. Security, privacy, accessibility and compliance changes
Changes since last quarter: subprocessors (notice per DPA), data-flow or scope changes, new evidence (assessments, reviews), expired evidence or exceptions, accessibility changes and known limitations, legal/policy changes, customer-side reviews due. State only verified items (cite [`../../trust/EVIDENCE-REGISTER.md`](../../trust/EVIDENCE-REGISTER.md)); say "not yet" for any certification or assessment that does not exist. [REVIEW: security] [REVIEW: privacy]

### 5. Roadmap (with disclaimers)
Planned items, each labelled `planned`, `in preparation` or `not planned`, with the customer need it addresses. **Disclaimer to print:** "Roadmap items are plans, not commitments. Dates, scope and availability may change and no feature is promised or priced unless it is in signed paper." Follow [`INSTITUTIONAL-ROADMAP-COMMUNICATION-STANDARD.md`](../../institutional-readiness/INSTITUTIONAL-ROADMAP-COMMUNICATION-STANDARD.md); never describe a feature from an open pull request as available.

### 6. Expansion
Adjacent cohorts/workflows the customer raised, each with its own readiness check, data authority and launch decision; no expansion assumed; separate paper and price `[PRICE TO BE CONFIRMED]`. Report separately from renewal.

### 7. Renewal outlook and risks
| Risk / signal | Evidence | Owner | Mitigation / date |
| --- | --- | --- | --- |
| Sponsor or champion change | | | |
| Budget or fiscal-year shift | | | |
| Outcomes behind plan | | | |
| Competing product, institution-licensed tool, or LMS vendor bundle | | | |
| Open security/privacy/accessibility issue | | | |
| Support dissatisfaction | | | |

Renewal is a decision for the customer; record notice dates and the decision maker. No auto-renewal is assumed.

### 8. Action plan
| # | Action | Customer owner | Semester owner | Due | Status |
| --- | --- | --- | --- | --- | --- |

### 9. Customer voice
Quotes only with separate consent and never used externally without claim-specific permission (CLM-013). Record asks, praise and complaints verbatim in the CRM.

## Internal pre-read **[INTERNAL]**
Account economics (cost to serve vs. fee; the Finance model tab of the operations console), capacity, discount or concession requests (deal desk), forecast category for renewal/expansion (kept separate from new business), open risks ([`RISK_REGISTER.md`](RISK_REGISTER.md) ids).

## Evidence state

**Repository evidence. [VERIFIED]** Health, renewal, churn and roadmap-communication documents exist; the nightly health function is not the proposed model.

**Operational evidence.** No annual customer, QBR, renewal or expansion exists.

**Missing proof.** Run one rehearsal on synthetic data and, later, one QBR with a real customer.

## Claim ceiling

Semester may describe a quarterly business review with usage, outcomes, support, trust changes, roadmap disclaimers and an action plan.

## Prohibited claims

Do not call any account healthy or at risk from an automated score, predict churn or renewal, promise roadmap items, or use outcomes or quotes externally without permission.

## Professional review required

Contract terms and roadmap language: [REVIEW: counsel]. Trust statements: [REVIEW: security] [REVIEW: privacy].
