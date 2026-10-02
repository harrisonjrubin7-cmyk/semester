# Task 3 — comparison choices and advisor preparation

**Current status after fix round 1 (2026-10-02):** all review findings are corrected and locally verified. The original validation and shared-device-source descriptions below are historical; the fix-round addendum supersedes their ownership, restore and deletion claims. Signed accounts now use separate personal registration source keys, with no unsigned or other-account fallback.

Date: 2026-10-01. Scope: the isolated UI standards branch, based on `e9d8aa8595d2dc251c78e28b8881a9f24bc3cd60`. This is local implementation and test evidence, not institutional acceptance, provider confirmation, publication, or launch approval. No helpers or reviewers were used by this worker.

## Result and shared contract

Nine actual planning comparison surfaces now use the typed `COMPARISON_SURFACES` / `ComparisonActions` contract. Choose records an explicit personal choice; Save both/all preserves separate original candidate contexts; Ask advisor opens an editable, opt-in preview and can prepare an actual AdvisorMeeting agenda. No comparison action registers, applies, pays, publishes, exports a calendar, or sends a message.

The contract lives in `app/src/lib/comparison-actions.ts`, with lazy UI in `ComparisonActions.tsx` / `ComparisonActionsPanel.tsx` and reusable immutable history in `ComparisonHistory.tsx`. `comparison-candidates.ts` explicitly selects applied assumption metadata (`id`, `label`, `value`, `owner`, `source`) and actual imported course facts. It never serializes adapter methods, a pending assumption editor, cloud IDs, or unrelated records.

Each saved comparison has a stable domain/surface, source scope, title, timestamp, explicit chosen candidate ID (or null for all options), and separate candidate IDs, labels and original context. Course labels include section and term; career labels include the recorded organisation where supplied. History remains readable after source records change or disappear, both beside the comparison and in Decisions & productivity.

## Complete applicable inventory

The first inventory covered the eight domain comparisons below other than OperatingRhythm. A subsequent full-tree self-review found the ninth actual time simulation before completion; it was implemented and tested rather than excluded. Searches covered comparison/compare/alternative/shortlist uses across screens, components, nested components, and their real call sites. The table is the final coverage inventory, not a claim that every textual occurrence is a decision surface.

| Surface and real entry point | Actual candidates and preserved context | Choose / persistence | Applicability and existing controls |
|---|---|---|---|
| Course shortlist and full decision facts — `CourseCompare.tsx`, hosted by `RegistrationPortal.tsx` | Only the two/three checked actual catalog sections; import time, term, meetings, credits, seats/unknowns, prerequisites, canonical requirement/schedule/requisite readings and official-next-step questions | Owner-scoped personal choice/history; legacy shared-device registration cart is not changed | Existing `course_detail_v2` feature and at least two compared sections. Both compact facts and full `DecisionTable` remain; source dates now use the actual available import timestamp. Course detail, compare selection, unsave and cart controls remain. |
| Saved potential schedules — `RegistrationPortal.tsx`, Potential schedules | Every saved schedule, including its own historical course details, unknown original import date, conflict/credit calculations and current-catalog absence warning | Owner-scoped personal choice/history; existing Load into cart remains a separate explicit operation | Works with one or more saved schedules. Never replaces historical details with the current catalog. Delete, schedule display and Load into cart remain. |
| Primary and ranked backups — `RegistrationDay.tsx` | The actual cart primary plus its recorded backup section IDs; imported catalog facts, unknowns and original backup priority | Owner-scoped personal choice/history; no cart replacement, registration or change to ranking | Per primary with at least one real backup. Existing add/remove/reorder controls, clipboard/export, countdown, readiness and official registrar confirmation remain. No recommended/invented replacement is added. |
| Degree, time and cost — `GraduationSimulator.tsx`, including `ScenarioComparison.tsx` and embedded `CostPlanner.tsx` | Actual current plan and every saved scenario; canonical `compareRows`, `limits`, `graduationOutcomes`, completed/current credits, applied plan/scenario assumptions and itemized costs | Owner-scoped personal choice/history; choosing never rewrites a degree audit or converts an abroad scenario into an inaccurate base plan | Appears with actual scenarios, including the existing basic simulator when the enhanced comparison flag is off. Retains all scenarios even if one is selected for the detailed table. Projection, editable assumptions, cost controls, cloud-save confirmation and official disclaimers remain. |
| Programme shortlist/materials and costs — `Pathway.tsx` | Actual visible shortlist programmes or explicitly selected cost rows; original currency and period, tuition/living/other/grants/net using `netProgramCost`, provenance, deadlines, requirements and material statuses | Owner-scoped personal choice/history; never changes application/admission/material status | Both list/material-grid shortlist and Costs use the same contract. No currency conversion, ranking, invented aid offer, or treating a recorded material status as official receipt. No selection in Costs means no invented candidates. |
| Study abroad — `StudyAbroad.tsx` | Every stored programme, its own currency/cost unknowns, host/term/deadline/source, `creditPicture` / `creditLine`, `approvalText`, and applied abroad assumptions | Owner-scoped personal choice/history; no transfer approval or application | One or more actual programmes; comparison table remains for multiple programmes. Private programme notes are excluded. Recorded approvals retain their explicit student-recorded qualification. |
| Career — `Career.tsx`, Discover, Skills & fit, Abroad | Actual filtered/displayed listing order in Discover, actual selected opportunity in Skills & fit, actual Study abroad listings in Abroad; source/unknowns/requirements, listing terms, canonical `explainFit` evidence and uncertainty, applied private target assumptions | Owner-scoped personal choice/history; additionally marks the actual opportunity saved through the existing owner+term career store | Never creates an application or changes official status. Private targets and skill evidence are excluded from the default advisor draft; the user must opt into fuller personal context. Existing filters, listing cards, skills explanations, tracking and official links remain. |
| Productivity decisions/history — `ProductivityWorkspace.tsx` | Actual active decision options, applied criteria/evidence/provenance and assumptions, unknowns and official route; per-option `advisorPacket` context | Same owner-scoped Productivity transaction saves the snapshot and exact chosen option ID/decided flag; latest decision version is checked before writing | Only actual nonempty options. Private reflection is never included in comparison/advisor context. Existing snapshot, pause, reflection, reconsideration and preparation controls remain. Saved comparison history is also visible here after source deletion. |
| Work-order/time simulation — `OperatingRhythmWorkspace.tsx` | Existing `simulate` results for Current order and Grouped context, using the actual nonblank task inputs, available minutes, switch buffer, switches/totals/remaining time and original ordered commitments | Owner-scoped personal choice/history, then the existing `save` / `savePlan` path writes chosen milestones and assumptions to the actual owner+term+daily-or-weekly+date plan | Only when at least one real entered task exists. These are live displayed simulation inputs, not a deferred assumption-review draft. Unrelated pending calendar proposals are excluded and never downloaded by Choose. Existing Save this scenario and calendar proposal confirmation remain. |

## Concrete applicability exceptions

- `DecisionTable.tsx` and `ScenarioComparison.tsx` are fact renderers, not independent writable datasets. Their real course/graduation hosts above supply the shared actions; fictitious candidates were not added to these primitives.
- `CostPlanner.tsx` edits one cost model and feeds the actual graduation comparison above. `LifeBalance.tsx` commute previews, `WorkWindows.tsx`, `Capacity.tsx`, `Clashes.tsx` day budgets, `DegreeAssumptions.tsx` and `Bill.tsx` installment/estimate controls edit a single plan or preview parameter changes. They have no separately stored candidate set to choose/save-all. Existing assumption preview/apply/cancel behavior and school-owned read-only data remain.
- `screens/Costs.tsx` compares recorded spending with an earlier term. `screens/Grades.tsx`, grade/target calculators, `LearningInsights`, `StudyReadiness`, `TeachBack`, `StudyJournal` and `HowLong` show estimates, historical evidence, reference answers or diagnostic feedback. Those observations are not alternate plans; choosing one as a factual result would be misleading.
- `OperatingRhythm` calendar export preview is an explicit file handoff, not another schedule candidate. Only its real current/grouped simulation is registered.
- `MembershipPanel.tsx` “Compare plans” concerns paid product membership and its existing billing flow. It is not an academic/advisor planning comparison; existing commercial confirmation remains unchanged.
- Toolkit `DataPanel.tsx` comparison types are statistical analysis methods/groups. Document/design revisions, syllabus/date reconciliation in `screens/Changes.tsx` / `screens/changes/AgainstCalendar.tsx` / `FromText.tsx`, import review and extraction/reference checks resolve evidence or edits. Their source-review controls are preserved rather than recast as academic choices.
- Institutional migration/reconciliation and equity/cohort/operations comparisons are role-limited institutional analysis, not student-owned planning candidates. No student action, advisor attachment, or additional record access was introduced there. Public site comparison/benchmark/pricing copy remains informational.
- List sorting, timing logic, comments, accessibility prose, guidance copy and generic selects containing “compare” or “option” are not independent comparison experiences. Empty states remain honest; no fabricated alternatives, sources, official relationships or approvals were added.

## Storage, privacy and side-effect boundaries

All new choices/snapshots use the existing `semester.productivity.v1:<account-or-device>` store and its fail-closed `useDeviceLibrary` reader/update path. Optional `comparisons` and `Decision.chosen` fields preserve older records. Existing 3,000,000-character storage budget remains unchanged. Source-scoped history distinguishes career terms and rhythm dates/kinds; graduation retains `graduationKey(account)` and unsigned legacy separation. No migration or reassignment of legacy source data occurred.

Registration catalog/cart/schedules/shortlist and registration-day backups are existing legacy device stores. They are accurately treated as the source visible in that workspace, not newly claimed to be account-owned. Comparison choices do not mutate those stores. Graduation, Pathway, abroad, career and rhythm continue using their existing source ownership rules. School-owned assumptions are never written by this contract.

Personal snapshot persistence happens before optional canonical career/rhythm updates. If snapshot persistence fails or the latest Productivity decision has changed, the source update does not run. If the later source write fails, the saved original personal choice remains, source data is preserved, and the error/partial-save state is reported. Separate existing stores do not provide a cross-store transaction; this limitation is explicit and tested with a source-only quota failure.

Ask advisor initially selects zero options and creates no stored meeting. Checking an option adds only its minimal explicitly selected facts to an editable textarea. Applied assumptions, personal targets and fuller planning/evidence context need a separate checkbox. Changing selected options or the context checkbox rebuilds the draft with a visible explanation. Private reflections, unrelated programme notes, old meeting notes, unselected options, other-user data, and deferred assumption drafts are not copied. Account, scope, candidate or source-context changes discard the pending preview.

Prepare editable meeting saves the user-reviewed text as an actual owner-scoped AdvisorMeeting agenda, with no selected course/scenario/follow-up attachments. Existing 30-item/500-character agenda limits apply; drafts above 15,000 characters are refused until edited, not silently truncated. The new meeting opens through `AdvisorMeeting.initialMeetingId`. The existing share/download/print previews and confirmations remain in control; no send/export occurs on Ask advisor or Prepare. Existing explicit private cloud save/backup behavior can include the owner's saved comparison history; this feature introduces no automatic cloud send and no institutional aggregation of comparison contents.

## Validation and self-review

All commands below ran from the isolated repository root. Final source was committed as `11e60c4de9f921c6bdbd35a52e2d28b5429b7bd6` after these checks. The report-only commit follows.

```sh
npm --prefix app test -- src/components/comparison-actions.integration.test.tsx src/components/CourseDetailV2.test.tsx src/components/GraduationSimulator.test.tsx src/components/GraduationSimulator.phase-d.test.tsx src/components/AdvisorMeeting.test.tsx src/components/StudyAbroad.test.tsx src/components/RegistrationDay.test.tsx src/components/RegistrationDay.mode.test.tsx src/components/ProductivityWorkspace.test.tsx src/components/OperatingRhythm.test.tsx src/components/AssumptionEditor.integration.test.tsx src/components/DecisionTable.test.tsx src/components/decision-human-mode.test.tsx src/screens/career.test.tsx src/screens/pathwaygrid.test.tsx src/lib/productivity.test.ts src/lib/productivity-cloud.test.ts src/lib/device-library.test.tsx src/lib/scenario-compare.test.ts src/lib/operating-rhythm.test.ts
npm --prefix app run build
npm --prefix app run budgets
npm --prefix app run lint
git diff --check
```

- Covering tests: **20 files, 177 tests passed**. Fourteen new real integration cases cover course choice and reload; selected-only advisor draft/edit/prepare; preview and actual share-confirmation cancellation; graduation applied-versus-pending assumptions and signed/unsigned separation; career source/target privacy and source updates; Productivity exact choices, reflection exclusion and stale-writer refusal; saved schedules/backups; programme currencies and abroad unknowns; actual rhythm plan writes; corrupt-store refusal; owner/source/term preview resets; and both corrupt-source and source-only quota partial-save outcomes. Existing suites retain actual control and assumption regression coverage.
- Build: **passed**, including TypeScript project build. Vite retains its conventional large-chunk notice for existing large assets; no limit was raised.
- Budgets: **passed**, first load **435.5 KB / 479.0 KB**, largest file **435.7 KB / 480.0 KB**, **93 routes**.
- Lint: **passed**, **23 existing warnings** under the unchanged maximum of **25**. Style, accessible-label and terminology checks passed.
- `git diff --check`: **passed**.
- Initial covering validation exposed one fully mocked Productivity test missing `useAccountId`; its mock was extended to return the same existing fixture owner. An initial budget run found Yes at **41.0 KB / 40.0 KB**. RegistrationDay now loads through a lazy boundary only when its tab is opened; the unchanged budget then passed. No test, style, accessibility or bundle limits were weakened.
- A jsdom diagnostic about navigation to another Document comes from an existing official-handoff test. It is not external provider execution or acceptance. No real advisor send, registration, payment, cloud mutation, production operation, credential change, gateway deployment or publication was performed.
- Self-review included the complete source diff, source storage/ownership call sites, optional data validation, canonical calculation reuse, pending-draft exclusion, native controls, privacy payload construction, lazy boundaries and failure-order behavior. This worker did not run independent review or the full repository suite; the controller owns independent review, main integration and final branch CI.

## Commits and remaining limits

1. `859e704238dbf2326299c712641e305121ec0d97` — shared personal comparison choices, immutable contexts and selected advisor drafts across the initial eight domain surfaces.
2. `702af24328f23cbf1c34f1723660f82de5128239` — ninth rhythm surface, canonical plan persistence, snapshot-first failure handling, conflict checks, integration/privacy/reload coverage and lazy registration-day boundary.
3. `11e60c4de9f921c6bdbd35a52e2d28b5429b7bd6` — clearer course term/career organisation identities and verified visible partial-save feedback.

Remaining limits: snapshots are private planning history, not official decisions or automatic source-plan restoration; imported catalog seats and supplied programme/career facts stay unverified; historical import dates absent from saved schedules remain unknown; explicit advisor preparation is subject to the existing meeting length/count limits; separate source/history stores are not transactional; legacy shared-device registration source ownership was unchanged in this initial submission, but is superseded by the owner-aware correction below. No remote/provider acceptance is claimed. No implementation check remains failing.


## Fix round 1 — independent review corrections (2026-10-02)

Fix baseline: `b19fc857b143491dd8482301f53fb145021b0a87`. The full `task-3-review.md` was read; the controller confirmed that unknown-owner legacy registration sources were a real binding-specification gap. Both Important findings, both Minor findings and that ownership gap are addressed. This is a source/test correction report; independent rereview remains the controller's responsibility.

### Findings resolved

| Review finding | Correction and observed evidence |
|---|---|
| Important I1: restore omitted comparison history | The actual private backup restore control now merges optional comparison arrays by snapshot ID, preserving the existing version of an ID. The real Export private backup output is fed through the real FilePick restore handler into empty and populated owner workspaces. Tests verify distinct original contexts, existing IDs, and old backups that omit `comparisons`. |
| Important I2: append-only history could not be removed | Both per-surface and central `ComparisonHistory` offer an explicitly labelled Delete comparison snapshot action. Central deletion remains available in Productivity when the source candidate has disappeared. A real workspace serialized to exactly 2,999,000 characters refuses the next snapshot under the unchanged 3,000,000-character limit; deleting the large snapshot centrally preserves the other snapshot, unrelated decision and another owner's bytes, then permits another real Save both. Retained records remain immutable; nothing is silently evicted. |
| Minor M1: stale career candidate | The optional canonical update now checks candidate presence and its displayed version inside the latest source updater. Valid-but-deleted and valid-but-edited source records refuse that update while retaining the already-saved original personal choice. The parent Career notice shows the partial result alongside the source error even if the comparison panel disappears or remounts. Corrupt-source and quota outcomes remain covered. |
| Minor M2: dangling live choice | Live decisions validate that a chosen ID belongs to a present option and accompanies `decided: true`. Editing options/criteria/goal/questions, meaningful assumption changes, explicit Reconsider decision and revisiting a legacy snapshot invalidate/clear the live choice. Identical assumption no-ops still preserve the original decision. Historical journal snapshots keep their historical data instead of being subjected to the live membership rule. Tests exercise Choose → remove chosen option → reload and Choose → reconsider → reload, reject dangling live choices, and preserve original comparison history. |
| Owner-aware source requirement | New signed-account comparison/history/advisor actions read only that owner's registration, shortlist and registration-day source keys. No unknown-owner source work is silently copied or assigned. Tests use actual signed imports, saved shortlist selection, Save/Ask/Prepare, account switches, real schedule and backup comparisons, advising attachment resolution, path-credit readers, reminder selection and workspace backup/restore. |

### Canonical personal-source policy — supersedes initial shared-device exception

`app/src/lib/registration-scope.ts` is the one lightweight key policy. Existing exported constants remain compatible through re-exports, but actual source readers/writers use the helpers below:

| Personal source | Signed account | Unsigned / legacy |
|---|---|---|
| Catalog import, personal cart and saved schedules | `registrationKey(account)` → `semester.registration.v1:<account>` | Original `semester.registration.v1` |
| Personal shortlist and checked comparison selection | `shortlistKey(account)` → `semester.course-shortlist.v1:<account>` | Original `semester.course-shortlist.v1` |
| Personal registration-day timing, readiness and ranked backups | `registrationDayKey(account)` → `semester.registration-day.v1:<account>` | Original `semester.registration-day.v1` |

Signed accounts start with their own empty source stores and can import a catalog and create plans normally. The catalog remains inside that source workspace; no shared-catalog fallback is used to accidentally carry its colocated personal cart/plans. No data were automatically copied, migrated, deleted or reassigned. Signing out retains access to the original unsigned workspace. The RegistrationPortal workspace remounts by owner, discarding its old editor, undo buffer and prepared UI when the account changes.

The initial report's claim that disclosure alone made legacy shared-device planning sources an acceptable exception is **superseded**. Signed personal sources are now isolated at the source, in addition to the already isolated comparison and advisor destination stores. Choosing from registration remains a personal history operation, not a cart mutation or official enrollment.

### Affected consumers and backup inventory

- `RegistrationPortal`, `CourseCompare`, `CourseDetailV2` and `RegistrationDay` read/write the matching account's source through the canonical helpers and existing validators.
- `useRegistrationPlan` supplies those same account-scoped registration/day records to Course detail, `RegistrationReadiness`, `RegistrationDayCard`, `TodayActionCenter`, `DemandContribution` and `enrollment/StudentRegistration`. Their existing controls and official provider boundaries remain unchanged.
- `useSavedCourses` accepts the actual meeting owner; `AdvisorMeeting` passes its account scope explicitly. Catalog resolution and shortlist IDs therefore cannot mix the provider's unsigned fixtures with a signed meeting or another account's source records.
- `PathSnapshotCard` planned credits, `SemesterWrapped` saved-schedule recap and `TrustCenter` registration-source readouts use the same registration key policy.
- `storedWindow(account)` reads only that account's registration-day key; unknown signed owners do not fall back to the unsigned window. In-page reminders in `state/store.tsx`, `PushTop` and `PushSwitch` pass the active account. PushTop's watched device library uses the matching key; the in-page effect includes account identity in its dependencies. Existing push/reminder tests and exact stored-window A/B/unsigned observations pass; no actual notification/provider send was performed.
- Workspace backup definitions for registration, registrationDay and shortlist are now account-scoped. Key construction calls the same three helpers, preserving bare unsigned keys. New exports attach `sourceOwner` metadata to these three records only. Restore checks their owner before any write: same-owner restores work; cross-account or unsigned-to-signed restores fail without mutation. Older records lacking owner metadata are treated as unsigned legacy and can be restored while signed out. This prevents a generic old backup from silently assigning unknown-owner personal data to the current signed account. Other workspace restore behavior is unchanged.
- The backup coverage census now explicitly lists ComparisonActionsPanel's two existing backed-up stores (Productivity and AdvisorMeeting). No store exemption or coverage threshold was weakened. Fixture updates explicitly create signed-owner source records instead of relying on legacy leakage; notifier source assertions now require the account argument.

Explicit limits: this is separation, not an ownership inference or migration. Existing unsigned plans remain unsigned. An old unowned registration backup is intentionally refused in a signed destination; the error directs restoration to the unsigned context. New registration-source backups are bound to their recorded owner. Personal comparison-history backups still support the existing explicit private restore workflow, including backups predating comparison history. No cross-store atomicity claim has been added, and no provider acceptance has been manufactured.

### Fix-round commands and results

All npm commands below ran from the isolated repository root; the standalone `npx tsc -b` checkpoint command ran from `app/`.

Lifecycle checkpoint:

```sh
npm --prefix app test -- src/components/comparison-actions.integration.test.tsx src/components/ProductivityWorkspace.test.tsx src/lib/productivity.test.ts
# 3 files / 28 tests passed
cd app
npx tsc -b
# passed
```

Ownership checkpoint: the amended registration/readiness/reminder/advising/backup/recap/trust group passed **18 files / 183 tests**. The extra ActionCenter/TodayActionCenter/DemandContribution/offline/registration-actions group passed **6 files / 62 tests**. These overlap the final run below and are not additive totals.

Final amended covering command:

```sh
npm --prefix app test -- src/components/comparison-actions.integration.test.tsx src/components/CourseDetailV2.test.tsx src/components/GraduationSimulator.test.tsx src/components/GraduationSimulator.phase-d.test.tsx src/components/AdvisorMeeting.test.tsx src/components/StudyAbroad.test.tsx src/components/RegistrationDay.test.tsx src/components/RegistrationDay.mode.test.tsx src/components/ProductivityWorkspace.test.tsx src/components/OperatingRhythm.test.tsx src/components/AssumptionEditor.integration.test.tsx src/components/DecisionTable.test.tsx src/components/decision-human-mode.test.tsx src/screens/career.test.tsx src/screens/pathwaygrid.test.tsx src/lib/productivity.test.ts src/lib/productivity-cloud.test.ts src/lib/device-library.test.tsx src/lib/scenario-compare.test.ts src/lib/operating-rhythm.test.ts src/components/PathSnapshotCard.test.tsx src/components/RegistrationDayCard.test.tsx src/components/PushTop.regday.test.tsx src/components/pushreach.test.tsx src/components/pushstalled.test.tsx src/components/SemesterWrapped.test.tsx src/components/TrustCenter.test.tsx src/screens/registration.test.tsx src/lib/workspace-backup.test.ts src/lib/workspace-backup.private.test.ts src/lib/workspace-backup.coverage.test.ts src/lib/registration-day.mode.test.ts src/lib/pushchain.test.ts src/components/ActionCenter.test.tsx src/components/ActionCenter.help.test.tsx src/components/TodayActionCenter.test.tsx src/components/DemandContribution.test.tsx src/lib/offline-mode.test.ts src/lib/registration-actions.test.ts
npm --prefix app run build
npm --prefix app run budgets
npm --prefix app run lint
git diff --check
```

Final outcomes: **39 files / 373 tests passed**, including **21 real comparison integration cases**; TypeScript/Vite build passed; unchanged budgets passed at **435.7 KB / 479.0 KB first load**, **435.7 KB / 480.0 KB largest file**, **93 routes**; lint passed with **23 existing warnings** under the unchanged **25** maximum; style, accessible-label, terminology and diff checks passed. Existing jsdom navigation/canvas diagnostics and the Vite large-asset notice remain test/build environment notices, not claims of a real browser/provider execution. No full repository rerun, production mutation, credential change, external message, deployment, publication, branch reset or rebase was performed by this worker.

Intermediate failures were corrected rather than suppressed: the capacity fixture initially exceeded jsdom's total-origin quota when it duplicated a large record into another account, so the other-owner preservation fixture became a small independent record; the final capacity test starts under the actual workspace limit. Career's pre-existing error-precedence display initially hid its new partial-result notice; it now displays both. Ownership changes exposed tests that had depended on shared unsigned registration fixtures; those now seed explicit signed-owner records. The source census was updated for the two real backed-up ComparisonActionsPanel library calls. All final checks above pass without raised limits.

### Fix-round source checkpoints and exact paths

- `dd6302f5adfae0a1512db39a3d42e1ebec85fc69` — restore/deletion/live-choice lifecycle and stale career guards, with actual lifecycle tests.
- `2ef9fb3b87b96ed3587659fa7fde4f4bf9df66ee` — canonical signed personal registration sources, consumers, reminder inputs, owner-aware backup metadata/restore guards and ownership tests.
- `10ac030f9d2a41376c2bd9de42840abc5fe8727d` — final near-capacity recovery proof beginning at 2,999,000 characters.

Exact source/test paths changed since the fix baseline:

```text
app/src/components/AdvisorMeeting.test.tsx
app/src/components/AdvisorMeeting.tsx
app/src/components/ComparisonActionsPanel.tsx
app/src/components/ComparisonHistory.tsx
app/src/components/CourseCompare.tsx
app/src/components/CourseDetailV2.tsx
app/src/components/PathSnapshotCard.tsx
app/src/components/ProductivityWorkspace.tsx
app/src/components/PushSwitch.tsx
app/src/components/PushTop.regday.test.tsx
app/src/components/PushTop.tsx
app/src/components/RegistrationDay.tsx
app/src/components/RegistrationPortal.tsx
app/src/components/SemesterWrapped.tsx
app/src/components/TrustCenter.tsx
app/src/components/comparison-actions.integration.test.tsx
app/src/lib/advisor-attachments.ts
app/src/lib/course-detail.ts
app/src/lib/offline-mode.ts
app/src/lib/productivity.ts
app/src/lib/registration-day.mode.test.ts
app/src/lib/registration-day.ts
app/src/lib/registration-plan.ts
app/src/lib/registration-scope.ts
app/src/lib/registration-window.ts
app/src/lib/workspace-backup.coverage.test.ts
app/src/lib/workspace-backup.test.ts
app/src/lib/workspace-backup.ts
app/src/lib/wrapped.ts
app/src/screens/Career.tsx
app/src/state/store.tsx
```

The sanitized report is `docs/superpowers/reports/2026-10-01-ui-comparisons.md`; the complete local report is `.superpowers/sdd/2026-10-01-ui-standards-completion/task-3-report.md`. Both contain this same complete correction/evidence addendum. A report-only checkpoint follows the source commits. No implementation check remains failing; scoped independent rereview is pending with the controller.
