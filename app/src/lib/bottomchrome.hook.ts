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

export function useBottomChrome(ref: React.RefObject<HTMLElement | null>) {
  useLayoutEffect(() => {
    const node = ref.current;
    if (!node) return;
    const write = () => {
      const inset = Math.max(0, window.innerHeight - node.getBoundingClientRect().top);
      document.documentElement.style.setProperty(BOTTOM_CHROME, `${Math.round(inset)}px`);
    };
    write();
    /*
     * The element's own size, and the window's. Either moves its top edge:
     * the bar grows with the text-size and density settings, and a rotated
     * phone moves the bottom of the viewport out from under it.
     */
    const watch = new ResizeObserver(write);
    watch.observe(node);
    window.addEventListener('resize', write);
    return () => {
      watch.disconnect();
      window.removeEventListener('resize', write);
      // Left set, it would strand the button above something that is no
      // longer there — the fullscreen screens hide the bar entirely.
      document.documentElement.style.removeProperty(BOTTOM_CHROME);
    };
  }, [ref]);
}
