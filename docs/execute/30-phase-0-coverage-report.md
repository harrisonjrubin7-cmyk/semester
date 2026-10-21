# Stream 30 · Phase 0 — handoff intake and ecosystem coverage matrix — report

**Date** 2026-10-11 · **Base** origin/main `a4742f6b`, rebased onto `ccf2d45f` (#1470) before push · **Branch** `claude/epic-galileo-aq26dg` (the session's assigned branch) · **Pull request** harrisonjrubin7-cmyk/semester#1475, draft · **Decision** [`D-1475`](../decisions/D-1475.md) · **Inputs** the design export `The_Main_Semester_design_system_2_copy_7.zip` (644 files), [`../handoff/execute/30-phased-build.md`](../handoff/execute/30-phased-build.md) Phase 0, [`../handoff/REPO-CROSSWALK.md`](../handoff/REPO-CROSSWALK.md)

## Verdict

**Phase 0's first two deliverables are done; the rest of Phase 0 is not.** Every prototype route (281) and design-registry capability (122) now has a status on the seven-level ladder, from repository evidence, in a form the test suite regenerates and refuses when it lies. The applied-schema half of "diff deployed vs repo intent" is settled by digest. Not done from Phase 0's list: owners and backups per capability (one founder; the matrix has no owner column because there is no second name to put in it), the canonical-implementation choice where duplicates exist (task, assignment and notification models), and the AI student-record policy decision, which is the founder's. The 51 routes at `specified` and 11 at `schema-present` are the build queue for Phases 1 to 5; none was started here beyond one backlog slice.

## Exists / extended / new

| Item | Decision | Why |
| --- | --- | --- |
| `docs/handoff/` (6 Oct export, 138 files, D-1287) | **extended** | 445 non-PDF files added, 8 updated from the 11 Oct export; 61 PDFs left out as D-1287 did; `IN-THIS-REPO.md` says which. Scanned for key material first: none. |
| `docs/master/REPO_AUDIT.md` (589-screen audit, stream 00) | **kept, not restated** | A different list (the design screen catalogue) at a different granularity. The new matrix is over the prototype's routes, which the handoff names as the acceptance reference. |
| `docs/registry-status.json` | **new** | The file `REPO-CROSSWALK.md` says Phase 0 writes. Generated. |
| `docs/ecosystem/INVENTORY.md`, `COVERAGE-MATRIX.csv`, `crosswalk.json`, `deployed.json` | **new** | The master inventory and the fifteen-column matrix the coverage programme asks for; the curated evidence; the deployment snapshot. |
| `app/src/lib/docs/ecosystem.ts` + test, `npm run ecosystem:build` / `ecosystem:check` | **new** | Follows `tokenexport.test.ts`: write under an env flag, otherwise regenerate and compare. |
| `app/src/lib/path-readiness.ts` `named` row | **extended** | Backlog item 1, first half: unmatched named codes after a catalog import. |
| `docs/developers/ONBOARDING.md` | **extended** | Names the two scripts, as `docs:impact` requires for a `package.json` change. |
| `.gitleaksignore` | **extended** | One pinned false positive in the intake: a module-registry field whose value is the sentence "Enrollment/teaching scope". |

## Coverage result at `a4742f6b`

| Ladder | Routes (281) | Capabilities (122) |
| --- | ---: | ---: |
| specified | 51 | 29 |
| schema-present | 11 | 7 |
| code-present | 89 | 32 |
| connected | 18 | 9 |
| tested | 112 | 45 |
| deployed | 0 | 0 |
| operational | 0 | 0 |

Per workspace: `docs/ecosystem/INVENTORY.md`, counts block. Whole workspaces at `specified`: none after mapping, but `trust` (21 routes) is mostly docs-only items, and `studio` (31) and `social` (13) are largely design-ahead; `admissions` (6) has no admissions screen at all. Three judgement calls are recorded in `crosswalk.json`'s method and D-1475 §4: local-first screens syncing through `cloud.ts` count as `connected`; several institution routes map to the operator console's tenant operations rather than an institution-admin screen; `#/student/trustroom` maps to the reviewer-only procurement room, not a student screen.

## Deployment, as established

| Surface | Finding | Method |
| --- | --- | --- |
| Production database `lzrqvlugnawcgywkhqlz` | 234 applied versions, first `20260901000100`, last `20261011183000`, md5 of the ordered list `b3f233cab6a321ee41bdc2d7716fb64f`; **equal** to the digest of the repository's 234 migration file names | read-only SQL over `supabase_migrations.schema_migrations`; nothing applied |
| Production app | **unverified** | the Vercel listing refused this session's credentials (403, team `harrison22`); the URL is a repository variable |
| Branch preview | built for `semester`, `api`, `web`, `semester-company-site` (commit statuses "Deployment has completed") and **not seen**: Vercel Authentication, plain fetch 302, authorized fetch 403 | GitHub commit statuses; `curl`; Vercel MCP fetch |
| Edge Functions | not re-verified | — |

Nothing was deployed, applied, or changed outside the repository.

## Commands run and results

Run from `app/` after `npm ci` at the repository root (Node v22.22.0).

```
$ npx tsc -b                       → exit 0 (before and after the rebase)
$ npm run lint                     → exit 0; styles ok · labels ok · terms ok
$ npm run check:university         → exit 0
$ npm run design-system:check      → exit 0 (69 tests)
$ npx vitest run src/lib/path-readiness.test.ts    → 20 passed (the 5 new ones failed first: `unmatched` undefined)
$ npx vitest run src/lib/docs/ecosystem.test.ts    → 12 passed; problems: []
$ npm test                         → Test Files 1516 passed | 4 failed | 1 skipped; Tests 24192 passed | 4 failed | 69 skipped
$ npm run build                    → exit 0 (after the rebase; chunk-size warnings as before)
$ npm run test:shuffle             → seed 1791757697990; Test Files 1517 passed | 3 failed | 1 skipped; Tests 24196 passed | 3 failed | 69 skipped
```

**The four `npm test` failures.** One was this container: plugin tooling created `.md-linker/` and `.ruff_cache/` at the repository root, which `developers.test.ts` rightly refuses; removed, not committed. The other three reproduce on the untouched base `a4742f6b` with this branch's changes stashed, in the ordered run and the shuffled run alike, and main's own CI had been red on them for its last five runs (`a4742f6b`, `ccf2d45f` and three before). No fix existed elsewhere, so the third commit makes them green, each by the smallest change that matches what the tree already does:

- `src/isolation.test.ts` — `MyRules.test.tsx` and `ProductivityCloud.test.tsx` call `vi.mock` and were not in the `mocked` project (130 expected, 128 listed). Both are now listed in `MOCKS_MODULES`.
- `src/lib/docs/trust-docs.test.ts` — `docs/trust/CONTROL-FACTS.md` said 233 migration files after the 234th landed (#1419) without a regeneration. Regenerated with `REGISTERS=write`; the diff is that one line.
- `src/components/unity/rollout-c.test.tsx` — the shared `DelegationRow` confirms a revoke inline (Revoke, then Revoke now) since #1360 unified the controls; the test still pressed "Revoke now" first. It now presses both, which is the behaviour the control's own comment describes.

**CI on the first push** failed `secrets` (one gitleaks `generic-api-key` hit on a prose field in the intake, pinned in `.gitleaksignore`) and `impact` (`app/package.json` changed with no developer doc; `ONBOARDING.md` now names the scripts). Both fixes are in the second commit; the result is on the pull request.

**Not run, and why.** `verify.sh` from the handoff needs Docker for `supabase db reset`; Docker is not running here. HawkScan (`hawkscan.yml` passed in CI); the local scan needs `HAWK_API_KEY`, which is not set. No browser walk: nothing a student sees changed beyond one sentence in an existing list.

## Bugs found

- `handoff/preflight.sh` in the 11 Oct export still carries the Node 22 bug stream 00 fixed; the repository keeps the fixed copy.
- The 11 Oct `module_registry.json` trips gitleaks' `generic-api-key` on ordinary prose; pinned, not reworded, so the export stays verbatim.

## What the next stream needs

1. The production app URL (`SEMESTER_PRODUCTION_APP_URL`) or Vercel access for the `harrison22` team, so `deployed.json` can record a probe and rows can move to `deployed`.
2. A founder decision on `crosswalk.json`'s "via store sync" rating (D-1475 §4); a bulk downgrade is one edit and a rebuild.
3. Phase 0's remaining items: canonical model choice (task, assignment, notification), the AI student-record policy, and an owner-and-backup column once there is a second name.
4. Then Phase 1 (`30-phased-build.md`): T01, F01, F02 to `tested` with CI evidence; the matrix's `trust/*` and `operations/*` rows are where that lands.
