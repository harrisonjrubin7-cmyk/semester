# 2 · Source of truth and precedence

## 2.1 What exists, and what does not

Verified in code (research, `app/src/lib/integration/`, `app/server/integration/`, migrations):

- **Precedence is a label, not a rule.** `SOURCE_OF_TRUTH: Record<ProviderDomain, string>`
  (`catalog.ts:125-132`, 21 domains) gives display text such as "Registrar / SIS". It is read by `dashboard.ts`
  to say "Source of truth stays X". No code ranks two competing values.
- **The only automatic conflict rule is `timestamp_regression`:** a provider sending an older version than the
  one stored is rejected (`pipeline.ts:248`). The mapping layer defines eleven conflict kinds
  (`type_mismatch`, `enum_mismatch`, `missing_required`, `duplicate_external_id`, `timestamp_regression`,
  `transform_error`, `scope_failure`, `classification_block`, `consent_block`, `rate_limit`,
  `deletion_mismatch`) but resolution beyond the first is a human workflow.
- **Student-entered vs institutional has no rule.** `reconcile.ts` compares syllabus dates to an LMS feed with
  fuzzy title matching and reports "moved"; it resolves nothing. `merge.ts` is device-vs-device last-writer-wins.
- **Write authority is already decided and good:** the governance envelope hard-codes
  `writeAuthority: 'source-system-only'` and `aiEligibility: 'denied_by_default'` for connected data, so
  Semester never writes back and "correction" means fix at source, next sync overwrites
  (`governance-envelope.ts`, `data-contracts.ts:80`).
- **Display already refuses to overclaim:** `isOfficialCurrent` is true only for
  `connected_institutional` data that is `live` or `recent`.
- **Authority per module per tenant is already a table:** `tenant_module_mode (tenant_id, module, mode)` with
  `mode ∈ {connect, core}`. *Core* = Semester is the record. *Connect* = Semester reads the school's system.
  Thirteen modules: `lms_assignments`, `lms_gradebook`, `lms_assessments`, `attendance`, `registration`,
  `degree_audit`, `records`, `admissions`, `student_accounts`, `financial_aid`, `scheduling`, `events`, `k12`,
  `advancement`. Core → Connect **freezes** the module's data; it never deletes it. Changed only through an
  approved request. (Zero rows today: no tenant has been activated.)

So the machinery for "native from inception, connected when available" is half-built: the mode is recorded,
the write boundary is enforced, the display is honest. What is missing is the ranking, and a per-entity
statement of who wins. That is this document.

## 2.2 Rules (apply to every row below)

1. **One system of record per fact at a time.** Everything else is a cache, a claim or a view, and is labelled
   as one. Which system is determined by the module mode, not by who wrote most recently.
2. **Core mode: Semester is the record, and it behaves like one.** Changes are append-only and approved
   (the `academic_record_*` and `student_account_*` pattern: `previous_entry_id`, `proposed_by` ≠ `approved_by`,
   hash chain, `student_ref` not account). A "correction" is a new entry that references the old one.
3. **Connect mode: Semester never writes an institutional fact.** It stores the value with `source_kind =
   connected_institutional`, `source_observed_at`, `ingested_at`, `mapping_version`, and a freshness state.
4. **Student-owned data is never overwritten by any other source.** If an institutional value disagrees with a
   student's own, both are kept and shown ("Your date: 5 Oct · Official: 7 Oct"); the official one is *shown as
   official*, the student's is *kept as theirs*. The student resolves their own copy.
5. **`derived` and `ai_generated` are never authoritative.** They rank below every human or institutional
   source, carry lineage ([04](04-events-and-lineage.md)), and display as estimates.
6. **Disconnecting a provider freezes, never erases.** Student-owned work is unaffected; institutional values
   go stale and are labelled (`stale`, `unavailable`); official *writes* fail closed.
7. **A tenant may reorder only among sources its contract allows, and only wholesale per (entity, field group)**,
   never row by row (a partial override could silently promote a source above the floor; tested as mutation `02b`).

## 2.3 Source kinds and the generic order

| `source_kind` | Meaning | Default rank for *official* facts | For *personal* facts |
| --- | --- | --- | --- |
| `connected_institutional` | Read from SIS/LMS/IdP/ERP | 1 | 3 |
| `manual_admin` | Typed by an authorised institution admin | 2 | 4 |
| `public_university` | Published catalog or web page | 3 | 5 |
| `derived` | Computed by Semester (syllabus-derived date, rollup) | 4 | 2 |
| `user_entered` | Typed by the data subject | 5 | 1 |
| `external_link` | A pointer to something Semester does not hold | n/a | n/a |
| `ai_generated` | Model output | never | never |

**Existing vocabularies and how they map** (`private.source_vocabulary`, proposal 02; a guard fails when either live
`CHECK` gains a value the table does not know). The CTO pack's "`SourceKind`" is the first row set.

| Existing value | Where | Tier | `source_kind` | Note |
| --- | --- | --- | --- | --- |
| `institution_verified` | `source_label` | institutional | *(not decidable from the label)* | a connector or an authorised admin; the provenance columns decide |
| `imported` | `source_label` | **ambiguous** | *(not decidable)* | an institution feed, or the student's own file? **Owner decision** |
| `student_entered` | `source_label` | user | `user_entered` | |
| `estimated` | `source_label` | derived | `derived` | always displayed as an estimate |
| `needs_review` | `source_label` | none | none | carries no authority until reviewed |
| `connected_institutional`, `manual_admin`, `public_university`, `user_entered`, `external_link` | `source_type` | institutional ×2, public, user, link | same name | 1:1 |

Encoded in `private.source_precedence` and read by `private.winning_source()` (proposal 02). The platform floor
(`tenant_id is null`) is seeded; a tenant row replaces the floor for its `(entity, field_group)` wholesale.

## 2.4 The matrix

`Core` / `Connect` name who is the record in each module mode. **Wins** is the order when sources disagree and
the field is *not* student-owned. **Conflict outcome** says what the product does. **Today** cites the
evidence in the repository, or says `—` where nothing implements it.

| Entity · field group | Core: record | Connect: record | Wins (high → low) | Conflict outcome | Student can | Today |
| --- | --- | --- | --- | --- | --- | --- |
| **Person** · legal identity (name, institutional id) | Semester identity | IdP / SIS | connected > manual_admin > user_entered | Official shown; request-correction workflow | View provenance, request correction | `profiles`, claim minimisation (`identity_claim_minimization`) refuses FERPA-category IdP attributes |
| Person · preferences, handle, about | Student | Student | user_entered only | None: not overridable | Edit freely | `profiles` |
| **Membership / role** | Semester provisioning | IdP + SCIM | connected > manual_admin | SCIM deprovision wins; grants revoked | View | `institution_membership.source`, SCIM tables |
| **Age status** | Student statement at sign-up or later | Same (an institutional age claim is **proposed**, not built) | Proposed: institution claim > statement; on disagreement the stricter (minor) applies | **Built:** fail closed, an account that never stated its age is not cleared | Correct a mistaken statement | `private.account_ages.source ∈ {sign_up, statement}`, `age_cleared()`, `is_minor()` |
| **Term** | Semester | SIS | connected > manual_admin | SIS wins | — | `registration_terms`; elsewhere a text code (**no shared key**) |
| **Course** (catalog) | Semester | SIS / catalog feed | connected > manual_admin > public_university | SIS wins | — | `catalog_sections.source_system`, `canonical_entity_references` |
| **Section** · schedule, capacity | Semester registrar module | SIS | connected > manual_admin | SIS wins; seat counts carry `synced_at` | — | `registration_sections` (Core), `catalog_sections` (Connect) |
| **Enrollment** | Registrar module | SIS | connected > manual_admin > user_entered | **Declared kept; official shown beside it; `conflict` flagged** | Keep or remove their declared row | **Three representations, not reconciled.** Proposal 02 `private.enrollment_reconciled` |
| Registration hold | Registrar module | SIS | connected only | Shown; never editable | View | `registration_holds` |
| **Degree requirement** | Registrar module | Degree-audit system | connected > manual_admin | Audit wins; student what-if is a labelled scenario | Run what-ifs (never official) | `graduation_scenarios` (what-if only); requirement entity **absent** |
| **Academic record / transcript** | Registrar module (append-only, approved, chained) | SIS | connected > manual_admin | Source wins; Semester never edits | Dispute workflow (not edit) | `academic_record_*`, ledger chain; dispute: — |
| **Grade** · official | Instructor via gradebook (operations, versions) | LMS / SIS | connected > manual_admin | Source wins; passback reconciled | View, regrade request | `grade_entries`, `grade_passbacks`, `regrade_*` |
| Grade · personal estimate | Student | Student | user_entered only | Labelled "unofficial"; never mixed into official | Edit | personal tracker; raw grades excluded from default offline storage |
| **Assignment** · due date | Instructor (native LMS) | LMS | connected > manual_admin > **derived** (syllabus) > user_entered | **Official date shown; student's kept**; syllabus-derived shown as unverified | Own reminder date | `reconcile.ts` (report only); no stored precedence |
| **Submission** | Semester LMS (draft → final) | LMS **receipt** | Receipt only: a submission is not submitted until the provider returns one | Fail closed to `draft` | Submit, see receipt | LTI receipt rules; native submission **absent** |
| Attendance | Instructor | SIS / LMS | connected > manual_admin | Source wins | View | module `attendance`; table absent |
| Advising appointment | Semester scheduler | CRM | connected > manual_admin > user_entered | CRM wins; student notes kept | Own notes | `appointments` (blob) |
| Accommodation | Disability office | Same | connected > manual_admin | Office wins; student controls sharing | Share/revoke, see who viewed | `accommodation_*` with access events |
| **Calendar event** · personal | Student | Student | user_entered only | None | Edit | local store |
| Calendar event · institutional | Semester | Calendar feed / SIS | connected > manual_admin | Feed wins; stale labelled | Hide | `calendar_feeds` |
| **Task, note, document, study set** | Student | Student | user_entered only | None: no other source may write | Full control | `tasks`, `notes` (blobs); documents device-only |
| Study materials · institution | Course staff | LMS | manual_admin > connected | Course policy governs AI use | — | `study_packs` (published, versioned) |
| **AI memory / context** | Student | Student | user_entered > ai_suggested_confirmed | `ai_generated` never promotes itself | Inspect, delete, pin, expire | `ai_memories` (**unwired**, `expires_at` has no sweep found) |
| **Student account entry** | Bursar module (append-only, chained) | ERP / bursar | connected > manual_admin | Source wins; reversal is a new entry | View, request plan | `student_account_*` |
| Payment plan | Bursar module | ERP | connected > manual_admin | Source wins | Request, view | `student_payment_plans` |
| Financial aid item | Aid office | Aid system | connected only | Shown; never editable | View | **absent** natively |
| **Family consent** | Student (and institution policy) | Same | Student's revocation always wins | Revocation immediate; projection removed | Grant, narrow, revoke | `family_grants` (`revoked_at`), `consent_record` |
| Guardian relationship | Institution-verified | SIS family contacts | connected > manual_admin (verified) | A relationship is **evidence only, grants no access** | — | `guardian_links` (`verified_by`) |
| **Opportunity listing** | Verified publisher | Employer / career system | manual_admin (verified) > connected | Moderation outcome wins | Hide, report | `opportunities` (`publisher_scope`, `status`) |
| Application | Student → provider | Provider | Provider receipt for status; student for draft | Receipt wins for status | Withdraw | **absent** |
| **Skill claim / credential** | Issuer | Issuer | Issuer only; Semester is **holder**, not issuer | `verification_state` from issuer | Share, revoke | `skill_claim` (`verified_by`), `evidence_reference` |
| Community post | Author (subject to moderation) | Same | Moderation decision > author | Removed content tombstoned | Edit/delete own | `community_posts` (`status`) |
| Support ticket | Semester support | Institution ticketing | Institution for status; student for content | Status from owner system | Add message, close | `support_tickets` (**no `tenant_id`**) |
| **Audit / evidence** | Semester control plane | Same | Append-only; no rank | Never edited | View own access log (90 d) | `audit_event`, ledger chains, `access_log` |

## 2.5 The conflict taxonomy and what the product does

| Situation | Detected by | Outcome | Evidence kept |
| --- | --- | --- | --- |
| Provider value older than stored | `timestamp_regression` (**built**) | Reject; record error | sync error row |
| Provider value differs, field not student-owned | winner by `winning_source()` | Higher rank stored as current; lower kept as `superseded` with lineage | lineage edge |
| Provider value differs, field **student-owned** | `student_owned = true` in `source_precedence` | **Both kept**, official shown beside student's | discrepancy row, `conflict = true` |
| Student declares what registrar denies | `enrollment_reconciled.conflict` (proposal 02, tested) | Declared kept; status `official_not_enrolled`; prompt student to remove or contact registrar | view row |
| Two connectors write one canonical field | `lineageConflicts` (built, per adapter) | Block mapping approval | mapping version |
| Classification or consent blocks ingest | `classification_block`, `consent_block` (built) | Drop record; never store | reconciliation row |
| Source deletes a record | `deletion_mismatch`, `external_deleted_at` | Tombstone, shown "removed at source"; hard-delete after 30 d unless held | `canonical_entity_references` |
| Source unreachable | freshness state `unavailable` | Fall back to native/manual; official writes fail closed | freshness event |
| Duplicate across sources | `integration_duplicate_candidates` (built) | Human resolution, append-only, reversible once; **never merges two people** | resolution row |

## 2.6 What this changes in the repository, in order

1. **Seed `source_precedence`** (proposal 02) and read it where `SOURCE_OF_TRUTH` labels are read today, so the
   label and the rule cannot differ.
2. **Adopt `private.enrollment_reconciled`** behind the classmate and registration screens; stop reading
   `enrollments` directly for anything that claims to be official.
3. **Add a `source_kind` + `source_observed_at` + `ingested_at` + `mapping_version` set** with
   `private.add_provenance()` to the tables in [03 §3.5](03-schema-conventions.md), starting with the 41 that
   already have a differently named source column.
4. **Link the two freshness SLAs.** `data-contracts.ts` `freshnessSlaHours` and `integration_source_owners`
   (`freshness_target_minutes`, `stale_threshold_minutes`) are separate sources of one number; one must derive
   from the other, with a test.
5. **Add the three missing contracts** to the registry: identity/IdP, catalog, and student-entered data
   (the last so the rules above are explicit instead of implied).
