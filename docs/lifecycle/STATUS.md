# Lifecycle permission contracts: status

Source inputs (unchanged copies): `permission-matrix.csv` (26 contracts, LM-001 to LM-026),
`academic-transitions.csv` (24 target transitions), `lifecycle-permission-contracts.html`
(the sortable snapshot). Generated October 21, 2026.

These files are specifications. The registry table (`public.lifecycle_permission_contract`,
migration `20261024090000`) is descriptive and grants nothing. Nothing here is applied to a
database, deployed, or institution-authorized.

## What exists in the repository

| Item | State | Evidence |
| --- | --- | --- |
| Contract registry table (26 rows) | Implemented as a draft migration | `supabase/migrations/20261024090000_lifecycle_contract_catalog.sql`; ids match the CSV, checked by `supabase/lifecycle-guidance.check.sql` |
| Guidance publisher wrapper (LM-010) | Implemented as a draft migration | `supabase/migrations/20261024090100_course_guidance_once.sql`; `publish_course_guidance_once` |
| Backend adapter for LM-010 | Implemented, **not registered as a route** | `app/server/lifecycle/publish-guidance.ts`, tests in `publish-guidance.test.ts` |
| All other 25 contracts (LM-001 to LM-009, LM-011 to LM-026) | Specified only | No route, screen, or command added |
| 24 academic transitions | Specified only | `academic-transitions.csv` |

## Verification

| Check | Result |
| --- | --- |
| `supabase/check.sh lifecycle-guidance coursestudio` (Postgres 16) | Passes: 23 new checks plus 45 existing Course Studio checks |
| Mutation: version guard disabled | Suite fails at "stale expected version", as it should; migration restored |
| `app/server/lifecycle/publish-guidance.test.ts` | 23 passing |
| `npm run check:university`, `npx tsc -b`, `npm run lint` | Pass |

**Limits.** The repository's SQL harness is written for Postgres 17, the live project's major.
Only Postgres 16 was available, so the run used `SEMESTER_CHECK_PG_ANY=1`. Re-run on 17 before
relying on it. Concurrent publishers racing on one version are not tested; the lock order is
read from the function, not raced.

## Not done, and blocked

- **Deployment.** Nothing has been applied to any Supabase project. Applying the two migrations
  to a live project needs explicit approval.
- **Route registration.** The adapter is intentionally unregistered. Registering it needs body and
  rate limits, origin policy, log minimization, and a verified publishable-key configuration.
- **Activation.** No institution has authorized the wrapper. The package requires that
  activation stay off until the existing control plane authorizes the exact environment,
  institution, and capability.
- **Callers.** The old publisher still works. Only migrated callers gain idempotency. Caller
  migration is not planned in this change.
- **Retention.** Receipts cascade with the sending account (see `RETENTION.md`). This is a
  decision; a reviewer should confirm it before activation.
- **Full ecosystem.** The 25 unimplemented contracts each need their own vertical slice: screen,
  command, policy, tests, and an acceptance check. None is started here.
