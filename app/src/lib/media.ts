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
  const available = typeof window !== 'undefined' && typeof window.matchMedia === 'function';
  const [matches, setMatches] = useState(() =>
    available ? window.matchMedia(query).matches : false,
  );

  useEffect(() => {
    if (!available) return;
    const mql = window.matchMedia(query);
    const onChange = () => setMatches(mql.matches);
    onChange();
    mql.addEventListener('change', onChange);
    return () => mql.removeEventListener('change', onChange);
  }, [query, available]);

  return available && matches;
}

/**
 * ── The layouts ───────────────────────────────────────────────────────────
 *
 * One number per boundary, named once, used by both the stylesheet and the
 * components. `styles/app.css` repeats the same figures in its media queries
 * — it has to, a stylesheet cannot import a constant — and `tiers.test.ts`
 * asserts the two copies agree, so a breakpoint moved here and not there
 * fails a test instead of producing a rail with no room beside it.
 *
 * The boundaries are the adaptive-device contract's window classes
 * (`docs/ADAPTIVE-DEVICE-EXPERIENCE.md`), which are the common adaptive-layout
 * ones: compact under 600, medium to 839, expanded to 1199, large to 1599,
 * extra-large from 1600. They were 760 and 1180, measured against devices —
 * 760 so every iPad held upright got the rail. The contract asks for the
 * window, not the device, and puts a portrait tablet in medium, where the
 * tab bar stays. So:
 *
 *   phone    < 840      no full rail.
 *              < 600    compact: the phone as drawn, the tab bar under the
 *                       thumb — in a desktop window, the 402px column it was
 *                       drawn at.
 *              600–839  medium: the rail collapsed to its icons in the tab
 *                       bar's place, opening out over the content on demand
 *                       (`useMedium`, `chromeFor`'s `medium`).
 *   tablet   840–1199   expanded: the rail beside the column; touch sizes kept.
 *   desktop  ≥ 1200     large: a window — wide rail, a measured reading
 *                       column, and grids given room to be grids.
 *              ≥ 1600   extra-large: the same, with a wider measure and canvas
 *                       rather than longer lines.
 *
 * `Tier` is still three values, because three is how many navigations the
 * width chooses between; `windowClassFor` names all five for anything that
 * needs the finer answer.
 *
 * Width decides it, with one exception, which is `HANDHELD` below: a phone
 * turned on its side is wider than a small tablet is tall, and width alone
 * called it a tablet.
 */
export type Tier = 'phone' | 'tablet' | 'desktop';

/** The contract's five window classes. */
export type WindowClass = 'compact' | 'medium' | 'expanded' | 'large' | 'extraLarge';

/** Where the phone's column stops being the 402px artboard. */
export const MEDIUM_AT = 600;

/** Where the rail replaces the tab bar. */
export const TABLET_AT = 840;

/** Where the app stops being a tablet and becomes a desktop window. */
export const DESKTOP_AT = 1200;

/** Where the reading measure and the canvas take their last step. */
export const EXTRA_LARGE_AT = 1600;

/** The window class of a width. Pure, so it can be tested. */
export function windowClassFor(width: number): WindowClass {
  if (width >= EXTRA_LARGE_AT) return 'extraLarge';
  if (width >= DESKTOP_AT) return 'large';
  if (width >= TABLET_AT) return 'expanded';
  if (width >= MEDIUM_AT) return 'medium';
  return 'compact';
}

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
 * 840: the contract's expanded class. An iPad held upright (744–834) is
 * medium and keeps the tab bar, as the contract puts a portrait tablet; the
 * same iPad on its side (1024–1194) has the rail. Split View is just a
 * narrower window, and the query follows it live.
 */
export const WIDE = `(min-width: ${TABLET_AT}px)`;

/**
 * A desktop window, rather than a tablet.
 *
 * 1200: the contract's large class. A laptop's browser window — 1280 or 1440
 * wide, minus its own chrome — clears it with the rail, a full reading
 * measure and room for a second column. An iPad in landscape is 1024–1194 and
 * is expanded: the rail with touch sizes, which is what it asks for.
 */
export const DESKTOP = `(min-width: ${DESKTOP_AT}px)`;

/** The medium window class and up. The medium rail reads it through `useMedium`. */
export const MEDIUM = `(min-width: ${MEDIUM_AT}px)`;

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
/**
 * Whether this window is medium — 600 to 839px — and so draws the rail
 * collapsed to its icons in the tab bar's place (`chromeFor`'s `medium`).
 *
 * Not a phone on its side, which is a phone at any width (`HANDHELD`): the
 * same 700px that is a desktop window or an iPad mini upright is also an
 * iPhone lying down, and the rail was drawn into its 430px of height once
 * before. Every caller that asks `chromeFor` must pass this, or two parts of
 * the shell disagree about whether there is a tab bar.
 */
export function useMedium(): boolean {
  const medium = useMedia(MEDIUM);
  const wide = useMedia(WIDE);
  const handheld = useMedia(HANDHELD);
  return medium && !wide && !handheld;
}

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

/**
 * A mouse or a trackpad somewhere on this device, whatever the window's width.
 *
 * `any-pointer` rather than `pointer`: it asks whether *any* input is fine,
 * not whether the primary one is. An iPad with a Magic Keyboard answers yes
 * — its trackpad is fine though its screen is coarse — and so does a laptop
 * whose browser window has been dragged to 600px. Neither of those is wide,
 * and both have a keyboard in front of them.
 *
 * The honest reading is "probably a keyboard", not "a keyboard": no query
 * says that. It is used where the width was being asked the same question
 * and answering it worse — see `components/Keys.tsx`.
 */
export const FINE = '(any-pointer: fine)';
