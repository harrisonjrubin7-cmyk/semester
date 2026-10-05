# Education graph architecture

Status: Phase 0 baseline plus a proposed target, assessed 2026-10-05 at `790ebbf`. "Today" columns are read from migrations and code; "Proposed" sections are design and are labelled so. Nothing proposed here is applied. Companion to [the product map](EDUCATION_OS_PRODUCT_MAP.md); the authority per domain is in [DOMAIN_AUTHORITY_MATRIX.md](DOMAIN_AUTHORITY_MATRIX.md).

## Why a graph

The defensible asset is not any one feature but the relationships among them: a student plans a course, the plan changes workload, workload changes suggested tasks, the task links to a course objective, a missed task creates a support signal, the signal offers an explainable intervention, the outcome informs institutional insight, and the student still controls private content and sharing. That chain only holds if every hop is a typed edge with an owner, a tenant, a permission rule and an audit event. This document makes the edges explicit and records where today's schema has them, lacks them, or holds them in a different shape than the model wants.

## Ground truth about today's schema

These facts shape every graph below (foundation audit, 2026-10-05):

- The tenant is `public.schools(id text slug PK, name, email_domains[])`. **There are no `institution`, `campus`, `program` or `department` tables.** "Campus" is a `schools` row (ADR `docs/architecture/0005-multi-campus-scoping.md`).
- About 321 public and 31 private tables, all with RLS enabled, none forced. `database/schema/table-classification.json` puts every table in a class: tenant-scoped 155, relationship-scoped 55, service-only 77, person-private 46, parent-scoped 8, global-public 7, global-reference 4. 149 public tables carry no tenant column.
- `public.courses` is per-user JSONB `(user_id, id, data)` and `enrollments(user_id, term, code)` has no tenant. Tenant-bearing course data is `catalog_sections`, `registration_terms`, `registration_sections`.
- `role_grants.scope_kind/scope_id` are text with no foreign key. `private.has_capability` matches scope **exactly**; nothing inherits down a tree.
- Three membership models coexist: `profiles.school_id` (claim), `institution_membership` (SSO and SCIM), and `role_grants` plus `organization_members`.
- Four classification vocabularies coexist: T0–T6 (`data_classification` enum), C0–C4 (`docs/product/capability-inventory.md`), `ResourceClassification` (public, internal, student_private, education_record in `packages/institution/src/policy.ts`), and the table-isolation classes.

## Edge attribute template

Every edge in the catalog answers ten questions. A new edge is not merged without them.

| Attribute | Question |
| --- | --- |
| Source authority | Which system or actor is allowed to assert this edge? |
| Tenant scope | What bounds it: tenant, person, relationship, global? |
| Permission rule | Which RLS policy or capability decides who reads and writes it? |
| Classification | T-tier (`data_classification`) |
| Retention | How long, and what sweeps it |
| Consent | What consent record, if any, must exist |
| Audit event | Which stream records writes and reads |
| Integration source | Which connector may populate it |
| Migration source | Which legacy system is imported from, and by what path |
| Native status | NV / NI / INT / DO / PL / NS (see product map) |

Abbreviations in the tables: **T** tenant, **P** person-private, **R** relationship-scoped, **G** global. Audit stream names are real tables.

## Graph 1: identity

| Edge | Authority | Scope | Permission | Class | Retention | Consent | Audit | Integration | Migration | Status |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `auth.users` → `profiles` (`school_id` via `claim_school()` only) | Account holder, then email-domain claim | P, then T | Owner RLS; `school_id` write-pinned (`20260921211500_pin_profile_school.sql`) | T1 | With account | none | `audit_event` | none | none | NV |
| `schools` → `institution_identity_provider` | Tenant admin | T | Service role | T2 | Kept | none | `provisioning_audit_event` | SAML metadata | IdP export | NI |
| `institution_identity_provider` → `institution_membership(auth_user_id, status, roles[])` | IdP via SSO or SCIM | T, composite FK `(id, tenant_id)` | `bind_institution_sso_membership()` service-role only | T3 | Kept; offboarding revokes school-scope grants | Institution notice | `provisioning_audit_event` | SAML, SCIM | Directory export | NI (no live IdP) |
| `institution_membership` → `scim_external_identity` | IdP | T | Service role | T3 | With membership | none | `provisioning_audit_event` | SCIM | none | NI |
| person ↔ alias (email, student id, sourcedId, LTI sub) | none today | | | | | | | | | **NS** |

Gap and proposal: email is still a join key in advisor shares, support shares and `classmates.sql`, and no canonical person or alias table exists. Proposed `private.person_alias(person_id, tenant_id, kind, value_hash, source, verified_at, superseded_at)` with a unique `(tenant_id, kind, value_hash)`; LTI, OneRoster and SIS identifiers resolve through it and never by email. Status: PROPOSED.

## Graph 2: institution, campus, school, program, course, section

| Edge | Authority | Scope | Permission | Class | Retention | Consent | Audit | Integration | Migration | Status |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `schools` (system/campus/college collapsed into one row) | Tenant contract | T | `tenant:configure` | T0–T1 | Kept | none | `tenant_policy_audit_event` | OneRoster orgs (not built) | SIS org export | NV |
| `governance_policy_nodes.parent_id` (level system, campus, school, program, course) | Tenant admin | T | `tenant:configure`; narrow-only trigger `private.check_policy_node` | T1 | Kept | none | `governance_decisions` | none | none | NI: trigger verified, **no runtime consumer** |
| `registration_terms` → `registration_sections` (tenant, term, course_code, section) | Registrar sync | T | `catalog:sync`; registrar | T2 | Kept | none | `registration_audit_event` | SIS read | SIS term and section export | NV in DB, no feed |
| `catalog_sections` | Registrar sync | T | `catalog:sync` | T1 | Kept | none | `audit_event` | SIS or imported file | Catalog export | INT |
| user course (`public.courses` JSONB) | The student | P | Owner RLS | T2 | With account | none | none | LTI context, Canvas token | none | NV (device and blob) |
| program, department, cohort nodes as entities | none | | | | | | | | | **NS** |

Proposed: a tenant-scoped `org_unit(id, tenant_id, kind, parent_id, source, source_id)` that `role_grants.scope_id` and `governance_policy_nodes` reference by foreign key, so a grant at `department` can be shown to cover its courses, and deprovisioning can revoke non-school scopes (today the offboarding trigger `20260930210000` revokes only `school` scope; organization, course, department and office grants are explicitly left alone). Status: PROPOSED.

## Graph 3: membership and role grants

| Edge | Authority | Scope | Permission | Class | Retention | Consent | Audit | Integration | Migration | Status |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `auth.users` → `role_grants(role, scope_kind, scope_id, provenance, expires_at, revoked_at)` | provenance: self, institution, platform | scope text, **no FK** | `has_capability(cap, scope_kind, scope_id)`, exact match | T3 | Row kept; `revoked_at` | none | `role_grant_audit_event` (hashed subject and grantor) | SCIM groups map to roles only where mapped | none | NV |
| `app_roles` → `role_capabilities` ← `app_capabilities` | Migration-written | G | n/a | T0 | Kept | none | migration history | none | none | NV (about 96 capabilities; `docs/ROLE-PERMISSION-MATRIX.md` shows 84, re-render) |
| `organization_members(org_id, user_id, standing, capabilities[])` | Student organization | R | Org capabilities | T2 | Kept | Member | `moderation_audit_event` | none | none | NI |
| `profiles.school_id` + `school_membership_requests` | Claim, then school approval | T | `schools.enforce_membership` (off at every school) | T2 | Kept | Student | `audit_event` | none | none | NI |

Proposed: one `membership_view` that unions the three models so access reviews, offboarding and the education graph query one place. Capability vocabulary: `@semester/platform` uses dot form (`task.create`, `CAPABILITY_PATTERN` `^[a-z][a-z_]*\.[a-z][a-z_]*$`); the database uses colon form (`grades:enter`). A written mapping table must exist before the platform engine can be compared with `has_capability`. Status: PROPOSED.

## Graph 4: student-owned workspace

| Edge | Authority | Scope | Permission | Class | Retention | Consent | Audit | Integration | Migration | Status |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| user → `state` blob (tasks, notes, plan, courses) | The student | P | Owner RLS; field-wise merge (`app/src/lib/merge.ts`) | T2 | With account; export and erase | none | none | Google and Microsoft calendar, ICS | Google, Microsoft, Apple import (partial) | NV |
| user → `calendar_feeds` | The student | P | Owner RLS; token feed `supabase/functions/calendar` | T2 | With account | none | none | ICS | none | NV |
| user → files (IndexedDB) | The student | device | none server-side | T2 | Device | none | none | Drive and OneDrive upload (`deliver.ts`) | none | NI (never synced) |
| user → AI threads (`localStorage`) | The student | device | none | T2 | Device | none | none | none | none | NI |
| user → `public.tasks` (engine path) | The student | P | Owner RLS | T2 | With account | none | `domain_outbox_events` | none | none | INT, off (`offline_engine_tasks`) |
| user → private capture inbox (browser extension) | The student | P | Owner RLS | T2 | capture-expiry sweep | none | none | `extensions/semester-capture` | none | NI |

## Graph 5: academic path

| Edge | Authority | Scope | Permission | Class | Retention | Consent | Audit | Integration | Migration | Status |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| user → requirements (student-entered) | The student | P | Owner | T2 | With account | none | none | none | Degree-audit import (not built) | NI; labelled an estimate |
| user → completions | SIS or the student | P / T | Owner; `registration_completions` for SIS | T3 | Education record | FERPA | `registration_audit_event` | SIS read | Transcript export | NI |
| plan → `registration_enrollments` | Registrar | T | Transaction RPC under per-school-term advisory lock | T3 | Education record | none | `registration_audit_event` | SIS write (gated, not built) | SIS enrollment | NV in DB, off |
| `registration_holds` | SIS | T | Service role writes; student reads office and link only (`my_registration_hold`) | T3 | Until lifted | none | `registration_audit_event` | SIS | none | INT |
| `articulation_rules` | Registrar (`articulation:approve`) | T | Registrar | T2 | Kept | none | `audit_event` | none | Articulation export | NI (no screen) |
| degree requirement rules, audit engine | none | | | | | | | | | **NS** |

## Graph 6: course and learning

| Edge | Authority | Scope | Permission | Class | Retention | Consent | Audit | Integration | Migration | Status |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| course → `course_ai_rules`, `course_guidance`, `study_packs` | Faculty (`course:publish`, course scope) | T / course | Faculty grant; immutable versions | T1 | Kept | none | version history | LTI deep link | Syllabus import | NV in slice, off |
| course → `gradebook_schemes`, `gradebook_items` | Faculty | T / course | `grades:*` capabilities, course OR school scope | T3 | Education record | none | append-only `grade_entries` | OneRoster lineItems (not built); LTI AGS | LMS gradebook export | NV in DB, off |
| `grade_entries` → `regrade_*` | Student files; faculty resolves | T / R | RPCs | T3 | Education record | none | regrade history | none | none | NV in DB, off |
| `grade_entries` → `grade_passbacks` | Faculty release | T | `writeback.lms_grade_passback` plus approved write connection | T3 | Education record | none | `grade.passback_requested` (event type defined, **no producer**) | LTI AGS | none | NI |
| course → student concept map | The student | P | Owner | T2 | Device | none | none | none | none | NI |
| course → discussions, objectives, assessments | none | | | | | | | | | **NS** |

## Graph 7: evidence and provenance

| Edge | Authority | Scope | Permission | Class | Retention | Consent | Audit | Integration | Migration | Status |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| field → source label (`official`, `ai_assisted`, `external`, estimate) | `app/src/lib/source.ts` | UI | n/a | n/a | n/a | none | none | none | none | NV |
| `approved_source(tenant, policy_scope, policy_course_code, policy_term, authority)` | Tenant admin or faculty | T / course | `ai:configure`; `20261001185348_approved_source_policy_scope.sql` | T1 by declaration | Kept | none | `tenant_policy_audit_event` | none | none | NV in DB; `authority` read then dropped by the gateway |
| learning, skill and capture evidence tables (`20260923211000_evidence_graphs.sql`) | Student, then verifier | P / T | Consent-gated derivation (`supabase/evidence-graphs.check.sql`) | T2 | With account | Student | none | none | none | NI (not written by the app) |
| integration field lineage and freshness | `app/src/lib/integration/freshness.ts` | T | Integration admin | T2 | Per source | none | `integration_*` tables | Any adapter | none | NI (no live source) |
| AI response → sources cited | Gateway | T | `citedSourceIds` must be subset of requested | T1 | 180 days (`gateway_intelligence_audit`) | **not read** | `private.gateway_intelligence_audit` | none | none | NI |

## Graph 8: support and intervention

| Edge | Authority | Scope | Permission | Class | Retention | Consent | Audit | Integration | Migration | Status |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| student → `help_requests` → `help_destinations` | Student | T | `help_request:respond` | T3 | Kept | Student initiates | `audit_event` | none | Helpdesk export | NV, off |
| student → `advisor_shares` → `advisor_share_events` | Student | T / R | 120-day expiry; own-school advisors; reads logged | T3 | Expiry then sweep | Student | `advisor_share_events` | none | none | NV in DB, off |
| student → `consent_record` → `support_access_grant` | Student | T / R | Composite FK `(consent_id, tenant_id, student_id)`; at most 7 days; scope `learning-progress` only | T3 | With education record (FERPA 99.32) | Mandatory | `support_access_event` | none | none | NV |
| missed task → support signal → intervention → outcome | none | | | | | | | | | **NS**. Reason: no signal model, case model or outcome aggregate exists beyond `outcome_aggregates` with n>=10 floor |
| `community_cases`, appeals, escalation agreements | Trust and safety | T | `trust_safety_reviewer`, `moderator` | T3–T4 | Per register | none | `moderation_audit_event` | none | none | NV, off |

## Graph 9: skills, credentials, career

| Edge | Authority | Scope | Permission | Class | Retention | Consent | Audit | Integration | Migration | Status |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| student → `skill_records` ← verifier (`skill:verify`) | Verifier | T / R | Scoped capability | T2 | With account | Student | `audit_event` | none | none | NI (DB only) |
| student → `talent_profiles` (opt-in, at most 366 days) → `talent_profile_views` | Student | T | `talent:search` | T2 | Expires | Opt-in | `talent_profile_views` | employer ATS | none | NI (no employer UI) |
| mentor ↔ mentee `mentor_rosters` | Both sides | T / R | Two-sided consent | T2 | Until ended | Two-sided | `audit_event` | none | none | NV |
| student → credential wallet export | Student | device | none | T2 | Device | Student | none | none | none | NI; labelled not official |
| issuer → credential → recipient (revocation, Open Badges, CASE) | none | | | | | | | | | **NS** |

## Graph 10: consent and sharing

| Edge | Authority | Scope | Permission | Class | Retention | Consent | Audit | Integration | Migration | Status |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| student → `family_invites(code)` → `family_grants` / `family_shared_items` | Student | **free-text `institution_id`, no FK to `schools`** | Share code; scoped categories; expiry | T3 | Until revoked or expired | Student | `family_access_events` | none | none | NV (suites); tenant gap |
| student ↔ guardian `guardian_links` (K-12) | School staff (`guardians:manage`) | T | `private.guardian_may_read` | T3–T4 | Ends at 18 | Per counsel (P-04, P-06 unresolved) | `audit_event` | SIS guardian export | none | NI; **UA** pending counsel |
| `guardian_link_restrictions` | School staff | T | Withheld from export (`20261004160000`, not yet in production ledger) | T4 | Kept | none | `audit_event` | none | none | NV in repo |
| `accommodation_shares` | Student | T | `accommodation:verify` | T4 | Per counsel | Student | `accommodation_access_events` | none | none | NI (DB only) `+REV` |
| `consent_record` itself | Student | T | Trigger-audited | T3 | With record | n/a | `tenant_policy_audit_event` | none | none | NI: lacks purpose, legal basis, revocation reason, correlation id (16 of 20 modelled fields have columns, `app/src/lib/trust/ferpa-consent.ts`) |

## Graph 11: commercial and customer

| Edge | Authority | Scope | Permission | Class | Retention | Consent | Audit | Integration | Migration | Status |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `gtm_accounts` → pilots, sponsors, campaigns | Semester operators | G / T | Semester GTM roles | T2 | Per `gtm_consent` | Marketing consent and suppression | `console_audit_event` | CRM (none) | none | NI |
| `commercial_prices` → order form → `tenant_plan` | Semester operators | T | Semester commercial roles | T1 | Kept | none | `console_audit_event` | Stripe (individual only) | none | NI; institutional prices quote-only |
| `tenant_plan` → entitlement resolver | Resolver | T | Shadow mode, enforces nothing | T1 | n/a | none | none | none | none | NI |
| `success_plans`, `qbrs`, `renewal_opportunities`, `compute_account_health()` | Customer success | T | Review-gated | T2 | Kept | none | `console_audit_event` | none | none | NI |
| usage meter (AI spend only) | `ai_spend_meter` | person and tenant | `reserve_ai_budget` | T1 | Monthly | none | `ai-spend` | Anthropic, OpenAI | none | NV |

## Graph 12: governance, audit, risk

| Edge | Authority | Scope | Permission | Class | Retention | Consent | Audit | Integration | Migration | Status |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `console_audit_event(seq, prev_hash, hash)` + manifests | Operators | G / T | Append-only; two-person approvals | T2 | Kept | none | itself | none | none | NV |
| `ledger_chain(ledger, tenant_id, seq, prev_hash, hash)` + HMAC seals | Registrar, finance | T | DB triggers | T3 | Kept | none | itself | none | none | NV |
| `legal_holds(subject_kind, placed_by ≠ released_by)` → sweeps and `erase_account` | Counsel | account, tenant, platform | `hold:*`; `private.legal_hold_guard` | T3 | Until released | none | hold audit | none | none | NV in repo |
| `tenant_feature_policy`, `feature_kill_switch`, `tenant_module_mode` | Tenant admin; operators | T | `tenant:configure`; `killswitch:engage` | T1 | Kept | none | `tenant_policy_audit_event` | none | none | NV |
| `tenant_rollout` + gates + history | Operators | T | Service role | T1 | Kept | none | console audit | none | none | NI: consulted by no data-access policy |
| `domain_outbox_events` → `domain_event_receipts` | Producers | T | Tenant-verifying consumer (in memory only) | per `data_classification` column | Class on row | none | itself | none | none | NI: producers wired, **no publisher, consumer or sweep** |
| risk register ↔ controls | `app/src/lib/governance/risk.ts` | G | n/a | T0 | Kept | none | none | none | none | DO |

## Proposed foundation changes (Phase 1 work, not applied)

Each has a backlog item in [EDUCATION_OS_BACKLOG.md](EDUCATION_OS_BACKLOG.md) with the test that would hold it.

1. `person_alias` and identity resolution that never matches on email (graph 1).
2. `org_unit` plus foreign keys from `role_grants.scope_id` and policy nodes; deprovision revokes every scope kind (graph 2).
3. A `membership_view` over the three membership models, and a capability-vocabulary mapping table (graph 3).
4. `family_*` tables gain `tenant_id` referencing `schools`, with a backfill that refuses ambiguous rows (graph 10).
5. A request-context contract adopted by the gateway and the productivity service: identity, tenant, role, purpose, correlation id, policy version (all graphs; `packages/platform` `RequestContext` is the starting point and is imported by one file today).
6. An outbox publisher, tenant-verifying consumer and retention sweep so the graph can propagate events (graph 12).
7. One classification vocabulary with a published mapping between T-tiers, C-classes, `ResourceClassification` and table-isolation classes, and a column-level classification for education-record tables.
8. A written FORCE RLS decision, applying `database/proposed/anon_grant_reduction.sql` after review, and a cross-tenant negative suite that walks every tenant-scoped table.

## Test gate for the graph

A graph change is mergeable when all of these hold, each as a named test: every new table appears in `table-classification.json` (`app/src/lib/tableclassification.test.ts`); a second-tenant account cannot read or write it (a `*.check.sql` case); each edge writes its audit event; erase and export reach it (`private.account_data_map()`); a legal hold blocks its sweep; and a revert of the migration makes the new check fail.
