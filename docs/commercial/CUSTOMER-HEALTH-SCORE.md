# Customer Health Score

| Control | Value |
| --- | --- |
| Status | **CONTROLLED PROPOSED MODEL — NO CUSTOMER SCORE OR PREDICTIVE VALIDATION** |
| Owner | Harrison Rubin — company-side success/health owner; customer sponsor, privacy reviewer, analyst and backup reviewer unassigned |
| Evidence date | 2026-10-03 at repository revision `a86b3376` |
| Source | [`../market-readiness/CUSTOMER-HEALTH-SCORE.md`](../market-readiness/CUSTOMER-HEALTH-SCORE.md) |

## Decision narrative first

Health is an account-level, human-reviewed operating aid—not a fact about students, an automated renewal decision or permission for intrusive outreach. Start with scope, outcome/guardrail evidence, missing data, recent changes, customer perspective, risks and next action. If a composite is used, show components, formula/version, source/as-of time, confidence and reviewer; never hide an override inside a color.

| Dimension | Proposed weight | Required evidence |
| --- | ---: | --- |
| agreed outcome trajectory | 25% | approved pilot measures, denominator, window, missingness and customer interpretation |
| implementation/readiness | 20% | accepted stage/gate evidence, not elapsed dates |
| meaningful adoption/first win | 15% | validated privacy-thresholded workflow measures; raw logins excluded |
| reliability/recovery | 15% | accepted SLI/incident/recovery evidence; no-data separate |
| support burden/resolution | 10% | staffed system, scope/hours, severity and unresolved age |
| sponsor/champion engagement | 10% | factual decision/action record; avoid subjective personality scoring |
| trust/customer gates | 5% | open risks, reviews, exceptions/expiry and customer decisions |

Weights are hypotheses requiring customer/privacy review and outcome validation. Do not compare different scope/phase customers without normalization. Do not infer hidden intent from email/activity or enrich with sensitive data. Show unavailable rather than neutral when evidence is absent.

The existing nightly `compute_account_health()` snapshot is **not an implementation of this proposed model**. It uses a limited set of implementation, invoice, renewal and QBR fields and can currently write `healthy` with `review_state = not_needed` when those source records are absent. Until that behavior is changed, source completeness is validated and a human review is required, the snapshot must be treated as **unavailable/unreviewed**, must not supply a health color or score, and must not drive outreach, renewal, expansion or customer claims.

## Overrides and actions

P0/P1 security, privacy, accessibility, safety, legal/rights, tenant-isolation or integrity issue overrides the score, requires incident response and immediately pauses the affected scope until authorized safe recovery. Other triggers—sponsor departure, unsupported expansion, unstaffed support, unreconciled billing/delivery or missed decision—require human review. Every state maps to a respectful named action: investigate data quality, ask the customer, remediate/support, rescope, pause, or prepare renewal/offboarding. Never penalize students or restrict rights.

## Evidence state

**Repository evidence.** Account-health structures, implementation/pilot records and proposed metrics can support a future account-level review, but the current nightly function does not meet this model's missing-evidence or human-review requirements.

**Operational evidence.** No customer population, validated formula/threshold, complete source feed, reviewer calibration, predictive result, customer agreement or operated intervention history exists.

**Missing test/proof.** Make the nightly function fail closed to unavailable/pending review when required sources are missing; test that condition; approve purpose/fields/weights/thresholds and retention; validate sources; run shadow reviews with customer context; measure false alerts/action outcomes; test access/appeal/correction; obtain privacy/customer approval before automation.

## Claim ceiling

Semester may use the dimensions as a proposed discussion framework and may record a human-reviewed narrative when approved evidence exists.

## Prohibited claims

Do not claim a customer is healthy/at risk, predict churn/renewal, automate outreach or decisions, score an individual, or report benchmark accuracy from this proposed model.
