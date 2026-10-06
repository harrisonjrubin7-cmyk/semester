# Native platform — current state

**As of** 2026-10-05 · **Base** `origin/main` `3bd382dc` · **Branch** `audit/native-semester-master-reconciliation` · **Status** Phase 0 evidence. Nothing on this page is a release claim, a customer, a pilot, or an authoritative system of record.

> **Claim ceiling.** A row records what this pass measured: a file read, a count, or a read-only query against Supabase project `semester` (`lzrqvlugnawcgywkhqlz`). "Not found" means the search returned nothing. Anything not measured is *unverified*. `pg_stat_user_tables.n_live_tup` is a planner estimate, not an exact count. No migration was applied. `supabase db push` was not run.

This folder reconciles the 22-page native Education Operating System brief (attached 2026-10-05, created 21:26 UTC, Chromium/Skia, 22 pages). The earlier `docs/master/` pass reconciled a different set of three design and execution PDFs and left `expand-evan-further-provide-prompt-and-comand-to-e.pdf` unread. That brief is the last page of the PDF read here. `docs/master/` remains the rendered domain encyclopedia (40 domains, 36 fields). This folder is the PDF-to-code crosswalk and does not replace those catalogs.

## Index

| Document | What it answers |
| --- | --- |
| [PDF_TO_CODE_RECONCILIATION.md](PDF_TO_CODE_RECONCILIATION.md) | Each PDF platform (A–T) against the repo |
| [NATIVE_PLATFORM_SOURCE_OF_TRUTH.md](NATIVE_PLATFORM_SOURCE_OF_TRUTH.md) | Which file, table, or system wins, plus the design-token map |
| [NATIVE_DOMAIN_CATALOG.md](NATIVE_DOMAIN_CATALOG.md) | PDF domains classified |
| [NATIVE_SCREEN_CATALOG.md](NATIVE_SCREEN_CATALOG.md) | PDF screens against router keys |
| [NATIVE_WORKFLOW_CATALOG.md](NATIVE_WORKFLOW_CATALOG.md) | PDF workflows against commands |
| [NATIVE_ROLE_CATALOG.md](NATIVE_ROLE_CATALOG.md) | PDF workspaces against roles and grants |
| [NATIVE_DATA_AUTHORITY_MATRIX.md](NATIVE_DATA_AUTHORITY_MATRIX.md) | Who holds each fact today |
| [NATIVE_CAPABILITY_MATRIX.md](NATIVE_CAPABILITY_MATRIX.md) | Existing versus native, with readiness |
| [NATIVE_GAP_REGISTER.md](NATIVE_GAP_REGISTER.md) | P0 blockers, security exposure class, pilot definition |
| [NATIVE_PLATFORM_BACKLOG.md](NATIVE_PLATFORM_BACKLOG.md) | First 25 tasks in dependency order |
| [NATIVE_EXECUTION_ROADMAP.md](NATIVE_EXECUTION_ROADMAP.md) | First 10 branches and acceptance criteria |

## What was measured this pass

| Check | Result |
| --- | --- |
| `git fetch origin main` | `3bd382dc` (merge of #1305). Local `main` was three commits behind at session start and was fast-forwarded before the branch. |
| PDF | 22 pages, read in full via `pdftotext -layout` |
| Router | 95 keys in `app/src/screens.tsx` `SCREENS`, plus `home` and `onboarding` drawn outside that table (97 screen ids) |
| Destinations | 63 rows in `app/src/lib/nav.ts` `DESTINATIONS` |
| Nav areas | 7 in `app/src/lib/navareas.ts`: today, plan, learn, help, campus, progress, you |
| Console tabs | 10 core tabs in `app/src/screens/Console.tsx`, plus Support when `support:ticket` is granted and the flag is on |
| Edge functions | 16 directories under `supabase/functions/` |
| Local migrations | 184 files under `supabase/migrations/` |
| Remote migrations | 184 rows in `supabase_migrations.schema_migrations` on `lzrqvlugnawcgywkhqlz` |
| Public tables | 321, RLS enabled on 321, RLS off on 0 |
| Private tables | 31, RLS enabled on 31, RLS off on 0 |
| Roles / capabilities | `app_roles` 69, `app_capabilities` 96, `role_capabilities` 185, `role_grants` 4 |
| Security definer | 518 functions in `public`+`private`; 300 functions in `public` |
| Storage buckets | 2 |
| Estimated live rows | 42 of 321 public tables have `n_live_tup > 0`; estimated sum about 600. The bulk is role and capability seed data (`role` ~193, `app` ~167). Operational academic, registration, grade, dining, family, and migration prefixes are absent from the nonempty list. |
| Security advisor | 0 ERROR. 1 INFO (`rls_enabled_no_policy`, 63 tables: 30 private, 33 public). 3 WARN (below). |
| `npm` gates this pass | Not re-run. The prior pass on `3c410d50` recorded `tsc -b`, lint, `check:university`, and `design-system:check` clean, and 1441 files / 23,179 tests passing. This pass changes documentation only. |
| `supabase db push` | Not run. Production schema was listed, not changed. |

Sibling projects visible to the same account, not inspected for schema: `Semester2` (`kpuulmnicidgdmwgfngv`) and `semester-restore-drill-2026-10-01` (`neykbjfxoxgaxjrprylt`). `docs/master/SEMESTER_SOURCE_OF_TRUTH.md` already records that `www.semesterintel.tech` is served from Semester2 while the canonical build uses `lzrqvlugnawcgywkhqlz`. That split is still open.

## Security advisor, classified

| Lint | Level | Count | Reading |
| --- | --- | ---: | --- |
| `rls_enabled_no_policy` | INFO | 63 | RLS on, zero policies. For the `anon` and `authenticated` roles that is default deny. It is the right shape for service-role-only tables and a functional gap if a client was supposed to read them. Public names include `registration_holds`, `registration_requests`, `support_tickets`, `scim_credential`, `lti_platform`, `payment_events`, and the `gtm_*` prospect tables. |
| `pg_graphql_anon_table_exposed` | WARN | 32 | Those tables are visible in the GraphQL schema to the anon key. All 31 that resolved as tables have RLS and at least one policy, and `anon` holds `SELECT`. Policy predicates were not executed. Schema discovery is confirmed; row disclosure is unverified. Names: `appointments`, `blocks`, `calendar_feeds`, `commercial_plans`, `commercial_prices`, `commercial_products`, `courses`, `enrollments`, `entitlement_definitions`, `family_grants`, `form_publications`, `group_members`, `group_tasks`, `groups`, `message_reactions`, `messages`, `notes`, `organization_members`, `organizations`, `plan_entitlements`, `profiles`, `published_forms`, `push_devices`, `push_queue`, `referral_codes`, `referrals`, `reports`, `schools`, `sittings`, `state`, `tasks`, `usage`. `published_forms` did not resolve as a table in the privilege query. |
| `pg_graphql_authenticated_table_exposed` | WARN | 289 | Signed-in GraphQL can see most public tables. RLS still applies. This is discovery, not a measured data leak. |
| `authenticated_security_definer_function_executable` | WARN | 207 | The signed-in command surface. It includes `registration_enroll`, `gradebook_release`, `registrar_decide`, `dining_place_order`, `accept_family_grant`, `console_act`, `answer_data_subject_request`, and `authorize_school_purge`. Many are intentional RPCs. Whether each function checks a capability inside its body was not re-audited function by function. A blanket revoke would remove the product. The next action is a classified review. |

Remediation references: [0008 RLS no policy](https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy), and the GraphQL and security-definer lints linked from the advisor payload.

Standing finding carried from [`docs/master/SEMESTER_TRUST_AND_GOVERNANCE_MODEL.md`](../master/SEMESTER_TRUST_AND_GOVERNANCE_MODEL.md): **F-01**, tenant isolation is off for every school and the isolation that exists covers course rooms only. This pass did not re-test F-01. It is still the launch blocker for any institutional row.

## Architecture as it actually runs

```
Browser (Vite + React, app/)
  screens.tsx (95 lazy screens) → screens/*
  lib/look.ts → styles/tokens.css → generated design-tokens/semester.tokens.json
  lib/nav.ts (63 destinations) · lib/navareas.ts (7 areas)
        │
        ▼
Supabase project semester (lzrqvlugnawcgywkhqlz)
  321 public tables, RLS on every one
  31 private tables, RLS on every one
  RPCs (207 public SECURITY DEFINER callable by authenticated)
  16 edge functions (lti, canvas, claude, billing-*, calendar, push, trust-room, …)
  private.domain_outbox_events  — writer present, projection worker not found
Gateway: app/server, app/api, packages/institution (NodeNext, npm run check:university)
company-site/: third Vercel service, static pages
```

Deployment config lives in the root `vercel.json` plus `app/` and `company-site/`. CI workflows present in `.github/workflows/` include ci, codeql, contrast, docs, drift, functions, hawkscan, infra, pages, production-smoke, and supply-chain. This pass did not re-run them.

## Foundation reading (same day, later)

`FOUNDATION_EXPOSURE_READING.md` re-read the anon policies, the 207 definer functions, F-01, and Semester2. The function set matches `app/src/lib/definerregister.ts`. Zero schools exist, so enforcement was not switched on. Anon table DML is revoked in the repository by D-1306; that migration was not pushed, and live `schema_migrations` was not re-read.

Today, the degree plan, account, and registration-while-off now carry a source badge. A seeded grade is labelled sample. Registration-off and the gradebook can open a support ticket with a category and a fixed origin; the ticket arguments do not carry a score, a hold, or a section.

`origin/main` `706feed4` pins the order of the registration checks. `e0082d91` and `c45114c1` add a readiness view that says preparation is not clearance. A shadow receipt for one synthetic section keeps the SIS as the authority (`REGISTRATION_DUAL_RUN.md`).

`origin/main` at this merge is `c0874892`. That includes the payment-rail registry (D-1324), break-glass on `my_capabilities`, the console guard that returns no student rows, and the advisor list labelled Caseload for plans a student shared (`193b65f2`). None of that was applied with `db push`. The Caseload label is not task 23: a caseload query still has to return nothing without a grant.

`gradebook_release` and `registrar_decide` refuse a write without the capability, and a grade the scheme says must be moderated is not released until that approval exists. The audit row is written only after that (`REGISTRAR_RELEASE_GATES.md`). The gradebook screen says the school’s LMS remains the grade record. That does not make any domain ready for a pilot.

## Readiness, one sentence

No PDF domain is native-authoritative, ready for production, or ready for a named institutional pilot. Two domains (Student OS, workspace) sit at the repository's conditional invitation-only individual validation, which is not a pilot. The schema is far ahead of the data, and the data that exists is mostly seed (roles, capabilities, commercial catalog rows), not an operating institution.
