# Stream 01 · Database, tenancy, RLS and core logic

Land the data foundation every screen reads from.

Paste this file into Claude Code (or Codex) at the repo root.

## Inputs from the design project
- `handoff/semester-platform/` (migrations 010-040, lib, app routes, tests)
- `handoff/semester-core/`
- `ui_kits/architecture/` (20-table design schema, flows)

## Tasks
1. Reconcile migrations 010-040 with existing supabase/migrations; renumber after the latest existing one. Never edit an applied migration; add new ones.
2. Add memberships, roles, capabilities, grants (scoped, expiring), sessions, delegations, audit.events (append-only), outbox and read_model schemas from the architecture kit.
3. Install semester-core into app/src/lib/core/; reconcile names with lib/source.ts, lib/status.ts, lib/navareas.ts; run its tests.
4. Write RLS tests per table: own-tenant read/write, cross-tenant denied, company roles denied on student tables, expired grant denied, audit insert-only.
5. Apply 050_security_hardening.sql and prove tests/security.test.ts red-then-green (docs/secure/Platform Security Review.html), then 060_command_functions.sql (tests/commands.test.ts), 070_ai_gateway.sql and 080_sources_storage_delegations.sql; add middleware.security.ts and the CI security job.
6. Outbox worker and projections with version and freshness; freshness.ts drives UI policy.

## Exit gates
- [ ] npx supabase db reset runs clean
- [ ] RLS suite passes with a red-then-green proof per policy
- [ ] semester-core tests pass

## Rules (every stream)
- Repo: harrisonjrubin7-cmyk/semester. Work on branch `semester/platform-core` from latest `origin/main`. Open one PR per stream; merge only after CI is green and a human approves.
- Read first: CLAUDE.md, README, `git log --oneline -30`, and this design project's `readme.md`, `SKILL.md`, `docs/master/*`.
- Audit before you write: find what already exists for each item and extend it. Do not create a parallel implementation. Record each "exists / extended / new" decision in the PR description.
- Design system: use tokens and components only (no raw hex, px z-index or durations); `npm run design-system:check` must pass.
- Data: RLS on every table, `tenant_id` on every row, browser calls `api.*` only. Company roles (investor, CS, RevOps, finance) never read student tables. AI never receives student records.
- Every consequential action: preview, then audit event written first, then apply, then an undo or request path.
- Every screen: loading, empty, error, forbidden and offline states, keyboard path, visible focus, accessible names, 44px targets.
- Do not commit secrets, change production settings, deploy, or write to Figma. Stop and report on the first failure you cannot fix inside this stream.
- Nothing is "done" without code, tests, RLS proof, accessibility check, monitoring hook, docs and release evidence (the 22-point definition in `docs/master/SEMESTER_RELEASE_GATE_CATALOG.md`).

## Report at the end
Files changed · commands run with results · tests added · RLS cases proven · open gaps with priority · what the next stream needs.
