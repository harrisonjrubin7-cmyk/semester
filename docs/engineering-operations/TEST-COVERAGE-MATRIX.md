# Test Coverage Matrix

| Control | Value |
| --- | --- |
| Status | **CONTROLLED COVERAGE MAP — STRONG REPOSITORY COVERAGE; TARGET/HUMAN GAPS OPEN** |
| Owner | Harrison Rubin — test inventory and release-evidence owner; backup reviewer unassigned |
| Evidence date | 2026-10-03 at repository revision `0462206f` |
| Detailed source | [`../LAUNCH-READINESS-TEST-PLAN.md`](../LAUNCH-READINESS-TEST-PLAN.md) |

| Area | Repository evidence | Coverage state | Required closure |
| --- | --- | --- | --- |
| route/navigation/state | route, navigation, root isolation and broad application suites | **STRONG / AUTOMATED** | current aggregate run and route/state browser census |
| first-win/student journey | golden-path, accessibility and cold-start browser scripts | **PARTIAL E2E** | representative UAT, target flags, slow/offline and assistive technology |
| account/lifecycle | local full-stack account sync plus export/deletion policy tests | **PARTIAL** | one complete auth→export→delete flow and staffed rights process |
| authorization/tenancy | migrations, RLS coverage, capabilities/grants and two-account SQL suites | **STRONG REPOSITORY / TARGET OPEN** | deployed grants/schema export, target role and cross-tenant acceptance |
| integration/provider | contracts, policies, reconciliation and selected adapter tests | **PARTIAL / FIXTURE** | named provider sandbox/target readback, failure and offboarding |
| AI behavior/safety | deterministic guards, source/disclosure and selected live evidence | **PARTIAL** | current model/prompt evaluations, score gate and target kill-switch exercise |
| accessibility | automated axe/labels/focus/contrast/motion/target and browser smoke | **AUTOMATED PARTIAL** | manual keyboard/screen-reader/zoom/device review and qualified assessment |
| responsive/performance | structural width guards, browser viewports and bundle budgets | **PARTIAL** | full device/network/state matrix and privacy-safe field metrics |
| recovery/continuity | logical dump/restore, migration rehearsal, selected rollback tests | **PARTIAL / NON-PRODUCTION** | provider-backup restore, production-safe rollback, measured RTO/RPO |
| monitoring/support | public smoke and status/incident structures | **PARTIAL** | alert delivery/history, staffed rota, channel and tabletop/live exercise |
| security/supply chain | secret/policy guards and scanner workflows | **PARTIAL** | current DAST and independent test; dependency/license decision closure |
| commercial/claims | capability/claim drift and sales-copy guards | **PARTIAL** | counsel/finance/customer approval and live payment/support operation |

## Release interpretation

“Covered” means the cited probe exists and has a current result for the relevant revision. “Partial” is not a pass. Fixture/local/CI, public production and named institutional target are different environments. Customer UAT, counsel decisions, qualified accessibility review and independent security assessment cannot be self-certified by this matrix.

## Evidence state

**Code/config evidence.** The detailed launch plan and repository suites provide a large traceable inventory across product, data and operational boundaries.

**Operational evidence.** The matrix lacks one current exact-SHA aggregate manifest and the external/target artifacts named above.

**Missing test/proof.** Produce the immutable candidate manifest; run every required target/human/external row; attach defects, remediation/retest and authorized acceptance.

## Claim ceiling

Semester may describe a listed area as repository-covered or partial exactly as shown and cite specific dated results.

## Prohibited claims

Do not convert the existence of a test, a historical green result or a partial row into current release, pilot, compliance or enterprise readiness.
