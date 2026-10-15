# How this reference package relates to the rest of registrar/

Your package (`001_registrar_reference.sql`, `002_read_only_checks.sql`, `enrollment.openapi.json`) is the **conservative reference**: an isolated `registrar_ref` schema with no grants, policies or executor. `proposed-schema/100–120` is the **fuller design**. Neither is a production patch.

Adopted from the reference into 120 (13 Oct):
- Grade predecessor must belong to the **same attempt** (composite FK on attempt + id) and carries a sequence number that must match the chain.
- Idempotency is unique **per actor** and keys are 16–200 characters.

Still to do before any production migration (from the cutover PDF):
1. Inspect the repo's existing migrations and deployed tables (the PDF cites `010_platform_core`, `060_command_functions`).
2. Resolve which existing tables own enrollment/grade data.
3. Map reference entities onto them; classify each change additive vs incompatible.
4. Review locks and backfill; rehearse on authorized test data; verify N/N+1.
5. Get exact-target approval.

**Do not copy either schema into production beside the existing one** — that creates a second academic system.

Run (approved fresh test DB only — not run here):
```bash
psql "$APPROVED_TEST_DATABASE_URL" -X -v ON_ERROR_STOP=1 -f 001_registrar_reference.sql
psql "$APPROVED_TEST_DATABASE_URL" -X -v ON_ERROR_STOP=1 -f 002_read_only_checks.sql
```
002 is diagnostic. Zero rows is necessary, not sufficient. RLS proof needs real non-bypass roles (see `migration/reconciliation.yaml` R7).

## Mock validation and production diff (13 Oct)
`mock-validation/`: 10/10 mock scenarios pass on SQLite in memory with mock token checks. That is not PostgreSQL RLS or locking, not JWT verification, not HTTP conformance.

**The live repo already has** `registration_*`, `grade_entries`, `academic_record_entries` and module-mode controls. So `registrar_ref` *and* `proposed-schema/100–120` are duplicate families. The production work is a column / constraint / function / policy / migration-history diff against those tables, on a confirmed target — not a new schema.

Audit fixes applied here: EnrollmentCommand is now `oneOf` add/drop/swap/withdraw with required sets, `minItems`, `uniqueItems`, `additionalProperties:false`; 202 has Location + Retry-After; 401 WWW-Authenticate; 429 Retry-After; body limit; timeout rule; scoped cursors. Still needs real HTTP tests for negative versions, unknown fields, bad UUIDs, duplicates, size limits and credit precision.
