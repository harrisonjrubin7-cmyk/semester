# Capability traceability matrix

**Purpose.** One row per capability, tracing user -> UI path -> state location -> server contract -> DB objects -> policy/audit -> tests -> ops evidence, with one classification label and the gap.
**Scope.** The product capability and state layer of `app/` (React/Vite/TS), `app/server/`, `app/api/`, `packages/*`, `supabase/`, across the 14 program domains. Security posture, CI, and legal are other agents' areas and are linked, not repeated.
**Date.** 2026-10-04. **Base.** `origin/main` `4adb8cc`, branch `claude/confident-allen-3vivus`.
**Status.** Phase 0 baseline - evidence-cited, not a readiness claim. Nothing was run against production; no test suite was executed for this document (counts are from `ls`, `grep`, `wc`). A passing test in the repository is not evidence that anything is deployed.

## 0. Read this first: what already exists, and what this adds

CLAUDE.md requires checking main for the thing itself. `git log --oneline -30 origin/main` and `ls docs/program` show no earlier traceability matrix (only `docs/program/PHASE_0_1_RECONCILIATION.md`, which says the owner-keyed matrix is "not done"). Existing sources are **claims**, and this file links rather than copies them:

| Existing source | What it proves | What it only asserts |
|---|---|---|
| `app/src/lib/rollout-capabilities.ts` (60 rows `CAP-001`..`CAP-060`) | The IDs, promise, destinations, owner placeholder; a test keeps them real | All 60 rows carry `currentState: 'verified'` (`grep -c "currentState: 'verified'"` = 60). That is a register value, not a production check |
| `docs/product/capability-inventory.md` | Phase A exposure per capability (`early_access`, `institution_controlled`) and missing-test codes O,U,R,T,V,M,C,X,N,D | Owner column is "accountable seat placeholders, not proof that a person is assigned" (its own words) |
| `docs/CAPABILITY-ACTIVATION-REGISTER.md`, rendered from `app/src/lib/governance/capability-governance.ts` | L0-L9 maturity per capability; "No tenant is activated by this register" | Evidence dates bound in code |
| `SEMESTER_PRODUCT_COMPLETENESS_MATRIX.md` | A per-screen reading at `e4cf671`, 21 Sept: "59 destinations. 7 reach a server. 52 are device-only" | Stale: the `Screen` union now has 89 ids (section 2) |
| `FEATURE-INVENTORY.md` | A baseline at 2026-09-10 (260 test files) | Stale: `app/src` now has 1,333 test files (section 2) |
| `docs/CAPABILITY-PARITY-MATRIX.md` | Width-parity of 15 files that read the window width, enforced by `app/src/widthgate.test.ts` | Not a capability register despite the name |
| `docs/DOMAIN-REPLACEMENT-REGISTER.md` | 95 rows, "Today: 0 of 14" domains replaceable, computed from `app/src/lib/replaceregister.ts` | Statuses read 29 Sept |

**IDs.** `CAP-001`..`CAP-060` below are the repository's own IDs, unchanged. `CAP-061` onward are **proposed here** for capabilities in the 14 domains that the 60-row register does not name (server-backed modules, platform modules, and absent ones). They are not in `rollout-capabilities.ts`; adopting them is an owner decision.

## 1. Method (commands run, all from repo root)

```
git fetch origin main && git log --oneline -30 origin/main
ls app/src/screens | wc -l                                  # 152 entries (files + folders)
python3: parse `export type Screen =` in app/src/lib/types.ts  # 89 ids
grep -c "lazy(" app/src/screens.tsx                          # 100
python3: regex  .from('<table>') + following .select/.insert/.update/.upsert/.delete  over app/src (non-test)
python3: regex  .rpc('<fn>')                                  over app/src (non-test)
ls supabase/migrations | wc -l ; ls supabase/*.check.sql | wc -l ; ls supabase/functions/*/index.ts | wc -l
grep -rn "@semester/<pkg>" app/src app/server app/api supabase/functions   # who imports each package
grep -rn "packages/<pkg>/src" app/server app/api                          # the gateway imports by relative path
database/schema/table-classification.json                                 # 354 objects, name-prefix domain grouping (section 3)
```

Probe limits, stated because CLAUDE.md asks for it: the `.from()` write/read split looks 250 characters after the call for the next method, so a query built in a variable and executed later reads as a "read"; the count of 50 written tables is a **floor**. The domain grouping of tables is by name pattern, unreviewed (section 3). A control that passed: every one of the 112 table names the browser touches is in the 354-object register (0 missing), so the probe is not reading phantom names.

## 2. Measured counts

| Measure | Value | Command / source |
|---|---|---|
| `Screen` union ids (routes `#/<id>`) | 89 | `app/src/lib/types.ts` `export type Screen` (parsed) |
| Rows in `SCREENS` table | 87 (union minus `home`, `onboarding`) | `app/src/screens.tsx:151` |
| Top-level non-test screen files in `app/src/screens/` | 89 (script count of `src/screens/*.tsx` excluding tests) | `ls app/src/screens` shows 152 entries including tests and folders |
| `DESTINATIONS` entries with a `screen:` key | 64 (+ community pushed at runtime, `app/src/lib/nav.ts:1026`) | `grep -cE "^\s+screen: '" app/src/lib/nav.ts` |
| Non-test source files in `app/src` | 1,534; test files 1,333 | `find app/src -name '*.ts*'` |
| `lib/` non-test modules | 837; test files 944 | `find app/src/lib` |
| Source files that touch Supabase/gateway directly (`.from`, `.rpc`, `functions.invoke`, `/functions/v1`, `/api/institution`) | 56 of 1,534 (3.7%) | python regex, list in section 4 |
| `.from('<table>')` call sites | 226, over **112 distinct tables** | python regex |
| Distinct tables the browser **writes** directly (insert/update/upsert/delete) | **50** (floor) | python regex; section 4 |
| Distinct `.rpc()` functions called from the browser | **154** (157 call sites) | python regex |
| Edge functions | 16 `index.ts` + `_shared` | `ls supabase/functions` |
| Vercel function (institution gateway) | 1: `app/api/institution/[...path].ts` | `find app/api` |
| Migrations / `*.check.sql` suites | 178 / 110 (`database/README.md` says 106; stale) | `ls supabase/migrations`, `ls supabase/*.check.sql` |
| Tables + views in the catalog register | 354 objects (319 public tables, 29 private, 2 views per catalog read) | `database/schema/table-classification.json`, `database/TENANT_ISOLATION_MATRIX.md` |
| Tables exported/deleted by the account tools | 68 `OWNED_TABLES` entries | `app/src/lib/cloud.ts:1094` |
| Build-time feature variables passed to the Pages build | 73 `VITE_*` | `.github/workflows/pages.yml` lines 118-210 |
| `MODULE_FLAG_ENV` module flags | 18 | `app/src/lib/experience-flags.ts:117` |
| `localStorage` keys `semester.*` | 98 distinct literals; 85 non-test files use `localStorage` | `grep -rhoE "semester\.[a-z0-9_.-]+"` |
| Persisted `State` fields | 354 members in `shape.ts`; one blob key `semester.v1` | `app/src/state/shape.ts:1192` |
| Institution adapters registered | **0** (`adapters = []`); integration `ADAPTERS = []` | `app/server/institution/adapters.ts:32`, `app/server/integration/registry.ts:15` |
| Packages | 4: `contract` (1 ts), `institution` (23), `offline-sync` (24), `platform` (50) | `find packages -name '*.ts'` |

### 2.1 Are the platform modules on a real request path?

Measured with `grep -rn` over non-test files. "Mounted" means a production code path imports and calls it, not that a test does.

| Module | Where it is defined | Non-test call sites on a request path | Verdict |
|---|---|---|---|
| Institution gateway (policy envelope, prepare-only actions, journal, rate limit, intelligence, SCIM) | `app/server/institution/gateway.ts`, `runtime.ts` | Mounted by `app/api/institution/[...path].ts`; the browser reaches it via `app/src/lib/university.ts` (`VITE_UNIVERSITY_GATEWAY_URL`) | Mounted in code. Whether the Vercel project and URL variable are set in production is not in the repo: UNKNOWN |
| Policy decision point `decide()` | `packages/institution/src/policy.ts:422` | **1**: `app/server/productivity/service.ts:380`. `app/server/institution/*` has no `decide(` call (grep) | Only caller is the productivity service, which nothing mounts (next row) |
| Governed productivity API | `app/server/productivity/{http,service,repository}.ts`, `createProductivityApi` at `http.ts:104` | **0** outside tests: no `app/api/` route, no import in `app/src`, no workflow (grep `createProductivityApi`) | Built and tested, **not mounted** |
| Outbox / receipts (`drainOutbox`, `MemoryOutbox`) | `packages/institution/src/events.ts` | `app/server/productivity/memory.ts` and `app/src/lib/integration/lmsmatrix.ts` only | In-memory; no production request path |
| `@semester/platform` engines (`workflow`, `flags`, `entitlements`, `search`, `notifications`, `files`, `reporting`, `integration`) | `packages/platform/src/engines/*.ts` | **0** imports of those engines from `app/src` or `app/server` (grep `engines/`). The server imports only `PlatformError`, `errorResponse`, `resolveCorrelationId`, `buildRequestContext`, `systemClock`, `RequestContext` (`app/server/institution/gateway.ts:16-22`, `context.ts:1-7`) | Envelope/context mounted; **8 engines unmounted** |
| `@semester/offline-sync` `SyncEngine` | `packages/offline-sync/src/engine.ts` | `app/src/state/useTaskEngine.ts:2`, called at `app/src/state/store.tsx:1822`; active only if `VITE_OFFLINE_ENGINE_TASKS` is on (`app/src/lib/sync/engine/ownership.ts:32`), off unless set | Mounted behind an off-by-default flag; transport talks to `public.tasks` directly, "no gateway yet" (`app/src/lib/sync/engine/tasks-transport.ts` header) |
| `@semester/offline-sync` CRDT (`TextDoc`, `AddWinsSet`, `gateUpdate`) | `packages/offline-sync/src/crdt.ts` | **0** outside the package (grep `TextDoc\|AddWinsSet\|gateUpdate` over `app/`) | Unmounted |
| `@semester/offline-sync` vault / SQLCipher | `packages/offline-sync/src/vault.ts`, `schema.ts:2` ("SQLCipher on iOS and Android; the web client keeps the same shape behind an encrypted IndexedDB adapter") | App imports only `DATA_CLASSES`, `SyncEngine`, `memoryStore`, `decodeSnapshot/encodeSnapshot` (grep `from '@semester/offline-sync'`) | No native client in the repo; **unmounted** |
| Domain layer `app/src/domains/{calendar,identity,policy,tasks,today}` | each `index.ts` | Imported only by `app/src/composition/*`; `composition/TodayShadow` is loaded by `app/src/components/TodayActionCenter.tsx:62` only when `VITE_TODAY_SHADOW==='on'` (`app/src/composition/shadow.ts:103`), "never on in production builds by default" | Shadow mode only |
| Integration worker / registry | `app/server/integration/{tick,worker,registry}.ts`, `supabase/functions/integration-tick/index.ts` | `ADAPTERS = []` ("a scheduled tick finds every connection unregistered and runs nothing", `registry.ts` header) | Mounted, runs nothing |
| Feature flags, build-time | `app/src/lib/experience-flags.ts`, `aiflags.ts` | Used throughout `app/src` | Mounted; **build-time**, not per tenant |
| Feature flags / module modes, tenant-time | `tenant_feature_policy`, `tenant_module_mode` read by `app/src/lib/modulegate.ts`, `featurepolicy.ts`, `modulemode.ts` | Browser reads via `.from()`/`.rpc('effective_module_modes')` | Mounted for the modules that call it; coverage per screen not measured |

## 3. Tables per domain (name-pattern grouping of the 354-object register)

Grouping is a heuristic over `database/schema/table-classification.json` names; it is unreviewed and one table lands in exactly one domain. "Browser-touched" = appears in a `.from()` in `app/src`; "browser-written" = direct insert/update/upsert/delete.

| Domain | Tables | Browser-touched | Browser-written |
|---|---|---|---|
| D1 Identity/tenancy/roles/consent | 59 | 13 | 6 |
| D2 Student productivity | 24 | 6 | 4 |
| D3 Academic core | 28 | 11 | 5 |
| D4 Learning | 9 | 6 | 0 |
| D5 AI | 11 | 0 | 0 |
| D6 Campus | 23 | 13 | 4 |
| D7 Community | 42 | 30 | 12 |
| D8 Family/guardian | 7 | 4 | 3 |
| D9 Finance | 11 | 7 | 4 |
| D10 Career/alumni | 7 | 1 | 1 |
| D11 Marketplace | **0** | 0 | 0 |
| D12 Administration | 61 | 14 | 7 |
| D13 Support/trust | 22 | 3 | 2 |
| D14 Company ops | 50 | 4 | 2 |
| **Total** | **354** | | |

Absences that matter: no table named for assignment, submission, rubric, assessment or quiz (`grep -rhoiE "create table ... (submission|rubric|assignment|assessment|quiz)" supabase/migrations` returns only `governance_steward_assignments` and `peer_mentor_assignments`); no marketplace table (`grep -rli marketplace supabase/migrations` hits only governance registries and an incident-notice migration); no table for documents, sheets, decks or notes beyond `notes`, `productivity_*`, and the `state` blob.

## 4. Browser -> database: governed or direct?

**Direct browser writes (`.from().insert/update/upsert/delete`, RLS only), 50 tables** (floor). By file: `app/src/lib/classmates.ts` (blocks, enrollments, group_members, group_tasks, groups, message_reactions, messages, profiles, reports), `app/src/community/client.ts` (community_aliases, community_calibration_items, community_members, community_mutes, community_session_participants), `app/src/lib/cloud.ts` (calendar_feeds, courses, push_devices, push_queue, state), `app/src/lib/finance/api.ts` (student_account_closes, _reconciliations, _requests), `app/src/lib/finance/plans.ts` (student_payment_plans), `app/src/lib/migration/api.ts` (migration_approvals, _field_maps, _projects, _runs), `app/src/lib/config/api.ts` (school_config_versions), `app/src/lib/workflow/api.ts` (workflow_versions), `app/src/lib/gtm/manager.ts` (gtm_campaigns, gtm_campaign_reviews), `app/src/lib/record/api.ts` (academic_record_changes), `app/src/lib/office-actions-remote.ts` (institution_action_audiences, _progress), `app/src/lib/formshare.ts` (forms, form_responses), `app/src/lib/modulemode.ts` (module_mode_request, module_mode_approval), `app/src/lib/integration/school-records.ts` (canonical_entity_references, consent_record), `app/src/lib/familyshare.ts` (family_grants, family_shared_items), `app/src/lib/familyinvites.ts` (family_invites), `app/src/lib/advisor-shares.ts`, `app/src/lib/graduation-cloud.ts`, `app/src/lib/athleteshare.ts` (support_shares), `app/src/lib/feedback.ts`, `app/src/lib/moderation.ts` (reports), `app/src/lib/productivity-cloud.ts`, `app/src/lib/console/client.ts` (operator_preference), `app/src/components/ListingDesk.tsx` (opportunities).

**Governed (definer function) path:** 154 distinct `.rpc()` functions, e.g. `registration_enroll`, `gradebook_enter`, `gradebook_release`, `dining_place_order`, `decide_approval`, `console_act`, `make_family_share`, `export_my_data`, `raise_my_data_subject_request` (names from the python regex over `app/src`; definitions in `supabase/migrations`, authorization posture in `docs/DEFINER-RLS-REGISTER.md` and `database/FUNCTION_AUTHORIZATION_MATRIX.md`).

**Gateway path (`/api/institution/*`):** prepare-only actions, SSO config, SCIM, intelligence; 4 browser routes named in `app/server/institution/gateway.ts` (`/v1/auth/config`, `/v1/intelligence/policy`, `/v1/intelligence/respond`, `/v1/intelligence/actions/:id/confirm`) plus the per-area service routes. No adapter is registered, so the gateway answers 503 for services (`app/server/institution/adapters.ts` header).

Observation, not a defect claim: several rows in the direct-write list are administrative (migration approvals, config versions, workflow versions, record changes, campaign reviews, module-mode approvals). Whether each has an RLS policy plus an audit trigger is a per-table question that `database/TENANT_ISOLATION_MATRIX.md` says is **not** yet written ("Per-object matrix is not written"). This document does not assert either way.

## 5. Legend for the matrix columns

- **ST** = device state blob `semester.v1` (`app/src/state/shape.ts:1192`), persisted through `app/src/state/persist/db.ts` (IndexedDB `semester-store`, falls back to localStorage), mirrored when signed in to `public.state` by `app/src/lib/cloud.ts` (whole-document compare-and-swap on `updated_at`). Signed out, nothing leaves the device (`app/src/lib/privacy.ts`; `docs/ARCHITECTURE.md` "Current system").
- **IDBF** = attached files in IndexedDB `semester-files` (`app/src/lib/files.ts`), never synced (`docs/ARCHITECTURE.md`).
- **none** = no server contract; the capability has no network path.
- **BR** = browser `.from()` under RLS; **RPC** = browser `.rpc()` to a definer function; **EF** = edge function `supabase/functions/<name>/index.ts`; **GW** = institution gateway.
- **Policy/audit** names what bounds the data. "n/a (device)" means no server policy applies because no server holds the data.
- **Ops evidence** is what exists in the repo that shows the thing running: for device-only rows, the hourly bundle check `.github/workflows/production-smoke.yml` is the only evidence found and it checks the deployed bundle and PostgREST, not feature use. No run results were read.

### Classification rule I applied

`OPERATIONAL-VERIFIED` requires code + persistence + a test/check + evidence that it runs and is deployed. Nothing in this repository shows production feature use (no telemetry export, no run log committed), so **no row below is labelled `OPERATIONAL-VERIFIED`**. That is a statement about evidence found, not about quality. For a student-owned, device-first tool (ADR 0001, `docs/architecture/0001-local-first-with-supabase.md`) whose promise is satisfied on the device, I used `OPERATIONAL-UNDER-GOVERNED` (it runs; no server policy/audit/ops evidence exists because none is needed or present), not `CLIENT-ONLY-DEMO`. `CLIENT-ONLY-DEMO` is used where the capability's promise needs an institutional or server authority that is absent (typed-in figures standing in for a record).

## 6. The matrix

Columns: **ID | Domain | User | UI path | State / persistence | Server / API contract | DB objects | Policy / audit | Tests | Ops evidence | Label | Gap | Next action.** Rows are split by domain. Test paths are the nearest files found by `ls`; they are not a coverage claim.

### D2 Student productivity (CAP-001..009, 012, 017, 018, 031..040, 056)

| ID | Capability | User | UI path | State / persistence | Server / API | DB objects | Policy / audit | Tests | Ops evidence | Label | Gap | Next action |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| CAP-001 | Today | S | `#/home` `app/src/screens/Today.tsx`, `app/src/components/TodayActionCenter.tsx` | ST | none (sync of ST only) | `state` | n/a (device) | `app/src/components/TodayActionCenter.test.tsx`, `app/src/lib/today-decision.test.ts` | smoke only | OPERATIONAL-UNDER-GOVERNED | Action Center behind `today_action_center` flag (`experience-flags.ts:118`); domain-layer Today only in shadow (`composition/shadow.ts:103`) | Decide which Today is canonical before conversion; D-1144 |
| CAP-002 | Reports | S | `#/brief` `screens/Reports.tsx` | ST | none | `state` | n/a (device) | `app/src/lib/progress.test.ts` | smoke only | OPERATIONAL-UNDER-GOVERNED | Container screen; tests are indirect | Per-report acceptance |
| CAP-003 | Calendar | S | `#/calendar` `screens/Calendar.tsx` (2,356 lines per matrix) | ST + feeds | EF `calendar`, EF `fetchcal`; BR upsert `calendar_feeds` (`cloud.ts`) | `calendar_feeds`, `appointments` | RLS; `supabase/calendar.check.sql` | `app/src/screens/Calendar.keyboard.test.tsx`, `app/src/screens/calendar-source.test.ts` | smoke only | OPERATIONAL-UNDER-GOVERNED | Feed writes are direct; provider token handling per `supabase/CALENDAR-REVIEW.md` not re-read | Route feed writes via governed path or document RLS-only decision |
| CAP-004 | Exam Runway | S | `#/runway` | ST | none | none | n/a (device) | `app/src/lib/runway.test.ts` | smoke only | OPERATIONAL-UNDER-GOVERNED | No UAT | UAT |
| CAP-005 | Week Ahead | S | `#/home` tab | ST | none | none | n/a (device) | `app/src/lib/today-center.test.ts` | smoke only | OPERATIONAL-UNDER-GOVERNED | Merged into Today (comment in `nav.ts`) | none |
| CAP-006 | When behind | S | `#/behind` | ST | none | none | n/a (device) | `app/src/lib/behind.test.ts` | smoke only | OPERATIONAL-UNDER-GOVERNED | - | none |
| CAP-007 | Tonight | S | `#/home` tab | ST | none | none | n/a (device) | `app/src/lib/today-actions.test.ts` | smoke only | OPERATIONAL-UNDER-GOVERNED | - | none |
| CAP-008 | Timers/alarms | S | `#/clocks` | ST | none | none | n/a (device) | `app/src/lib/clocks.test.ts` | smoke only | OPERATIONAL-UNDER-GOVERNED | Browser delivery limits only | none |
| CAP-009 | Progress | S | `#/me` | ST | none | none | n/a (device) | `app/src/lib/progress.test.ts` | smoke only | OPERATIONAL-UNDER-GOVERNED | - | none |
| CAP-012 | Links | S | `#/links` | ST | none | none | n/a (device) | `app/src/screens/links.test.tsx` | smoke only | OPERATIONAL-UNDER-GOVERNED | - | none |
| CAP-017 | Settings | S | `#/settings` | ST (`state/slices/settings.ts`) | none | `state` | n/a (device) | `app/src/lib/settings.test.ts` | smoke only | OPERATIONAL-UNDER-GOVERNED | Settings sync as part of one blob | none |
| CAP-018 | Alerts | S | `#/notifs`, `#/hub` | ST + push | EF `push`; BR `push_queue`, `push_devices` | `push_queue`, `push_devices` | RLS; no push-specific `*.check.sql` found by `ls supabase/*.check.sql | grep push` | `app/src/lib/notify.test.ts` | smoke only | PARTIAL | No delivery ledger/receipts (`docs/product/capability-registry.md` "Notification delivery/inbox: Delivery ledger, retries and staffed ownership"); `notifs` screen has no test file | Add delivery receipt design |
| CAP-031 | Create | S | `#/create` | ST + IDBF | none | none | n/a (device) | `app/src/screens/create-routes.test.ts` | smoke only | OPERATIONAL-UNDER-GOVERNED | Fronts docs/sheets/decks which have no server copy except inside `state` blob | see CAP-035/036 |
| CAP-032 | Analyse data | S | `#/analyse` | ST | none | none | n/a (device) | none found (`ls lib/analyse*.test.*` empty) | smoke only | OPERATIONAL-UNDER-GOVERNED | no direct test file | add test |
| CAP-033 | Graphs/diagrams | S | `#/draw`, `#/equations` | ST | none | none | n/a (device) | none found for `draw`/`equations` | smoke only | OPERATIONAL-UNDER-GOVERNED | no direct test file | add test |
| CAP-034 | Presentations | S | `#/deck` `screens/Deck.tsx`, `screens/deck/Edit.tsx` | ST (`decks: StoredDeck[]`, `shape.ts:464`) | none | `state` blob | n/a (device) | `app/src/lib/deck.test.ts`, `app/src/lib/decks.test.ts` | smoke only | OPERATIONAL-UNDER-GOVERNED | **No server-side document model**: a deck exists only inside the per-account `state` row; no sharing, versioning or recovery beyond the blob | Decide document store (CAP-114/115 are the unmounted answer) |
| CAP-035 | Documents | S | `#/write` `screens/Write.tsx` | ST (`state/slices/notes.ts`) | none | `state` blob | n/a (device) | none found for `write` (`ls lib/write*.test.*` empty) | smoke only | OPERATIONAL-UNDER-GOVERNED | no direct test file; no collaboration | same |
| CAP-036 | Spreadsheets | S | `#/sheet` `screens/Sheet.tsx` (4,033 lines per matrix) | ST (`sheets: Sheet[]`, `shape.ts:432`) | none | `state` blob | n/a (device) | `app/src/lib/sheet.test.ts`, `app/src/screens/sheet.test.tsx` | smoke only | OPERATIONAL-UNDER-GOVERNED | as CAP-034 | same |
| CAP-037 | Maths | S | `#/equations` | ST | none | none | n/a (device) | none found | smoke only | OPERATIONAL-UNDER-GOVERNED | - | add test |
| CAP-038 | Sources | S | `#/sources` | ST | none | none | n/a (device) | `app/src/lib/sources.test.ts` | smoke only | OPERATIONAL-UNDER-GOVERNED | - | none |
| CAP-039 | Draft It | S | `#/essay` | ST | optional AI via CAP-027 | none | n/a (device) | `app/src/lib/essay.test.ts`, `app/src/screens/essaypolicy.test.tsx` | smoke only | OPERATIONAL-UNDER-GOVERNED | - | none |
| CAP-040 | Files and notes | S | `#/mine` `screens/Mine.tsx` | ST (`notes`, tasks) + IDBF | none (`notes`, `tasks` tables exist; owned by sync paths) | `notes`, `tasks`, `productivity_workspace` | RLS | `app/src/state/slices/mine.test.ts`, `app/src/lib/workspace-backup.test.ts` | smoke only | OPERATIONAL-UNDER-GOVERNED | Files never leave the device (no cloud copy, no recovery if the device is lost) | Product decision on file sync; storage buckets are only `community-media`, `trust-packet` (`database/TENANT_ISOLATION_MATRIX.md`) |
| CAP-056 | Check the writing | S | `#/proof` | ST | none | none | n/a (device) | `app/src/lib/proof.test.ts` | smoke only | OPERATIONAL-UNDER-GOVERNED | - | none |
| CAP-061 | Sign-in, sessions, devices (proposed) | S | `#/account` `components/AccountSecurity.tsx` | auth session in browser | Supabase auth `signUp`, `signInWithPassword`, `signInWithOAuth`, `signInWithSSO` (`cloud.ts:249-426`); `signOutOtherDevices` | `auth.*`, `push_devices` | RLS; **students have no MFA/passkey enrolment** (`app/src/lib/ops/trustcontrols.ts:228`) | `app/src/components/AccountSecurity.test.tsx` | smoke only | PARTIAL | No student MFA; console MFA check only (`supabase/migrations/20260929100000_console_control_plane.sql:245-292`) | Owner decision on MFA scope; trust area |
| CAP-068 | Task sync engine (proposed) | S | `#/home` (tasks) | `packages/offline-sync` + `app/src/lib/sync/engine/persistent.ts` | BR `public.tasks` via `app/src/lib/sync/engine/tasks-transport.ts`; no gateway | `tasks` | RLS only; no permission epoch, tenant, policy version ("no tenant" in transport header) | `packages/offline-sync/src/engine.test.ts`, `app/src/lib/sync/engine/*.test.ts` | off by default (`VITE_OFFLINE_ENGINE_TASKS`) | PARTIAL | Behind flag; interim transport weaker than the contract (`docs/architecture/offline-sync-contract.md`) | Decide gateway vs RLS-direct before enabling |
| CAP-069 | Global search / command (proposed) | S | Command palette `app/src/components/Command.tsx`; `#/search` | in-memory over ST | none; "one ranker" ADR `docs/architecture/0006-search-is-one-ranker.md` | none | n/a (device) | `app/src/lib/search.test.ts` | smoke only | OPERATIONAL-UNDER-GOVERNED | No server-authorized index; registry says "Partial" (`docs/product/capability-registry.md`) | none this phase |
| CAP-070 | Governed productivity API (proposed) | S/O | none (no route) | Postgres repository `app/server/productivity/repository.ts` | `createProductivityApi` (`http.ts:104`); calls PDP `decide` (`service.ts:380`) | `productivity_task`, `productivity_event`, `private.productivity_command`, `private.productivity_owner_seq` | PDP + audit rows in `repository-contract.ts` | `app/server/productivity/service.test.ts`, `http.test.ts`, `openapi.test.ts` | **not mounted** (0 non-test callers; no `app/api` route) | PARTIAL | Built, tested, unreachable | Decide: mount or retire before Phase 1 |
| CAP-114 | Native secure storage / SQLCipher (proposed) | S | none | `packages/offline-sync/src/vault.ts`, `schema.ts` | none | none | n/a | `packages/offline-sync/src/vault.test.ts` | none; no native client in repo | PARTIAL | Library only; no iOS/Android app | Owner decision on native scope |
| CAP-115 | CRDT collaborative editing (proposed) | S/F | none | `packages/offline-sync/src/crdt.ts` | none | none | `gateUpdate` | `packages/offline-sync/src/crdt.test.ts` | none; 0 importers outside the package | PARTIAL | Library only | Decide use or retire |

### D1 Identity, tenancy, roles, consent, sessions, devices, SSO, SCIM

| ID | Capability | User | UI path | State | Server / API | DB objects | Policy / audit | Tests | Ops evidence | Label | Gap | Next action |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| CAP-010 | Account | S | `#/account` `screens/Account.tsx` | auth + ST | Supabase auth; EF `delete-account` | `profiles`, `auth.users` | RLS | `app/src/components/AccountSecurity.test.tsx` | smoke only | OPERATIONAL-UNDER-GOVERNED | see CAP-061 | - |
| CAP-011 | Profile | S | `#/profile` | ST ("device-local; does not read `public.profiles`", per `SEMESTER_PRODUCT_COMPLETENESS_MATRIX.md`) + `profiles` upsert in `classmates.ts` | BR `profiles` | `profiles` | RLS | `app/src/lib/profile.test.ts` | smoke only | PARTIAL | Two profile stores (device and server) | Reconcile |
| CAP-015 | Privacy and your rights | S | `#/privacy` `screens/Privacy.tsx` | ST + server | RPC `raise_my_data_subject_request`, `export_my_data`; `app/src/lib/data-rights.ts` | `data_subject_request`, `consent_record`, `legal_holds` | RLS; `supabase/audit-and-subject-requests.check.sql`, `deletion.check.sql` | `app/src/lib/privacy.test.ts` | smoke only | OPERATIONAL-UNDER-GOVERNED | Fulfilment is a human runbook (`docs/DATA-RIGHTS-REQUEST-RUNBOOK.md`); not run | Counsel review of request flow |
| CAP-016 | Take it with you | S | `#/export` | ST export | RPC `export_my_data`; `OWNED_TABLES` (68) | those 68 | `supabase/export-withholds-guardian-restrictions.check.sql` | `app/src/lib/export.test.ts` | smoke only | OPERATIONAL-UNDER-GOVERNED | `OWNED_TABLES` vs the 50 written + others needs a diff test (not found) | Add coverage test |
| CAP-062 | Institution SSO + membership (proposed) | S/I | `#/account`, University tab | none | GW `app/server/institution/membership.ts`; `signInWithSSO` | `institution_identity_provider`, `institution_membership`, `tenant_sso_policy` | RLS; `supabase/tenant-sso-policy.check.sql` | `app/server/institution/membership.test.ts` | no tenant configured evidence | PARTIAL | "SAML only, no OIDC" (`docs/DOMAIN-REPLACEMENT-REGISTER.md` Identity row); no real IdP run | Customer-side seats are NOT IDENTIFIED (`OWNER-AND-ACCOUNTABILITY-MATRIX.md`) |
| CAP-063 | SCIM provisioning (proposed) | I | none (API) | none | GW `app/server/institution/scim.ts`, `scim-route.ts`; **off unless `SEMESTER_SCIM=on`** (`runtime.ts` comment) | `scim_credential`, `scim_external_identity`, `scim_group_mapping` | `supabase/scim-gateway.check.sql` | `app/server/institution/scim.test.ts`, `postgres-scim.test.ts` | none | PARTIAL | Never run against a real IdP | - |
| CAP-064 | Roles, capabilities, grants (proposed) | all | UI gating `app/src/lib/role.ts` (UX only per `docs/ARCHITECTURE.md`) | server | RPC `my_capabilities`; `private.has_capability` | `app_roles`, `app_capabilities`, `role_capabilities`, `role_grants`, `role_grant_audit_event` | RLS is the boundary (ADR 0002); `supabase/capabilities.check.sql` | `app/src/lib/capabilities.ts` callers | n/a | OPERATIONAL-UNDER-GOVERNED | No table forces RLS (0 of 348, `docs/program/PHASE_0_1_RECONCILIATION.md`) | Owner decision on FORCE RLS |
| CAP-065 | School claim / tenant join (proposed) | S | `#/account` | none | RPC `claim_school`, `school_requests_for_admin`; `app/src/lib/schoolclaim.ts` | `schools`, `school_membership_requests` | RLS; `supabase/classmates.check.sql` | `app/src/lib/schoolclaim.ts` callers | n/a | OPERATIONAL-UNDER-GOVERNED | `schools` readable by `anon` with policy `true` (open question Q1 in `PHASE_0_1_RECONCILIATION.md`) | Counsel/product answer |
| CAP-066 | Age status and consent gate (proposed) | S/G | sign-up | server | RPC `state_my_age`, `my_age_status`; `signUp(..., bornOn)` | `private.account_ages` | `supabase/k12-guardians.check.sql` | - | n/a | PARTIAL | Legal basis is counsel's; this only shows the mechanism | Counsel |
| CAP-067 | LTI 1.3 launch + AGS (proposed) | S/F/I | `#/connect` | server | EF `lti` (881 lines), `app/src/lib/ltilanding.ts`, `ltiscore.ts` | `lti_platform`, `lti_nonce`, `lti_identity`, `lti_link_ticket`, `lti_line_item` | RLS; `supabase/lti.check.sql`, `ltiags.check.sql`, `lti-membership.check.sql` | `app/src/lib/lti.test.ts` | "No launch from a real LMS yet" (`docs/DOMAIN-REPLACEMENT-REGISTER.md` LMS row) | PARTIAL | No real platform registered | - |

### D3 Academic core and D4 Learning

| ID | Capability | User | UI path | State | Server / API | DB objects | Policy / audit | Tests | Ops evidence | Label | Gap | Next action |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| CAP-020 | Courses | S/F | `#/courses` | ST + `courses` sync | BR `courses` insert/update/delete (`cloud.ts`) | `courses` | RLS | `app/src/lib/coursestudio.test.ts` | smoke only | OPERATIONAL-UNDER-GOVERNED | Student-entered | - |
| CAP-021 | Assignments | S/F | `#/work`, `#/item` | ST | none server-side | **none** (no assignment/submission table) | n/a (device) | `app/src/lib/worked.test.ts` | smoke only | CLIENT-ONLY-DEMO | Promise "connect ... feedback" has no server record; LMS side only via CAP-067 | Decide native LMS scope |
| CAP-022 | Add a course | S | `#/import` | ST | EF `claude` optional | none | confirm-before-import | `app/src/lib/import-review.test.ts` | smoke only | OPERATIONAL-UNDER-GOVERNED | - | none |
| CAP-023 | Edit the course | S | `#/edit` | ST | none | none | n/a | none found (`ls lib/editcourse*` empty) | smoke only | OPERATIONAL-UNDER-GOVERNED | - | add test |
| CAP-024 | A change to a date | S | `#/announce` | ST | none | none | n/a | `app/src/lib/announce.test.ts` | smoke only | OPERATIONAL-UNDER-GOVERNED | - | none |
| CAP-025 | Study | S | `#/study` | ST | optional EF `claude`; publish via RPC `publish_study_pack` | `study_packs` | RLS | `app/src/lib/study.test.ts`, `app/src/components/StudyStudio.test.tsx` | smoke only | OPERATIONAL-UNDER-GOVERNED | - | none |
| CAP-026 | Where courses meet | S | `#/meet` | ST | none | none | n/a | `app/src/lib/meet.test.ts` | smoke only | OPERATIONAL-UNDER-GOVERNED | - | none |
| CAP-028 | Add a reading | S | `#/update` | ST | none | none | n/a | none found for `update` | smoke only | OPERATIONAL-UNDER-GOVERNED | - | add test |
| CAP-029 | Problem practice | S | `#/solve` | ST | optional AI | none | n/a | `app/src/lib/solve.test.ts` | smoke only | OPERATIONAL-UNDER-GOVERNED | - | none |
| CAP-030 | Practice exams | S | `#/exam` | ST | none | none | n/a | `app/src/lib/exam.test.ts` | smoke only | OPERATIONAL-UNDER-GOVERNED | Not an assessment engine: no server attempt record | see CAP-076 |
| CAP-044 | Degree planning | S/A | `#/degree` | ST + `graduation_scenarios` | BR upsert (`graduation-cloud.ts`); RPC `share_with_advisor` | `graduation_scenarios`, `term_plan_courses`, `advisor_shares` | RLS; `supabase/advisor.check.sql` | `app/src/lib/degree.test.ts` | smoke only | CLIENT-ONLY-DEMO | "Students type their own requirements; no institutional audit source" (`docs/DOMAIN-REPLACEMENT-REGISTER.md`) | Needs SIS source |
| CAP-045 | Term deadlines | S | `#/registrar` | ST | BR `institution_action_*` (`office-actions-remote.ts`) | `institution_actions`, `institution_action_audiences/progress` | RLS; `supabase/officeactions.check.sql` | `app/src/lib/registrar.test.ts` | smoke only | PARTIAL | No authoritative term feed | - |
| CAP-050 | Registration (planner and handoff) | S/A | `#/yes` | ST | none | none | n/a | `app/src/lib/registration-day.test.ts` | smoke only | CLIENT-ONLY-DEMO | "No live seats" (`docs/DOMAIN-REPLACEMENT-REGISTER.md`) | - |
| CAP-071 | Native registration, holds, overrides (proposed) | S/Registrar | `#/registration` `screens/Registration.tsx` | server | RPC `registration_enroll`, `registration_drop`, `registration_withdraw`, `my_registration_hold`, `registrar_put_term`, `registrar_put_section`, `registrar_grant_override`; `app/src/lib/enrollment/client.ts` | `registration_terms/sections/holds/overrides/windows/requests/enrollments/audit_event` (10 tables) | definer functions; `supabase/registration_transaction.check.sql`, `hold-gated-sweeps.check.sql` | `app/src/lib/registration.test.ts`, `app/src/screens/registration.test.tsx` | not shown running at a school | PARTIAL | Needs a tenant in `core` mode (`tenant_module_mode`); `registration` module authority per `docs/architecture/data-architecture/02-source-of-truth-matrix.md` | Tenant approval |
| CAP-072 | Academic record and changes (proposed) | Registrar | `components/institutional/RecordLedger.tsx` | server | BR `academic_record_changes` insert/update (`record/api.ts`) | `academic_record_subjects/entries/changes` | `supabase/academic-record.check.sql`; `private.ledger_chain` | `app/src/lib/record/*.test.ts` | none | PARTIAL | Direct browser write to a record-change table; review path not read | Per-table policy review |
| CAP-073 | Course catalog (proposed) | S | `#/courses`, `#/degree` | `app/src/data/catalog.ts`; `catalog_sections` | none | `catalog_sections`, `articulation_rules`, `transfer_evaluations` | RLS | `app/src/data/catalog.test.ts` | none | PARTIAL | Catalog is shipped data plus registrar-synced section rows; no sync worker runs (`ADAPTERS = []`) | - |
| CAP-075 | Gradebook (proposed) | F/S | `#/gradebook` `screens/Gradebook.tsx`, `#/grades` | server | RPC `gradebook_add_item`, `gradebook_enter`, `gradebook_release`, `gradebook_resolve_regrade`, `gradebook_export`; `app/src/lib/gradebook/client.ts` | `gradebook_items/schemes/operations`, `grade_entries/levels/passbacks`, `regrade_*` | `supabase/gradebook.check.sql` | `app/src/screens/gradebook.test.tsx`, `app/src/screens/grades.test.tsx` | not shown running | PARTIAL | Instructor-facing only; no assignment/submission/rubric model beneath it | Product scope |
| CAP-076 | Assignments, submissions, rubrics, assessments (server model) (proposed) | F/S | none | none | none | **none** | none | none | none | DOCUMENTED-UNIMPLEMENTED | Appears in `docs/architecture/data-architecture/*` and `docs/DOMAIN-REPLACEMENT-REGISTER.md` (LMS row "building") but no table or screen | Decide native LMS vs LTI-only |
| CAP-077 | Grade passback (proposed) | F/I | gradebook | server | RPC `gradebook_queue_passback`; EF `lti` AGS | `grade_passbacks`, `lti_line_item` | `supabase/ltiags.check.sql` | `app/src/lib/ltiscore.ts` callers | none | PARTIAL | No LMS registered | - |

### D5 AI

| ID | Capability | User | UI path | State | Server / API | DB objects | Policy / audit | Tests | Ops evidence | Label | Gap | Next action |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| CAP-027 | Semester Tutor (Ask) | S | `#/ask` `app/src/ai/Chat.tsx` | ST (history) | EF `claude` metered gateway (`supabase/functions/claude/index.ts`, ADR 0004); `VITE_CLAUDE_PROXY` | `private.ai_usage_month`, `private.ai_usage_reservation` | `supabase/ai-spend.check.sql`; `supabase/migrations/20261004170000_ai_spend_meter.sql` | `app/src/lib/aiflags.ts` callers; `app/src/aioptional.test.ts` | spend meter is days old (migration 2026-10-04) | PARTIAL | Student's own key path vs shared key; evaluation harness is doc (`docs/AI-RECOMMENDATION-EVALUATION-HARNESS.md`) | AI area agent |
| CAP-078 | Institution intelligence gateway (proposed) | S/F | University tab | none | GW `/v1/intelligence/respond`, `/policy`, `/actions/:id/confirm` (`gateway.ts`); `intelligence-runtime.ts` | `private.gateway_intelligence_action`, `_audit`, `ai_policy`, `approved_source` | `supabase/intelligence-policy.check.sql`; encrypted journal `journal-crypto.ts` | `app/server/institution/intelligence.test.ts` | `SEMESTER_AI_RUNTIME_STATUS` selects sandbox vs production; value in prod unknown | PARTIAL | No tenant policy row evidence | - |

### D6 Campus

| ID | Capability | User | UI path | State | Server / API | DB objects | Policy / audit | Tests | Ops evidence | Label | Gap | Next action |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| CAP-042 | Athletics | S | `#/athletics`, `#/nil` | ST | BR `support_shares` update (`athleteshare.ts`) | `support_shares` | `supabase/supportshares.check.sql` | `app/src/lib/athletics-career.test.ts` | smoke only | OPERATIONAL-UNDER-GOVERNED | gateway `athletics.ts` no adapter | - |
| CAP-043 | Campus services | S/I | `#/university`, `#/support` `screens/University.tsx` (1,539 lines, 40 imports) | ST | GW `app/server/institution/*` (advising, athletics, career, clubs, family, housing, money, registration); 0 adapters | `institution_actions` | gateway policy envelope | `app/src/screens/university.test.tsx` | **503 for every service** (`adapters.ts` header) | CLIENT-ONLY-DEMO | `sandbox.ts` only behind env | Needs a real adapter + customer seats |
| CAP-047 | Meal plan | S | `#/meals` | ST | none (typed) | none | n/a | `app/src/lib/meals.test.ts` | smoke only | CLIENT-ONLY-DEMO | "No campus-card or balance feed" | - |
| CAP-048 | Housing | S | `#/housing` | ST | none | none | n/a | `app/src/lib/housing.test.ts` | smoke only | CLIENT-ONLY-DEMO | no feed | - |
| CAP-049 | Maps | S | `#/maps` | ST | external geocoders (CSP) | none | n/a | `app/src/lib/maps.test.ts` | smoke only | OPERATIONAL-UNDER-GOVERNED | - | - |
| CAP-051 | Clubs/activities | S | `#/activities` | ST | none; gateway `clubs.ts` | `activity` (analytics, not clubs) | n/a | `app/src/lib/activities.test.ts` | smoke only | CLIENT-ONLY-DEMO | no event source | - |
| CAP-079 | Dining ordering (proposed) | S/staff | `#/dining` | server | RPC `dining_place_order`, `dining_advance_order`, `dining_order_queue`, `dining_set_ordering`; `app/src/lib/dining/client.ts` | 10 `dining_*` tables | `supabase/dining.check.sql` | `app/src/screens/dining.test.tsx` | not shown running | PARTIAL | `dining_partner_connections` but no partner adapter | - |
| CAP-080 | Office action feed (proposed) | S/staff | `#/registrar`, University | server | BR/RPC `draft_office_action`, `move_office_action`, `my_office_actions` | `institution_actions`, `_offices`, `_audiences`, `_progress` | `supabase/officeactions.check.sql` | `app/src/lib/office-actions.test.ts` | flag `office_action_feed` | PARTIAL | flag default off | - |
| CAP-081 | Forms (proposed) | S/staff | `#/respond` | server | BR `forms`, `form_responses` (`formshare.ts`) | `forms`, `form_publications`, `form_responses`, `published_forms` | `supabase/forms.check.sql` | - | none | PARTIAL | direct write path | - |

### D7 Community (incl. comms CAP-057..060)

| ID | Capability | User | UI path | State | Server / API | DB objects | Policy / audit | Tests | Ops evidence | Label | Gap | Next action |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| CAP-057 | Video call | S | `#/call` | none | external call service | none | n/a | `app/src/lib/call.test.ts` | smoke only | CLIENT-ONLY-DEMO | "UI ONLY ... holds no state" (`SEMESTER_PRODUCT_COMPLETENESS_MATRIX.md`); TURN vars optional | UNKNOWN-INVESTIGATE retire or keep |
| CAP-058 | Group work | S/F | `#/groupwork` | server | BR groups, group_members, group_tasks (`classmates.ts`) | `groups`, `group_members`, `group_tasks` | RLS; `supabase/groups.check.sql` | `app/src/lib/groupwork.test.ts`, `roomkeys.test.ts` | not shown running | OPERATIONAL-UNDER-GOVERNED | direct writes | - |
| CAP-059 | Email | S | `#/mail` | ST drafts | none ("drafts, never sends") | none | n/a | `app/src/lib/mail.test.ts` | smoke only | CLIENT-ONLY-DEMO | no provider send | - |
| CAP-060 | Chat / classmates | S | `#/classmates` | server | BR messages, reactions, blocks, reports (`classmates.ts`) | `messages`, `message_reactions`, `blocks`, `reports`, `enrollments` | `supabase/classmates.check.sql` | `app/src/lib/classmates.test.ts` | not shown running | OPERATIONAL-UNDER-GOVERNED | `community_*` is a second messaging model (42 tables) | Reconcile |
| CAP-082 | Community feed, posts, spaces (proposed) | S | `#/community` `screens/Community.tsx` | server | RPC `create_community_post`, `join_community`, `edit_community_post`; `app/src/community/client.ts` (1,229 lines) | `communities`, `community_posts`, `community_members` ... | `supabase/community.check.sql` | `app/src/screens/Community.test.tsx` | flag `VITE_COMMUNITY_FEED` | PARTIAL | feed gated by build flag | - |
| CAP-083 | Moderation, appeals, escalation, volunteer moderators (proposed) | S/mod/I | `#/moderation`, `#/agreements`, `#/volunteers` | server | RPC `decide_community_case`, `appeal_community_decision`, `request_community_escalation`, `volunteer_decide` | `community_cases/decisions/escalations/volunteers`, `moderation_audit_event` | `supabase/community.check.sql`; `docs/CAMPUS-MODERATION-SOP.md` | `app/src/screens/Moderation.test.tsx`, `Volunteers.test.tsx` | no staffed moderators (`OWNER-AND-ACCOUNTABILITY-MATRIX.md` Moderator role: Harrison Rubin, backup UNASSIGNED) | PARTIAL | people, not code | owner staffing |

### D8 Family / guardian

| ID | Capability | User | UI path | State | Server / API | DB objects | Policy / audit | Tests | Ops evidence | Label | Gap | Next action |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| CAP-041 | Family | S/G | `#/family` | ST + server | RPC `make_family_invite`, `claim_family_invite`, `make_family_share`, `read_family_share`; BR `family_*` | `family_grants/invites/shared_items/access_events`, `guardian_links`, `_restrictions`, `_link_history` | `supabase/family.check.sql`, `familyshare.check.sql`, `familyinvites.check.sql`, `k12-guardians.check.sql`; `supabase/export-withholds-guardian-restrictions.check.sql` | `app/src/lib/familyshare.test.ts`, `familyinvites.test.ts` | institution policy required; no institution | PARTIAL | `family` UI "PARTIALLY FUNCTIONAL" per completeness matrix; gateway `family.ts` has no adapter | Counsel (minors) |

### D9 Finance

| ID | Capability | User | UI path | State | Server / API | DB objects | Policy / audit | Tests | Ops evidence | Label | Gap | Next action |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| CAP-046 | Money | S/G | `#/costs`, `#/nil` | ST | none | none | n/a | `app/src/lib/costsonly.test.ts` | smoke only | CLIENT-ONLY-DEMO | figures typed | - |
| CAP-084 | Student accounts and payment plans (proposed) | S/Bursar | University tab `components/institutional/StudentAccounts.tsx`, `#/bill` | server | BR insert/update `student_account_requests/closes/reconciliations`, `student_payment_plans` (`finance/api.ts`, `plans.ts`) | 11 finance tables | `supabase/financial-retention.check.sql` | `app/src/lib/finance/*.test.ts` | flag `VITE_STUDENT_ACCOUNTS`; no ERP adapter | PARTIAL | high-risk class (`docs/CAPABILITY-ACTIVATION-REGISTER.md`); direct browser inserts on ledger-like tables | Per-table policy and audit review before any pilot |

### D10 Career / alumni

| ID | Capability | User | UI path | State | Server / API | DB objects | Policy / audit | Tests | Ops evidence | Label | Gap | Next action |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| CAP-052 | People and letters | S/A | `#/people` | ST | none | none | n/a | none found | smoke only | OPERATIONAL-UNDER-GOVERNED | - | add test |
| CAP-053 | Pathway | S/A | `#/pathway`, `#/launchpad` | ST | none | none | n/a | `app/src/lib/pathway.test.ts`, `app/src/screens/pathway.test.tsx` | smoke only | OPERATIONAL-UNDER-GOVERNED | - | - |
| CAP-054 | Career | S/A/P | `#/career`, `#/opportunities` | ST; opportunities BR | BR `opportunities` insert (`ListingDesk.tsx`) | `opportunities`, `talent_profiles`, `skill_claim` | `supabase/listings.check.sql` | `app/src/lib/career.test.ts`, `career-evidence.test.ts` | flag `career_evidence` | PARTIAL | skills graph device-local (`docs/DOMAIN-REPLACEMENT-REGISTER.md` Career row) | - |
| CAP-055 | Applications | S/P | `#/applying` | ST | none | none | n/a | none found | smoke only | OPERATIONAL-UNDER-GOVERNED | - | add test |
| CAP-085 | Mentoring (proposed) | S/alumni | `#/launchpad`, `#/opportunities` | server | RPC `request_mentor`, `answer_mentor_request`; `app/src/lib/mentors.ts` | `mentor_requests`, `peer_mentor_offers/assignments`, `alumni_mentor_offers` | `supabase/mentor-rosters.check.sql` | - | none | PARTIAL | - | - |
| CAP-086 | Credential wallet (proposed) | S | `components/CredentialWallet.tsx` | ST | none | none | n/a | `app/src/lib/credential-wallet.test.ts` | flagged | PARTIAL | `docs/CREDENTIAL-WALLET.md`; registry lists "Credential wallet portability: planned_but_not_exposed" | - |

### D11 Marketplace

| ID | Capability | User | UI path | State | Server / API | DB objects | Policy / audit | Tests | Ops evidence | Label | Gap | Next action |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| CAP-087 | Marketplace (providers, listings, orders, payouts) (proposed) | S/P | none | none | none | **0 tables** | none | none | none | DOCUMENTED-UNIMPLEMENTED | `docs/target-architecture/04-DOMAIN-BOUNDARIES-AND-OWNERSHIP.md` marks it "gated off until consumer-protection/tax review"; `docs/product/capability-inventory.md` "Marketplace partner verification: planned_but_not_exposed". `Springboard`/`Launchpad` screens are lifecycle, not commerce | Keep unbuilt; counsel gate |

### D12 Administration

| ID | Capability | User | UI path | State | Server / API | DB objects | Policy / audit | Tests | Ops evidence | Label | Gap | Next action |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| CAP-013 | Connect accounts | S/I | `#/connect` | server + browser OAuth | EF `canvas`; `VITE_OAUTH_PROXY`; `app/src/lib/connect*.ts` | `connections` | RLS; `supabase/connections.check.sql` | `app/src/lib/connect.test.ts` | providers not all live | PARTIAL | `institution_controlled` in the inventory | - |
| CAP-088 | Operator console (proposed) | O | `#/console` `screens/Console.tsx` | server | RPC `console_act`, `console_approvals`, `console_audit_read`, `console_break_glass`, `console_command_center` | `console_action_record`, `console_duty`, `private.console_audit_*` | MFA recency check (migration `20260929100000_console_control_plane.sql`); `supabase/console-control-plane.check.sql`, `console-approvals.check.sql` | `app/src/screens/console.test.tsx` | one operator (Harrison Rubin) | PARTIAL | one person holds requester and approver seats (`OWNER-AND-ACCOUNTABILITY-MATRIX.md` decision rights) | second seat |
| CAP-089 | Configuration Studio (proposed) | I | University tab | server | BR `school_config_versions` insert/update/delete (`config/api.ts`) | `school_config_versions` | `supabase/configuration-studio.check.sql` | `app/src/lib/config/*.test.ts` | flag `VITE_CONFIGURATION_STUDIO` | PARTIAL | direct browser write | policy/audit review |
| CAP-090 | Workflow builder (proposed) | I | University tab | server | BR `workflow_versions` (`workflow/api.ts`) | `workflow_versions` | `app/src/lib/workflow` + packages `workflow.ts` state machines | `packages/institution/src/workflow.test.ts` | flag `VITE_WORKFLOW_BUILDER` | PARTIAL | `@semester/platform` workflow engine unmounted | - |
| CAP-091 | Migration Center (proposed) | I | University tab | server | BR `migration_projects/runs/field_maps/approvals` (`migration/api.ts`) | `migration_*` (4) | `supabase/migration-center.check.sql` | `app/src/lib/migration/*.test.ts` | flag `VITE_MIGRATION_CENTER` | PARTIAL | direct writes; no live source | - |
| CAP-092 | Integration control plane + sync worker (proposed) | I/O | University -> Control | server | EF `integration-tick`; `app/server/integration/{tick,worker}.ts`; RPC `integration_set_paused`, `integration_request_replay` | `integration_*` (17), `private.integration_simulation_runs` | `supabase/integration-control-plane.check.sql`, `integration-rls-matrix.check.sql`, `integration-tick-auth.check.sql` | `app/server/integration/tick.test.ts`, `app/src/components/institutional/IntegrationDashboard.test.tsx` | `ADAPTERS = []`: runs nothing | PARTIAL | no live adapter | - |
| CAP-093 | Tenant feature policy, module modes (proposed) | I/O | University -> Modules | server | RPC `effective_module_modes`, `feature_state`; BR `module_mode_request/approval` | `tenant_feature_policy`, `tenant_module_mode`, `tenant_rollout*`, `feature_kill_switch` | `supabase/tenant-rollout.check.sql`, `feature_cohorts.check.sql` | `app/src/lib/modulegate.ts` callers | flags are mostly build-time (73 `VITE_*`) | PARTIAL | server per-tenant switch exists beside a build-time layer; two systems | Decide single source |
| CAP-094 | Audit ledger / record ledger (proposed) | I/O | University -> Records | server | `private.ledger_chain*`; RPC `console_audit_status` | `private.ledger_chain`, `_key`, `_manifest`, `_verification`, `audit_event` | `supabase/ledger-chains.check.sql`, `ledger-seals.check.sql` | `app/src/components/institutional/RecordLedger.tsx` callers | none | PARTIAL | production search/export "Implemented foundation" only (`docs/product/capability-registry.md`) | - |

### D13 Support / trust

| ID | Capability | User | UI path | State | Server / API | DB objects | Policy / audit | Tests | Ops evidence | Label | Gap | Next action |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| CAP-014 | Your data, how it runs | S/I | `#/data` | ST | none | none | n/a | `app/src/components/DataRightsRequests.test.tsx` | smoke only | OPERATIONAL-UNDER-GOVERNED | - | - |
| CAP-019 | How this works | all | `#/help` | static | RPC `my_help_destinations`, `help_inbox` | `help_destinations`, `help_requests` | RLS; `supabase/help-requests.check.sql` | `app/src/screens/help.knownlimitations.test.tsx` | `help.statuslink.test.ts` | OPERATIONAL-UNDER-GOVERNED | - | - |
| CAP-095 | Support tickets (proposed) | S/staff | `#/help`, `#/support`, Console | server | RPC `open_support_ticket`, `support_reply`, `my_support_tickets`; EF `support-reply-notify` | `support_tickets`, `support_ticket_messages`, `support_notification_outbox` | `supabase/support-tickets.check.sql` | `app/src/lib/supporttickets.ts` callers | flag `VITE_SUPPORT_TICKETS`; no staffed hours (`OWNER-AND-ACCOUNTABILITY-MATRIX.md` Support: "hours, backup and channel test" absent) | PARTIAL | staffing | owner |
| CAP-096 | Support access / break-glass (proposed) | O/S | Console, `#/privacy` | server | RPC `create_support_access`, `console_break_glass`, `close_break_glass` | `support_access_grant`, `support_access_event`, `break_glass_grant` | `supabase/support-access.check.sql` | - | none | PARTIAL | - | - |
| CAP-097 | Trust room (proposed) | prospects/I | `#/trustroom` | server | EF `trust-room` | `trust_room_*`, `trust_artifacts` | `supabase/trust-room.check.sql` | `app/src/screens/trustroom.test.tsx` | flag `VITE_TRUST_CENTER` | PARTIAL | artifacts curated by hand | counsel |
| CAP-098 | Retention, holds, deletion (proposed) | S/O | `#/privacy` | server | EF `delete-account`; RPC; sweeps | `legal_holds`, `data_requests` | `supabase/deletion.check.sql`, `retention-sweeps.check.sql`, `legal-holds.check.sql`, `hold-aware-sweeps.check.sql` | - | `RETENTION.md` doc | PARTIAL | no restore/erase drill run by this audit | Phase 1 drill |

### D14 Company ops

| ID | Capability | User | UI path | State | Server / API | DB objects | Policy / audit | Tests | Ops evidence | Label | Gap | Next action |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| CAP-099 | Billing and membership (proposed) | S/O | `app/src/lib/membership.ts` UI under Account | server | EF `billing-checkout`, `billing-cancel`, `billing-portal`, `billing-webhook` | `commercial_*`, `subscriptions`, `checkout_sessions`, `payment_events`, `dunning_*`, `invoices` | signature-verified webhook invariant (`docs/ARCHITECTURE.md` invariant 8); `supabase/commercial.check.sql` | `app/src/lib/membership.ts` callers | "no billing provider (D-009)" in `docs/ARCHITECTURE.md` target table; live Stripe not shown | PARTIAL | decision and counsel/tax | - |
| CAP-100 | GTM campaigns (proposed) | O | University -> Campaigns | server | BR `gtm_campaigns`, `gtm_campaign_reviews`; RPC `gtm_*` | 17 `gtm_*` tables | `supabase/gtm.check.sql` | `app/src/lib/gtm/*.test.ts` | flag `VITE_CAMPAIGN_MANAGER` | PARTIAL | owner-equals-approver | second reviewer |
| CAP-101 | Lead intake (proposed) | prospects | `company-site/` | server | EF `lead-intake` | `site_leads`, `private.site_lead_hits` | - | - | none | UNKNOWN-INVESTIGATE | company-site not audited here | - |
| CAP-102 | Referrals (proposed) | S | Account | server | RPC `claim_referral`, `make_referral_code` | `referrals`, `referral_codes` | - | - | none | PARTIAL | - | - |
| CAP-103 | Company operating registers (proposed) | O | docs rendered from `app/src/lib/ops/*.ts` | TS data | none (only tests render docs) | none | `app/src/lib/ops/operatingsystem.ts` | tests render registers | none | DOCUMENTED-UNIMPLEMENTED | 22 files in `app/src/lib/ops/` are registers, not workflows; `SEMESTER-OPERATING-SYSTEM.md` is the doc | - |
| CAP-104 | Beta programme (proposed) | S/O | Account | server | RPC `join_beta`, `beta_send_feedback`, `my_beta` | `beta_*` (8) | `supabase/beta.check.sql` | `app/src/lib/beta.ts` callers | flag `VITE_PRIVATE_BETA` | PARTIAL | - | - |

## 7. Counts of labels

Counted with `grep -E "^\| CAP-" | grep -c "| <label> |"` over section 6 (105 rows: the 60 repository IDs plus 45 proposed IDs; proposed IDs are not contiguous, `CAP-074` and others are unused).

| Label | Rows |
|---|---|
| OPERATIONAL-UNDER-GOVERNED | 46 |
| PARTIAL | 45 |
| CLIENT-ONLY-DEMO | 10 |
| DOCUMENTED-UNIMPLEMENTED | 3 |
| UNKNOWN-INVESTIGATE | 1 |
| OPERATIONAL-VERIFIED, RETIRE-CANDIDATE | 0 |

Not used: `OPERATIONAL-VERIFIED` (no production-use evidence found), `RETIRE-CANDIDATE` (no evidence-backed retire case; `call` is queued as UNKNOWN-INVESTIGATE).

## Open questions / not verified

1. Whether production runs the Vercel gateway, and what `VITE_UNIVERSITY_GATEWAY_URL` is set to (repo has the build step, `.github/workflows/pages.yml:124`, not the value).
2. Any row's actual production use: no telemetry or run logs are in the repo; `production-smoke.yml` results were not read.
3. Per-table RLS policy and audit coverage for the 50 direct-write tables: `database/TENANT_ISOLATION_MATRIX.md` says the per-object matrix is not written; I did not write it.
4. No push-specific check suite was found (`CAP-018`); other check-suite names were confirmed by `ls`.
5. Whether capability rows beyond `CAP-060` should be adopted into `app/src/lib/rollout-capabilities.ts` (owner decision; the registry is test-guarded and I did not touch it).
6. Test paths are nearest-by-name, not coverage; `none found` means `ls lib/<name>*.test.*` returned nothing, and an indirect test may exist.
7. Customer-side seats, legal, accessibility and security posture are out of this document's scope.
