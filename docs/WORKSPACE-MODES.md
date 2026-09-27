# Workspace modes

Four presentation modes that change how much of each workspace is drawn —
never what the student can do.

Defined as `WORKSPACE_MODES` in `app/src/lib/look.ts`, stored as the
`workspaceMode` look key (default `guided`), chosen in Settings → Look →
"Workspace mode" (`WorkspaceModePicker` in
`app/src/components/unity/modes.tsx`), and written to the root element as
`data-workspace` by `App.tsx` so the stylesheet can read it without any screen
touching the store.

## The four modes

| Mode | Id | Blurb shown to the student | What it changes |
| --- | --- | --- | --- |
| Guided | `guided` | Next steps and short explanations alongside the work. | Nothing is hidden. This is the app as it was, and the default |
| Focused | `focused` | The current work, its sources and save state — navigation steps back. | Hides `.app-tabs`, `.shelf-nav`, the desktop sidebars (`.rail` on the tab-bar layout, `.desk-side` on the workspace) with their grid columns, `.today-secondary-journey` and anything marked `.hides-in-focus` (`FirstGoal`, `CommandCenter`, `NextSteps`). Shows the Focus bar |
| Detailed | `detailed` | Sources, metadata and deadlines shown up front. | Shows elements marked `.detail-only`, which are hidden otherwise — today, the source sentence on placed object cards |
| Accessibility | `access` | Larger text, more space and less motion, from your own settings. | Sets the existing settings `textSize: 'large'`, `density: 'comfortable'`, `calm: 'still'` (`ACCESS_LOOK`) |

The rules are all in `app/src/styles/unity.css` under "Workspace modes —
presentation only".

### Focused

- Hidden: the tab bar, the shelf navigation, Today's "Also useful" section and
  every `.hides-in-focus` element — the first goal and pinned widgets on Today,
  and the Next section wherever it is placed (the deadline, Registration day,
  Close term).
- Kept: the header, the screen's content, its context bar with its sources
  and save state, About this screen, and the skip link.
- Added: the **Focus bar** (`FocusBar` in `modes.tsx`, mounted by `UnityLayer`
  in all three layouts). A `region` named "Focus mode" fixed at the bottom
  centre, where the tab bar was, holding "Start 25-minute timer" (adds a timer
  labelled "Focus session") and "Exit focus" (returns to Guided). Leaving is one
  press and never a hunt.
- The Search page's quick actions and ⌘K offer "Turn on Focus mode" / "Leave
  Focus mode" as well.

Known limits:

- The desktop sidebars go, and so do their grid columns: hiding only the
  element would auto-place the pane into the rail's track. Measured in
  Chromium at 1280px, the pane runs 0→1280 on the tab-bar layout and 1→1278
  on the workspace in Focused, against 248 and 233 from the left in Guided;
  `styles/tokens.test.ts` holds the rules. The header — back, search, `+` —
  stays, and the Focus bar's Exit is the way out.
- The break reminder (`lib/breaks.ts`, drawn by the Focus bar). After fifty
  minutes of focus the bar says "50 minutes of focus. Time for a short
  break?" and offers **Take a 5-minute break** (a real Break timer, and the
  next stretch starts when it ends), **Not now** (ten minutes) and **No more
  reminders** (for this focus session). A tab hidden for at least five minutes
  counts as a break. The sentence is in a polite `role="status"` line that is
  always in the document — never `display: none`, which some readers stop
  watching — so it is heard without focus being moved; nothing blinks, dims
  or locks the work. `lib/breaks.test.ts` holds the rules and
  `unity.test.tsx` drives it through the store's own clock; checked in
  Chromium at 1280px and 420px with the clock fast-forwarded.
- The Focus bar sits at `--layer-sticky` (20) near the bottom edge. It has not
  been measured against the assistant's floating button or against
  `--focus-clear-bottom` (84px) in a browser.

### Detailed

The only element marked `.detail-only` is the object card's source sentence
(`.object-card-detail` in `ObjectCard.tsx`): the origin's own sentence from
`lib/status.ts` and, where given, the freshness. It is drawn only when the card
has a `source`. Object cards are placed on Career's open opportunity ("You
entered this yourself. Nothing has checked it.") and on University's school
records (the `connected` sentence), so Detailed reveals that line there and
nowhere else yet. Every other screen looks the same in Detailed as in Guided.
It becomes more useful as object cards and further `.detail-only` content are
adopted.

### Accessibility

Accessibility is not a fifth palette. Choosing it dispatches
`setLook({ workspaceMode: 'access', ...ACCESS_LOOK })`, turning on the app's
existing accessibility settings, so there is one Text size setting and not two
that could disagree. The effect is visible in those settings afterwards and can
be undone one at a time there. Choosing another mode afterwards does not undo
them.

It does not change contrast: "Increase contrast" follows the device's
`prefers-contrast: more` (see
[COLOR-AND-DARK-MODE-SPEC.md](COLOR-AND-DARK-MODE-SPEC.md#increase-contrast)),
and there is no in-app contrast setting for the mode to set.

## The presentation-only guarantee

A mode may decide what is drawn first. It may never decide what somebody is
allowed to do.

`app/src/lib/unity.test.ts` → "workspace modes › are read by nothing that
decides access" walks every non-test `.ts`/`.tsx` source that exports a
function named `allowed`, `forRole` or `can…` and mentions a permission or
capability word, asserts it found at least one such file, and fails if any of
them mentions `workspaceMode` or `data-workspace`.

Also by construction:

- Hiding is `display: none` on navigation and extras. The destinations stay
  reachable through the header, Search, ⌘K and the keyboard shortcuts.
- `.hides-in-focus` is applied only to suggestions (`FirstGoal`,
  `CommandCenter`, `NextSteps`), never to a control that saves, submits or
  shows a source.

## Storage and sync

- `readLook` falls back to `guided` for a missing or unknown value
  (`workspaceModeOf`); `lib/unity.test.ts` checks both.
- Syncs with the account, taking the other device's value on merge
  (`workspaceMode: 'theirs'` in `lib/merge.ts`), because how somebody works is
  the same on the laptop as on the phone.
- Listed in the "how the app is set up" sync group in `lib/privacy.ts` and
  described in the export (`lib/export.ts`: "how much of each workspace is
  drawn").

## Tests

| Test | Holds |
| --- | --- |
| `components/unity/unity.test.tsx` → "Accessibility turns on the existing settings rather than inventing its own" | Choosing Accessibility sets `workspaceMode: 'access'`, `textSize: 'large'`, `calm: 'still'` |
| `components/unity/unity.test.tsx` → "Focused draws a way out, and the way out works" | The Focus bar appears only in Focused, and Exit focus returns to Guided |
| `lib/unity.test.ts` → "fall back to Guided and survive a stored value from nowhere" | Default and unknown values; the four ids in order |
| `lib/unity.test.ts` → "are read by nothing that decides access" | The presentation-only guarantee |
