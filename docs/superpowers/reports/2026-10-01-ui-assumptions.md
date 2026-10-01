# Task 2 — real assumption editing across planning domains

Review base: `f0cb1f0aedde35e2121780b6c2aa9470a79b8271`.
Branch: `codex/ui-standards-20261001`.
Final source checkpoint: c711ac48617698eefcb2c5d3341701e330035d2c.

This is a reconstructed report from restored source and fresh verification. The runtime lost the earlier unpublished report at `aec20e6`; this document does not claim that report's byte identity or continued availability. The controller restored the original `1d083e5` source as connector-authored `41735e86496040ba9c199927e655e46fbe19051d`, preserving the original review base. All continuation work stayed in the restored isolated worktree. No worker publication, external message, production mutation, branch reset, dependency addition or quality-limit change occurred.

## Completion and the native-control ruling

The shared `AssumptionEditor` reads typed domain adapters containing value, owner, source, validation, canonical dependent outcomes and an explicit apply callback. Drafts remain in component memory. Preview executes existing calculations; Cancel discards the draft; Apply writes through the existing validated library or reducer. Institution-owned assumptions have visibly disabled edit controls and apply-time ownership guards. Unknown costs, unavailable finish dates, missing evidence and unsupported links stay unknown.

The earlier direct-update boundary is **closed for the planning assumptions exposed by these adapters**. Native controls for those same fields now open and focus the shared proposed-value editor, with current and proposed calculations visible before confirmation. Their change handlers do not persist the proposal. Cancel/Apply restore focus to the original connected control. Already-drafted degree requirement and commute forms instead display the same shared before/after outcome presentation above their existing Save action; both support cancellation. Reset-to-saved-preferences is staged too.

This follows the controller's explicit ruling: preserving usable controls does not require preserving immediate mutation. Actual record creation/correction and unrelated controls were not converted into a universal confirmation system. The distinction is enumerated below; this report does not claim all CRUD across Semester is staged.

## Domain input inventory and actual connections

| Domain and recorded inputs | Shared adapter / consumer | Canonical preview and apply | Native path covered |
| --- | --- | --- | --- |
| Degree requirements: programme/name, courses-or-hours, count, accepted course codes, notes; transcript records supply completed/current hours | `DegreeAssumptions.tsx`, lazy in Degree → Requirements | `progress`, `progressLine`, `readAccepts` over actual `state.taken`; `patchRequirement` | Existing requirement edit form previews current/proposed progress before Save, including changed count/accepted codes and its combined unit choice. Cancel preserves the record. Owner/term/record keys discard drafts. |
| Graduation current plan: degree credits, fall/spring credits, summer credits, next season/year, cost per fall/spring and summer; completed credits come from Taken | `graduationAssumptions`, `GraduationSimulator` | Existing `project`, `termLabel`; validated graduation library `setPlan` | All seven original input/select paths open the shared draft. Non-itemized cost fields use the same adapters. Missing cost remains unknown; completed credits are distinct from an unreachable finish. |
| Graduation scenarios: extra credits, term/summer loads, terms abroad, expected transfer credit and nullable abroad cost override | `scenarioAssumptions`, every scenario card | `project(plan, done, scenario)`; existing scenario library update | Original scenario/abroad fields stage the same edits. Blank abroad cost preserves the canonical inherit-normal-term meaning and is previewable. Scenario IDs and owner scopes bind the draft. |
| Graduation itemized costs: amount, label, term/summer classification, source, copied-from/date | `costLineAssumptions`, `CostPlanner` | Existing `totals`; graduation supplies `project` outcomes through `graduationOutcomes`; `setCostLines` retains `startItemising` and validation | Original amount input opens the shared draft; no total changes before Apply. An edited imported personal copy becomes student-entered while its original copied source/date remain intact. Classification/source record corrections and add/remove remain their existing workflows. |
| Out-of-pocket purchases: amount, course, term, kind, rental and return records | `outOfPocketAssumptions`, Costs → Out of pocket | Existing `total`, `money`; existing `patchCost`, integer cents | Shared amount editor stages updates. There was no pre-existing direct amount-edit control to reroute. Purchase creation, actual return proceeds, rental and deletion remain record workflows. |
| Bill: copied charges, aid and payments; personal installment count, first date and month spacing | `billAssumptions`, Bill → The plan | Existing `billFor` including `owed`/`schedule`; existing `setPlan` | Original installment select and first-date input stage canonical schedule previews. No payment, aid, receipt or settlement mutation is exposed. Institution/provider account controls are unchanged. |
| Career: target roles/locations; entered/imported listings provide actual title, kind, skills, location/country | `careerAssumptions`, Career → Discover and Résumé | Existing `targetScore` order over the actual library; existing `readCareer` owner+term library update | Original target-role/location inputs stage preview/cancel/apply. The existing Discover ordering toggle remains functional. The output says matching terms, not eligibility or hiring probability; no listings means unknown order. |
| Productivity decisions: assumptions with owner/source/review/impact prose; weighted criteria and recorded fit/source-check evidence | `decisionAssumptions`, Productivity → Decide; original assumption draft and saved-preference reset | Existing `withAssumption`, `supportedFit`, `currentEvidence`; `withPreferences` shares the same canonical evidence invalidation helper | Existing assumption drafts now preview canonical outcomes before scenario save. Reset-to-preferences previews before Apply, preserves institutional entries and rejects concurrent decision changes. Recorded numeric fit does not change just because source checks need review; the UI states both facts. |
| Workload: window weekdays/start/end, sleep-floor enabled/start/end, protected-rest weekdays/start/end, weekly school contract, heavy-day threshold; actual deadlines/timed work/commitments/appointments/athletics supply context | `WorkloadAssumptions`, lazy entry from WorkWindows and lazy native-change previews | The existing reducer normalizes proposed input, followed by `weekCapacity`, `verdict`, `week`, `clashes`; `forecast` consumes actual spent-time samples. Apply uses `setDayBudget`, `setContract`, `setFloor`, `patchWindow`, `patchRest` | Original WorkWindows weekday/time controls, Capacity contract/floor buttons/rest weekday/time controls, and DayBudget step buttons all stage. Name edits and actual add/remove record controls remain native. Syllabus-credit entries display the actual course source and stay locked. |
| Commute: weekdays and minutes each way; other week inputs are the existing context above | `balanceAssumptions`, `LifeBalance` | One `balanceOutcomes` helper calls existing `summarizeWeek`/`workloadPressure`; validated `saveSettings`/`readSettings` | Original CommuteForm remains a local multi-field draft, now showing canonical current/proposed commute/open hours before Save and offering Cancel. No timing evidence produces an unknown workload estimate. |
| Study abroad: planned program credits, nullable personal cost/currency/source URL, matched-course review records | `abroadAssumptions`, selected `StudyAbroad` program | Existing `creditPicture`/`creditLine`; existing validated `setProgram` | Original planned-credit and cost controls stage. No dependent total-cost/aid calculator exists for the recorded program-cost value, and the preview explicitly says so. Approval records, visa decisions, currency conversion and official transfer are not invented or changed. |

### Source records and unsupported calculations

- Transcript rows, time logs, appointments, commitments, athletic events and application deadlines remain factual records consumed by the existing calculators. Shared assumption edits do not create completed work or actual events.
- Imported/source course content, including timetable, deadlines, grading metadata and catalog `planMinutes`, is not rewritten as a personal preference. The existing `studyAsked`, runway and booking calculations keep their original input paths.
- Exam-scope/source overrides, Student Access lead-time workflows, course-content correction and unrelated assistant-tool proposals were not replaced. The native-control inventory for the exposed fields was checked by searching actual reducer action and adapter field usages.
- Requirement/transcript creation, cost-line metadata correction, purchases/returns, opportunity records and matched-course approval records retain their existing record-entry workflows. Their existence does not justify inventing institutional approval or source verification.
- Free-text productivity impact links do not establish a real connection to a specific course, degree program or opportunity. Preview uses the existing decision fit/source-check behavior, not fabricated cross-domain effects.
- No formula estimates aid, hiring chances, course sequencing, institution eligibility or undocumented official deadlines. No hypothetical preference change sends a message, registers, pays, approves or publishes.

## Shared editor behavior, privacy and provenance

- `AssumptionAdapter` and typed factories use existing domain types (`Plan`, `Scenario`, `CareerLibrary`, `CostLine`, `Decision`, `State`/`Action`, bill/abroad/balance types). There is no second calculator and no new preference persistence store.
- `useNativeAssumptions` and the lazy workload equivalent stage a native edit in the shared `AssumptionRow`. A focused proposed-value control accepts further typing; changing it requires preview again. Invalid values/ranges/steps cannot apply. Original source controls remain present and functional.
- Draft requests include owner/context and original identity/value/source. Native drafts are cleared when their scope or target signature changes. Workload scopes include owner, term, selected course/guide and relevant original settings, including while the editor module is still loading. A discarded pending request does not revive after returning to the previous context. The complete graduation simulator remounts on account change, clearing its shared/native drafts, comparison state and pending cloud confirmation.
- Degree requirement drafts are keyed by owner/term/record. Commute drafts are keyed by owner/week/settings. Study-abroad drafts are keyed by owner/program. Career retains its owner+term workspace lifecycle.
- A quota failure or invalid library write preserves the original stored data and leaves an error. Reset-to-preferences checks its original decision snapshot inside the canonical latest-record update, so an intervening change cannot be overwritten by the older preview.
- Institution-owned productivity assumptions cannot be edited or overwritten. Personal edits preserve owner/source/review/impact metadata; changed assumptions invalidate source-check dates through one shared canonical helper. Reset preserves institutional records and applies saved preferences as personal choices.
- A changed imported personal cost estimate does not claim the school published the new value. It is marked student-entered while the original copied source/date are retained.

### Owner-scoped graduation and commute storage

Graduation and commute previously had device-global keys. Signed-owner reads/writes now use `graduationKey` and `lifeBalanceKey`. Unsigned use retains the original device keys. `AdvisorMeeting`, `useLifeBalance` and workspace backup use those same canonical key functions. Backup tests verify each owner receives only their own graduation/commute data, while unsigned legacy data remains available unsigned.

No legacy data was deleted or silently copied into a signed-in account. A signed-in user who previously relied on the device key sees a separate account plan/settings. The original remains available unsigned and can be explicitly reviewed/exported/restored through existing backup controls. This deliberate privacy migration is a real behavior change, not a claim that old shared records have a known account owner.

## Compatibility and performance

Task 1's typed `HumanTable`/`RecordTable`, native table controls, safe preference allowlists and session-only sensitive filters were not changed. StudyAbroad keeps its existing typed comparison table. The Degree graduation lazy boundary remains. Degree assumptions and the full workload editor also remain lazy.

A continuation build initially measured Pathway at 26.3 KB against its unchanged 26.0 KB route limit. Its hidden StudyAbroad tab now has a lazy/Suspense boundary. Pathway and table tests pass, and the unchanged bundle checks pass. No budget was raised and no dependency was added.

## Verification evidence

Final checks ran in the isolated worktree's `app` directory unless stated otherwise. Final implementation was checked at `c711ac48617698eefcb2c5d3341701e330035d2c`; the subsequent report-only commit does not change source behavior.

Covering command:

```sh
npm test -- src/components/AssumptionEditor.integration.test.tsx src/components/WorkloadAssumptionsEntry.test.tsx src/components/GraduationSimulator.test.tsx src/components/GraduationSimulator.phase-d.test.tsx src/components/AdvisorMeeting.test.tsx src/components/ProductivityWorkspace.test.tsx src/components/StudyAbroad.test.tsx src/components/LifeBalance.test.tsx src/screens/career.test.tsx src/screens/pathway.test.tsx src/screens/pathwaygrid.test.tsx src/lib/graduation.test.ts src/lib/cost-plan.test.ts src/lib/productivity.test.ts src/lib/rest.test.ts src/lib/clash.test.ts src/lib/ahead.test.ts src/lib/workspace-backup.test.ts src/lib/bill.test.ts src/lib/degree.test.ts src/lib/abroad.test.ts src/lib/life-balance.test.ts src/lib/windows.test.ts
```

Final result:

```text
Test Files  23 passed (23)
Tests       374 passed (374)
```

The integration file contains 21 actual-domain tests. Twelve original tests cover shared graduation/cost preview and cancellation, account isolation, actual course/week capacity and term isolation, degree progress, career ordering, source retention and institution locks, bill schedules without payment writes, invalid/quota failures, unknown costs/pending account confirmation, selected abroad programs and commute calculations. Nine continuation tests cover the actual native-control paths enumerated in the table, plus preference reset. Tests assert unchanged canonical storage/state before Apply and after Cancel, actual changed domain outcomes after Apply, native focus transfer/restoration, context switches and the reset concurrency guard. Existing graduation/abroad native tests now explicitly confirm the preview rather than expecting immediate mutation. A separate deferred-module regression holds the workload lazy import pending while owner/term/course/original-setting contexts change, verifies no stale editor appears after loading or after returning to the old context, and confirms a fresh request still works. Actual workload native integration also switches the selected course and term while retaining the same saved contract value. Two backup tests cover graduation/commute owner isolation.

Other commands:

```sh
npm exec tsc -- -b --pretty false
npm run build
npm run lint
npm run budgets
git diff --check
```

- TypeScript: passed directly at the coherent staging checkpoint and again as the first step of the final production build.
- Build (`tsc -b && vite build`): exit 0. `3423 modules transformed`; `built in 1.68s`.
- Lint: exit 0 under unchanged `oxlint --max-warnings=25 src`. Final output has 23 warning lines on files outside this task's changed-file set. Style, accessible-label and terminology checks pass. No blanket warning cleanup or threshold change.
- Budgets: exit 0. `first load 435.1 KB of 479.0 KB; largest file assets/elk-276RUBZZ-DmtPYJkm.js 435.7 KB of 480.0 KB; 93 routes`; `budgets ok`.
- `git diff --check`: exit 0 with no output.

Non-failing existing notices remain: npm's `http-proxy` configuration warning, Vite's generic >500 kB warning, and jsdom's `Not implemented: navigation to another Document`. Actual configured bundle limits pass. This does not resolve or reclassify the controller's separately deferred baseline-warning item.

The final whole-branch approximately 19k-test suite/CI belongs to the controller's integration pass; it was not repeatedly run here. No static-site, live-production, RLS, browser device-matrix or independent assistive-technology acceptance is claimed.

## Self-review, corrections and commits

- Original coherent source checkpoints were `80b720e` and `1d083e5`, durably mirrored by the controller. Restoration resumed from `41735e86496040ba9c199927e655e46fbe19051d`; no worker reset/rebase or new branch occurred.
- `e656e1a6`: native assumption paths moved to canonical staged previews; existing degree/commute draft forms gained calculated before/after outcomes; preference reset became staged.
- `2fb11707`: native-path regressions, safe preview invalidation, preference-reset concurrency protection and the hidden StudyAbroad lazy boundary.
- `c711ac48617698eefcb2c5d3341701e330035d2c`: final native focus restoration, selected course/guide draft invalidation, deferred-module race coverage and additional concurrency verification.
- This report is a subsequent documentation-only commit. It replaces the lost report with current source/evidence; it is not a claim to have recovered the original unpublished bytes.

Concrete self-review corrections across the task:

1. Recorded productivity fit values remain numerically unchanged when source checks are invalidated; the adapter reports that distinction rather than fabricating a score change.
2. Owner scoping had to include AdvisorMeeting and backup, not just the editor. Both use the canonical graduation key, and commute consumers/backups share their canonical key.
3. Account changes must clear pending cloud confirmation even when values match. The entire simulator is owner-keyed.
4. Imported cost provenance must not endorse the edited number. The edited value becomes student-entered while original copied provenance remains.
5. Integer/half-hour fields reject incompatible steps so displayed proposals match canonical normalization.
6. Study-abroad and commute are separate real calculator inputs and are explicitly connected.
7. The initial native direct-update interpretation did not meet the task. Continuation closed that boundary for the adapter-exposed assumption fields, with actual native/cancel/apply tests. No waiver is claimed.
8. Native cancellation must return keyboard focus to the original control, and a saved-preference preview must not overwrite a concurrent decision edit. Both are implemented and tested.
9. Lazy native requests must be invalidated before the module resolves, not merely after the editor mounts. The pending-request scope guard and deferred-module regression cover this boundary, and workload scopes now include selected course/guide as well as owner/term/settings.
10. Route growth was measured and fixed with a lazy boundary rather than raised limits.

A new integration assertion initially used `go` to simulate selected-course navigation, but that action changes `guideId`. The test was corrected to the canonical `openCourse` action, and scope invalidation covers both `courseId` and `guideId`. The final covering run above passed.

Remaining limitations are genuine calculator/source limitations, deliberate non-migration of unsigned legacy data and independent production/accessibility acceptance. The native assumption-staging concern is closed. There is no known failing required check, changed quality limit or unreported invented numeric impact.
