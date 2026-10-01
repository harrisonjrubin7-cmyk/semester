# Task 2 review — actual calculator assumption editing

Reviewed range: `f0cb1f0aedde35e2121780b6c2aa9470a79b8271..34e3357d1458a3993e88696c05d1d21d4dbf5c64`.

**Spec verdict: changes required. Quality verdict: changes required.**

Findings: **0 Critical, 3 Important, 1 Minor**. The shared adapters substantially implement the requested calculator connections, but two existing input paths now silently ignore edits, and normal decision-assumption application can overwrite a newer decision and its institutional records. These prevent acceptance of the preservation and ownership requirements.

## Review method and boundaries

Read `task-2-brief.md`, including its binding Global Constraints, the reconstructed `task-2-report.md`, and the recorded review package. Inspected the changed implementation and tests across the full recorded base-to-head scope, plus the canonical calculator, storage, reducer, ownership-key and native-form integration context needed to assess behavior. Applied the controller's ruling: native edits to the same personal assumptions exposed by the adapters require canonical previews; actual record entry/correction and unrelated quick entry keep their existing workflows.

This was a source review. No reported tests, build, lint or budgets were rerun; no application source was changed, no publication occurred, and no agents were spawned. Reproduction sequences below are derived from the source paths, not claims of a new browser/test execution.

## Important findings

### I1 — Résumé identity inputs have become nonfunctional

Location: `app/src/screens/Career.tsx:725–737`, especially line 734; adapter definition `app/src/lib/career-assumptions.ts:4–5`; dispatch guard `app/src/components/AssumptionEditor.tsx:74–80`.

The `name`, `headline` and `contact` input loop now sends changes to `native.edit(k, value)`. The native hook was constructed from `careerAssumptions`, which contains only `targetRoles` and `targetLocations`. Its lookup therefore finds no adapter for any of the three résumé fields and does nothing. These remain controlled inputs whose displayed value comes from the unchanged library.

Reproduction: open Career → Résumé and type in Name, Profile or objective, or Contact line you want on it. No library update and no assumption editor can occur; the typed change is discarded. The regression is unconditional for those fields.

Impact: users cannot create or correct their basic résumé information. This violates the explicit requirement to preserve existing controls and the controller's exclusion of unrelated record-edit workflows from this conversion.

Required correction: restore the existing library update for the identity-field loop; retain staged native editing only for the actual target-preference fields. Add focused regression coverage for these unrelated fields so the preference test does not leave them unexamined.

### I2 — Flag-off graduation cost controls have no corresponding adapter when itemized costs already exist

Location: `app/src/lib/graduation-assumptions.ts:15–19`; `app/src/components/GraduationSimulator.tsx:80–83`, `242–263`, and `291`.

The cost adapters are omitted whenever `plan.costLines` is nonempty. The original cost inputs, however, are hidden only when **both** `costs` is enabled and `plan.costLines` is nonempty. With `costs=false` and an existing itemized plan, the inputs remain visible and call `native.edit('plan:costPerTerm', …)` / `native.edit('plan:summerCost', …)`, but neither adapter exists. The itemized planner is also hidden in this configuration.

Reproduction: save a valid plan containing one or more cost lines, then render the supported `costs=false` simulator configuration (for example after disabling the cost-planner flag). Edit either displayed cost-per-term input. The request is silently ignored and there is no alternative visible cost editor.

Impact: an existing plan becomes uneditable for costs in a supported flag state. The recorded flag-off tests use a plan without itemized lines, so they do not cover this state. This violates preserving functional controls in every view.

Required correction: use a consistent condition for cost control visibility and adapter availability, preserving the intended flag-off behavior. Keep preview/apply tied to the canonical plan update and cover an already-itemized plan with the flag disabled.

### I3 — Normal decision-assumption Apply can overwrite concurrent work and institutional assumptions

Location: `app/src/lib/decision-assumptions.ts:11–18`; integration `app/src/components/ProductivityWorkspace.tsx:490`; whole-record merge at `105–112`. Related native preview/save is at `164–174`. Storage's latest-record read is in `app/src/lib/device-library.ts:105–122`.

The new shared adapter constructs an entire `Decision` from the rendered snapshot and hands it to `patch(next)`. Although `patch` uses the library's functional update, it spreads this complete captured decision over the freshly read record. As a result, the latest-record read does not protect any decision field. Ownership checks in the adapter and `withAssumption` also inspect only that captured snapshot. The reset-to-preferences path has a latest-record comparison specifically to prevent this problem, but ordinary assumption Apply does not.

Reproduction: preview a personal assumption; let another tab/view update the saved decision's goal, evidence, or institutional assumption records; invoke Apply before that tab's storage notification has refreshed the rendered snapshot. The write rereads the new record and then replaces its fields with the old decision plus the one proposed edit. This can discard the concurrent goal/evidence, remove a newly added institutional entry, or revert an assumption that has become institutional back to the captured personal version. The same timing model is already used by the reset concurrency regression, which directly updates the saved record before Apply.

Impact: applying one personal assumption can destroy unrelated current work and overwrite institutional assumption records despite the stated ownership guarantee. This is an application-record integrity bug, not a claim of a backend permission bypass. The native assumption save uses the same whole-decision pattern and should share the correction.

Required correction: resolve and validate the current decision and assumption inside the canonical library update. Reject a stale preview (as reset already does), or use a narrowly scoped, conflict-checked update that retains all unrelated fields and checks current ownership before calling the canonical assumption transformation. A changed current decision must require a fresh review if its calculator context no longer matches the proposal. Cover a concurrent unrelated update and an institution-ownership/record change for normal Apply, not only reset.

## Minor finding

### M1 — Shared-editor keyboard focus is not managed when replacing its own controls

Location: `app/src/components/AssumptionEditor.tsx:18–43`.

`focusDraft` focuses the proposed-value control only when `initialValue` is supplied by the native route. In the ordinary shared editor, activating Edit removes the focused button but does not focus the replacement input. Apply and Cancel similarly remove the focused control without returning focus to the newly rendered Edit button; only native editors receive `onClose` focus restoration. Thus the main shared editor lacks the keyboard focus continuity implemented for native staging.

Impact: keyboard users lose the active control when entering or leaving a shared edit and must navigate back to the relevant row. This affects every consumer of `AssumptionEditor`.

Suggested correction: focus the proposed input when any edit opens and restore focus to the row's Edit button after shared cancel/apply, accounting for a row remount after its value changes. Keep the existing native focus restoration. Add a small shared-path keyboard-focus regression.

## Spec assessment

| Requirement | Assessment |
| --- | --- |
| Inventory graduation/degree, time/workload, cost and career inputs | Substantially met. The report distinguishes the connected assumption fields, source records and unsupported calculations, and identifies concrete consumers. |
| Shared editor, typed adapters, value/owner/source and actual dependencies | Met in structure. Domain adapters call existing `project`, degree `progress`, cost `totals`/`total`, `billFor`, `targetScore`, workload/reducer functions, balance calculations, `creditPicture` and productivity evidence logic. No second numerical calculator was found. |
| Preview before confirmation, cancel preserves canonical values, native paths included | Substantially implemented, but not acceptable as complete: I1/I2 leave visible controls ineffective; I3 leaves a stale confirmation path able to overwrite newer data. Native workload lazy-request invalidation and account/term/program context keys are deliberate and covered by the reported integration tests. |
| Owner-scoped persistence and institutional locks | Graduation/commute key changes are consistently applied to their visible consumers and backup allowlist; existing unsigned records are deliberately retained without automatic reassignment. Institutional controls are visibly locked in the adapters. I3 prevents an unqualified claim of apply-time preservation of institutional records. |
| Honest unknown outcomes and provenance retention | Supported by source inspection. Abroad costs expressly report no dependent total/aid calculator; missing graduation costs remain unknown; career effects are listing order/term matches, not hiring claims. Edited imported cost copies become student-entered while copied provenance remains. Productivity source-check freshness is distinguished from unchanged recorded numeric fit. |
| Preserve existing navigation/controls and keyboard operation | Not fully met: I1 and I2 are concrete control regressions, and M1 affects shared-path focus continuity. No DOM interception or React-control HTML reconstruction was found. |
| Tests of real graduation/time/career changes, cancellation, provenance and locks | Test source exercises actual domain components and canonical state/storage, including native paths and a deferred workload module. These are meaningful integration tests. The gaps identified above need focused additional regressions. |
| Checks, limits, lazy loading, checkpoint/report | The supplied report records 23 passing test files / 374 tests, passing TypeScript/build/lint/budgets and diff checks at the source checkpoint. Changed-file inspection shows no dependency addition or raised quality budget. Existing substantial lazy boundaries remain, with StudyAbroad newly lazy. The source is checkpointed in the reviewed range and the final report is included. |

## Cannot independently verify from this review

- The reported test/build/lint/budget execution results were not rerun, as instructed. Their command/result evidence is the implementer's report, supplemented here by inspection of test source.
- Live production behavior, server/RLS enforcement, cloud provider execution, browser/device coverage and independent assistive-technology acceptance are not established by this review. The implementation report does not claim them.
- This review does not attest that every unrelated application CRUD operation now uses assumption staging; the controller explicitly excludes those workflows. It does assess preservation of the native inputs touched by this task, including the two regressions above.

Accept after the Important findings are corrected and their focused regressions pass under unchanged limits; address the shared focus issue as part of the same UI completion work.
