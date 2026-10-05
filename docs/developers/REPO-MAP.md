# Repository map

> **Type:** reference · **Audience:** contributors · **Owner:** `engineering` · **Truth:** held · **Reviewed:** 2026-10-04 · **Held by:** `app/src/lib/docs/developers.test.ts`

This page says what lives in each top-level directory and each directory of `app/src`, and which import-direction rules a test enforces today; stop reading if you want a feature's status, which is in [`docs/FEATURE-TRUTH-TABLE.md`](../FEATURE-TRUTH-TABLE.md).

The test that holds this page fails if a path named in a table does not exist, and fails if a top-level directory or a directory of `app/src` exists that no table names. A new directory forces a row here.

## Top-level directories

Dot-directories are included. Files at the root are listed after the table.

| Path | What it holds |
| --- | --- |
| `app/` | The application and the institution gateway. Vite, React 19 and TypeScript. The only client `package.json`. All npm commands run here. |
| `audio/` | Podcast scripts, the manifest and the Python synthesiser that renders them. See [`audio/README.md`](../../audio/README.md). |
| `chats/` | The design conversation that produced the first version. Source material; the app does not import it. |
| `commercial/` | Commercial readiness evidence. Today one file, [`commercial/READINESS_GAP_MATRIX.md`](../../commercial/READINESS_GAP_MATRIX.md): the Phase 0 reading of what is stated, implemented and enforced for pricing, plans, billing, procurement and support. Documentation only; no code. |
| `company-site/` | A static company site (`index.html`, `site.css`, `site.js`, fonts, screenshots, `SHA256SUMS`). It has no `package.json`. |
| `contracts/` | A school's signed terms as data, one JSON file per tenant id. The owner writes them. See [`contracts/README.md`](../../contracts/README.md). |
| `database/` | Catalog-derived isolation evidence for production, read read-only: the tenant-isolation matrix, grant allowlist, function-authorization matrix and data-classification register, and `schema/inventory.sql`, which regenerates every figure. Nothing in it was applied to a database. See [`database/README.md`](../../database/README.md). |
| `docs/` | Documentation: registers, runbooks, architecture records, decision records, design standards. Indexed by `docs/README.md`, which is written outside this page's slice and may not be in your checkout yet. |
| `examples/` | Being added by another author. This row was written before the directory existed and says nothing about its contents. |
| `extensions/` | `semester-capture`, a browser extension (`manifest.json`, `popup.html`, `popup.js`). |
| `ops/` | Operating registers rendered from data under `app/src/lib/ops/`: billing, claims, customer commitments, master plan, operations console, strategic boundaries. See [`ops/README.md`](../../ops/README.md). |
| `output/` | Generated PDF reports built from `docs/business/` by `npm run generate:gtm-pdf` (from `app/`): the GTM playbook, executive summary, board and investor summary, and the customer-safe pilot pack. Generated files; edit the Markdown and the manifest in `app/scripts/gtm-pdf/`, then rebuild. |
| `packages/` | Two source-only packages shared by the app and the servers: `contract` and `institution`. Neither is published. |
| `pipeline/` | Syllabus to course tooling: ingest, lessons, slides, handouts, alignment, and `validate.mjs`, which CI runs. See [`pipeline/README.md`](../../pipeline/README.md). |
| `project/` | The original Claude Design handoff: HTML prototypes and the design system. Reference material; the app does not import it. |
| `scripts/` | Scanners for the static company site (`company-site-scan-*.mjs`). Not the app's scripts; those are in `app/scripts/`. |
| `supabase/` | The database and the edge functions, and the SQL that checks them. See below. |
| `tasks/` | Planning notes (`plan.md`, `todo.md`). |
| `infra/` | Infrastructure as code: Terraform modules and environments (`platform`, `staging`, `production`), the Rego policy that checks plans and workflows, and one change record per governed pull request. Nothing in it has been applied yet. See [`infra/README.md`](../../infra/README.md). |
| `workflow-lab/` | Standalone Next.js (App Router) + Supabase app: the AI workflow router and the 12-workflow benchmark lab. Its own `package.json` and lockfile (not an npm workspace); CI is `.github/workflows/workflow-lab.yml`. See [`workflow-lab/README.md`](../../workflow-lab/README.md). |
| `video/` | Remotion project that renders lessons to video. Has its own `package.json`; CI typechecks it with `npm run check:video`. See [`video/README.md`](../../video/README.md). |
| `.claude/` | Agent configuration checked into the repository: `commands/` and `skills/` (`run`, `add-course`). |
| `.github/` | `CODEOWNERS`, `dependabot.yml`, `pull_request_template.md`, `rulesets/main.json` and the workflows. |

At the root there are also Markdown reports and registers (for example `CLAUDE.md`, `README.md`, `SECURITY.md`, `REGRESSION-CHECKLIST.md`, `VALIDATED.md`, `SEMESTER-OPERATING-SYSTEM.md`), `.gitignore`, `.gitleaks.toml`, `.gitleaksignore`, two StackHawk configuration files and `delete-landed-branches.sh`. The root [`README.md`](../../README.md) has a layout table that lists five of the directories above; this page lists all of them.

## Inside `app/`

| Path | What it holds |
| --- | --- |
| `app/src/` | The browser application. Table below. |
| `app/server/institution/` | The institution gateway: `gateway.ts` (a function from `Request` to `Response`), `start.ts` (the process), the adapters, the journal, the sandbox. |
| `app/server/integration/` | The integration worker and registry: `registry.ts`, `tick.ts`, `worker.ts`. |
| `app/api/institution/` | The Vercel entry point, `[...path].ts`, which forwards to the gateway. |
| `app/scripts/` | Build and audit scripts: the three lint audits, budgets, smoke tests, the site builder, the register generators. |
| `app/public/` | Static files served as they are: icons, `_headers`, `sw.js`, audio, decks, handouts. |
| `app/package.json` | The scripts and dependencies. Policy for adding one is in [`docs/SUPPLY-CHAIN.md`](../SUPPLY-CHAIN.md). |
| `app/complexity-budgets.json` | Caps on counts a person must learn: flags, kill switches, destinations, groups, plans, subprocessors. |
| `app/perf-budgets.json` | Caps on bundle bytes, per route. |
| `app/vite.config.ts` | Vite, the dev-server proxies, the build plugins, and the Vitest projects. |
| `app/tsconfig.json` | References `tsconfig.app.json` and `tsconfig.node.json`. `tsconfig.university.json` is separate and run by `npm run check:university`. |
| `app/.oxlintrc.json` | The oxlint configuration. |

## Inside `app/src/`

| Path | What it holds |
| --- | --- |
| `app/src/screens/` | One file per screen. Registered in `app/src/screens.tsx`; navigation in `app/src/lib/nav.ts`. |
| `app/src/architecture/` | The architecture tests: the import graph, the rules over it (`rules.ts`), the recorded legacy exceptions (`legacy.json`) and the tests that run them on the real tree and on fixtures they must refuse. See `docs/architecture/modularization/06-architecture-tests.md`. |
| `app/src/kernel/` | What every domain may depend on and nothing more: the clock, errors, id source and the in-process event sink. Strict import rules apply; there is no allowlist. |
| `app/src/domains/` | The new domain modules, each with a public `index.ts` and `domain/`, `application/` and `adapters/` inside: `calendar`, `identity`, `policy`, `tasks` and `today`. Only a domain's `index.ts` may be imported from outside it. |
| `app/src/composition/` | The shell that joins the domains to the legacy app: `domains.ts` wires them to a `LegacyHost`, `react.ts` fills that host from the legacy store, and `shadow.ts` and `TodayShadow.tsx` run the new Today read model beside the old one. |
| `app/src/finance/` | The GTM financial model, an internal planning tool mounted as the Console's `Finance model` tab: the pure 36-month engine, scenarios, input registry and validation, exports and the dashboard. Local sample data only; every output is a forecast. Specified in `docs/business/finance/FINANCIAL_MODEL_SPEC.md`. |
| `app/src/components/` | React components shared by screens. The largest directory. |
| `app/src/lib/` | Logic, stores, registers and their tests. Subdirectories include `governance/`, `ops/`, `trust/`, `integration/`, `billing/`, `config/`, `docs/` and others. |
| `app/src/state/` | The store: context provider, reducer, state shape, persistence, migrations of stored shape. |
| `app/src/ai/` | The assistant interface. Screens must not import it statically. |
| `app/src/intelligence/` | Semester Intelligence: agent and mode pickers, disclosure, contracts. |
| `app/src/community/` | Community, circles and moderation logic. |
| `app/src/insights/` | Pure functions that turn a student's data into ranked observations. |
| `app/src/data/` | Static data: the shipped courses, catalogue, campus and events. |
| `app/src/content/` | The vocabulary rule: retired terms and the per-file ledger that the terms audit reads. |
| `app/src/a11y/` | Accessibility checks: label audit, focus, landmarks, axe. |
| `app/src/gallery/` | The design system's stories (stable components in the states that matter), rendered to static pages for `npm run gallery:shots` and held to every component by `gallery.test.tsx`. |
| `app/src/site/` | The public site pages, rendered by `app/scripts/build-site.mjs` (`npm run site:build`). |
| `app/src/styles/` | CSS, design tokens, and the style rules the style audit enforces. |
| `app/src/assets/` | Bundled images. |

Files directly in `app/src/` include `main.tsx`, `App.tsx`, `screens.tsx`, `headers.ts` and several tests that read the whole tree, such as `isolation.test.ts`, `donotbuild.test.ts` and `rootunmount.test.ts`.

## Inside `supabase/`

| Path | What it holds |
| --- | --- |
| `supabase/migrations/` | The schema, applied in filename order. Idempotent. No `begin` or `commit` inside a file. |
| `supabase/history/` | Recovered migration text for versions that reached production without a file. Not a migration set. |
| `supabase/functions/` | Edge functions, one directory each, and `_shared/`, which is not a function. |
| `supabase/*.check.sql` | The database tests. Run by `supabase/check.sh`. |
| `supabase/check.sh`, `load.sh`, `rehearse.sh`, `restore.sh` | The scripts CI runs against a throwaway PostgreSQL. |
| `supabase/local.stub.sql` | Stand-ins for what the Supabase platform supplies. Not deployed. |
| `supabase/scheduler.sql` | Infrastructure applied once by hand. Not a migration. |
| `supabase/config.toml` | Project configuration, including the PostgreSQL major and one block per function. |
| `supabase/ledger.snapshot`, `functions.snapshot` | Dated readings of the live migration ledger and function deployments. |
| `supabase/DEPLOY.md`, `README.md` | The deploy record and the explanation of the kinds of SQL file. |

## The two packages

| Path | What it holds |
| --- | --- |
| `packages/contract/` | The shared data contract. Aliased into the app as `@semester/contract` in `app/tsconfig.app.json`. |
| `packages/institution/` | The gateway vocabulary: actions, receipts, refusals, the policy decision point, the event envelope and outbox, workflow state machines. Aliased as `@semester/institution`, and imported by both the browser bundle and the server. |

## Dependency direction rules that exist today

These are the rules a test or a compiler enforces now. There is no general layering rule between `lib/`, `components/` and `screens/`; a direction not listed here is a habit, not a rule.

| Rule | Held by |
| --- | --- |
| No file under `app/src/screens/` statically imports `app/src/ai/`; the assistant is reached through a component and a dynamic import. | `app/src/aioptional.test.ts` |
| The gateway, `app/api/` and `packages/institution/` compile under `module: NodeNext`, where a `.ts` file is CommonJS unless a `package.json` above it says otherwise. Importing code under `supabase/functions/` from them fails with TS1287. | `npm run check:university`; `app/src/lib/ci.test.ts` holds that CI runs it |
| No service-role credential in anything a browser loads; no face library; no relational database driver or connection string in any package. | `app/src/lib/ops/boundaries.test.ts` |
| A notification may be created only in `src/lib/notify.ts`, `src/components/Ringing.tsx` and `public/sw.js`. | `app/src/donotbuild.test.ts` |
| The top-level navigation roots are the ones written in `docs/DO-NOT-BUILD.md`. | `app/src/donotbuild.test.ts` |
| A test file that mocks a module is listed to run in its own worker. | `app/src/isolation.test.ts` |
| A test file that mounts a React root unmounts it in an after hook. | `app/src/rootunmount.test.ts` |
| The browser holds only a publishable Supabase key; row-level security is the authorization boundary. | [`docs/architecture/0002-rls-is-the-authorization-boundary.md`](../architecture/0002-rls-is-the-authorization-boundary.md), `supabase/rls-coverage.check.sql`, `app/src/lib/ops/boundaries.test.ts` |
| Every edge function is listed with the credential it answers to. | `app/src/lib/edgeguards.test.ts` |

Two habits are not held by anything: `packages/institution/` imports only from itself, by relative path with the `.ts` extension spelled out, because the browser and the server both load it; and `app/src/lib/` modules do not import from `app/src/screens/`. Follow them, and do not cite them as rules.

The target structure in [`docs/target-architecture/02-MONOREPO-STRUCTURE.md`](../target-architecture/02-MONOREPO-STRUCTURE.md) is a proposal. It describes directories and boundary rules that do not exist yet, and this page does not repeat it.
