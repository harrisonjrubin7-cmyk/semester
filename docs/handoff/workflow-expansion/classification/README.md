# Gap classification (14 Oct)

Your four CSVs, filed unchanged, plus `proposed_surface_matches.csv`.

## The headline: the "84 steps without a screen" finding is out of date
The Oct 5 gap register counted 84 workflow steps with no screen. Since then the gap-screens kit added exactly 84 screens to the master catalog (`CATALOG.addedScreens`), one per step and named after it. Matching the 45 steps you classed **U** (user interaction) or **H** (hybrid) against the current catalog: 43 hit a same-named screen, 2 a close match. So those steps need **linking**, not new UI.

What the classification still changes:
- **B — background (17):** don't need their own screen. The 17 gap screens built for them should become a job/control status panel inside an existing operations or console view, not stand-alone pages.
- **O — operational milestone (22):** belong in the operations/launch workspace as checklist items with owner and evidence — already how the launch sequence screens work (champion, reconciliation, training, gate). The two runner corrections I made earlier (Admin training, Launch readiness gate) point there too.
- **U and H (45):** link the step to the screen in `proposed_surface_matches.csv`; H steps also need the executor (job, adapter or command) linked, which no design file proves exists.

## Screens no workflow references (419)
Your classification marks all 419 "map to an existing workflow; don't create a duplicate". Counts by function: 118 domain actions, 102 operational configuration/decisions, 62 public information, 37 operational evidence, 22 discovery, 20 exceptions, 17 read models, 14 public trust intake, 11 acquisition, 10 preferences/privacy, 3 identity, 3 external handoff. Category totals (A–N) sum to 419 and every screen exists in the catalog.

## Roles without a workflow (13)
All 13 are in the catalog's role list, so no new roles. Each has a proposed flow type, happy path and recovery in `role_gap_flows.csv`. Most are variants of an existing flow (online, adult, graduate, international, athlete, worker, caregiver students → student loop with extra constraints), so add them as variants on the existing student workflow, not separate apps. Prospective student, applicant and admissions staff need the admissions flow (register row PROP-WF-016), which today exists only as catalog screens.

## Done (14 Oct)
1. **45 U/H links applied** in `ui_kits/workflow-runner/runner-data.js` (`RUNNER.stepScreen`).
2. **17 background steps → host views:** `background_step_panels.csv` names the existing view that shows each step's status, last run, failure and owner. The 17 stand-alone gap screens stay in the catalog as references but shouldn't ship as pages.
3. **13 roles → parent workflows:** `role_variants.csv`. Three (prospective student, applicant, admissions staff) need the new admissions flow PROP-WF-016; the other ten are variants of existing register rows.
