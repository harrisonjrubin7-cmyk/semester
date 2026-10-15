# Database Operations Runbook

| Control | Value |
| --- | --- |
| Status | **CONTROLLED RUNBOOK — REPOSITORY CONTROLS PRESENT; TARGET OPERATION PARTIAL** |
| Owner | Harrison Rubin — database and recovery owner; trained backup operator unassigned |
| Evidence date | 2026-10-03 at repository revision `ccc254d4` |

## Operating boundary

Semester's database sources are Supabase/PostgreSQL migrations, checks, policies and recovery scripts in `supabase/`. Repository evidence can establish intended schema behavior and repeatable logical reconstruction. It cannot establish the live project's backup tier, point-in-time recovery setting, current drift, capacity, alert delivery or recoverability without authoritative target readback and an isolated restore.

## Routine controls

1. Before a change, identify environment, project reference, exact revision, migration ledger position, backup/restore state, affected tenants and approver. Never paste secrets into an issue, log or evidence file.
2. Treat migration files as append-only after application. Prefer additive, backward-compatible changes; keep the previously live application able to read the new schema.
3. Run the repository database checks, including migration-center, RLS/grant, tenant-isolation and domain-specific suites relevant to the change. Record command, revision, result and limitation.
4. After application, read back the authoritative migration ledger and the affected schema, policies, grants, triggers, indexes and jobs. A merged file is not evidence that a target accepted it.
5. Monitor privacy-safe health signals: connectivity, failed jobs, query latency, lock/connection pressure, storage growth, migration failures and privileged events. Do not log tokens or record content.
6. On suspected data loss or unsafe writes, stop affected writes with the narrowest verified flag or read-only control, preserve evidence and choose forward repair, application rollback or isolated restore deliberately.
7. After recovery, reconcile counts/fingerprints and security controls, restore non-database configuration separately, revoke temporary access and document the decision.

## Recovery and maintenance

`supabase/restore.sh` is a logical rehearsal; `supabase/restore-drill.sh` supports an isolated target drill. Neither proves provider-managed backup restoration. Confirm retention and PITR in the owning dashboard, restore outside production, verify data plus `ensure_rls` and RLS enablement, measure recovery point/time and remove the temporary target under the approved retention decision.

Maintenance that can block or rewrite data requires a change window, backup/forward-repair decision, abort threshold, communication owner and post-change readback. Direct production SQL is emergency-only, least-privilege and recorded; reconcile it into migration history immediately.

## Evidence state

**Code/config evidence.** Versioned migrations, broad SQL checks, schema fingerprints, logical restore scripts, RLS/grant controls and migration-center checks exist.

**Operational evidence.** A logical rehearsal exists, but current provider backup/PITR configuration, a retained target restore, measured RTO/RPO, live capacity trends and a trained backup operator are not established here.

**Missing test/proof.** Capture current target configuration and ledger readback; run an isolated provider-backed restore and security/integrity comparison; exercise write stop, forward repair and operator handoff; validate alert delivery; obtain customer approval where institutional data is involved.

## Claim ceiling

Semester may say it maintains versioned database controls and logical restore procedures with repository tests. It may report only dated, scoped drill results actually preserved as evidence.

## Prohibited claims

Do not claim continuous backup, PITR, measured RTO/RPO, zero data loss, production-scale capacity, complete migration application or institutional recovery readiness from repository files alone.
