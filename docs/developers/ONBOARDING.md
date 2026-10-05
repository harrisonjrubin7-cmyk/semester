# Contributor onboarding

> **Type:** tutorial · **Audience:** contributors · **Owner:** `engineering` · **Truth:** held · **Reviewed:** 2026-10-04 · **Held by:** `app/src/lib/docs/developers.test.ts`

This page takes you from a clean clone to a first change that is ready for review; stop reading once you have run the gates once and know where the rest of [`docs/developers/`](README.md) is.

**Status:** LIVE. Everything below runs from a clone. The steps that need a database server or a browser say so, and say what happened when they were tried in a container without one.

## What was measured, and where

The figures on this page were measured on 2026-10-04 in a Linux container with Node `v22.22.0` and npm `10.9.4`. They are one reading, not a promise. Your machine will differ.

| Command | Result in that container |
| --- | --- |
| `npm ci --no-audit --no-fund` (at the repository root) | `added 226 packages in 15s`, with `EBADENGINE` warnings for four packages (see Prerequisites) |
| `npx tsc -b` | exit 0, 17 s |
| `npm run lint` | exit 0, 7 s, 21 oxlint warnings, under the ceiling of 25 |
| `npx vitest run src/lib/branchprotection.test.ts` | 1 file, 8 tests passed, 2 s wall clock |
| `npm run check:university` | exit 0, 1 s |
| `npm run build` | exit 0, 18 s (Vite reports `built in 4.51s`) |
| `npm run budgets` after the build | `budgets ok`, first load 436.7 KB of 479.0 KB |
| `npm run dev` | Vite 8.3.1 `ready in 498 ms` |
| `npm run smoke:gateway` | every check printed `ok`, 1 s |

Not run on this page's behalf: the full `npm test`, `npm run test:shuffle` and `npm run test:zones` (the suite has more than 1,200 test files and runs in CI), `supabase/check.sh` (needs PostgreSQL 17, see step 8), and every `smoke:*` script (needs a browser).

## 1. Prerequisites

You need Git, Node.js 22 and npm.

- CI installs Node with `node-version: 22` (the major only) in [`.github/workflows/ci.yml`](../../.github/workflows/ci.yml).
- The root `package.json` declares `engines: { node: ">=22" }`; `app/package.json` declares no `engines` field and the repository has no `.nvmrc`. Nothing pins a patch version for you.
- `jsdom` 30.1.1, which the tests use, declares `node: ^22.22.2 || ^24.15.0 || >=26.0.0`. On Node 22.22.0 `npm ci` prints four `EBADENGINE` warnings and still installs. Use Node 22.22.2 or later to avoid them.
- The institution gateway uses `node:sqlite`, which Node 22 prints as an experimental warning when it starts.

## 2. Clone

```bash
git clone https://github.com/harrisonjrubin7-cmyk/semester.git
cd semester
```

The repository's root `package.json` is a workspace root for `app` and `packages/*` and defines no scripts; it holds the one lockfile. Install at the root, then run every other npm command from `app/`, as [`CLAUDE.md`](../../CLAUDE.md) says. At the root, `npm test` fails with "Missing script" instead of running the suite.

## 3. Check main first

Before you read or write any code, do what [`CLAUDE.md`](../../CLAUDE.md) asks. Several sessions work in this repository at once, and the same fix has landed twice.

```bash
git fetch origin main
git log --oneline -30 origin/main
```

Read it for the defect, not the titles. If the thing you are about to build has landed, say so and stop.

## 4. Install

```bash
npm ci
cd app
```

Run `npm ci` at the repository root, as CI does. It installs exactly what the root `package-lock.json` records, for `app/` and `packages/*` together.

## 5. Run the app

```bash
npm run dev
```

Vite serves on `http://localhost:5173` and moves to the next free port if that one is taken. The app works signed out; nothing else needs to be running.

A fresh browser profile opens on an adoption prompt headed "Your syllabi. One brain." with two buttons, Show me and Skip. Nothing is reachable behind it. Press Skip. Skipping still loads the four shipped courses.

To drive the app in a headless browser, to seed the layout and navigation, or to take a screenshot, follow [`.claude/skills/run/SKILL.md`](../../.claude/skills/run/SKILL.md). Two facts from it matter at once:

- The app keeps its state in `localStorage` under the key `semester.v1`. A seed must carry `schemaVersion` equal to `SCHEMA` in `app/src/lib/migrate.ts`, or the seed is ignored.
- Text that looks capitalised on screen is `text-transform: uppercase` over sentence-case text. Match labels with a case-insensitive regular expression.

Look at the screenshot for anything visual. A dark rectangle is a failure to launch, not a dark theme.

## 6. Run the checks

These are the gates [`CLAUDE.md`](../../CLAUDE.md) lists, in the order CI runs them.

```bash
npx tsc -b
npm run lint
npm run check:university
npm test
npm run test:shuffle
npm run build
```

Why each one exists is in [`TESTING-GUIDE.md`](TESTING-GUIDE.md). Three points for a first run:

- `npm run check:university` is not a duplicate of `npx tsc -b`. It compiles the gateway under `module: NodeNext` and can fail when `tsc -b` is green.
- `npm run lint` is oxlint followed by three audits: `scripts/styles.mjs`, `scripts/labels.mjs` and `scripts/terms.mjs`. oxlint is run with `--max-warnings=25`.
- To run one test file while you work, name it:

```bash
npx vitest run src/lib/branchprotection.test.ts
```

If you change styles, tokens or UI, also run `npm run design-system:check`. It confirms the generated token export is in step with `tokens.css`, that no file gained a raw colour, z-index, shadow, radius, duration or easing beyond what it already carried, and that every Figma mapping resolves. The commands, the report and what must never be hand-edited are in [`docs/design-system/README.md`](../design-system/README.md).

To read a Figma file from Claude Code, the repository's [`.mcp.json`](../../.mcp.json) already names the remote server. Each developer signs in with their own Figma account: start Claude Code in the repository, run `/mcp`, choose `figma` and follow the browser sign-in. If `.mcp.json` is missing, `claude mcp add --scope project --transport http figma https://mcp.figma.com/mcp` writes it. No credential is committed or needed in CI. See [the Figma mapping page](../design-system/FIGMA-MAPPING.md).

`.mcp.json` also names Middleware's hosted server (`https://mcp.middleware.io/mcp`) for reading dashboards, metrics and alerts. It signs in the same way: `/mcp`, choose `middleware`, **Authenticate**. Nothing in the app sends it data yet. See [D-1289](../decisions/D-1289.md). To debug either MCP connection (tools list, OAuth, a failing call), `npx @mcpjam/inspector@latest` runs MCPJam's inspector locally; it is a tool you run, not a dependency of the app.

## 7. Run the institution gateway locally

The gateway is the Node service in `app/server/institution/`. It is optional; the app does not need it. Its status in [`docs/FEATURE-TRUTH-TABLE.md`](../FEATURE-TRUTH-TABLE.md) is MOCK_DEMO: sandbox adapters only, and no production adapter exists. Its sandbox institution runs a demonstration course against nobody, and says so on its first line of output.

1. Copy the example environment file. It holds names and placeholders only.

   ```bash
   cp server/institution/.env.example server/institution/.env
   ```

2. Generate a journal key and put it in `.env` as `SEMESTER_JOURNAL_KEY`. The gateway refuses to start without 32 random bytes as hex.

   ```bash
   node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"
   ```

3. Ask for the sandbox by adding `SEMESTER_SANDBOX_INSTITUTION=1` to `.env`. It is read by `app/server/institution/start.ts` and is not in `.env.example`.

4. Start it.

   ```bash
   npm run dev:university
   ```

The names in `.env.example` that you may need are `SEMESTER_APP_ORIGIN`, `SEMESTER_GATEWAY_PORT`, `SEMESTER_JOURNAL_KEY`, `SEMESTER_GATEWAY_STORE`, `SEMESTER_AUTH_URL`, `SEMESTER_AUTH_PUBLIC_KEY` and `SEMESTER_AUTH_SERVICE_KEY`. Never give any of them a `VITE_` prefix; a `VITE_` variable is compiled into the browser bundle.

What happened when this was run with the sandbox on and no auth project configured:

- The first output line read `Semester university gateway listening on http://127.0.0.1:8787. 0 approved adapters registered. SANDBOX INSTITUTION IS ON: 16 demonstration adapters are installed and nothing they report is real.`
- `GET /health` returned 200 with `"status":"ready"` and `"adapters":16`.
- `GET /health/live` returned 200.
- `GET /status` with no token returned 401. With no auth project configured nothing authenticates, which is the intended unconfigured behaviour.

`npm run smoke:gateway` does the same boot without a `.env` file. It starts the gateway with the sandbox on and a temporary journal key, then checks the first output line, that `/status` without a token is refused, that another origin is refused, and that the sandbox store is readable by its owner only. It passed in 1 s and needs no browser. It is deliberately not part of `npm test`, because it binds a port.

To point the app at a local gateway, set `VITE_UNIVERSITY_GATEWAY_URL` in the app's own environment. That path was not run on this page's behalf.

## 8. Run the database checks

The database is checked by SQL, not by Vitest. `supabase/check.sh` builds a throwaway PostgreSQL cluster in a temporary directory, applies `supabase/local.stub.sql` and every file in `supabase/migrations/`, then runs every `supabase/*.check.sql` suite. It touches no real project.

```bash
cd ..
supabase/check.sh groups
```

Naming a suite runs only that one. A name that matches no file is an error.

This needs a PostgreSQL server, not just `psql`, at the major version in `supabase/config.toml` (`major_version = 17` today). CI installs it. In the container used for this page only PostgreSQL 16 was present, and the script did what it is written to do: it printed `No PostgreSQL 17 server found`, gave the install commands and exited with status 2. It did not fall back to 16. To run against another major anyway you can set `SEMESTER_CHECK_PG_ANY=1`, and the script says loudly that a pass then says nothing about production.

[`supabase/README.md`](../../supabase/README.md) explains what each kind of SQL file is and which can never be a migration.

## 9. Your first change

This walk-through changes a document, because a document change touches every step of the flow and cannot break the app.

1. Check main for the thing you are about to change (step 3).
2. Create a branch from `origin/main`.

   ```bash
   git switch -c my-first-change origin/main
   ```

3. Make the change. Find the page that owns the subject; do not add a second one. Pages in this tree carry a card line under the title, described in [`CONTRIBUTING.md`](../../CONTRIBUTING.md).
4. Run the gates that your change could affect. For a document, run the tests that read documents:

   ```bash
   npx vitest run src/lib/runbooklinks.test.ts src/lib/ops src/lib/governance
   ```

5. Run the gates in step 6 before you push. If your change moves a number a page quotes, a test fails and tells you which page to regenerate; the usual command is `npm run registers`, see [`HOW-TO-CHANGE-A-REGISTER-PAGE.md`](HOW-TO-CHANGE-A-REGISTER-PAGE.md).
6. Rebase onto `origin/main` before you push, not after CI tells you.

   ```bash
   git fetch origin main
   git rebase origin/main
   ```

7. Open a pull request. The template in [`.github/pull_request_template.md`](../../.github/pull_request_template.md) asks what and why, the gates you ran, and extra questions for a new dependency, module, policy change or screen. If you record a decision, name the file after the number the pull request was given, see [`HOW-TO-ADD-A-DECISION-RECORD.md`](HOW-TO-ADD-A-DECISION-RECORD.md).
8. Say which pages you changed and which you checked. A change is not finished until its page is; see [`CONTRIBUTING.md`](../../CONTRIBUTING.md).

## Where next

- [`REPO-MAP.md`](REPO-MAP.md) says what lives where.
- [`CODING-STANDARDS.md`](CODING-STANDARDS.md) lists what is enforced and what is only practised.
- [`TESTING-GUIDE.md`](TESTING-GUIDE.md) explains the suite and how to prove a guard.
- [`README.md`](README.md) lists the how-to pages.
