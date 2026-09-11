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
