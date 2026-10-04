# The schema contract is proposed, not applied

**Status:** Accepted as a *proposal*. This record exists so nobody mistakes the SQL
for evidence.

## Decision

`docs/platform/schema/platform_primitives.sql` holds the proposed tables, forced RLS
keyed on `app.tenant_id()`, composite tenant-bearing keys, the append-only
hash-chained audit trigger, and the request-context helpers. It lives under `docs/`
and **not** under `supabase/migrations/`. Its header says it has never run against
PostgreSQL; it was parsed for syntax only. A test mirrors every enumeration against
the TypeScript and checks the structural isolation promises table by table. It
becomes migrations in MIGRATION phase 3, one table at a time, each with a
`.check.sql` that walks a second tenant.

## Why

`supabase/check.sh` applies every file under `supabase/migrations/` to a disposable
PostgreSQL 17 and fingerprints the result. PostgreSQL was not available when this was
written, and an unrun migration in that folder is a CI failure waiting for the next
person. The repository's own habit (`CLAUDE.md`) is that a policy is only ever wrong
when a second account is involved — it must be exercised, not read. The honest state
of an unrun contract is "proposed", and the file says so in its first lines.

## What it was chosen over

- **Writing it as migrations anyway:** an untested migration that merges is the
  failure mode `check.sh` exists to prevent.
- **Not writing it:** the isolation design needs a database half to be reviewable;
  mirroring it against the TypeScript keeps it from rotting meanwhile.
- **Redefining the existing outbox and capability tables:** they exist and are held
  by their own check suites (ADR 0002, 0008); the contract reuses them.

## How it is held

`packages/platform/src/schema.test.ts` — 17 enumerations compared with the code; every
tenant-owned table has `tenant_id` first in its key and is in the RLS loop with a
policy per verb, `WITH CHECK` on writes, composite parent keys, fail-closed context
helpers, an append-only chained audit; the header's "PROPOSED … NOT APPLIED" sentence.

## What this constrains

Do not move the file into `supabase/migrations/` without running it on PostgreSQL 17
and writing its check suite. Do not cite any constraint in it as production behaviour.
The audit hash is computed by the application over canonical JSON — jsonb does not
keep JavaScript's key order, so the database enforces the chain's links and
append-only-ness, not the content hash.
