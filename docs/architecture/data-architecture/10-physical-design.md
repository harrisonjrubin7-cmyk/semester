# 10 · Migration, indexing, partitioning, performance and archival

Nothing here has been run at volume. The migrated schema has no rows and no workload exists yet. Section 10.1 is
**measured** (from the catalog). Section 10.2 is a **model** whose inputs are assumptions
([`appendix/sizing_model.py`](appendix/sizing_model.py)). Everything else is a rule or a procedure, and the pieces
that could be tested were (proposal 08, partitioning; proposal 10, row stamping; proposal 09, quality rules).

## 10.1 Measured baseline

From the schema produced by the 171 migrations (45,637 lines of SQL):

| Measure | Value |
| --- | --- |
| Tables | 348 (319 `public`, 29 `private`); **0 partitioned** |
| Indexes | 1,022, **all btree**: 475 unique, 45 partial, 5 expression; mean 3.2 per table, max 8 |
| Non-btree (GIN, GiST, trigram, vector, BRIN) | **0** |
| Foreign keys | 627, **0 unindexed** (re-measured with a control that detects a deliberately unindexed key) |
| Exact duplicate indexes | **0** |
| Tenant tables without a tenant-led index | 5, all small configuration tables: `data_subject_request`, `integration_duplicate_resolutions`, `integration_mapping_versions`, `integration_schema_fingerprints`, `integration_source_owners` |
| Tables with a `jsonb` column | 57; seven core student tables are blobs ([01 §1.4](01-canonical-entity-model.md)) |
| Constraints left `NOT VALID` | **3** (`opportunities_url_https`, two on `governance_config_requests`); `NOT VALID` appears 7 times in the migrations and `VALIDATE CONSTRAINT` **never** |
| DDL habits in the migrations | `create index` ×646, **`concurrently` ×0**; `add column … not null` ×23; `drop column` ×4; `alter column … type` ×0; `lock_timeout` ×1 |
| Extensions in the build environment | `pgcrypto` only. What the hosted project enables was **not verified** |

This is a disciplined schema: every foreign key indexed, no duplicates, small index counts. The work below is
about what changes **when rows arrive**, not about repairing a mess.

## 10.2 Volume model (assumptions, not measurements)

Inputs are in the script and are deliberately round. Scenarios: **Pilot** 1 tenant / 2,000 students;
**Early** 10 tenants / 150,000; **Scale** 200 tenants / 3,000,000. Row bytes include a 2.2× multiplier for indexes and
MVCC slack. Rates are per student per day.

| Table (assumed rate, row bytes, clock) | Pilot | Early | Scale |
| --- | --- | --- | --- |
| `audit_event` (0.3/day, 350 B, 3 years) | 0.7 M rows · 0.5 GB | 49 M · 38 GB | 986 M · 759 GB |
| `access_log` (1.0/day, 150 B, 90 days) | 0.2 M · 0.1 GB | 13.5 M · 4.5 GB | 270 M · 89 GB |
| `activity` (≤ 3/day, 60 B, 400 days) | 2.4 M · 0.3 GB | **180 M** · 24 GB | 3.6 B · 475 GB |
| `domain_outbox_events` (8/day, 400 B, 90 days) | 1.4 M · 1.3 GB | **108 M · 95 GB** | 2.2 B · 1.9 TB |
| gateway + AI audit (0.5/day, 300 B, 180 days) | 0.2 M · 0.1 GB | 13.5 M · 8.9 GB | 270 M · 178 GB |
| `ai.retrieval_log` (0.2/day, 200 B, 180 days) | 0.1 M · 0.0 GB | 5.4 M · 2.4 GB | 108 M · 48 GB |
| **Student blobs** (300 rows × 1.5 KB each) | 0.6 M · **2.0 GB** | 45 M · **149 GB** | 900 M · **3.0 TB** |
| `grade_entries` (80/year, 250 B) | 0.2 M · 0.1 GB | 12 M · 6.6 GB | 240 M · 132 GB |
| Search text + chunks + embeddings (20,000 shared docs per tenant × 5 chunks) | 0.6 GB + 0.4 GB + HNSW 0.6 GB | 4 + 4 + 6 GB | 88 + 82 + 123 GB |

What the model says, and what it does not:

1. **At pilot scale nothing needs partitioning.** Do not partition a table with two million rows.
2. **At Early scale four tables cross a partitioning threshold first:** the outbox, `activity`, `audit_event` and the
   gateway audit. The outbox is largest because it is the highest-rate table; this is why its sweep (scrub at 30
   days, expire by class) is the first retention control to ship and why partitioning it by day is the first
   partitioning to do.
3. **The student blob store dominates storage and is the least certain input.** Moving from 150 KB to 1.5 MB per
   student moves Scale from about 1 TB to about 10 TB. **The first thing to measure in the pilot is the 50th, 90th
   and 99th percentile of bytes per student** (`appendix/measure_queries.sql`, query 2); the answer decides
   whether blobs need a per-student cap, compression policy, or per-entity rows before Early scale.
4. **Embeddings are a storage line item, not a rounding error** (about 4 KB per 1024-dimension chunk before the
   index). Chunk count follows the chunking policy, so that policy is a cost decision as well as a quality one.

## 10.3 Indexing rules

| # | Rule | Why |
| --- | --- | --- |
| I1 | A tenant table's primary read index is **led by `tenant_id`**, then the filter, then the sort: `(tenant_id, status, created_at desc)`. | Every tenant query carries the tenant; a leading tenant makes the plan independent of other tenants' data volume |
| I2 | **Partial indexes for live rows**: `where deleted_at is null`, `where status = 'published'`. | Tombstones and finished rows should not tax hot reads (45 exist; the pattern is familiar here) |
| I3 | **BRIN on the time column** of a large append-only partition. | An insert-ordered timestamp is the textbook BRIN case; a tiny index for range scans over history |
| I4 | **GIN only where a query needs it**: tsvector, trigram, `jsonb @>`. Never a whole-blob GIN on `data`. | A GIN on a blob is a write tax on the hottest tables for a query nobody runs |
| I5 | Every foreign key has a supporting index. | Already true (627/627); keep `indexes.check.sql` |
| I6 | `INCLUDE` columns for a hot list query that would otherwise visit the heap. | Index-only scans on the Today and list screens |
| I7 | Create on a populated table with `CREATE INDEX CONCURRENTLY`, **as the only statement in its migration file**. | A multi-statement migration runs as one implicit transaction and `CONCURRENTLY` is refused inside one; the 646 existing `create index` statements all ran on empty tables, which will stop being true |
| I8 | **Quarterly unused-index review** from `pg_stat_user_indexes` (`idx_scan = 0`, not unique, not primary). | Needs production statistics; query 3 in the appendix; meaningless on a fresh database |
| I9 | The 5 tenant tables above get a tenant-led index when any of them grows past a few thousand rows. | They are small configuration tables; do not index them speculatively |

## 10.4 Partitioning

**Partition when a measured trigger fires, not before.** Triggers (engineering rules of thumb, to be tuned by the
pilot): the table exceeds about 50 GB or 50 M rows; **or** its retention delete removes more than about 5 % of the
table per day (the delete cost shows up as bloat and vacuum debt); **or** vacuum cannot keep up (query 4).

| Table | Key | Interval | Retention action | Notes |
| --- | --- | --- | --- | --- |
| `domain_outbox_events` | `occurred_at` | day | detach after class window; export only `audit` class | Highest rate; partition **before** the first producer ships |
| `audit_event` | `occurred_at` | month | detach at 3 years, **export then drop** | Target shape is proposal 08 (`private.audit_event_p`) with `purpose`, `policy_version`, `classification` |
| `activity` | `day` | month | drop at 400 days | Its present on-write prune becomes a drop |
| `gateway_audit`, `gateway_intelligence_audit`, `ai.retrieval_log` | `at` | month | drop at 180 days | Metadata only |
| `integration_sync_runs`, `_errors`, `_webhook_events`, `source_freshness_events` | `created_at` | month | per integration retention | |
| `access_log` | `at` | week | drop at 90 days | Short clock, high rate |
| **Never partition by time:** `academic_record_entries`, `student_account_entries`, `ledger_chain*`, `grade_entries` | | | **never deleted** | A hash chain and an institutional record are not retention candidates; partitioning invites a drop |
| **Never partition by tenant** at this scale | | | | 200 tenants × N tables is thousands of partitions; planning cost grows with partition count. Revisit only for one tenant that dominates a table |

**Rules the proposal enforces and tests** (`tests/08_partitioning.test.sql`):

- Monthly partitions are created ahead, idempotently (`ensure_month_partitions`: first call creates 3, second creates 0).
- **Pruning is read from `EXPLAIN`, not assumed:** a query bounded to one month scans **one** partition; an unbounded query scans all
  (the control).
- **Detach is metadata-only and never drops.** A partition holding **any** held tenant is **ineligible**: a hold must
  not be defeated by a calendar. Tested with one detachable partition and one blocked by a hold.

**Constraints to design around:** the partition key must be in every primary key and unique constraint (the
target table uses `(id, occurred_at)`); a foreign key *from* a partitioned table is allowed, a foreign key *to* one needs care; RLS
policies on the parent apply to all partitions; a row trigger on the parent propagates to partitions on
supported versions (the project's major version should be confirmed before relying on it).

**The conversion procedure** (Postgres cannot partition an existing table in place):

1. Create the partitioned table beside the old one (proposal 08 for `audit_event`); register it.
2. **Dual-write** for one retention window through the writing function, so the new table fills to the same horizon as the old.
3. Backfill older rows **one partition at a time** in key order, in batches, off-peak, with a short `lock_timeout`.
4. **Verify** per partition: row counts, a hash over a sorted projection, the data-quality rules.
5. In one short transaction: rename old → `_old`, new → the real name, repoint dependents; keep `_old` for one release.
6. Drop `_old` after the verification window. Rollback before step 6 is a rename.

The previous app build must run against both shapes throughout (the `ROLLBACK.md` rule).

## 10.5 Archival

Two different things are called archive; only one is allowed to hold personal data.

| | Evidence archive | Student archive |
| --- | --- | --- |
| Holds | Audit, security and operational evidence past its hot window | **Does not exist, by promise** |
| Why | Investigations and audits need history longer than the hot table | `privacy.ts`: "no archive kept after you delete your account" |

**Design constraints for the evidence archive:**

- **No person key `erase_account` cannot reach.** Audit rows reference people by `*_sha256` or `student_ref`, never by
  an `auth.users` foreign key, so an archived partition does not hold an account's identity. The registry's
  `convention_violations` check (`evidence_not_client_updatable`) and the append-only guard's header both enforce
  that shape. An archive format that embedded account ids would silently violate the promise.
- **Manifest per partition** (`manifest.json`): table, bounds, row count, SHA-256 of the file, tenants present,
  highest classification, created-by, created-at, archive-by-date. Written **before** the partition is dropped.
- **Two-phase:** export → verify (count + hash) → detach → drop only after a waiting period. A failed verification
  leaves the partition attached.
- **Encrypted, tenant-tagged, classification-tagged**; stored where the tenant's data-zone commitment allows.
- **Holds win:** a held tenant's rows are not dropped when the partition ages out (the detach function already
  refuses), and an exported object under a hold is retained until release.
- **End of life:** the archive itself has a clock (the table's retention class); the manifest records the delete-by date.
- **Restore path:** a partition is re-attached from its export, verified against the manifest, and the quality rules
  run before it is visible. The path must be rehearsed once before the first drop, with the result written to
  `private.restore_event`.

## 10.6 Performance practices

- **RLS cost.** Policies already use `(select auth.uid())` (an init-plan, evaluated once per statement), the right
  pattern. The risk is per-row helper calls in a policy (`private.classmate(user_id)` runs a join per candidate
  row). **Measure with `EXPLAIN (ANALYZE, BUFFERS)` on realistic data for the three policies that call helpers**
  (profiles, enrollments, search); if one dominates, the fix is a set-based form (join once, filter by the result),
  not removing the check.
- **Hot updates and bloat.** The blob tables are updated in place by sync. Set a `fillfactor` of 80–90 on them
  so updates can be heap-only, and watch dead-tuple percentage (query 4). A large `jsonb` moves out of line
  (TOAST); the share is query 5.
- **Autovacuum on append tables** needs tuning on high insert rates (insert-triggered vacuum, scale factors), and
  partitioning removes most of the problem for the time-series tables.
- **Connections.** Transaction-mode pooling means no session state: every request sets its claims per transaction
  (the existing `set_config('request.jwt.claims', …, true)` pattern); nothing may rely on a session `SET`.
- **Timeouts.** A statement timeout per role (shorter for `authenticated`, longer for batch roles) and a short
  `lock_timeout` for DDL with a retry, so a stuck migration fails fast instead of queueing every query behind it.
- **Reads for analytics and search** go to a replica when measured load justifies it; the `analytics` schema and the
  search index are derived, so they can move without a data migration ([06](06-analytics-architecture.md), [08](08-search-and-retrieval.md)).
- **Backfills** run in key-range batches with a pause, checkpointed so a crash resumes; never one large transaction.

## 10.7 Schema-migration safety, as rules a linter can check

The migrations are small today. The habit that will matter is already visible: no `concurrently`, no `lock_timeout`
beyond one file, `NOT VALID` used but never validated. A CI check scanning new migration SQL for the patterns
below is cheap and deterministic.

| Operation | Lock | Safe technique | Linter flags |
| --- | --- | --- | --- |
| Add nullable column | brief `ACCESS EXCLUSIVE` | as is; add default separately for old versions | `add column … not null` without a default |
| Add `NOT NULL` to a populated table | full scan under lock | add `CHECK (col is not null) NOT VALID`, `VALIDATE`, then `SET NOT NULL` | `set not null` directly |
| Add foreign key | `SHARE ROW EXCLUSIVE` on both | `NOT VALID`, then `VALIDATE` in a **separate** migration | `references` without `not valid` on an existing table |
| **Validate** a `NOT VALID` constraint | `SHARE UPDATE EXCLUSIVE` (non-blocking) | schedule it; the 3 existing unvalidated checks need doing | a `not valid` with no later `validate` |
| Create index | blocks writes | `CONCURRENTLY`, alone in its file | `create index` without it on a non-new table |
| Drop column / table | `ACCESS EXCLUSIVE` | only after the code stopped reading it, one release later | `drop` in the same change as code removal |
| Change a column type | rewrite | new column, dual-write, backfill, switch, drop | `alter column … type` |
| Rename | breaks old builds | add new, dual-write, retire old | `rename` |
| Any DDL | | `set lock_timeout = '3s'` and retry | DDL without `lock_timeout` |

## 10.8 What to measure in the pilot (in order)

1. Bytes per student, percentiles (query 2). Decides 10.2 point 3.
2. Rows per table per day, from daily snapshots of query 1. Replaces every assumed rate in the model.
3. Dead-tuple percentage and last autovacuum on the blob tables (query 4).
4. `EXPLAIN (ANALYZE, BUFFERS)` of the helper-calling policies at pilot size.
5. Unused indexes after four weeks (query 3).
6. The first restore drill's timings ([05 §5.6](05-lifecycle-governance.md)).

Then re-run `sizing_model.py` with the measured inputs. The partitioning thresholds are decisions made from that
output, not from this document.
