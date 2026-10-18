# 09 · Conversion plan: React/Vite/Supabase → target architecture, without losing functionality

> Part of the [CTO architecture pack](README.md). Status: **proposed**.
> Constraint inherited from `ADDITIVE-UNIVERSITY-OS-MIGRATION-PLAN.md`: nothing
> removed, renamed or loosened; every new table has RLS and a check suite;
> surfaces stay off by default per build and per school.

## 1. Strategy: strangler fig, seam first, evidence at every step

The audit asks for a "clean-platform rebuild" and "no screen-by-screen copying
into the new core". The repository's reality — ~620 k lines, 1,219 test files,
171 migrations with 106 isolation suites, and **no production tenants yet** —
argues for a *stricter* reading, not a looser one:

> **Rebuild the spine (kernel, tenancy, policy, events, contracts, sync,
> deploy) from scratch and correctly; move the existing capabilities onto it
> one seam at a time; port screens only after the domain logic beneath them is
> behind a contract.**

Why not a ground-up rewrite: the tests *are* the specification of what exists
("keeping all existing capabilities as requirements"); a rewrite discards them.
Why not leave it: the 3 policy actions, 0 outbox producers, 0 live adapters,
no workspace and a 4.7 k-line spreadsheet screen show the spine is not there.

Five moves, repeated per capability:

1. **Characterise:** the existing behaviour is pinned by its current tests plus
   a golden-master of its persisted shape (`state/shape.ts` versioned shapes
   are already the contract).
2. **Extract the pure domain** into `packages/domain-*` (no React, no I/O).
   The old screen now imports it; tests move with it; behaviour is unchanged.
3. **Put a contract in front** (command/query + Zod/OpenAPI + PDP action +
   event). The old path and the new path both exist.
4. **Shadow, then switch:** run new path in shadow, compare results, flip
   behind a flag per ring ([05](05-ENVIRONMENTS-AND-ROLLOUT.md)), then delete
   the old path in a *later* release.
5. **Retire** only when the parity gate (§5) has been green for a full release
   train.

## 2. What exists → where it goes

### 2.1 Clients and state

| Existing | Becomes | Method |
| --- | --- | --- |
| `app/` (Vite SPA) | `apps/student-web` | first workspace commit moves **nothing**; later `git mv` per package keeps history |
| `app/src/screens.tsx` registry (one row per screen), `lib/nav.ts`, `App.tsx` | stays the composition root of `student-web`; ROOTS unchanged (DO-NOT-BUILD rule 1) | no change |
| `screens/Sheet.tsx` (4,749) + `lib/sheet.ts` (3,697) + `lib/plot.ts` | `packages/domain-productivity/sheet` (engine) + a thin screen | extract formula engine first; screen splits along `screens/sheet/` subdir that already exists |
| `Calendar.tsx` (3,005), `Today.tsx` (2,123), `Write.tsx` (2,718), `Guide.tsx`, `Mine.tsx` | same pattern: domain logic → `packages/domain-*`; screen composes | complexity budgets ratchet down each extraction |
| `state/store.tsx`, `reducer.ts`, `shape.ts`, `slices/*` | `packages/offline-sync` (store port, versioned shapes) + `packages/domain-*` slices | `shape.ts` versions are preserved byte-for-byte; add a `LocalStore` port with the IndexedDB adapter first |
| `state/persist/db.ts` (IndexedDB `semester-store`, localStorage fallback) | `LocalStore` adapter `idb`; native `sqlcipher` adapter later | **one-time local migration** with export-before-migrate and restore path (§4) |
| `lib/cloud.ts` (field-by-field `OWNED_TABLES` sync), `lib/merge.ts`, `lib/sync/*` | `offline-sync` v0 client talking to Supabase **and** later `sync-gateway` | dual transport: same merge code, new transport behind a flag per ring |
| `lib/look.ts`, `components/ui.tsx`, `styles/*`, `a11y/*` | `packages/design-system`, `packages/a11y` | tokens first (contrast tests move with them); components after |
| `lib/role.ts`, `lib/capabilities.ts` (client gating) | `packages/policy-sdk` (UX hints generated from the same rules) | server remains authoritative; client hints get a conformance test |
| `lib/claude.ts` (1,774 lines, AI client) + `ai/*` + `intelligence/*` | `packages/api-client/ai` + `services/ai-gateway`; prompt assembly moves server-side where it touches tenant data | student-own-key path stays client-only |
| `src/site/*`, `company-site/` | `apps/public-site` | static; low risk, early win for the workspace |
| `lib/governance/*`, `lib/ops/*`, 40+ register generators (`npm run registers`) | stay in the app package until `tools/registers`; they generate docs and are held by tests | no behavioural change |

### 2.2 Server

| Existing | Becomes | Notes |
| --- | --- | --- |
| `app/server/institution/*` (57 files), `app/api/institution/[...path].ts` | `services/core` modules (`registration`, `advising`, `athletics`, `career`, `clubs`, `family`, `housing`, `money`, `membership`, `auth`, `intelligence*`) behind the same URLs | **keep `/api/institution/*` paths stable**; Vercel function becomes a thin adapter or is retired when `core` serves them. `check:university` generalises to `check:server` |
| `packages/institution/src/{policy,events,workflow,identity,provisioning,...}` | `packages/kernel` + `packages/contracts` | pure move; imports re-exported from the old path for one release |
| `packages/contract` (9 academic collections) | `packages/contracts/records` | unchanged shapes |
| `server/institution/adapters.ts`, `server/integration/registry.ts` (both empty by design) | one registry in `integration-hub` with `preflight` | the sandbox-must-stay-out rule is preserved as a test |
| `server/institution/journal*.ts`, `postgres-journal.ts` | `platform/audit` (encrypted journal → per-tenant keys) | journal format versioned; old rows readable |
| `scim*.ts`, `postgres-scim.ts` | `identity/scim` | stays **off** until a real directory test exists |

### 2.3 Edge functions (16) → destinations

| Function | Destination | Why / constraint |
| --- | --- | --- |
| `claude` | `ai-gateway` | metered, kill-switch and clamp logic move intact (`_shared/clamp.ts`, `killswitch.ts`) |
| `billing-checkout`, `-portal`, `-cancel`, `-webhook` | `finance` (webhook ingestion isolated) | signature verification + raw-body storage preserved; stays Stripe-hosted checkout |
| `lti` (881 lines + `_shared/lti*`) | `integration-hub/lti` + `learning` | launch/AGS/deep-link; **needs a real Brightspace/Canvas test platform in integration env before move** |
| `integration-tick` | `integration-hub` scheduler | cron secret → workload identity |
| `calendar`, `fetchcal` | `integration-hub/calendar` (SSRF guard preserved) | CORS-less hosts need a server forever |
| `canvas` | `integration-hub/canvas` | proxy of reads for the signed-in device |
| `push`, `support-reply-notify`, `lead-intake` | `notification` | caps/preferences stay in `lib/notify` rules |
| `trust-room`, `delete-account` | `support-trust`, `identity` lifecycle | deletion honours legal hold + status tracking |
| `productivity-sourcecheck` | `productivity` | allow-listed hosts only |

Rule: **edge functions keep running until their replacement has passed the
parity gate**; deployment of both is allowed, routing is by flag/ring.
`verify_jwt=false` + self-verification (current) stays for any function not yet
moved.

### 2.4 Database

| Existing | Action |
| --- | --- |
| 171 migrations, ~321 tables, ~536 policies | **Frozen as baseline** (`db/baseline`), never rewritten. A one-time **ownership ledger** assigns every table to a module (`tools/ownership/tables.json`), enforced by a test that fails on an unassigned or double-assigned table |
| RLS without `FORCE` | migration `…force_rls.sql` for all application tables, preceded by a check that service paths use roles that bypass RLS deliberately (e.g. `BYPASSRLS` service role) and a rehearsal on staging; all 106 suites must stay green |
| `private.has_capability()`, `role_grants` | stay; wrapped by PDP `RoleGrant` loading |
| Tenant context helpers (`app.tenant_id` etc.) not adopted (`multi-tenant-isolation.md`) | adopt for `core` connections only; legacy direct-client RLS (Supabase JS from the SPA) keeps using `auth.uid()` helpers |
| `audit_event` + 10+ domain audit tables | `platform.audit` view unifying them; hash-chain (`private.ledger_chain`) coverage extended to every consequential audit stream |
| Supabase Auth, Storage, Realtime | behind ports; used as-is through ring 2 |

### 2.5 Delivery, docs, registers

| Existing | Action |
| --- | --- |
| `ci.yml` (serial), `pages.yml`, `functions.yml`, `hawkscan.yml`, `contrast.yml`, `production-smoke.yml` | decomposed into stages ([06](06-DELIVERY-AND-OPERATIONS.md) §1); every existing check preserved by name in the required-checks list |
| GitHub Pages hosting of the SPA vs Vercel (undecided, `ARCHITECTURE.md` C-4) | decide in wave C2 with P-12; until then Pages stays |
| ~310 root and `docs/` documents | stay; **reconcile, don't fork**: this pack links to them; a docs-index test (existing `source-index`) gains a `target-architecture` section |
| `ROLLBACK.md`, `RESTORE.md`, `SECRETS.md`, `MONITORING.md`, `SECURITY.md` | updated in place when the mechanism they describe changes |

## 3. Waves (sequenced; each ships)

| Wave | Scope | Depends on | Deliverables | Exit gate (all automatic or signed) |
| --- | --- | --- | --- | --- |
| **C0 Foundations** (M0) | pnpm + Turbo workspace around `app/`; `packages/kernel` & `contracts` extracted from `packages/institution` (re-exports kept); boundary checker + migration linter; ownership ledger; **`FORCE` RLS**; `app.*` tenant context for core connections; OTel libs; staging IaC; merge queue | — | workspace commit; boundary dag; ledger JSON; migration; dashboards | identical test counts/green; boundary negative fixtures go red; 106 suites green post-`FORCE`; restore drill |
| **C1 Spine** | PDP coverage for the 10 highest-risk actions (grade change, registration, deletion, support access, export, guardian read, break-glass, AI retrieval, billing change, role grant); outbox producers in 3 modules; relay + receipt ledger; idempotency middleware; error-envelope on every route | C0 | command catalogue v1; conformance runner | PDP↔RLS agreement on all 10; idempotency generic test over every command; no route without correlation headers |
| **C2 Core runtime** | `services/core` deployed (container) serving `/api/institution/*` + first new commands; Vercel function demoted to adapter; OpenAPI + generated client for the 3 busiest query paths; P-02/P-13/P-10/P-14 ADRs accepted | C1 | `core` in staging then ring 0; canary pipeline | canary auto-abort demonstrated by an injected failure; SLO dashboards live |
| **C3 Sync & AI** | `sync-gateway`, `offline-sync` with `LocalStore` port (IndexedDB), command queue for institutional commands; `ai-gateway` with `claude` function folded in; consent/AI event log | C2 | sync simulator; AI eval gate | simulator green (partition/reorder/duplicate/skew/revoke); injection + eval gates required; student-key mode unaffected |
| **C4 Integrations** | integration-hub: scheduler, DLQ, reconciliation, first **real** adapter (LTI/Canvas or SIS as the design partner dictates); `lti`, `integration-tick`, `fetchcal`, `canvas`, `calendar` moved | C2 | connector health UI; discrepancy report | provider-degraded run green for all domains; reconciliation clean on partner extract; DLQ replay drill |
| **C5 Domains** (M3–M5, parallel by team) | per domain: extract pure logic → contract → shadow → switch (§1). Order: productivity → academic/learning → campus/community → family → finance → career → marketplace | C2, C3 | per-module `MODULE.md`, SLO, runbook, threat model | the 16-point completion standard per capability; parity gate §5 |
| **C6 Native mobile** (M2) | `apps/mobile` Capacitor; SQLCipher adapter; wipe; push | C3 | TestFlight/Play internal builds | P-07 gate; device-posture tests; a11y on device |
| **C7 Retire legacy** | delete old code paths whose parity gate has held a full train; shrink `app/` | C5 | deletion PRs (each its own revert point) | no flag references; budgets ratcheted down |

C0 and C1 are **doable by the current single owner plus the first two hires**;
nothing in them needs a new customer, a cloud decision, or counsel.

## 4. Data migrations (the places where users could lose something)

1. **Device data (IndexedDB/localStorage → `LocalStore`):** the versioned
   shapes (`semester.*.vN`) already carry migrations. Procedure: (a) write a
   full export (the app already has export/restore); (b) migrate in place into
   the new store; (c) keep the old keys read-only for one release; (d) verify
   counts + checksums per collection; (e) on any mismatch, restore from (a) and
   report with a support reference. Tested by a fixture corpus of old-shape
   snapshots from every shipped version.
2. **Cloud sync tables (`OWNED_TABLES`):** unchanged in C0–C2. When
   `sync-gateway` arrives it reads and writes the same tables; clients on the
   old protocol keep working for ≥ 90 days (compat window), enforced by a
   protocol-version header and a contract test that replays recorded old-client
   traffic against the new server.
3. **Postgres:** expand/contract only ([06](06-DELIVERY-AND-OPERATIONS.md) §4); table ownership is metadata, not a physical move; any later physical move to a module schema uses `ALTER TABLE … SET SCHEMA` with a compatibility view in the old schema for one train.
4. **Secrets/keys:** the single `SEMESTER_JOURNAL_KEY` → per-tenant wrapped
   keys by dual-read (decrypt with either, write with new), then a re-encrypt
   job, then retire the old key; verified by a journal replay.
5. **Hosting cutover (Pages/Vercel → target):** DNS with low TTL, both origins
   live, service worker scope and `VITE_BASE` verified, rollback = DNS flip.

## 5. The parity gate: "no functionality lost" as a build failure

Capability is reachable only through registered screens, flags, functions,
tables and tests — the repository already has the registers (`FEATURE-INVENTORY.md`,
`CAPABILITY-PARITY-MATRIX.md`, `DOMAIN-REPLACEMENT-REGISTER.md`,
`screens.test.ts`, `audit:screens`, `census:exports`, `site/modules.ts`). **Do
not build a second ledger** (the repository's own lesson about duplicates).
Instead add one column — *target module* — to the existing screen/module
registers and make three things tests:

1. **Completeness:** every screen id in `SCREENS`, every
   `supabase/functions/*` directory, every table in the ownership ledger has
   exactly one target module.
2. **No orphan on retire:** a legacy path may be deleted only if every
   registered capability that referenced it points at a new path whose parity
   evidence (below) is recorded.
3. **Parity evidence per capability:** names the old test(s) that still pass
   against the new path (the old tests are *re-pointed*, not rewritten), the
   journey smoke that covers it (`smoke:golden`, `smoke:sync`, `smoke:a11y`),
   and a shadow-read diff of zero over N days where data is read.

Journey smokes that must stay green through *every* wave: `smoke:cold`,
`smoke:a11y`, `smoke:golden` (sign-in → workspace → help → completion →
resume on a second device), `smoke:sync` (two-device account lifecycle),
`smoke:production`, `drill:killswitch`.

## 6. Risks specific to conversion

| Risk | Control |
| --- | --- |
| Two sources of truth during dual-run | per-capability flag decides the *only* writer; the other path is read-only/shadow |
| Large-screen decomposition regresses UX | extraction is behaviour-neutral; visual check by driving the app (`.claude/skills/run`) per CLAUDE.md "look at the screenshot"; complexity budgets ratchet |
| Test suite wall-clock grows | affected-only graph; shuffled-order and TZ matrices stay but run in parallel shards |
| Parallel sessions converge on the same fix | CLAUDE.md "check main for the thing itself"; merge queue; one owner per module |
| `FORCE` RLS breaks a service path | rehearsal on production-sized staging; the 106 suites are the safety net; staged by schema |
| Consumer plane vs institutional plane drift | one codebase, ring-separated tenants; release profiles already encode the split |

## 7. First 10 pull requests (implementation-ready)

Each is small, independently green, and its own decision where one is needed.

1. `chore(workspace)`, **staged (corrected on starting C0)**: this line first said the workspace commit "moves nothing" and makes `app/` a workspace package. That is not behaviour-neutral here: every CI job runs `npm ci` with `working-directory: app` against `app/package-lock.json`, and two Vercel projects use `app` and `company-site` as root directories, so moving the lockfile to the root edits every workflow and depends on dashboard settings. Decided instead: **1a** root `package.json` + lockfile with npm workspaces for `packages/*` only (this is P-01's stated fallback; pnpm and Turborepo are deferred, not rejected); **1b** `app/` joins the workspace, with the workflow edits proven by CI on that PR. The dry run found five things that moving the lockfile breaks and that nothing flagged beforehand: (i) `overrides` in `app/package.json` are ignored by npm in a workspace member, so the `lodash-es` and `dompurify` security pins would have silently stopped applying, and `npm ls` / `npm sbom` fail on the invalid tree; they move to the root manifest; (ii) the root manifest needs a `version` or `npm sbom` (the deploy's SBOM step) fails with `EINVALIDPURLTYPE`; (iii) eight `packages/institution` tests import vitest by the fixed path `../../../app/node_modules/vitest/…`, which stops existing once dependencies hoist (now a bare `vitest` import); (iv) two preview scripts located vite under `app/node_modules` (now resolved through Node); (v) the supply-chain test treated the workspace members and their links as unlicensed third-party packages. The resolved dependency set was proven identical (all 291 packages, same version, URL and integrity hash); **1c** the pnpm/Turborepo decision, taken once 1b has run. Test gate for 1a: same suite, same counts (1,265 files; 19,744 passed, 48 skipped on `main` dac31c9).
2. `chore(ci)`: required-checks list recorded in `.github/rulesets`; turbo-affected CI; merge queue on.
3. `refactor(kernel)`: move `policy/events/workflow` to `packages/kernel` with re-exports from `@semester/institution`; `check:server` replaces `check:university`.
4. `feat(boundaries)`, **done as `app/src/lib/importgraph.ts` and `importboundaries.ts`, not `tools/boundaries`**: no parser dependency (TypeScript 7 exposes no compiler API, and a parser is a line in `docs/SUPPLY-CHAIN.md`), so imports are read by a small tokenizer that was checked against a real parser on 2,879 files with no disagreement. The rules are the ones that already hold on `main` — `packages/` and `supabase/functions/` are leaves, the gateway stays out of the functions (#803), the gateway's dependencies are named, and nothing the browser loads from `src/main.tsx` reaches a Node built-in, the server, a script or a test — plus one ratchet for the 15 imports by which `app/server/integration` uses `app/src/lib/integration`. The module DAG and per-module `index.ts` rules wait for the modules to exist (wave C1+). Its first catch was `main` itself: a new `packages/platform` whose tests imported vitest through the `app/node_modules` path that 1b removed, and whose lockfile entry was missing, so `npm ci` failed on `main`.
5. `feat(db)`: ownership ledger + completeness test (no table unowned/double-owned).
6. `feat(db)`: migration linter (tenant_id, RLS, FORCE, expand/contract) with red-then-green fixtures.
7. `feat(db)`: `FORCE ROW LEVEL SECURITY` on application tables, rehearsed.
8. `feat(policy)`: PDP actions for the 10 high-risk commands + conformance runner.
9. `feat(events)`: first outbox producers (audit-bearing: role grant, deletion request, support access) + relay.
10. `feat(obs)`: OTel package, redaction test, first journey dashboards; staging Terraform skeleton.

After PR 10 the platform spine exists and every later wave is a slice through
it, not a rebuild.
