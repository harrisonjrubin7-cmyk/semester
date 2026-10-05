# Semester responsive contracts
privacy/export/recovery. Company-site routes: Home, Product, Students,
Institutions, Pricing, Trust, About, and Invite.
These are behavior contracts, not device mockups. Components respond to the
space they receive; routes must not infer capability from a particular phone or
laptop model.

## Supported width bands

| Band | Reference widths | Contract |
| --- | --- | --- |
| Compact | 320–599px | One primary column, bottom/global compact navigation, sheets for contextual detail, local scrollers for wide controls/data. |
| Medium | 600–1023px | One or two columns according to content; persistent context only when the primary action retains sufficient width. |
| Wide | 1024px+ | Bounded reading measure, optional contextual rail, denser comparisons, full navigation where space permits. |

Widths are test points, not hard promises that every component changes at the
same pixel. Existing container/media queries remain authoritative.

## Global invariants

1. The document must not scroll horizontally at 320px. A designated chip, tab,
   timeline, canvas, or table region may scroll locally and must expose a label.
2. Exactly one active `main` and one visible H1 per route.
3. Primary action is visible without opening an overflow menu.
4. Sticky chrome never covers the focused element or final content.
5. Text remains readable at 200% text size and tasks reflow at 400% zoom.
6. Focus order follows the visible order after a layout change.
7. Loading, empty, error, offline, stale, permission, and success states use the
   same geometry as the content they replace to limit layout movement.
8. Media declares intrinsic dimensions or an explicit aspect ratio.

## Layout profiles

### Hub / list

- Compact: heading, primary action, filter/chip rail, then list. Filters may
  scroll locally; each row keeps identity, status, and first action.
- Medium: optional list/detail split if neither pane becomes cramped.
- Wide: bounded list with optional summary or context rail.
- Empty/error replaces the list region, not the whole shell.

### Detail

- Compact: summary and primary action first; metadata and provenance follow.
- Medium: summary and details may split; actions remain near the object title.
- Wide: supporting rail may hold source, history, or related actions.
- Long values wrap; the only action may not live in a clipped trailing column.

### Editor / focused session

- Compact: toolbars wrap or become an explicitly named overflow; editing canvas
  stays primary; autosave/status stays visible.
- Medium: tool groups may sit beside the canvas.
- Wide: secondary inspector may persist without narrowing the working region.
- Escape must not discard work. Keyboard equivalents exist for pointer gestures.

### Data-dense / institutional

- Compact: summarize the record and allow the table/graph region to scroll
  locally. Keep source date, status, and official handoff outside the scroller.
- Medium/wide: add comparison columns progressively.
- Permission and unavailable states fail closed and name the deciding system.

### Conversation

- Compact: transcript occupies the viewport; composer remains reachable without
  obscuring the newest message.
- Medium/wide: participant/context rail is optional.
- Unread boundaries freeze at the opening mark. Sending, audience, and attachment
  state are announced and recoverable.

### Settings / trust

- Compact: one section per flow, controls under labels, consequences adjacent.
- Medium/wide: persistent subnavigation is allowed; do not spread one form across
  columns merely to fill space.
- Export, disconnect, reset, and credential controls state scope and recovery.

## Component contracts

### Page frame

Use the shared page-padding token. Purpose and primary action precede supporting
sections. Wide screens bound prose; full-bleed regions are explicit exceptions.

### Navigation

Compact navigation exposes the canonical destinations, not every route. The
directory and search remain reachable. Selected state is programmatic as well
as visual. At wider widths, labels may expand but order and destination meaning
do not change.

### Tabs and chips

Do not squeeze labels to unreadable widths. Use a labeled local horizontal
scroller with the selected item brought into view. The company site's product
tabs follow this contract; root-level `overflow-x` is prohibited.

### Tables

Prefer responsive lists for action-oriented rows. When comparison requires a
table, keep headers associated, retain a useful first column, and place
horizontal overflow on the table wrapper only.

### Dialogs, popovers, drawers, and sheets

Compact: inset sheet/dialog with all four edges reachable, or bottom sheet where
the interaction benefits from proximity. Medium/wide: anchored popover or modal
may be used. All variants share one semantic dialog relationship, focus trap or
managed focus as appropriate, Escape/Close, and opener focus return.

### Target size

Primary touch targets are at least 44×44 CSS pixels. A smaller visible glyph may
use a non-overlapping pseudo-element hit area. Tested 24×24 WCAG AA exceptions
are allowed only within dense composite controls (for example a drag grip)
where 44px areas would overlap; they require a keyboard path, visible focus, and
an explicit regression test.

## Verification matrix

For a meaningful shared-UI change, test:

- 320×800, 375×812, and 430×932 compact viewports.
- 768×1024 medium viewport.
- 1024×768 and 1440×900 wide viewports.
- keyboard-only use, 200% text, 400% reflow, reduced motion, and forced colors.
- one populated state plus relevant loading, empty, error, offline/permission,
  and success states.
- page overflow, one-main/one-H1, accessible names, focus restoration, and
  console errors.

Representative app routes: Today, Search, All apps, Plan, Courses/course detail,
Study/quiz, My Path, Me/settings, University, registration/gradebook boundary,
privacy/export/recovery. Company-site routes: Home, Product, Students,
Institutions, Pricing, Trust, About, and Invite.
