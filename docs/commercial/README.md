# Commercial documents: index and precedence

| Control | Value |
| --- | --- |
| Status | **INDEX — NO COMMERCIAL ACTIVATION IS CLAIMED** |
| Owner | Harrison Rubin — company-side commercial owner |
| Evidence date | 2026-10-04 at repository revision `7287ddc` |

## Which document wins

When two documents disagree, the higher line governs and the lower one is corrected, never both left standing.

1. **Code and tests**: `app/src/lib/gtm/stages.ts`, `pilot.ts`, `rfp.ts`, `app/src/lib/governance/deal-desk.ts`, `app/src/lib/ops/claims.ts`.
2. **The claims and evidence registers**: [`../../PUBLIC-CLAIMS-APPROVAL-REGISTER.md`](../../PUBLIC-CLAIMS-APPROVAL-REGISTER.md), [`../market-readiness/CAPABILITY-STATUS-REGISTRY.json`](../market-readiness/CAPABILITY-STATUS-REGISTRY.json), [`../EVIDENCE-REGISTER.md`](../EVIDENCE-REGISTER.md), [`../market-readiness/EXECUTIVE-GO-NO-GO.md`](../market-readiness/EXECUTIVE-GO-NO-GO.md).
3. **This directory, `docs/commercial/`**: the controlled documents, each with an evidence date, owner, claim ceiling and prohibited claims.
4. **`docs/market-readiness/`**: the earlier source drafts that many files here name in their `Source` row. Where a same-named file exists in both places, this directory is canonical and the market-readiness file is its source, kept for history. Older underscore-named files in market-readiness (for example `PILOT_PLAYBOOK.md`, `HECVAT_READINESS.md`) are superseded by their hyphenated counterparts where one exists, except that `HECVAT_READINESS.md` is still the register `rfp.test.ts` reads.

## Three registers of claims, one ceiling

| Register | What it governs | Rule |
| --- | --- | --- |
| `PUBLIC-CLAIMS-APPROVAL-REGISTER.md` | the exact wording and channel of every public statement (CLM-001 to CLM-017) | approval is per wording and channel; unclear means do not publish |
| `app/src/lib/ops/claims.ts` | the status words the site prints, tested against the master register | the status ceiling for anything the site says |
| [`PRODUCT-MARKETING-CLAIMS-LIBRARY.md`](PRODUCT-MARKETING-CLAIMS-LIBRARY.md) | internal formulations for marketing drafting | not publication approval |

The RFP library answers procurement questions and may never say more than `claims.ts` for the same capability; `rfp.test.ts` holds that for SSO, SCIM, LTI, SIS, the penetration test, SOC 2, the accessibility conformance report and the data-processing agreement.

## Revenue-engine documents

| Need | Document |
| --- | --- |
| who to sell to, and in what order | [`MARKET-SEGMENTATION.md`](MARKET-SEGMENTATION.md), [`IDEAL-CUSTOMER-PROFILE.md`](IDEAL-CUSTOMER-PROFILE.md), [`BUYER-PERSONAS.md`](BUYER-PERSONAS.md) |
| the five motions and their buying committees | [`SEGMENT-MOTIONS-AND-BUYING-COMMITTEES.md`](SEGMENT-MOTIONS-AND-BUYING-COMMITTEES.md), [`PARTNER-AND-CHANNEL-STRATEGY.md`](PARTNER-AND-CHANNEL-STRATEGY.md) |
| scoring, stage exits and forecast | [`ACCOUNT-SCORING-AND-FORECAST.md`](ACCOUNT-SCORING-AND-FORECAST.md), [`SALES-PIPELINE-DEFINITIONS.md`](SALES-PIPELINE-DEFINITIONS.md) |
| discovery, demo and objections | [`../market-readiness/DISCOVERY-CALL-PLAYBOOK.md`](../market-readiness/DISCOVERY-CALL-PLAYBOOK.md), [`../market-readiness/DEMO-PLAYBOOK.md`](../market-readiness/DEMO-PLAYBOOK.md), [`../market-readiness/OBJECTION-HANDLING.md`](../market-readiness/OBJECTION-HANDLING.md) |
| ROI, business case and proof of value | [`ROI-MODEL-AND-BUSINESS-CASE.md`](ROI-MODEL-AND-BUSINESS-CASE.md), [`PILOT-SCORECARD.md`](PILOT-SCORECARD.md) |
| budget and procurement | [`BUDGET-AND-PURCHASING-PATH.md`](BUDGET-AND-PURCHASING-PATH.md), [`../HIGHER-ED-RFP-RESPONSE-LIBRARY.md`](../HIGHER-ED-RFP-RESPONSE-LIBRARY.md) |
| price, deal desk, discounts | [`PRICING-AND-PACKAGING.md`](PRICING-AND-PACKAGING.md), [`../operating-model/COMMERCIAL-GOVERNANCE.md`](../operating-model/COMMERCIAL-GOVERNANCE.md) |
| collateral and handoff | [`STAGE-COLLATERAL-AND-HANDOFF.md`](STAGE-COLLATERAL-AND-HANDOFF.md) |
| pilot to production | [`../PAID-PILOT-FRAMEWORK.md`](../PAID-PILOT-FRAMEWORK.md), [`../PILOT-TO-ANNUAL-CONVERSION.md`](../PILOT-TO-ANNUAL-CONVERSION.md), [`../operating-model/PILOT-TO-PRODUCTION.md`](../operating-model/PILOT-TO-PRODUCTION.md) |
| references, renewal, expansion | [`CUSTOMER-REFERENCE-PROGRAM-DRAFT.md`](CUSTOMER-REFERENCE-PROGRAM-DRAFT.md), [`RENEWAL-AND-EXPANSION-PLAYBOOK.md`](RENEWAL-AND-EXPANSION-PLAYBOOK.md), [`CUSTOMER-HEALTH-SCORE.md`](CUSTOMER-HEALTH-SCORE.md) |
| data model and dashboards | [`CRM-DATA-MODEL.md`](CRM-DATA-MODEL.md), [`REVENUE-OPERATIONS-DASHBOARD-SPEC.md`](REVENUE-OPERATIONS-DASHBOARD-SPEC.md), [`ANALYTICS-AND-METRICS-DICTIONARY.md`](ANALYTICS-AND-METRICS-DICTIONARY.md) |

## Evidence state

**Repository evidence.** The documents above exist; the cross-references in this index and in the collateral map are checked by a test.

**Operational evidence.** No pipeline, customer, price book or revenue is evidenced.

## Claim ceiling

Semester may use this index to find the controlled document for a commercial question.

## Prohibited claims

Do not cite a document in this directory as evidence of a customer, a booking, a price, an outcome or an assurance.
