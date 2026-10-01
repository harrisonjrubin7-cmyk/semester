## Spec Compliance

- ❌ Issues found. The shared contract and all 31 inventoried integrations are present, but sensitive cell values are persisted as filter preferences (I1), the integration dashboard gains a download path broader than its existing export projection (I2), and valid dynamic column IDs can break table rendering/filtering (I3). These violate the requirements to avoid sensitive contents in preferences, preserve privacy/export boundaries, and keep eligible tables functional.
- ⚠️ Cannot verify from this diff: completeness of the inventory against every unchanged application surface; the controller should retain/check the reported inventory search evidence. Each eligible surface listed in the report has a corresponding adapter in the diff. Exclusion purposes are plausible, but the unchanged excluded files were not independently crawled.
- ⚠️ Cannot verify from this diff: independent browser/assistive-technology acceptance, production RLS behavior, or exact remote checkpoint alignment. The implementation report explicitly does not claim the first two; remote publication verification remains the controller’s task. Reported tests/build/lint/budgets were read, not rerun.

## Strengths

- `app/src/components/HumanTable.tsx:10-35`, `app/src/components/HumanTable.tsx:289-320`: typed value/render accessors preserve the original React controls without DOM interception, reflection over record fields, or HTML reconstruction. Search, cards, summary and CSV operate on the supplied columns/rows.
- `app/src/components/HumanTable.tsx:39-44`, `app/src/components/institutional/RecordLedger.tsx:503-508`, `app/src/components/gradebook/StudentGrades.tsx:238-240`: explicit owner remounts reset ephemeral state as well as preference keys on account changes in the covered institutional/gradebook workflows.
- `app/src/components/HumanTable.tsx:96-106`, `app/src/components/HumanTable.tsx:235-282`: semantic captions, scoped table headers, named articles, definition lists and native disclosures provide accessible alternatives without removing supporting detail.
- `app/src/lib/human-table.ts:50-59`, `app/src/components/HumanTable.tsx:201-218`: the shared CSV uses the existing encoder, additionally neutralizes formula prefixes after whitespace/control characters, exports the filtered rows, and labels the result as a working view.
- `app/src/components/CourseDetailV2.test.tsx:272-310`, `app/src/components/institutional/RecordLedger.test.tsx:321-342`, `app/src/components/gradebook/human-views.test.tsx:67-107`: meaningful integration interactions exercise registration cancellation, read/propose boundaries, released-only student projection, regrade cancellation and draft edit retention. The controls remain real component controls, with service boundaries mocked.
- `app/src/components/institutional/CampaignManager.tsx:499-502`, `app/src/components/toolkit/DataPanel.tsx:239-240`, `app/src/components/institutional/MigrationCenter.tsx:773-774`, `app/src/components/gradebook/InstructorBook.tsx:374-375`: suppression text and several existing export restrictions were deliberately retained in the adapters.

## Issues

### Critical (Must Fix)

- None identified in this task-scoped review.

### Important (Should Fix)

**I1 — Sensitive record contents are copied into persistent preferences through the generic filters.**

- Evidence: `app/src/components/HumanTable.tsx:123-145` derives exact filter choices from every column by default, assigns the selected complete cell string to `criteria.filters`, and `app/src/components/HumanTable.tsx:77-79` immediately writes it. `app/src/components/HumanTable.tsx:170-172` copies those criteria into named views. `app/src/lib/human-table.ts:32-38` validates length/type but preserves the strings verbatim.
- Concrete affected surfaces: `app/src/components/institutional/MigrationCenter.tsx:778-786` supplies arbitrary mapped sample fields as default-filterable columns; `app/src/components/gradebook/InstructorBook.tsx:384-389` makes the draft score/comment columns default-filterable, with draft text explicitly included in their values at `InstructorBook.tsx:469-476`. Selecting a sample identifier or draft-comment filter persists its literal contents even though the generic CSV is disabled. Selecting filters in multiple columns can persist much of a sensitive row. No Save view click is necessary.
- Impact: contradicts Task 1’s “without copying sensitive row contents into preferences” and the UI claim at `HumanTable.tsx:158` that record contents are not saved. A later dataset under the same table/owner can still display a stale sensitive filter via `HumanTable.tsx:140-141`, even when that value is absent from the currently supplied rows. Owner namespacing and backup exclusion do not prevent this retention.
- Fix: make persistence/filterability an explicit per-column or per-surface policy. Use safe categorical criteria for institutional data; keep sensitive/free-text filters transient where needed, and remove or migrate previously persisted disallowed values. Add integration tests selecting an actual draft-comment/sample-value filter, inspecting stored bytes and remounting with a different authorized dataset. Search persistence also needs a conscious policy for classified surfaces.

**I2 — Integration working exports bypass the existing restricted export projection.**

- Evidence: `app/src/components/institutional/IntegrationDashboard.tsx:459-482` adapts sync runs with their `public_id` as an exportable cell and provides no export gate. The connection and mapping adapters similarly expose the full displayed text (`IntegrationDashboard.tsx:313-343` and `IntegrationDashboard.tsx:390-446`). `app/src/components/HumanTable.tsx:60`, `app/src/components/HumanTable.tsx:201-218` enables working CSV by default and emits every column value.
- Focused unchanged-code check: `app/src/lib/integration/dashboard.ts:222-243` defines the existing export contract as counts/states, with no IDs beyond the connection public ID and no provider messages. The whitelist in `healthSummary` omits run IDs, connection display names and mapping text. `app/src/components/institutional/IntegrationDashboard.test.tsx:72-77` tests that existing projection only; it does not exercise the new downloads.
- Impact: “working view” labeling does not preserve the earlier privacy projection. A user can now download a run ID or arbitrary connection/mapping text that the established export deliberately omitted. Readable data and exportable data were explicitly separate in this task and in the other restricted adapters.
- Fix: keep these working downloads disabled with an honest reason and preserve the existing safe summary export, or introduce an explicitly authorized sanitized export projection consistent with the existing contract. Test every newly exposed dashboard download against the restricted fields, including sync run IDs and provider-controlled text.

**I3 — Prototype-named dynamic columns break the empty-filter state.**

- Evidence: `app/src/components/HumanTable.tsx:86` reads `criteria.filters[c.id]` without checking that it is an own property. Defaults and validated filter maps are ordinary objects (`app/src/lib/human-table.ts:18`, `app/src/lib/human-table.ts:32`). Dynamic source headings are used directly as column IDs in `app/src/components/institutional/MigrationCenter.tsx:778`; user material titles also become column IDs in `app/src/screens/Pathway.tsx:1140` (the columns expression in the MaterialsGrid adapter).
- Concrete behavior: with a valid column ID `constructor` or `toString`, an empty `{}` filter map returns an inherited function, so every row fails the equality test and “Clear search and filters” cannot restore them. With `__proto__`, the stale-option branch at `HumanTable.tsx:140-141` attempts to render an object as a React child. The setter at `HumanTable.tsx:133-135` also cannot safely represent all arbitrary string keys with ordinary assignment.
- Fix: use own-property checks consistently and safe dictionary writes/null-prototype dictionaries (or a Map), including defaults, parser, setter, select and filter predicate. Add a regression using actual dynamic columns named `constructor`, `toString` and `__proto__`; verify initial rows, clearing, selection, saving and reload.

### Minor (Nice to Have)

- **M1 — Owner-scoping report overstates integration coverage.** `docs/superpowers/reports/2026-10-01-ui-tables.md:13` says institutional preferences are tenant/viewer scoped. The five adapters in `app/src/components/institutional/IntegrationDashboard.tsx:243`, `:314`, `:391`, `:460`, `:524` do not supply a tenant scope; the actual unchanged caller at `app/src/screens/University.tsx:856` renders the dashboard without a provider. `HumanTable.tsx:42` therefore falls back to account scope. Correct the report or explicitly implement the intended dashboard scope. The dashboard currently reads all RLS-visible connections rather than receiving a selected tenant, so this review does not infer a new tenant-data disclosure from namespacing alone.
- **M2 — Reported validation output is not clean.** `docs/superpowers/reports/2026-10-01-ui-tables.md:83-85`, `:102` reports retained build/lint warnings and jsdom canvas/navigation notices. These are described as pre-existing; no task-caused test failure is established. Track/suppress expected test-environment notices narrowly and document the warning baseline so new warnings remain visible.

## Review checks and limits

- Read the brief, binding Global Constraints, full implementation report and reviewer template, then the complete packaged diff in sequential ranges. Narrow portions were reread only because tool output was truncated; no changed source file was independently reread and no git command was run.
- Named risk check: persistent sensitive filter values. Read `app/src/lib/device-library.ts:69-143` to confirm that `prefs.update` validates then serializes the supplied string values to localStorage; it does not strip record-derived filter contents.
- Named risk check: institutional owner scope. Used a focused `rg` for `IntegrationDashboard`/`HumanTableOwner` and read the actual caller at `app/src/screens/University.tsx:800-866`. There is no tenant owner provider around the dashboard invocation.
- Named risk check: integration export broadening. Read the `healthSummary` projection at `app/src/lib/integration/dashboard.ts:222-243` and its privacy test at `app/src/components/institutional/IntegrationDashboard.test.tsx:72-77` after the new unrestricted working CSV raised the specific concern.
- No suite/build/lint rerun: the identified failures follow directly from the changed data flow and property access, and the reported tests do not cover those cases. No source/index/HEAD/branch mutation or publication call was performed. This requested review report is the only written file.

## Assessment

**Task quality: Needs fixes.**

The adapters preserve the original React workflows and the contract has useful semantic and test coverage. The persistence and export privacy gaps, plus the dynamic-key correctness failure, should be resolved before this task is considered complete.
