# Semester release management policy — controlled draft

- **Status:** `PARTIAL / REPOSITORY-CONTROLLED`
- **Owner:** Harrison Rubin, Engineering/Operations primary; backup `UNASSIGNED`
- **Evidence date:** 2026-10-03
- **Scope:** application/site, Edge Functions, database migrations, configuration, flags and institutional gateway

## Release lifecycle

1. Select a named candidate commit and freeze exact scope, artifacts, migrations, dependencies, configuration and known issues.
2. Verify change approvals and run required type, lint, test, policy, accessibility, build, supply-chain and security gates without weakening assertions.
3. Generate/retain release evidence including commit, artifact, dependency/SBOM and environment configuration; record failed, skipped or unavailable gates.
4. Confirm backward compatibility, migration order, rollout/flag/kill-switch plan, rollback or forward-fix path, monitoring, support and incident owners.
5. Deploy through approved automation with least privilege; verify the target environment and critical journeys rather than inferring success from a workflow status.
6. Monitor and decide continue, pause, disable, roll back or forward-fix. Preserve decision, timestamps, evidence and customer/public communication where applicable.

## Control and evidence map

| Surface | Code/config evidence | Operational evidence | Status | Owner | Missing test/proof |
| --- | --- | --- | --- | --- | --- |
| static app/site | Pages build/deploy workflows, tests and smoke checks | live deployments observed; complete release acceptance record not standardized | `PARTIAL` | Engineering/Operations | immutable release manifest and owner sign-off |
| Edge Functions | deployment workflow and function tests | target configuration/secret/route verification incomplete | `PARTIAL` | Engineering/Security | representative target release/rollback |
| database | migrations, policy suites, ledger/order checks | dashboard integration and forward-only risk require current evidence | `PARTIAL` | Data/Engineering | failed migration and compatible rollback drill |
| institutional gateway | separate type/tests and deployment design | no named-tenant production gateway | `CONDITIONAL` | Engineering/Customer | target deployment and UAT |
| flags/kill switches | registry and evaluation tests | target cohort rollout and kill-switch drill partial | `PARTIAL` | Product/Operations | full activation/disable/recovery record |

## Release record

`[RELEASE ID/VERSION]`, commit/artifact hashes, SBOM/lockfiles, scope/exclusions, migrations/config/providers, evidence/results, known issues/residual risk, approvals, environment, rollout/cohort, deploy events, verification, telemetry/support, rollback/forward-fix, communication and closeout.

## Claim ceiling and blockers

Permitted: “Semester has automated builds, extensive repository gates, deployment workflows and rollback mechanisms for defined surfaces.” Prohibited: continuous delivery maturity, every release fully verified, signed provenance, zero downtime/data loss, database rollback, or named-tenant production readiness. Blocks: approved release authority, immutable manifest/attestation, target configuration and smoke/security evidence, migration compatibility, monitoring/alerting/support, exercised rollback/forward fix, owner backup, no open P0/P1 and signed GO.
