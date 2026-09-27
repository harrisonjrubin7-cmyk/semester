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
| 2 — Typography, light/dark, elevation, glass | `feature/typography-dark-mode` | Glass policy with person-preference fallbacks (`unity.css`, `styles/glass.test.ts`); elevation tokens; `.nums` | No palette change and no new dark mode (both existed and are measured); body stays 13px — open decision in [TYPOGRAPHY-SYSTEM.md](TYPOGRAPHY-SYSTEM.md#open-decision-body-size) |
| 3 — Platform unity components | `feature/platform-unity-components` | `ContextBar`, `ObjectCard`, `SourceDrawer` + `lib/unity.ts`, `NextSteps`, `QuickCapture`, `lib/status.ts`, `Visibility`, `ScreenGuide` + `lib/explain.ts`, `OpenIn`; `UnityLayer` mounted in all three layouts | `ContextBar`, `ObjectCard`, `NextSteps` not yet placed on any screen |
| 4 — Hierarchy, onboarding, disclosure | `feature/information-hierarchy-progressive-disclosure` | `FirstGoal` + `lib/goals.ts`; `CommandCenter` + `lib/widgets.ts`; `LoadingState`, `ErrorState`, `SuccessState`, `PermissionNotice`, `OfflineStrip`; About this screen on every non-exempt screen | About this screen on the 19 exempt screens |
| 5 — Interaction states and motion | `feature/micro-interaction-system` | `--motion-*` roles zeroed for reduced motion and the app's calm settings; `SaveState`, `SyncState`, `Progress`, `StepStatus`; sheet entry animation | Most state components not yet placed; no per-item conflict UI (only `Adopting.tsx`) |
| 6 — WCAG component hardening | `feature/wcag-component-hardening` | Loading now announces itself; glass fallbacks; new components at 44px targets; sync wording unified (`screens/settings/Index.tsx`, `components/soft/SoftTopBody.tsx`) | Field-level error pattern; audits of tables, editors, media, charts |
| 7 — Trust cues and source UI | `feature/trust-cues-and-source-ui` | Source & details on Today's path snapshot and Study Studio's AI draft; `StatusChip` on Today and `NotOfficial`; "AI-assisted, source-linked" label | Rollout to Path, Plan, Research, Data, Career, Campus, Community, Advising; report-issue wiring on AI output |
| 8 — Workspace modes, quick capture | `feature/workspace-modes-quick-capture` | Four modes, `data-workspace`, Settings group, `FocusBar`; Quick Capture via Search quick actions and ⌘K / Ctrl+K | Detailed has no visible effect until `.detail-only` content is placed; no persistent capture launcher; break reminder |

## Existing files changed

| File | Change |
| --- | --- |
| `app/src/main.tsx` | Imports `tokens.css` and `unity.css` after the existing sheets |
| `app/src/App.tsx` | `UnityLayer` in each of the three layouts; screen fallback uses `LoadingState`; sets `data-workspace` on the root |
| `app/src/styles/app.css` | Focus ring reads the focus tokens at the same values |
| `app/src/components/shell/ShellBody.tsx` | `ScreenGuide` after non-exempt screens; `OfflineStrip` while offline |
| `app/src/components/Command.tsx` | `QuickActions` on the empty Search page |
| `app/src/lib/keys.ts`, `components/Keys.tsx` | ⌘K / Ctrl+K as the one modified-key exception; shown on the help sheet |
| `app/src/screens/Today.tsx` | `FirstGoal` and `CommandCenter` in both feed layouts |
| `app/src/components/TodayDecisionSurface.tsx` | `StatusChip` and Source & details on "Your path" |
| `app/src/components/StudyStudio.tsx` | AI-assisted label from the vocabulary; Source & details |
| `app/src/components/NotOfficial.tsx` | Leads with the shared "Needs confirmation" chip |
| `app/src/screens/settings/Look.tsx` | "Workspace mode" group |
| `app/src/screens/settings/Index.tsx`, `components/soft/SoftTopBody.tsx` | Sync words from `statusOf(syncStatusKey(…))` |
| `app/src/lib/look.ts` | `WORKSPACE_MODES`, `workspaceModeOf`, `ACCESS_LOOK`; `workspaceMode`, `pinned`, `goal` in `Look` and `readLook` |
| `app/src/state/shape.ts`, `lib/merge.ts`, `lib/export.ts`, `lib/privacy.ts` | The three new look keys: defaults, merge rule (`theirs`), export description, sync group |
| `app/src/styles/density.test.ts`, `deadcss.test.ts`, `lib/export.test.ts` | Cover the new sheets and keys |

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

Chosen by reach and by risk, highest value and lowest risk first.

1. **Place the built components on the core surfaces.** `ContextBar` on the
   course, item and guide screens; `ObjectCard` for Today's cards and the Path
   requirement list; `NextSteps` at the end of registration readiness and study
   sessions; `SaveState` / `SyncState` near editable work; `StepStatus` in
   Study Studio's generation.
2. **Source & details everywhere a row has a source.** Calendar events, course
   deadlines, Path requirements, Career applications, Campus services.
3. **The standard states.** Replace hand-rolled error and success boxes with
   `ErrorState` and `SuccessState`; wire `OfflineStrip`'s queued count.
4. **About this screen on exempt screens** (see
   [ONBOARDING-AND-CONTEXTUAL-HELP.md](ONBOARDING-AND-CONTEXTUAL-HELP.md#the-exempt-screen-gap)).
5. **Semantic tokens in shared primitives.** `.btn`, `.input`, `.blueprint`,
   `.kicker` in `app.css` — one class per commit.
6. **The layer ladder.** Replace z-index literals with `--layer-*` names. This
   needs `styles/stacking.test.ts` and `components/fromframe.test.tsx` taught
   to resolve the names first: both parse literal numbers out of `app.css`
   today, so a straight replacement would break them without changing any
   stacking.
7. **Screen by screen**, Path, Plan, Research, Data, Career, Campus,
   Community, Advising, adopting the components and tokens together.

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
