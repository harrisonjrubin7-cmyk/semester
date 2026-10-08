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

The 44 buildable rows are candidates, not a flat queue. Course Studio foundations appear earliest, but the canonical 319 workflow rows and remaining execution streams must still establish cross-row dependencies and acceptance paths before production selection.

## Workflow reconciliation — automation pass 6

[`REFERENCE-WORKFLOW-RECONCILIATION.md`](../docs/design-system/REFERENCE-WORKFLOW-RECONCILIATION.md) and its generated CSV cover all 319 canonical workflow steps. The generator proves exact ordered label equality between the archive's 17 flows and the repository audit's 319 unique keys, then validates all 84 catalog-screen aliases against their exact zero-based workflow index. Those aliases remain non-independent projections.

Results are 241 existing but incomplete, 54 missing and in scope, 18 documentation or roadmap only, 2 externally blocked and 4 intentionally excluded. No row is inflated to existing and verified. The developer-platform/marketplace flow remains roadmap-only under `D-1287`; marketplace-commerce steps remain excluded; accommodation approval and a signed sponsor measures sheet remain externally controlled. Buildable advising escalation is bounded to a visible, appealable, relationship-scoped human process with no hidden score or broad roster.

The 54 buildable workflow rows and 44 buildable screen rows are candidates, not additive totals or a flat queue: many describe the same vertical slice. At pass 6, Course Studio was the earliest apparent cluster, but its course-shell, assignment, roster and official-record dependencies still crossed unreconciled execution streams and role/system/document catalogs. Pass 7 closes those three catalog populations; remaining execution-stream dependencies still make production selection premature.

## Role, system and document reconciliation — automation pass 7

[`REFERENCE-ROLE-SYSTEM-DOCUMENT-RECONCILIATION.md`](../docs/design-system/REFERENCE-ROLE-SYSTEM-DOCUMENT-RECONCILIATION.md) and its generated CSV now cover all 49 archive roles, 88 systems and 82 documents. Every row has one disposition, current owner or evidence path, dependency/acceptance contract and release boundary.

Role results are 36 existing but incomplete, 9 duplicate or superseded persona/organization aliases and 4 documentation or roadmap only. No archive label becomes a new authorization role. The existing `graduate_student` role does not complete the separately missing P11 research lifecycle, family access remains a student-created delegated grant, and developer/partner remains roadmap-only under `D-1287`.

System results are 84 existing but incomplete, 1 missing and in scope, 2 documentation or roadmap only and 1 intentionally excluded. Projection/read models are the one newly explicit buildable system gap; current-state evidence records no worker, watermark, registry or rebuild path. It must follow current domain-event/outbox contracts and the remaining stream dependency sequence. Marketplace stays excluded, while developer platform and board/investor reporting remain roadmap-only.

All 82 archive document requirements map to current repository authorities and are duplicate or superseded. That prevents a second document system and does not turn a draft, plan, template or runbook into legal approval, live operation, deployment, assurance or restore evidence.

The next Phase 0 slice is the remaining Stream 00–30 meaningful-item reconciliation and cross-stream dependency graph. It must determine whether projection infrastructure, Course Studio foundations or another shared prerequisite is the earliest safe production slice without treating the 44 screen, 54 workflow and other buildable rows as additive queues.

## Execution-stream reconciliation — automation pass 8

[`REFERENCE-EXECUTION-STREAM-RECONCILIATION.md`](../docs/design-system/REFERENCE-EXECUTION-STREAM-RECONCILIATION.md) now dispositions the remaining novel task, behavior, addendum, gate and implementation-pattern bundles in Streams 00–30. Exact route, screen, workflow, capability, role, system, document and seeded Stream 00/18/25 populations retain their existing row-level registers; repeated archive rules and screen tables are linked rather than counted again.

The cross-stream result also corrects an important timing drift. Projection backlog P1-01 is no longer missing: `20261006130000_projection_foundation.sql` supplies the service-only registry, watermark, invalidation and rebuild tables plus outbox claim columns. P1-02 is also present: `20261008183934_emit_domain_event.sql` supplies the sanitized, idempotent SQL event writer. Both remain incomplete operating paths.

The earliest dependency-ready production slice is now P1-03: server-only claim, complete, fail and approval-gated replay operations over the current outbox and receipt tables, with stale-claim recovery, bounded retry/dead letter, idempotent receipts, audit/capability enforcement and focused SQL red/green proof. It precedes the projector worker, cron, producers, projected tenant/inbox models and operations UI. Course Studio remains the earliest domain cluster after that shared prerequisite; P11 graduate/research education remains non-ready pending an authorized owner and source-of-truth contract.

Phase 0 row reconciliation is complete for the currently identified archive populations and stream bundles. Phase 0 itself remains open until the selected P1-03 slice is checked against new `origin/main` immediately before implementation and its exact acceptance slice is recorded without colliding with concurrent work.

## Projection outbox operations — automation pass 9

`origin/main` advanced during this pass from `e53128a6` to `d9640e45`. The intervening Phase A, HawkScan-source-tag and developer-tooling commits contain no P1-03 functions or migration-version collision. The dirty branch was not rebased or merged. The branch now carries the bounded P1-03 implementation in `20261008190000_projection_outbox_operations.sql`: service-role-only claim, complete and fail transitions; five-minute stale-claim recovery; a 100-row claim cap; deterministic jitter under a fifteen-minute retry ceiling; terminal dead-lettering at attempt eight; idempotent per-consumer receipts; and a dedicated two-person `projection-replay` duty whose execution requires `console:operate`, fresh MFA, an exact event/consumer binding and a fail-closed console audit append. The worker, scheduler, producers, projections, read models and Console UI remain outside this slice.

The focused SQL suite `projection-outbox-operations.check.sql` covers client refusal, service access, due ordering, stale recovery, claim identity, atomic/idempotent completion, bounded retry, dead-letter receipts, approval binding, capability/MFA enforcement, replay idempotency and audit failure rollback. Repository-owned policy/reference registers were regenerated and their focused tests pass. TypeScript build, lint, university gateway typecheck and production build also pass; the full application suite progressed through the repository but ended with unrelated generated-map and timing/worker failures, which are recorded in the status page.

P1-03 is **implemented, database-verified and committed locally**. A disposable PostgreSQL 17 runtime applied all 204 migrations and `supabase/check.sh projection-outbox-operations` passed all six focused checks. An idempotency run reapplied the migration set without changing the schema or any of 368 table fingerprints, then passed the focused checks again. Six focused TypeScript/register files passed 196/196 tests; `tsc -b`, lint and the university gateway typecheck passed, with only the existing lint warning baseline. HawkScan remains unavailable (`hawk runtime=false`, `HAWK_API_KEY=false`), so no DAST result is claimed. P1-04 remains a separate follow-up.

## What was read

- Root `CLAUDE.md`.
- `origin/main` through `e53128a6`; pass 1 began at the supplied `INITIAL_MAIN_SHA` `7b7603e1`, pass 2 reconciled after the migration-version collision repair, and pass 5 merged the clean branch with the current capability-exposure/assistant-safety changes before work.
- Committed handoff: `docs/handoff/` (139 files). `docs/handoff/IN-THIS-REPO.md` and `docs/decisions/D-1287.md` say `ui_kits/`, `templates/`, and fonts are not in the repository.
- Mounted archive entry maps: `readme.md`, `NEXT-SESSION.md`, `handoff/manifest.json`, `START-HERE.md`, `BUILD.md`, `README.md`, the prototype screen inventory/JSON, capability registry, 20-capability blueprint, and execute streams `00` through `30`.
- Archive master-catalog data was parsed as data rather than executed: 49 role rows, 673 screen rows, 319 workflow steps, 88 systems, 82 documents and 84 added screen rows. Its prose also claims 51 roles. All six catalog populations are now reconciled; remaining execution-stream items and cross-stream dependencies stay open.
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

The source audit still records 57 missing screen rows and 75 missing workflow steps. Pass 5 dispositions the screen rows as 44 missing and in scope, 4 externally blocked, 6 excluded, 1 roadmap-only and 2 consent-bounded existing analogues. Pass 6 dispositions all workflow rows as 241 existing incomplete, 54 missing and in scope, 18 roadmap-only, 2 externally blocked and 4 excluded. Neither pass rewrites the source audit. Role, system, document and remaining stream reconciliation stays open. External gates (institutional UAT, legal review, live connectors, staffing, restore drills, HawkScan) stay open. This document does not say the system is integrated.
