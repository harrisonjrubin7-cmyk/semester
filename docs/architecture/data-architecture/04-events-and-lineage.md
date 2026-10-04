# 4 · Event schema and data lineage

## 4.1 What exists

[ADR 0008](../0008-event-envelope-and-outbox.md) decided the shape and it is sound; this document does not
reopen it. In brief: a `SemesterEvent` (`packages/institution/src/events.ts`) is written **in the same
transaction** as the record that made it true, into `private.domain_outbox_events`; a publisher sends pending
rows, parks one after five attempts; a consumer records one receipt per `(consumer, event)` in
`private.domain_event_receipts` whose primary key makes a second delivery a no-op at the database.

Measured on the code and the migrated schema:

| Fact | Value |
| --- | --- |
| Event types in the catalog | **50**, in 28 domains (`identity` 4, `support` 4, `ai` 7, `action` 3, `grade` 3, `assessment` 3, `connector` 3, …) |
| By classification | `internal` 22 · `student_private` 19 · `education_record` 9 · `public` **0** |
| By retention class | `audit` 23 · `operational` 13 · `student_record` 9 · `commercial` 5 |
| Producers writing the outbox | **none**: no code outside the definer register mentions `domain_outbox_events` (ADR 0008 says the same) |
| Sweep for outbox and receipts | **none** (owed by ADR 0008 and `RETENTION.md`; proposal 03) |
| Event-class vocabularies | 3: `public/internal/student_private/education_record`, `T0–T6`, TS `ResourceClassification` |

So the contract is ahead of its use. The work is to make it safe to switch on.

## 4.2 The envelope

Existing fields stay as they are. The additions are **optional and additive**: an older consumer ignores them,
which is the `ROLLBACK.md` rule (the previous build must still load).

| Field | Status | Rule |
| --- | --- | --- |
| `eventId`, `eventType`, `eventVersion`, `occurredAt`, `producer`, `environment`, `tenantId`, `actor`, `subject`, `correlationId`, `causationId`, `idempotencyKey`, `dataClassification`, `retentionClass`, `payload` | **exists** | `dataClassification` may be raised above the type's floor, never lowered |
| `purpose` | add | The reason the action happened (an audit purpose or product purpose). Required where `actor.type` is staff or support; it is what a FERPA access review asks. |
| `policyVersion` | add | The policy that decided. Lets a later review reconstruct *why* it was allowed. |
| `subjectRef` | add | `student_ref` (the institutional pseudonym) where the subject is a student, so the event can outlive the account without holding a person key. |
| `sourceKind` | add | `private.source_kind`; present when the event reports data from outside the producer. |
| `payloadSchema` | add | `eventType@version`, resolved against the registry; makes the payload checkable without code. |

**Payload rule.** An event carries the *fact that something changed* and the identifiers needed to fetch it,
not the data. A `grade.posted` event carries the `grade_entries.id`, the `item_id`, the version; it does not
carry the score. A consumer that needs the score reads it through its own authorisation. This keeps the
outbox out of the personal-data estate: after the early scrub (4.5) what remains is an envelope.

## 4.3 The registry

`private.event_type_registry` (proposal 03) holds one row per `(event_type, event_version)`: owning domain,
classification floor, retention class, a JSON Schema for the payload, the payload paths that are personal data
(`pii_paths`), whether the type feeds the analytics projection, and a status
(`draft → active → deprecated → retired`). The TypeScript catalog stays the authoring source; a parity test
(the one `events.test.ts` already runs between the migration's classification list and the TS list) extends to
the registry. Once seeded, the outbox gains a `NOT VALID` foreign key `(event_type, event_version)` so an
unregistered type cannot be written at all.

Checks the registry enforces by construction (all tested in `tests/01_registry.test.sql` and
`tests/03_outbox_sweep.test.sql`):

- a type with personal-data paths cannot have a floor below `student_private`;
- an `education_record` event is never `analytics_projection`;
- a deprecated or retired type has a `deprecated_at`;
- `private.event_class_to_tier()` maps `public→T0`, `internal→T1`, `student_private→T2`,
  `education_record→T3`, so the three vocabularies agree in one place.

**Versioning rules.** Additive payload changes (a new optional field) keep the version. Removing or retyping a
field is a new version; both versions are `active` until every consumer's receipts show the old one drained,
then the old is `deprecated`, then `retired`. A consumer refuses an unknown type or a version it does not know
and parks the event for an operator; it never guesses (existing behaviour: `validateEvent`).

## 4.4 What must emit events, in the order that unblocks something

The catalog covers identity, support, AI, grades, assessments, connectors, payments and subscriptions. It does
not cover the places where the audit asks for provenance and the analytics platform needs a source. Proposed
next types (all `v1`, owner domain in brackets), each added **in the same change as its first consumer**
(ADR 0008's rule):

| Domain | Event types | Consumer that justifies it |
| --- | --- | --- |
| Academic | `registration.enrolled`, `registration.dropped`, `registration.withdrawn`, `record.entry_posted`, `record.entry_corrected` [academic] | Today action centre; ledger-chain verification; reconciliation |
| Consent and family | `consent.granted`, `consent.revoked`, `family.grant_created`, `family.grant_revoked`, `family.item_projected` [family] | Projection removal on revoke; guardian activity feed |
| Lifecycle | `erasure.requested`, `erasure.completed`, `export.generated`, `hold.placed`, `hold.released`, `restore.completed` [governance] | Rights-request SLA; sweeps skip held data; post-restore follow-up |
| Search and AI | `search.document_indexed`, `search.document_removed`, `ai.retrieval_served`, `ai.retrieval_denied` [ai] | Index freshness; retrieval log; classification-denial alerts |
| Integration | `source.record_changed`, `source.record_removed`, `reconciliation.discrepancy_opened`, `schema.drift_detected` [integration] | Downstream invalidation by lineage; steward alerts |
| Finance | `account.entry_posted`, `plan.requested`, `plan.decided` [finance] | Student-visible ledger; reconciliation |
| Campus and support | `community.post_removed`, `case.escalated`, `ticket.status_changed` [support] | Moderation SLA; student notice |
| Productivity | `task.completed`, `agenda.shared` (exists), `sitting.recorded` [productivity] | **The analytics projection** (06): weekly active, study sittings, completed work |

Local-first writes (tasks, notes) happen on a device; an event is emitted when the change **syncs**, by the sync
endpoint, in the transaction that applies it. A device never writes the outbox.

## 4.5 Outbox lifecycle: scrub, then expire

Proposal 03's `private.sweep_outbox()`:

1. **Scrub** a published event's payload to `{}` after 30 days (parked events after 90).
2. **Expire** the envelope by retention class: `operational` 90 d, `student_record` 400 d, `commercial` 400 d,
   `audit` 3 years (the audit-retention clock already used for `audit_event`).
3. Delete the consumer receipts of an expired event.
4. **Never** touch an unpublished or parked row's envelope: it is an operator's, and expiring it would hide a
   delivery failure.
5. **Held tenants and a platform hold stop both steps** (reusing `tenant_is_held`/`platform_is_held`).

Tested against seven rows covering each branch, plus a platform hold; three mutations (tenant hold ignored, platform
hold ignored, parked rows expired) each turn the test red. The windows are proposals for a steward to confirm,
not facts; the mechanism is what is verified.

## 4.6 Lineage: four layers, one purpose each

The question every layer answers: *where did this value come from, and what else did it feed?*

| Layer | Granularity | Where | Answers | Status |
| --- | --- | --- | --- | --- |
| **Record provenance** | per row | `source_kind`, `source_ref`, `source_observed_at`, `ingested_at`, `mapping_version` (`add_provenance`) | Which source said this, when, under which mapping? | 41 tables, 8+ naming variants → one set |
| **Field lineage** | per canonical field **per mapping version** | `lineage.ts` `lineageOf`; `integration_mapping_versions` | Which external field becomes this canonical field, by what transform? | **built** (`lineageConflicts` blocks two writers of one field) |
| **Derivation edges** | per (derived, input) pair | `public.lineage_edge` (proposal 02) | What was this derived from; what must be rebuilt if an input changes or is erased? | proposal, tested (cycle-safe, tenant-fenced, depth-bounded) |
| **Causation chain** | per event | `correlationId`, `causationId` | What request caused this event; what did it cause? | envelope exists; no producers |

Why four and not one: a row's provenance is cheap and constant; field lineage is per mapping and changes
rarely; derivation edges are per derived record and grow fastest; causation is per request. Storing them as
one table would pay the cost of the largest for the value of the smallest.

**`lineage_edge` is not a copy of the data.** It stores kinds, ids, an input version (row version, etag or hash
at read time) and the derivation name and version. A derived thing that points at `input_version = 7` can be
shown stale when the input becomes 8, which is the same trick optimistic concurrency uses.

Three uses, each already a requirement somewhere:

1. **Correction at source.** A source system changes a due date → `private.downstream_of(tenant,
   'assignment', id)` lists every Today action, plan and AI answer built from it → they are re-derived.
2. **Erasure.** After `erase_account`, derived records that cite erased inputs are found by the same walk and
   rebuilt or deleted, so a deletion does not leave a rollup that still reflects the student.
3. **AI answers.** A model answer's `evidenceIds` already come back on the response (Path B). They become
   edges (`ai_answer → evidence_reference`), so "what did this answer rest on, and is it still true?" is a
   query, not an investigation.

## 4.7 Tests

| Test | File | What it proves |
| --- | --- | --- |
| Outbox sweep branches + holds | `tests/03_outbox_sweep.test.sql` | scrub, expire, receipts, held tenant, platform hold, pending and parked rows untouched, audit class outlives operational |
| Registry constraints | `tests/01_registry.test.sql` | the rules in 4.3 |
| Lineage walk | `tests/02_provenance.test.sql` | three-hop chain, a cycle terminates, another tenant sees nothing |
| Parity (to write) | extend `events.test.ts` | every `EVENT_TYPES` entry has exactly one registry row at the same version and floor, and vice versa |
| Contract (to write) | per consumer | the consumer parks an unknown version rather than processing it |
| Idempotency (exists) | `outbox.check.sql` | a consumer's second receipt for one event is refused |
