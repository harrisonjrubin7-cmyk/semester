# Migration and Rollback Runbook

| Control | Value |
| --- | --- |
| Status | **CONTROLLED RUNBOOK — AUTOMATED REHEARSAL PARTIAL; PRODUCTION ROLLBACK UNEXERCISED** |
| Owner | Harrison Rubin — release and migration commander; backup operator and customer change approver unassigned |
| Evidence date | 2026-10-03 at repository revision `ccc254d4` |

## Migration classes

Classify changes as additive/compatible, backfill, behavioral/configuration, contract/removal or emergency. Prefer expand → deploy compatible readers/writers → backfill/reconcile → verify → contract in a later release. Destructive change, authority change, tenant-scope change, provider migration or irreversible transformation requires explicit recovery design and target rehearsal.

## Procedure

1. Record source/target versions, affected data/journeys, authority and compatibility window.
2. Define preconditions, validation queries, estimated load/locks, pause/read-only rule, backup/recovery point and stop thresholds.
3. Rehearse from representative prior state and from zero; test interruption, rerun/idempotency, old/new application compatibility and RLS/lifecycle invariants.
4. Obtain release/data/security/privacy/customer approvals appropriate to scope.
5. Apply under monitoring; stop on unexpected drift, lock/latency, invariant failure, authorization change or reconciliation mismatch.
6. Read back target state and complete critical flows plus negative authorization tests.
7. If safe, roll back the application/configuration first. Roll back schema/data only when explicitly rehearsed; otherwise disable writes and forward-fix or restore under incident command.
8. Reconcile records and close with timings, outcome, residual risk and approver acceptance.

## Evidence state

**Code/config evidence.** Ordered migrations, CI migration rehearsal, logical restore, guarded Pages release and read-only/feature controls support rollback-friendly delivery.

**Operational evidence.** Production read-only, application rollback, provider-backup restore and named institutional migration have not been exercised end to end with a second operator.

**Missing test/proof.** Run an immutable-candidate target rehearsal, engage/verify/release read-only, roll back to a prior artifact, restore isolated provider backup, reconcile data/authorization and record second-operator/customer acceptance.

## Claim ceiling

Semester may describe its repository migration pattern and exact rehearsed local/CI behavior.

## Prohibited claims

Do not claim zero-downtime migration, tested production rollback, lossless recovery, backward compatibility for every version or customer-approved cutover without the complete target record.
