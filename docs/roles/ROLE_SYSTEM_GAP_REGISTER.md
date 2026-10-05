# Role system gap register

**As of** 2026-10-05 · **Part of** [`ROLE_SYSTEM_MASTER_MAP.md`](ROLE_SYSTEM_MASTER_MAP.md) · **Status** audit evidence; every row is open.

Severity: **High** blocks a pilot claim or leaves a path to unauthorized action; **Medium** weakens a control or blocks a P0 workflow; **Low** is hygiene. "Observed" means seen in source or the live catalog in this pass. Nothing was run, so none is a test result. IDs are stable; new gaps append.

## Security, RLS and authorization

| ID | Gap | Sev | Evidence |
| --- | --- | --- | --- |
| RG-01 | Two platform-admin concepts. `app_admins` / `private.is_app_admin()` still gate `schools_write`, school enforcement and the offboarding RPCs while `platform_admin` is the canonical role. `capabilities.check.sql` asserts an `app_admins` row carries no capability | High | `20260921161500_roles.sql`, `20260930200000`, `20260930185000` |
| RG-02 | No mapping between role vocabularies. `institution_membership.roles` (ten values, none an `app_roles` role) is written by SCIM group mappings and read by `productivity_readiness_aggregate`, the LTI join and Edge `tenantai.ts`; no code turns it into `role_grants`. Client `Role`, gateway `UNIVERSITY_ROLES`, `FlightRole` (12) and `profiles.account_role` add more | High | `20260924150142`, `app/src/lib/role.ts`, `packages/institution`, ADR-0002 proposed |
| RG-03 | Deprovision revokes school-scoped grants only; organization, course, department, office and other scopes survive | High | `20260930210000` (the migration states it) |
| RG-04 | `role_grants` can be inserted by the service key with no approval; no check proves `console_act` is the only non-service path | Medium | `20260929110000`; `rolelaunch.test.ts` asserts from code that no other writer exists |
| RG-05 | Console approvals: three of eleven duties have an executor (`role-grant`, `tenant-suspension`, `break-glass`); eight write a record only. The path has never run in production (`console_audit_event` 0 rows by the ops state doc; 4 grants and 0 approvals live) | High | `console_act`; live counts |
| RG-06 | Finding F-1: kill switch, provider registry, trust and GTM tables are browser-writable under RLS only, bypassing approval | High | `docs/ops/SECURITY_EXPOSURE_CLASSIFICATION.md`, backlog B-06 |
| RG-07 | Tenant isolation is built and off: `enforce_membership` defaults false; whether any school is on is unverified | High | `tenancy.check.sql`, `20260930185000` |
| RG-08 | Anonymous exposure, **partly closed on main**. The live read-only pass (before the fix) saw `anon` SELECT on 32 public tables incl. `profiles`, `messages`, `notes`, `push_devices`, `family_grants`. Migration `20261005200000_anon_keeps_only_its_public_catalog.sql` (D-1306) revokes every anon table privilege except the pricing catalog, open forms, `schools` and form answering, and `client-privileges.check.sql` fails for a table added later that keeps the default. **Still open:** whether that migration is applied to the live project (UNVERIFIED); `{public}`-role policies on advisor, family and registration tables (defence in depth); `schools` stays anon-readable with every column, a product and counsel question the migration leaves open; `institution_action_offices` policy says signed-in but is granted to `public` | Low after apply | live advisor and catalog; `docs/decisions/D-1306.md` |
| RG-09 | Every live Edge Function has `verify_jwt=false`; per-function authorization is in code and untested in `supabase/`; `trust-room` has no check file; `delete-account`, billing and `claude` need confirmation | High until verified | live function list |
| RG-10 | Step-up MFA only in `console_act`, `decide_approval` and support paths; tenant-admin actions (`approve_offboarding`, `set_school_enforcement`, `set_member_capabilities`) have none | Medium | `private.assert_fresh_mfa` call sites |
| RG-11 | No outbox event or receipt from any persona workflow; `private.domain_outbox_events` 0 rows; no publisher worker; no projections | Medium | `20260928320000`; `docs/ops/OPERATIONS_CONSOLE_CURRENT_STATE.md` |
| RG-18 | `organization_members.capabilities` is a second capability store beside `organization_*` roles | Low | `20260921230000_organizations.sql` |
| RG-19 | No common audit schema: `audit_event` is written by about eight functions; sign-ins and shares sit in other tables; the ledger chain is unkeyed and its verifier is not scheduled | Medium | `private.record_audit`; register item B11 |
| RG-33 | `kill_switch_engaged` answers for any tenant (DR-01) | Low | `DEFINER-RLS-REGISTER.md` |

## Client and navigation

| ID | Gap | Sev | Evidence |
| --- | --- | --- | --- |
| RG-12 | Role and school are browser-local; route boundary checks no capability, entitlement or kill switch; first render from a hash skips `screenForRole`; unknown route draws Today | Medium | `app/src/state/store.tsx`, `lib/role.ts`, `screens.tsx` |
| RG-13 | No shared forbidden state; Console, Moderation, Agreements, Volunteers use ad-hoc notices without retry; role-blocked route redirects silently | Medium | frontend audit |
| RG-14 | The demo build at `/demo/` shares browser storage with the real app; a reset could erase a real student's data (the component says a separate namespace is not done) | High | `InstitutionalPreviewBar.tsx` |
| RG-17 | `ControlPlane.tsx` receives `activeConsentCount: 0` and `auditEventCount: 0` hard-coded | Medium | `University.tsx` |
| RG-25 | No `/app/t/:tenantSlug/...` scheme; hash router; decision needed | Medium | `lib/route.ts` |
| RG-34 | Seven requested public routes missing; log-in links target a GitHub Pages origin; two production origins | Medium | `company-site/` |
| RG-38 | The axe suite covers no staff or role-gated screen; WCAG scorecard has no forbidden-state row | Medium | `a11y/axe.test.tsx` |

## Missing P0 workflows

| ID | Gap | Sev | Evidence |
| --- | --- | --- | --- |
| RG-24 | Adapter registries are empty (`ADAPTERS = []`, `adapters = []`); no SIS or LMS sync, so registration holds and completions cannot arrive; the outbound handoff to a school SIS is unbuilt | High | `app/server/integration/registry.ts`, `app/server/institution/adapters.ts` |
| RG-26 | No onboarding platform tables, versioning, assignment or resume; only student carousel and `onboarding_progress` | Medium | live catalog |
| RG-31 | Activation and first-value events are definitions only; no operator dashboard | Medium | `SPRINT-1-REGISTRATION-PATH.md` |
| RG-27 | Advisor caseload, appointments, referrals, notes, success plans not started | High for P0 | gap register Advising #1–#17 |
| RG-28 | Ops Inbox, My Work, Tenant directory and 360, Customer 360 (partial), Pilot, Implementation views not started; tables exist | High for P0 | `Console.tsx`; matrix |
| RG-29 | No console control for kill switch or release pause; kill switch set by table write | Medium | `Releases.tsx` |
| RG-30 | Incident declaration, commander, comms, postmortem not built | Medium | gap register Incident #3–#14 |
| RG-32 | Faculty: no shell; gradebook flag off everywhere; passback not invoked outside tests; assignment, rubric, feedback not built | Medium (P1) | `Gradebook.tsx` |
| RG-37 | School offboarding has no UI; no role-level offboarding; employee and board offboarding not started | Medium | `school-offboarding.check.sql` |

## Roles, ecosystem and evidence

| ID | Gap | Sev | Evidence |
| --- | --- | --- | --- |
| RG-21 | Seven roles hold no capability: `admitted_student`, `alumni`, `athletic_academic_support`, `department_admin`, `dual_enrollment_student`, `high_school_counselor`, `prospective_student` | Low | `ROLE-LAUNCH-REGISTER.md` |
| RG-22 | No developer, partner-manager, board, COO, product, accessibility-officer, library, graduation roles; no developer principal | Medium | [`ROLE_CATALOG.md`](ROLE_CATALOG.md) |
| RG-23 | No role is launch-approved; the per-role provision, positive, negative and revocation test matrix is not sorted | Medium | register |
| RG-35 | A second deploy path (GitHub Pages) and three Vercel projects | Low | `docs/infrastructure/VERCEL-CONSOLIDATION.md` |
| RG-36 | No role-by-AI-mode matrix; no tenant AI console | Medium | [`ROLE_AI_POLICY_MATRIX.md`](ROLE_AI_POLICY_MATRIX.md) |

## Operations and environment

| ID | Gap | Sev | Evidence |
| --- | --- | --- | --- |
| RG-15 | The live domain `www.semesterintel.tech` is served from Supabase project Semester2 (`kpuulmni…`), a separate migration lineage; the canonical build uses `lzrqvlug…`. Findings here do not describe the live domain | High | `docs/infrastructure/VERCEL-CONSOLIDATION.md`, `SEMESTER_SOURCE_OF_TRUTH.md` |
| RG-16 | Branch ruleset not confirmed applied (the "Applied" table is empty); one code owner for everything; no backup for any seat; production restore never done; schema deploy health is a manual look (it failed silently for three days on 18 September) | High | `docs/BRANCH-PROTECTION.md`, `RESTORE.md`, `MONITORING.md` |

## Documentation drift (Low)

RG-20: `ROLE-PERMISSION-MATRIX.md` (84 capabilities, omits 12); `master/SEMESTER_ROLE_CATALOG.md` repeats 84/157; `app/src/lib/ops/operatingsystem.ts` note says 63 roles all modeled; `ROLE_REQUIREMENTS.md` says the UI `Role` has 6 values (it has 10); the registration migration header says "NOT APPLIED to production" while another document lists its tables as present (live catalog shows `registration_*` tables exist); the WCAG scorecard says `smoke:a11y` is not a CI step while `ci.yml` runs it.

## Reconciled against main while compiling

Five commits landed on `origin/main` during this audit. Checked for overlap with these gaps: `dc114a2` and `df5da55` (anon privileges, D-1306) narrow RG-08; `d0d2fdc` adds a read-only Launch readiness tab (does not touch RG-28 or RG-29); `ec522f1` adds an RPC exposure classification that agrees with the 279, 0, 207 counts here; `f298bde` is a finance design document. None touches RG-01 to RG-07 or RG-09 to RG-11: `app_admins` and `is_app_admin` still appear in 48 migration lines on main and the deprovision trigger is unchanged.

## Corrections made while compiling this register

- One agent report said `grades:enter` is granted to faculty only; `20260929310000_gradebook.sql` line 83 grants it to `teaching_assistant` too.
- One report cited `app/src/isolation.test.ts` as tenant-isolation evidence; it is a vitest worker guard.
- Live migration count was reported as 195 (counted by eye); the repository has 184 files and the consolidation document records 185 remote rows. Treat the live count as approximate.
