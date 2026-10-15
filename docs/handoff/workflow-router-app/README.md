# Semester AI Workflow Router & Benchmark Lab

Next.js App Router + Supabase app that routes a Semester workflow to **Claude Artifacts**, **ChatGPT Canvas** or **v0**, compares them in sortable matrices, and records a graded 12-workflow benchmark with evidence.

> Built in Claude Design as a source hand-off. Every code file carries a `.txt` suffix (and `[suiteId]` is saved as `-suiteId-`) so the design-system bundler ignores them. Restore with `sh install.sh`. **Typecheck, lint, tests and build have not been run here** — run them first (see below) and fix anything they report.

## Install

```bash
cp -R workflow-router-app ~/code/semester-router && cd ~/code/semester-router
sh install.sh            # strips .txt, restores app/benchmark/[suiteId]
npm install
cp .env.example .env.local   # fill NEXT_PUBLIC_SUPABASE_URL + NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
```

## Supabase

```bash
npx supabase init && npx supabase start          # local
npx supabase db push                             # or: link a project, then push
# sign up once in the app, then:
psql "$DB_URL" -f supabase/seed.sql              # seeds "Semester canonical 12"
npm run db:types                                 # regenerate types/database.ts
```
Auth → URL configuration: Site URL = your origin; add `/auth/confirm` to redirect URLs. Email template link: `{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=email&next=/workflow-router`.

## Run and verify

```bash
npm run dev
npm run typecheck && npm run lint && npm test && npm run build
```

| Quality gate | Where it is held |
| --- | --- |
| Router works on local data | `lib/workflow-router/engine.ts` (no network) · `tests/routing.test.ts` |
| v0 forced for DB/auth/multi-tenant/Next.js/deploy | `v0Triggers` · 13 forced cases in `tests/routing.test.ts` |
| Markdown + JSON recommendation export | client download + `app/api/exports/recommendation` |
| Authenticated save | `app/workflow-router/actions.ts` (server recomputes; `getUser()`) |
| 12 workflows per suite, run per platform/task | `benchmark_tasks unique(suite_id, number)` · `benchmark_runs` |
| Grades with evidence | `benchmark_grades unique(run_id, grader_id)` · `GradingForm` requires evidence |
| Weighted scores + leaderboards | `lib/benchmark/scoring.ts` · `tests/scoring.test.ts` |
| Persistence explicitly tested | DB check constraint + `RunSchema` + `persistenceCeiling` (local state ≤ 2) |
| RLS isolation | migrations 001/002 · `tests/RLS-TEST-PLAN.md` |
| No secret in the browser | only `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`; `lib/supabase/server.ts` imports `server-only` |

## Benchmark protocol (all platforms are manual — no automation is assumed)

1. Open a suite → task → pick a platform. The capability guard marks persistence tasks as **unsupported** on Claude Artifacts and ChatGPT Canvas with the reason; record the run anyway to document the gap.
2. **Claude Artifacts:** paste the exact prompt into claude.ai, publish the artifact, record the URL, the source as the manifest, console notes and duration.
3. **ChatGPT Canvas:** run the prompt in Canvas, export (Markdown/DOCX/PDF or code file), record the share link and file manifest.
4. **v0:** run the prompt, push to GitHub, deploy a preview, record repo + deployment URLs, the file manifest and the test log.
5. Persistence tasks (9–12): create a record, reload, and record survived/lost, the storage mode and a row id or log. Without evidence the persistence grade is capped at 1; browser-local at 2.
6. Two graders minimum per run; grade 0–5 on each criterion with evidence. Export CSV / Markdown from the suite page.

## GitHub and Vercel

Push to GitHub → import in Vercel → add the two `NEXT_PUBLIC_SUPABASE_*` env vars (Production + Preview) → deploy. Protect `main`; require typecheck, lint, test and build on PRs; run `supabase db push` from CI with a deploy token, never from the browser.

## Security / RLS

- Every exposed table has RLS on. Private rows: `owner_id = auth.uid()`. Shared rows: `visibility = 'organization'` **and** membership via `is_org_member` / `has_org_role` (SECURITY DEFINER, `search_path = public`) to avoid recursive policies.
- Viewers read; members write their own; owners/admins manage membership; only owners grant owner.
- Runs and grades inherit access from their suite (`can_read_suite` / `can_write_suite`).
- Mutations validate with Zod on the server and re-derive the recommendation; client UI state never authorises anything.
