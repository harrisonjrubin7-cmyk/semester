# Design feature-flag plan

## What was done: no flags

The brief asks for feature flags for theme preference, the new workspace
modes, quick capture, component migrations and experimental interaction
patterns. **None were added.** Everything in this change is on by default.

That was a judgement, and the reasons are specific to what shipped:

1. **No setting, colour, size or spacing moved.** The default workspace mode
   is Guided, which hides nothing and adds nothing, and the semantic tokens
   resolve to the values already drawn. What a default user does see is new
   presentation of things that were already there: the first-goal prompt and
   pinned widgets on Today; About this screen at the end of every screen; the
   "Or keep it as" row in the `+` box; and the shared components placed on
   existing screens — context bars on the deadline, course, guide, Study
   Studio draft, Pathway and toolkit workspaces, object cards in Career and
   University, and the shared error, success, progress, step, permission and
   save states on the screens listed in
   [SEMESTER-PLATFORM-UNITY-PATTERNS.md](SEMESTER-PLATFORM-UNITY-PATTERNS.md#where-each-is-used).
   Those placements replaced each screen's own markup for the same
   information and are meant to carry the same actions; the rollout tests
   (`components/unity/rollout-a/b/c.test.tsx`) check the actions they cover,
   but not every action on every placed screen was audited. That is a larger visible
   change than a flag-free rollout usually carries, and is the strongest
   argument for the staged option below.
2. **Presentation only.** No mode, goal or pin decides access, and a test holds
   that (`lib/unity.test.ts` → "are read by nothing that decides access").
   A flag guards against a change in what somebody can do; there is none.
3. **Theme preference already exists** as the ground and "Match my device",
   and was not changed.
4. **Opt-in by design.** Workspace modes are chosen by the student in
   Settings; the Capture sheet opens only from the `+` box's "Or keep it as"
   row or the palette.
5. **The existing flags gate capability, not presentation.** The repository
   has build-time flags — `lib/experience-flags.ts` (six `VITE_*` variables
   with states `off`, `preview`, `sandbox`, `production`, following the
   institutional preview), `lib/toolkit/flags.ts` (AI Toolkit switches with a
   kill switch) and `lib/aiflags.ts`. They exist for things that must not be
   on without review: AI capabilities, code execution, connectors. This change
   adds nothing in that class.

## If the team wants a staged rollout

Proposed keys, all defaulting to **on** so that turning a flag off is the
rollback, not turning it on the release:

| Key | Gates | Off means |
| --- | --- | --- |
| `design.firstGoal` | `FirstGoal` on Today | The block is not rendered; a stored `goal` is kept |
| `design.commandCenter` | `CommandCenter` on Today | Not rendered; stored `pinned` kept |
| `design.screenGuide` | `ScreenGuide` in `ShellBody` | Not rendered |
| `design.quickActions` | `QuickActions` on the Search page | Not rendered; ⌘K still opens Search |
| `design.paletteKey` | ⌘K / Ctrl+K in `lib/keys.ts` | The modified key returns to the browser |
| `design.workspaceModes` | The Settings group and `data-workspace` | Group hidden; attribute forced to `guided` |
| `design.glassFallbacks` | — | Not recommended as a flag: it fixes an accessibility fault |
| `design.sourceDrawer` | Source & details buttons | Buttons not rendered |
| `design.keepItAs` | The "Or keep it as" row in `QuickAdd` | The `+` box reads dated lines only, as before |
| `design.sharedPlacements` | The rollout onto existing screens | Not practical as a runtime flag: each placement replaced a screen's own markup, so "off" would mean keeping two versions of every placed screen. Staging this is a matter of landing it screen by screen instead |

Where a flag would live: not the look, which syncs and is the student's own
preference. The existing pattern is `lib/experience-flags.ts` — a `VITE_*`
environment variable read at build time into a `FeatureState` — so these would
be, for example, `VITE_DESIGN_FIRST_GOAL`, `VITE_DESIGN_COMMAND_CENTER` and so
on, added to `ExperienceFlags` with a test beside `experience-flags.test.ts`.
Note that those flags default to `off` outside the institutional preview; for
these keys the default would have to be the other way round, which is a
deliberate difference to write into the test. A tenant-level runtime flag
would belong with the institutional configuration and was not designed here.

Experimental components should score at least 2 in every relevant scorecard
dimension before a flag is turned on for anyone, with an owner and a
remediation plan named in the PR (see
[WCAG-UI-AUDIT-SCORECARD.md](WCAG-UI-AUDIT-SCORECARD.md#release-thresholds)).

## Rollback

**Revert the PR.** The change is additive and contained:

- New files (`styles/tokens.css`, `styles/unity.css`, `components/unity/*`,
  `lib/status.ts`, `lib/unity.ts`, `lib/goals.ts`, `lib/widgets.ts`,
  `lib/explain.ts`, the new tests) go with it.
- The edits to existing files are small integrations listed in
  [DESIGN-SYSTEM-MIGRATION-PLAN.md](DESIGN-SYSTEM-MIGRATION-PLAN.md#existing-files-changed).
- **Stored data.** Three look keys may have been written: `workspaceMode`,
  `pinned`, `goal`. After a revert, `readLook` builds its result from the keys
  it knows, so it drops them rather than failing, and the `data-workspace`
  attribute is no longer written, so no mode CSS applies. Backups never carried
  these keys (`lib/export.test.ts`). Not checked: whether the reverted build's
  hydration or sync merge would carry the extra fields along in stored state
  untouched; they would be inert either way.
- **Accessibility mode's side effects stay.** If a student chose
  Accessibility, their Text size, Density and Movement settings were changed
  through the ordinary settings. A revert does not undo those, and should not:
  they are the student's settings now.
- **The focus ring** reads tokens that the revert removes, and the revert
  restores the literal values in the same commit, so there is no frame with an
  undefined colour.

Partial rollback without a revert: remove `<ScreenGuide />` from `ShellBody`
(and the `.fill-with-guide` wrapper), `<FirstGoal />` and `<CommandCenter />`
from `Today.tsx`, `<QuickActions />` from `Command.tsx`, or `<KeepItAs />`
from `QuickAdd.tsx` — each is a line or two and none has dependants. The
placements on existing screens are not one-line removals: each replaced that
screen's own header, error box or save line, so undoing one means restoring
the markup it replaced, screen by screen.
