# Registrar capability-to-code register

Reconciles the *Full registrar system blueprint* (data models, API specs, migration roadmap; 15 pages) against this repository on `origin/main` at `436687a1`.

It is the "capability-to-code register" the blueprint names as its next build artifact (§11). It records what the repo already has, what is partial, and what is missing. It does not claim anything is deployed or verified.

## Status legend

| Status | Meaning |
|---|---|
| **Schema** | A migration creates the table or function. Not verified against a database here. |
| **Partial** | Some blueprint behaviour exists; named gaps remain. |
| **Missing** | No table, function, route or test found by name in `supabase/migrations`, `app/`, `api/`, `server/`, or `packages/`. |
| **Blocked** | Needs an institution decision or input that the repo cannot supply. |
| **Doc only** | A document exists; no executable code. |

Nothing here is marked *Verified* or *Deployed*. Verification would need a database run (`supabase db reset` plus the registration and gradebook tests) and a deploy would need approval.

## Existing foundations relevant to the registrar

| Area | Evidence | Status |
|---|---|---|
| Registration transaction (terms, sections, enrollments, holds, overrides, requests, audit) | `supabase/migrations/20260929300000_registration_transaction.sql` | Schema |
| Enrollment RPCs: `registration_enroll`, `registration_drop`, `registration_withdraw`, `my_registration`, `my_registration_hold` | same file, `public.*` functions | Schema |
| Waitlist position and promotion inside the registration transaction | same file: `registration_position`, `registration_promote`, `waitlist_capacity` on sections | Schema |
| Idempotency keys on writers (8–128 chars; same key + different args → `idempotency_conflict`) | same file, `registration_key` | Schema |
| Optimistic section version (`version` moves on seat or waitlist change) | same file, section comment | Schema |
| Registrar term/section writes and override grant/decide | `registrar_put_term`, `registrar_put_section`, `registrar_grant_override`, `registrar_decide` | Schema |
| Registration readiness store and timeout contract | `20261009160000_registration_readiness_store.sql`, `20261010000000_…completed_outcome.sql`, `20261010140000_…timeout_contract.sql`; app tests under `app/server/institution/registration-readiness-*.test.ts` | Schema, with tests |
| Working gradebook: schemes, items, entries, moderation, release, regrade, LMS passback | `20260929310000_gradebook.sql` (`gradebook_*`, `grade_entries`, `regrade_requests`, `grade_passbacks`); `app/src/lib/gradebook/*.test.ts` | Schema, with tests |
| Official academic record ledger: subjects, changes, entries; append-only guard; `recorded_at` | `20260929210000_academic_record_ledger.sql`; `app/src/lib/record/ledger.test.ts` | Schema, with tests |
| Capabilities, role grants, school membership enforcement, break-glass, holds, audit | `20260922012000_capabilities.sql`, `20260924213000_role_grant_audit.sql`, `20260930185000_school_membership_enforcement.sql`, `20260930160000_override_break_glass.sql`, `20260930100000_legal_holds.sql` | Schema |
| Data classification and tenant-isolation matrices | `database/DATA_CLASSIFICATION_REGISTER.md`, `database/TENANT_ISOLATION_MATRIX.md`, `database/FUNCTION_AUTHORIZATION_MATRIX.md` | Doc only |
| Outbox and audit correlation (generic) | `20260928320000_audit_correlation_and_outbox.sql`, `20261008190500_projection_outbox_operations.sql` | Schema; not referenced by the registration migration |
| Terraform environments and modules | `infra/terraform/envs`, `infra/terraform/modules` | Exists; not assessed for registrar hosting |
| Data migration plan | `docs/DATA-MIGRATION-PLAN.md` | Doc only |

## Blueprint coverage by section

Identifiers are `REG-<section>.<n>`, so each blueprint item has one row.

### §1 Domain ownership

| ID | Capability | Status | Evidence / gap |
|---|---|---|---|
| REG-1.1 | Academic structures, terms, policies | Partial | `registration_terms` exists. No policy-version table, effective periods, or approval record. |
| REG-1.2 | Courses, programs, catalog versions | Missing | No course-version, program-version, or catalog tables by name. `course_studio` and `course_source` migrations cover course *content*, not catalog versions. Not reviewed for overlap. |
| REG-1.3 | Sections, meeting patterns, capacity, teaching assignments | Partial | `registration_sections` has seat and waitlist capacity. No meeting occurrences, teaching assignments, or capacity pools. |
| REG-1.4 | Eligibility, registration, enrollment, waitlists, withdrawals | Schema | Covered by the registration transaction RPCs above. Eligibility rules live in the RPC bodies and were not checked against the blueprint's prerequisite and restriction list. |
| REG-1.5 | Grade submission, posting, correction, academic history | Partial | Working gradebook exists. No link from gradebook to the official ledger was found. No grade-submission-to-posting workflow was found. |
| REG-1.6 | Transfer-credit evaluation | Missing | No tables or functions found. |
| REG-1.7 | Transcript snapshots and record-service workflows | Missing | No tables or functions found. |
| REG-1.8 | Registrar approvals, reconciliation, reporting, evidence | Partial | Audit events and ledger change records exist. No reconciliation-case table, and no reporting for registrars was found. |

### §2 Canonical database model

| ID | Capability | Status | Evidence / gap |
|---|---|---|---|
| REG-2.1 | Entity families (identity, academic structure, policy, curriculum, scheduling, enrollment, learning, official record, degree, services, governance) | Partial | Enrollment, learning and official-record families have schema. Curriculum, scheduling detail, degree, services and policy-version families are missing. |
| REG-2.2 | Common metadata (`institution_id`, `record_version`, `effective_at`, `recorded_at`, `supersedes_record_id`, provenance) | Partial | `recorded_at` is on the ledger. `record_version` exists on the registrar readiness records (`20261009160000_registration_readiness_store.sql`) and `effective_at` on course-material retention (`20261009001500_course_material_retention_policy.sql`), but neither is on the academic record ledger. No `supersedes_record_id` was found. |
| REG-2.3 | Composite tenant/object foreign keys | Unverified | Not checked in this pass. Needs a schema inspection test. |
| REG-2.4 | Invariant: no duplicate active enrollment for the same section | Schema (to verify) | Blueprint requires one live row per student and section. The registration migration has a "one live row" comment. Needs a constraint test. |
| REG-2.5 | Invariant: official decisions are not silently overwritten | Schema | Ledger has an append-only guard (`academic_record_entries_append_only`) and a change guard. |
| REG-2.6 | Invariant: issued transcripts reference stable snapshots | Missing | No transcript tables. |
| REG-2.7 | Invariant: source-import authority by object type and field | Missing | No source-import authority model found. |
| REG-2.8 | Invariant: private-document association does not grant faculty access | Unverified | Covered by the gradebook and course-source scopes; not verified here. |
| REG-2.9 | Invariant: repeat, bundle, cross-list status rules | Missing | No repeat, bundle, or cross-list policy structures found. |

### §3 Curriculum engine

| ID | Capability | Status | Evidence / gap |
|---|---|---|---|
| REG-3.1 | Course identity and versions (title, credits, prerequisites, restrictions, approval, effective terms) | Missing | See REG-1.2. |
| REG-3.2 | Program identity and versions (requirement graph, residency/GPA rules, exceptions, applicability) | Missing | No program tables. |
| REG-3.3 | Typed requirement graph (all-of, any-of, minimum credits, equivalency, minimum grade, residency, GPA, time-limited credit, substitution) | Missing | No requirement nodes. |
| REG-3.4 | Graph validation before publication (no invalid references or cycles; credit-allocation rules; rounding) | Missing | |
| REG-3.5 | Publication workflow (draft → department review → academic approval → validation → impact analysis → approved → effective-term publication) | Missing | |
| REG-3.6 | "A new catalog version does not change a student's catalog" | Missing | Depends on REG-3.2. |
| REG-3.7 | Golden cases approved by policy owners, rerun on every engine change | **Blocked** | Needs institution policy owners to supply cases. |

### §4 Scheduling engine

| ID | Capability | Status | Evidence / gap |
|---|---|---|---|
| REG-4.1 | Scheduling inputs (instructor availability, rooms, meeting patterns, linked components, cross-lists) | Missing | |
| REG-4.2 | Scheduling pipeline (proposal → constraint validation → candidate → human review → publication snapshot → enrollment-enabled) | Missing | Only the enrollment-enabled part exists as `registrar_put_section`. |
| REG-4.3 | Capacity model (physical, shared cross-list, reserved pools, linked components, offer reservations with expiry) | Partial | Seat count and waitlist capacity only. |
| REG-4.4 | Consistent lock order across capacity records | Partial | `registration_lock_term` exists; a multi-record lock order was not verified. |
| REG-4.5 | Change handling after publication (affected students, authority, effective date, resolution actions, notices, calendar reconciliation) | Missing | |

### §5 API specification

The blueprint's routes are `/v1/academic/*` HTTP endpoints. The repo implements these as Postgres RPCs in `public.*`, called through Supabase. No `/v1/academic` routes were found under `api/` or `server/`.

| ID | Blueprint route | Status | Closest existing |
|---|---|---|---|
| REG-5.1 | `GET /v1/academic/terms` | Partial | `my_registration` (student view only) |
| REG-5.2 | `GET /v1/academic/catalog-versions/{id}` | Missing | |
| REG-5.3 | `GET /v1/academic/sections` | Partial | Section data via registration reads; no filtered public search found |
| REG-5.4 | `GET /v1/academic/students/{id}/enrollments` | Partial | `my_registration` (self only). Staff read exists at the database layer: `authenticated` has SELECT on `registration_enrollments`, and `registration:administer` reads its school's rows. No HTTP route. |
| REG-5.5 | `GET /v1/academic/students/{id}/history` | Missing | |
| REG-5.6 | `GET /v1/academic/degree-audits/{id}` | Missing | |
| REG-5.7 | `GET /v1/academic/operations/{id}`, `receipts/{id}` | Missing | No operation or receipt model found |
| REG-5.8 | `POST /v1/academic/curriculum-publications` | Missing | |
| REG-5.9 | `POST /v1/academic/schedule-publications` | Missing | |
| REG-5.10 | `POST /v1/academic/eligibility-evaluations` | Partial | Readiness store and refusal reasons |
| REG-5.11 | `POST /v1/academic/registration-requests` (add/drop/swap) | Partial | `registration_enroll`, `registration_drop`, `registration_withdraw`, `registration_swap` (no HTTP route yet; the RPC is the transaction) |
| REG-5.12 | `POST /v1/academic/overrides` | Schema | `registrar_grant_override` |
| REG-5.13 | `POST /v1/academic/overrides/{id}/decisions` | Missing | `registrar_decide` decides enrollments in `pending_approval` only. `registrar_grant_override` writes a final override row with no pending or decision state. |
| REG-5.14 | `POST /v1/academic/waitlist-offers/{id}/acceptances` | Partial | Promotion exists; no offer-acceptance with expiry found |
| REG-5.15 | `POST /v1/academic/grade-submissions` | Partial | `gradebook_enter`, `gradebook_release`; no registrar submission |
| REG-5.16 | `POST /v1/academic/grade-postings` | Missing | No gradebook-to-ledger posting |
| REG-5.17 | `POST /v1/academic/record-corrections` | Partial | Ledger change records; no correction workflow found |
| REG-5.18 | `POST /v1/academic/degree-audit-runs` | Missing | |
| REG-5.19 | `POST /v1/academic/conferral-decisions` | Missing | |
| REG-5.20 | `POST /v1/academic/transcript-requests` | Missing | |
| REG-5.21 | Enrollment command envelope (`command_id`, `expected_schedule_version`, `override_references`, `reviewed_consequence_reference`) | Partial | Idempotency and version exist. No `reviewed_consequence_reference`. Field names differ. |
| REG-5.22 | Server derives actor and institution authority; no client-supplied role | Schema (to verify) | RPC bodies use `private.registration_*` helpers; not verified line by line. |
| REG-5.23 | Distinct outcomes (blocked, review-required, unknown, pending, confirmed, reconcile-required) | Partial | Refusals, `pending_approval`, and waitlisted states exist. No `unknown` or `reconcile-required` outcome found. |
| REG-5.24 | Same key + same payload returns the same operation; retry after uncertainty inspects the original | Partial | Conflict on different payload is implemented. Retry-inspection of the original operation was not found. |

### §6 Registration and enrollment workflows

| ID | Capability | Status | Evidence / gap |
|---|---|---|---|
| REG-6.1 | Readiness: ready / blocked / stale / unknown / review-required, routed blockers, re-evaluation | Schema | Readiness store and tests exist. Readiness is not a seat guarantee in the code. |
| REG-6.2 | Add/drop with validation steps 1–10 (window, standing, holds, overrides, prerequisites, credit load, clashes, linked components, capacity, version, atomic write, receipt, outbox, projections) | Partial | Window, holds, prerequisites, clash, credit load, capacity, version and audit exist in `private.registration_blocker` and the RPCs. Linked components and outbox were not found. |
| REG-6.3 | Atomic swap evaluated on the resulting schedule, original preserved on failure | **Implemented** (verified on local PostgreSQL 16, not 17; not deployed) | `registration_swap` in `20261018120000_registration_swap.sql`. The drop is written first and the add judged on the schedule it leaves; a refused add rolls the drop back in a nested block. Seat-only: a waitlist place or an approval-required section refuses. Checked by `supabase/registration_swap.check.sql` (25 checks); reverting the rollback turns it red. |
| REG-6.4 | Waitlist join → position → seat release → recheck → reserve → accept before expiry → confirm | Partial | Join, position and promotion exist. Expiry-based acceptance and release were not found. |
| REG-6.5 | Configurable queue policy (not FIFO by default) | Missing | Queue order is implemented as a fixed position rule. |
| REG-6.6 | Legacy authority during transition vs Semester authority after transfer | Missing | No authority-mode switch found. |

### §7 Gradebook and academic-history ledger

| ID | Capability | Status | Evidence / gap |
|---|---|---|---|
| REG-7.1 | Working gradebook (scores, rubrics, feedback, draft/released states, scoped editing) | Schema | `gradebook_*` functions and tests |
| REG-7.2 | Official ledger (course attempts, grade postings, credits) | Partial | `academic_record_entries`, `academic_record_changes`, `academic_record_subjects`. No course-attempt table, no grade-posting table, no credit-award table. |
| REG-7.3 | Releasing feedback does not post an official grade | Schema (to verify) | `gradebook_release` is separate from the ledger. No cross-write found, which is consistent. |
| REG-7.4 | Grade-posting workflow (validate scale → submit → review → official posting → projections → degree impact) | Missing | |
| REG-7.5 | Ledger entry contract (attempt, decision type, value, policy version, effective and recorded time, actor, approval, supersession, reason) | Partial | Recorded time, actor and change records exist. Policy version and approval reference were not found by name. |
| REG-7.6 | Versioned calculations (GPA mappings, repeat, transfer, credit-earned, rounding, standing, incomplete, multi-career) | Missing | No calculation module found in `app/src/lib/record` beyond ledger display (not verified). |
| REG-7.7 | Decimal arithmetic with retained inputs; deterministic projection rebuild | Missing | |
| REG-7.8 | Correction workflow (request → evidence → review → posting → recompute → issued-document impact) | Partial | `20260929210000_academic_record_ledger.sql`: a correction is a new ledger entry, approved under `record:override`, and the prior entry is kept. Recompute and issued-document impact were not found. |
| REG-7.9 | Issued transcripts are not silently regenerated | Missing | Depends on REG-1.7. |

### §8 IAM and infrastructure

| ID | Capability | Status | Evidence / gap |
|---|---|---|---|
| REG-8.1 | Identity + membership + scoped capability + relationship + purpose + lifecycle + delegation | Partial | Capabilities, memberships and school enforcement exist. Course, program and caseload relationships for registrar staff were not found. Purpose binding was not found. |
| REG-8.2 | Separate technical administration from education-record access | Doc only | Stated in `database/DATA_CLASSIFICATION_REGISTER.md`. Enforcement not verified here. |
| REG-8.3 | Company roles get no default access to academic records | Doc only | Same register. |
| REG-8.4 | Database constraints and RLS | Schema (to verify) | Many RLS migrations. Coverage of registrar tables not verified. |
| REG-8.5 | Restricted object storage | Partial | Course-source storage buckets exist. No registrar record storage. |
| REG-8.6 | Durable workers with leases and bounded concurrency | Partial | Projection outbox operations exist. Not registrar-specific. |
| REG-8.7 | Sanitized telemetry and named alert responders | Doc only | `docs/MONITORING.md`, `docs/CRISIS-RESPONSE-RUNBOOK.md` |
| REG-8.8 | Source mappings and integration quotas | Missing | |
| REG-8.9 | Server-enforced capability activation | Partial | Capability and rollout tables exist (`tenant_rollout`, `tenant_entitlement_projection`). |
| REG-8.10 | Exact commit, deployment and configuration evidence | Doc only | `docs/EVIDENCE-REGISTER.md` |
| REG-8.11 | Six maturity facts per included capability | **Blocked** | Requires a per-capability owner decision; not defined in the repo for registrar. |

### §9 Deployment and rollback

| ID | Capability | Status | Evidence / gap |
|---|---|---|---|
| REG-9.1 | Staged rollout (freeze → recovery check → additive schema → workers → app with activation off → backfill → compare → acceptance → cohort activation) | Doc only | `docs/ROLLBACK.md`, `docs/RESTORE.md`, `docs/STAGING.md` exist. No registrar-specific runbook. |
| REG-9.2 | Recovery matrix (app, worker, projection, migration, unknown external outcome, authority-transfer failure, corruption) | Doc only | Not registrar-specific. |
| REG-9.3 | Reconciliation plan for authority-transfer rollback | Missing | |

### §10 Legacy SIS migration

| ID | Capability | Status | Evidence / gap |
|---|---|---|---|
| REG-10.1 | Discovery, mapping, rehearsal, shadow, bounded cutover, expansion, retirement | Doc only | `docs/DATA-MIGRATION-PLAN.md` is generic. No SIS-specific plan found. |
| REG-10.2 | Repeatable import with exception handling | Missing | No SIS import code found. |
| REG-10.3 | Required reconciliation (identity, enrollments, grades, catalog, transfer, audit, credentials, transcripts, access, replay) | Missing | |
| REG-10.4 | Institution's legacy SIS, its schema, and its extracts | **Blocked** | No institution or extract supplied to the repo. |

### §11 Blockers

| ID | Blocker | Status |
|---|---|---|
| REG-11.1 | Institution-specific academic policies and golden cases | **Blocked** |
| REG-11.2 | Source extracts, identifier mappings and reporting obligations | **Blocked** |
| REG-11.3 | Hosting and worker configuration for the registrar | **Blocked** (needs release owner) |
| REG-11.4 | Named owners: registrar product owner, policy approvers, records lead, migration lead, release authority, institutional acceptance owners | **Blocked** |
| REG-11.5 | Authority to deploy to any environment | **Blocked** (approval required; not granted in this session) |

## Summary

- Strongest existing area: **enrollment transaction** (add, drop, withdraw, waitlist, holds, overrides, idempotent writes) and the **gradebook/ledger** pair. Both are schema-level with tests.
- Largest missing area: **curriculum and catalog versions**, **scheduling**, **degree audit**, **transcripts**, **grade posting into the ledger**, and **migration tooling**. None has tables or functions by name.
- Atomic swap (REG-6.3) is now implemented as `registration_swap` and verified on local PostgreSQL 16; it is not yet deployed, and PostgreSQL 17 was not available here.

## Next executable slices (unblocked)

1. Verify the schema claims marked "to verify" by running the migrations on a clean database and adding constraint tests for REG-2.3, REG-2.4 and REG-5.22.
2. ~~Add atomic swap to the registration transaction (REG-6.3)~~ Done: `registration_swap` with a test that a failed add preserves the original enrollment. Still open: an HTTP route for it (REG-5.11) and a run against PostgreSQL 17 and the remote project.
3. Add a grade-posting function that writes to the ledger from a submitted gradebook (REG-5.16, REG-7.4), with a test that a working-gradebook release does not post.
4. Design the catalog-version and program-version tables (REG-1.2, REG-3.1–3.2) as an additive migration, behind activation off.

Slices 2–4 need the CLAUDE.md decision-record step (`docs/decisions/D-<pr>.md`) once a pull request exists.

## Gates run for this change

This change adds the register and the atomic registration swap (REG-6.3): migration `20261018120000_registration_swap.sql`, the check suite `supabase/registration_swap.check.sql`, the grants and definer-register entries, and decision `docs/decisions/D-1549.md`. The swap suite (25 checks), the registration suite (100) and the grants suite (13) were run on local PostgreSQL 16, not PostgreSQL 17, and the migration has not run on the remote project. `tsc -b`, lint and the full `npm test` suite passed. The register's status claims were checked against migrations and code; the swap was executed, the rest of the register was not.
