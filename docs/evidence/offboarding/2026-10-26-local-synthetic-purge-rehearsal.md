# Synthetic school-purge rehearsal on isolated PostgreSQL 17 — 26 October 2026

## Scope and isolation

This is a source-level behavioral receipt for commit
`f30edcde0bd9b6526b19a34c513f53ce305f8dd2`. It was run at
`2026-10-26T21:42:49Z` against PostgreSQL 17.11 in a new random temporary
cluster created by `supabase/check.sh`. The cluster accepted connections only
through its temporary Unix socket, was removed by the harness cleanup trap, and
contained synthetic fixtures only. No Supabase project, shared database,
preview database, staging database, production database or real tenant was
connected to or changed.

The exact command was:

```sh
PATH=/tmp/semester-pg17-runtime-ssl-aea33fad/bin:$PATH \
LC_ALL=C LANG=C SEMESTER_CHECK_REAPPLY=1 \
bash supabase/check.sh offboarding-purge-rehearsal
```

## Receipt

```text
postgres (PostgreSQL) 17.11
✓ every migration applied
✓ every other migration applied twice; the schema and the rows in 425 tables are unchanged
✓ offboarding-purge-rehearsal.check.sql — 23 checks
· every policy check passed
```

The named suite is enclosed in one transaction and ends with `rollback`. It
verified the forward migration and reapplication path, capability/feature/
entitlement/adapter gates, synthetic queue and worker execution, exact replay,
cross-operator replay refusal, cross-tenant approval refusal, manifest tamper
refusal, kill-switch interruption before fixture deletion, explicit operator
stop, bounded fixture deletion and deterministic restore, retry behavior,
unchanged tenant rows, immutable receipts and audit evidence.

The first execution exposed two assertions in the new test fixture rather than
a migration or authorization bypass: the stranger received the narrower
platform-operator refusal, and the alternate replay actor did not hold the
test-only capability needed to reach the replay guard. The fixture now expects
the precise refusal and assigns the synthetic capability to the test platform
operator role. The production migration still assigns
`offboarding:purge-rehearse` to no role by default.

## Boundary

This proves only the repository migrations and rollback-only synthetic behavior
on isolated local PostgreSQL 17. It is not target-environment acceptance, a
hosted Supabase rehearsal, an independent-human rehearsal, a live adapter, a
real-tenant preview or a deletion exercise. No public or tenant record was a
purge target. I13 therefore remains `untested` and `preview` for release
readiness.
