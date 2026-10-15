# Company OS registers (uploaded 14 Oct)

Filed unchanged. Seven CSVs; all marked proposals — no KPI figures, hires, agreements or implementation are asserted.

| File | Rows | What it adds |
|---|---|---|
| verified_console_workspace_inventory.csv | 18 | **Repo-read** console workspaces at commit `fb51d66` (`app/src/lib/console/workspaces.ts`): command, support, approvals, breakglass, audit, tenant-operations, privacy, integration-health, release-incidents, customers, figures, finance, ecosystem, releases, launch, controls, evidence, views. Discoverability only — each server read/action authorizes itself. Tests/deployment not verified. |
| company_os_ten_layer_map.csv | 10 | L01–L10 taxonomy over those workspaces (proposed, not recovered) |
| company_os_feature_screen_phase_map.csv | 72 | feature → existing workspace candidate → surface → workflow → owner → phase → activation evidence |
| company_functions_owners_workflows_kpis.csv | 15 | functions with proposed owners — today "Founder + qualified counsel/accountant" or "Founder → [seat]" |
| company_workflow_swimlanes_legal_gates.csv | 48 | deal, renewal, hiring, vendor, partner, research steps with gates; every legal path is a checklist, **not** a signed agreement |
| full_catalog_continuation_register.csv | 93 | 91 "reconcile then extend existing workflow", 2 "archive; extend current successor" |
| component_pattern_acceptance_matrix.csv | 33 | component acceptance: region states, visual contract (glyph + word, Ink/Parchment, target sizes) — specification, not verified |

## How it connects
- **Reuse, don't rebuild.** 91 of 93 catalog groups map onto existing repo workflows; the 18 console workspaces are the shell for company and operations screens. This matches the pilot command-center decision (six queues inside the existing console) — add them as views, not a new app.
- **Owners:** every function is founder-held today. Hiring follows `platform-ops/docs/company/hiring-triggers.yaml`; the readiness owners in `DECISIONS-2026-10-14.md` (Harrison + contractor + security advisor) are the only named people so far.
- **Legal gates:** the swimlanes' "binding warning" matches `commercial-trust/registry/legal/legal-workstreams.yaml` — a checklist is not an executed agreement.
- **Components:** the 33-row acceptance matrix is the per-component checklist for the design system's `@dsCard` components; the design system already ships most of these names (MetricTile, DataTable, DecisionTrail, SupportHandoff, ApprovalBanner, ActionPreview…). Use it as the definition of done when those components are implemented in the repo.

## Next
Map the pilot's six command-center queues onto these workspace ids (support_handoffs → support · readiness_needs_review → command · reconciliation_cases → evidence · connector_failures → integration-health · security_and_access_alerts → breakglass/audit · release_and_configuration_changes → releases) and record it in `sprint-pilot-001/registry/operations/pilot-command-center.yaml`.

## Second batch (14 Oct)
| File | Rows | Fits with |
|---|---|---|
| sixteen_week_and_ninety_day_execution_plan.csv | 16 weeks from 2026-10-14 | "proposed window, not a committed schedule; a date never waives evidence" — same rule as `platform-ops/docs/strategy/90-day-plan.yaml`. Week 1 (inventory + assign seats) is partly done: production project, readiness owners, catalog ids. |
| pilot_activation_checklist.csv | 20 gates PROP-PILOT-01…, all Unverified | the same gate as `commercial-trust/evidence/pilot/activation-gate.yaml` (21 items) and `pilot-operating-plan/evidence/releases/REL-READINESS-001.yaml` (15 evidence ids). Treat REL-READINESS-001 as the one record; these gate ids are its checklist. |
| company_os_risk_register.csv | 11 | operational risks for the company OS (e.g. prototype mistaken for product, operator sees student data); feeds the investor portal risk tab — none scored without evidence |
| investor_board_permission_matrix.csv | 6 audiences | matches the investor portal's audience model (board, investor, diligence, observer, preparer, publisher): named recipient, purpose, scope, expiry, download rule, revocation |
| monthly_package_schema_checks.csv | 5 local cases, all passed | schema-only; no immutable storage or permission proof |

**One activation record:** three files now describe the pilot gate. REL-READINESS-001 is canonical; PROP-PILOT-01…20 and the 21-item gate list are views of it — don't track them separately.

## Continuation pack (14 Oct) — spec, contracts, deck and video specs
Added: `company_os_continuation_specification.md` (the narrative behind every CSV here), `company_os_shared_contracts.json` (status / work_item / document / metric / activation shapes), `monthly_disclosure_package.schema.json`, `deck_slide_specifications.csv` (36 slides), `demo_video_storyboards.csv` (10 scenes). The other 12 files in the pack are identical to the ones already filed.

Directives from the spec that change how the repo work is done:
- **Extend the existing Console**, don't build a second app. Business = planning view, Operations = owned actions and exceptions, investor/board = scoped read-only disclosure, Master Control = registry and evidence hub (not a super-admin API).
- **`Me.tsx` already opens Semester Operations** when the user holds a console capability — no duplicate entry point.
- **Navigation is discoverability, not authorization** (`visibleConsoleWorkspaces`); every server read/action authorizes itself.
- **The Finance tab mounts `FinancialModel`** — don't read it as a live bank or ledger feed.
- **Four inventories, not competing counts:** 15 company functions · 9 native-ops domain consoles · 18 repo console workspaces · 10 proposed layers.
- **The v1 investor prototype's pilot, traction and entity examples are hard-coded** and prove nothing; the governed investor portal (`ui_kits/investor-portal`, all figures labelled sample) is the target.
- **Deck and video specs are outlines only:** every slide needs an exact evidence binding and legal/claims review; the storyboards use synthetic labels and have no rendered video.
