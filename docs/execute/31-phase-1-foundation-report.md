# Stream 30 · Phase 1 — foundation hardening — first report

**Date** 2026-10-11 · **Branch** `claude/epic-galileo-aq26dg` · **Pull request** harrisonjrubin7-cmyk/semester#1475 · **Decision** [`D-1475`](../decisions/D-1475.md) §8–10 · **Plan** [`../handoff/execute/30-phased-build.md`](../handoff/execute/30-phased-build.md) Phase 1 · **Register** [`capability-register.csv`](capability-register.csv) (provisional)

## Verdict

**Phase 1's exit gate (T01, F01, F02 at `tested` with CI evidence) is not met, and this report says by how much.** Two read-only audits of the tree placed each gate capability by surface; two tests were then added where a surface had no proof at all, and the policy runner was given a committed suite list. The honest statuses are `in progress` for all three. Everything claimed below was run here; nothing was deployed or applied.

## What the audits found

| Capability | Tested before this stream | Partial or missing | Done here |
| --- | --- | --- | --- |
| T01 cross-tenant denial | DB (17 two-school suites; `rls-coverage.check.sql` sweeps every public table), API (one route driven with a tenant-B identity; service-layer tenant checks), AI (another tenant's source refused before the provider is called) | storage (community-media only), search (client-side; one server path), jobs (no multi-tenant tick), exports (per-account only); course-room isolation is a per-school switch DEFAULT OFF; `check.sh` ran from a glob | `gateway.test.ts`: a second tenant through **every** authenticated route, with a structural guard that fails when a route is added to the gateway and not to the sweep; `check-suites.txt` + `check.sh` manifest enforcement + `check-suites.test.ts` |
| F01 sign-in hardening | PKCE S256 (RFC 7636 vector), exact https redirect, signed expiring state bound to tenant and connection, state replay refused (`lib/integration/oauth.test.ts`); origin allowlist without wildcard (`_shared/cors.ts`); LTI redirect validated (`_shared/lti.ts`) | verifier-before-consume and at-most-one redemption are the authorization server's properties, and Semester is the client; no nightly audit-harness workflow; the plan's 8 AcxLane tests are not in the repository | audit recorded in the register; nothing built, because the missing pieces are either external or need the unsupplied prototype |
| F02 revocation on every surface | DB for role_grants, support_access, family_guardian, advisor_shares, sessions; API for role_grants and family_guardian | export, AI context, realtime untested for every kind; consent_records and course_source_lti partial; deprovision trigger is school-scoped only | `gradebook.check.sql`: a revoked registrar and an expired instructor refused at `gradebook_export` (and at a grade entry), the student's released grade untouched |

## Tests added, and their red runs

- `app/server/institution/gateway.test.ts` — describe "a second tenant on every authenticated route" (2 tests). Red when the adapter lookup was made to ignore the tenant (3 tests failed: this sweep and the two existing tenant tests) and when a route was added to `TELEMETRY_ROUTES` without the sweep (the structural test alone failed). Green restored: 48 passed.
- `supabase/gradebook.check.sql` — 7 new checks at the end of the suite; the suite reports 145 checks. Red when the `revoked_at` update was removed: `FAILED: a registrar whose grant was revoked exporting 2026FA — was allowed` (`check.sh` exit 1). Run against the local PostgreSQL 16 with `SEMESTER_CHECK_PG_ANY=1`, which the script says loudly is not the live major; CI runs 17.
- `app/src/lib/docs/check-suites.test.ts` (3 tests) — red when one line was deleted from the manifest. `supabase/check.sh` driven by hand: agreement proceeds to the Postgres check; a listed suite with no file and a file not listed each exit 2 before any cluster is built; a bad name on a named run still exits 2.

## Commands run

From `app/` unless noted.

```
$ npx vitest run server/institution/gateway.test.ts        → 48 passed
$ npx vitest run src/lib/docs/check-suites.test.ts         → 3 passed
$ REGISTERS=write npx vitest run src/lib/docs/trust-docs.test.ts → 38 passed; CONTROL-FACTS.md line 31 regenerated
$ npm run ecosystem:build && npm run ecosystem:check        → 12 passed, twice
$ SEMESTER_CHECK_PG_ANY=1 supabase/check.sh gradebook      → ✓ gradebook.check.sql — 145 checks (PostgreSQL 16, local)
$ npx tsc -b && npm run lint && npm run check:university && npx vitest run src/lib/toolkit src/lib/workspace-backup src/isolation.test.ts src/components/unity/rollout-c.test.tsx  → exit 0; 17 files, 154 tests (on the ported #1473 commit)
```

Then, on the whole head: `npx tsc -b && npm run lint && npm run check:university && npm run design-system:check && npm test` → exit 0; Test Files 1521 passed, 1 skipped (1522); Tests 24204 passed, 69 skipped (24273). `test:shuffle` and `build` were run on the previous head and nothing here changes a screen; the budgets step is discussed below.

## CI on the pull request

`build` is red on the performance-budgets step and the overrun is main's (D-1475 §8; comment on the pull request). Every other check on the head was green. The port of #1473 brought Export to 69.4 KB (budget 69.0) and Recovery to 67.3 KB (budget 62.0); it will stay red until the founder chooses between a further extraction and a justified raise.

## What the next stream needs

1. The founder's call on the budgets (§8), which also unblocks main.
2. T01 storage: a `storage.objects` assertion for the trust-room bucket and a bucket-policy sweep shaped like `rls-coverage.check.sql`. T01 DB: decide whether course-room isolation's per-school switch may stay DEFAULT OFF; if not, a migration (approval needed).
3. F02: a post-revocation assertion for the AI context path and for realtime presence; widen the deprovision trigger past school scope (migration, approval needed).
4. F01: the nightly audit-harness workflow is a CI change the founder should see first (schedule, pinned SHAs, artifact retention); the 8 AcxLane tests need the prototype.
5. The 20 register IDs without titles need the prototype's register to be supplied.
