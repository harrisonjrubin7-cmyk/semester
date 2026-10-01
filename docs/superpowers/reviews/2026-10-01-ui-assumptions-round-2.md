# Task 2 — fix round 2 scoped rereview

Reviewed package: `2aac5f2d7d5460888f982f217a02c237ccd17fe4..23a78df96f930c1558283a5cd0fd23f1b878acce`.

**Spec verdict: accepted within the scoped fix gate. Quality verdict: accepted within the scoped fix gate.**

**I4: ADDRESSED. New findings in the fix diff: 0 Critical, 0 Important.** Original I1, I2, I3 and M1 remain accepted from the preceding rereview; this review does not reopen them or repeat the original Task 2 acceptance exercise.

## Scope and method

Read `task-2-brief.md`, including its binding Global Constraints; `task-2-fix1-review.md`, including the I4 reproduction and required correction; the appended fix-round-2 evidence in `task-2-report.md`; and the complete exact `review-2aac5f2d..23a78df9.diff` package. Inspected the changed canonical transformation, adapter and regression sources, plus the retained shared/native apply paths, assumption schema, context invalidation and canonical device-library update as integration context.

This is a source rereview. No reported test, build, TypeScript, lint, budget or whitespace check was rerun. No browser execution is claimed. No application source change, helper/reviewer dispatch, commit or publication occurred. The only written artifact is this review. The gate covers I4 and new Critical/Important breakage introduced by this exact fix diff, not unrelated CRUD or broader architectural changes.

## I4 — Unchanged shared decision Apply cleared source checks despite its preview: ADDRESSED

Primary correction: `app/src/lib/productivity.ts:365–372`. Shared preview correction: `app/src/lib/decision-assumptions.ts:18`. Retained persistence guard: `app/src/components/ProductivityWorkspace.tsx:117–122`. Native preview/application integration: `app/src/components/ProductivityWorkspace.tsx:175`, `181–185`.

The no-op now lives in the canonical `withAssumption` transformation, rather than in the adapter's Apply callback. The existing record is located by matching ID. After rejecting an existing institution-owned record, the function compares label, value, owner, source, impacts and review. Those are every other field in the current `Assumption` schema (`app/src/lib/productivity.ts:35–43`). When they match, it returns the original `Decision` object directly.

This returns before filtering/reinserting assumptions or calling `changedAssumptions`. It therefore retains the complete original decision, including all assumption metadata and order, option evidence/check dates, decision status and other recorded context. It preserves more than the displayed assumption text. Editing a value and restoring it also reaches this same branch when the resulting proposal matches the recorded assumption.

The shared adapter no longer special-cases an unchanged personal value during preview. Every personal preview invokes `withAssumption` with the proposed record, while Apply continues through the guarded updater and invokes that same transformation on the latest matching decision. The original source-derived reproduction now has matching behavior: unchanged Preview retains Current checks, and unchanged Apply retains the decision and its recorded checks/status. Native editing also previews through `withAssumption`, so its unchanged Save uses the same no-op semantics.

The canonical updater may still serialize the library and dispatch its usual storage notification. That is not a claim of suppressing all writes or events; the relevant invariant is that the recorded decision content remains unchanged. Returning the original decision prevents the destructive metadata transformation identified in I4.

## Meaningful changes and protection ordering

Any meaningful field difference, or an added assumption without a matching ID, continues to `changedAssumptions` (`app/src/lib/productivity.ts:372`, `380–394`). The existing transformation still sets `decided: false`, applies the proposed assumption and clears the checked dates on every recorded evidence entry while retaining the other evidence fields. Source-only edits with an unchanged value are therefore not mistaken for no-ops. The shared preview and native metadata preview use this same invalidation, so their Need review result agrees with persistence.

The retained updater in `ProductivityWorkspace.tsx:117–122` still resolves the decision from the latest library, rejects missing or changed decision context, and rejects both proposed institutional ownership and current institutional ownership before calling `withAssumption`. The no-op cannot skip these checks: even an identical shared proposal is submitted to this callback. Other latest-library records remain preserved by the existing functional update. Canonical institution ownership rejection also precedes equality at `productivity.ts:367–368`, so an identical institutional record cannot become editable via the new return.

Observed-context draft invalidation remains intact: native pending state uses the reviewed decision signature at `ProductivityWorkspace.tsx:91–99`; shared adapter context remains the full decision signature at `decision-assumptions.ts:13`, included in the row key at `AssumptionEditor.tsx:16`. The library still loads current storage before evaluating the updater and catches its thrown rejection before persistence (`app/src/lib/device-library.ts:101–128`). No changes to these guards appear in this fix diff.

## Regression evidence and limits

The new actual-domain integration cases at `app/src/components/AssumptionEditor.integration.test.tsx:462–490` cover both shared and native confirmation. Each seeds a decided decision with two ordered assumptions, two options and checked evidence for every criterion. The cases inspect unchanged preview checks, confirm through the real controls and assert equality of the full saved decision to the original. They then exercise a meaningful shared value edit or native source-only edit, inspect Need review in the preview, and assert saved decision reopening, cleared check dates and the expected proposal metadata.

The canonical case at `app/src/lib/productivity.test.ts:133–150` asserts original-object identity for an identical personal assumption, checks invalidation for label/value/owner/source/impacts/review edits, and asserts that an identical institution-owned assumption still throws. Retained integration cases at `AssumptionEditor.integration.test.tsx:416–460` continue to cover stale context, changed ownership, added institutional work, deletion and observed-context invalidation. These sources directly support the correction; their execution results remain implementer-reported, not independently rerun here.

The appended report records 3 passing test files / 45 tests at source checkpoint `935097d70c68958d0137fb76e1518634b1d28930`, plus passing TypeScript/build, lint, unchanged bundle budgets and whitespace validation. The exact package changes four source/test files and the report; it adds no dependency and changes no quality limit or persistence architecture.

No new Critical or Important defect was found in the scoped diff. Existing broader storage/domain limitations, unrelated workflows, production/provider validation, independent accessibility acceptance and final whole-branch CI remain outside this rereview. Accept the I4 correction; no further scoped fix is required.
