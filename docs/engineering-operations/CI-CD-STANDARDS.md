# CI/CD Standards

| Control | Value |
| --- | --- |
| Status | **CONTROLLED STANDARD — SUBSTANTIAL AUTOMATION; AGGREGATE/CANDIDATE EVIDENCE REQUIRES RECONCILIATION** |
| Owner | Harrison Rubin — CI/CD and release-evidence owner; backup maintainer unassigned |
| Evidence date | 2026-10-03 at repository revision `0462206f` |

## Required controls

- Pin third-party actions to reviewed immutable revisions and keep permissions least-privilege.
- Install from the committed lockfile with the supported runtime; fail on lock drift.
- Run independent type coverage for application, institution gateway and any separately configured package.
- Enforce lint, terminology, accessibility, style, secret/claim and generated-manifest guards.
- Run deterministic tests plus an order/shuffle signal; preserve structural isolation tests rather than relying on repeated green runs.
- Build production output and enforce bundle budgets.
- Rehearse migrations from zero and upgrades against the intended database version; run RLS and two-account suites.
- Exercise critical browser flows at representative viewports and the local full stack where required.
- Scan secrets, dependencies/licenses and the running candidate when runtime/credentials exist; record unavailable checks as open.
- Upload bounded evidence with revision, commands, environment, pass/fail/skip totals and retention/access controls.
- Deploy only the CI-passed candidate, then verify live revision and behavior.

## Branch and exception policy

Required checks may not be bypassed by relabeling a failure as advisory. An advisory dependency step is a documented residual risk, not a passing security gate. A manual release, rerun, accepted flaky result or temporarily disabled test requires owner, reason, scope, expiry, issue and compensating evidence. No exception may waive a P0/P1 or customer-controlled approval.

## Evidence state

**Code/config evidence.** The repository contains broad CI jobs for type/lint/test/build, database migrations/RLS, local full-stack account sync, smoke/accessibility, budgets, restore/load and guarded Pages deployment. A HawkScan workflow exists.

**Operational evidence.** Repository workflows do not prove the current candidate's aggregate result, external scanner execution, production configuration, artifact provenance retention or alert delivery. Current Hawk runtime and API key are unavailable in this workspace.

**Missing test/proof.** Run and retain one exact-SHA candidate matrix, reconcile red versus green historical claims, confirm required-branch checks, verify artifact/SBOM/provenance retention, execute DAST when runtime/key exist and validate deploy/live SHA ancestry.

## Claim ceiling

Semester may describe the checks defined in CI and cite exact completed workflow results. An individual green job is evidence only for that job and revision.

## Prohibited claims

Do not claim a green release, secure pipeline, complete supply-chain assurance, deployed candidate or GA approval from configured workflows or partial job results alone.
