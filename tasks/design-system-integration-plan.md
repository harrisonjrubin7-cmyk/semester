# Design-system integration plan

**Date** 2026-10-05 · **Base** `origin/main` `3bd382dc` · **Branch** `cursor/full-semester-system-integration-83d9`

This plan integrates the Semester design export into the existing product. It does not replace the app, the shell, the token system, or the component library. `tasks/plan.md` and `tasks/todo.md` are the finalization program and are left alone.

## What was read

- Root `CLAUDE.md`.
- `origin/main` through `3bd382dc`. After the inventory commit, main took #1303 (`D-1303`: the student-data sweep keys on fifteen owner-column names and probes 79 tables) and #1305 (Phase 0 reconciliation of the three supplied design PDFs).
- Committed handoff: `docs/handoff/` (139 files). `docs/handoff/IN-THIS-REPO.md` and `docs/decisions/D-1287.md` say `ui_kits/`, `templates/`, and fonts are not in the repository.
- The Desktop zip and `/Users/harrisonrubin/Documents/Cursor/Semester-Handoff` are not mounted on this machine. Prototype HTML was not copied.

## A scanner was drafted and not kept

The stream 01 report, as it stood at `86434cb5`, named a free-text prompt scan as the next slice. A scan was written on this branch (shared key, institution gateway, and `ask()`). Before it was pushed, `D-1298` landed and withdrew that work: the class gate is a declared-field ceiling and does not read free text; a content scanner would be heuristic and would contradict that design. Revisit only if the AI provider terms leave free text reaching a provider. The draft was discarded.

## This slice

`ActionPreview` is the confirmation body for leaving a university and for staff approving a join request (`app/src/components/SchoolClaim.tsx`). The membership test requires the recovery sentence. Other confirmations are unchanged. Owner-column widening and the Phase 0 documents were already on main and are not repeated. A blanket revoke of anon execute on `private` is not done: `rls-coverage.check.sql` says it would break `private.form_open()`.

## Recount (this tree)

| Surface | Count |
| --- | ---: |
| Screen catalog rows | 589 |
| Workflow step rows | 319 |
| Catalog exists / partial / missing (screens) | 260 / 272 / 57 |
| Catalog exists / partial / missing (steps) | 116 / 128 / 75 |
| Screen files, non-test | 119 |
| Components, non-test | 382 |
| Test files under `app/src` | 1356 |
| Migrations | 184 |
| Handoff files | 139 |

`REPO_AUDIT.md` says an `exists` row is a reachable implementation, not the 22-point release definition. This plan treats those rows as existing but incomplete until a named test covers the claim. The audit's surface table still says 1351 tests; this tree has 1356.

## Precedence

1. Current code, security contracts, tests, `CLAUDE.md`, and merged decisions (`D-1287`, `D-1294`, `D-1298`).
2. Current semantic tokens and shared components.
3. Verified architecture and data contracts.
4. Handoff catalogs and prototypes.
5. Handoff prose and roadmaps.

Handoff migrations `010`–`080` are not applied. Name collisions stay out: `profiles`, `groups`, `reports`, `invoices`, `ai_policy`, `course_ai_rules`.

## Not pursued

Marketplace revival. Company roles `ceo`, `cfo`, `comms`, `social`, `people`, `data` as a text role column. Per-field profile visibility and a campus directory. A general campus events table. `install.sh` as shipped. The free-text scanner (`D-1298`). `Cross-Origin-Opener-Policy` (LTI new-window risk, stream 01 report).

## Phases

| Phase | Scope | State |
| --- | --- | --- |
| 0 | Inventory, this plan, the checklist, the crosswalk | This change |
| 1 | Shared design-system mapping | Already in `docs/design-system/`. No token edit |
| 2 | Company-role student-row sweep | On main. All 64 owner-keyed tables probed (`D-1298`). One read still to narrow |
| 3 | Free-text scan | Not built. `D-1298` |
| 4 | Remaining stream 01 list: staff-named owner columns, storage buckets, provenance and consequence ports | Open. Fifteen owner-column names are swept (`D-1303`). A blanket anon revoke of `private` is not done. Leave and approve-join use `ActionPreview`. |
| 5–18 | Student OS through release evidence | Term Plan is the Registration planner (`yes`). Four named screens in `SCREEN-PACKS.md` still have no production route |

## Definition of complete, not met

57 catalog screens and 75 workflow steps are missing. External gates (institutional UAT, legal review, live connectors, staffing, restore drills, HawkScan) stay open. This document does not say the system is integrated.
