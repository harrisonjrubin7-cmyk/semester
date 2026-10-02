# Audit changelog

## Changes made

### Prevent push database-error disclosure

- Changed `supabase/functions/push/index.ts` to return a generic 500 and log a non-sensitive message when the due-queue read fails.
- Added an adversarial source regression in `app/src/lib/pushchain.test.ts` that fails if a database `error.message` is returned.
- Safety: no success behavior, queue ordering, delivery payload, credential handling or database mutation changed.

### Add reproducible endpoint inventory

- Added `scripts/build_endpoint_manifest.mjs`.
- Generated `endpoint-manifest.json`: 15 HTTP boundaries, now 217 authenticated RPC operations and 81 explicit service-role operations after the source limiter was added.
- Added `app/src/lib/endpointmanifest.test.ts` to fail on an omitted Edge Function, Vercel route or authenticated RPC.
- Added the six requested human-readable audit/architecture/security/product documents.

### Bound authenticated source-check egress

- Added `take_productivity_source_rate_limit()`, a no-argument authenticated RPC that derives the subject from `auth.uid()` and owns a ten-per-rolling-minute policy.
- The Edge Function consumes the shared allowance before DNS or outbound fetch work, returns a generic `429` with `Retry-After`, and fails closed with a generic `503` if shared state is unavailable.
- Only explicitly classified validation errors are returned; DNS, fetch, parser and other runtime failures now receive a generic response and a non-sensitive error-class log.
- Added an adversarial PostgreSQL suite for N+1 refusal, cross-account isolation, anonymous denial and exact accepted-hit accounting, plus source regressions that hold call ordering and error redaction.
- The existing DNS check/use gap remains open; this change does not misrepresent a second DNS lookup as connection pinning.

## Validation

| Check | Result |
| --- | --- |
| TypeScript build graph (`tsc -b --noEmit`) | pass |
| Lint/styles/labels/terms | pass with 24 pre-existing React warnings |
| University gateway typecheck | pass |
| Production Vite build | pass; existing >500k chunk warnings |
| Production bundle budgets | pass after changes: first load 434.4/479.0 KB; largest budgeted file 435.7/480.0 KB; 93 routes |
| Targeted manifest + push regressions | pass: 2 files, 17 tests |
| Source-check limiter and manifest regressions | pass: 3 files, 22 tests; definer register pass: 8 tests |
| Baseline full Vitest suite | pass: 1,254 files; 19,555 passed; 48 skipped |
| Post-change full Vitest suite | functionally clean but runner-concurrency limited: with four workers, 1,252/1,255 files and 19,557/19,560 executed tests passed; the three failures were five-second timeouts in unrelated UI tests. Each residual test then passed independently, including the borderline waiting-row test when selected alone. No assertion failure remained. |
| PostgreSQL 17 migration/RLS harness | not run: PostgreSQL 17 server unavailable |
| Native dependency audit | not run locally: npm executable unavailable; CI configuration reviewed |
| HawkScan | blocked at required post-change preflight: `hawk` command and API key unavailable; current configuration scans frontend only |

## Intentionally not changed

- No production data, dashboard settings, secrets, branches, external resources or migrations were deleted or altered.
- The source-check DNS rebinding gap was not superficially patched: the new shared rate limit bounds abuse, but safe rebinding resistance still requires an explicit host policy plus egress/connection-pinning architecture.
- The ruleset file was not edited because repository configuration does not prove the remote ruleset is applied and requiring HawkScan before API coverage/credentials are operational could deadlock merges. This is a repository-admin action with acceptance tests in `AUDIT-REPORT.md`.
- Large frontend modules were not broadly refactored; characterization and bounded extraction should precede behavior changes.
- Community media was not enabled without a scanner; the existing pending/fail-closed design is safer than an incomplete worker.
