# WCAG 2.2 UI audit scorecard

> Owner, version, last and next review, status, supersedes and related decisions: [`SEMESTER-OPERATING-SYSTEM.md`](../SEMESTER-OPERATING-SYSTEM.md).

A reusable scorecard for component and screen release review, and the first
pass of it over the components the brief lists. Every score below cites the
test, script or file it rests on. A score with no evidence is not given: those
cells say `·` (not audited in this change), which is different from a pass.

## The scale

| Score | Meaning |
| --- | --- |
| 0 | Fails, or missing |
| 1 | Partially implemented |
| 2 | Meets the baseline requirement |
| 3 | Exemplary: polished, documented, and held by a test that fails when it regresses |
| – | Not applicable to this component |
| · | Not audited in this change — no claim either way |

"Held by a test" means a test in `npm test` or a lint in `npm run lint`. A
browser sweep that is not a CI step (`sweep:contrast`, `sweep:targets`,
`smoke:a11y`) supports a 2 but not a 3 on its own.

## The dimensions

| Code | Dimension | What 2 requires |
| --- | --- | --- |
| Con | Contrast | Text 4.5:1 (3:1 large), non-text marks 3:1, on every ground |
| Tgt | Target size | 24×24 CSS px minimum (SC 2.5.8); 44 for primary touch controls |
| Foc | Focus visible | The app ring, not suppressed |
| Obs | Focus not obscured | Not hidden by sticky header, tab bar, sheets (SC 2.4.11) |
| Key | Keyboard | Every action reachable and operable; no trap except a modal's |
| SR | Screen reader | Name, role, state, value; live regions used sparingly |
| Ref | Reflow at 320px | No two-dimensional scrolling for ordinary content |
| Drg | Drag alternative | A non-drag way to do every drag (SC 2.5.7) |
| Err | Error prevention and recovery | Errors in words beside the cause; recovery; confirm or undo destructive actions |
| Mot | Motion | Honours reduced motion (device and app setting); no motion-only state |
| Tok | Token use | Semantic or scale tokens, no stray colour or off-scale values |
| Src | Source / policy / privacy clarity | Where applicable: origin, freshness, who can see it |
| Par | Responsive parity | Same capability on phone, tablet, desktop; only layout changes |

## App-wide evidence

Several dimensions are decided once for the whole app. A component inherits
these scores unless its row says otherwise.

| Dim | App-wide score | Evidence |
| --- | --- | --- |
| Con | 3 for anything drawn from tokens | `lib/contrast.test.ts` checks all 143 accent × ground pairings, every text rung on every surface, non-text fills at 3:1, the warn colour, the glow under text. `scripts/contrast-sweep.mjs` measures painted pixels. `styles/tokens.test.ts` stops the semantic layer and `unity.css` writing their own colours |
| Tgt | 2 | `.tap`, `.tap-x`, `.tap-y` grow targets to 44px (`styles/taps.test.ts`); `.btn` has a 44px floor and chips keep real-px reach at every density (`styles/reach.test.ts`). The `reach.test.ts` header records 0 of 1480 phone and 0 of 2082 desktop controls under 24×24 at all three densities, measured by `scripts/targets-sweep.mjs` (not a CI step) |
| Foc | 3 | `.device :focus-visible` draws a 2px `--focus-color` outline, offset 2px; `a11y/focus.test.ts` holds that it is an outline, is offset, and is not switched off by any rule without being redrawn. Forced-colours variant uses `Highlight` |
| Obs | 2 | `scroll-margin-top: var(--focus-clear-top)` (96px) and `scroll-margin-bottom: var(--focus-clear-bottom)` (84px) on every focused element, clear of the frosted header and tab bar. Held for value by `tokens.test.ts`; not measured per component |
| Mot | 3 | Device query, app `data-calm` setting, and `scrollKindly`; `a11y/calm.test.ts`, `a11y/motion.test.ts`, `tokens.test.ts` (every `--motion-*` role zeroed on both paths) |
| SR (labels) | 2 | `npm run lint` runs `scripts/labels.mjs`; `a11y/labels.test.ts` holds the label rule (no placeholder-only names, no name hidden by CSS) |
| SR (structure) | 3 | One `main`, one `h1`, named navigation landmarks (`a11y/landmarks.test.ts`); window title (`a11y/title.test.ts`) |
| Ref | 2 on the smoke journeys | `scripts/accessibility-smoke.mjs` (`npm run smoke:a11y`) checks Home, Calendar, Courses, Assignments, Registration and Degree for overflow at 320 CSS px against the production bundle. Not a CI step. Other screens: `·` |
| Tok (sizes) | 3 | `styles/textscale.test.ts` (every stylesheet font size answers Text size), `styles/rules.ts` (inline sizes), `styles/density.test.ts` (spacing answers Density) |

## Component matrix

Scores after this change. **Before → after** is filled only for components
this change touched. Blank inherited cells take the app-wide score above.

| # | Component | Where | Con | Tgt | Foc | Obs | Key | SR | Ref | Drg | Err | Mot | Tok | Src | Par | Before → after | Evidence |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | Primary button | `.btn-primary`, `ActionButton` (`components/ui.tsx`) | 3 | 3 | 3 | 2 | 2 | 2 | 2 | – | – | 3 | 2 | – | 2 | unchanged | Native `<button>`; 44px floor on `.btn`, `ActionButton` height 46; `--chrome-ink` on the brushed metal measured on all light grounds (`contrast.test.ts`) |
| 2 | Secondary button | `.btn-ghost`, `.btn-secondary`; new `.link-quiet` | 3 | 2 | 3 | 2 | 2 | 2 | 2 | – | – | 3 | 3 | – | 2 | `.link-quiet` added | `.link-quiet` is a dotted-underlined text button in `--text-secondary`, always with `.tap-y`; sizes from the type scale (`tokens.test.ts`) |
| 3 | Icon button | Across screens | 3 | 2 | 3 | 2 | 2 | 2 | · | – | – | 3 | 1 | – | · | unchanged | Named by the label lint; many size and colour values still inline |
| 4 | Text link | `.link-quiet`, `.workspace-text-button` | 3 | 2 | 3 | 2 | 2 | 2 | 2 | – | – | 3 | 2 | – | 2 | `.link-quiet` added | Underline, not colour alone |
| 5 | Bottom navigation | `.app-tabs` | 3 | 2 | 3 | 2 | 2 | 3 | 2 | – | – | 3 | 1 | – | 2 | glass fallback 1 → 3 | Named `nav` landmark (`landmarks.test.ts`); frosted surface now opaque for reduced transparency, more contrast, forced colours and Low stimulation (`styles/glass.test.ts`); hidden in Focused mode, replaced by the Focus bar |
| 6 | Navigation rail | Desk and workspace layouts; `components/mail/Rail.tsx` | 3 | 2 | 3 | 2 | · | 3 | · | – | – | 3 | · | – | · | unchanged | Rail is a named landmark (`landmarks.test.ts`) |
| 7 | Tabs | `TabList` (`components/ui.tsx`), `TabStrip` | 3 | 2 | 3 | 2 | · | 2 | · | – | – | 3 | · | – | · | unchanged | `role="tablist"`; arrow-key behaviour not audited here |
| 8 | Breadcrumbs | — | – | – | – | – | – | – | – | – | – | – | – | – | – | not present in app | Navigation is a history stack with Back; "breadcrumb" appears only in a comment |
| 9 | Global search | `components/Command.tsx` | 3 | 2 | 3 | 2 | 3 | 2 | 2 | – | 3 | 3 | 1 | – | 2 | ⌘K added; quick actions added | `/` and ⌘K / Ctrl+K open it, not while typing or under a modal (`lib/unity.test.ts` "⌘K / Ctrl+K"); `useModal`; many inline style values |
| 10 | Command palette | Same page + `QuickActions` | 3 | 2 | 3 | 2 | 3 | 2 | 2 | – | 3 | 3 | 3 | – | 3 | not present → built | Only reversible actions, by design (`Command.tsx` "No commands"); a named group; the same chips on a phone |
| 11 | Card / decision card | `ObjectCard` on Career's open opportunity and University's school records; Today's decision surface | 3 | 2 | 3 | 2 | 2 | 3 | 2 | – | 2 | 3 | 3 | 3 | 2 | no shared card → `ObjectCard`, placed on two screens | `<article>` labelled by its heading, heading level as a prop, exactly one primary, primary held while its action runs (`unity.test.tsx`); placed cards checked on their screens, including the University primary only when writing is allowed (`rollout-b.test.tsx`); `unity.css` semantic tokens only. Par 2: wraps by construction, not measured at 320px |
| 12 | Data table | `<table>` in eight files | · | · | 3 | · | · | · | · | – | · | 3 | · | · | · | unchanged | Not audited |
| 13 | Filter controls | `ChipRow`, `PickChips`, `.chiprow .btn` | 3 | 2 | 3 | 2 | 2 | · | 2 | – | – | 3 | 2 | – | 2 | unchanged | Chip reach kept in real px at every density (`reach.test.ts`) |
| 14 | Form field | `.input`, `.device .input:focus-visible` | 3 | 2 | 3 | 2 | 2 | 2 | · | – | 1 | 3 | 2 | – | 2 | unchanged | Labels (`labels.test.ts`); 16px floor on coarse pointers (`styles/fields.test.ts`). Brief's inline error + error summary + focus to first invalid field is not a shared pattern |
| 15 | Select / combobox | Native `<select>`; `role="combobox"` in `components/desk/TopBar.tsx` | 3 | 2 | 3 | 2 | 2 | 2 | · | – | – | 3 | · | – | 2 | unchanged | Native select labelled (`labels.test.ts`); the desk combobox not audited |
| 16 | Date / time picker | Native `type="date"` / `"time"` | 3 | 2 | 3 | 2 | 2 | 2 | · | – | · | 3 | · | – | 2 | unchanged | Native controls; QuickAdd parses dates from text as the alternative |
| 17 | Checkbox / radio / switch | `Toggle` (`role="switch"`), `TickBox`; new radios in `Visibility` and `WorkspaceModePicker` | 3 | 3 | 3 | 2 | 3 | 3 | 2 | – | – | 3 | 3 | – | 2 | new radio rows | New radios: `fieldset`/`legend`, native inputs at `--target-min` 24px inside a label row of `--target-primary` 44px (`tokens.test.ts`), explanation beside each option |
| 18 | Tooltip / popover | `TabPeek` (`role="tooltip"`), `components/Popover.tsx`; `StatusChip` `title` | 3 | · | 3 | · | · | 2 | · | – | – | 3 | · | – | · | unchanged | `TabPeek` never takes focus; `StatusChip`'s sentence is also in the drawer, so nothing is only in a `title` |
| 19 | Modal / dialog | `useModal` (`a11y/modal.ts`) | 3 | 2 | 3 | – | 3 | 3 | · | – | – | 3 | · | – | 2 | unchanged | Every `aria-modal="true"` file uses `useModal` (`a11y/modal.test.ts`); tab ring wraps; Escape handled inside |
| 20 | Bottom sheet / drawer | New `.unity-sheet` (Source & details, Capture, About this screen); existing `QuickAdd`, `.soft-folder` | 3 | 2 | 3 | – | 3 | 3 | 2 | – | – | 3 | 3 | – | 2 | new shared sheet | Focus moves in, Escape closes, focus returns to opener (`unity.test.tsx`); bottom sheet in the phone frame, centred window on a desk; entry animation on `--motion-sheet`. The assistant's button and panel sit under the scrim: measured in Chromium at 1280px in the tab-bar, workspace and shelves layouts, the panel's brightest pixel falls from 716 to 223 when a sheet opens over it; `styles/tokens.test.ts` holds every assistant z-index under `--layer-overlay` |
| 21 | Toast / inline alert | `Undone`, `Notice`, `OfflineStrip` | 3 | 2 | 3 | 2 | 2 | 3 | 2 | – | 3 | 3 | 2 | – | 2 | `OfflineStrip` added | `Undone` polite, never takes focus, 8s (`lib/undo.ts`); error messages announced (`a11y/tellings.test.ts`); offline strip in the flow, not fixed |
| 22 | File upload | `FilePick` (`components/ui.tsx`); `Progress` on Update and Import (reading several files) and the travel pack download | 3 | 2 | 3 | 2 | 2 | 3 | · | – | 3 | 3 | · | · | 2 | `Progress` built and placed; Import failures 2 → 3 | A real `<progress>` named by its label with Cancel; Import's retryable failures are an `ErrorState` titled by what failed, and `Trouble` stays for a failure with nothing to retry (`rollout-c.test.tsx`); Update's single-file read is a `StepStatus` (`rollout-a.test.tsx`) |
| 23 | Rich-text editor | `screens/Write.tsx` / `screens/write/`, `screens/deck/Canvas.tsx` | · | · | 3 | · | · | · | · | · | · | 3 | · | · | · | unchanged | Not audited |
| 24 | Calendar / scheduler | `screens/Calendar.tsx` | 3 | 2 | 3 | 2 | 2 | · | 2 | 3 | · | 3 | · | 2 | 2 | unchanged | `Calendar.keyboard.test.tsx`, `calendar-targets.test.ts`; drag alternative held by `a11y/dragging.test.ts`; feed freshness via `where.ts`; About this screen after the grid (full-bleed, opens in place) |
| 25 | Chart / graph | `Meter` (`components/ui.tsx`), spreadsheet charts | 3 | – | – | – | – | 2 | · | – | – | 3 | · | · | · | unchanged | `Meter` carries its figure in words (`a11y/tellings.test.ts`: every bar that carries a number says it). Chart data-table alternatives not audited |
| 26 | Media player | `components/Sound.tsx`, video in `creation/VideoEditor.tsx`, calls | · | · | 3 | · | · | · | · | – | · | 3 | · | · | · | unchanged | `<track kind="captions">` present in `Sound.tsx`; `npm run transcripts` generates transcripts. Controls not audited |
| 27 | Code editor | — | – | – | – | – | – | – | – | – | – | – | – | – | – | not present in app | |
| 28 | Drag / reorder list | Launcher, shelves, settings lists; new `CommandCenter` | 3 | 2 | 3 | 2 | 3 | 2 | 2 | 3 | – | 3 | 3 | – | 3 | command centre built without drag | Every draggable ordering can also be rearranged by tapping (`a11y/dragging.test.ts`); command centre uses Move up / Move down / Unpin behind Arrange (`unity.test.tsx`) |
| 29 | Source drawer | `SourceDrawer` via `showSource()` or a `source` prop | 3 | 2 | 3 | – | 3 | 3 | 2 | – | – | 3 | 3 | 3 | 2 | not present → built; on Today and on every placed context bar and object card | Dialog named "Source & details", `dl` of origin, source, freshness, sources used, used in, limitations, visibility (`unity.test.tsx`); what each placement says is checked on its screen (`rollout-a.test.tsx`: where a deadline's date came from) |
| 30 | Policy / disclosure form | `NotOfficial`, Study Studio policy gating, `Visibility` | 3 | 2 | 3 | 2 | · | 2 | · | – | · | 3 | 2 | 2 | · | `NotOfficial` leads with the shared chip | Shared "Needs confirmation" wording; not audited as a form |
| 31 | Empty / loading / error state | `EmptyState`, `LoadingState`, `ErrorState` (eight screens), `SuccessState` (four) | 3 | 2 | 3 | 2 | 2 | 3 | 2 | – | 3 | 3 | 3 | – | 2 | loading SR 1 → 3; hand-rolled error boxes → `ErrorState` | Screen fallback said nothing to a screen reader; `LoadingState` adds a polite status and `aria-busy`. `ErrorState` requires a recovery action (`unity.test.tsx`) and is counted as announced by `a11y/tellings.test.ts`; placements checked in `rollout-b.test.tsx` and `rollout-c.test.tsx` |
| 32 | Notification center | — | – | – | – | – | – | – | – | – | – | – | – | – | – | not present in app | Notification preferences exist; no in-app centre |
| 33 | Quick capture launcher | The header's `+` (`QuickAdd`) with "Or keep it as" → `QuickCapture` | 3 | 2 | 3 | – | 3 | 3 | 2 | – | 2 | 3 | 3 | 3 | 3 | not present → built; Par 1 → 3 | One launcher on every screen in every layout, also `q` and the search home's `+` (`lib/onframe.test.ts` keeps it reachable); the typed line is carried into the Capture sheet (`unity.test.tsx` "is reached from the + box"); focus lands on the field; empty Save disabled; "Saved" announced; visibility stated |
| 34 | Context bar | `ContextBar` on the deadline, course hub, study guide, Study Studio draft, Pathway programme and toolkit assignment workspace | 3 | 2 | 3 | 2 | 3 | 3 | 2 | – | 2 | 3 | 3 | 3 | 2 | not present → built and placed on six surfaces | Named section; never sticky; rows wrap; title a real `h2`/`h3` where it replaced the section header, never `h1`; actions held while they cannot run (`unity.test.tsx`); each placement checked on its screen (`rollout-a.test.tsx`, `rollout-b.test.tsx`, `rollout-c.test.tsx`); takes the host surface inside a card, so no card-in-card. Par 2: not measured at 320px |
| 35 | Privacy / visibility control | `Visibility` | 3 | 3 | 3 | 2 | 3 | 3 | 2 | – | – | 3 | 3 | 3 | 2 | not present → built | "Who can see this?" as `legend`; offers only `allowed` audiences (`unity.test.tsx`); 44px rows (`tokens.test.ts`) |
| 36 | Workspace toolbar | New `FocusBar`; existing desk toolbars | 3 | 2 | 3 | 1 | 2 | 2 | 2 | – | – | 3 | 3 | – | 2 | Focus bar built | Named region; Exit focus tested (`unity.test.tsx`). Obs 1: fixed at the bottom; not measured against the assistant button or the 84px clearance |
| 37 | Command / action menu | `QuickActions`; `OpenIn` (supported by `ObjectCard`, not passed by any placed card) | 3 | 2 | 3 | 2 | 2 | 3 | 2 | – | 3 | 3 | 3 | – | 2 | not present → built | Named groups; labelled buttons, never icons alone; `OpenIn` pushes a history entry so Back returns (`unity.test.tsx`); "Capture something" opens the same `+` box as the header |

### Reading the matrix

- The new shared components score 3 on tokens because `tokens.test.ts` fails
  on any colour, off-scale font size or non-role motion in `unity.css`, and
  `density.test.ts` allows zero unscaled spacing there.
- The shared components are placed on real screens, and the rollout tests
  (`components/unity/rollout-a.test.tsx`, `rollout-b.test.tsx`,
  `rollout-c.test.tsx`) mount those screens and check them. A component's
  score is still a score for the component; a screen that adopts it inherits
  the score only for what the component draws. `OpenIn` and `Visibility`
  (outside the Capture sheet) are the two not yet on any screen.
- The largest unaudited areas are data tables, the rich-text editors, media
  controls and chart alternatives. None of them was changed.

## Release thresholds

From the brief, with the evidence this repository can supply for each.

| Class | Minimum | Mandatory before release | How it is shown here |
| --- | --- | --- | --- |
| Primary navigation, buttons, forms, dialogs | 2 in every relevant dimension; no critical defect | — | This matrix; `npm test`, `npm run lint` |
| Authentication, privacy, policy, report, block, appeal | 2 | Keyboard and screen-reader task test | A jsdom test that drives the flow by named controls (as `unity.test.tsx` does), plus a manual screen-reader pass recorded in the PR |
| Data, code, research workspace | 2 | Compact alternative verified | Screenshot at phone width via `.claude/skills/run`; `smoke:a11y` at 320px |
| Media, charts, schedules | 2 | Accessible alternative | A text or table alternative in the DOM, asserted by a test |
| Moderation and admin actions | 2 | Confirmation, audit, role test, focus management | `TypeToConfirm` or undo; role test through the capability helpers; `useModal` |
| Experimental component | 2 before flag rollout | Owner and remediation plan | See [DESIGN-FEATURE-FLAG-PLAN.md](DESIGN-FEATURE-FLAG-PLAN.md) |

A `·` in a relevant dimension blocks release of that component in a class
above until it is audited.

## Using this scorecard for a new component

1. Copy the row format. Fill a cell only with a score you can cite.
2. Inherit the app-wide rows only if the component uses the shared mechanisms:
   `.device :focus-visible` (not overridden), `.tap`/`.btn`, the type and
   spacing scales, the `--motion-*` roles, semantic colour tokens.
3. A 3 needs a test that would fail if the behaviour regressed. Prove it by
   reverting the fix and watching the test go red (see `CLAUDE.md`).
4. Record before → after in the PR description.
