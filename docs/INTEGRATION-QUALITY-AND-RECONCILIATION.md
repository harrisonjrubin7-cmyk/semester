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

## Built (Phase 1a, first slice): the rules, as pure tested code

Beside #779's pipeline in `app/src/lib/integration/`, with no change to what
`ingest` does. Each is pure — storage is handed in or not needed — so the
worker, the dashboard and the tests share one implementation.

| Module | What it decides |
|---|---|
| `drift.ts` | A batch against the adapter's declaration: removed, added, possible rename, type and enum changes. A breaking change holds that entity and recommends `degrade`; it never edits a mapping. Reports keep field names and enum codes, never values |
| `reconcile.ts` | The provider's listing against stored references: matched, pending, mismatch, missing on either side, duplicate, stale, rejected. Exceptions carry redacted references only |
| `duplicates.ts` | Natural-key duplicate candidates for six canonical entities, never across two people; a deterministic suggestion; a merge that records its exact before-state and reverses to it |
| `lineage.ts` | One lineage row per canonical field per mapping version; source-owner rules; freshness breach levels that alert once per change |
| `providers.ts` | Maturity words, and certified/partner claims only with live, person-verified evidence |
| `simulate.ts` | Drift, then `ingest` against an in-memory store, for mock declarations only — refused by the type system and again at run time |
| `mapping-versions.ts` | Propose → simulate → approve (not by the proposer, not if blocked) → live → roll back as a new event |

**Import validation was already built.** #779's `ingest` validates schema,
type, enum, required fields, classification, scope, consent, in-batch
duplicates and timestamp regressions, and turns each failure into a counted,
sanitized error — the quarantine this document planned. Nothing was added
beside it.

**Found while testing:** the first drift detector reported a hold's `reason`
and `amount` as new fields on every run. They are on the never-display list and
dropped by the mapping on purpose, so drift now ignores anything
`namesNeverDisplayed` names. Reporting them would have taught an owner to
ignore the report.

## Built (Phase 1a, second slice): where results are kept, and who may act

`supabase/migrations/20260928040000_integration_quality.sql`, walked by
`supabase/integration-quality.check.sql` (66 checks) and added to
`supabase/integration-rls-matrix.check.sql`'s four-account sweep.

- Ten tables beside #779's, plus `integration_simulation_runs` in the private
  schema, which no API exposes. A reconciliation run hangs off the sync run
  whose `reconciliation_state` column already existed; a mapping version is a
  header over the field rows `integration_mappings` already keeps.
- **Nothing identifying is storable.** A discrepancy's reference must match
  `^sha256:[0-9a-f]{32}$`; drift events hold field names; duplicate candidates
  hold a hash of the key.
- **Nobody records a decision in somebody else's name.** Triggers stamp who
  resolved, acknowledged, decided, reversed, proposed, approved and recorded,
  from `auth.uid()`, whatever the request sent.
- **The workflow is enforced in the database.** A mapping version moves
  proposed → approved → live → retired/rolled back and nowhere else; approval
  needs `integration:approve`, a recorded passing simulation, and somebody
  other than the proposer — checked by trigger *and* constraint, so a person
  holding both capabilities still cannot approve their own. One live version per
  entity. A resolution is reversed once and never rewritten or deleted. Drift is
  acknowledged once.
- New capability `integration:reconcile` for `integration_admin`. Owners are
  set with the existing `source:approve`; provider rows and evidence with
  `platform:configure`.

**Found by the suite:** the first migration's "approved only after a passing
simulation" check was `status = 'proposed' or simulation_verdict in ('ready',
'review')`. With no simulation recorded that is `null`, a check constraint
lets `null` through, and a version could be approved with no simulation at all.
Fixed with an explicit `is not null`; the suite's "approving before a
simulation" case is what found it. Three further planted faults — self-approval,
an unredacted reference, a second acknowledgement — each turned the suite red.

**Found in review (Codex, on #801):** three more holes, each now a check that
failed before its fix. An approver could write a passing simulation and approve
in the *same* update, because the simulation guard ran only while the status
was unchanged — a status change now carries no simulation at all. A resolution
of a three-record group could supersede just one member and leave the group
half-resolved — it must now supersede every member but the kept one, each
once. And the worker had no grant on `integration_simulation_runs`, because a
private table does not inherit the public schema's default grants.

**Next:** wiring drift and reconciliation into the sync worker so it writes
these rows, and the dashboard views that read them.

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
