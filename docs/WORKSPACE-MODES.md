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
| Focused | `focused` | The current work, its sources and save state — navigation steps back. | Hides `.app-tabs`, `.shelf-nav`, `.today-secondary-journey` and anything marked `.hides-in-focus` (`FirstGoal`, `CommandCenter`, `NextSteps`). Shows the Focus bar |
| Detailed | `detailed` | Sources, metadata and deadlines shown up front. | Shows elements marked `.detail-only`, which are hidden otherwise |
| Accessibility | `access` | Larger text, more space and less motion, from your own settings. | Sets the existing settings `textSize: 'large'`, `density: 'comfortable'`, `calm: 'still'` (`ACCESS_LOOK`) |

The rules are all in `app/src/styles/unity.css` under "Workspace modes —
presentation only".

### Focused

- Hidden: the tab bar, the shelf navigation, Today's "Also useful" section and
  every `.hides-in-focus` element.
- Kept: the header, the screen's content, its sources, its save state, About
  this screen, and the skip link.
- Added: the **Focus bar** (`FocusBar` in `modes.tsx`, mounted by `UnityLayer`
  in all three layouts). A `region` named "Focus mode" fixed at the bottom
  centre, where the tab bar was, holding "Start 25-minute timer" (adds a timer
  labelled "Focus session") and "Exit focus" (returns to Guided). Leaving is one
  press and never a hunt.
- The Search page's quick actions and ⌘K offer "Turn on Focus mode" / "Leave
  Focus mode" as well.

Known limits:

- Only the tab bar and shelf navigation are hidden. The desktop and workspace
  layouts' own sidebars and rails are not listed and stay visible.
- The brief's optional break reminder is not built.
- The Focus bar sits at `--layer-sticky` (20) near the bottom edge. It has not
  been measured against the assistant's floating button or against
  `--focus-clear-bottom` (84px) in a browser.

### Detailed

The only element marked `.detail-only` today is the object card's source
sentence (`.object-card-detail` in `ObjectCard.tsx`). `ObjectCard` is not yet
placed on any screen, so **Detailed currently has no visible effect in the
app**. It becomes meaningful as object cards and further `.detail-only`
content are adopted.

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

(The comment above `WORKSPACE_MODES` in `lib/look.ts` names
`components/unity/modes.test.tsx` as the holder of this rule; that file does
not exist, and the test is the one in `lib/unity.test.ts`.)

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
