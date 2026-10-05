# Growth Funnel Specification

| Control | Value |
| --- | --- |
| Status | **CONTROLLED SPECIFICATION — FUNNELS PROPOSED; FIELD CONVERSION UNMEASURED** |
| Owner | Harrison Rubin — product/growth owner; privacy reviewer, analyst and backup experiment owner unassigned |
| Evidence date | 2026-10-03 at repository revision `a86b3376` |
| Source | [`../market-readiness/ANALYTICS-PLAN.md`](../market-readiness/ANALYTICS-PLAN.md) and [`../market-readiness/METRICS-AND-ANALYTICS-PLAN.md`](../market-readiness/METRICS-AND-ANALYTICS-PLAN.md) |

## Controlled funnels

| Motion | Ordered states | Value boundary |
| --- | --- | --- |
| individual | eligible visit → intentional start/signup → minimum setup → first win → Day 1/7/30 meaningful return → weekly prepared action → referral/upgrade interest or respectful disengagement/export/delete | optimize useful action and agency, not time spent, streaks or compulsive use |
| institutional | target account → discovery → qualified → multi-stakeholder demo/outcome workshop → technical and security/privacy/accessibility review → proposal/SOW → procurement/legal → contracted → implementation → cohort launch/activation → midpoint/final outcome review → renewal, expansion or clean offboarding | follows the implemented `SALES_STAGES` order; signed scope is not launch and product activity is not an institutional outcome |
| customer lifecycle | handoff accepted → implementation gates → UAT/launch GO → adoption/guardrail review → renewal decision → expansion under new scope or offboarding | health and expansion remain human-reviewed and contract/customer-approved |

Each transition needs a versioned definition, eligible denominator, timestamp, source, authority/consent, identity level, owner, retention, exclusions, data-quality checks and safe failure. A missing source means unavailable, not zero. Report both counts and rates with window/cohort; do not combine anonymous visits, local-only starts, signed-in accounts and institution-sponsored participants without explicit rules.

## Guardrails

Track opt-out/deletion, privacy complaints, accessibility blockers, support burden, notification disablement, P0/P1 incidents, source/authority errors, adverse subgroup patterns where lawful/ethical and adequately powered, provider/AI safety and cost. Suppress small cells under the approved threshold (current proposal: 10). Never collect course/task content, grades, health/disability, conduct/aid/immigration, messages, exact location or sensitive support detail merely for growth.

Experiments require a preregistered hypothesis, population, primary/guardrail metric, minimum practical effect, duration, stop rule, owner and review. Do not experiment on privacy defaults, consent comprehension, accessibility access, official/high-impact decisions or vulnerable users for conversion. Stop on harm, integrity failure, rights failure, P0/P1 or inability to honor withdrawal.

## Evidence state

**Repository evidence.** Funnel concepts, proposed event governance, first-win definitions and campaign/pilot controls exist.

**Operational evidence.** No accepted production event stream, complete denominator, experiment program, field conversion baseline, attribution model or validated growth result is evidenced.

**Missing test/proof.** Approve event dictionary/privacy basis; instrument and validate events; reconcile identities and denominators; test suppression/deletion/withdrawal; establish baseline windows; review experiments and preserve decisions/results.

## Claim ceiling

Semester may describe these as proposed ethical funnels and report only validated, privacy-approved field measures with their window/population/caveats.

## Prohibited claims

Do not claim conversion, activation, retention, growth, referral, attribution, experiment lift, product-market fit or institutional outcome from proposed events, synthetic data, raw traffic/logins or incomplete cohorts.
