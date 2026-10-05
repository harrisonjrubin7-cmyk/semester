# Stream 00 · Repo audit and design-system sync — report

**Date** 2026-10-05 · **Base** origin/main `2d8dda1` · **Branch** `claude/build-handoff-setup-ffbwec` (the session's assigned branch, used instead of `semester/setup`)

## Verdict

Stream 00 is **complete**. Its three open decisions were delegated to the assistant by the founder in-session and are recorded in [`D-1287`](../decisions/D-1287.md): the design-system baseline is accepted as the reference, stream 01 diffs the handoff against the repo before applying any migration, and only `handoff/` of the design export is kept. The founder can overrule any of them. This pull request still needs a human to merge it, and nothing after this stream has been started.

## Exists / extended / new

| Item | Decision | Why |
| --- | --- | --- |
| Toolkit steps 1, 2, 4, 5 (design-system audit, baseline, CI gate, FIGMA-MAPPING) | **exists — not redone** | Landed on main before this stream (`f24b1aa`, `1554d3b` D-1274, `d4d025b`); `app/design-system-baseline.json`, `app/scripts/design-system-*.mjs`, `docs/design-system/` and the CI step "Design-system gates" are all present. |
| CI jobs: typecheck, lint, unit tests, design-system check, DB policy ("RLS") job | **exists** | `.github/workflows/ci.yml` already runs each, plus shuffle, timezones, a11y journeys, load, restore rehearsal and secret scans. Nothing added. |
| `docs/master/REPO_AUDIT.md` | **new** | Maps all 589 catalog screens and 319 workflow steps to repo evidence. |
| `docs/master/SEMESTER_GAP_REGISTER.md` | **new** | Generated from the audit; replaces the design project's design-level register. |
| `docs/master/SEMESTER_SCREEN_CATALOG.md`, `SEMESTER_WORKFLOW_CATALOG.md` | **new (copied)** | The two inputs the audit is against, copied unchanged from the design export. |
| `docs/master/SEMESTER_ROLE_CATALOG.md` | **repo kept** | Name collides with the repo's own, evidence-based version; the design copy was not used. |

## Files changed

`docs/master/REPO_AUDIT.md`, `docs/master/SEMESTER_GAP_REGISTER.md`, `docs/master/SEMESTER_SCREEN_CATALOG.md`, `docs/master/SEMESTER_WORKFLOW_CATALOG.md`, `docs/execute/00-setup-report.md`, `docs/decisions/D-1287.md`, and `docs/handoff/` (138 files, 876 KB: the design export's `handoff/` folder, with the `preflight.sh` fix and a note, `IN-THIS-REPO.md`, saying where it lives). No code, migration, CI, secret or setting changed. The rest of the design export (70 MB, 57 MB of it design-chat PDFs; `ui_kits/`, `templates/`, fonts) was **not** committed.

## Commands run and results

Run from `app/` after `npm ci` at the repo root (Node v22.22.0; npm warns that one dependency wants ≥22.22.2).

```
$ bash design/handoff/preflight.sh
NOTE  app is not a Next.js app. API routes in app/api/* need a Next.js app (see BUILD.md §2 'App target').
PREFLIGHT OK        # after fixing a bug in preflight.sh itself, see below

$ npx tsc -b                     → exit 0
$ npm run lint                   → exit 0
styles ok — every font size is on the scale, no token is defined as itself; type 16 · leading 9 · space 0 · shorthand 0 · dim 2 still off it across 17 files; 0 allowed exceptions
labels ok — every form control has a name a screen reader can read, and no control loses one to CSS
terms ok — no file uses more retired words than the ledger allows; 25 still on screen across 17 files, 9 words retired
$ npm run check:university       → exit 0
$ npm run design-system:check    → exit 0
✓ 0 violation(s), 86 warning(s) · {"hexLiterals":30,"ledgerTotal":30,"customPropertiesDefined":295,"semanticTokens":119,"primitiveTokens":96,"figma":{"valid":60,"missing":0,"unmappedCandidates":71},"r
design-system:css ok — no raw value beyond the ledger; carried: color 78 · layer 30 · elevation 31 · radius 0 · motion 6 · space 81 · type 53
$ npm test   (before adding docs)  → Test Files 1 failed | 1433 passed | 1 skipped ; Tests 1 failed | 23141 passed | 69 skipped
    FAIL src/lib/docs/developers.test.ts > names every top-level directory
    AssertionError: directories the map does not name: add a row: expected [ 'design' ] to deeply equal []
    Cause: the untracked design/ export at the repo root. Re-run without it: 116/116 passed.
$ npm test   (final, design/ outside the tree, docs added)
 Test Files  1434 passed | 1 skipped (1435)
      Tests  23142 passed | 69 skipped (23211)
```

**Not run, and why.** `verify.sh` and `install.sh` were not run for real: Docker is not running in this container (`docker info` fails), so `supabase db reset` (verify step 1) cannot run; and `install.sh` would add `010_…`–`080_…` migrations that sort before the repo's 184 timestamped ones and collide with its role model (see "What the next stream needs"). `npm run test:shuffle`, `test:zones` and `build` were not re-run for a docs-only change; CI runs them.

## Bug found in the handoff

`design/handoff/preflight.sh` line 6 passed a boolean to `process.exit()`, which throws on Node 22, so it printed "Node 20+ required" on Node 22.22. Fixed to `process.exit(Number(process.versions.node.split(".")[0]) < 20 ? 1 : 0)`. The fix is in the user's design export, not in this repo; the same script ships in the handoff and will fail the same way for anyone on Node 22 until it is replaced.

## Audit result

| | exists | partial | missing | total |
| --- | ---: | ---: | ---: | ---: |
| Screens | 260 | 272 | 57 | 589 |
| Workflow steps | 116 | 128 | 75 | 319 |

Validation: every row has a status, every `exists`/`partial` row cites at least one path, all cited paths exist, none cites `design/` (0 problems across 908 rows). Control: a random sample of 6 `exists` and 6 `missing` rows was drawn and four re-checked by independent search; all four matched. One wording nuance: F-004 "aging buckets" is computed in `lib/finance/mine.ts`, not rendered by the component. The audit is a read of the code; the 12 passes were model judgements, so treat `exists` on a flagged row as "reachable", not "ready".

## Tests added / RLS cases proven

None. Stream 00 adds no code. RLS proof begins in stream 01.

## Open gaps (highest priority first)

1. Controlled integration: 0 of 20 steps fully built; no screens, empty adapter list (stream 05, pilot path).
2. 68 P0 workflow steps not fully built; 24 of them have nothing at all (see the gap register).
3. Faculty and advising staff surfaces are mostly partial or missing (stream 04, post-pilot).
4. Developer platform 0 of 16, incident response 0 of 17, analytics 0 of 14 fully built.
5. `exists` rows behind flags whose defaults were not checked (listed in REPO_AUDIT.md).

## What the next stream (01 platform core) needs

- **The decision is made (D-1287): diff first.** The handoff's `010`–`080` migrations and `semester-platform` tests assume a Next.js + Supabase app with its own role and tenant model. The repo already has 184 migrations, `private.has_capability` RBAC (69 roles, 84 capabilities), RLS proved by `supabase/*.check.sql`, a gateway under `app/server`, and an AI path. "Repo beats design" means stream 01 should diff each handoff migration against what exists and extend, not install. Renumbering alone is not enough. A schema-aware comparison found 24 handoff tables in five new schemas, none with an exact counterpart, six sharing a name with an existing `public` table (`profiles`, `groups`, `reports`, `invoices`, `ai_policy`, `course_ai_rules`). Stream 01's first deliverable is `docs/execute/01-platform-core-diff.md`, deciding each as extend, new or drop; nothing is applied before it is reviewed.
- **Docker running** (or CI) for `supabase db reset`.
- **A `web/` Next.js app** only if some handoff code is genuinely needed that the Vite app and gateway cannot host; BUILD.md §2 assumes it, but the gateway may already cover it.
- **The design export for UI streams.** `ui_kits/` and `templates/` are not in the repo; the founder re-supplies the zips when stream 03 starts.
- **Founder-only steps still open:** merge this PR; every item in BUILD.md §7 (insurance, DPA, HECVAT, attorney review, IdP details, named contacts, the AI provider's terms, production cutover). None was decided or done here.
