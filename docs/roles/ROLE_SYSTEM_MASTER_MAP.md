# Role system master map

**As of** 2026-10-05 · **Base** `origin/main` `d6179af6` (audit began at `3bd382d`; main moved twice meanwhile, reconciled in the gap register) · **Phase** 0, `audit/role-system-reconciliation` · **Status** audit evidence; nothing here is a release claim.

> **Claim ceiling.** This audit was read from source, migrations, documents and a read-only look at the live Supabase project `lzrqvlugnawcgywkhqlz` (advisors and catalog queries only; no data rows read, nothing written). **No test, build or migration was run in this pass.** "A check exists" means a file exists that targets the behaviour, not that it passed. Anything not observed is marked UNVERIFIED. The live domain `www.semesterintel.tech` is served from a different Supabase project, so database findings describe `lzrqvlug…`, not what that domain serves ([`SEMESTER_SOURCE_OF_TRUTH.md`](../master/SEMESTER_SOURCE_OF_TRUTH.md)).

## What this folder is

The role system is described by the brief as one Education Operating System: one identity, tenant, policy, consent, audit and workflow layer, with a workspace per role. This folder records what the repository and live schema do today against that target, and the order in which to close the difference. It reuses the existing registers instead of restating them:

| Fact | Where it already lives | Held by |
| --- | --- | --- |
| Roles, capabilities, launch state | [`ROLE-LAUNCH-REGISTER.md`](../ROLE-LAUNCH-REGISTER.md) | `app/src/lib/rolelaunch.test.ts` reads `supabase/migrations/` |
| Brief-role to DB-role mapping, clusters | [`master/SEMESTER_ROLE_CATALOG.md`](../master/SEMESTER_ROLE_CATALOG.md) | hand-written |
| Two-person rules enforced in SQL | [`DECISION-RIGHTS.md`](../DECISION-RIGHTS.md) | `supabase/*.check.sql` |
| Definer functions and policy-less tables | [`DEFINER-RLS-REGISTER.md`](../DEFINER-RLS-REGISTER.md) | `app/src/lib/definerregister.test.ts` |
| Workflow steps and what is built | [`master/SEMESTER_WORKFLOW_CATALOG.md`](../master/SEMESTER_WORKFLOW_CATALOG.md), [`SEMESTER_GAP_REGISTER.md`](../master/SEMESTER_GAP_REGISTER.md) | generated and hand |
| Operations Console state | [`docs/ops/OPERATIONS_CONSOLE_CURRENT_STATE.md`](../ops/OPERATIONS_CONSOLE_CURRENT_STATE.md) | hand |
| RPC exposure by function body | [`docs/master/SEMESTER_RPC_EXPOSURE_CLASSIFICATION.md`](../master/SEMESTER_RPC_EXPOSURE_CLASSIFICATION.md) (279 public definer functions, 0 anon-executable, 207 authenticated, 0 without pinned search_path) | hand |

**Authority order for role facts:** the migrations and the live project, then `ROLE-LAUNCH-REGISTER.md`, then this folder. [`ROLE-PERMISSION-MATRIX.md`](../ROLE-PERMISSION-MATRIX.md) is stale (84 capabilities; the database defines 96) and must not be cited for counts until regenerated.

## The folder

| File | Purpose |
| --- | --- |
| [`ROLE_CATALOG.md`](ROLE_CATALOG.md) | Every role family A to F against the 69 database roles |
| [`ROLE_LIFECYCLE_CATALOG.md`](ROLE_LIFECYCLE_CATALOG.md) | The shared lifecycle and where each stage exists in code |
| [`ROLE_WORKSPACE_CATALOG.md`](ROLE_WORKSPACE_CATALOG.md) | Which workspace each role has today |
| [`ROLE_CAPABILITY_MATRIX.md`](ROLE_CAPABILITY_MATRIX.md) | Capabilities by role family, and the permission decision as built |
| [`ROLE_TENANT_SCOPE_MATRIX.md`](ROLE_TENANT_SCOPE_MATRIX.md) | Scope kinds, tenant derivation, isolation gaps |
| [`ROLE_CROSS_WORKFLOW_MAP.md`](ROLE_CROSS_WORKFLOW_MAP.md) | The ten cross-role workflows, built or not |
| [`ROLE_ONBOARDING_CATALOG.md`](ROLE_ONBOARDING_CATALOG.md) | The twelve journeys and the tables they need |
| [`ROLE_OFFBOARDING_CATALOG.md`](ROLE_OFFBOARDING_CATALOG.md) | Nine offboarding flows against what exists |
| [`ROLE_ROUTE_CATALOG.md`](ROLE_ROUTE_CATALOG.md) | Routes today versus the requested scheme |
| [`ROLE_DATA_ACCESS_MATRIX.md`](ROLE_DATA_ACCESS_MATRIX.md) | Data classes, consent and who may read what |
| [`ROLE_AI_POLICY_MATRIX.md`](ROLE_AI_POLICY_MATRIX.md) | AI permissions per role, built and proposed |
| [`ROLE_SUPPORT_ESCALATION_MAP.md`](ROLE_SUPPORT_ESCALATION_MAP.md) | Support and escalation paths |
| [`ROLE_READINESS_SCORECARD.md`](ROLE_READINESS_SCORECARD.md) | Honest classification per family and P0 workflow |
| [`ROLE_SYSTEM_GAP_REGISTER.md`](ROLE_SYSTEM_GAP_REGISTER.md) | Numbered gaps with severity and evidence |
| [`ROLE_SYSTEM_EXECUTION_BACKLOG.md`](ROLE_SYSTEM_EXECUTION_BACKLOG.md) | 25 dependency-ordered work items and the first ten branches |

`docs/platform/` and `docs/finish-line/ROLE_SYSTEM_*` files named in the brief are not written in this phase. Each would document a mechanism (outbox projection, workflow engine, role release gates) that does not exist yet; they are scheduled in the backlog against the branch that builds the mechanism. `docs/platform/` is also held by `packages/platform/src/docs.test.ts`, which bans certain words and checks every backticked path.

## Classification vocabulary

Three vocabularies already coexist; this folder uses all three and says which:

1. **Role ladder** (machine-derived, per role): defined, modeled, provisionable, usable, secure, supportable, launch-approved.
2. **Capability class** (per capability or workflow, from the brief and [`SEMESTER_COMPLETION_DEFINITION.md`](../finish-line/SEMESTER_COMPLETION_DEFINITION.md)): native and verified, native but incomplete, integrated only, transitional, static prototype only, designed or documented only, planned, not started, duplicate or stale, unsafe to activate, needs accessibility review, needs security or privacy review, needs migration or reconciliation, needs institutional approval.
3. **Release target**: preview, pilot-ready, production-ready, authoritative.

"Native and verified" is used only where a migration, a client path and a check file all exist, and is still bounded by the claim ceiling above. No role is `launch-approved` and no workflow in this folder is marked ready for pilot, production or authoritative.

## Findings in one page

The numbered gaps are in [`ROLE_SYSTEM_GAP_REGISTER.md`](ROLE_SYSTEM_GAP_REGISTER.md).

1. **One authorization model is sound; four others sit beside it.** `role_grants` + `app_roles` + `role_capabilities`, read through `private.has_capability()`, is canonical. Beside it: `institution_membership.roles` (a different ten-value vocabulary, written by SCIM and read by some functions), the legacy `app_admins` flag (still gates school writes and offboarding), `organization_members.capabilities`, and the browser-local `role` and `schoolId` in app state. (RG-01, RG-02, RG-18, RG-12)
2. **Roles are fewer than the brief.** The brief names about 110 roles; the database has 69. Many named roles have no database role (developer, board member, COO, product, people operations, accessibility officer, library operator, and others). Seven database roles hold no capability. (RG-21, RG-22)
3. **The controlled-action pattern exists server-side in three places** (registration, gradebook, Console approvals) and none writes an outbox event or a receipt. The outbox has zero rows and no publisher. (RG-11)
4. **Console approvals have never run in production.** Three of eleven duties have an effect; eight record only. Several operator tables are browser-writable under RLS only, which bypasses approval. (RG-05, RG-06)
5. **Tenant isolation is built but off.** `schools.enforce_membership` defaults false for every school. (RG-07)
6. **Offboarding leaves grants behind.** Deprovisioning revokes school-scoped grants only; organization, course, department and office grants survive. (RG-03)
7. **There is no role-aware production shell and no tenant URL.** Routing is a hash router with no tenant or role in the URL; role workspaces exist only as a synthetic preview. Route boundaries check neither capability nor entitlement. (RG-12, RG-25)
8. **Onboarding is student-only and unversioned.** No `onboarding_journeys` or `activation_*` table exists. (RG-26, RG-31)
9. **P0 pilot workflows are uneven.** Registration transaction and student share-with-advisor are the most complete. Advisor caseload and referrals are not started. In the Console, Ops Inbox, My Work, a full Tenant 360 and implementation views were not found; a metadata-only tenant and pilot operations read now exists. No adapter exists, so holds and completions cannot sync. (RG-24, RG-27, RG-28)
10. **Operational single points.** One named owner for every seat, no backups, no production restore ever performed, branch ruleset not confirmed applied. (RG-16)

## Reusable pieces found (do not rebuild)

`private.has_capability`, `console_act` with `console_duty`, `approval_request`, `break_glass_grant`, hash-chained `console_audit_event`, `audit_event` and the `*_audit_event` family, `tenant_feature_policy` and `feature_kill_switch` with `evaluateFlag` (`app/src/lib/flags.ts`), `ModuleGateState`, `PermissionNotice`, `ReadState`, `Notice`, `EmptyState`, `components/console/*`, `lib/console/client.ts`, `packages/platform` isolation conformance (`packages/platform/src/testing/conformance.ts`), `registration_*` transaction, `gradebook_*`, `advisor_shares`, `support_access_grant`, `school_membership_requests`, the `scim_*` and `tenant_sso_policy` tables, `implementation_projects`, `gtm_pilots`, and the offboarding RPCs in `20260930200000_school_offboarding.sql`.

## Quality gates that exist

Run from `app/`. Scripts named `typecheck`, `test:a11y`, `test:integration`, `test:rls`, `test:e2e`, `security` and `secrets` do not exist; the equivalents are below. Nothing was run in this pass.

| Brief name | Repository equivalent |
| --- | --- |
| `npm ci` | root `npm ci` (workspace install) |
| `typecheck` | `npx tsc -b`, `npm run check:university`, `npm run check:video` |
| `lint` | `npm run lint` |
| `test` | `npm test`, `npm run test:shuffle`, `npm run test:zones` |
| `build` | `npm run build`, `npm run budgets` |
| `test:a11y` | `src/a11y/axe.test.tsx` inside `npm test`; `npm run smoke:a11y` (runs in CI) |
| `test:integration`, `test:e2e` | `smoke:golden`, `smoke:sync` and the CI `account-sync` job |
| `test:rls` | `supabase/check.sh` (115 `.check.sql` suites on a throwaway Postgres) |
| `security` | CodeQL, HawkScan, `npm audit` in CI, `supply-chain.yml` |
| `secrets` | gitleaks job in CI |
| design | `npm run design-system:check` |

`app/src/isolation.test.ts` guards the vitest worker list and is **not** tenant-isolation evidence. The real harness is `packages/platform/src/testing/conformance.ts`, which has run against in-memory adapters only.
