# 7 · Data-quality rules, reconciliation, schema drift and migration verification

## 7.1 What exists, verified against code

| Mechanism | What it does | Where | State |
| --- | --- | --- | --- |
| **Reconciliation run** | Counts a sync's records by status: `matched`, `pending` (provider newer), `mismatch` (same time, different content), `missing_in_semester`, `missing_at_source`, `duplicate`, `stale` (older than the freshness target), `rejected`; `clean` is a bool. Only exceptions are stored; references are `sha256:` redacted. | `reconcile.ts`; `integration_reconciliation_runs`, `_discrepancies` | Built. **Runtime wiring unverified**: the repository's own document says the worker writing these rows is "Next", and no `reconcile`/`detectDrift` call was found in `app/server/integration/worker.ts` |
| **Discrepancy workflow** | `open → assigned → investigating → resolved` (or `suppressed`); suppression needs a reason of ≥ 10 characters; resolve/suppress stamps `resolved_by` from `auth.uid()`; capability `integration:reconcile` | quality migration | Built |
| **Schema drift** | Fingerprint of a batch's entity/field/type set; kinds `added`, `removed`, `possible_rename`, `type_changed`, `enum_changed`, `unmapped_entity`; **breaking** = removed / type_changed / enum_changed on a *required* field; breaking → entity held, action `degrade`, records filtered | `drift.ts`; `integration_schema_fingerprints`, `_drift_events` | Built as a library. The action `degrade` is *recommended* by the function; a status change in the worker was not verified |
| **Freshness** | Seven states (`live`, `recent`, `stale`, `unavailable`, `manual`, `estimated`, `needs_confirmation`); owner, distinct backup, target and stale-threshold minutes; alert at 80 % and at breach, once per change | `integration_source_owners`, `lineage.ts` | Built |
| **Mapping versions** | `proposed → approved → live → retired` (or `rolled_back`); approval needs a recorded passing simulation and a different person than the proposer; one live version per (connection, entity) | `integration_mapping_versions` | Built |
| **Duplicate resolution** | Candidates for six entity kinds; resolution is append-only, reversible once; never across two people | `integration_duplicate_*` | Built |
| **Roster import** | `staged → validated → held → promoted` (or `rejected`, `rolled_back`); manifest counts + digest; no duplicate `sourcedId`; enrollments must reference staged users/classes; **a removal over `max_removal_pct` (default 10) holds unless a different person approves**; the prior roster is snapshotted; rollback only of the latest promotion | `private.roster_*` | Built; service-role only |
| **Migration centre** | 12 stages (inventory → … → cutover → archive → monitoring); each stage gated; runs store counts and `sample_sha256`, never student data; `passed` is a generated column; cutover needs ≥ 2 distinct passed parallel-run periods and approvals from ≥ 2 areas by someone other than the creator | `migration_projects`, `_runs`, `_field_maps` | Built. **Rollback is a recorded plan text; no executable rollback** |
| **Data contracts** | 7 contracts (enrolment, assignment dates, degree audit, advising, career, campus services, bursar/aid): class, SLA hours, owner/steward roles, field list, quality checks, correction process; go-live needs four *named people* | `data-contracts.ts` | Built. **No identity, catalog or student-entered contract** |
| **Own-schema drift** | `schema.snapshot.sql`, `ledger.snapshot`, `fingerprint.sql`, `migrationorder.test.ts`, `rehearse.sh` | `supabase/` | Built |

The platform is stronger here than most: the controls that matter at a connector boundary (two-person
approval, held-not-failed removals, simulation before a mapping goes live, sample hashes instead of data) exist.
What is missing is a rule layer for Semester's **own** tables, a way to see the state of all of it in one place,
and three seams between mechanisms that were built separately.

## 7.2 Findings

| # | Finding | Measure / evidence | Consequence |
| --- | --- | --- | --- |
| Q1 | **35 foreign keys let a row reference another tenant's parent.** Of 87 FKs between two tenant-scoped tables, 52 are composite `(id, tenant_id)` and 35 are single-column (e.g. `grade_entries.item_id → gradebook_items(id)`, `community_posts.community_id → communities(id)`, `registration_enrollments.section_id → registration_sections(id)`). | Catalog query; shown with a real row pair (a post in tenant B referencing tenant A's community was accepted by the schema, as a superuser) | The DB does not prevent it; whether a *client* can reach it depends on each definer function's logic. Defence in depth is missing, not a hole proven. |
| Q2 | Reconciliation and drift are libraries without a verified runtime path. | The documents say "Next"; no call found in the worker | A clean dashboard may mean "never ran". `stale` rules (below) turn silence into a signal. |
| Q3 | Drift is detected per whole batch, not per object and version, and breaking drift only recommends `degrade`. | `drift.ts` | The documents describe (provider, object, version) granularity; the code is per batch. Breaking drift is *detected*; that `degrade` is *enforced* was not verified. |
| Q4 | Two sources of one number: `freshnessSlaHours` (data contract) and `freshness_target_minutes` (source owner). | both exist, unlinked | They can disagree; the student-facing "up to date" sentence follows one and the steward alert follows the other. |
| Q5 | Migration rollback is prose. | `migration_projects` has a `rollback_plan` text; roster rollback only of the latest | A cutover's undo depends on a person reading a paragraph. |
| Q6 | Two documents are stale against the code. | `INTEGRATION-QUALITY-AND-RECONCILIATION.md` says "Nothing here is built yet… waits for #779" and names tables (`reconciliation_runs`, `import_batches`) that are actually `integration_reconciliation_runs` and absent; `SCHEMA-DRIFT-AND-CONTRACT-TESTING.md` plans `schema_fingerprints` (actual: `integration_schema_fingerprints`) | A reader trusts a plan over the system. Update when this lands; not edited here. |
| Q7 | A discrepancy cannot be tied to a student. | Discrepancies hold only redacted hashes and no subject column; the document claims "a student cannot read another student's discrepancy" | Per-student correction flows need a subject reference the design deliberately omitted; decide which is wanted. |
| Q8 | `canonical_entity_references.canonical_entity_type` has no closed list; the closed list (33 values) is on `integration_mappings`. | constraint definitions | A typo in a reference is accepted; the mapping layer would reject the same typo. |

(Retracted during this work: an earlier draft called the drift fingerprint "weak". A 32-bit hash misses a real
change with probability about 2⁻³² per comparison, which is fine for accidental drift; it is simply not
integrity evidence, and nothing here uses it as one.)

## 7.3 The rule layer

Proposal 09 adds `private.dq_rule`, `private.dq_result` and `private.dq_run_rule()`:

- Rules are **rows with a closed set of kinds**, evaluated by the function with `format('%I')`: `null_rate`,
  `unique`, `orphan`, `stale`, `row_count`, `tenant_mismatch`. A rule table that executes arbitrary SQL is a
  privilege-escalation path, so none does.
- Every run **records its observation** (`observed`, `threshold`, `passed`), so there is a trend and an owner, not
  only a pass/fail. `observed_at` is `clock_timestamp()`, not `now()`: the first version used `now()` and the test
  found two runs in one transaction tied, so the "latest result" view picked the wrong one.
- `severity`: `info` | `warn` | `block`. `private.dq_blocking_failed` lists any enabled `block` rule whose **latest**
  result failed. That view is the gate.
- A rule naming a wrong column **fails loudly** (`undefined_column`), never reads as green; tested.

### Where the gate bites

| Point | Mechanism | Effect |
| --- | --- | --- |
| Pull request / migration | Run all `block` rules against a branch database built from the migrations plus seed; fail on `dq_blocking_failed` | A migration that makes a rule fail does not merge |
| Import / promote | Roster promote and a migration-centre `validation` run call the same rules for the tables they touch | A load that would create orphans or cross-tenant references is held, not promoted |
| Nightly job | `dq-nightly` runs every enabled rule; a failing `block` rule pages the steward named on the rule | The state of the data is observed, not assumed |
| Release evidence | The latest result of each `block` rule is attached to the release (`platform_release_evidence`) | A release record says what the data looked like |

### The initial rule set

- **35 generated cross-tenant rules** (`sql/generated_dq_cross_tenant_rules.sql`), one per single-column FK between
  tenant-scoped tables, produced from the catalog by `appendix/gen_cross_tenant_rules.sql` so the list cannot
  drift from the schema. Every one executes against the real columns and passes on an empty database; one is
  shown to fire on a real cross-tenant pair. The **preferred fix is a composite foreign key** `(id, tenant_id)`
  per [03](03-schema-conventions.md); the rules are the detective control until each lands, and are retired
  one by one as it does.
- **Operational rules**, shown to fail on an empty database (a job that never ran is not healthy) and pass after a
  fresh run: `ops.ledger_chain_verified_nightly` and `ops.console_audit_verified_nightly` (`stale`, 36 h,
  `block`), `ops.source_freshness_monitor_alive` (`stale`, 7 d, `warn`).
- **To add, each with a named steward** (not seeded: they need the steward to choose the threshold): outbox
  backlog age; dead-letter count per connection; `enrollment_reconciled.conflict` rate per tenant; analytics
  tie-outs (A9 in [06](06-analytics-architecture.md)); null rate of `canonical_entity_references.source_timestamp`;
  a freshness-SLA rule that reads one number for both Q4 sources once they are linked.

## 7.4 Reconciliation reports

Six standing reports. Each has an owner, a cadence, a threshold and an escalation, and each is a **read of
existing facts**, not a new store.

| # | Report | Compares | Owner | Cadence | Escalate when | State |
| --- | --- | --- | --- | --- | --- | --- |
| R1 | **Source ↔ Semester** | per connection per sync: counts by status, `clean`, trend over 4 syncs | Integration owner | every sync | `mismatch + missing_*` > 0 for 2 consecutive syncs, or any `rejected` | tables built; **runtime wiring to verify** |
| R2 | **Enrolment three-way** | declared vs registrar (and SIS twin when live): counts by `status`; list of `conflict` rows | Registrar steward | daily in registration windows, else weekly | any `conflict` older than 7 days | **proposed**; `private.enrollment_reconciled`, tested |
| R3 | **Cross-tenant integrity** | results of the 35 rules | Platform data steward | nightly | any non-zero `observed` | **proposed**, tested |
| R4 | **Ledger tie-out** | `student_account_entries` balance vs provider (`provider_ref`); `student_account_reconciliations` | Bursar steward | per statement | any unexplained difference | tables built |
| R5 | **Analytics tie-out** | each metric vs a count from the system of record | Metric owner | per metric refresh | difference beyond stated tolerance | proposed |
| R6 | **Freshness SLA** | each source against its target and threshold | Source owner | continuous, alert at 80 % and breach | breach | built (`lineage.ts`) |

A report that finds nothing must say how many things it looked at ("checked 2,314 enrolments across 3 tenants,
0 conflicts"), the same discipline as `supabase/analytics.sql`'s control query: zero rows can mean "clean" or
"nothing is writing", and those are opposite.

## 7.5 Schema-drift handling

Two kinds, two owners.

**Provider drift** (a source changes its shape):

| Event | Detection | Automatic action | Human action | SLA to acknowledge |
| --- | --- | --- | --- | --- |
| Field added | fingerprint change, kind `added` | none; log | steward reviews at next mapping review | next review |
| Possible rename | `possible_rename` (removed + added of compatible type) | none | steward confirms or maps | 2 business days |
| Optional field removed/retyped | `removed`/`type_changed` on a non-required field | log, warn | steward | 2 business days |
| **Required field removed, retyped or enum-changed** | **breaking** | **hold the entity; records filtered; connection `degraded`** (make the action enforced, not recommended; Q3) | integration owner acknowledges, adjusts mapping through the proposed → approved → live path | **same day**; official reads fall back to native/manual meanwhile |
| Unmapped entity | `unmapped_entity` | none | steward decides to map or ignore | next review |

Improvements, in order: (1) make `degrade` an enforced state change, tested end to end; (2) fingerprint **per
object and version**, not per batch, so one object's change is not buried in a batch that did not change; (3)
record the fingerprint algorithm in the row so it can change; (4) a contract-test fixture per adapter built
from a recorded sample (the pattern `mock-sis.test.ts` already follows).

**Own-schema drift** (Semester's database against what the code expects) is already guarded by the snapshot,
fingerprint, migration-order and rehearsal checks. The additions are the registry and conformance view
([03](03-schema-conventions.md)), which turn "a table nobody classified" into a failing check, and the generated
rules, which turn "a foreign key that lost its tenant" into one.

**Event drift** is handled by the registry: additive changes keep a version; breaking changes are a new
version served in parallel until receipts show the old one drained ([04](04-events-and-lineage.md)).

## 7.6 Migration verification

Three different migrations are called "migration"; each is verified differently.

### A. Schema migrations (Semester's database)

Existing procedure (`DATA-MIGRATION-PLAN.md`): additive first; RLS, a check suite walking two accounts, a
`RETENTION.md` entry, `OWNED_TABLES` where the client writes, snapshot updates; `check.sh` and `rehearse.sh`;
the previous app build must still load; **production apply is the merge and needs owner approval**.

Added verification, all cheap and all deterministic:

1. **Registry and conformance gap views must be empty** for the migration's tables (`unregistered`,
   `orphan_registry`, `convention_violations`).
2. **The DQ `block` rules run on the post-migration branch.** A new foreign key added `NOT VALID` is followed
   by a `VALIDATE` in a *separate* migration, preceded by a dry-run query that counts the rows that would fail.
3. **The hold-coverage guard** ([05 §5.5](05-lifecycle-governance.md)) is silent: a new sweep that deletes must be
   hold-aware or carry a dated exemption.
4. **A constraint or index added on a large table** states its lock level and uses `CONCURRENTLY` or `NOT
   VALID` ([10](10-physical-design.md)).
5. **Round-trip**: the previous app build's contract tests run against the new schema (the `ROLLBACK.md` rule
   made executable).

### B. Data migrations into Semester (a school moving from another system)

The migration centre's stage gates are the right shape. What each stage must **verify**, with the
representation that keeps student data out of the evidence:

| Check | Method | Evidence stored |
| --- | --- | --- |
| Row-count parity | source count vs loaded count per entity | counts only |
| Key uniqueness and closure | no duplicate source key; every foreign reference resolves | counts of failures |
| Totals | sums of money, credits, points per cohort | the sums |
| Distribution parity | null rate, min/max dates, enum histograms per column | summary statistics |
| Content parity | hash of a sorted canonical projection per partition; plus a **random sample** of keys compared field by field | `sample_sha256`, never the rows |
| Referential tenancy | every loaded row's tenant equals its parent's (the 35 rules, plus composite FKs) | count |
| Classification | nothing above T3 loaded; T3 rows have a subject | count |
| Idempotence | loading the same batch twice changes nothing (`idem_key` + fingerprint) | row counts before/after |
| Parallel run | ≥ 2 distinct passed periods with `missing + extra + differing = 0` | `migration_runs.passed` |

**Rollback must be executable, not prose** (Q5). The pattern: every loaded row carries an
`origin_batch_id` (one table has the column today; make it part of the provenance set,
[`private.add_provenance`](sql/02_provenance_lineage_precedence.sql)); a rollback is "delete rows where
`origin_batch_id` = X and `ingested_at` ≥ T" within the retention window, **refused if a hold exists on the
tenant**, and verified by the same counts in reverse. `roster_rollback`'s "latest promotion only, refuse if
a later one exists" rule is the model.

### C. Cutover and replacement verification

"Replacement status" in the audit is a commercial and operational claim. The data evidence it needs, in the
migration centre's own gates: parallel-run reconciliation clean for the agreed periods; sign-off by data owner,
registrar, IT and the area owners (distinct people); a rollback drill *executed* once on a copy; the archive
location recorded; the monitoring stage's `stale` rules green. **counsel** reviews the claim, not this model.

## 7.7 What to build, in order

1. Composite tenant foreign keys on the 35 (starting with the ledger and grade tables), retiring a generated rule
   with each. Until then the rules run nightly.
2. Wire the reconciliation and drift libraries to the worker and prove it with the `stale` rule.
3. Link the two freshness SLAs (Q4) with a test.
4. Enforce `degrade` on breaking drift; fingerprint per object and version.
5. Executable data-migration rollback via `origin_batch_id`.
6. Three missing data contracts; close the entity-type list on `canonical_entity_references` (Q8).
7. Refresh the two stale documents (Q6).
