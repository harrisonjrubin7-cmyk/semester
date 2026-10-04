# 5 · Classification, retention, deletion, legal hold, backup, export, restore

Every control below is labelled **built** (a migration or function enforces it, and a check suite exists),
**documented** (a document says so; nothing enforces it), or **proposed** (this work; tested where stated).
The label matters more than the prose: the repository's own validation passes say plainly that live deletion,
provider-data restore and an operated rights-request response are *not* established, and this document does not
upgrade a claim.

Anything that is a legal conclusion is marked **counsel**. This work states what the data model must be able to
express. It does not state what a statute requires.

## 5.1 The constraint that shapes everything: the promise

`app/src/lib/privacy.ts` tells every student, on a screen:

> **How long anything is kept.** Until you delete it. There is no retention schedule that quietly removes your
> work, and no archive kept after you delete your account. … The one thing that does age out is not your work
> but a record about it.

`RETENTION.md` turns it into a rule and this model keeps it: **a retention clock may age out a record *about* a
student's work. It may not age out the work.** Adding a clock to `notes`, `tasks`, `courses`, `state` or
anything else a student typed would make that paragraph false. In the registry this is a constraint, not a
convention: `retention_class = 'until_deleted'` cannot be combined with a tombstone clock and a day count.

The promise also means **institution-owned records about a student are a different class**. A grade or a
ledger entry is the institution's record (it is in `T3`, `school_rule` retention); the student's copy of their
own notes about it is theirs. Where the two touch (a student erases their account; a school must keep a
record) the model is explicit: erasure removes the student's account and everything they own; it does not and
cannot remove an institution's record, which is keyed by `student_ref` and survives by design. **counsel**:
whether and how a school's retention minimum constrains erasure by jurisdiction.

## 5.2 Classification

**Stored tiers.** `data_classification_rules` seeds the platform floor; a tenant may only be stricter
(`private.refuse_looser_classification`). Verified seed:

| Tier | Examples | Semester | Approved AI | Consumer AI | Connector | Community | Retention default |
| --- | --- | --- | --- | --- | --- | --- | --- |
| T0 public | catalog, public events | ✓ | ✓ | ✓ | ✓ | ✓ | tenant default |
| T1 course-authorised | slides, rubric | ✓ | ✓ | ✗ | ✓ | ✗ | course term + 1 year |
| T2 student-owned | notes, drafts, plan | ✓ | ✓ | ✗ | ✗ | ✗ | student-controlled |
| T3 education records | enrolment, grades, advising | ✓ | ✓ (approved env. only) | ✗ | ✗ | ✗ | minimum necessary; institution policy |
| T4–T6 | sensitive categories | ✗ never ingested | ✗ | ✗ | ✗ | ✗ | not stored |

Constraints already in the schema: `T3` rows need a `subject_user_id`; T3–T6 can never be `allowed_in_consumer_ai`;
T4+ can never be allowed anywhere. These are good.

**Where the stewardship matrix and the stored data disagree** (a classification decision for a steward and
**counsel**, not something a data architect can settle):

| Item | Matrix says | The repository does | Why it matters |
| --- | --- | --- | --- |
| **Disability accommodations** | T4 ("Health, disability, counseling, conduct, aid"): *blocked by default, strict legal route* | Stores `accommodation_passports`, `_shares`, `_access_events` (student-owned, with logged access) | The registry's `CHECK` allows only `T0`–`T3`; a table that is T4 **cannot be confirmed** there. Either the matrix means *institution-sourced* disability records (and a student's own passport is T2/T3), or these tables need a different route. |
| **Financial aid** | T4 | `data-contracts.ts` registers "Bursar and aid actions" as **T3** | Two classifications for one thing; the contract is what the connector enforces |
| **Conduct** | T4 | `community_cases`, `community_safety_entries`, moderation tables hold safety and conduct-adjacent content | Is a moderation case "conduct" in the matrix's sense? If so it is T4 and stored |

Until decided, the registry seed leaves classification unset for all three rather than guessing.

**Three problems, one fixed by this work.**

1. **Three vocabularies** (the tiers; the events' `public/internal/student_private/education_record`; the TS
   `ResourceClassification`). *Proposed fix, tested:* `private.event_class_to_tier()` (proposal 03).
2. **Per-table classification is mostly implicit.** 9 of 348 tables carry a column. *Proposed:* one tier per
   table in `private.data_registry`; a table that mixes tiers keeps a column. The generated seed leaves it unset
   so it is confirmed by a steward, not guessed ([12](12-governance-operating-model.md)).
3. **The floor is not consulted when it matters.** The rules are read only by policy simulation and by
   connector ingestion, never by the AI path ([09](09-ai-data-access.md)). *Proposed:* retrieval purposes carry
   a `max_tier`; search never indexes T3 (a `CHECK`).

## 5.3 Retention matrix

Every clock in the repository today, plus the proposed ones, by record class. "Owner" is who may change it;
nothing in this table is changed by this document.

| Record | Clock | Basis / owner | Enforced by | Status |
| --- | --- | --- | --- | --- |
| Student work (`notes`, `tasks`, `state`, …) | **none: until deleted** | The promise (5.1) | the absence of a clock; registry check | built |
| Student-deleted work (tombstones) | 90 days | So every device learns of a delete | weekly job `tombstones` → `sweep_tombstones` | built; **not hold-aware** (gap) |
| `access_log` (who read your rows) | 90 days | Privacy screen | pruned on write | built |
| `activity` (the pilot's instrument) | 400 days | `ANALYTICS.md` | pruned on write | built |
| `audit_event` and the three audit-event tables | 3 years | Audit | daily `audit-retention`; hold-aware | built |
| `gateway_audit`, `gateway_intelligence_audit` | 180 days | metadata only | hourly `gateway_purge_journal` | built; **not hold-aware** (gap) |
| `ai_policy.retention_days` (0–3650, default 30) | per tenant | Tenant AI policy | applied to AI usage metadata only; **not** to the audit tables (fixed 180 d) | built, inconsistent |
| `gateway_review` | 1 day past expiry / 90 days completed | Two-phase actions | `gateway_purge_journal` | built |
| Invitations | 90 days; unconfirmed signups 30 days | | `sweep_stale_invites`, `sweep_abandoned_signups` | built; hold-aware |
| Integration mirrored records | 30 days after `external_deleted_at`; snapshots by `retention_expires_at` | Source deleted it | `integration_retention_sweep` | built; hold-aware |
| Financial records (individual billing) | 7 years | D-132 | `purge_financial_records` | built; **not hold-aware** (gap; `RETENTION.md` says "none to gate", stale) |
| Institutional records (`grade_entries`, ledgers) | **school's rule** | The institution | none | **grade_entries has no clock** (`RETENTION.md`: "not yet set here"); **counsel** |
| Ledger chains and manifests | never | Evidence | immutability triggers | built |
| `domain_outbox_events`, `domain_event_receipts` | scrub 30 d, envelope by class | ADR 0008 | `sweep_outbox` | **proposed, tested** |
| `search.document`, `ai.chunk` | life of the source row | Derived | FK cascade; tombstone | proposed, tested |
| `ai.retrieval_log` | 180 days (matches gateway audit) | Metadata only | sweep (to write) | proposed |
| Analytics facts | pseudonym epoch; aggregates ≥ k | Derived | salt rotation; k-suppression | proposed, tested |
| `school_offboarding`, `school_offboarding_undo` | never deleted | Evidence | trigger | built |
| `support_access_event` | not swept | FERPA access record | none | built (deliberate) |
| Provider backups | **7 days claimed** | Supabase plan documentation | none | **documented only, not read from the dashboard** |

Two facts in the table were wrong or stale in the documents and are corrected here: the financial purge exists
(`scheduler.sql:495-505`), and `RETENTION.md`'s "a legal hold does not exist (RM-02)" predates `legal_holds`.
What remains true of RM-02 is that **a hold does not reach provider backups**.

## 5.4 Deletion

### Account erasure (built, with named limits)

`erase_account(uuid)` runs in one transaction, `service_role` only. It calls ten `forget_my_*` functions as the
target account, then deletes or nulls every column returned by `private.account_data_map()`, **a function that
reads the catalog at call time**, so a new table with a foreign key to `auth.users` is covered without anyone
remembering to add it (the property that makes C2 in [03](03-schema-conventions.md) the erasure policy). It then
re-counts and raises if any row still names the account, and writes a non-identifying `data_requests` receipt.
A before-delete trigger on `auth.users` is the backstop for holds.

| Limit | State |
| --- | --- |
| Only single-column FKs to `auth.users`, schemas `public` and `private`, are mapped | Verified: of 39 person-shaped columns with no such FK, none is an erasure gap (checked: billing ids, staff-actor columns on append-only history, composite-FK children cascaded through a mapped parent) |
| Staff who wrote to four append-only history tables cannot be erased; the function fails closed | Known, documented |
| Storage objects | **Not exercised.** The 2026-09-30 drill had none and says storage deletion is unproven |
| The `delete-account` Edge Function end to end | **Not exercised** by the drill (it ran a rolled-back block) |
| Device-held files (`semester-files`, drafts, snapshots) | Not in the server export or erasure; `eraseDevice()` is a separate client path |
| **Derived stores** (search, AI chunks, analytics, projections) | Proposed: `search.document.owner_user_id` and its children cascade, so they are in `account_data_map()` automatically; analytics holds no person key (5.7) |
| Answering a data-subject request | `data_subject_request` has a 30-day due date and **no screen and no named answerer** |

### Tenant offboarding (built to the step before the purge)

`school_offboarding` is a state machine: `proposed → approved → access_disabled → export_verified → archived →
(restored)`, two people at the gates, a minimum 30-day archive (default 90, a placeholder pending counsel),
and `authorize_school_purge` by a third person with no live hold. **It deletes nothing**: a trigger refuses to
delete a school row, and the export file generator, student notification and the purge itself are not built.

*Proposed, tested:* `private.tenant_data_manifest(tenant)` lists every table carrying `tenant_id` with that
tenant's row count, its registry class and whether it is held. Step 6 (export verified) compares the export's
counts to it; after a purge it is the **zero-row proof**; during archive it shows what is still held. It is the
missing arithmetic between "export recorded" and "export complete". A graduate's account is never tied to a
tenant's offboarding (person is not membership), which is what makes alumni continuity possible.

## 5.5 Legal hold

**Built.** `legal_holds` (`account`, `tenant`, `platform`; two-person release by `CHECK`; never deleted),
`account_is_held`/`tenant_is_held`/`platform_is_held`, an erase wrapper that refuses before any delete, a
before-delete trigger on `auth.users`, hold-aware rewrites of six sweeps, and two DB check suites
(`legal-holds.check.sql`, `hold-gated-sweeps.check.sql`).

**The gap, measured structurally.** Of 22 deleting functions named like sweeps, purges or erasures, 6 are
hold-aware, 11 are reachable only through the hold-checking erase wrapper, 2 are ephemeral by design, and **3 are
neither**: `gateway_purge_journal`, `purge_financial_records`, `sweep_tombstones`. The header of
`20260930140000_erase_respects_holds.sql` already names the failure mode (a later `create or replace`
silently dropping a check) and nothing guards it.

*Proposed, tested:* `private.sweeps_without_hold_awareness()` plus a dated exemption table (proposal 11), the
structural analogue of `rootunmount.test.ts`. On today's schema, with the three gaps removed from the
exemption table, it returns **exactly those three** (the control); a new blind sweep is flagged; an expired
exemption stops silencing; a known gap cannot be parked beyond 120 days. Four mutations each turn it red.
The three functions then each take a one-line `if tenant_is_held(...) then continue` and the guard goes silent
without exemptions. That is the work, in size order: it is three small changes plus one test.

**Still not covered** (from `RETENTION.md`, restated): escalation deliveries, volunteer events, on-device
deletion, **provider backups**.

## 5.6 Backup, restore and recovery

| Question | Answer today | Evidence |
| --- | --- | --- |
| Backup cadence | "Daily, 7-day expiry" | Stated in `RETENTION.md`; **the Pro-tier documented number, not read off the dashboard** |
| Point-in-time recovery | Not confirmed on | `RESTORE.md`: a paid add-on, blank row in its results table |
| Restore drill on production data | **Never done** | `docs/evidence/restore/2026-09-30-logical-rehearsal.md`: "that drill has never been done… G5 stays UNMET" |
| What was rehearsed | A logical restore on a throwaway PG17 with one account | timings are meaningless for production; CI re-runs the rehearsal |
| RPO / RTO | **Deliberately unpublished** | `DISASTER_RECOVERY.md`: "do not publish an RPO or RTO"; "not promised until measured" |
| Code rollback | < 5 min measured 76–180 s | `ROLLBACK.md` (code only; the schema never rolls back, forward-fix) |
| Deleted rows after a restore | A restore **resurrects** them | D-124 chose not to keep a deletion ledger; `RESTORE.md` says run the sweeps and notify every account in the window |

### What is proposed and what is not

- **Not proposed: a deletion ledger.** D-124 is a merged decision and this work does not re-tune it. The cost
  of that choice is real and worth recording once: after a restore, an erased account's rows can reappear until
  the sweeps run, and **there is no record of whom to re-erase**. The existing `data_requests` receipt is
  deliberately non-identifying. If the owner ever revisits D-124 the minimum that closes it is a salted-hash
  list of erased account ids with the erasure date, held under the same hold and access rules as
  `legal_holds`, replayed after a restore. That is an option for a person to decide; no code is proposed.
- **Proposed, tested:** `private.restore_event` and `private.accounts_to_notify_after_restore()`: the
  executable form of the follow-up `RESTORE.md` already prescribes. It records *when* a restore happened and
  which accounts were **active** in the window (from `activity`), never who asked to be erased. A production
  restore cannot be closed (`accounts_notified_at` set) before its sweeps ran. It also records `measured_rpo`
  as `restored_at − restore_point`, so the first real drill produces the number the documents refuse to
  publish until it exists.
- **Required before any RPO/RTO claim:** a drill on a branch of the real project that (1) restores to a chosen
  point, (2) runs `supabase/fingerprint.sql` against it, (3) runs `ensure_rls`, (4) times each step, (5) writes
  a `restore_event` row. Until that exists the correct statement to a customer is the existing one.
- **Backups and holds.** A hold cannot stop a provider's backup expiring. The only controls are a provider
  feature (export-on-hold) or a Semester-run logical export under hold. **counsel** and the owner decide which;
  the registry and `legal_holds` already say what must be preserved.

## 5.7 Export and portability

| Export | Built | Gap |
| --- | --- | --- |
| Account export | `export_my_data()` → `private.account_export`: mapped columns with `exported = true` (149 of 150 `clear`, 110 of 112 `delete`), plus cascade children to depth 4, plus `invites`, `beta_invitations`, and the auth record without credentials. Format `semester.account-export` v1. Logs a `data_requests` row. | No `manifest.json`; device files are not included; `blocks.blocked`, `reports.about`, `community_safety_entries.user_id` are erased but withheld from the export by design (stated in the output's `withheld` array) |
| Tenant export | Offboarding step 6 *records* a hash and counts of an export made elsewhere | **No generator.** `tenant_data_manifest` (proposed) is what the counts must equal |
| Institution portability | `DATA-PORTABILITY-AND-OFFBOARDING.md` plans a package; `institution_offboarding_requests`/`offboarding_exports`/`data_deletion_confirmations` do not exist as such | `school_offboarding` is the realisation; the per-category deletion confirmation is not built |
| Career and alumni portability | Credentials are held, not issued, by Semester; skill claims carry their issuer's state | A portable, signed credential export is not built |

Export is subject to the same classification as everything else: T3 institution records leave only through the
institution's channel, not the student's self-service export, unless the institution's policy and **counsel**
say otherwise. The student's export contains what the student owns plus what the institution has already
shown them.

## 5.8 Analytics and derived data under erasure

Derived stores must not be a way to keep what was erased. The rule for each:

| Derived store | Person key? | On erasure |
| --- | --- | --- |
| `search.document`, `ai.chunk` | `owner_user_id` FK `ON DELETE CASCADE` | Removed with the account; in `account_data_map()` automatically |
| `lineage_edge` | none (kinds and ids) | Rows naming erased inputs are found by `downstream_of` and the derived records rebuilt |
| Analytics facts | **none**: a per-epoch pseudonym `HMAC(salt_epoch, id)`, and only counts ≥ k are published | The raw source rows are erased; the pseudonym cannot be re-derived once the epoch's salt rotates; published aggregates are anonymous at k ≥ 10. **counsel**: whether a k-suppressed aggregate is outside erasure scope. |
| Outbox | none after the 30-day scrub | envelope only (type, ids, tenant, correlation) |

## 5.9 Verification, in one place

| Control | Verified how | Result |
| --- | --- | --- |
| Outbox sweep, holds | `tests/03_outbox_sweep.test.sql` + 3 mutations | red on each mutation |
| Tenant manifest | `tests/04_lifecycle.test.sql` + mutation (leaks other tenants) | red |
| Restore record | same file + mutation (production restore closes without sweeps) | red |
| Hold coverage guard | `tests/11_hold_coverage.test.sql` + 4 mutations | red; finds the 3 real gaps |
| Erasure, export, holds on a live project | **not run** | the repository's own pass says so |
| Provider backup, PITR, restore time | **not run** | no drill has touched production |
