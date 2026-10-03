# Database Operations Runbook

| Control | Value |
| --- | --- |
| Status | **CONTROLLED RUNBOOK — REPOSITORY REHEARSALS PRESENT; TARGET OPERATIONS PARTIAL** |
| Owner | Harrison Rubin — database and privacy operations primary; backup database operator and customer data authority unassigned |
| Evidence date | 2026-10-03 at repository revision `ccc254d4` |

## Before a database change

Confirm exact project/environment, candidate revision, migration head, schema drift, data classification, tenant scope, RLS/capability impact, expected lock/runtime/storage, backup/recovery point, rollback or forward-fix path, monitoring, maintenance communication and authorized approvers. Never run an unreviewed command against a target selected only by a default profile or unresolved environment variable.

## Operating sequence

1. Export redacted schema, migration list, extensions, grants/RLS, scheduled jobs and capacity/health indicators.
2. Rehearse from zero and from the prior supported state using the intended database version; run all policy, two-account, lifecycle and invariant checks.
3. Freeze or use read-only mode when the change can conflict with device sync or external writes.
4. Apply one reviewed migration at a time; capture start/end, actor, target and result without secrets or student content.
5. Read back migration state, schema, grants/RLS, functions/triggers, jobs and representative authorized/refused paths.
6. Verify application critical flows, audit events, export/deletion coverage and monitoring.
7. Roll back only through a rehearsed safe path. For destructive or irreversible changes, use forward repair or restore under incident control.
8. Close with evidence, anomalies, performance impact and owner acceptance.

## Routine controls

Review privileged access, service accounts, failed auth/query/job patterns, storage/connections, slow queries, index health, retention/legal holds, backup status and restore evidence. Separate provider-backup status from logical dump rehearsal. Never publish RPO/RTO until a provider-backed target restore is measured and accepted.

## Evidence state

**Code/config evidence.** Versioned migrations, zero/upgrade rehearsals, extensive SQL policy suites, logical dump/restore and load scenarios provide substantial repository evidence.

**Operational evidence.** Exact target schema/grants, privileged-access review, provider backup/restore, institutional workload and second-operator execution remain incomplete.

**Missing test/proof.** Export target state, run drift and access review, execute provider-backup restore into isolation, verify all invariants and measure recovery with a trained backup operator and customer authority where applicable.

## Claim ceiling

Semester may describe its migration/policy test coverage and logical database rehearsals with exact dates and environments.

## Prohibited claims

Do not claim production backup validation, point-in-time recovery, measured RPO/RTO, complete least privilege, capacity or institution-approved database operation from local/CI checks alone.
