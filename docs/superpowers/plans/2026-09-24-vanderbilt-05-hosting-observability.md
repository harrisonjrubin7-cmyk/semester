# Vanderbilt Hosting and Observability Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:test-driven-development`, `vercel:deployments-cicd`, `vercel:vercel-functions`, `vercel:env-vars` and `supabase:supabase`.

**Goal:** Run the institutional gateway safely on Vercel with durable Supabase state, environment isolation, truthful readiness, monitored deployment and rollback.

**Architecture:** Extract a shared runtime factory used by the local Node server and a thin Vercel catch-all function. Define journal and rate-limit interfaces; keep SQLite/local memory for development and use atomic Postgres implementations in staging/production.

### Task 1: Extract runtime and persistence interfaces

**Files:** Modify `app/server/institution/journal.ts`, `gateway.ts`, tests; create `app/server/institution/contracts.ts`, `runtime.ts`, `runtime.test.ts`, `postgres-journal.ts`, `postgres-journal.test.ts`, `rate-limit.ts`, `rate-limit.test.ts`.

- [ ] Write failing contract tests that run the action state machine against SQLite and a fake Postgres repository, including concurrent claim, expiry, uncertain outcome, reconcile and single-use confirmation.
- [ ] Extract `ActionJournalStore` and `RateLimiter`; inject both into `createGateway()`.
- [ ] Keep current `ActionJournal` as the local implementation. Add a Supabase/Postgres implementation with atomic RPC calls and no in-process durable state.
- [ ] Move environment validation and service construction from `start.ts` into `createInstitutionRuntime(env)`; make local startup a transport-only wrapper.
- [ ] Run gateway, journal and runtime tests; commit `Extract serverless institutional runtime`.

### Task 2: Add durable production schema

**Files:** Generate migration `supabase migration new production_gateway_state`; create `supabase/gateway-state.check.sql`; modify `MIGRATION-HISTORY.md`.

- [ ] Write failing SQL tests for encrypted/sanitized prepared data, tenant/actor scoping, atomic claim, one-way states, expiration, reconciliation, distributed rate limit and audit immutability.
- [ ] Add Postgres tables and narrowly scoped RPCs; application roles cannot read another actor's prepared action or raw encrypted payload.
- [ ] Use a server-held encryption key or database-safe encrypted representation without placing decryption material in public tables.
- [ ] Run focused and full SQL checks; commit `Persist production gateway state`.

### Task 3: Add the Vercel gateway entry point

**Files:** Create `app/api/institution/[...path].ts`, `app/vercel.json`, `app/api/institution/handler.test.ts`; modify `app/tsconfig.university.json`, `app/server/institution/.env.example`.

- [ ] Write failing adapter tests for method, path/query, bounded body, headers, same-origin CORS, abort deadline and response streaming/body propagation.
- [ ] Add a thin Node function that reconstructs a standards `Request`, calls the shared runtime and emits the `Response`.
- [ ] Configure same-origin routing and security headers. Set no wildcard CORS and no filesystem persistence assumptions.
- [ ] Document server-only environment variables by Production/Preview/Development scope; only `VITE_UNIVERSITY_GATEWAY_URL` may be public.
- [ ] Run handler tests, `pnpm run check:university`, build and `vercel build` after project linking; commit `Add Vercel institutional gateway`.

### Task 4: Make readiness and telemetry truthful

**Files:** Modify `app/server/institution/gateway.ts`, `gateway.test.ts`; create `app/server/institution/readiness.ts`, `readiness.test.ts`, `app/scripts/production-smoke.mjs`; modify `app/package.json`.

- [ ] Write failing tests for liveness vs readiness, database unavailable, retention overdue, policy disabled, adapter degraded and monitoring unavailable.
- [ ] `/health/live` reports only process liveness. `/health/ready` returns 503 unless required durable dependencies are healthy; it reveals no secret subsystem details publicly.
- [ ] Emit structured metadata-only events with request correlation, tenant-safe IDs, latency, status and error class; never tokens or student content.
- [ ] Add synthetic probes for frontend, gateway auth refusal, readiness and configured integration health.
- [ ] Run focused tests and commit `Add production readiness and synthetic probes`.

### Task 5: Add CI/CD, alerts and rollback evidence

**Files:** Create `.github/workflows/vercel-preview.yml`, `.github/workflows/production-smoke.yml`, `docs/vanderbilt/production-activation-runbook.md`, `docs/vanderbilt/incident-routing.md`; modify `.github/workflows/ci.yml` only if necessary.

- [ ] Validate workflow syntax and prove forks/missing secrets skip deployment rather than expose or fail unpredictably.
- [ ] Pipeline order: install frozen lockfile, lint, tests, SQL checks, build, `vercel pull`, `vercel build`, deploy prebuilt preview, smoke. Production promotion remains a protected/manual environment.
- [ ] Record alert owners and routing for auth, gateway, OpenAI, LTI, retention, isolation and backup/restore signals.
- [ ] Exercise rollback and tenant-disable in staging; record timestamps and evidence links.
- [ ] Commit `Add production deployment and incident controls`.

**External gate:** Creating/linking production Supabase and Vercel projects, billing, domains, secrets, alert destinations and protected promotion requires the user's accounts and secure dashboard actions. Do not mark production-verified from local tests.
