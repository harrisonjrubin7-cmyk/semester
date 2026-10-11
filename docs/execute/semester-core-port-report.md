# Semester core port — consequence, freshness, approvals

Stream 01 follow-up from `handoff/BUILD.md` §4 and the `semester-core/` README: port the
workflow algorithms that have no code counterpart in the repository. Scope is three
modules, not the whole `semester-core/` package.

## Classification (BUILD.md rule 2: exists / extended / new)

| Handoff module | Repo counterpart found | Decision |
| --- | --- | --- |
| `consequence.ts` (undo / preview / review-confirm / two-person) | `app/src/lib/ops/console.ts` holds duty *text* and a `twoPerson` flag, no classifier | **new**: `app/src/lib/core/consequence.ts` |
| `freshness.ts` (projection lag → display policy, optimistic mutation) | `app/src/lib/integration/health.ts` has a freshness vocabulary, no policy table or `optimistic()` | **new**: `app/src/lib/core/freshness.ts` |
| `approvals.ts` (two-person state machine, MFA within 15 min) | none; `ops/console.ts` describes two-person duties only | **new**: `app/src/lib/core/approvals.ts` |
| `provenance.ts` | `app/src/lib/provenance.ts`, `factprovenance.ts` exist | **not ported** — reconcile in a later slice |
| `nextaction.ts` | depends on the handoff `provenance.ts`, which conflicts with the repo's | **not ported** — blocked on provenance reconciliation |
| `access.ts` | would be a second permission model | **not ported** — BUILD.md forbids a second core; role/capability model stays the repo's |
| `aigateway.ts` | AI gateway exists under `app/src/ai` and `app/server` | **not ported** — needs reconciliation with the live gateway |
| `scoring.ts`, `pilot.ts` | `pilotdocs.test.ts`, `pilotroles.test.ts`; workflow-lab scoring is separate | **not ported** — not reconciled this session |

No existing file was modified. Three source files and three test files were added.

## Tests

The handoff `core.test.ts` assertions for these three modules were split into one test
file per module and extended with edge cases the original did not cover (zero money,
institutional overriding money, delayed vs failed vs rebuilding policy, MFA staleness,
rejection terminality, the execute-by-non-requester path).

## Verification evidence

Run from `app/`:

```
$ npx vitest run src/lib/core
 Test Files  3 passed (3)
      Tests  17 passed (17)

$ npx tsc -b
TSC_EXIT=0

$ npm run lint
... oxlint warnings all in pre-existing files; none in src/lib/core
styles ok / labels ok / terms ok
LINT_EXIT=0
```

**Guard check (CLAUDE.md "a guard that has never failed"):** the requester check in
`approvals.ts` was disabled (`if (false) return`) and the suite was rerun:

```
FAIL src/lib/core/approvals.test.ts > two-person approval > needs two distinct non-requesters ...
AssertionError: expected false to be true
Tests 1 failed | 3 passed (4)
```

The file was restored and confirmed byte-identical (`diff -q` clean).

**Full suite (`npm test`, 1523 files):**

```
Test Files  2 failed | 1520 passed | 1 skipped (1523)
Tests  2 failed | 24197 passed | 69 skipped (24268)
```

Both failures are outside this change:

1. `src/isolation.test.ts` — *is every file that calls vi.mock, and no other*.
   `src/components/MyRules.test.tsx` and `src/components/ProductivityCloud.test.tsx`
   call `vi.mock(` but are absent from `MOCKS_MODULES` in `app/vite.config.ts`.
   Confirmed with a direct diff of the two lists. Pre-existing on `origin/main`; not
   fixed here because the fix is a config edit to a list owned by another change.
2. `src/components/unity/rollout-c.test.tsx` — *SupportAccess: … says a revoke as a
   permission change with no control to go anywhere*. Fails deterministically when the
   file runs alone (`1 failed | 18 passed`). It imports nothing from `lib/core`. Not
   investigated further in this slice.

Not run: `npm run test:shuffle`, `npm run check:university`, `npm run build`,
`design-system:check`. These are required by CLAUDE.md before merge; they are not yet
verified for this branch.

## Not verified / not done

- No deployment. The Vercel connector returned no teams (`list_teams` → empty), so no
  staging or preview target is reachable from this session.
- The three modules have no UI consumers yet. Nothing in the app imports
  `src/lib/core/*`; they are library code pending a screen that uses them.
- hawkscan was not run: `HAWK_API_KEY` is not set and no application instance is running.
