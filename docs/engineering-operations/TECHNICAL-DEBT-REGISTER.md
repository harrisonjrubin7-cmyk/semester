# Technical Debt Register

| Control | Value |
| --- | --- |
| Status | **CONTROLLED REGISTER — MATERIAL DEBT OPEN** |
| Owner | Harrison Rubin — engineering/product prioritization primary; backup technical owner unassigned |
| Evidence date | 2026-10-03 at repository revision `62d37c2f` |

| ID | Priority | Debt / evidence | Required closure | Blocks |
| --- | --- | --- | --- | --- |
| TD-001 | P0 | provider backup restore and gateway-journal recovery unproven | isolated provider restore, journal strategy, integrity checks, second operator, measured result | supported activation |
| TD-002 | P0 | target role/cross-tenant isolation and audit completeness unaccepted | target export plus two-role/cross-tenant negative tests and customer sign-off | institutional activation |
| TD-003 | P1 | contradictory current full/shuffle release evidence | immutable-candidate aggregate run and superseding evidence manifest | release decision |
| TD-004 | P1 | monitoring/alerts/support have no resilient backup rota or accepted institutional path | staffed channels, target alerts and exercised escalation/handoff | supported activation |
| TD-005 | P1 | complete account auth→export→delete browser flow absent | one real local/approved Auth lifecycle flow plus residual-data checks | invitation/broad beta |
| TD-006 | P1 | production kill/read-only/rollback not exercised | safe target drill with user message, audit, alert and recovery | supported activation |
| TD-007 | P1 | qualified manual accessibility and full device/state evidence absent | critical-flow review, remediation/retest and approved status language | broad individual/paid pilot |
| TD-008 | P1 | exact-SHA DAST and independent penetration test absent | current scan/remediation/rescan and independent assessment | paid pilot/enterprise |
| TD-009 | P2 | first-load bundle remains large and field Web Vitals absent | route profiles, reduction, low-end tests and privacy-safe field baseline | scaled acquisition |
| TD-010 | P2 | route/component/state consistency and screenshot baselines incomplete | census, reviewed exceptions and stable representative visual regression | product finalization |
| TD-011 | P2 | source/freshness vocabularies and per-record coverage remain partial | canonical decision plus route/data migration and comprehension test | trust consistency |
| TD-012 | P2 | complete SBOM/license/reachability review absent | reviewed inventory/notices/exceptions for candidate artifact | procurement consistency |

Debt receives owner, evidence, user/risk impact, target milestone, dependencies and acceptance test. P0/P1 cannot be hidden by a score, accepted indefinitely or waived for launch; reduce scope until the risk no longer applies or close it with evidence. Closed items retain the closure revision/artifact.

## Evidence state

**Code/config evidence.** The cited tests, runbooks, risk register and design-debt sources make these gaps observable and supply many closure probes.

**Operational evidence.** None of the rows above has the complete target/human/external evidence required for closure.

**Missing test/proof.** Execute each row's closure, record remediation/retest and authorized acceptance, then update this register and affected motion decision together.

## Claim ceiling

Semester may say material technical debt is explicitly registered and release-blocking debt is fail-closed.

## Prohibited claims

Do not call an item closed because a document, unit test, planned date or risk acceptance exists when its required operating evidence is missing.
