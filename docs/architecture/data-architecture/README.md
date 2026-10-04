# Semester data architecture

Canonical entity model, provenance, lifecycle governance, analytics, search, AI data access and
integration data contracts. Written as the Principal Data Architect deliverable against `origin/main`
at `7287ddc` (4 October 2026).

**Status: proposal.** Nothing in this directory is a migration, nothing here changes the schema, and
nothing here is applied. The SQL under [`sql/`](sql/) is validated against a database built from all 171
migrations on PostgreSQL 16 and is held there by tests that have been shown to fail (below). Applying any of
it to a project needs the owner's approval, per [`../../DATA-MIGRATION-PLAN.md`](../../DATA-MIGRATION-PLAN.md).

## Read this first: what already exists

This repository is not a blank sheet. Before writing, `main` was searched for the thing itself
(CLAUDE.md, "Check main before you start"). The following already exist and are **built on, not restated**:

| Area | Already on main | This work adds |
| --- | --- | --- |
| Graph and authority | [`unified-education-graph.md`](../unified-education-graph.md), [`native-baseline-and-connected-mode.md`](../native-baseline-and-connected-mode.md), `tenant_module_mode` (`core`/`connect` per module) | Concrete precedence as data, a three-way enrollment reconciliation, the gap list in [01](01-canonical-entity-model.md) and [02](02-source-of-truth-matrix.md) |
| Classification | `data_classification_rules` (T0–T6), [`DATA-STEWARDSHIP.md`](../../operating-model/DATA-STEWARDSHIP.md) | A per-table registry and the finding that T0–T6 is never consulted at AI call time ([09](09-ai-data-access.md)) |
| Retention | [`RETENTION.md`](../../../RETENTION.md) (two-way tested), the "until you delete it" promise in `lib/privacy.ts` | The owed outbox sweep, proposal 03; a class model that cannot break the promise ([05](05-lifecycle-governance.md)) |
| Erasure, export, holds | `private.account_data_map()`, `erase_account`, `legal_holds`, hold-aware sweeps, ledger chains | A tenant data manifest and an executable restore follow-up (proposal 04) |
| Events | ADR 0008, `private.domain_outbox_events`, `EVENT_TYPES` | A registry, the classification mapping, the sweep ([04](04-events-and-lineage.md)) |
| Integration quality | reconciliation runs, schema fingerprints and drift, freshness events, roster staging, migration center | Rule layer for Semester's own tables; findings on what is not wired ([07](07-data-quality-and-migration.md)) |
| Search | `lib/find.ts`, ADR 0006 | The server-side counterpart ADR 0006 and `multi-tenant-isolation.md` call for ([08](08-search-and-retrieval.md)) |

## Headline findings (all measured; method in [`appendix/`](appendix/))

Measured on the schema produced by applying the 171 migrations: **348 tables** (319 `public`, 29 `private`).

| # | Finding | Measure |
| --- | --- | --- |
| 1 | The checked-in inventory is stale. | `docs/DATA-INVENTORY-AND-LINEAGE.md` says 302 `public` tables; the migrations build **319**. |
| 2 | Source metadata is the exception. | 41 of 348 tables carry any source column; 9 carry a classification column; 28 carry any lifecycle-end column. |
| 3 | No precedence engine exists. | Precedence is a display label per provider domain (`catalog.ts` `SOURCE_OF_TRUTH`). The only automatic conflict rule is `timestamp_regression`. |
| 4 | Three tables each say "enrollment" with different authority. | `enrollments` (student-declared, drives classmate visibility), `registration_enrollments` (registrar workflow), and `canonical_entity_references` type `enrollment` (SIS). |
| 5 | Tenant integrity has gaps. | 38 tables carry `tenant_id` with no foreign key to `schools` (34 of them `NOT NULL`); 19 `tenant_id` columns are nullable. `schools` rows are never deleted (trigger), so the missing keys cost nothing to add. **Of 87 foreign keys between two tenant-scoped tables, 35 are single-column**, so the schema allows a row in one tenant to reference a parent in another (shown with a real pair of rows; whether a client can reach it depends on each definer function). The other 52 are composite and impossible to cross. |
| 6 | Naming is inconsistent. | Tenant key is `tenant_id` on 139 FKs and `school_id` on 8; owner key is `user_id` (59), `student_id` (16), `student` (8), `owner_id` (7), `subject` (5), `person_id`. |
| 7 | The student's core data is untyped blobs. | `state`, `courses`, `notes`, `tasks`, `sittings`, `appointments`, `productivity_workspace` are `(user_id, id, data jsonb, updated_at, deleted_at)`: no tenant, source, classification or typed due date. |
| 8 | Timestamps are not universal. | Of 84 tables a client role can `UPDATE`, 39 have no `updated_at` and 41 have no creation timestamp. |
| 9 | All indexes are btree. | 1,022 indexes, 0 GIN/GiST/trigram/vector. Search is client-only; people, listings, reviews, dining and community are not searchable. |
| 10 | Nothing is partitioned. | 0 partitioned tables; every retention window is a row-by-row delete. |
| 11 | The AI path does not consult classification. | `data_classification_rules` is read only by policy simulation and connector ingestion, never when context is assembled. `approved_source` has no classification or per-person scope; `consentIds: []` is hard-coded; no AI code mentions age or guardian. |
| 12 | The outbox has no sweep. | RETENTION.md and ADR 0008 say so; confirmed, no job or function touches `domain_outbox_events` / `domain_event_receipts`. |
| 13 | Drift detection is coarser than its documents say. | `drift.ts` fingerprints a whole batch with a 32-bit non-cryptographic hash. That is fine for accidental drift (a missed change is about 2^-32 per comparison) and unusable as integrity evidence; the real gaps are per-batch rather than per-object-and-version granularity, and that breaking drift only *recommends* `degrade`. |
| 14 | Freshness SLAs live in two unlinked places. | `data-contracts.ts` (hours) and `integration_source_owners` (minutes). |
| 15 | Recovery is unmeasured. | No restore drill has touched production data; PITR unconfirmed; RPO and RTO are deliberately unpublished. |
| 16 | A block does not hide a profile. | Only 2 policies in the schema mention `blocks` (`messages`, `message_reactions`); `profiles` is visible to any classmate with `age_cleared`, so a blocked classmate still reads the blocker's handle and `about`. Search closes it for the new index (proposal 06). |
| 17 | Three deleting sweeps ignore legal holds. | Of 22 deleting functions named like sweeps/purges/erasures, 6 are hold-aware, 11 are reached only through the hold-checking erase wrapper, 2 are ephemeral, and **3 are neither**: `gateway_purge_journal`, `purge_financial_records`, `sweep_tombstones`. `RETENTION.md` says of the financial purge "there is none to gate"; the function exists. |
| 18 | `updated_at` is mostly unmaintained. | 88 tables have it; **53 have no BEFORE UPDATE trigger**, 21 of those are client-writable. There are seven separate append-only guards and about twenty `stamp_*` functions. |
| 19 | The stewardship matrix and the stored data disagree on tiers. | The matrix puts disability and aid in blocked T4; the schema stores accommodation tables and a registered contract calls aid T3 ([05 §5.2](05-lifecycle-governance.md)). |
| 20 | Three check constraints are permanently `NOT VALID`. | `NOT VALID` ×7 in the migrations, `VALIDATE CONSTRAINT` ×0. |

**Checked and not a finding.** Four things looked wrong and were not, recorded so nobody re-derives them:
627 foreign keys, **0 unindexed**; every `public` table has row-level security (319 of 319); six `person_id`
tables with no direct key to `auth.users` are erased by cascade through parents that do reference it
(`evidence_reference`, `consent_record`, `skill_claim`; `account_data_map()` lists all three); the 39 other
person-shaped columns without a key are billing-account ids, staff-actor columns on append-only history (a
known, fail-closed limit), or composite-key children.

## The documents

| | Deliverable | File |
| --- | --- | --- |
| 1 | Canonical entity model and ERDs | [01-canonical-entity-model.md](01-canonical-entity-model.md) |
| 2 | Source-of-truth and precedence matrix | [02-source-of-truth-matrix.md](02-source-of-truth-matrix.md) |
| 3 | Transactional schema conventions | [03-schema-conventions.md](03-schema-conventions.md) |
| 4 | Event schema and lineage | [04-events-and-lineage.md](04-events-and-lineage.md) |
| 5 | Classification, retention, deletion, hold, backup, export, restore | [05-lifecycle-governance.md](05-lifecycle-governance.md) |
| 6 | Analytics architecture | [06-analytics-architecture.md](06-analytics-architecture.md) |
| 7 | Data quality, reconciliation, drift, migration verification | [07-data-quality-and-migration.md](07-data-quality-and-migration.md) |
| 8 | Search and retrieval | [08-search-and-retrieval.md](08-search-and-retrieval.md) |
| 9 | AI data access | [09-ai-data-access.md](09-ai-data-access.md) |
| 10 | Migration, indexing, partitioning, performance, archival | [10-physical-design.md](10-physical-design.md) |
| — | Test plan | [11-test-plan.md](11-test-plan.md) |
| — | Governance operating model | [12-governance-operating-model.md](12-governance-operating-model.md) |

## Relationship to the CTO target-architecture pack (#1144, D-1144)

While this work was in progress, main took the CTO pack in [`docs/target-architecture/`](../../target-architecture/README.md)
(proposal status). It decides stores and runtime; this work specifies and tests the data layer beneath it. They agree
on the shape and each adds something the other lacks. The points below are where they **touch**, so neither is
discovered by surprise.

| Topic | The pack says | This work | Status |
| --- | --- | --- | --- |
| System of record | P-03: Postgres, pooled with RLS, `tenant_id` everywhere | Same; adds the conformance view and the 38 missing tenant FKs ([03](03-schema-conventions.md)) | agree |
| Events | P-04: keep ADR 0008; **partition the outbox by day** | Same; adds the sweep that was owed, the registry, and the sizing that says the outbox is the first table to cross a threshold ([04](04-events-and-lineage.md), [10](10-physical-design.md)) | agree |
| Search / vectors | "derived only; tenant filter applied **before** retrieval" | Same; adds the ACL-in-RLS design and the ANN-recall caveat for filtering inside an approximate index ([08](08-search-and-retrieval.md), [09](09-ai-data-access.md)) | agree, more specific |
| Warehouse | "derived only; k-anonymity floor; tenant-scoped views" | Same; splits audience (owner pilot vs institution floor) because `ANALYTICS.md` says the pilot is 5–10 people ([06](06-analytics-architecture.md)) | agree, refined |
| Source precedence | institution-verified > imported > student-entered > estimate; loser kept as a conflict | Same ordering for official facts; encoded as data, with a tested enrolment reconciliation ([02](02-source-of-truth-matrix.md)) | agree |
| Authority per module | table: native vs connected | Per-entity matrix keyed on the existing `tenant_module_mode` | agree, refined |
| **`FORCE ROW LEVEL SECURITY`** | planned for wave C0 | **Touch point 1** below | **to verify** |
| **Tenant context** | `app.tenant_id` set per transaction | **Touch point 2** below | **to verify** |
| **Source vocabulary** | "`SourceKind` exists" (4 values) | **Touch point 3** below | **corrected** |

**Touch point 1: `FORCE RLS`.** Several proposals run with the table owner's rights: `security definer` functions
(`ai.retrieval_gate`, `tenant_data_manifest`, `accounts_to_notify_after_restore`, `sweep_outbox`) and the analytics
views (which read `public.activity` so the reader needs no access to it). Without `FORCE`, an owner bypasses RLS and
all of it works. With `FORCE`, an owner is bound **unless it holds `BYPASSRLS`**, which Supabase's `postgres` role
is believed to, **not verified here**. If the owner is bound, these fail **closed** (the gate returns no policy, so
no context; a view returns no rows), never open. Before wave C0, run all thirteen tests under `FORCE` with the
real owner role and either keep the bypass on the owning role or give each owner-run function an explicit policy.
This is an item in [11](11-test-plan.md), not something the sandbox could settle (its `postgres` is a superuser).

**Touch point 2: tenant context.** The proposals take the caller's tenant from `private.school_of()` (today:
`profiles.school_id` for `auth.uid()`), in two places (the search policy and the AI gate). When `app.tenant_id` is
set per transaction, the seam is that one function: change its body or add a `private.current_tenant()` and repoint
the two call sites. Nothing else in the proposals assumes where the tenant comes from.

**Touch point 3: the source vocabulary.** The pack's `SourceKind` is the `source_label` check on the expansion tables
(`institution_verified | imported | student_entered | estimated | needs_review`); `source_records.source_type` is a
second (`connected_institutional | public_university | manual_admin | user_entered | external_link`), and the
community labels are a third. One value, **`imported`, cannot be ranked from the label alone** (an institution feed
or the student's own file?). Proposal 02 adds `private.source_vocabulary` mapping every existing value, marks
`imported` as an **owner decision**, and a guard that fails if either live constraint gains an unmapped value.

**Domain crosswalk** (the pack's twelve modules against this work's fifteen domains; one owner per table is the
pack's rule 2 and is made checkable here by `data_registry.domain NOT NULL`):

| Pack module | This work's domain(s) | Difference and reason |
| --- | --- | --- |
| identity, academic, learning, productivity, family, career, marketplace | same names | career here also holds `alumni` as a separate domain (one table today) so lifelong identity is not lost in a larger one |
| campus, community | `campus` (community content), `support` (moderation, cases, volunteers) | moderation is trust-and-safety work with its own staff and retention |
| finance | `finance` (student money) and `commercial` (Semester's own billing, GTM, beta) | the pack merges them in one row; here they are separate so vendor billing can never be joined to a student's ledger |
| support-trust, admin | `support`, `governance`, `integration` | legal hold, deletion request, retention rule, audit, policy, configuration are `governance`; connectors, mappings, imports are `integration` |
| (platform: policy, outbox, audit, search, consent) | `governance`, `ai`, derived stores | the AI and derived stores are first-class domains here because they carry their own retention and erasure rules |

## What is in `sql/` and `appendix/`

| File | What it is |
| --- | --- |
| `sql/01` … `sql/12` | The twelve proposals: registry and conformance, provenance/lineage/precedence (with the enrolment reconciliation view), event registry and outbox sweep, tenant manifest and restore record, analytics boundary, search index, AI retrieval, partitioning, data-quality rules, row stamping and one append-only guard, hold-coverage guard, governance KPIs |
| `sql/tests/` | One test per proposal (`01_registry` … `13_governance_kpis`) |
| `sql/run_all.sh`, `sql/mutation_check.py` | Rebuild and run everything; prove each test can fail |
| `sql/generated_*.sql` | Registry seed (348 rows, all `proposed`) and 35 cross-tenant rules, **generated from the catalog**; do not edit by hand |
| `appendix/measure.py`, `tables.sql` | Regenerates every conformance figure; fails if any table matches no domain rule |
| `appendix/conformance.csv` | Per-table: domain, tenant/owner keys, timestamps, lifecycle, source, classification, retention, version |
| `appendix/gen_cross_tenant_rules.sql` | Emits the 35 rules |
| `appendix/sizing_model.py`, `measure_queries.sql` | The volume model (assumptions) and the five queries to replace it with measurements |
| `appendix/check_docs.py`, `check_mermaid.mjs` | Table, link and diagram checks for these documents |

## Validation: what was run, and what was not

```bash
# a disposable Postgres holding the migrated schema (never a live database)
PGHOST=<socket dir> PGPORT=<port> PGUSER=postgres docs/architecture/data-architecture/sql/run_all.sh
python3 docs/architecture/data-architecture/sql/mutation_check.py
```

- **Run.** All twelve proposals apply to the migrated schema; all thirteen tests pass.
- **Shown to fail.** `mutation_check.py` applies 53 faithful bugs, one at a time (a hold ignored, a tenant
  filter removed, a minor served, a classification ceiling dropped, RLS bypassed by `security definer`, …) and
  requires the named test to go red. Its first run (30 bugs) killed 25 and exposed two defects in the tests
  themselves: a "minor" test that ran after the student had been un-enrolled, so the age rule was never
  exercised, and a classification-ceiling test whose rows were also excluded by audience. Both are fixed;
  three further survivors were two-barrier rules (each barrier alone masks the other) and now mutate both.
  The control (every test green unmutated) is checked first.
- **Not run.** PostgreSQL 16 was available, not the 17 named in `supabase/config.toml`. `pgvector` and
  `pg_cron` are not installable in this sandbox: the dense-retrieval column and the schedule lines are
  written as comments and are **untested**. Partition pruning was read from `EXPLAIN`, not benchmarked.
  Nothing was run against Supabase, a hosted project, or at volume. Sizing in [10](10-physical-design.md) is a
  model with stated assumptions, not a measurement.
- **Not decided here.** Anything that is a legal conclusion (FERPA directory information, retention minimums,
  guardian rights by jurisdiction) is marked **counsel** and is left to qualified human counsel. This work
  states what the data model must be able to express; it does not say what the law requires.

## Decisions this work needs from people

1. **Registry stewardship.** The generated seed leaves classification, authority, retention, deletion and
   steward unset on all 348 rows, on purpose. Someone has to confirm them ([12](12-governance-operating-model.md)).
2. **Add `NOT VALID` tenant foreign keys** to the 38 tables ([03](03-schema-conventions.md)).
3. **Directory information policy.** Search kind `person` and AI purposes depend on it; it is an open counsel
   item (`docs/COUNSEL-BRIEF.md` row B3, "Not modelled").
4. **A deletion record after restore.** D-124 chose not to keep one. This work does **not** reverse it; it
   records the cost of that choice and offers an option ([05](05-lifecycle-governance.md)).
5. **Close the shared-key AI path** or bring it under tenant policy ([09](09-ai-data-access.md)).
