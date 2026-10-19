# Semester backup, restore, and rollback runbook — controlled draft

- **Status:** `PARTIAL / LOGICAL REHEARSAL ONLY`
- **Owner:** Operations owner with Security, Data, Engineering, Privacy, and customer authority
- **Evidence date:** 2026-10-03

## Choose the safe path

| Failure | Path |
| --- | --- |
| application or function release is wrong; stored data/schema remain sound | roll back compatible application/function artifact; do not restore data |
| schema change is wrong but current data can be preserved | prefer reviewed forward-compatible repair; application rollback does not reverse schema |
| rows/files are lost or corrupted and cannot be reconstructed safely | isolate writes, preserve evidence, approve restore/reconciliation into an isolated target first |
| provider/integration state is uncertain | pause writes, compare authoritative state, reconcile with idempotency and receipts; do not replay blindly |

## Restore procedure

1. Open incident/change record; name commander, restore operator, independent verifier, data/privacy/security/customer decision owners, scope, source, target, stop conditions, and communication plan.
2. Stop or isolate unsafe writes; preserve logs, audit, backups, configuration, and candidate evidence. Do not overwrite production for a drill.
3. Verify backup/PITR source time, retention, encryption/access, integrity, affected systems, expected data gap, legal holds/deletions, files/storage, secrets, jobs, and external dependencies.
4. Restore into a disposable isolated target. Record start/end, provider steps, versions, size, failures, manual interventions, and cost.
5. Validate schema fingerprints, migrations, triggers, RLS/policies, counts and sampled records, tenant isolation, authentication, audit continuity, files, secrets, jobs, deletions/holds, integrations, core journeys, monitoring, and rollback.
6. Determine reconciliation/replay from the recovery point to current authoritative state. Prevent duplicate writes and reapply deletions/retention actions that a backup may resurrect.
7. Obtain accountable approval before cutover; communicate impact and measured gap honestly; preserve old state until rollback expiry.
8. After cutover, monitor, close reconciliation, securely dispose of temporary copies, update measured RTO/RPO for this scope only, and track corrective actions.

## Control and evidence map

| Control | Code/config evidence | Operational evidence | Status | Owner | Missing test/proof |
| --- | --- | --- | --- | --- | --- |
| logical rehearsal | `supabase/restore.sh`, CI path, fingerprint/RLS/data controls | [2026-09-30 rehearsal](../evidence/restore/2026-09-30-logical-rehearsal.md): disposable PostgreSQL 17, one seeded account | `VERIFIED — LIMITED` | Engineering | current candidate and representative volume |
| provider backup/PITR | procedure and evidence fields in [`RESTORE.md`](../../RESTORE.md) | live provider backup restore explicitly not completed | `UNVERIFIED` | Operations | dashboard evidence and isolated timed restore |
| rollback | deployment workflows and [`ROLLBACK.md`](../../ROLLBACK.md) | selected page rollback timings; schema remains forward-only | `PARTIAL` | Engineering/Operations | witnessed current target app/function rollback |
| validation/reconciliation | database checks, tenant policies, idempotent integration designs | full provider/files/secrets/jobs/deletion/hold validation absent | `PARTIAL` | Data/Security/Privacy | executed target checklist and customer readback |
| operator resilience | written procedures | second trained operator and access unproven | `BLOCKED` | Executive/Operations | independent operator drill and access review |

## Claim ceiling and activation blockers

Permitted: “Semester has tested logical dump/restore tooling on a disposable one-account database and documented target restore/rollback controls.” Prohibited: production backup restored, PITR verified, recovery time/point promised, zero data loss, complete backup coverage, or independently operated recovery. Blocks: target provider backup/PITR settings and retention; cost decision; isolated real-backup restore; representative data/volume; second operator; files/secrets/jobs coverage; deletion/hold replay; integration reconciliation; full security/core-journey validation; measured scope-specific RTO/RPO; and signed cutover/cleanup evidence.
