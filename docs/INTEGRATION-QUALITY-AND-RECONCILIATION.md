# Integration quality and reconciliation

Part 1 of the expansion command, items 1, 7 and 8: the reconciliation
dashboard, safe fallback states, and import validation with duplicate
resolution. Phase 1a. **Waits for #779.** Nothing here is built yet.

Companion documents: [schema drift](SCHEMA-DRIFT-AND-CONTRACT-TESTING.md),
[lineage and freshness](FIELD-LINEAGE-AND-SOURCE-FRESHNESS.md),
[simulation](SYNC-SIMULATION-SANDBOX.md),
[tenant mapping](TENANT-MAPPING-CONFIGURATION.md),
[providers](PROVIDER-MATURITY-CERTIFICATION-PARTNERSHIPS.md).

## What exists on main

- `app/src/lib/reconcile.ts` compares the app's dates against the LMS and
  reports what moved. It is the student-scale version of reconciliation, and
  its `Report` shape is the vocabulary the staff dashboard should reuse.
- `app/src/lib/changeset.ts` diffs new course material against what the student
  has (`Verdict`). `app/src/lib/merge.ts` merges two devices per field.
- `app/src/lib/import-review.ts` and `app/src/lib/schoolpack.ts` (`PackProblem`)
  validate a school pack before it is accepted.
- `app/src/lib/university.ts` has `reconcileInstitutionAction` against the
  school gateway in `app/server/institution/gateway.ts`.
- `app/src/lib/control-plane.ts` already says "connected but degraded".

## In flight

[#779](https://github.com/harrisonjrubin7-cmyk/semester/pull/779) adds the
tables this part hangs from: `integration_connections`, `integration_sync_runs`,
`integration_sync_errors`, `integration_dead_letter_events`, `source_records`,
`source_snapshots`, `source_freshness_events` and
`canonical_entity_references`, plus `lib/integration/pipeline.ts`,
`redact.ts` and `freshness.ts` with its seven `Freshness` states and
`isOfficialCurrent`.

## Entity plan

| Command entity | Decision | Why |
|---|---|---|
| `reconciliation_runs` | **New**, one row per run, referencing `integration_sync_runs` | Counts by status (matched, pending, mismatch, missing, duplicate, stale, rejected, needs review) as columns |
| `reconciliation_items` | **Not a table** | A row per matched record duplicates `source_records`. Only the exceptions are stored |
| `reconciliation_discrepancies` | **New** | The exceptions, with assignee, status, suppression reason and audit |
| `import_batches` | **New** | Manual imports (school packs, CSV) have no sync run to hang from |
| `import_validation_results` | **Reuse** `integration_sync_errors` + `integration_dead_letter_events` (#779) | Quarantine with redacted diagnostics is what the dead-letter table is for |
| `duplicate_candidates` | **New** | Nothing like it exists |
| `duplicate_resolution_actions` | **New**, append-only | A merge must be reversible, so each resolution stores what it replaced |

## Capabilities and flags

- Reuse `catalog:sync` for running reconciliation; add **`integration:reconcile`**
  for working discrepancies, granted to `data_steward` and school integration
  staff at `school` scope.
- Flag `module.integration_quality`, `off`, in #779's flag registry.

## Hard boundaries

- The dashboard shows counts and sanitized identifiers by default. Drilling into
  one student's record requires the capability at that school's scope and is
  itself audited.
- A stale or estimated record is never shown to a student as current official
  data: every student surface decides "official" through #779's
  `isOfficialCurrent`, never locally.
- A source that fails keeps the student's existing work visible, labelled with
  its freshness, with the official source link and a support route.
- A duplicate merge never deletes the losing record; it is marked superseded and
  can be restored.

## Tests

- Reconciliation over a fixture with one of each status produces the right
  counts; a mismatch opens a discrepancy; resolving and re-running closes it.
- Import validation rejects each failure class (schema, tenant, missing field,
  bad timestamp, dangling reference) into quarantine with no raw value in the
  diagnostic.
- Duplicate merge then reversal restores both records byte-for-byte.
- `.check.sql`: a student cannot read another student's discrepancy; a
  steward at school A cannot read school B's.
