# Master–detail patterns

List/detail is the pattern that keeps a capability intact as the width
changes. On a narrow window the detail replaces the list, with a visible way
back. On a wide one it sits beside the list. The choice of which one is shown
is layout state, never data, so nothing selected is lost when the window
crosses a boundary.

## As built

| Screen | Narrow | Wide | What survives a resize |
| --- | --- | --- | --- |
| Mail (`screens/Mail.tsx`) | List → message replaces it → Back | List + reading pane (right, bottom or off) | Open message (`state.mailOpen`), folder, search, page |
| Assistant history (`ai/Chat.tsx`) | Conversation, history as an overlay | History column + conversation | Open thread |
| Classmates (`screens/Classmates.tsx`) | List → room replaces it | List + room | Open row |
| Deck editor (`screens/deck/Edit.tsx`) | Slides stacked above editor | Slides beside editor | Selected slide |
| Drive (`screens/mine/Drive.tsx`) | Folders stacked above files | Folders beside files | Current folder |

The selected item lives in store state or in the component's own state, never
in the layout. Crossing 840px therefore redraws the same selection in a
different arrangement. It does not reset it. Mail's paging resets only when the
folder, tab or search changes, and not when the width does.

## Rules

1. **Selection is state, arrangement is derived.** Keep "which item is open"
   out of any branch that tests the width.
2. **A narrow detail always has a visible Back.** The header draws one on every
   screen. A detail inside a screen (Mail's reader) draws its own close
   control as well.
3. **Controls that live in the list's toolbar on a wide window need a home on
   a narrow one.** Mail's pager is the example this audit found missing. It
   now has a row of its own under the phone toolbar.
4. **The narrow detail is the same component as the wide one.** Mail passes
   `narrow` to one `Reader`; it does not render a second reader. Two
   components drift, and one of them is the one nobody screenshots.

## Not yet built

The spec's three-pane workspaces (source + asset + notes in Study,
reader + evidence matrix in Research, table + notebook + output in Data) do not
exist as coordinated panes today. Those screens are one column at every width.
Building them is the "adaptive student workspaces" phase, and should follow the
rules above: a pane that collapses on a narrow window becomes a sheet or a
step, and keeps its selection.
