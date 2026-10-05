/**
 * How much of the bottom edge is already spoken for, written to the root as
 * `--bottom-chrome`.
 *
 * The assistant's button is fixed to the viewport, so it is the one thing in
 * the app that has to know what is underneath it. Nothing else does: every
 * bottom bar here is a flex child, and what sits above one simply takes the
 * remaining space.
 *
 * ## Why an inset rather than a height
 *
 * This measured the bar's height until the springboard's dock needed the same
 * treatment, and the dock is not a bar. It is drawn in the page's own flow,
 * with a spacer above it that pushes it towards the bottom, so it stops
 * short of the edge — its height says nothing about where its top is, which
 * is the only number the button actually wants.
 *
 * So the measure is the gap from the bottom of the viewport up to the top of
 * whatever is reported. For a bar flush with the bottom edge that is exactly
 * its height, which is why the tab bar's number does not change; for the dock
 * it is the height plus the margin under it, which is what was missing.
 *
 * The caller reports one element. A screen with nothing along the bottom
 * reports none, the property is removed on unmount, and the button falls back
 * to a number that assumes a tab bar — the common case, and the one that is
 * wrong by the least when it is wrong.
 */
import { useLayoutEffect } from 'react';

export const BOTTOM_CHROME = '--bottom-chrome';

/**
 * The Focus bar's own inset, written beside `--bottom-chrome` rather than into
 * it.
 *
 * It is a second writer, and one property with two writers is one whose
 * unmount clears the other's number. The Focus bar is also fixed over the
 * page rather than a flex child under it, so it sits on top of wherever the
 * tab bar would have been — the button wants the larger of the two, and
 * `ai/Assistant.tsx` and the reservation in `app.css` take `max()` of them.
 */
export const FOCUS_BAR_INSET = '--focus-bar-inset';

/**
 * How far up from the bottom of the window this element's top edge is — or
 * zero when it is not drawn.
 *
 * The zero is a fix, not a detail. Focused mode hides the tab bar with
 * `display: none` without unmounting it, and a box that is not drawn reports
 * its top as 0 — so the inset read as the whole window's height, and at
 * 320x640 the assistant's button was placed 652px up, off the top of the
 * screen. A box with no client rects is not drawn.
 */
export function insetOf(node: HTMLElement): number {
  if (node.getClientRects().length === 0) return 0;
  return Math.max(0, Math.round(window.innerHeight - node.getBoundingClientRect().top));
}

export function useBottomChrome(
  ref: React.RefObject<HTMLElement | null>,
  property: string = BOTTOM_CHROME,
) {
  useLayoutEffect(() => {
    const node = ref.current;
    if (!node) return;
    const write = () => {
      const inset = insetOf(node);
      if (inset) document.documentElement.style.setProperty(property, `${inset}px`);
      else document.documentElement.style.removeProperty(property);
    };
    write();
    /*
     * The element's own size, and the window's. Either moves its top edge:
     * the bar grows with the text-size and density settings, and a rotated
     * phone moves the bottom of the viewport out from under it. Being hidden
     * and shown again is a size change too, so Focused mode switching the tab
     * bar off and on is seen here without the bar remounting.
     */
    // Absent in jsdom, where the Focus bar is mounted by the unity tests. The
    // first write above still happens; only the re-measuring is skipped.
    const watch = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(write);
    watch?.observe(node);
    window.addEventListener('resize', write);
    return () => {
      watch?.disconnect();
      window.removeEventListener('resize', write);
      // Left set, it would strand the button above something that is no
      // longer there — the fullscreen screens hide the bar entirely.
      document.documentElement.style.removeProperty(property);
    };
  }, [ref, property]);
}
