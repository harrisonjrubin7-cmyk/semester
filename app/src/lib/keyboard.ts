import { useEffect } from 'react';

/**
 * How much of the window the on-screen keyboard is standing on.
 *
 * ## The thing this fixes
 *
 * On a phone, `height: 100%` does not mean what a chat needs it to mean. When
 * the keyboard comes up, iOS does **not** resize the layout viewport: the page
 * is still the full height of the display, the browser has simply drawn a
 * keyboard over the bottom 300px of it. So a composer pinned to the bottom
 * edge is pinned underneath the keyboard — you tap the box, the box vanishes,
 * and you type a question you cannot see. That is the single worst thing a
 * chat on a phone can do, and every native one avoids it.
 *
 * `100dvh` does not help: the dynamic viewport unit tracks the browser's own
 * retracting toolbars, not the keyboard. The only thing that knows is
 * `visualViewport` — the rectangle actually visible — so this measures the gap
 * between that and the layout viewport and publishes it as `--kb` on the root
 * element. `.device` subtracts it, so the whole app, tab bar included, sits
 * above the keyboard rather than behind it.
 *
 * ## Why it only measures while you are typing
 *
 * The same gap opens for a reason that is not a keyboard: mobile Safari's
 * bottom toolbar is outside the visual viewport too, and it appears and
 * retracts as you scroll. Subtracting *that* would shrink the app by 80px
 * whenever somebody flicked a list, which is a worse bug than the one this is
 * for and it would happen constantly.
 *
 * So the rest state is measured continuously while no field has focus, and the
 * inset published is the difference from it. Nothing at all is published until
 * something in the app is focused, and it goes back to zero the moment focus
 * leaves — which is also the honest answer, because that is when the keyboard
 * goes away.
 *
 * A hook rather than a rule in the stylesheet because there is no CSS for it:
 * `env(keyboard-inset-height)` needs the virtual-keyboard API, which is Chrome
 * on Android only and has to be opted into from script anyway.
 */
export function useKeyboardInset(): void {
  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;
    const root = document.documentElement;

    /** The gap under the visible rectangle, whatever is causing it. */
    const gap = () => Math.max(0, Math.round(window.innerHeight - vv.height - vv.offsetTop));

    /** That same gap with nothing focused — the browser's own furniture. */
    let rest = gap();
    let typing = false;

    const publish = () => {
      const inset = typing ? Math.max(0, gap() - rest) : 0;
      // Below a finger's height it is the toolbar animating, not a keyboard,
      // and moving the whole app by 20px reads as a flinch.
      root.style.setProperty('--kb', inset > 60 ? `${inset}px` : '0px');
    };

    const moved = () => {
      if (!typing) rest = gap();
      publish();
    };

    const focused = (e: FocusEvent) => {
      const el = e.target;
      typing =
        el instanceof HTMLElement &&
        (el instanceof HTMLTextAreaElement ||
          el instanceof HTMLInputElement ||
          el.isContentEditable);
      publish();
    };

    const blurred = () => {
      typing = false;
      publish();
    };

    vv.addEventListener('resize', moved);
    vv.addEventListener('scroll', moved);
    document.addEventListener('focusin', focused);
    document.addEventListener('focusout', blurred);

    return () => {
      vv.removeEventListener('resize', moved);
      vv.removeEventListener('scroll', moved);
      document.removeEventListener('focusin', focused);
      document.removeEventListener('focusout', blurred);
      // Whoever mounted this is leaving; the app gets its full height back
      // whether or not a keyboard happens to be up at this instant.
      root.style.removeProperty('--kb');
    };
  }, []);
}
