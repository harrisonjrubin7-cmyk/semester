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
 *
 * Width decides it, with one exception, which is `HANDHELD` below: a phone
 * turned on its side is wider than an iPad is tall, and width alone called it
 * a tablet.
 */
export type Tier = 'phone' | 'tablet' | 'desktop';

/** Where the rail replaces the tab bar. */
export const TABLET_AT = 760;

/** Where the app stops being a phone held up and becomes a desktop window. */
export const DESKTOP_AT = 1180;

/**
 * The shortest a window may be and still be a tablet or a desktop.
 *
 * Nothing that holds a rail is shorter than this. An iPad on its side is the
 * shortest tablet there is — 744pt on the mini, 810 on the 10.2-inch, 834 on
 * the 11-inch — and a laptop window is taller again. Every phone on its side
 * is under 450: 430 on the largest iPhone, 402 on a 15 Pro, 412 on a Pixel.
 * 600 sits in the middle of that gap with room on both sides of it, so the
 * boundary never lands on a real device.
 */
export const TALL_AT = 600;

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

/**
 * A phone on its side — the one device width gets wrong.
 *
 * The two boundaries above ask a single question, how wide the window is, and
 * for every device held upright that is the same question as which device it
 * is. Turned the long way round it stops being: an iPhone 15 Pro Max in
 * landscape is 932pt wide, wider than an iPad mini is in portrait, so width
 * alone put a phone lying on its side into the tablet layout. What that drew
 * was the rail — a navigation column, ten rows down the side — into 430px of
 * height, where its own last items ran off the bottom of a screen that had
 * 220px of its width taken by them. The tab bar is 76px across the foot and
 * leaves the rest of the phone alone, which is what a phone in landscape is
 * asking for.
 *
 * Height alone would be the wrong test in the other direction: a desktop
 * browser window dragged short is still a desktop, with a mouse in it and no
 * reason to be handed a bar sized for a thumb. So it is both — short *and* a
 * finger — which between them describe a handheld and nothing else. An iPad
 * answers the first no at every rotation; a laptop answers the second no at
 * every size.
 *
 * `styles/app.css` carries the same query as the last of its layout blocks,
 * and `tiers.test.ts` asserts the two copies agree.
 */
export const HANDHELD = `(max-height: ${TALL_AT - 1}px) and (pointer: coarse)`;

/**
 * Which of the three a given viewport is. Pure, so it can be tested.
 *
 * `handheld` is the answer to `HANDHELD` above — a short window with a finger
 * in it — and it wins outright, because a phone on its side is a phone at any
 * width. It defaults to false so the width-only call still reads as the
 * question it always was.
 */
export function tierFor(width: number, handheld = false): Tier {
  if (handheld) return 'phone';
  if (width >= DESKTOP_AT) return 'desktop';
  if (width >= TABLET_AT) return 'tablet';
  return 'phone';
}

/**
 * The layout this window is in, as state.
 *
 * Three queries rather than a resize listener: `matchMedia` fires only when a
 * boundary is crossed, so dragging a window edge across 900px does not
 * re-render sixty screens on every frame. Turning a phone crosses one of them
 * too, so the layout follows a rotation without anything listening for one.
 */
export function useTier(): Tier {
  const desktop = useMedia(DESKTOP);
  const tablet = useMedia(WIDE);
  const handheld = useMedia(HANDHELD);
  if (handheld) return 'phone';
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
