# SDD ledger — plan: docs/superpowers/plans/2026-10-01-ui-standards-completion.md

Base: 4825d1275d5db2446cda33f07d3aa1c3e351ee92. Isolated worktree and branch verified. The baseline release remains in required CI; local media/layout/deadline tests (21), build and lint passed before this plan.

## Preflight task/interface scan

| Tasks | Producer and consumer / shared area | Finding |
|---|---|---|
| 1, 2 | Planning tables and calculator forms; view preferences versus assumption inputs | Separate namespaces; preserve form controls while adapting views. |
| 1, 3 | DecisionTable/CourseCompare; human row adapters consumed by comparison actions | Reuse table IDs and original controls; do not execute transactions. |
| 1, 4 | Record tables and object links; shared row identity consumed by relationships | Canonical IDs only; preserve object routing. |
| 1, 5 | Preference shape and accessible labels | Independent preference fields; never replace the whole preference object. |
| 2, 3 | Scenario/course/career adapters and snapshots | Comparisons consume canonical assumption context, not a duplicate calculator. |
| 2, 4 | Assumption provenance and dependent object identities | Edges require recorded identifiers, not matching text. |
| 2, 5 | Assumption labels and language preferences | Supported language controls only; source/data content stays intact. |
| 3, 4 | Saved comparison snapshots and relationship navigation | Register actual snapshot IDs; preserve return context. |
| 3, 5 | Privacy previews and accessible menu routing | Shortcuts cannot send advisor drafts or bypass preview. |
| 4, 5 | Accessible relationship list, motion and focus | List is baseline; existing persisted accessibility modes remain authoritative. |

| Task | Internal requirement consistency | Finding |
|---|---|---|
| 1 | Typed real rows, all eligible table inventory, private saved criteria, visible-row working exports | Tests cover persistence, authorization and export semantics; no contradiction. |
| 2 | Shared editor, canonical calculators, preview/cancel and locked school inputs | Tests require real downstream outcomes and no fabricated values; no contradiction. |
| 3 | Personal choose/save and reviewed advisor draft, not official transactions | Tests preserve official next steps and no outbound action; no contradiction. |
| 4 | Actual cross-domain IDs, explicit personal links, accessible object navigation | Tests forbid inferred/cross-user edges; no contradiction. |
| 5 | Actual agenda/language destinations and honest supported-language state | Shortcut scope is distinct from independent acceptance; no contradiction. |

Task 1: running — implementer /root/ui_tables, BASE 1622e4012c05e42de08ebdb6a03efe09ae531fae
Task 2: pending
Task 3: pending
Task 4: pending
Task 5: pending

Release verification: main 8da27a2 has full CI 36927447453 in progress. Read-only production comparison found 164 migrations and 164 main migration files, with no missing versions on either side. Live Pages index-BwE2wu5x.js still lacks the final missing-media-API guard; no final deployment completion claimed. Worker upload was automatically rejected for destination authorization in its isolated context; worker will make no further publication calls. Controller publication requires source review in the original authorized session.

Task 1 WIP checkpoint: local 815a437 reviewed for generic source/no private records, published by controller under existing user authorization to isolated remote 55534923d1ec9bdbdc7150f4cc1eb9dd0a485f2b. No merge/deploy; unvalidated integrations remain local. Connector-authored SHA differs; align only after task completion/publication, not during active implementation.

Task 1 integration checkpoint: local 2946e91 exact tree published to isolated remote 06223194bd0c5d1abb07d5a96c93277d072f61be. 29 generic source/test/config files, no credential patterns or private records observed. Focused 39+21 tests passed; full covering 265 tests/24 files, build and lint subsequently passed. Bundle budget exposed a Degree chunk regression; worker is adding the required lazy boundary without changing limits and adapting a missed derived pivot-result table. Task remains running, not reviewed/complete.

Task 1 refinement checkpoint: local 911d519 exact tree saved on isolated remote 4351404a26822a85f7c593699ecacf36868e1e9b. Final source covers 31 inventoried eligible tables; native mobile comparison controls retained, Degree hidden tab lazy-loaded within original budgets. 315 covering tests/28 files, production/static-site builds, lint and budgets passed. First full suite: 19478 passed/51 skipped, 11 failures in two missing-hook test mocks; fixed HEAD focused51 tests passed, final whole suite pending. No Task1 completion/review claimed.

Baseline final release CI36927447453 for main8da27a2 succeeded:19483 tests passed/51 skipped each4 runs, all browser/accessibility/golden-path/SQL/load/deployment/backup rehearsals passed. Pages36929979768 still running; live index-BwE2wu5x.js lacks finalmediafallback at last observation. Do not equate repository rehearsal with real institutional production recovery acceptance.

Task1 implementation DONE: local3798e9e report-only final, source911d519; full19489 tests passed/51 skipped (1249 files passed/1 skipped),315 covering tests,51 boundary tests,33 baseline/registry tests, build/site/lint/budgets/diff checks passed. Exact final tree durable remote4bcc9d40dbfdfa8e7637abd5df7f7299e0c129e7. Fresh reviewer/root/review_tables running on fullBASE1622→3798e9e package; Task1 not complete until clean spec+quality verdict. No rulings/deferred findings yet.

Baseline deployment confirmed: Pages36929979768 succeeded for main8da27a2; live index-C2MpR85z.js HTTP200 contains typeofwindow.matchMedia guard, contrast token, lazy AccessibilityPanel-CuNbGgv8.js and QuickAdd-cPdY1WOI.js. MainCI all gates succeeded. Isolated table task remains under review; preliminary privacy risk is sensitive exact filter values persisted from draft/sample cells (await full finding before fix dispatch). Main8da adds concurrent landmark changes versus4825; integrate after Task1 review and before Task2 dispatch.

Task1 review: spec❌/qualityNeedsFixes. I1 sensitive record-derived filter/search persistence; I2 IntegrationDashboard working export broader than healthSummary whitelist; I3 inherited/prototype column keys break filtering/rendering. Fixround1/5 dispatched original/root/ui_tables, FIX_BASE3798e9e; no adjudication/ruling. M1 dashboard scope/report optional correction in touched area. Task1 minor(deferred):M2 existing lint/build/jsdom notices documented; no task-caused failure established, finalreview must triage. Controller repeated native-table inventory search: every remaining native table is in the documented20 static/content-editor exclusions or sharedrenderer/printartifact. Independent AT/productionacceptance intentionallyunclaimed.
