# Semester starter monorepo

pnpm + Turborepo backbone for identity, row-level security, policy, the data
access layer, a Next.js student app, and a durable workflow worker. It is a
separate tree from the existing `app/` workspace and does not replace it.

## Layout

```
apps/student-app        Next.js App Router, /app/today and a task form
packages/auth           requireSession(): cookie -> session -> RequestContext
packages/policy         OPA client (fails closed) + policies/access.rego
packages/permissions    authorize() and role -> grant map
packages/database       pg pool, RLS transaction binding, sessions, tasks DAL
packages/contracts      Zod input schemas and view types
workers/workflow-worker lease-based job loop (skip locked, lease reclaim)
supabase/migrations     001 identity + resolve_session, 002 student_tasks RLS, 003 jobs
supabase/tests          SQL RLS and session tests, run.sh applies migrations first
policies/               access.rego, access_test.rego
```

## Commands (from `starter/`)

```bash
pnpm install --frozen-lockfile
pnpm typecheck
pnpm policy:test                 # needs opa on PATH
DATABASE_URL=postgres://postgres@localhost:5432/semester_test pnpm db:test
pnpm test                        # unit tests; integration tests run when
                                 # TEST_DATABASE_URL and OPA_BASE_URL are set
pnpm --filter @semester/student-app build
```

## Security model

- The first gate is middleware, which checks that a session cookie exists. It
  does not authorize anything.
- `requireSession` resolves the token through `public.resolve_session`, a
  SECURITY DEFINER function. The app role never reads `sessions` directly.
- Every DAL call runs `authorize()` (OPA) and then `withRlsTransaction`, which
  does `set local role semester_app` and binds tenant and account in the same
  transaction. This makes RLS apply even when the connection role is privileged.
- `student_tasks` uses `FORCE ROW LEVEL SECURITY` with explicit per-operation
  policies. Empty context yields no rows, not a cast error.
- OPA unreachable, timed out, or returning no result throws `POLICY_UNAVAILABLE`.
  The page shows an unavailable notice and renders no data.

## Verified in this environment

| Check | Result |
| --- | --- |
| `pnpm typecheck` (7 projects) | clean |
| `pnpm test` unit suites (policy 5, permissions 3, auth 3) | pass |
| `pnpm db:test` on Postgres 16: migrations + 14 RLS/session checks | pass, exit 0 |
| Mutation control: removing `student_tasks_select` | RLS test fails (exit 3) |
| `opa test policies` (5 Rego tests) | 5/5 pass against OPA 1.4.2 |
| DAL + RLS integration (`TEST_DATABASE_URL`, live OPA) | 5 pass, repeatable |
| Worker queue integration | 1 pass |
| `next build` | pass |
| E2E against `next start`: no cookie, stale cookie, valid cookie, public `/` | 307, 307, 200 with data, 200 |
| E2E with OPA stopped | unavailable notice, no data |

## Not implemented (spec items deliberately left out)

- `apps/public-web`, `institution-console`, `company-os`, `operations-os`,
  `developer-portal`, `external-portals`: no code.
- `packages/ui`, `observability`, `config`: no code.
- `services/integration-service`, `notification-service`, `ai-gateway`: no code.
- Only the `student` role has grants. Other roles are not defined.
- Sign-up, account recovery, and session issuance: `/signup` is a notice only.
- Worker job kinds: no handlers are registered, so any job fails closed as an
  unregistered kind.
- The Supabase CLI, pgTAP, and `supabase db lint` are not used. The SQL tests
  are plain assertions that run on any Postgres 16.
- ESLint is not configured, so there is no `lint` task.
- The spec's `exactOptionalPropertyTypes` and `noUncheckedIndexedAccess` are on.

## Deployment

Not deployed. See the status note in the pull request for the blocker.
