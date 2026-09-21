# Data Readiness

**Status: `IN_PROGRESS`**

## Migration discipline — strong

35 migrations, versioned and reproducible. `MIGRATION-HISTORY.md` documents the
rules and `supabase/ledger.snapshot` carries a deploy watermark; a new
migration must be numbered above it.

`supabase/check.sh` applies every migration to a throwaway Postgres and runs 17
policy suites. `indexes.check.sql` enforces that every foreign key has a
covering non-partial index, and caught a duplicate-index collision today.

## What today proved about the discipline

Two sessions independently indexed `lti_link_ticket(provisioned_user_id)`,
under two names, within one afternoon — both pending above the watermark, so a
deploy would have applied both. The guard caught it (#660). The lesson is that
**the guard is load-bearing**, and the recurrence — parallel sessions
converging — is not yet closed.

## Missing

- **No tested restore.** A backup is not a backup until a restore has been run.
- **No documented RPO/RTO.**
- **No staging rehearsal** of migrations against the production Postgres version.
- **No source-of-truth provenance** on externally sourced fields.
- **No conflict precedence rules** between institutional, provider, admin, user
  and AI-inferred data.

## Next

Provenance is the prerequisite for integrations: until a field knows where it
came from, no precedence rule can be enforced and lower-confidence data can
silently overwrite authoritative data.
