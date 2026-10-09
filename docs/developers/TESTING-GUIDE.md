# Testing guide

> **Type:** how-to · **Audience:** contributors · **Owner:** `engineering` · **Truth:** held · **Reviewed:** 2026-10-04 · **Held by:** `app/src/lib/docs/developers.test.ts`

This page explains how the test suite is arranged, how to write a guard and prove it can fail, and what CI runs; stop reading if you only need the commands, which are in [`ONBOARDING.md`](ONBOARDING.md).

The test that holds this page checks that every script, test file and CI step name it quotes exists.

## The kinds of check

| Kind | Command, from `app/` unless noted | What it needs |
| --- | --- | --- |
| Types | `npx tsc -b`, `npm run check:university` | Node only. |
| Lint and audits | `npm run lint` | Node only. oxlint, then the style, label and vocabulary audits. |
| Unit and component tests | `npm test` | Node only. Components run in jsdom. |
| Same tests, other timezones | `npm run test:zones` | Node only. Runs the suite under `TZ=America/Chicago` and `TZ=Pacific/Kiritimati`. |
| Same tests, a different order | `npm run test:shuffle` | Node only. Prints its seed. |
| Production build and budgets | `npm run build`, `npm run budgets` | Node only. `budgets` reads the build. |
| Browser smoke tests | `npm run smoke:cold`, `smoke:a11y`, `smoke:golden`, `smoke:pilot`, `smoke:sync` | A built app being served, and Playwright with a Chromium. `SMOKE_URL` and `SMOKE_PLAYWRIGHT` say where. `smoke:sync` also needs a local Supabase and a service key. |
| Gateway boot | `npm run smoke:gateway` | Node only. Binds a port. |
| Database policies | `supabase/policy-evidence.sh`, from the repository root. Use `supabase/check.sh` directly only for local suite iteration. | A PostgreSQL server of the major version in `supabase/config.toml`. The wrapper preserves the harness exit status and writes `artifacts/database/pg17-policy-evidence.json`. |
| Course data | `node pipeline/validate.mjs`, from the repository root | Node only. |
| Scheduled and operational probes | `npm run smoke:production`, `smoke:public-production`, `sweep:contrast`, `eval:model-quality` | Deployed URLs (`smoke:*production`), a browser and a running dev server (`sweep:contrast`), or a model key or proxy (`eval:model-quality`). Not part of a pull request. |

## How the Vitest suite is arranged

`app/vite.config.ts` defines two Vitest projects.

| Project | Isolation | Files |
| --- | --- | --- |
| `shared` | `isolate: false`. Workers are reused across files. | Every `*.test.ts` and `*.test.tsx` under `app/`, plus `packages/institution/src/**/*.test.ts`, except the files in the `mocked` project and `scripts/rollout-publication.test.ts`. |
| `mocked` | `isolate: true`. Each file gets a fresh module registry. | The files listed in `MOCKS_MODULES` in `vite.config.ts`. |

Why two: `vi.mock` can only rebind a module that the worker has not already evaluated, and whether it has depends on which file ran first. A file that mocks and is not listed fails sometimes, which is worse than always. `app/src/isolation.test.ts` reads the config and the tree and fails if a file calls `vi.mock(` without being listed. If you add a mock, add the file to `MOCKS_MODULES`. The operations-console workspace list (`app/src/lib/console/workspaces.test.ts`), support-case client (`app/src/lib/support-case-client.test.ts`), and creation publishing test (`app/src/components/creation/Publishing.test.tsx`) mock their dependencies, so they are in that list.

Other settings: `maxWorkers` is 4 and `testTimeout` and `hookTimeout` are 30 seconds. Tests live beside the code they test. A component test that needs a DOM begins with the `// @vitest-environment jsdom` pragma; the default environment is Node.

`npm run test:publication` runs `scripts/rollout-publication.test.ts` against exported publication files that are not in a checkout. It is not part of `npm test`.

## Writing a guard, and proving it fails

A guard is a test written so that a particular mistake cannot come back. [`CLAUDE.md`](../../CLAUDE.md) holds this repository to a stricter standard than "it passes".

1. Write the test. Make its message say what to do, because the person who trips it will not have read the file.
2. Add a control: a case that must pass, or a fixture the check must catch. Measuring six suspects and finding six problems is also what a broken probe looks like. The first teardown probe here keyed on `__reactContainer$`, which React leaves behind after unmount, and read every file as leaking, including two already fixed. The controls caught it.
3. Revert the fix, or break the thing the guard guards. Run the test. It must fail, and the message must be the one you wrote.
4. Restore the fix. Run the test. It must pass.
5. Say so in the pull request: the guard, the break, the failing message, the restore. The pull request template has a checkbox for it.

A structural check can be more reliable than a runtime probe. `app/src/rootunmount.test.ts` asks only whether a file that calls `createRoot` has an `unmount` inside `afterEach` or `afterAll`. It cannot be fooled by a detached host, a race that did not fire, or a probe with a bug in it.

When a measurement clears a suspect that a cheap signal convicted, find out which one is lying before you believe the measurement. `app/src/screens/call/leaving.test.tsx` once read as clean to a probe that scanned `document.body`, because its teardown removed the host and left the root on a detached node.

## Shuffled order and timing

`npm run test:shuffle` is not a duplicate of `npm test`. Green `test` with red `test:shuffle` means the tests depend on each other. The cause is almost always in the earlier file, the one the failure does not name.

- An ordering failure is reproducible. Vitest prints its seed; run `npm run test:shuffle -- --sequence.seed=N` to repeat the arrangement.
- A timing failure is not. `ReferenceError: window is not defined` out of `react-dom` is a React root left mounted when a file ended. A seed fixes the order, not the race. Consecutive green shuffle runs are weak evidence about this class; do not report them as proof. `app/src/rootunmount.test.ts` is the real guard.

## Determinism

A test that reads the wall clock or the machine's timezone passes on one machine and fails on another. CI runs the suite in UTC, in Chicago and in Kiritimati (UTC+14) for a reason: an all-day event arrived as midnight UTC, the app read the day with local getters, and every user west of Greenwich saw it a day early, while a UTC runner stayed green.

- Pin time with fake timers. `app/src/state/clock.test.ts` calls `vi.useFakeTimers()` and `vi.setSystemTime(...)` and restores real timers in `afterEach`.
- Read dates with the date helpers in `app/src/lib/date.ts` rather than constructing `new Date(y, m, d)` on unchecked input; `new Date(2026, 1, 31)` is 3 March, not an error. `app/src/lib/realdate.test.ts` shows the failure.
- Use no network and no randomness in a test. The gateway suites inject in-memory stores rather than opening a database.
- Do not leave a React root mounted, and do not share mutable state between files. The suite runs shuffled.

## Fixtures

- Build inputs in the test. For example, `app/server/institution/gateway.test.ts` builds a whole gateway with in-memory stores in a local `fixture()` helper.
- Use the in-memory stores that ship for this purpose: `MemoryOutbox` and `MemoryReceiptLedger` in `packages/institution/src/events.ts`, and `app/server/integration/fakedb.ts`.
- Use the sandbox institution for end-to-end gateway work: `app/server/institution/sandbox.ts`. It is labelled as a sandbox in three ways that can be checked, and nothing it reports is real.
- Binary fixtures sit in `app/src/lib/__pix/` and `app/src/lib/__docs/`.
- A database check script makes its own synthetic users, walks them through what a real pair would do, asserts what each may see, and rolls everything back. It never uses real data.

## Run one thing

```bash
npx vitest run src/lib/flags.test.ts
npx vitest run src/lib/ops src/lib/governance
npx vitest run -t "is written down"
```

Paths are relative to `app/`. Name a file path whenever you can; the suite is more than a thousand files.

## What CI runs

Workflows are in [`.github/workflows/`](../../.github/workflows/). On a pull request to `main` and on a push to `main`, `ci.yml` runs three jobs that the ruleset definition names as required checks, and a fourth on push only.

| Job | What it does, in order |
| --- | --- |
| `build` | an npm ci install, which is a step named only Install; the dependency audit (non-blocking); `Typecheck`; `Lint`; `Typecheck the university server`; the video package install and typecheck; `Test`; `Test in other timezones`; `Test in a different order`; `Build`; `Performance budgets`; installs Playwright; serves the build the way Pages serves it; `Open every address cold`; `Audit critical accessibility journeys`; `Walk the golden student path`; `Walk it again with human help on`; `Validate the course data`; installs the PostgreSQL major the live project runs; `Check the database policies`; always retains the pg17-policy-evidence-<sha> artifact with the exact-commit clean/reapply and per-suite result; `Load and concurrency scenarios`; `Rehearse the deploy against production's shape`; `Rehearse a backup and restore`. |
| `account-sync` | Starts a local Supabase from this repository, builds the app against it, and walks the real account lifecycle across two devices with `npm run smoke:sync`. |
| `secrets` | gitleaks over what the branch changed, then over every file the branch carries. |
| `notify` | On push only. Opens or comments on an issue titled "main is red" when a job failed. It is not a required check. |

[`docs/BRANCH-PROTECTION.md`](../BRANCH-PROTECTION.md) defines `build`, `secrets` and `account-sync` as required checks. That ruleset is a definition in the repository and, per that page, is not yet applied.

Other workflows:

| Workflow | File | Trigger | What it does |
| --- | --- | --- | --- |
| Deploy to Pages | `pages.yml` | After `CI` completes on `main`, or by hand | Builds and publishes the app only if CI succeeded. |
| Deploy Edge Functions | `functions.yml` | After `CI` completes on `main`, or by hand | Deploys the function directories the merge touched, only if CI succeeded. |
| Contrast | `contrast.yml` | Nightly at 07:00 UTC, or by hand | The contrast sweep in a real browser against the dev server. Not a required check. |
| Production smoke | `production-smoke.yml` | Hourly, or by hand | Probes the deployed public app and, when configured, the institutional gateway; records each hour on the `status-data` branch. |
| Infrastructure | `infra.yml` | Pull request and push to `main` that touch `infra/`, `scripts/infra/`, `.github/workflows/` or `.github/rulesets/` | Read-only: Terraform format, initialise and validate; the policy's own tests, and every workflow against the policy; a governed change carries its change record. |
| Infrastructure drift | `drift.yml` | Daily at 07:17 UTC, or by hand | Plans each Terraform root against the live system. A root that cannot be planned is reported NOT CHECKED, never clean. Nothing has been applied yet (`infra/README.md`), so there is no live system to drift from. |
| Infrastructure apply | `infra-apply.yml` | By hand only (`workflow_dispatch`), naming a Terraform root and an approved change record | The one way production infrastructure is changed: a plan job, then an apply job in a protected environment that applies exactly the saved plan. |
| Supply chain | `supply-chain.yml` | Push to `main` that touches `app/`, `packages/` or the root `package.json` or `package-lock.json`, weekly on Monday at 06:41 UTC, or by hand | Builds the app from a clean checkout and signs the bundle with a build-provenance and an SBOM attestation, then verifies both in the same run. It attests the bundle it builds, not the bytes `pages.yml` deploys. |
| Workflow Lab | `workflow-lab.yml` | Pull request and push to `main` that touch `workflow-lab/` | Typecheck, lint, tests (including the migrations and RLS suite on Postgres in WASM, no Supabase project or secret), the seed-drift check and a production build of the standalone Next.js app in `workflow-lab/`. Independent of `CI`. |
| Docs | `docs.yml` | Pull request opened, updated, reopened or edited | Runs `npm run docs:impact`: fails a pull request that changes a gateway, edge function, screen, script or example without touching a page that describes it, unless its description says `Docs: none because …`. Needs no install. |
| HawkScan | `hawkscan.yml` | Pull request and push to `main`, or by hand | Dynamic application scan through StackHawk; pull requests from forks do not run it. The primary scan exports the exact GitHub commit, branch and agent into the tags declared by `stackhawk.yml`. The `company_site` job scans an isolated static copy and fails closed when the paged finding evidence does not match the scan summary. Forms that submit with GET and carry no session are named in `stackhawk-company-site.yml`, so the Anti-CSRF plugin stays enabled. |
| CodeQL | `codeql.yml` | Pull request and push to `main`, weekly on Monday at 05:23 UTC, or by hand | Static analysis (SAST) of the TypeScript and JavaScript. Runs only where code scanning is available (a public repository, or `CODEQL_ENABLED=true`); otherwise it is skipped, not red. |

## Where the policy tests live

- Database: `supabase/*.check.sql`, run in CI by `supabase/policy-evidence.sh`, which delegates to `supabase/check.sh`. Add a suite for any new table, with a second account. A green report proves that ephemeral PostgreSQL 17 run only; open review and coverage gaps remain in `database/UNRESOLVED_POLICY_REGISTER.json`.
- Gateway: `app/server/institution/*.test.ts`, run by `npm test` and typechecked by `npm run check:university`.
- Shared vocabulary: `packages/institution/src/*.test.ts`, in the `shared` project.
- Whole-tree scans: the `*.test.ts` files directly under `app/src/`, such as `donotbuild.test.ts`, `aioptional.test.ts` and `pageframe.test.ts`.
- Registers and their rendered pages: `app/src/lib/ops/`, `app/src/lib/governance/` and `app/src/lib/trust/`.
