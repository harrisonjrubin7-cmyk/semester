# 3 · Transactional schema conventions

A convention nobody can check is a wish. Each rule below says **what it is, which class of table it binds, how
it is enforced, and where the repository stands today** (measured, see [`appendix/`](appendix/)). Enforcement is
[`sql/01_registry_and_conformance.sql`](sql/01_registry_and_conformance.sql): every table has a registry row
naming its class; a view lists each (table, broken rule); the build fails on a non-empty view that is not
covered by a dated exemption.

## 3.1 Table classes

| Class | Meaning | Examples |
| --- | --- | --- |
| `tenant_record` | A row an institution's data belongs to | `registration_sections`, `gradebook_items`, `institution_actions` |
| `account_record` | A row a student owns | `tasks`, `notes`, `profiles`, `consent_record` (also tenant-scoped: a table may be both) |
| `tenant_config` | Versioned configuration | `tenant_feature_policy`, `ai_policy`, `school_config_versions` |
| `platform_catalog` | Same for every tenant, no personal data | `app_capabilities`, `commercial_plans`, `data_classification_rules` (platform floor) |
| `append_only_evidence` | A fact about something that happened | `audit_event`, `academic_record_entries`, `student_account_entries`, `ledger_chain*` |
| `ephemeral` | Expires by design | `lti_nonce`, `gateway_rate_limit`, `push_queue` |
| `derived` | Rebuildable from other rows | search documents, AI chunks, analytics facts, projections |

## 3.2 The rules

| # | Concern | Rule | Binds | Enforced by | Baseline today |
| --- | --- | --- | --- | --- | --- |
| C1 | **Tenant scope** | `tenant_id text NOT NULL REFERENCES schools(id)`, always named `tenant_id`. A child of a tenant-scoped parent carries it in a **composite FK** `(parent_id, tenant_id)`. | `tenant_record`, `tenant_config`, `derived` | `convention_violations`: `tenant_id_not_null`, `tenant_fk_to_schools` | 177 tables have `tenant_id`; **38 lack the FK** (34 `NOT NULL`); 19 are nullable; 8 FKs are named `school_id` |
| C2 | **Ownership** | Person key is `auth.users(id)`; column `user_id` unless the role matters (`student_id`, `author_id`). **Every FK to `auth.users` declares `ON DELETE` deliberately:** `CASCADE` for owned data, `SET NULL` for actor columns (`created_by`, `updated_by`), never `NO ACTION` except on registered append-only history. | `account_record` | `private.account_data_map()` (erasure and export are *derived* from these FKs, so the choice is the erasure policy) | 262 mapped columns: **112 delete, 150 clear, 0 refuse**. Owner is named `user_id` (59), `student_id` (16), `student` (8), `owner_id` (7), `subject` (5): all discoverable by FK, none by name |
| C3 | **Source metadata** | `source_kind`, `source_ref`, `source_observed_at`, `ingested_at`, `mapping_version`; a connected row must carry the first four. One vocabulary: `private.source_kind`. | any table holding data from outside the row's author | `private.add_provenance()` + `provenance_connected_complete` check (`NOT VALID`) | 41 tables carry some source column, under at least 8 different names (`source` 8, `source_label` 8, `origin` 3, `source_of_truth` 2, `source_system` 2, `source_type`, `source_kind`, `provenance`) |
| C4 | **Classification** | One tier per table in the registry (`T0`–`T3`; `T4+` is never stored). A table that mixes tiers carries a `classification` column and a check that `T3` rows have `subject_user_id`. | all | registry `classification`; `check (not (T3 and analytics_eligible))`; existing `classification_block` on ingest | 9 tables carry a column; **3 vocabularies** (T0–T6, 4-level event, TS `ResourceClassification`); mapping in proposal 03 |
| C5 | **Timestamps** | `created_at`, `updated_at` server-stamped; `row_version bigint` on any table a client may write. Legacy rows keep `created_at = NULL` ("unknown"), never a fabricated migration time. | mutable classes | `private.stamp_row()` / `add_row_conventions()` (proposal 10) | 151 have a creation-type timestamp, 88 `updated_at`; **53 of those 88 have no BEFORE UPDATE trigger; 21 of the 53 are client-writable** |
| C6 | **Lifecycle end** | Exactly one of the four patterns in 3.3. Never a bare boolean. | all | review; registry `deletion_mode` | 28 tables have a lifecycle-end timestamp; **9 use a bare boolean** (`active` ×8, `retired` ×1); no `is_deleted` anywhere |
| C7 | **Audit reference** | Every state change made by a `security definer` function or a privileged role writes `audit_event` with the request's `correlation_id`. Institutional records also write a ledger chain entry. A change row carries `proposed_by` and `approved_by` where policy requires two people (distinct, by `CHECK`). | privileged writes | `outbox.check.sql` pattern; ledger chain verification (nightly) | `correlation_id` exists on **5** tables (`audit_event`, `approval_request`, `console_audit_event`, `gateway_audit`, the outbox); ledger chain covers **2** ledgers (academic record, student account) |
| C8 | **Idempotency** | A command table carries `idem_key` and a `fingerprint` of the request body; same key + different body is refused. | commands, webhooks, imports | `registration_requests` is the model | Present on registration, outbox, integration events; absent elsewhere |
| C9 | **Money and time** | Money is `bigint *_cents` plus a currency column when it can be non-default. Times are `timestamptz`, UTC. | all | review | Followed (`amount_cents`, `balance_cents`) |
| C10 | **Free text and JSON** | Text columns have a `CHECK (length(...) <= n)`. `jsonb` holds a payload, never a fact a server feature must query; a local-first blob keeps typed **projection columns** ([01 §1.4](01-canonical-entity-model.md)). | all | review; `jsonb_typeof` check | 57 tables have a `jsonb` column; 7 core tables are blobs |
| C11 | **RLS** | Enabled on every table; no policy = deny by default; direct client write is the exception and is listed. Definer functions pin `search_path` and are registered in `DEFINER-RLS-REGISTER.md`. | all | `rls-coverage.check.sql` (exists, fails the build) | **319 of 319** `public` tables enabled; **`FORCE` not set** (the CTO pack plans it for wave C0; see the README's touch point 1 before it lands) |
| C12 | **Indexing** | Every FK has a supporting index; every `tenant_id` table has an index led by `tenant_id` or a documented reason. | all | `indexes.check.sql` (exists) | **627 FKs, 0 unindexed**; 5 of 160 tenant tables have no tenant-led index |

C11 and the FK half of C12 are already good, which is why they are listed as a baseline and not as work.

## 3.3 Soft deletion and the end of a row's life

One rule: **pick the pattern by what the row means, not by habit.** A bare `is_deleted`/`active` flag is not
one of them: it records that something ended and not when, by whom or why.

| Pattern | Column(s) | Use for | Behaviour | Where it exists |
| --- | --- | --- | --- | --- |
| **Tombstone** | `deleted_at` | The student's own work that syncs between devices | Row stays 90 days so every device learns of the delete, then a sweep removes it. The student's promise ("until you delete it") is unaffected: the *student* deleted it. | `notes`, `tasks`, `appointments`, `sittings`, `courses`; weekly job `tombstones` |
| **State, never delete** | a `state`/`status` column with terminal values | Institutional records in Core mode | A drop, withdrawal or denial is a state; a correction is a new entry referencing the old | `registration_enrollments` ("never deleted"), `academic_record_entries`, `student_account_entries` |
| **Mirrored tombstone** | `external_deleted_at` + freshness `unavailable` | Data mirrored from a source system | Source deleted it: hide as "removed at source"; hard-delete after 30 days **unless held**; a later sync may un-delete | `canonical_entity_references`; sweep `integration_retention_sweep` |
| **Revocation** | `revoked_at` / `ended_at` / `released_at` (+ `*_by`, `*_reason`) | A grant, relationship, hold or session | The row is the history of the grant; it is not deleted when revoked | `family_grants`, `guardian_links`, `role_grants`, `legal_holds` |
| **Hard delete at expiry** | an `expires_at` | Ephemeral rows | Deleted by sweep at expiry | `lti_nonce`, rate-limit windows |
| **Erase with the account** | FK `ON DELETE CASCADE` to `auth.users` | Everything owned by one student | Removed by `erase_account`, derived from the catalog | 112 mapped columns |

Two consequences.

1. A table's `deletion_mode` in the registry must match one row above. `append_only` plus an FK to
   `auth.users` is a contradiction (the guard would refuse the account's erasure); the generic guard's
   header says so, and `convention_violations` flags `evidence_not_client_updatable`.
2. **Soft delete is not erasure.** A tombstoned row is still personal data until swept, and a mirrored
   tombstone is still education-record data for 30 days. Export and erasure paths treat tombstones as live
   rows (they are, by `account_data_map()`, which reads the catalog and not the flag).

## 3.4 Templates

The three shapes a new table starts from. All three are applied through helpers that exist in the proposals, so
the convention is a call, not a copy-paste.

```sql
-- tenant_record: an institution's row
create table public.example_item (
  id          uuid primary key default gen_random_uuid(),
  tenant_id   text not null references public.schools(id),
  -- columns ...
  unique (id, tenant_id)                           -- so children can reference (id, tenant_id)
);
select private.add_row_conventions('public.example_item', array['tenant_id']);   -- created/updated/row_version, tenant immutable
alter table public.example_item enable row level security;

-- a child that cannot point at another tenant's parent
create table public.example_child (
  id uuid primary key default gen_random_uuid(),
  tenant_id text not null,
  item_id uuid not null,
  foreign key (item_id, tenant_id) references public.example_item (id, tenant_id) on delete cascade
);

-- account_record: a student's row
create table public.example_note (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users(id) on delete cascade,   -- erasure derived from this line
  created_by uuid references auth.users(id) on delete set null,
  deleted_at timestamptz                                                  -- tombstone for multi-device sync
);

-- append_only_evidence: a fact that happened (people by hash or student_ref, never an FK to auth.users)
create table public.example_event (
  id uuid primary key default gen_random_uuid(),
  tenant_id text not null references public.schools(id),
  student_ref text not null,
  occurred_at timestamptz not null default now(),
  correlation_id text
);
create trigger example_event_append_only before update or delete on public.example_event
  for each row execute function private.refuse_mutation();
```

Every new table then adds its registry row (domain, class, classification, retention, deletion mode, steward);
`convention_violations` and `data_registry_gaps` must stay empty, or each remaining row must carry a dated
exemption with a reason of at least ten characters.

## 3.5 Adopting the conventions on 348 existing tables without a rewrite

Rules for the migration itself (they extend `DATA-MIGRATION-PLAN.md`; they do not replace it):

1. **Additive only, in the release before any code depends on it.** New nullable columns; `NOT VALID`
   constraints; new tables. No drop or rename in the same release as the code that stops reading it.
2. **Add the 38 missing tenant FKs as `NOT VALID`, then `VALIDATE` in a separate migration.** `NOT VALID`
   checks only new rows and takes a short lock; `VALIDATE` scans without blocking writes. Because `schools` rows
   are never deleted (`refuse_school_delete`), `ON DELETE` is irrelevant and the FK costs nothing in lifecycle
   terms. Run `validate` first as a query to see how many rows would fail; each failure is a real orphan.
   The 38: `audit_event`†, `capture_artifact`, `capture_asset`, `capture_segment`, `concept_evidence`,
   `console_audit_event`†, `data_subject_request`†, `gtm_campaign_links`, `gtm_campaign_reviews`,
   `gtm_communication_events`, `gtm_consent`, `gtm_conversion_events`, `gtm_suppression`,
   `integration_dead_letter_events`, `integration_duplicate_resolutions`, `integration_mapping_versions`,
   `integration_mappings`, `integration_reconciliation_discrepancies`, `integration_reconciliation_runs`,
   `integration_schema_drift_events`, `integration_schema_fingerprints`, `integration_scopes`,
   `integration_source_owners`, `integration_sync_errors`, `integration_sync_runs`,
   `integration_webhook_events`, `migration_approvals`, `migration_field_maps`, `migration_runs`,
   `mistake_evidence`, `registration_sections`, `role_grant_audit_event`†, `roster_snapshot`,
   `roster_staged_row`, `skill_claim_evidence`, `source_freshness_events`, `source_snapshots`,
   `support_access_event`. († nullable by design: platform events have no tenant.) Many are protected
   transitively by a composite key to a parent that has the FK (`capture_*`, `concept_evidence`); those need the
   direct FK only for the registry's rule to hold without an exemption, and are the safe ones to exempt first.
3. **Stamp, don't backfill.** `add_row_conventions()` leaves legacy `created_at` NULL. Reports treat NULL as
   "before this convention", not as epoch zero.
4. **Attach `stamp_row` to the 21 client-writable tables with an unmaintained `updated_at` first.** They are
   where a forged or stale value does harm (sync cursors, freshness).
5. **Registry before enforcement.** The generated seed ([`sql/generated_data_registry_seed.sql`](sql/generated_data_registry_seed.sql))
   makes the gap view list 348 `unconfirmed` rows. Stewards confirm domain by domain ([12](12-governance-operating-model.md));
   CI fails only on `unregistered`, `orphan_registry` and `convention_violations`, never on `unconfirmed`, until a
   domain's stewards have finished. Turning on the stricter check for a domain is a dated decision.
6. **Retire, don't multiply.** The seven append-only guards and ~20 `stamp_*` functions are replaced by
   `refuse_mutation()` and `stamp_row()` one table per change, each with its existing check suite green
   before and after. No bulk replacement.

## 3.6 Naming

`tenant_id` (not `school_id`/`institution_id`) for new tables; existing `school_id`/`institution_id` stay and are
listed in the registry as accepted legacy names with a view alias if a shared helper needs `tenant_id`.
`user_id` for owner; `*_by` for actor; `*_at` for instants; `*_cents` for money; `*_sha256` for hashed
references; `student_ref` for institutional pseudonyms. A rename is a separate, additive change (add the new
column, dual-write, retire the old), never part of a feature.
