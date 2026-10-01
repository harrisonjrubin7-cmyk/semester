# Task 2 — fix round 1 scoped rereview

Reviewed fix package: `34e3357d1458a3993e88696c05d1d21d4dbf5c64..2aac5f2d7d5460888f982f217a02c237ccd17fe4`.

**Spec verdict: changes required. Quality verdict: changes required.**

Original findings: **4 ADDRESSED, 0 NOT ADDRESSED** (I1, I2, I3 and M1). New findings introduced by this fix: **0 Critical, 1 Important** (I4 below). The original concurrency defect is corrected, but the new shared decision apply path introduces an unchanged-value mutation that disagrees with its preview.

## Review method and scope

Read `task-2-brief.md`, including the binding Global Constraints; `task-2-review.md`; the appended fix evidence in `task-2-report.md`; and the exact `review-34e3357d..2aac5f2d.diff` package. Inspected the changed implementation and regression tests, with the existing canonical device-library update, graduation projection and productivity assumption transformation as necessary integration context.

This is a source rereview, not a fresh test execution. No reported passing tests, build, lint, budget or whitespace checks were repeated. No application source changes, helper/reviewer dispatch or publication occurred. The only artifact written is this review. Reproduction sequences are derived from source, not claims of browser execution.

The controller's native-staging ruling remains binding: native edits to the same adapter-exposed planning assumptions require canonical previews before confirmation; unrelated record corrections retain their native workflow. The acceptance gate here covers the four prior findings and new Critical/Important breakage in this fix diff, without expanding to unrelated application CRUD.

## Original finding verdicts

### I1 — Résumé identity inputs: ADDRESSED

Locations: `app/src/screens/Career.tsx:726–738`, especially line 735; retained preference staging at `751–762`. Regression: `app/src/components/AssumptionEditor.integration.test.tsx:372–381`.

The three identity inputs now extract their event value and use `lib.update(old => ({ ...old, [k]: value }))`. This is a narrow canonical library update that retains current unrelated fields, rather than sending an unsupported identifier to the assumption hook. Name, profile/objective and contact are therefore functional record corrections again. Target roles and locations still use native assumption staging, which preserves the controller's intended boundary.

The new integration case exercises all three actual inputs, asserts persistence in the owner/term library key and asserts that no pending assumption editor opens. This directly covers the original broken controls.

### I2 — Flag-off costs on an itemized plan: ADDRESSED

Locations: `app/src/lib/graduation-assumptions.ts:15–25`; `app/src/components/GraduationSimulator.tsx:75–83`, `180`, `242–267`. Canonical projection: `app/src/lib/graduation.ts:226–265`. Regression: `app/src/components/AssumptionEditor.integration.test.tsx:383–400`.

Adapter availability now receives the same condition used by visible scalar controls: `!costs || !plan.costLines?.length`. Both the shared editor and native hook receive it. An already-itemized plan with the cost planner disabled thus has adapters for both visible scalar inputs. With the planner enabled and populated, those scalar controls and adapters are both omitted.

The adapters preview through the existing `project` calculation and apply a narrow scalar patch through the canonical plan update. The calculator already consumes the scalar term/summer values; the correction does not invent an alternative itemized formula. The new test covers the formerly failing flag/record combination, asserts the $8,000 preview, unchanged storage before confirmation and after cancellation, successful term/summer application, and preservation of existing imported cost-line records and provenance.

### I3 — Captured decision overwrites newer work/institution records: ADDRESSED

Locations: `app/src/components/ProductivityWorkspace.tsx:90–99`, `117–122`, `181–185`, `500`, `518`, `550`; `app/src/lib/decision-assumptions.ts:11–19`; shared context keys in `app/src/components/AssumptionEditor.tsx:16`, `67`, `77`. Canonical storage update/error handling: `app/src/lib/device-library.ts:101–128`. Regressions: `app/src/components/AssumptionEditor.integration.test.tsx:416–460`.

The shared adapter now submits an assumption proposal rather than a captured whole decision. Shared Apply and native Save both call `applyAssumption`, whose functional library update resolves the decision from the current stored library. Missing or changed decisions are rejected before mutation; the code then checks both proposed ownership and the current matching assumption's ownership before invoking `withAssumption(current, assumption)`. Other records in the latest library remain preserved through the spread/map over `old`.

This closes the specific storage-notification timing window from I3: even when React has not observed the concurrent write, the canonical updater rereads storage and compares the latest decision with the reviewed snapshot. A deleted decision cannot be recreated by this path. Thrown conflicts are caught by the library before `localStorage.setItem`, preserve the latest value and produce the fresh-review error.

Observed context changes also invalidate the draft. Shared decision adapter keys include the full reviewed decision context; native drafts retain `pendingBefore` and are hidden/cleared on a mismatch. A subsequent newly opened preview uses the updated decision.

Eight new integration cases cover both shared and native application after changed goal/evidence, institution ownership, addition of an institutional record and deletion of the decision. They assert exact unchanged stored bytes plus the conflict error. Two more cases deliver the actual local library event, verify draft invalidation and verify a fresh edit can then apply while retaining the updated goal. These directly address the original concurrency and ownership finding. The distinct unchanged-value regression introduced by this correction is I4 below, rather than a failure of the I3 conflict guard.

### M1 — Shared editor focus continuity: ADDRESSED

Locations: `app/src/components/AssumptionEditor.tsx:9–19`, `28`, `35–37`, `43–49`. Regression: `app/src/components/AssumptionEditor.integration.test.tsx:402–414`.

The proposed control now receives focus whenever it mounts, including ordinary shared Edit. Successful Apply and Cancel mark the originating assumption ID in a parent ref before React commits the replacement Edit button. That button's ref restores focus, including when a changed value/context causes the old row to unmount and a new row to mount. Native close behavior still uses the existing external-control restoration path.

The new real graduation test verifies entering the proposed control, returning to Edit after Cancel, and returning to the new Edit button after a value-changing Apply. The source correction and focused coverage match the original finding. This does not claim independent assistive-technology acceptance.

## New Important finding in the fix diff

### I4 — Unchanged shared decision Apply silently clears source checks despite an unchanged preview

Primary changed location: `app/src/lib/decision-assumptions.ts:18–19`. New persistence path: `app/src/components/ProductivityWorkspace.tsx:117–122`, especially line 121. Existing canonical side effects reached by that path: `app/src/lib/productivity.ts:365–369`, `377–388`. Shared controls permit this sequence at `app/src/components/AssumptionEditor.tsx:35–47`.

The fix removes the adapter's prior unchanged-value short circuit. Previously, `value === assumption.value` returned success without applying a transformation. Now every personal Apply invokes the callback, and the new updater always calls `withAssumption`, even when the submitted assumption is identical to the stored one.

The preview still has the unchanged-value short circuit: line 18 computes outcomes from the original decision when the proposed text equals the stored value. In contrast, `withAssumption` calls `changedAssumptions`, which sets `decided: false` and clears every option's evidence `checked` date. It can also move the unchanged assumption to the end of its array. The preview and saved result therefore differ for a normal supported interaction.

Source-derived reproduction:

1. Open a saved decision containing a personal assumption (for example, Travel limit = Local), at least one option with current checked evidence for its positively weighted criteria, and optionally `decided: true`.
2. Open the shared assumption editor and select **Edit Travel limit**.
3. Leave the value as **Local** (or edit it and restore Local), then select **Preview Travel limit**. The preview shows Local → Local and source checks **Current**, because the adapter previews the original decision for an unchanged value.
4. Select **Apply Travel limit**, with no concurrent write involved.
5. The new callback passes the unchanged assumption to `withAssumption`. Persistence clears the evidence-check dates and changes `decided` to false. The displayed source checks subsequently become **Need review**, despite the reviewed preview promising unchanged outcomes.

Impact: a no-change confirmation destroys recorded verification dates across the decision and reopens an already-decided decision. This is an Important record-integrity and preview-contract regression within the fix diff, not a cosmetic redundant write. It violates preserving recorded work and previewing the actual dependent effect before confirmation.

The new concurrency tests propose different values and primarily use decisions without current evidence, so they do not expose this no-op mismatch. Reported passing checks do not resolve it.

Required correction: retain the current-decision conflict and ownership checks, then make a truly unchanged proposal a no-op before the invalidating canonical transformation. Do not restore a bypass that skips those new guards. Ensure any shared/native use of that correction preserves meaningful metadata edits and keeps its displayed preview consistent with its persistence behavior. Add an actual shared-editor regression using current checked evidence and a decided decision: unchanged Preview/Apply must preserve the original decision, including all check dates and `decided`, while changed-value Apply must still perform the intended invalidation. Retain the stale/institutional rejection coverage.

## Evidence and deferred scope

The implementer's appended report records 23 passing files / 387 tests, passing build/TypeScript, lint and bundle budgets under unchanged limits. These results were not rerun; the relevant regression source was inspected. No dependency or quality-limit changes occur in this fix package.

No additional out-of-scope observation is promoted to an acceptance requirement. The existing device-library architecture is not a general cross-tab transaction system; this rereview judges the captured-preview/latest-record defect specified in I3 and does not demand a storage redesign. Unrelated CRUD, broader domain context invalidation, existing warning cleanup, production/provider validation and independent accessibility acceptance remain outside this scoped fix gate.

Accept the four original fixes. Require correction of I4 and its focused verification before accepting the fix round as complete.
