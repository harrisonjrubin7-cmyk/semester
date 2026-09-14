/**
 * How many things the header's action row can carry, and which one yields.
 *
 * `lib/chrome.ts` decides the navigation and deliberately does not count the
 * header — the header belongs to the screen you are on rather than being drawn
 * beside it. This is the header's own arithmetic, and it exists because the row
 * had grown past the width it is drawn in without anybody measuring.
 *
 * ## The measurement
 *
 * Every icon button draws 36px and carries a `.tap` overlay that grows the hit
 * area to 44px, so the row's pitch is exactly 44 and neither number may move —
 * `header.test.ts` holds both. Six of them is 256px of controls, the header's
 * own gutter is 18 down each side, and the timer pill is 83px at its widest
 * ("1 h 11 min"). That is 339 before the title has a pixel, and a phone is 320
 * at the narrowest.
 *
 * Measured in the browser rather than reasoned about: at 320px with a timer
 * running, the row's right edge landed at 331 — eleven past the window — and
 * the clipped control was the last one, the avatar. The title had already been
 * squeezed to zero before that, so the row was not merely tight, it was
 * overflowing and hiding a control with no indication that it had.
 *
 * ## Why the avatar is the one that yields
 *
 * Not because it is new. Because on a root screen it is the only one of the
 * six with another route from where you are standing: the tab bar's Progress
 * tab lists it, the All apps grid has it as a tile, and typing "profile" — or
 * "who am i" — into the search beside it lands on it. The timer pill is the
 * one thing in the row that is *counting*, and `components/Running.tsx` is
 * about the session somebody loses when it is not in front of them; the other
 * four are the only doors to what they open.
 *
 * So on a phone the row carries five, a running timer is one of the five, and
 * the avatar comes back the moment the timer stops or the window is wide
 * enough for the rail. Nothing is ever clipped, and nothing is unreachable.
 *
 * This also fixes a case that predates the avatar: the feed layout already
 * drew six on a root, and already overflowed at 320 with a timer running.
 */

export interface Row {
  /** A root screen — the only place the row is at its longest. */
  atRoot: boolean;
  /** A phone, rather than a window with room for the rail. See `lib/media.ts`. */
  phone: boolean;
  /** Whether the timer pill is in the row, which is the variable-width one. */
  counting: boolean;
}

/**
 * Whether the header draws the avatar.
 *
 * Pure and tiny on purpose: the alternative is three conditions written into
 * the markup, which is exactly the shape `lib/chrome.ts` was written to stop
 * — and the previous version of this rule was one of them, `state.nav ===
 * 'feed'`, which hid the app's own profile from three of its four navigations
 * and did not stop the overflow in the fourth.
 */
export function showsAvatar({ atRoot, phone, counting }: Row): boolean {
  if (!atRoot) return false;
  return !(phone && counting);
}

/**
 * Everything else the header draws in that row — and why most of it is a `no`
 * in the workspace.
 *
 * `lib/chrome.ts` guarantees no two *navigations* are on screen together, and
 * says in its own words that the header is not its business: "the header
 * belongs to the screen you are on rather than being drawn beside it". True,
 * and it left a gap nothing was checking. The workspace draws three pieces of
 * chrome at once — a bar across the top, a sidebar down the side and this
 * header inside the pane — and nobody had ever compared their contents.
 *
 * They overlapped on five controls. Three of the five had been noticed: a
 * `slim` flag dropped the launcher, the bell and the avatar because the
 * workspace's top bar carries all three. It was a list written against that
 * bar's *tools cluster* and never checked against the rest of the bar, so it
 * missed the two the bar and the sidebar carry elsewhere:
 *
 * - **Search.** `TopBar` draws a permanent field, at every width — that field
 *   being permanent is the whole of what the workspace adds, in that file's
 *   own first paragraph — and the header drew a magnifier one row below it
 *   opening the identical palette.
 * - **Add.** `Sidebar` draws New at the top of the column, "the first thing
 *   the eye lands on", and the header drew a `+` four inches away opening the
 *   identical capture box.
 *
 * So this is the whole answer rather than five conditions in the markup, for
 * the reason `chrome.ts` was written and this file already half-follows: a
 * rule spread across the elements it governs cannot be checked, and the one
 * that was spread is the one that was wrong.
 *
 * ## `add` is the one that is simply yes
 *
 * It used to ask about the *sidebar* rather than the workspace, because that
 * column drew a New button and this `+` would have been a second one beside
 * it. That column no longer does: New went the same way the duplicates here
 * went — it opened the capture box, which the search home already opens from
 * the `+` beside its field.
 *
 * So the premise is gone and the question with it. Nothing else in any
 * navigation's chrome carries the capture box, which makes this `+` the only
 * pointing route to it and an unconditional yes. Held that way in
 * `lib/onframe.test.ts` rather than left as a constant nobody rechecks:
 * two correct removals landing in the same week — the sidebar's New, and this
 * one deferring to it — would otherwise have left a wide workspace with no way
 * to reach the capture box except the keyboard.
 *
 * `avatar` keeps `showsAvatar` in front of it: the workspace question is "is
 * this control already on screen" and the width question is "does it fit", and
 * collapsing two different questions into one flag is how the row came to be
 * wrong in the first place.
 */
export interface Frame extends Row {
  /**
   * The workspace navigation: a search field across the top at every width,
   * and a tools cluster — alerts, settings, the launcher, the avatar — beside
   * it. See `components/desk/TopBar.tsx`.
   */
  desk: boolean;
}

/** Which of the row's five controls the header draws. */
export interface Drawn {
  /** The `+`, which opens the capture box. */
  add: boolean;
  /** The magnifier, which opens the palette. */
  search: boolean;
  /** The nine squares, which open the launcher. */
  apps: boolean;
  /** The bell, which goes to Alerts. */
  alerts: boolean;
  /** Your picture, which goes to your profile. */
  avatar: boolean;
}

export function headerRow(f: Frame): Drawn {
  return {
    add: true,
    search: !f.desk,
    apps: !f.desk,
    alerts: f.atRoot && !f.desk,
    avatar: !f.desk && showsAvatar(f),
  };
}
