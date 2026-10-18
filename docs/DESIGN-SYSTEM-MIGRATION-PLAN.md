# Design system migration plan

How the design-excellence work landed, what is left, and the order in which
the rest of the app should adopt it.

## How it shipped

The brief names nine phases (0–8), each on its own `feature/…` branch with its
own draft PR. This work shipped on **one branch, `claude/zen-volta-snc6bk`, as
one draft PR**, because the session could push to that branch only. The
phases below are sections of that PR. Nothing was deployed or merged.

## Phases against what landed

| Phase | Brief branch | Landed in this PR | Not done / follow-up |
| --- | --- | --- | --- |
| 0 — Audit and migration plan | `feature/design-audit-scorecard` | Scorecard with 37 components scored from evidence ([WCAG-UI-AUDIT-SCORECARD.md](WCAG-UI-AUDIT-SCORECARD.md)); this plan | Visual regression baseline (no snapshot tooling in the repo) |
| 1 — Token foundation | `feature/design-token-foundation` | `styles/tokens.css`: surface, text, border, action, status, focus, target, duration, motion, layer, elevation, shape, layout, and card/bar/sheet component tokens; `styles/tokens.test.ts`; `.device :focus-visible` now reads `--focus-color`, `--focus-ring-offset`, `--focus-clear-*` | Existing rules still read primitives; z-index literals not migrated (below); brief's full component-token list |
| 2 — Typography, light/dark, elevation, glass | `feature/typography-dark-mode` | Glass policy with person-preference fallbacks (`unity.css`, `styles/glass.test.ts`); elevation tokens; `.nums` | No palette change and no new dark mode (both existed and are measured); body raised to 16px with the reading tier above it — see [TYPOGRAPHY-SYSTEM.md](TYPOGRAPHY-SYSTEM.md#body-is-16px) |
| 3 — Platform unity components | `feature/platform-unity-components` | `ContextBar`, `ObjectCard`, `SourceDrawer` + `lib/unity.ts`, `NextSteps`, `QuickCapture`, `lib/status.ts`, `Visibility`, `ScreenGuide` + `lib/explain.ts`, `OpenIn`; `UnityLayer` mounted in all three layouts. Placed: context bars on six surfaces, object cards in Career and University, Next on the deadline, Registration day and Close term | `OpenIn` passed by no placed card; `Visibility` only in Capture; Plan, Research, Data, Community and Advising not reached |
| 4 — Hierarchy, onboarding, disclosure | `feature/information-hierarchy-progressive-disclosure` | `FirstGoal` + `lib/goals.ts`; `CommandCenter` + `lib/widgets.ts`; `LoadingState`, `ErrorState`, `SuccessState`, `PermissionNotice`, `OfflineStrip`; About this screen on every screen, as a sheet on the three that fill their box (`showExplain`, `.fill-with-guide`) | `OfflineStrip` has no queued count |
| 5 — Interaction states and motion | `feature/micro-interaction-system` | `--motion-*` roles zeroed for reduced motion and the app's calm settings; `SaveState`, `Progress`, `StepStatus`, all placed (`SyncState` built, not placed since #777 rewrote Account's sync line) (see [EMPTY-LOADING-ERROR-SUCCESS-STATES.md](EMPTY-LOADING-ERROR-SUCCESS-STATES.md)); sheet entry animation; `.state-body` keeps line breaks | No per-item conflict UI (only `Adopting.tsx`) |
| 6 — WCAG component hardening | `feature/wcag-component-hardening` | Loading now announces itself; glass fallbacks; new components at 44px targets; sync wording held to one set of words across `lib/status.ts` and #777's `SYNC_WORDS`; hand-rolled error boxes replaced by the announced `ErrorState` on eight screens; `ContextBar`/`ObjectCard` actions can be held (`disabled`) while busy | Field-level error pattern; audits of tables, editors, media, charts; Focus bar not measured against the bottom clearance (the assistant sits under the scrim — measured, and held by `tokens.test.ts`) |
| 7 — Trust cues and source UI | `feature/trust-cues-and-source-ui` | Source & details on Today's path snapshot and on every placed context bar and object card; honest `made` / `sample` / `yours` / `connected` origins on the deadline, course hub, guide, Pathway, Career and University (the course hub no longer calls imported courses "Sample course"); Study Studio's draft as "AI-assisted, source-linked" with its generation as named steps | Plan, Research, Data, Campus, Community, Advising; report-issue wiring on AI output |
| 8 — Workspace modes, quick capture | `feature/workspace-modes-quick-capture` | Four modes, `data-workspace`, Settings group, `FocusBar`; Detailed reveals the source sentence on placed object cards; Quick Capture from the header's `+` on every screen (and `q`, the search home's `+`, the palette) via the "Or keep it as" row | |

## Existing files changed

The first pass, which wired the shared layer in:

| File | Change |
| --- | --- |
| `app/src/main.tsx` | Imports `tokens.css` and `unity.css` after the existing sheets |
| `app/src/App.tsx` | `UnityLayer` in each of the three layouts; screen fallback uses `LoadingState`; sets `data-workspace` on the root |
| `app/src/styles/app.css` | Focus ring reads the focus tokens at the same values |
| `app/src/components/shell/ShellBody.tsx` | `ScreenGuide` last on every screen — after `FullBleed` on exempt screens, in `.fill-with-guide` as a sheet on `FILLS` |
| `app/src/components/Command.tsx` | `QuickActions` on the empty Search page |
| `app/src/components/QuickAdd.tsx` | The "Or keep it as" row (`KeepItAs`) |
| `app/src/lib/keys.ts`, `components/Keys.tsx` | ⌘K / Ctrl+K as the one modified-key exception; shown on the help sheet |
| `app/src/screens/Today.tsx` | `FirstGoal` and `CommandCenter` in both feed layouts |
| `app/src/components/TodayDecisionSurface.tsx` | `StatusChip` and Source & details on "Your path" |
| `app/src/components/NotOfficial.tsx` | Leads with the shared "Needs confirmation" chip |
| `app/src/screens/settings/Look.tsx` | "Workspace mode" group |
| `app/src/screens/settings/Index.tsx`, `components/soft/SoftTopBody.tsx` | Sync words were moved to `statusOf(syncStatusKey(…))`; since #777 they read `SYNC_WORDS` (`lib/syncstatus.ts`), held to the same words by `lib/unity.test.ts` |
| `app/src/lib/look.ts` | `WORKSPACE_MODES`, `workspaceModeOf`, `ACCESS_LOOK`; `workspaceMode`, `pinned`, `goal` in `Look` and `readLook` |
| `app/src/state/shape.ts`, `lib/merge.ts`, `lib/export.ts`, `lib/privacy.ts` | The three new look keys: defaults, merge rule (`theirs`), export description, sync group |
| `app/src/styles/density.test.ts`, `deadcss.test.ts`, `lib/export.test.ts` | Cover the new sheets and keys |

The rollout, which placed the components on existing screens (each replaced
that screen's own markup for the same thing):

| File | Now uses |
| --- | --- |
| `screens/Courses.tsx` (`ItemDetail`) | `ContextBar`, `NextSteps` |
| `components/CourseHub.tsx` | `ContextBar` (heading 2); corrected origin label |
| `screens/Guide.tsx` | `ContextBar` |
| `components/StudyStudio.tsx` | `ContextBar` (heading 3, primary held while busy), `StepStatus` |
| `screens/Pathway.tsx` | `ContextBar` (heading 2) |
| `components/toolkit/AssignmentPanel.tsx`, `components/toolkit/Toolkit.tsx` | `ContextBar` (heading 3); `ErrorState` |
| `screens/Career.tsx` | `ObjectCard` |
| `screens/University.tsx` | `ObjectCard` (primary disabled while busy) |
| `screens/Degree.tsx` | `StatusChip` |
| `components/RegistrationDay.tsx` | `ErrorState`, `SuccessState`, `NextSteps` |
| `components/CloseTerm.tsx` | `SuccessState`, `NextSteps` |
| `components/GraduationSimulator.tsx`, `components/RegistrationPortal.tsx`, `components/CampusDirectory.tsx` | `ErrorState` |
| `screens/Account.tsx` | `ErrorState` (the sync line itself is #777's) |
| `components/SupportAccess.tsx` | `ErrorState`, `PermissionNotice` |
| `screens/Import.tsx` | `Progress`, `ErrorState` |
| `screens/Update.tsx` | `Progress`, `StepStatus` |
| `components/TravelPack.tsx` | `Progress` |
| `screens/Export.tsx`, `components/Snapshots.tsx` | `SuccessState` |
| `screens/Family.tsx`, `components/ShareCourse.tsx` | `PermissionNotice` |
| `screens/Write.tsx`, `screens/Mine.tsx`, `screens/settings/Assistant.tsx` | `SaveState` |
| `a11y/tellings.test.ts` | Counts `<ErrorState` as an announced error |
| `app/vite.config.ts` | `rollout-b.test.tsx` added to `MOCKS_MODULES` |

## The migration rule

**Adopting a semantic name changes the name, not the value.** Each token was
introduced at the value the app already draws, so a migration commit should
produce no visual change. If it does, the token is wrong or the site was using
a different value on purpose — stop and find out which.

A migration commit:

1. replaces primitives with semantic names in one file or one component;
2. changes no value;
3. passes the five gates and, for anything visual, a screenshot at one light
   and one dark ground;
4. says in its message which names it adopted.

## Adoption order

What is left, highest value and lowest risk first.

1. **The screens not yet reached.** Plan, Research, Data, Campus (beyond the
   directory's error), Community and Advising, adopting `ContextBar`,
   `ObjectCard`, `NextSteps` and the standard states together, one screen per
   commit with a rollout test beside it.
2. **Open in and Visibility.** Pass `openIn` from the placed object cards
   (Career → Calendar, University → Plan), and use `Visibility` wherever
   something can actually be shared.
3. **Source & details on more rows.** Calendar events, Path requirements,
   Campus services.
4. **The standard states' remaining gaps.** Add `report` to AI output's Source & details; a field-level error
   pattern.
5. **Semantic tokens in shared primitives.** `.btn`, `.input`, `.blueprint`,
   `.kicker` in `app.css` — one class per commit.
6. **The layer ladder.** Replace z-index literals with `--layer-*` names. This
   needs `styles/stacking.test.ts` and `components/fromframe.test.tsx` taught
   to resolve the names first: both parse literal numbers out of `app.css`
   today, so a straight replacement would break them without changing any
   stacking.

## Follow-ups that are decisions, not adoption

- Bundling Atkinson Hyperlegible so that choice means the same on every device.
- Visual regression snapshots (no tooling in the repository).
- (Withdrawn.) An earlier version of this list said the assistant's panel draws
  over the shared sheets' scrim. It does not: measured in Chromium at 1280px in the tab-bar, workspace and shelves layouts, the panel's brightest pixel falls from 716 to 223 when a sheet opens over it; `styles/tokens.test.ts` holds every assistant z-index under `--layer-overlay`.

## Compatibility

- **Additive.** No route, screen, navigation mode, data shape, permission or
  test was removed. Every existing setting keeps its meaning.
- **Look keys.** Three new keys: `workspaceMode` (default `guided`), `pinned`
  (default empty, meaning the three default widgets), `goal` (default empty,
  meaning not yet chosen). `readLook` validates each and falls back safely, so
  a stored value from nowhere renders as the default.
- **Older builds.** `readLook` builds its result from known keys only, so a
  build that predates these keys drops them rather than failing. How an older
  build's hydration and sync treat the extra fields in stored state was not
  checked.
- **Sync.** All three keys take the other device's value on merge, like the
  other arrangement keys.
- **No colour moved.** Every semantic colour resolves to an existing primitive,
  so `contrast.test.ts` results are unchanged.
