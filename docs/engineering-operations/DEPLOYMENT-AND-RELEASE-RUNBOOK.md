# Deployment and Release Runbook

| Control | Value |
| --- | --- |
| Status | **CONTROLLED RUNBOOK — PUBLIC PATH AUTOMATED; TARGET RELEASE/ROLLBACK ACCEPTANCE PARTIAL** |
| Owner | Harrison Rubin — release commander and company-side deploy owner; backup operator and customer approver unassigned |
| Evidence date | 2026-10-03 at repository revision `0462206f` |

## Release rule

Release the exact immutable candidate that passed the required gates. A green local command, merged branch, uploaded artifact, successful workflow and verified live revision are separate evidence states. Any P0/P1, missing required seat/signature, unknown target configuration, failed recovery path or unsupported claim is a NO-GO for the affected motion.

## Standard sequence

1. Freeze scope; name candidate revision, environment/tenant, cohort, release commander, backup, approvers and rollback owner.
2. Reconcile changes, migrations, dependencies, flags, public configuration, secrets ownership, claims and known limitations.
3. Run the scope-appropriate type, lint, deterministic/full/shuffle, build, database, browser, accessibility, security, dependency/license and migration/restore checks. Record skips and failures as failures, not passes.
4. Create the immutable artifact and evidence manifest; verify candidate/artifact identity.
5. Confirm backup/recovery point, rollback target, monitoring, alerts, status/support channels, incident path and feature kill switches.
6. Obtain required GO or GO WITH CONDITIONS with scope, expiry and reversal triggers. No P0/P1 may be waived.
7. Deploy the passed candidate. Apply database changes in the approved order; stop on unknown drift.
8. Read back deployed revision, configuration fingerprint, migration state, flags and public behavior. Run critical smoke and target authorization checks.
9. Observe the agreed stabilization window. Roll back or disable on a stop condition; do not debug a harmful release in place.
10. Close the record with outcome, incidents, residual risks, evidence links and customer acceptance where applicable.

## Public Pages path

The Pages workflow normally runs only after successful CI on `main` and checks out the triggering CI head SHA. A manual dispatch is an exceptional path and requires an explicit decision record because it can bypass that dependency. The deploy must still verify checked-out SHA, current-main ancestry when relevant, artifact identity and live asset/readback.

## Stop and rollback

Stop on unauthorized/cross-tenant access, suspected secret exposure, data loss, misleading official-state success, critical accessibility barrier without equivalent path, unavailable monitoring/support, failed migration/readback, unexpected target/configuration, open P0/P1 or false public claim. Prefer the smallest safe action: kill switch, read-only/degraded mode, prior artifact, migration rollback where proven, traffic hold, or full incident process.

## Evidence state

**Code/config evidence.** CI-gated Pages deployment, pinned workflow actions, build-input checks, release gates, smoke workflows, flags and rollback procedures provide a strong repository foundation.

**Operational evidence.** A public production smoke is filed. No complete immutable release record proves every required check for the current candidate; production rollback/restore, named backup operation, institutional cutover and customer acceptance remain unexercised.

**Missing test/proof.** Reconcile the contradictory full-suite records, run the immutable candidate matrix, verify current CI/deployment SHA and live readback, exercise production-safe rollback/restore with a second operator, and obtain target/customer approvals.

## Claim ceiling

Semester may say the public Pages path is CI-gated and cite a specific verified deployment/smoke. It may call a release complete only for the exact environment and evidence record.

## Prohibited claims

Do not claim continuous-delivery safety, zero-downtime release, tested production rollback/restore, institutional deployment or GA readiness from workflow definitions alone.
