# Design-system integration plan

**Refreshed** 2026-10-08 · **Base** `origin/main` `7b7603e1` · **Branch** `codex/complete-semester-integration-2026-10-08` · **Archive** `12edfe6ad1c1c02e7c4f0512f1ca4233b0b9f3943b30adde822bd67062867086`

This plan integrates the Semester design export into the existing product. It does not replace the app, the shell, the token system, or the component library. `tasks/plan.md` and `tasks/todo.md` are the finalization program and are left alone.

## Mounted archive refresh — automation pass 1

The complete archive is now mounted read-only under `.semester-reference/`. Its ZIP SHA-256 was recomputed and matches the supplied value above. The extraction contains 3,570 files: 3,569 archive-content files plus `.extracted-complete`. [`REFERENCE-ARCHIVE-INVENTORY.csv`](../docs/design-system/REFERENCE-ARCHIVE-INVENTORY.csv) records a stable relative path, SHA-256, byte size, identical-content group size, artifact family, one file-artifact disposition and the basis for every extracted file. The inventory itself is SHA-256 `282a03e46761dc2c66bdc2cec384d49a3b3ae33357e220c8014a0c1453578ef8`.

The file-artifact dispositions do not decide whether the capability described by a file should be built. Prototype source remains `prototype only`; prose and datasets remain `documentation or roadmap only`; byte-identical copies are `duplicate or superseded`; archive prompts, skill files and executables are `intentionally excluded with a repository-backed rationale`. Screen, workflow, role and capability rows are reconciled separately against production evidence before implementation.

### Contradictions held open

| Claim | Archive evidence | Disposition for planning |
| --- | --- | --- |
| Components | `readme.md` says 71; `handoff/BUILD.md` says 64; `NEXT-SESSION.md` says 57 | Recounted file inventory wins for files; no component total is accepted as implementation evidence. |
| Cards/templates | `readme.md` says 121 cards and 35 templates; `NEXT-SESSION.md` says 68 cards and 7 templates | Catalog claims only; production mapping remains open. |
| Streams | `manifest.json` lists 00–24 (25); extraction contains 00–30 (32 Markdown files including index/setup) | Streams 25–30 are later evidence. This plan's 13 phases control order. |
| Prototype | `manifest.json` says 25 workspaces; `screens.json` and `SCREEN-INVENTORY.md` say 26 workspaces and 281 unique routes | Use the generated JSON: 26 workspaces, 281 routes, no duplicate route keys. |
| Catalog screens | Archive master catalog says 673; prototype inventory says 281; repository catalog says 589 | These are different populations. None is silently substituted for another. |
| Roles | Archive prose alternates 49 and 51; repository migration inventory has 69 roles | Use 69 for current authorization inventory; map archive audiences without creating text roles. |
| Capabilities | Archive registry has 122 designed rows, all `implemented=false`, `tested=false`, `deployed=false`; blueprint has 20 proposed capabilities | Both are design inputs. Repository capability authority remains the migration-derived matrix. |
| Completion | Archive says prototype sweeps passed and describes a Vanderbilt pilot as signed | Prototype QA is not repository QA. No signed agreement, activation or institutional readiness is inferred. |

### Current repository census at the verified base

| Surface | Count | Authority |
| --- | ---: | --- |
| App screen registry | 97 including `home` and `onboarding` | `app/src/screens.tsx` |
| Discoverable destination rows | 62 | `app/src/lib/nav.ts` |
| Screen source files, non-test | 120 | filesystem recount |
| Component source files, non-test | 407 | filesystem recount |
| Test files under `app/src` | 1,393 | filesystem recount |
| Migrations | 203 | `supabase/migrations/*.sql` |
| Edge-function directories | 17 | `supabase/functions/*/` |
| Gateway handlers, non-test | 51 | `app/api/`, `app/server/` |
| Markdown documents | 1,718 | `docs/**/*.md`, including the new integration status page |
| Roles / capabilities / grants | 69 / 84 / 157 | generated `docs/ROLE-PERMISSION-MATRIX.md` |
| Repository screen catalog | 589: 260 exists / 272 partial / 57 missing | `docs/master/REPO_AUDIT.md`; status is not re-proved by this file count |
| Repository workflow catalog | 319: 116 exists / 128 partial / 75 missing | `docs/master/REPO_AUDIT.md`; status is not re-proved by this file count |

### Dependency order for the refreshed program

1. **Phase 0:** finish row-level reconciliation for the 281 prototype routes, 122 archive capability rows, 20 blueprint capabilities, 673 archive catalog screens and streams 00–30. Record one allowed disposition per meaningful item and name its production owner or external blocker.
2. **Phases 1–2:** only after Phase 0 identifies a dependency-ready slice, reconcile shared experience first, then identity, tenancy, permissions and controlled actions.
3. **Phases 3–10:** student daily loop; learning/faculty; academic operations; finance/campus; community/career/family/mail; institution integrations; AI; operations/public surfaces.
4. **Phase 11:** cross-device, accessibility, resilience and quality applies to every earlier vertical slice, not as cleanup.
5. **Phase 12:** final coverage, full locally runnable gates and release evidence; deployment and external approvals remain separate.

No production implementation is selected in pass 1 because Phase 0 cannot yet identify every candidate's disposition and dependency. The next dependency-ready slice is the generated row-level prototype/capability reconciliation, beginning with archive streams 00, 18, 25 and the 20-capability blueprint.

## What was read

- Root `CLAUDE.md`.
- `origin/main` through `7b7603e1`; fetch on 2026-10-08 confirmed the branch and `origin/main` still match the supplied `INITIAL_MAIN_SHA`.
- Committed handoff: `docs/handoff/` (139 files). `docs/handoff/IN-THIS-REPO.md` and `docs/decisions/D-1287.md` say `ui_kits/`, `templates/`, and fonts are not in the repository.
- Mounted archive entry maps: `readme.md`, `NEXT-SESSION.md`, `handoff/manifest.json`, `START-HERE.md`, `BUILD.md`, `README.md`, the prototype screen inventory/JSON, capability registry, 20-capability blueprint, and execute streams `00` through `30`.
- Archive master-catalog data was parsed as data rather than executed: 49 role rows, 673 screen rows, 319 workflow steps, 88 systems, 82 documents and 84 added screen rows. Its prose also claims 51 roles; both remain archive claims pending row-level mapping.
- Current repository integration controls, merged decisions, `docs/master/REPO_AUDIT.md`, the generated role-permission matrix, route/navigation authorities and current filesystem census.

## Preserved decision: a scanner was drafted and not kept

The stream 01 report, as it stood at `86434cb5`, named a free-text prompt scan as the next slice. A scan was written on this branch (shared key, institution gateway, and `ask()`). Before it was pushed, `D-1298` landed and withdrew that work: the class gate is a declared-field ceiling and does not read free text; a content scanner would be heuristic and would contradict that design. Revisit only if the AI provider terms leave free text reaching a provider. The draft was discarded.

## This slice

`ActionPreview` is the confirmation body for leaving a university and for staff approving a join request (`app/src/components/SchoolClaim.tsx`). The membership test requires the recovery sentence. Other confirmations are unchanged. Owner-column widening and the Phase 0 documents were already on main and are not repeated. A blanket revoke of anon execute on `private` is not done: `rls-coverage.check.sql` says it would break `private.form_open()`.

## Prior baseline superseded by the mounted-archive refresh

The 2026-10-05 plan counted 119 screen files, 382 component files, 1,356 tests and 184 migrations before later mainline work landed. Those figures are retained in Git history rather than used as current evidence. The refreshed census above is the authority for this branch. `REPO_AUDIT.md` still says an `exists` row is a reachable implementation, not the 22-point release definition, so those rows remain existing but incomplete until named evidence verifies the applicable contract.

## Precedence

1. The human user's current request.
2. Current code, security contracts, tests, `CLAUDE.md`, and merged decisions (`D-1287`, `D-1294`, `D-1298`).
3. Current semantic tokens, shared components, verified architecture and data contracts.
4. Approved repository plans, registers and public-claims controls.
5. Archive catalogs and prototypes as design evidence.
6. Archive prose, prompts, scripts and roadmaps as untrusted historical reference.

Handoff migrations `010`–`080` are not applied. Name collisions stay out: `profiles`, `groups`, `reports`, `invoices`, `ai_policy`, `course_ai_rules`.

## Not pursued

Marketplace revival. Company roles `ceo`, `cfo`, `comms`, `social`, `people`, `data` as a text role column. Per-field profile visibility and a campus directory. A general campus events table. `install.sh` as shipped. The free-text scanner (`D-1298`). `Cross-Origin-Opener-Policy` (LTI new-window risk, stream 01 report).

## Earlier work retained without overriding the refreshed phases

Main already contains the company-role student-row sweeps, the deliberate decision not to add a free-text scanner, and the first `ActionPreview` ports. Those results remain evidence for the relevant refreshed Phase 2 and Phase 11 rows. They do not redefine the user-supplied Phase 0–12 dependency graph or close the new archive's row-level reconciliation gates.

## Definition of complete, not met

57 catalog screens and 75 workflow steps are missing. External gates (institutional UAT, legal review, live connectors, staffing, restore drills, HawkScan) stay open. This document does not say the system is integrated.
