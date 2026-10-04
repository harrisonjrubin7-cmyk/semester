# 02 · Monorepo structure

> Part of the [CTO architecture pack](README.md). Status: **proposed**.

## 1. Starting point (measured, not assumed)

| Fact | Value | Consequence |
| --- | --- | --- |
| Workspace tooling | **none** — no root `package.json`; `app/` is the only app manifest; `packages/*` are consumed through TS path aliases (`@semester/contract`, `@semester/institution` → `src/index.ts`) | no dependency graph, no affected-only CI, no enforced import boundaries |
| App size | 2,631 `.ts/.tsx` files, ~620 k lines, 1,219 test files; `App.tsx` 1,649 lines; biggest screens `Sheet.tsx` 4,749, `Calendar.tsx` 3,005, `Write.tsx` 2,718, `Today.tsx` 2,123 | screens hold domain logic; extraction is by *seam*, not by file move |
| Server code | `app/server/institution` (57 files), `app/server/integration` (8), `app/api/institution/[...path].ts` (one Vercel function); 16 Supabase edge functions + `_shared/` (31 files) | two runtimes (Node, Deno), two ways to deploy, shared code constrained by NodeNext rules |
| Database | 171 migrations, 106 `*.check.sql` suites, one Supabase project | schema is *the* shared module today |
| Typecheck split | `tsc -b` (bundler) and `check:university` (NodeNext) | `packages/*` consumed by the gateway must stay NodeNext-clean; code under `supabase/functions/` stays out of anything the gateway imports (CLAUDE.md, #803) |

The monorepo is therefore **introduced around the existing code**, not built
beside it. The first commit of the new structure moves nothing; it adds the
workspace, the graph and the boundary check, then migrates one slice at a time
([09](09-CONVERSION-PLAN.md)).

## 2. Target tree

```text
semester/
├─ package.json                  # private; workspaces: apps/*, services/*, packages/*, tools/*
├─ pnpm-workspace.yaml           # (see P-01: pnpm; npm workspaces is the fallback)
├─ turbo.json                    # task graph + remote cache (P-01)
├─ tsconfig.base.json            # one strictness baseline; per-package extends
├─ .github/
│  ├─ CODEOWNERS                 # per-path owners (§5)
│  ├─ workflows/                 # ci, preview, release, rings, smoke, security, dr-drill
│  └─ rulesets/
├─ apps/                         # deployable clients — NO domain logic, composition only
│  ├─ student-web/               # ← app/ (React 19 + Vite) after strangling
│  ├─ staff-console/             # registrar, finance, student affairs, IT (University.tsx, Console.tsx, Registrar.tsx today)
│  ├─ faculty-console/           # gradebook, advising caseload (Gradebook.tsx, Advising)
│  ├─ guardian-web/              # consented family view (Family.tsx today)
│  ├─ mobile/                    # Capacitor shell: ios/ android/ + native plugins (SQLCipher, push, biometrics)
│  ├─ public-site/               # ← company-site/ + app/src/site
│  └─ ops-console/               # Semester-internal: tenant rings, support access, incidents (← ops/operations-console)
├─ services/                     # deployables
│  ├─ core/                      # the modular monolith: one process, many modules
│  │  ├─ src/modules/
│  │  │  ├─ identity/            # accounts, MFA/passkeys, sessions, devices, tenancy, SSO/SCIM
│  │  │  ├─ academic/            # terms, catalog, sections, enrollment, degree audit, records
│  │  │  ├─ learning/            # courses, assignments, submissions, gradebook, assessment
│  │  │  ├─ productivity/        # tasks, calendar, notes, docs, sheets, decks, study
│  │  │  ├─ campus/              # events, maps, dining, housing, directory, clubs, athletics
│  │  │  ├─ community/           # groups, messaging, moderation
│  │  │  ├─ family/              # guardian relationships, consent, sharing scopes
│  │  │  ├─ finance/             # ledger, charges, payment plans, billing (student + tenant)
│  │  │  ├─ career/              # portfolio, opportunities, applications, alumni
│  │  │  ├─ marketplace/         # providers, listings, orders, disputes, payouts
│  │  │  ├─ support-trust/       # tickets, trust room, safety, legal holds, retention
│  │  │  └─ admin/               # configuration studio, workflows, reports, imports
│  │  ├─ src/platform/           # in-process shared kernel: policy, outbox, audit, flags, files, notify
│  │  ├─ src/http/               # api-edge: routing, authN, tenant resolution, error envelope
│  │  └─ migrations/             # one directory per module schema (§4)
│  ├─ ai-gateway/                # separate deployable (P-09)
│  ├─ integration-hub/           # connector workers: pull/map/reconcile/push, scheduler
│  ├─ sync-gateway/              # offline sync protocol endpoint (P-08)
│  ├─ notification/              # push, email, digests, caps (DO-NOT-BUILD rule 4 lives here)
│  └─ workers/                   # search indexing, warehouse loaders, ledger anchoring, exports
├─ packages/                     # libraries; versioned in-repo, never published
│  ├─ contracts/                 # ← packages/contract + packages/institution/src/{identity,provisioning,...} — OpenAPI + Zod/TypeSpec sources, generated clients
│  ├─ kernel/                    # ← packages/institution/src/{policy,events,workflow}.ts : decide(), SemesterEvent, outbox, workflow machines, error envelope
│  ├─ policy-sdk/                # client-safe policy *hints* (UX only) generated from the same rules
│  ├─ api-client/                # generated, typed, retry/idempotency-aware client
│  ├─ offline-sync/              # local store port, command queue, CRDT log, conflict model (← state/persist, lib/sync, lib/merge, lib/cloud)
│  ├─ domain-*/                  # pure domain logic per domain (e.g. domain-productivity ← lib/sheet.ts, lib/plot.ts) — no I/O, no React
│  ├─ design-system/             # tokens + components (← lib/look.ts, components/ui.tsx, styles/)
│  ├─ a11y/                      # axe harness, focus/live-region utilities (← src/a11y)
│  ├─ observability/             # OTel setup, logger with redaction, web-vitals
│  ├─ event-schema/              # EVENT_TYPES catalog + JSON Schemas, compatibility checker
│  ├─ test-fixtures/             # synthetic tenants, personas, factories, second-account harness
│  └─ config/                    # eslint/oxlint, tsconfig, vitest presets
├─ infrastructure/
│  ├─ terraform/                 # modules: network, postgres, object-store, kms, queues, runtimes, dns, observability
│  ├─ environments/              # local, preview, integration, staging, prod-{region}, ring definitions
│  ├─ policy-as-code/            # OPA/Conftest on terraform plans, CI policy, branch protection as code
│  └─ observability/             # dashboards, alerts, SLO definitions as code
├─ contracts/                    # per-tenant JSON contracts (exists; owner-only via CODEOWNERS)
├─ db/
│  ├─ baseline/                  # 0000 schema snapshot of the 171-migration history (read-only reference)
│  └─ checks/                    # ← supabase/*.check.sql (second-account suites) — run for every module
├─ tools/                        # codegen, boundary checker, migration linter, ledger verifier, release scripts
├─ docs/
│  ├─ architecture/              # ADRs (exists, 0001–0010) + this pack's promoted ADRs
│  ├─ decisions/                 # D-<PR>.md (exists; see CLAUDE.md)
│  ├─ security/  privacy/  operations/  implementation/  product-specs/
│  └─ target-architecture/       # this pack
└─ extensions/  pipeline/  video/ # unchanged; become workspaces when they need shared packages
```

Mapping to the audit's "minimum repository structure": every directory it names
exists above. Deviations, with reasons: `services/*` per domain is replaced by
`services/core/src/modules/*` (one deployable, same seams — §3), and
`domain-contracts`/`event-schema` are split because contracts change on a
different cadence than event schemas.

## 3. Boundary rules (mechanically enforced)

A module is a directory with a public surface and a private interior.

```text
services/core/src/modules/<m>/
  index.ts          # PUBLIC: exported command handlers, query handlers, event types, DTOs
  api/              # HTTP routes + OpenAPI fragments for this module
  commands/ queries/ domain/ repo/ projections/ policy/ events/
  migrations/       # owns schema `<m>` only
  test/             # unit, contract, authz (second-account), property tests
  OWNERS            # team + escalation (mirrored into CODEOWNERS)
  MODULE.md         # purpose, objects owned, SLO, runbook link, data classes
```

Enforced today, for the zones that exist, by `app/src/lib/importboundaries.ts` (see [09](09-CONVERSION-PLAN.md) §7, PR 4); the module-level rules below wait for modules, and will be enforced by `tools/boundaries` (dependency-cruiser or `eslint-plugin-boundaries`,
P-01) as a **required CI check**:

| Rule | Why |
| --- | --- |
| A module imports another module **only through its `index.ts`**, never its interior | prevents hidden coupling |
| A module may not read another module's tables; cross-module reads use a query handler or a projection fed by events | the schema-per-module rule |
| `apps/*` import only `packages/*` and generated clients; never `services/*` | clients cannot reach into servers |
| `packages/domain-*` have **no** imports from `react`, `node:*`, `@supabase/*` | purity; testability; portability to native |
| `packages/*` consumed by `services/*` must typecheck under NodeNext (`check:university` generalised to `check:server`) | the #803 failure, prevented structurally |
| Nothing under `services/` imports `supabase/functions/**` | same |
| No import cycles between modules; the module DAG is checked into `tools/boundaries/dag.json` | extraction needs a DAG |
| Only `platform/` may import the DB driver; modules get a `Tx` handle with `tenant_id` already set | tenant context can't be forgotten |
| Only `notification/` may create a user notification (existing allow-list test generalised) | DO-NOT-BUILD rule 4 |

Each rule gets a **negative test**: a fixture that violates it and must turn the
check red (CLAUDE.md: a guard that has never failed is not known to be a guard).

## 4. Database layout

- One Postgres cluster, **one schema per module** (`identity`, `academic`, …,
  plus `platform` for outbox, audit, flags). Cross-schema foreign keys are
  forbidden except to `identity.tenant` and `identity.person`.
- Every table: `tenant_id uuid not null`, composite tenant FKs where it
  references another tenant-owned table, `ENABLE` **and `FORCE`** RLS, a
  `*.check.sql` second-account suite. A migration linter (`tools/migration-lint`)
  rejects a new table that lacks any of these, and rejects destructive DDL
  outside the *contract* phase of expand/contract ([06](06-DELIVERY-AND-OPERATIONS.md) §4).
- The 171 existing migrations are **not rewritten**. They are frozen as
  `db/baseline/` plus the live migration ledger (`supabase/ledger.snapshot`);
  new migrations land in the owning module's `migrations/` and are applied in
  timestamp order by the same tool. Ownership of the existing ~321 tables is
  assigned in a one-time ledger ([09](09-CONVERSION-PLAN.md) wave C1) without
  moving them.

## 5. Ownership files

`.github/CODEOWNERS` today has one owner for everything. The target gives each
path a *team*, with the single-owner reality recorded rather than hidden (the
file already does this):

```text
/services/core/src/platform/        @semester/platform
/services/core/src/modules/identity/ @semester/identity-trust
/services/core/src/modules/finance/  @semester/finance-commerce
/services/ai-gateway/               @semester/ai-platform
/services/integration-hub/          @semester/integrations
/packages/kernel/                   @semester/platform @semester/security
/packages/offline-sync/             @semester/sync
/packages/design-system/            @semester/design-systems @semester/accessibility
/infrastructure/                    @semester/sre
/db/ /services/**/migrations/       @semester/data-platform
/contracts/                         @harrisonjrubin7-cmyk   # tenant contracts stay owner-only (D-1019)
/docs/architecture/                 @semester/architecture-review
```

Until a second human exists, every team handle resolves to the same person and
`docs/BRANCH-PROTECTION.md` already says what that means. The staffing plan
([08](08-ORGANIZATION-AND-MILESTONES.md)) is ordered to fix *that* first.

## 6. Tooling — implementation-ready templates

These are templates to be committed in wave C0 and verified by CI on that
commit; none is wired today.

`pnpm-workspace.yaml`

```yaml
packages:
  - apps/*
  - services/*
  - packages/*
  - tools/*
```

`turbo.json`

```json
{
  "$schema": "https://turbo.build/schema.json",
  "tasks": {
    "typecheck":  { "dependsOn": ["^typecheck"], "outputs": [] },
    "lint":       { "outputs": [] },
    "test":       { "dependsOn": ["^build"], "outputs": ["coverage/**"] },
    "build":      { "dependsOn": ["^build"], "outputs": ["dist/**"] },
    "boundaries": { "outputs": [] },
    "contracts":  { "outputs": ["generated/**"] }
  }
}
```

Affected-only CI: `turbo run typecheck lint test build --filter=...[origin/main]`.
The existing `app/` gates (`tsc -b`, `lint`, `check:university`, `test`,
`test:shuffle`, `build`) become the `student-web` package's tasks unchanged, so
**the day-one workspace commit is behaviour-neutral and its proof is that the
same suite goes green with the same counts** (baseline figures live in
`REGRESSION-CHECKLIST.md`).

## 7. What does *not* change

`DO-NOT-BUILD.md`'s 13 rules, the seven top-level navigation roots
(`home, courses, study, calendar, support, mine, me`), the design-token system
(`lib/look.ts`, contrast-tested across all thirteen grounds), and the
`D-<PR>.md` decision convention. The audit proposes a different information
architecture (Today / Plan / Learn / Create / Campus / Path / Money / Support /
Assistant / Account); that would break rule 1 and is therefore **a portfolio
decision, not an architecture one** — recorded as open question Q1 in the
[README](README.md).
