# Semester AI Workflow Router & Benchmark Lab

A Next.js (App Router) + Supabase application that

1. **routes** a coding, writing, design, data or product workflow to **Claude Artifacts**, **ChatGPT Canvas** or **v0**, with reasons, sandbox limits, a ready-to-copy prompt, a GitHub plan and (when relevant) a Supabase prompt;
2. **compares** the three platforms in sortable matrices;
3. **benchmarks** all three on a canonical 12-workflow suite — exact prompt preserved, evidence captured, 0–5 human grades on eight criteria, weighted scores and leaderboards;
4. **persists** recommendations, suites, tasks, runs and grades in Supabase Postgres under Row Level Security;
5. **exports** Markdown, JSON and CSV.

> **Where this lives.** The repository root already has a Vite app in `app/`, so this project is a self-contained directory, `workflow-lab/`, with its own `package.json` and lockfile (like `video/` and `pipeline/`). It is not an npm workspace of the root. Inside it the layout is the requested `app/`, `components/`, `lib/`, `supabase/`, `types/`.

## Platform boundaries the app enforces

| Platform | Use it for | Never represent it as |
| --- | --- | --- |
| Claude Artifacts | self-contained interactive tools, local-state React, Mermaid/SVG, client-side exports, prototypes | a durable backend, secret store, production auth system or multi-tenant database app |
| ChatGPT Canvas | revision-centred writing, documents, code iteration, Python/data analysis, document/source export | a durable production backend or deployment target |
| v0 | multi-file React/Next.js, server logic, API routes, database, auth, project export, GitHub, Vercel | production-ready without validation, migrations, RLS, tests and env vars |

The router **forces v0** for any of: Next.js, Postgres, Supabase, persistent records, authentication, server APIs/webhooks, private secrets, multi-user collaboration, organization membership, role-based access, RLS, GitHub-backed deployment, Vercel deployment (and the full-stack-feature deliverable). This is a hard rule, not a weight; `tests/router.test.ts` checks all 25,920 input combinations.

## Quick start (prototype mode, no Supabase needed)

```bash
cd workflow-lab
npm ci
npm run dev        # http://localhost:3000
```

Without Supabase variables the app runs in **Prototype mode** (badge in the header): the router, matrices, exports, and the read-only canonical benchmark definition work on local sample data. Saving, creating suites, recording runs and grading are disabled with an explanation — nothing is faked or stored in the browser.

## Environment variables

| Variable | Where | Notes |
| --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | browser + server | Project URL |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | browser + server | Publishable (`sb_publishable_…`) key; safe to ship |
| `NEXT_PUBLIC_SITE_URL` | optional | Canonical origin for magic-link redirects; defaults to the request origin |

There is **no service-role/secret key** anywhere in this app. Every query runs as the signed-in user, so RLS is the authorization boundary. Do not add one.

```bash
cp .env.example .env.local   # then fill in the two Supabase values
```

## Supabase setup

1. Create a project at supabase.com (or run `supabase start` locally after `supabase init`).
2. **Apply migrations** (in order):
   - `supabase/migrations/001_core_workflow_router.sql` — `organizations`, `organization_members`, `workflow_recommendations`, roles, `private` policy helpers, RLS
   - `supabase/migrations/002_benchmark_grading.sql` — `benchmark_suites`, `benchmark_tasks`, `benchmark_runs`, `benchmark_grades`, persistence ceiling, RLS, `clone_benchmark_template()`

   ```bash
   supabase link --project-ref <ref>
   supabase db push
   ```
   Or paste each file into the SQL editor, in order.
3. **Seed** the canonical suite (one template suite, 12 workflows, idempotent):
   ```bash
   supabase db reset                          # local: runs migrations + seed.sql
   psql "$DATABASE_URL" -f supabase/seed.sql  # hosted: as the postgres role
   ```
   or paste `supabase/seed.sql` into the SQL editor. Each user then clones their own editable copy from the app (the `clone_benchmark_template` RPC).
   `seed.sql` is generated from `lib/benchmark/benchmark.config.ts` (`npm run seed:generate`); a test fails if they drift.
4. **Auth configuration** (Authentication → URL Configuration):
   - Site URL: your production URL
   - Redirect URLs: `http://localhost:3000/**`, `https://<your-app>.vercel.app/lab/**` and each Vercel preview pattern you use
5. **Email templates** (Authentication → Email Templates) so magic links work across browsers, using the token-hash flow handled by `app/auth/confirm/route.ts`:
   - *Magic Link*: `<a href="{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=email&next=/benchmark">Sign in</a>`
   - *Confirm signup*: `<a href="{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=signup&next=/benchmark">Confirm</a>`

   The route also accepts the default PKCE `?code=` link (same browser only).
6. Enable the **Email** provider. Password sign-in is also available on `/auth/sign-in`.
7. Organizations: create one in SQL (the creator becomes `owner` automatically):
   ```sql
   insert into public.organizations (name, slug) values ('Acme', 'acme');
   insert into public.organization_members (organization_id, user_id, role)
     values ('<org id>', '<user id>', 'member');   -- owner | admin | member | viewer
   ```
   (There is no organization-management UI yet; RLS and the last-owner guard are fully enforced regardless.)

## Commands

```bash
npm run dev            # dev server
npm run typecheck      # tsc --noEmit (strict)
npm run lint           # eslint (next/core-web-vitals + typescript)
npm test               # vitest: unit tests + the migrations/RLS suite on real Postgres (PGlite)
npm run build          # production build
npm run seed:generate  # regenerate supabase/seed.sql from the config
```

## Benchmark execution protocol

The same canonical prompt goes to each platform, in a fresh session, and a human records and grades what came back. **No platform is driven automatically**: there is no approved programmatic integration for any of the three, and the harness does not invent endpoints. The adapters (`lib/benchmark/adapters/`) implement `canRun`, `run`, `collectEvidence`, `evaluatePersistence`, `reportUnsupported` and return `manual-review-required` — or `unsupported`, with a reason, when a task needs a backend the platform does not have (workflows 9–12 on Claude Artifacts and Canvas). An unsupported task can still be run by hand to document the boundary.

For each workflow × platform:

**Claude Artifacts** — new chat → paste the prompt verbatim → let the artifact render (note console errors) → copy the source into the file manifest and add the share link → exercise the acceptance criteria → reload: if state resets, record `local-preview`, *survived = no*.

**ChatGPT Canvas** — new chat with Canvas available (if the surface has no Canvas, record that; do not substitute plain chat) → paste the prompt → export in the native format (Markdown/DOCX/PDF or code extension) → for Python, run in the console and paste the output → persistence is normally `none`/`local-preview`.

**v0** — new chat → paste the prompt → record the chat/preview URL → export the project and list the files → install, typecheck, lint and build it (paste results into console notes) → for persistence tasks, create data, hard-reload, open a fresh session and record where it lives (row id, screenshot, log).

Then in the app: **Benchmark → create a suite → open the workflow → platform cell → Record a run → Grade**. Record model name/version, runtime notes, output URL, source manifest, console notes, duration, and the persistence test. Re-runs are new *attempts*; the latest attempt counts.

### Grading and scoring

0–5 on Correctness, Code quality, Rendering, State management, Maintainability, Handoff/export, Sandbox fit and Persistence. Default weights: 25 / 20 / 15 / 15 / 10 / 10 / 5 / 0. Each workflow overrides them (`lib/benchmark/benchmark.config.ts`); persistence carries weight only on the four workflows that require it (9–12).

- per criterion, scores are averaged across graders; the task score is the weighted mean; `/100 = /5 × 20`
- a result is **complete** only when every weighted criterion is scored; partial results show their score but are **not ranked**
- the aggregate leaderboard ranks on the *like-for-like* mean (workflows complete for every platform), so skipping hard tasks cannot raise a platform's rank

### Persistence

Classes: `none`, `local-preview`, `browser-local`, `session`, `database`, `project-backed`. For persistence-required tasks the persistence grade is **capped** by what was tested: untested → 0; did not survive reload → ≤ 1; `session` ≤ 2; `browser-local` ≤ 3; `database` / `project-backed` ≤ 5 only with evidence (URL, row id, screenshot or log), else ≤ 3. This is enforced in the form, in the server action, **and** by a database trigger (which also pulls existing grades down if a run is later edited).

## GitHub workflow

- Work on a feature branch; open a draft PR early.
- `.github/workflows/workflow-lab.yml` (repo root) runs typecheck, lint, tests, the seed-drift check and a production build for changes under `workflow-lab/`. It needs no secrets.
- Never commit `.env*` (ignored) or any key.
- Schema changes are new migration files; never edit an applied migration.

## Vercel deployment

1. Deployed as the `workflow-lab` service of the root `vercel.json` (Vercel services), served under `/lab` (`basePath` in `next.config.ts`, `lib/base-path.ts`). Plain `<a href>`, `<form action>` and `NextResponse.redirect` URLs must go through `withBasePath`; `<Link>` and `redirect()` are prefixed by Next.
2. Add `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` for Production and Preview (and optionally `NEXT_PUBLIC_SITE_URL` for Production).
3. Add the production and preview URLs to Supabase Auth redirect URLs.
4. Deploy a preview, sign in via magic link, create a suite, record a run, grade it; then promote.

## Security and RLS notes

- **Authorization is in the database.** Every table has RLS enabled and explicit per-operation policies `to authenticated`; `anon` has no grants. UI conditions (hidden forms for viewers) are hints only.
- **Personal suites** are visible only to their owner. **Organization suites** are readable by every member and writable by owner/admin/member; **viewers are read-only**. The canonical **template** is readable by all, writable by none. Runs and grades inherit their suite's visibility; a run must belong to a task of the same suite (composite FK).
- **Roles**: owners manage everyone; admins manage members and viewers only; an organization can never lose its last owner.
- Policy helpers are `SECURITY DEFINER` functions in the unexposed `private` schema with a fixed empty `search_path`; execute is revoked from `public`. Policies use `(select auth.uid())` so it is evaluated once per statement.
- **Server-side identity**: protected actions and routes call `supabase.auth.getUser()` (verified by the Auth server), never `getSession()`. The proxy (`proxy.ts`, Next.js 16's name for middleware) refreshes the session cookies on each request.
- **No service-role key** exists in the code or env; nothing but the URL and publishable key reaches the browser.
- **Inputs** are validated with Zod on the server. The server recomputes a recommendation from the selections instead of trusting a client-supplied result. `output_url`/evidence URLs must be `http(s)` (no `javascript:`); `?next=` redirects accept same-origin paths only; sign-out is POST-only with an Origin check.
- **CSV exports** neutralise spreadsheet formula injection (`=`, `+`, `-`, `@`, tab, CR).
- Responses carry `nosniff`, `X-Frame-Options: DENY`, a strict referrer policy and a restrictive permissions policy.
- Verification: `tests/rls.test.ts` (36 cases on real Postgres, order-independent), `docs/RLS-TEST-PLAN.md` (the cases in prose, plus the manual checks that need a live Supabase Auth).

## Known limitations

- Server actions and the PostgREST/Auth round trip are tested with a stubbed client and against Postgres directly, **not** against a live Supabase project (none was available here). Run the manual checks in `docs/RLS-TEST-PLAN.md` once deployed.
- No organization-management UI; create organizations and memberships in SQL.
- Benchmark execution is manual by design (see above).
- `types/database.ts` is hand-maintained; regenerate with `supabase gen types` and diff after migration changes.
