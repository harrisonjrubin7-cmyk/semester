> In this design project `code/semester-lab.js` and `source/registry-source.js` end in `.txt` so the design-system bundler skips them. Before `node --test tests/core.test.cjs`, rename them back: `mv code/semester-lab.js.txt code/semester-lab.js; mv source/registry-source.js.txt source/registry-source.js`.

# Semester 122-capability completion package — 2026-10-13
## Delivered
All 122 requested keys were extracted from the uploaded HTML, not reconstructed from memory. The self-contained workbench preserves the original bundled design and adds searchable capability specifications, dependencies, contracts, local review notes, JSON export, print, seven presentation states and a 14-check synthetic controlled-action simulator.

Counts: public 10; shared 13; edu 26; inst 21; acct 4; company 25; ops 20; dev 3.
Each capability has a bespoke goal and authority boundary, source routes/actors/permissions/records/commands/events, proposed owner, connected workflow and 11 acceptance criteria.

## Completion means
Specification coverage and local review tooling are delivered. All live implementation, database, integration, deployment, approval and production-enabled maturity facts remain unknown until reconciled against exact evidence. Production activation is disabled. The local simulator performs no external domain writes. It is not authentication, authorization infrastructure or a working backend for all capabilities.

## Run
Open the self-contained workbench HTML in a browser. Do not enter student records, credentials or sensitive financial data in browser notes.
Run code tests from the package root: node --test tests/core.test.cjs
No npm dependencies are needed for those tests. Browser smoke reports were produced with Playwright/Chromium in the generation environment; a reproducible browser runner is included, but Playwright/Chromium are optional external development dependencies and are not bundled.

## Source caveats
The original registry explicitly leaves implemented/tested/deployed false pending evidence. It derives data/backend matches from a design catalog. We extracted 235 table definitions and 120 function definitions from that catalog; this is not proof of deployed tables or functions.
58 distinct declared command names (60 appearances) and 1 distinct record name did not match that catalog. They require alias/adapter/implementation reconciliation, not an automatic missing-code conclusion. No reference SQL migrations were applied.

## Verified here
362 Node tests passed. Chromium rendered 122 capability detail views and 854 state presentations at mobile width with no document overflow or page errors. Additional smoke checks exercised filtering, hash navigation, local-note persistence, dark theme, authorized synthetic check, self-approval rejection and unavailable-state wording.
The first browser smoke test found mobile overflow; CSS was corrected and both smoke suites rerun successfully. Full AT/keyboard audit, semantic accessibility review, real integration tests, security assessment, legal review, provider checks and live deployment tests were not performed.
The original design's preservation is verified by bytes/hash; all original nested interactions were not exhaustively exercised.

## Integration
Read execution/INTEGRATION-PLAN.md and project mainframe instructions. Reconcile into canonical existing systems. Do not create a second production registry, duplicate role model or mass apply reference migrations. New package paths are proposed deliverables, not discovered production repository paths.
No external systems were modified in creating this package.
