# Migration Playbook

**Status: `IN_PROGRESS`** — Part A is in force. Part B has an evidence path and a staging foundation; **no production load path exists for any domain.**

Two different things are called migration. Keep them apart.

## A. Schema migration (ours) — strong, documented

See `DATA_READINESS.md` and `MIGRATION-HISTORY.md`. Rules in force:

- Numbered above the `supabase/ledger.snapshot` watermark
- Never amend a migration that has shipped; write a new one
- `supabase/check.sh` applies all of them to a throwaway Postgres and runs the
  policy suites
- Every foreign key needs a covering non-partial index (`indexes.check.sql`)

**The open recurrence:** parallel sessions converge and produce duplicate
migrations. This happened today — two indexes on one column, under two names,
both pending. The guard caught it; the recurrence is not closed.

## B. Customer data migration (theirs) — evidence path built; no load path

Bringing a university's existing data into Semester. Read off `main` on 4 October
2026 (`2b97e60`). Two things exist, and neither moves data into live Semester
objects for any domain:

- **The Migration Center** (D-144; `supabase/migrations/20260929200000_migration_center.sql`,
  `app/src/lib/migration/center.ts`; behind `migrationCenter`, off by default).
  Twelve gated stages from source inventory to post-cutover monitoring. A sample
  is mapped, validated and reconciled **in the browser**; what is recorded is
  counts and the file's SHA-256, never a record. It proves a mapping works and a
  file reconciles. It loads nothing.
- **Roster staging** (D-160; `supabase/migrations/20260930220000_roster_import_staging.sql`).
  A server-only foundation: stage, validate against a manifest, reconcile,
  promote (held for a different approver when it would remove more than the
  threshold, 10% by default), and roll back the most recent promotion. Four
  closed entities (`orgs`, `users`, `classes`, `enrollments`). It has no OneRoster
  client, makes no network call, and **nothing reads `roster_current`**.

| Need | State |
| --- | --- |
| Import format definition | Rosters only: a manifest of files, row counts and a content digest. None for any other domain |
| Validation and dry-run | Built for rosters (`roster_validate`, `roster_reconcile` report what would change before `roster_promote`) and, as browser-side evidence, for any domain in the Migration Center |
| Provenance on imported fields | **None** — see `DATA_READINESS.md` |
| Rollback of a bad import | Rosters: `roster_rollback`, most recent promotion only. Migration Center: a written rollback plan is required before cutover, and is text, not a tested mechanism |
| Reconciliation report | Counts of missing, extra and differing rows in the Migration Center; `roster_reconcile` for rosters |
| A production load path for any domain | **None** |

**Dry-run is the non-negotiable one.** An import that cannot be previewed is an
import that gets run once, wrongly, against real student records. For rosters it
now can be; for every other domain it cannot, because there is no import.

The procedure, the per-stage gates and the ten requirements a load path must meet
before production are in
[`../institutional-implementation/MIGRATION-WORKBOOK.md`](../institutional-implementation/MIGRATION-WORKBOOK.md).
Do not say Semester supports OneRoster or any SIS migration: `EDT-6` stays
`NOT_STARTED` until a real import has run against a real sandbox.

## The rule

Never import data into a tenant without a dry-run that reports what would
change, and never import without recording where each field came from.
