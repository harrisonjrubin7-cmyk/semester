import { useEffect, useState } from 'react';

/**
 * A media query as state.
 *
 * The app was drawn as a phone and still is one at phone size. On a tablet the
 * same screens keep the phone's touch targets and gain the rail beside them;
 * on a desktop they are laid out for a mouse and a window — that is a layout
 * decision, not a different app, so the three sizes are decided here in one
 * place and read wherever they matter.
 */
export function useMedia(query: string): boolean {
  const [matches, setMatches] = useState(() =>
    typeof window === 'undefined' ? false : window.matchMedia(query).matches,
  );

  useEffect(() => {
    const mql = window.matchMedia(query);
    const onChange = () => setMatches(mql.matches);
    onChange();
    mql.addEventListener('change', onChange);
    return () => mql.removeEventListener('change', onChange);
  }, [query]);

  return matches;
}

/**
 * ── The three layouts ─────────────────────────────────────────────────────
 *
 * One number per boundary, named once, used by both the stylesheet and the
 * components. `styles/app.css` repeats the same two figures in its media
 * queries — it has to, a stylesheet cannot import a constant — and
 * `tiers.test.ts` asserts the two copies agree, so a breakpoint moved here
 * and not there fails a test instead of producing a rail with no room beside
 * it.
 *
 *   phone    < 760      one column, a tab bar under the thumb, full bleed.
 *   tablet   760–1179   the rail beside the column; touch sizes kept.
 *   desktop  ≥ 1180     a window: wide rail, a measured reading column, and
 *                       the screens that are grids given room to be grids.
 */
export type Tier = 'phone' | 'tablet' | 'desktop';

/** Where the rail replaces the tab bar. */
export const TABLET_AT = 760;

/** Where the app stops being a phone held up and becomes a desktop window. */
export const DESKTOP_AT = 1180;

/**
 * Wide enough for the rail and a reading column beside it.
 *
 * 760px rather than 900 so an iPad in portrait gets the rail: the 11-inch is
 * 834pt wide, the 10.9-inch 820, the 9.7-inch 768. Below that — an iPad mini
 * held upright at 744, and every phone — the app is the phone it was drawn as,
 * filling the screen. Split View is just a narrower window, and the query
 * follows it live.
 */
export const WIDE = `(min-width: ${TABLET_AT}px)`;

/**
 * A desktop window, rather than a tablet.
 *
 * 1180 is where a laptop's browser window — 1280 or 1440 wide, minus its own
 * chrome — clears both the rail and a full reading measure with room left for
 * a second column. An iPad in landscape is 1080–1194: the 13-inch lands just
 * inside it and gets the desktop layout with touch sizes intact, which is what
 * it is asking for by being that wide.
 */
export const DESKTOP = `(min-width: ${DESKTOP_AT}px)`;

/** Which of the three a given viewport width is. Pure, so it can be tested. */
export function tierFor(width: number): Tier {
  if (width >= DESKTOP_AT) return 'desktop';
  if (width >= TABLET_AT) return 'tablet';
  return 'phone';
}

/**
 * The layout this window is in, as state.
 *
 * Two queries rather than a resize listener: `matchMedia` fires only when a
 * boundary is crossed, so dragging a window edge across 900px does not
 * re-render fifty screens on every frame.
 */
export function useTier(): Tier {
  const desktop = useMedia(DESKTOP);
  const tablet = useMedia(WIDE);
  if (desktop) return 'desktop';
  return tablet ? 'tablet' : 'phone';
}

/**
 * A touch keyboard rather than a hardware one.
 *
 * `pointer: coarse` is the honest signal available: it says the primary input
 * is a finger, which is the same set of devices whose keyboard has no
 * Shift+Enter. Width would be the wrong test — an iPad in Split View is narrow
 * and has a hardware keyboard attached often enough to matter, and a phone
 * held in landscape is wide and never does.
 */
export const TOUCH = '(pointer: coarse)';
