# Migration and Rollback Runbook

| Control | Value |
| --- | --- |
| Status | **CONTROLLED RUNBOOK — FORWARD-COMPATIBILITY REQUIRED; TARGET REHEARSAL OPEN** |
| Owner | Harrison Rubin — change and rollback authority; backup executor and customer approver unassigned |
| Evidence date | 2026-10-03 at repository revision `ccc254d4` |

## Decision model

Application, Edge Function and database changes are separate surfaces. Re-deploying an earlier application or function does not reverse a database migration. A restore is reserved for irreparable data loss/corruption; it is not a routine schema rollback because it also discards later valid writes.

| Condition | Preferred action |
| --- | --- |
| application regression; schema compatible | redeploy the last accepted immutable revision |
| risky capability isolated by an exercised control | engage the narrow feature/connection/write kill switch |
| unsafe general writes during repair | enable both applicable read-only controls and verify readback |
| schema defect with data intact | ship an additive forward repair |
| irreparable row loss/corruption | isolate writes, preserve evidence and restore to a separate target before cutover |

## Change sequence

1. Record exact candidate revision, target, owner, affected data/tenants, dependency order, success/abort signals and communication path.
2. Classify the change as additive, dual-read/write transition, backfill or destructive. Destructive removal waits until every rollback-compatible version and backfill dependency is retired.
3. Prove a clean rebuild and relevant SQL/application tests in an isolated environment. Compare migration ledger, schema fingerprint, RLS, grants, triggers, jobs and representative records.
4. Apply through the approved target mechanism. Stop on a missing/extra ledger version, unexpected drift, tenant-isolation failure, incompatible reader, failed backfill or unverifiable target.
5. Perform authoritative readback and critical-flow smoke tests. Observe the agreed window before enabling dependent flags or increasing cohort scope.
6. If aborting, engage the narrow safety control, redeploy the prior application/functions when compatible, and use a forward database repair. Record timeline and reconciliation.
7. Close only after integrity/security checks, access cleanup, evidence retention and customer acceptance where required.

## Evidence state

**Code/config evidence.** Migration files, history documentation, database checks, migration-center controls, deploy workflows, application rollback tests and read-only/kill-switch mechanisms exist.

**Operational evidence.** Prior repository and deployment observations exist, but no current exact-candidate target rehearsal proves every migration, rollback, backfill and customer cutover path.

**Missing test/proof.** Reconcile the target ledger; exercise an additive change plus forward repair on a production-like target; verify old/new application compatibility; test flags/read-only and rollback readback; measure the observation window and obtain named approvers.

## Claim ceiling

Semester may describe its additive migration rule, tested repository controls and application rollback mechanism. A specific target result must include revision, environment, time and readback.

## Prohibited claims

Do not claim automatic database rollback, reversible destructive migrations, zero-downtime migration, complete target parity, lossless cutover or customer approval without the corresponding exercise and authoritative evidence.
