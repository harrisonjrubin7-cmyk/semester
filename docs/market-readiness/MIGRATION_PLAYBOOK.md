# Migration Playbook

**Status: `NOT_STARTED`**

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

## B. Customer data migration (theirs) — does not exist

Bringing a university's existing data into Semester. Nothing supports this.

What it would need:

| Need | State |
| --- | --- |
| Import format definition | None |
| Validation and dry-run | None |
| Provenance on imported fields | None — see `DATA_READINESS.md` |
| Rollback of a bad import | None |
| Reconciliation report | None |

**Dry-run is the non-negotiable one.** An import that cannot be previewed is an
import that gets run once, wrongly, against real student records.

## The rule

Never import data into a tenant without a dry-run that reports what would
change, and never import without recording where each field came from.
