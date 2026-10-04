# Domain ownership matrix

**Purpose.** For each of the 14 program domains: who owns the data (tables and modules), what the source of truth is, which accountable seat the repository names, where integrations touch it, where coupling is tight, and one classification label.
**Scope.** Product capability and state layer. Companion to `docs/program/CAPABILITY_TRACEABILITY_MATRIX.md` (row-level; IDs below are its IDs).
**Date.** 2026-10-04. **Base.** `origin/main` `4adb8cc`.
**Status.** Phase 0 baseline - evidence-cited, not a readiness claim.

## 0. What already exists (not duplicated)

CLAUDE.md says check main for the thing itself. These exist and are linked rather than rewritten; this file adds the **measured** view from the code and keys each domain to the seats in `OWNER-AND-ACCOUNTABILITY-MATRIX.md`.

| Existing | Covers | Limit |
|---|---|---|
| `docs/target-architecture/04-DOMAIN-BOUNDARIES-AND-OWNERSHIP.md` | 12 proposed modules (identity, academic, learning, productivity, campus, community, family, finance, career, marketplace, support-trust, admin), canonical objects, authority, "today's footprint" | Status "**proposed**" in its own header; table counts there are "static greps of the migration history" |
| `docs/architecture/data-architecture/02-source-of-truth-matrix.md` | Precedence rules, `tenant_module_mode` core vs connect, 13 modules | Describes what exists and what does not; states "Precedence is a label, not a rule" |
| `docs/DOMAIN-REPLACEMENT-REGISTER.md` | 14 institutional domains (Identity, Student portal, Course catalog, Degree planning, Registration, LMS, Advising, Student accounts, Financial aid, Housing, Dining, Career, Campus community, Institution operations) and "Today: 0 of 14" replaceable | Different 14 from this program's 14; mapping in section 2 |
| `app/src/lib/governance/data-contracts.ts` | Owner, steward and source system per connector domain; roles are institutional, "The named person for each role is filled per tenant during onboarding" | Seven contracts (Enrollment and schedule, Assignment dates, Degree audit status, Advising appointments, Career opportunities, Campus services, Bursar and aid actions) |
| `app/src/lib/integration/catalog.ts:SOURCE_OF_TRUTH` | 21 provider domains and their source system ("Semester is never one of these") | Display text |
| `database/DATA_CLASSIFICATION_REGISTER.md`, `database/schema/table-classification.json` | 354 objects, one class each | Classes rule-derived, unreviewed; not a domain owner map |
| `OWNER-AND-ACCOUNTABILITY-MATRIX.md` | 15 company seats and growth reviewer roles; customer-side 7 seats | Harrison Rubin is primary for every company seat; every backup UNASSIGNED; every customer seat NOT IDENTIFIED |

## 1. Method

```
database/schema/table-classification.json       -> 354 names, grouped to domains by name pattern (heuristic, unreviewed)
python regex over app/src: .from('<t>') + write method, .rpc('<fn>')   -> browser-touched / browser-written tables
grep -rn "@semester/<pkg>" and "packages/<pkg>/src" over app/src app/server app/api
wc -l / import counts on the hot-spot files named in section 4
sed OWNER-AND-ACCOUNTABILITY-MATRIX.md           -> seat names, holders
```

Seat rule: the repository names **no owner other than Harrison Rubin**. `OWNER-AND-ACCOUNTABILITY-MATRIX.md` lines 5-7: "Harrison Rubin is the named primary for every company-side seat ... Every backup remains unassigned". Owner placeholders in `app/src/lib/rollout-capabilities.ts` (e.g. "Academic platform", "Identity platform") and `docs/product/capability-inventory.md` ("accountable seat placeholders, not proof that a person is assigned") are **teams-as-labels, not people**, and I do not present them as seat holders. Where the repo states no seat for a domain I write "no seat named".

## 2. Program domain to repository vocabulary

| Program domain | `docs/target-architecture/04` module | `DOMAIN-REPLACEMENT-REGISTER.md` domain(s) | `masterregister.ts` domain code |
|---|---|---|---|
| D1 Identity, tenancy, roles, consent, sessions, devices, SSO, SCIM | identity | Identity | `IAM` (`app/src/lib/masterregister.ts:73-91`) |
| D2 Student productivity | productivity | Student portal | `STU` |
| D3 Academic core | academic | Course catalog, Degree planning, Registration, Advising | `STU`, `LMS` (partly) |
| D4 Learning | learning | LMS | `LMS` |
| D5 AI | (platform `ai-gateway` client) | none | `AI` |
| D6 Campus | campus | Housing, Dining | `UOS` |
| D7 Community | community | Campus community | `UOS` |
| D8 Family / guardian | family | none | `UOS` |
| D9 Finance | finance | Student accounts, Financial aid | `UOS` |
| D10 Career / alumni | career | Career | `UOS` |
| D11 Marketplace | marketplace | none | none |
| D12 Administration | admin | Institution operations | `INT`, `MIG` |
| D13 Support / trust | support-trust | none | `SUP`, `TRUST` |
| D14 Company ops | (not a module) | none | `COM`, `PRG` |

## 3. The matrix

Tables per domain are from the name-pattern grouping in `docs/program/CAPABILITY_TRACEABILITY_MATRIX.md` section 3 (354 total). "Writers" = distinct non-test files that write the table directly from the browser. Seat = `OWNER-AND-ACCOUNTABILITY-MATRIX.md` seat names; holder is Harrison Rubin for every company seat and the backup is UNASSIGNED for every one (so I state it once here, not per row).

| Domain | Canonical data owner (tables / modules) | Source of truth | Accountable seat(s) per owner matrix | Integration touchpoints | Classification |
|---|---|---|---|---|---|
| **D1 Identity / tenancy / roles / consent** | 59 tables: `schools`, `profiles`, `organizations`, `organization_members`, `role_grants`, `role_capabilities`, `app_roles`, `app_capabilities`, `institution_identity_provider`, `institution_membership`, `tenant_sso_policy`, `scim_*`, `consent_record`, `data_subject_request`, `lti_*`, `break_glass_grant`. Modules: `app/src/lib/cloud.ts` (auth), `app/src/lib/capabilities.ts`, `app/server/institution/{membership,scim,auth}.ts`, `supabase/functions/lti`. Tenancy term is `school` (`schools.id`), column `school_id` or `tenant_id`/`institution_id` on newer tables (`docs/CURRENT-SEMESTER-ARTIFACT-INVENTORY.md`: "Tenant key `tenant_id text -> schools(id)`") | Semester when native; IdP attributes win when connected (`docs/target-architecture/04`). Authorization boundary is RLS + `private.has_capability`, UI gating is UX only (`docs/ARCHITECTURE.md`) | **Security**, **Privacy/Data Governance** (consent), Engineering/Operations. Customer-side: Customer IT/identity - NOT IDENTIFIED | Supabase auth; `signInWithSSO`; gateway SSO (`app/server/institution/membership.ts`); SCIM (off unless `SEMESTER_SCIM=on`); LTI 1.3 (`supabase/functions/lti/index.ts`) | PARTIAL (CAP-062/063/064/067 PARTIAL; no student MFA, `app/src/lib/ops/trustcontrols.ts:228`) |
| **D2 Student productivity** | 24 tables (`tasks`, `notes`, `appointments`, `sittings`, `calendar_feeds`, `state`, `productivity_*`, `study_packs`, `push_*`). Modules: `app/src/state/*` (`shape.ts` 354 fields, `store.tsx`), `app/src/lib/{sheet,files,deck,...}.ts`, `app/src/domains/{tasks,today,calendar}` | **The student's device** (`semester.v1`, IndexedDB `semester-store`); server `public.state` is a mirror when signed in (`app/src/lib/cloud.ts`). Docs/sheets/decks have no server table of their own | **Product** (scope), Engineering/Operations | EF `calendar`, `fetchcal`, `push`; Google/Microsoft OAuth via `VITE_OAUTH_PROXY`; `lti` | OPERATIONAL-UNDER-GOVERNED (device-first; CAP-001..009, 031..040 under that label); sync engine PARTIAL (CAP-068) |
| **D3 Academic core** | 28 tables (`courses`, `catalog_sections`, `registration_*` (10), `academic_record_*`, `term_plan_courses`, `graduation_scenarios`, `advisor_shares`, `transfer_evaluations`, `articulation_rules`). Modules: `app/src/lib/enrollment/`, `app/src/lib/record/`, `app/src/lib/registration*.ts`, `app/server/institution/registration.ts` | Student-entered for `courses`/degree; **SIS wins when connected**, `tenant_module_mode` core vs connect (`docs/architecture/data-architecture/02-source-of-truth-matrix.md`). No SIS adapter registered (`app/server/institution/adapters.ts:32`) | **Product**, **Implementation**. Customer-side registrar authority not a seat in the matrix; customer seats NOT IDENTIFIED | SIS read, degree audit, advising CRM (contracts in `app/src/lib/governance/data-contracts.ts`); none live | PARTIAL (native registration CAP-071 PARTIAL; planner CAP-050 CLIENT-ONLY-DEMO) |
| **D4 Learning** | 9 tables (`gradebook_*`, `grade_*`, `regrade_*`, `course_ai_rules`). Modules: `app/src/lib/gradebook/`, `app/src/screens/Gradebook.tsx`, study tools in `app/src/lib/{study,exam,solve}.ts` (device). **No assignment, submission, rubric or assessment table exists** | Instructor gradebook: Semester native. Everything else LMS via LTI/AGS (`docs/target-architecture/04`) | **Product** | LTI launch and AGS passback (`supabase/functions/lti`); no real LMS registered | PARTIAL (gradebook CAP-075) with DOCUMENTED-UNIMPLEMENTED for the submission/rubric/assessment model (CAP-076) |
| **D5 AI** | 11 tables (`ai_policy`, `approved_source`, `private.ai_usage_*`, `private.gateway_intelligence_*`, ...). Modules: `supabase/functions/claude`, `app/server/institution/intelligence*.ts`, `app/src/ai/`, `app/src/intelligence/`, `packages/institution/src/{intelligence,agents,course-agent-policy}.ts`. Browser touches **0** of these tables directly (python regex) | Tenant policy rows govern; student chooses own key or shared key (ADR 0004 `docs/architecture/0004-ai-through-a-metered-gateway.md`) | **no AI seat named**; nearest Product, Security, Privacy. `rollout-capabilities.ts` owner label "Semester Intelligence" is a label, not a person | Anthropic (EF `claude`), OpenAI (`app/server/institution/providers/openai.ts`) | PARTIAL (CAP-027, 078) |
| **D6 Campus** | 23 tables (`dining_*` (10), `institution_action*`, `help_*`, `forms`, `connections`, `activity`). Modules: `app/src/lib/dining/`, `app/src/lib/office-actions*.ts`, `app/server/institution/{housing,athletics,clubs}.ts`, `app/src/data/campus.ts` | Institution content; Semester publishes (`docs/target-architecture/04`). Housing/meals/clubs are student-typed or directory data today | **Product**, **Implementation** | Campus card, housing, events feeds: none live | CLIENT-ONLY-DEMO for housing/meals/clubs/money-like (CAP-047/048/051); PARTIAL for dining ordering and office feed (CAP-079/080) |
| **D7 Community** | 42 tables (`community_*` ~30, `groups`, `messages`, `blocks`, `reports`). Modules: `app/src/community/` (client.ts 1,229 lines), `app/src/lib/{classmates,moderation}.ts` | Semester | **Moderator** (growth reviewer role: Harrison Rubin, backup UNASSIGNED), **Support**. Moderator gates "opening any community space" (`OWNER-AND-ACCOUNTABILITY-MATRIX.md`) | email/video identity only; EF `push` | PARTIAL (CAP-082/083); chat OPERATIONAL-UNDER-GOVERNED (CAP-060) |
| **D8 Family / guardian** | 7 tables (`family_*`, `guardian_*`). Modules: `app/src/lib/{family,familyshare,familyinvites}.ts`, `app/server/institution/family.ts`, `packages/institution` `FAMILY_CATEGORIES` | Student grants; SIS family contacts when connected | **Privacy/Data Governance**, **Product**. Minors/age policy is counsel's (`LEGAL-REVIEW-QUEUE.md`) | none live | PARTIAL (CAP-041) |
| **D9 Finance** | 11 tables (`student_account_*`, `student_payment_plan*`, `credits_refunds`, `invoice*`, `payment_events`). Modules: `app/src/lib/finance/{api,plans,mine}.ts`, `app/server/institution/money.ts`. Note: Semester's **own** billing is D14, not here | Institution billing/processor confirmations; Semester mirrors, never originates institutional money (`docs/target-architecture/04`). Student view is typed figures (CAP-046) | **Finance/Business Operations** seat is **company** finance, not institutional finance; no institutional-finance seat named. Customer finance seat NOT IDENTIFIED | ERP / bursar / aid: none live | PARTIAL (CAP-084); CAP-046 CLIENT-ONLY-DEMO |
| **D10 Career / alumni** | 7 tables (`opportunities`, `talent_profiles`, `skill_*`, `alumni_mentor_offers`). Modules: `app/src/lib/{career,career-evidence,apply,mentors,credential-wallet}.ts`. Most career data is device-local (CAP-052..055) | Student owns; issuer verifies (`docs/target-architecture/04`) | **Product**; no career seat named | employers/career systems: none live | OPERATIONAL-UNDER-GOVERNED (device rows); PARTIAL (CAP-054/085/086) |
| **D11 Marketplace** | **0 tables, no module.** `Springboard`/`Launchpad` screens are lifecycle planning, not commerce | Semester (proposed); partners fulfil | **no seat named**; capability-inventory placeholder "Marketplace Trust + Support" is a label | none | DOCUMENTED-UNIMPLEMENTED (CAP-087) |
| **D12 Administration** | 61 tables (`console_*`, `governance_*`, `integration_*` (17), `migration_*`, `workflow_versions`, `school_config_versions`, `private.ledger_chain*`, `private.gateway_*`, `tenant_rollout*`). Modules: `app/src/screens/{Console,University}.tsx`, `app/server/integration/`, `app/src/lib/{console,config,workflow,migration,integration}/` | Semester | **Engineering/Operations**, **Implementation**, **Security** | integration worker EF `integration-tick`; `ADAPTERS = []` (`app/server/integration/registry.ts:15`) | PARTIAL (CAP-088..094) |
| **D13 Support / trust** | 22 tables (`support_*`, `trust_*`, `help_requests`, `beta_*`, `feedback`, `legal_holds`). Modules: `app/src/lib/{supporttickets,support-access,trustroom,data-rights}.ts`, EF `support-reply-notify`, `trust-room`, `delete-account` | Semester | **Support**, **Security**, **Privacy/Data Governance**. Support seat blocks "any supported launch until hours, backup and channel test exist" (`OWNER-AND-ACCOUNTABILITY-MATRIX.md`) | CRM/email: none | PARTIAL (CAP-095..098); CAP-015/016 OPERATIONAL-UNDER-GOVERNED |
| **D14 Company ops** | 50 tables (`gtm_*` (17), `commercial_*`, `customer*`, `billing_*`, `subscription*`, `quotes`, `dunning_*`, `implementation_*`, `site_leads`). Modules: `app/src/lib/gtm/`, `app/src/lib/membership.ts`, EF `billing-*`, `lead-intake`, `app/src/lib/ops/*.ts` (22 register files), `company-site/` | Semester | **Founder/CEO**, **Revenue/Deal Desk**, **Finance/Business Operations**, **Customer Success**, **Vendor management**, **Communications** (all Harrison Rubin) | Stripe-shaped webhook (`billing-webhook`); no provider decision recorded ("no billing provider (D-009)" in `docs/ARCHITECTURE.md`) | PARTIAL (CAP-099/100/102/104); DOCUMENTED-UNIMPLEMENTED for the register-only CAP-103; UNKNOWN-INVESTIGATE CAP-101 |

Cross-cutting seat state, verbatim from the owner matrix: "Harrison may coordinate and produce internal evidence but cannot act as his own qualified independent assessor, licensed counsel, customer approver or proof of backup coverage." No domain above has a second named person.

## 4. Coupling hot spots (measured)

| Hot spot | Measurement | Domains it joins | Why it matters |
|---|---|---|---|
| `app/src/state/shape.ts` | 2,834 lines; 354 members of `Persisted & Ephemeral`; one persisted key `semester.v1` (`shape.ts:1192`) | D2, D3, D4, D6, D8, D9, D10 in one blob | A single document is the unit of sync and of conflict; a change to any domain's shape touches the one migration path |
| `app/src/state/store.tsx` | 1,868 lines; imported by 342 non-test files (`grep -rlE "state/store"`) | all | Everything depends on one store |
| `app/src/lib/cloud.ts` | 1,955 lines; imported by 95 non-test files; owns `OWNED_TABLES` = **68 tables** across D1-D10, D13 | all | Export and delete coverage for every domain is one array; invariant 3 in `docs/ARCHITECTURE.md` requires each client write table to be added to it, with no test found that diffs it against the 50 direct-write tables |
| `app/src/screens/University.tsx` | 1,539 lines, 40 imports; reaches `finance/api`, `finance/plans`, `gtm/manager`, `integration/dashboard`, `migration/api`, `workflow/api`, `config/api`, `moderation`, `modulemode`, `listings`, `course-demand-remote` | D3, D9, D12, D14, D7, D6 | One screen hosts staff, finance, growth and moderation surfaces; ownership by screen does not match ownership by domain |
| `app/src/lib/classmates.ts` | 858 lines; writes `profiles` (D1), `enrollments` (D3), `groups`/`group_members`/`group_tasks`/`messages`/`message_reactions`/`blocks`/`reports` (D7) | D1, D3, D7 | A "chat" module owns writes to identity and academic tables. `docs/target-architecture/04` rule 1: "One owner per table" |
| `reports` table | written from two modules: `app/src/lib/classmates.ts` and `app/src/lib/moderation.ts` | D7 | The only table in the direct-write list with two writer files (python regex), against the same rule |
| `community_*` vs `messages`/`groups` | two messaging models: `app/src/community/client.ts` (30 community tables touched) and `app/src/lib/classmates.ts` | D7 | Duplicate pathways; `docs/target-architecture/04` places both under community |
| `app/src/lib/integration/school-records.ts` | writes `consent_record` (D1) and deletes `canonical_entity_references` (D12) from the browser | D1, D12 | Consent state mutated by an integration module |
| `screens/Today.tsx` | within two import hops reaches `classmates.ts`, `school-records.ts`, `schoolclaim.ts` (python closure, depth 2, shared hubs excluded) | D2, D7, D1/D12 | The home screen's server dependencies are not declared in one place |
| Two flag systems | build-time `VITE_*` (73 passed in `.github/workflows/pages.yml`, 18 `MODULE_FLAG_ENV` entries) and server `tenant_module_mode`/`tenant_feature_policy` read by `app/src/lib/modulegate.ts` | all | The ADR-intended per-tenant switch exists beside a per-build switch; which wins per capability is not tabulated |
| Two packages' policy models | `packages/institution/src/policy.ts` (`decide`, 1 production caller, unmounted service) vs the gateway's own per-action checks vs RLS vs `app/src/domains/policy` | D1, D2, D12 | Four places decide access (see CAPABILITY_TRACEABILITY_MATRIX section 2.1); one adopted request-context/policy contract is listed as the main gap in `docs/product/capability-registry.md` |

## 5. Classification roll-up

Roll-up of the row labels in the traceability matrix, by domain, plus one domain-level label. Domain label rule: the lowest-assurance label that applies to a majority of rows whose promise depends on that domain's authority.

| Domain | Domain label | Reason (evidence) |
|---|---|---|
| D1 | PARTIAL | SSO/SCIM/LTI built and check-suited; none shown run with a real IdP/LMS; no student MFA (`app/src/lib/ops/trustcontrols.ts:228`) |
| D2 | OPERATIONAL-UNDER-GOVERNED | 23 device-first rows labelled OPERATIONAL-UNDER-GOVERNED and 5 PARTIAL; no server doc model; sync engine behind flag (`app/src/lib/sync/engine/ownership.ts:32`); governed API unmounted |
| D3 | PARTIAL | Native registration and record schema exist; no SIS adapter; planner is typed-in |
| D4 | PARTIAL | Gradebook only; submission/rubric/assessment server model absent |
| D5 | PARTIAL | Metered gateway and institution intelligence exist; spend meter is new (`supabase/migrations/20261004170000_ai_spend_meter.sql`) |
| D6 | CLIENT-ONLY-DEMO | housing, meals, clubs, campus services have 0 live adapters |
| D7 | PARTIAL | server-backed with RLS and check suites; feed gated by build flags; moderation staffing is one person |
| D8 | PARTIAL | server schema and check suites; no institution; minors question is counsel's |
| D9 | PARTIAL | direct browser writes to ledger-like tables; no ERP adapter; high-risk class |
| D10 | OPERATIONAL-UNDER-GOVERNED | mostly device-local |
| D11 | DOCUMENTED-UNIMPLEMENTED | 0 tables |
| D12 | PARTIAL | control planes built; `ADAPTERS = []`; direct admin writes |
| D13 | PARTIAL | server-backed; staffing and drills absent |
| D14 | PARTIAL | schema and functions present; provider/legal decisions open |

## Open questions / not verified

1. The table-to-domain grouping is by name pattern and unreviewed; ownership by table is a decision for the owner, and `docs/target-architecture/04` is the proposal it should be checked against (it counts "~40" `community_*` tables; the catalog register shows 30 community-prefixed names, 42 under my wider community grouping).
2. No second named person exists for any seat; I cannot say who would be accountable if the primary is unavailable.
3. Customer-side data owners (registrar, bursar, housing) are "NOT IDENTIFIED" in the owner matrix; every integration touchpoint above is therefore design-only.
4. Which writer owns each of the 242 tables (354 minus 112) the browser does not touch through `.from()` (RPC-only, service-only, or triggers) was not mapped; `database/FUNCTION_AUTHORIZATION_MATRIX.md` says the per-function matrix is not written.
5. Whether `OWNED_TABLES` covers every personal-data table was not diffed (no test found for it).
6. Legal, privacy-law, accessibility and security conclusions are out of scope and belong to qualified counsel and assessors.
