# Disaster Recovery Test Plan

| Control | Value |
| --- | --- |
| Status | **CONTROLLED TEST PLAN — LOGICAL REHEARSAL FILED; PROVIDER/TARGET RECOVERY OPEN** |
| Owner | Harrison Rubin — recovery commander and company-side primary; backup recovery operator and provider/customer witnesses unassigned |
| Evidence date | 2026-10-03 at repository revision `62d37c2f` |
| Existing procedure | [`../../RESTORE.md`](../../RESTORE.md), [`../trust/BACKUP-RESTORE-AND-ROLLBACK-RUNBOOK.md`](../trust/BACKUP-RESTORE-AND-ROLLBACK-RUNBOOK.md) |

## Scenarios

Test accidental row loss/corruption, failed migration, unavailable database, compromised/revoked credentials, lost gateway journal/uncertain external action, unavailable provider/region, broken static deploy, missing secret/configuration, account/tenant offboarding interruption and restoration under legal hold. Keep code rollback, forward schema repair and data restore distinct.

## Provider-backed restore drill

1. Name commander, trained backup, witnesses, target/source identifiers, maintenance scope and safety stop.
2. Read the actual provider backup schedule, retention and PITR state; record recovery point candidate without assuming plan marketing.
3. Create synthetic markers before and after a selected point plus schema/data/policy fingerprints.
4. Restore provider backup/PITR into a separate isolated target—never overwrite production for a drill.
5. Verify expected marker inclusion/exclusion, row counts, schema fingerprints, event triggers, RLS enabled/policies, grants, functions, scheduled jobs, storage, secrets/configuration and application critical flows.
6. Reconcile audit/event/outbox/gateway journal and any uncertain external actions; confirm no live integrations or notifications escaped the isolated target.
7. Measure from declaration through usable verified service; record data-loss interval separately.
8. Exercise communication, read-only/kill switch, support and return/cleanup; remediate and retest failures.

## Acceptance

Recovery is accepted only when data and authorization invariants pass, target application flows work, monitoring/alerts operate, gaps are documented and the authorized owner plus independent/backup witness sign. RTO/RPO remain UNKNOWN until measured on the relevant provider-backed scope. The existing logical one-account rehearsal is not production recovery evidence.

## Evidence state

**Code/config evidence.** Logical dump/restore scripts compare schema, rows, seeded content, event trigger and RLS; guarded deployment and read-only/rollback controls exist.

**Operational evidence.** A logical rehearsal is filed, but provider backup/PITR state, gateway-journal recovery, full service restoration, customer communication and second-operator execution are unproven.

**Missing test/proof.** Assign/train backup, verify provider backup/PITR, implement journal recovery, run isolated provider restore, measure/reconcile all components and obtain witness/customer acceptance.

## Claim ceiling

Semester may say it has a tested logical database rehearsal and a controlled provider-recovery plan, with exact scope and date.

## Prohibited claims

Do not claim production restore, PITR, backup completeness, measured RTO/RPO, zero data loss, full disaster recovery or customer acceptance until the provider-backed drill passes.
