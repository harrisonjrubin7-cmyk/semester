# Design-system integration plan

**Refreshed** 2026-10-08 · **Base** `origin/main` `e53128a6` · **Branch** `codex/complete-semester-integration-2026-10-08` · **Archive** `12edfe6ad1c1c02e7c4f0512f1ca4233b0b9f3943b30adde822bd67062867086`

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
| Roles / capabilities / grants | 69 / 96 / 185 | migration-rendered `docs/ROLE-LAUNCH-REGISTER.md`; `docs/ROLE-PERMISSION-MATRIX.md` is the older 84/157 snapshot |
| Repository screen catalog | 589: 260 exists / 272 partial / 57 missing | `docs/master/REPO_AUDIT.md`; status is not re-proved by this file count |
| Repository workflow catalog | 319: 116 exists / 128 partial / 75 missing | `docs/master/REPO_AUDIT.md`; status is not re-proved by this file count |

### Dependency order for the refreshed program

1. **Phase 0:** finish row-level reconciliation for the 281 prototype routes, 122 archive capability rows, 20 blueprint capabilities, 673 archive catalog screens and streams 00–30. Record one allowed disposition per meaningful item and name its production owner or external blocker.
2. **Phases 1–2:** only after Phase 0 identifies a dependency-ready slice, reconcile shared experience first, then identity, tenancy, permissions and controlled actions.
3. **Phases 3–10:** student daily loop; learning/faculty; academic operations; finance/campus; community/career/family/mail; institution integrations; AI; operations/public surfaces.
4. **Phase 11:** cross-device, accessibility, resilience and quality applies to every earlier vertical slice, not as cleanup.
5. **Phase 12:** final coverage, full locally runnable gates and release evidence; deployment and external approvals remain separate.

No production implementation is selected in pass 1 because Phase 0 cannot yet identify every candidate's disposition and dependency. The next dependency-ready slice is the generated row-level prototype/capability reconciliation, beginning with archive streams 00, 18, 25 and the 20-capability blueprint.

## Meaningful-item seed — automation pass 2

[`REFERENCE-MEANINGFUL-ITEM-RECONCILIATION.md`](../docs/design-system/REFERENCE-MEANINGFUL-ITEM-RECONCILIATION.md) gives exactly one disposition to all 20 capability-blueprint rows, six Stream 00 items, all sixteen Stream 18 audit deliverables plus seven role-platform decisions, and all eighteen Stream 25 completion packages plus its seven ecosystem rules and three open decisions.

The seed preserves three boundaries that control subsequent work:

1. Stream 18's requested `docs/roles/*` deliverables are duplicate or superseded by current repository authorities; the role platform they audit is still existing but incomplete.
2. Stream 25's proposed readiness register is duplicate or superseded by current master and finish-line registers; its domain packages are coverage prompts, not a second status system.
3. Of the seed items, P11 graduate/research education is the only row classified missing and in scope. It is not dependency-ready: a domain owner, authority/data contract, role mapping and acceptance path must be reconciled before production work.

`origin/main` advanced after pass 1 only through the migration-version collision repair in `ca0cc9ad`; the current census remains 97 screen-registry keys, 62 navigation destinations, 120 non-test screen files, 407 non-test component files, 1,393 tests, 203 migrations, 17 edge-function directories and 51 non-test gateway handlers. The current migration-rendered role register has 69 roles, 96 capabilities and 185 role-capability rows; the older permission matrix's 84/157 headline is stale. No equivalent blueprint/stream reconciliation landed, so this slice is not duplicate work.

The next Phase 0 slice is the 122-row archive capability registry. It precedes route/catalog mapping because its capability and backend/data claims supply the permission and dependency vocabulary needed to disposition the 281 prototype routes and 673 archive catalog screens.

## Capability-registry reconciliation — automation pass 3

[`REFERENCE-CAPABILITY-REGISTRY-RECONCILIATION.md`](../docs/design-system/REFERENCE-CAPABILITY-REGISTRY-RECONCILIATION.md) now covers all 122 registry rows with exactly one disposition and one of eleven evidence profiles. The profiles bind each row to current role/route/capability authority, tenant and data scope, server operation, audit/recovery/state expectations, tests, dependencies and a release ceiling without adopting the archive's dotted permissions or parallel schemas.

The result is 91 existing but incomplete, 10 prototype only, 2 duplicate or superseded, 18 documentation or roadmap only and 1 intentionally excluded. No row is called existing and verified at the archive row's full combined breadth, and no absent registry row is promoted to missing and in scope from design evidence alone. `edu.marketplace` remains excluded by `D-1287`; developer API concepts remain roadmap-only rather than being silently bundled into that decision.

The next dependency-ready Phase 0 slice is the 281-row prototype route inventory. It must map every archive route to the current hash-route registry, navigation, role/capability evidence, repository catalog row and test or else identify the exact authority gap. Production work is still gated because the 673 archive catalog screens and remaining streams have not yet been reconciled.

## Prototype-route reconciliation — automation pass 4

[`REFERENCE-PROTOTYPE-ROUTE-RECONCILIATION.md`](../docs/design-system/REFERENCE-PROTOTYPE-ROUTE-RECONCILIATION.md) and its generated CSV now cover all 281 unique prototype routes across 26 workspaces. Each row records one disposition, the current P1–P11 evidence profile and owner path, exact app-screen/navigation evidence where applicable, exact normalized repository-catalog matches, capability-register matches and the release boundary.

Results are 62 existing but incomplete, 201 prototype only, 13 documentation or roadmap only and 5 intentionally excluded. No archive route is called existing and verified or missing and in scope merely from design evidence. The five exclusions are the three marketplace-workspace routes plus the two student aliases explicitly labeled campus marketplace/buy-and-sell under `D-1287`. The generator deliberately rejects fuzzy label matches and validates the 281/589/122 source populations before writing the register.

The next Phase 0 slice is the 673-row archive master-catalog screen population. It must preserve the distinction between the archive catalog, the 281 prototype routes and the repository's 589-row audit while mapping exact equivalents, owner/dependency evidence and any currently authorized missing item. The 319 archive workflow steps and remaining streams still follow before production selection.

## Catalog-screen reconciliation — automation pass 5

[`REFERENCE-CATALOG-SCREEN-RECONCILIATION.md`](../docs/design-system/REFERENCE-CATALOG-SCREEN-RECONCILIATION.md) and its generated CSV now cover all 673 archive screen-catalog rows. The archive structure resolves the 673-versus-589 contradiction: each group's first rows exactly equal the current repository catalog in label and order (589 total), while the archive's own `addedScreens` field identifies the remaining 84 as selected workflow-step aliases.

Results are 534 existing but incomplete, 44 missing and in scope, 84 duplicate or superseded workflow aliases, 1 documentation or roadmap only, 4 blocked externally and 6 intentionally excluded. No row is inflated to existing and verified. The two advisor rows previously labeled missing are bounded to the existing student-consented shared-plan analogues; they do not authorize an institution-wide roster or general student profile. The excluded rows preserve current anti-surveillance, academic-authority, community-data, marketplace/directory and employer-isolation boundaries.

The 44 buildable rows are candidates, not a flat queue. Course Studio foundations appear earliest, but the canonical 319 workflow rows and remaining execution streams must still establish cross-row dependencies and acceptance paths before production selection. The next Phase 0 slice is the 319-row workflow reconciliation, including the 84 aliases identified here.

## What was read

- Root `CLAUDE.md`.
- `origin/main` through `e53128a6`; pass 1 began at the supplied `INITIAL_MAIN_SHA` `7b7603e1`, pass 2 reconciled after the migration-version collision repair, and pass 5 merged the clean branch with the current capability-exposure/assistant-safety changes before work.
- Committed handoff: `docs/handoff/` (139 files). `docs/handoff/IN-THIS-REPO.md` and `docs/decisions/D-1287.md` say `ui_kits/`, `templates/`, and fonts are not in the repository.
- Mounted archive entry maps: `readme.md`, `NEXT-SESSION.md`, `handoff/manifest.json`, `START-HERE.md`, `BUILD.md`, `README.md`, the prototype screen inventory/JSON, capability registry, 20-capability blueprint, and execute streams `00` through `30`.
- Archive master-catalog data was parsed as data rather than executed: 49 role rows, 673 screen rows, 319 workflow steps, 88 systems, 82 documents and 84 added screen rows. Its prose also claims 51 roles. All 673 screen rows are now reconciled; the workflow, role, system and document populations remain separate.
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

The source audit still records 57 missing screen rows and 75 missing workflow steps. Pass 5 dispositions those screen rows as 44 missing and in scope, 4 externally blocked, 6 excluded, 1 roadmap-only and 2 consent-bounded existing analogues; it does not rewrite the source audit. Workflow dispositions remain open. External gates (institutional UAT, legal review, live connectors, staffing, restore drills, HawkScan) stay open. This document does not say the system is integrated.
