# Foldables and resizable windows

A foldable, a rotated phone, an iPad in Split View and a desktop window dragged
narrow are all the same event to Semester: the window changed size. None of
them is detected as a device.

## How a size change is handled

- **Three media queries, not a resize listener.** `useTier()` in
  `lib/media.ts` subscribes to `WIDE`, `DESKTOP` and `HANDHELD` through
  `matchMedia`, which fires only when a boundary is crossed. Dragging a window
  edge re-renders nothing until it crosses 840 or 1200; the 600 and 1600 steps are stylesheet tokens and re-render nothing at all. Rotation and folding
  cross the same boundaries, so the layout follows them with no orientation
  handler.
- **Nothing is written on resize.** No resize or rotation writes to app state.
  The only resize side effect is the CSS variable `--bottom-chrome`
  (`lib/bottomchrome.hook.ts`), plus position recalculation in popovers and
  the assistant. So a resize cannot change a saved preference, and returning
  to the old size restores the old layout exactly.
- **Selection survives.** See [MASTER-DETAIL-PATTERNS.md](MASTER-DETAIL-PATTERNS.md).
  The open message, thread, slide or folder is state, and the arrangement is
  derived from it.
- **Orientation is not locked.** `public/manifest.webmanifest` has no
  `orientation` key.

## The states

| State | Width × height (typical) | Semester tier |
| --- | --- | --- |
| Folded outer screen / phone portrait | 360–430 × 700+ | phone |
| Phone landscape | 700–932 × 360–430 | phone (the `HANDHELD` rule) |
| Unfolded portrait / iPad mini portrait | 600–744 × 800+ | phone, medium (column fills the device on a coarse pointer) |
| iPad portrait | 768–834 × 1000+ | phone, medium — the tab bar, as the spec puts a portrait tablet |
| iPad Split View, half | 507–678 | phone |
| iPad landscape | 1024–1194 | tablet, expanded (the rail) |
| 13-inch iPad landscape | 1366 | desktop, large |
| Laptop window | any | by width |

## Known edges

- **Tabletop posture** (upper half / lower half) is not handled. The web
  platform exposes it only through the Viewport Segments API, which is not
  widely available. Nothing breaks: the window is laid out as one surface.
- **Short desktop windows** keep the desktop layout. `HANDHELD` also requires a
  coarse pointer, so a laptop window dragged short is not given a thumb bar.
- **Mail's reading-pane setting** (`right` / `bottom` / `off`) is wide-only
  and synced to the account. A phone ignores it, since the message replaces
  the list there, so it cannot make a phone unusable.
