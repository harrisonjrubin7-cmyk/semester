# Semester UI enhancement audit — 1 October 2026

## Scope and verdict

Compared the entire attached “any other impovements and enhancements to ui(1).pdf” with main at `a27daab6fd4e9d20581322a49513562629a911b3`. This is a source and regression-test audit; it is not a claim that every production integration or institution has accepted the app. The GitHub connection reports push access. The latest production smoke workflow for that main commit reports success. Local production build succeeded before and after the changes.

**Institutional launch verdict remains NO-GO.** The application already has executable launch gates in `app/src/lib/launchreadiness.ts`; their real gaps are preserved. Repository completion, individual local use, connected account use, and institutional production acceptance must not be conflated.

## All twenty PDF requirements

| # | Requirement | Existing implementation and changes in this branch | Remaining scope / acceptance |
|---|---|---|---|
| 1 | Unified command bar | `Command.tsx`, `keys.ts`, `find.ts`, `intent.ts`: persistent shared search, ⌘K/Ctrl+K, recent searches, capture and assistant handoff. Added exact natural navigation phrases before capture parsing. | Commands open workflows for review; they do not complete transactions. Arbitrary conversational command interpretation remains an assistant task. |
| 2 | Smart breadcrumbs | `unity/SystemContextBar.tsx`: interactive term switch and canonical destination in all layouts. | Object-specific scenario switching still uses each workspace's own controls. |
| 3 | Back to context | Shared continuity strip now says “Back to” the last eligible context; browser tabs preserve open search and work. | Exact object-level restoration relies on existing tabs and object route state; strip identifies screens. |
| 4 | Recently changed strip | `WhatChanged.tsx`, `whatchanged.ts`, and Today: actual deadline changes with acknowledgment and a return-since summary. | Not a universal audit feed for every object; no synthetic changes have been invented. |
| 5 | Save states | `unity/Status.tsx`, `ContextBar.tsx`, SystemContextBar, local recovery and sync-error banner. | Each device library retains its own save/error handling. Official confirmation still requires authoritative provider receipts. |
| 6 | Low-risk undo | `undo.ts`, `Undone.tsx`, store undo support for moves and removal. Consequential changes use `ConfirmDialog`. | No generic reversal of registration, payment, sensitive sharing or external messages. |
| 7 | Decision trail | Added `unity/DecisionTrail.tsx` to the actual shared shell, using six existing student workflows. Current and needs-review are explicit; optional/completed/blocked are supported when supplied. | Navigation never manufactures completed steps. Provider-backed completion evidence must come from the workflow. |
| 8 | Human table mode | Existing course/scenario responsive cards. Added table/card/summary switching to `DecisionTable`, connected through actual registration course comparisons. | Search/filter/export already exist on individual workspaces. A universal saved-view/export/filter contract across every app table remains outstanding. |
| 9 | Source anchors | StudyStudio already carries quoted material, context, locations, originals and highlighting. Added optional owner/location/excerpt to the shared source drawer and populated verified deadline quotes. | No page number, owner or source text is fabricated when missing. Exact original-file opening is offered where a file is recorded. |
| 10 | Assumption editor | `GraduationSimulator.tsx` now summarizes recorded credit load, degree target, summer credits, next term and exclusions beside existing editable inputs; Edit assumptions focuses the actual form. `WorkWindows` already exposes time assumptions. | A single cross-domain editor for course/time/career assumptions remains outstanding. |
| 11 | Compare standard | Existing `CourseCompare`, `ScenarioComparison`, `decision-compare.ts`; registered course shortlist caps comparison at three. New human views preserve unknown facts and official next steps. | A single standard with Choose A/B, Save both and Ask advisor across every comparison domain remains outstanding. |
| 12 | Relationship map | Added optional accessible nested course relationship list with real deadlines, added materials, student-recorded requirements and advising navigation. Shared source drawer receives real relationships. | Full graph of degree scenarios, career artifacts and advisor objects is not yet universal. |
| 13 | Question-first forms | `Onboarding.tsx`, `unity/CommandCenter.tsx` FirstGoal, and existing course/import review workflows defer configuration until needed. | Longer specialist institution/admin forms retain their existing structured forms. |
| 14 | Privacy preview | `AdvisorMeeting.tsx`, `ConfirmDialog`, advisor share policies: recipient, actual payload, expiry, private-note exclusion and revocation. | Institutional sharing needs configured, authorized services and acceptance. |
| 15 | One-click accessibility | Added shared native disclosure on all shell screens: text size, reading spacing, reduced motion, plain language, Focus View and full settings. Existing study tools offer read aloud; OS contrast preferences are honored. | Global read aloud, app-controlled high contrast, schedule agenda toggle and language shortcuts are not all in the new compact menu. Independent assistive-technology acceptance remains required. |
| 16 | Plain language | `accessmode.ts`, settings, campus definitions and guidance. New global menu toggles the actual persisted plain-language preference. | Not an automatic translation of every institution-authored document. |
| 17 | Micro-confirmations | Existing inline save/status and registration/advisor/scenario messages. | These reflect real results; no invented success receipt. |
| 18 | Screen orientation | Canonical context and term shown by shared strip; current screen uses a polite live region. | Provider freshness remains sourced from actual available data. |
| 19 | Work vs information | `ContextBar`, source drawer, save states, reading surfaces and screen-specific primary actions already distinguish work from reference. | Requires continuing visual acceptance on actual devices; source tests cannot prove every visual transition. |
| 20 | Start anywhere | Expanded actual FirstGoal launcher with weekly planning, meeting preparation and data/privacy destinations alongside planning, study, campus support and career. | FirstGoal is available on Today and existing empty/search surfaces; it does not replace navigation. |

## External institutional launch blockers

The existing gate ledger records these unresolved acceptance requirements:

- A production golden path with approved account and provider configuration; controlled institutional accounts and integration scope.
- Production/staging parity and a production restore drill with measured recovery point and recovery time.
- Alerts delivered to a named operational owner, usable support route and assigned escalation owners.
- Qualified legal/privacy review and institution-approved pilot data scope and source owners.
- Independent accessibility audit and disposition of pilot blockers.
- Demonstrated production rollback, kill switch and read-only behavior.
- Agreed institutional success criteria, measured baseline and actual council sign-offs.

These are not fulfilled by setting booleans or editing a status label. No credentials, real institutional approval, staff acceptance or signed pilot agreement were supplied by this request. No external messages were sent.

## Verification record

- Baseline production build: passed.
- Baseline full test suite: 19,261 passed, 48 skipped, 3 failed. All three failures are `scripts/rollout-publication.test.ts`, which requires previously generated master PDF and 17 DOCX artifacts outside this checkout at `/workspace/scratch/outputs/semester-institutional-rollout`.
- New features were exercised through failing tests followed by passing implementation tests. Course comparison was tested through `RegistrationPortal`, not solely as an isolated component.
- Final full suite: 19,271 passed, 48 skipped, the same 3 publication-artifact failures; 1,218 passing test files and 1 failing file. Final production build and lint passed (existing warning budget and large-chunk warnings remain). Independent review found mobile trail visibility and workflow-context loss; both were fixed and covered by passing regression tests.
- Local browser golden-path smoke could not reach the local preview HTTP server in this execution environment (`fetch failed`, and loopback curl refused). No browser journey pass is claimed here. Existing deployed main production smoke success is separate evidence and does not verify this branch.

## Completion boundary

This branch closes concrete shared-shell and planning UI gaps and leaves a complete twenty-item audit. It does **not** complete the entire universal UI specification, production connected acceptance, or institutional go status. The remaining UI standardization work in rows 8, 10, 11, 12 and 15 and the external launch blockers are explicit, so reviewers can continue without mistaking a code change for launch approval.
