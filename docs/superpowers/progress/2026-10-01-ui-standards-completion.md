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

Institutional configuration rechecked read-only after release: production lti_platform=0, tenant_sso_policy=0, integration_connections=0. No records/credentials read, no changes made. Real LMS/SSO/provider acceptance remains unavailable; frontend deployment does not close these gates.

Task1 fixround1/5 implementation DONE: local2156f2a source + f5c5e96 report;188 tests/21files, build/lint/unchangedbudgets/diffcheck passed. Controller source+reports saved isolated remote9dc15d6e568e367d03e2c9bca76000c9b84e5abd atopae4d (controllerprogress/reviewdocs preserved). Fresh scoped reviewer/root/review_tables_fix1 running FIX_BASE3798→f5c5e96 on I1,I2,I3,M1; no taskcompletion yet. M2 documented existing25warnings/no fixfile warnings, deferredfinalreview.
Post-baseline-deploy public-production smoke:HTML/module/CSS/PostgREST allHTTP200; exit0.

Task1 fixround1/5 (3 Important + M1 addressed,0open; commits3798e9e..f5c5e96), scopedreview clean. Task1: complete(commits1622e40..f5c5e96,review clean). M2 existing warnings deferred finalreview; no Critical/Important or unverifiable software gap open. IndependentAT/productionRLS notclaimed; native-table inventory checked; remote tasksource tree matched before controller progress/reviewdoc additions.
Task2: pending dispatch after safe remotealignment and mainintegration.

Task 1: fix round 1/5 (3 addressed,0 open; commits3798e9e..f5c5e96).
Task 1: complete (commits1622e40..f5c5e96,review clean).

Task1 local commits preserved backupbranchcodex/ui-standards-local-task1-20261001; local merge8330408 preservedbackupbranchcodex/ui-standards-main-integration-local-20261001. Exactsource verified againstremote before safe clean alignment. Currentmain1be574160ff8fa2c771bb07054c995d8acded28a integrated as connector-authoredmergef0cb1f0aedde35e2121780b6c2aa9470a79b8271; local/remote tree identical and clean. 36 targeted sharedtable/gradebook/media/landmark/accessibility/navigation tests passed after integration.
Task 2: running — implementer /root/ui_assumptions, BASE f0cb1f0aedde35e2121780b6c2aa9470a79b8271. Fresh taskbrief and report-only contract; no workerpublication/helper agents.

Recovery: runtime recycled; source restored from isolated remote41735e86496040ba9c199927e655e46fbe19051d in /workspace/scratch/5f8a60f6a0da/semester/.worktrees/ui-standards. Original unpublished Task2 reportaec20e6 lost; worker must reconstruct report from context/source/final validation. Task1 complete remains authoritative, do not redispatch. Task2 BASEf0cb1f0 remains ancestor; source checkpoints persisted as connector-authored commitsa9b1/41735. Task2 continuation addresses native assumption-edit preview/confirmation before review.

Ruling: The same personal planning assumptions exposed by shared adapters must preview canonical effects before confirmation through native editing paths too; actual record entry/correction and unrelated quick entry retain their existing workflows — Task2 requires preview before confirmation, and preserving functional controls does not require immediate persistence — Cost if wrong: additional staging interaction and rework for affected legacy controls.
Task 2: continuation before review — /root/ui_assumptions, original BASEf0cb1f0, restored HEAD41735e86; native assumption-edit staging and reconstructed report required.

Task 2 native-staging WIP: locale656e1a6bcc29b36274082ace8636f111beede70, compile/diffpassed,17generic sourcefiles savedisolatedremote7bd6a5089cc9cb1fea8df24ddc33f015ae1b381c atopf24controllerledger. Nativepaths route tosharedproposededit; Requirement/Commute forms presentcanonicalbeforeafter andcancel. No finalvalidation/reviewclaimed; workeramendingnative regressiontests/reconstructedreport.

Task 2: implementation complete, review active (BASE f0cb1f0 → HEAD 34e3357d; source c711ac48; 374 tests/23 files, build/lint/budgets pass; remote checkpoint b15929fdd35f8c12f106a1a50be0d3fa67688979; reviewer /root/review_assumptions). Not yet task-complete or released.

Task 2: review round 0 requires changes: I1 résumé fields ignore edits; I2 flag-off itemized-plan cost controls lack adapters; I3 ordinary assumption Apply can overwrite newer decision/institutional records. M1 shared-editor focus continuity included in fix round 1. Reviewer /root/review_assumptions; original implementer /root/ui_assumptions resumed; FIX_BASE 34e3357d.

Task 2: fix round 1 implementation ready (I1/I2/I3/M1 fixed pending rereview; commits 34e3357d..2aac5f2d; 387 tests/23 files/build/lint/budgets pass; remote checkpoint 7c357608ed95b3c727470209a7ce2279ab0fd40c; reviewer /root/review_assumptions_fix1).

Task 2: fix round 1/5 (4 addressed, 1 open — I4 unchanged decision assumption Apply invalidates current source checks/decided despite unchanged preview; commits 34e3357d..2aac5f2d). Round 2 original implementer resumed, FIX_BASE 2aac5f2d. No ruling or waiver.

Task 2: fix round 2 implementation ready (I4 canonical unchanged full-assumption no-op with guards preserved; commits 2aac5f2d..23a78df9; 45 tests/3 files/TypeScript/build/lint/budgets pass; remote151684d838e6edf09914fb96c9a4b291c0bc7283; reviewer /root/review_assumptions_fix2).

Task 2: fix round 2/5 (1 addressed, 0 open — I4 canonical no-op matches preview; commits 2aac5f2d..23a78df9).
Task 2: complete (commits f0cb1f0..23a78df9, review clean after two fix rounds; all I1/I2/I3/I4/M1 addressed). Cannot-verify boundaries resolved as explicit external acceptance limits, not asserted software evidence. No open/parked findings. Source inventory/report covers required domains and genuine unsupported calculations.

Integrated current main fc0b0680 into feature as e9d8aa8595d2dc251c78e28b8881a9f24bc3cd60, exact merge tree 75a460869c19e675373aa37d77ab97f13ea9760e verified. Packaging/governance covering11 tests/2 files pass. Reviewed Task2 local commits preserved in codex/assumptions-local-reviewed-20261001; controller durable reviews/progress are additional docs only.
Task 3: dispatched at BASE e9d8aa8595d2dc251c78e28b8881a9f24bc3cd60, no completed work redispatched.

Task 3: implementer /root/ui_comparisons (gpt-6-astra high) active; inventory includes course shortlist, registration schedules, graduation time/cost scenarios, Pathway cost/material shortlist, abroad comparisons, productivity decisions/history, career opportunities/skills fit. Single-plan assumption previews are not invented comparison candidates. Shared actions must preserve durable actual option identity/context and editable opt-in AdvisorMeeting draft.

Task 3: WIP source859e704238dbf2326299c712641e305121ec0d97 checkpointed remotely128fd75a6de2c2e457dc8ca787d340c43c3a86fa/tree2d014cc91b94b0ef79d31e3799b4222b9c32e1b6. Compile/lint and49 tests/7 files pass; added actual integration/privacy/reload checks still pending. Not reviewed/released. Main now80fc459 (#1103 frontend polish), integrate after Task3 clean review.

Task 3 inventory expansion: OperatingRhythm current-vs-grouped time simulation, Choose uses existing owner/term/mode/date savePlan. Snapshot reflects displayed simulation/task inputs; pending calendar export excluded. Final whole-branch reviewer should assess this surface against assumption/comparison inventory boundaries; Task3 does not add a separate deferred assumption layer here. This is an observation, not a waiver/ruling.

Task 3: source702af24328f23cbf1c34f1723660f82de5128239 checkpointed remote42ce7dde6b63b9c2d57d1c0d80cbc4a6a35e4b02/tree0b8d9c21876ad3f2b1322ba786a5bbac56b95258. 173 tests/19 files, build/lint/budgets pass; first435.6/479KB, largest435.7/480KB,93 routes. Complete report and independent review pending; not released.

Task 3: implementation DONE_WITH_CONCERNS at b19fc857, source11e60c4d; full e9d8aa85→b19fc857 task review active /root/review_comparisons. 177 tests/20 files/build/lint/budgets pass, first435.5/479KB. Separate source/history transactions and legacy device source scope explicit tested observations. Remote1035bb1acaab18980cc9ab3108fe4e5cd88324eb/treedf4e28efe4dd09f306b7a9860d98640730961e4a. Not taskcomplete/released until review.

Task 3: review round0 requires changes, I1 restore drops comparisons; I2 no snapshot deletion/archive; M1 stale career source can silently succeed; M2 dangling live chosen IDs. Legacy personal source-ownership cannot-verify confirmed as real binding gap: signed actions must not silently adopt unknown/other-owner shared-device personal schedules/shortlists/backups. Owner-aware canonical source policy, unsigned legacy retained, no blind migration required in fix round1. Original implementer /root/ui_comparisons resumed, FIX_BASE b19fc857. No waiver/ruling; follows binding ownership constraint.
