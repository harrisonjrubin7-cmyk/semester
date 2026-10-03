# Test Strategy

| Control | Value |
| --- | --- |
| Status | **CONTROLLED STRATEGY — BROAD AUTOMATION; HUMAN/TARGET/EXTERNAL EVIDENCE PARTIAL** |
| Owner | Harrison Rubin — engineering quality and release-test owner; backup test lead and customer UAT owner unassigned |
| Evidence date | 2026-10-03 at repository revision `0462206f` |

## Evidence ladder

| Level | Purpose | What it cannot prove alone |
| --- | --- | --- |
| static/guard | types, source rules, generated consistency and prohibited patterns | runtime behavior or user success |
| unit/property | deterministic domain rules, boundaries and state transitions | integration configuration or rendered usability |
| component/accessibility | DOM behavior, names/roles/states and focused interaction | complete route, device or assistive-technology behavior |
| database/policy | schema, migrations, RLS, roles, isolation and lifecycle | deployed grants, provider behavior or customer acceptance |
| contract/integration | gateway/adapters, authentication, failure and replay contracts | actual target-provider approval/readback unless run there |
| browser/critical flow | production build and user journey across state and viewport | qualified human accessibility, field reliability or institutional operation |
| recovery/load/security | failure, concurrency, restore and adversarial controls | production RTO/RPO, capacity or independent assurance without target execution |
| UAT/operational | representative people, actual scope, support and decision evidence | broad repeatability beyond the tested scope |

## Risk-based requirements

Every change tests the smallest deterministic layer and all affected boundaries. Authorization, privacy, data lifecycle, consequential actions, payments, AI, integration, accessibility, recovery and tenant scope require negative/failure tests. A passing happy path without refusal, stale/offline, recovery and authority cases is incomplete.

Critical tests must have a control demonstrating they can fail. Fix flaky tests or quarantine them with owner, issue, scope and expiry; repeated reruns are not evidence. Preserve exact revision, command, runtime, configuration, seed/fixture, totals, duration and artifacts. Keep personal or customer data out of fixtures unless specifically approved.

## Promotion rule

Internal evidence may advance a feature to design-partner evaluation only with bounded scope, direct observation, support and reversal. Pilot requires target configuration, representative roles, signed UAT, accessibility and operational gates. General availability requires repeated outcomes and current external/operational evidence.

## Evidence state

**Code/config evidence.** The repository has extensive unit/component/guard, database/RLS, browser smoke, accessibility, restore/load and launch-readiness suites.

**Operational evidence.** No single current manifest reconciles all suites and skips for the immutable candidate. Qualified assistive-technology review, named-customer UAT, production recovery, external penetration test and field outcome evidence remain absent.

**Missing test/proof.** Execute the candidate matrix, close or classify failures, run manual accessibility and representative usability, validate target roles/isolation/integration/recovery, and obtain signed customer acceptance for activated scopes.

## Claim ceiling

Semester may say it has a layered risk-based test strategy and cite exact suite results. Test coverage is described by behavior and boundary, not by an unsupported quality percentage.

## Prohibited claims

Do not claim full coverage, absence of defects, user validation, WCAG conformance, penetration-test completion, production resilience or customer acceptance from automated tests alone.
