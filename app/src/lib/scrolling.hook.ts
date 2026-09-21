import { useEffect, useState } from 'react';
import { prefersLessMotion } from './prefers';

/**
 * Whether something on the page is being scrolled right now.
 *
 * The assistant's button is fixed to the viewport, which is the whole point of
 * it — it is reachable from anywhere without hunting for it. The cost is that
 * content passes underneath, and an opaque 52px circle over a line of prose
 * hides the end of it until you scroll on.
 *
 * `bottomchrome.hook.ts` already settles the part of that which is a bug:
 * `--bottom-chrome` and the reservation in `app.css` guarantee the *last*
 * thing on a screen clears the button, so nothing is ever stuck underneath it.
 * Measured across a full scroll of Settings → The assistant, the worst any
 * control is covered at a resting position is 2%, and every one of them takes
 * a tap at its own centre. What is left is the moment of passing, and this
 * fades the button for it.
 *
 * ## Listening on the document rather than the scroller
 *
 * `.scrollarea` is replaced on navigation, so a listener bound to the element
 * would be attached to a node that is no longer in the page as soon as
 * somebody moved screens. Scroll events do not bubble, but they do capture —
 * so one capturing listener on the document hears every scroller in the app,
 * including ones inside a panel, and survives every navigation without being
 * rebound.
 *
 * ## It does nothing when less motion was asked for
 *
 * The sheet's blanket `prefers-reduced-motion` rule collapses every transition
 * to 0.001ms, so the fade would still happen there — instantly, as a blink on
 * every scroll and another on every stop. That is a sudden visual change of
 * exactly the kind the setting is asking to be spared, and it would be
 * arriving several times a second on a flick.
 *
 * So this reports `false` throughout and the button simply stays put. Nothing
 * is lost by that: the reservation above is what guarantees the content can be
 * read, and it is not a matter of taste or timing. The fade is a nicety over
 * the top of it, and a nicety is the right thing to drop.
 */
export function useScrolling(quietMs = 420): boolean {
  const [scrolling, setScrolling] = useState(false);

  useEffect(() => {
    if (prefersLessMotion()) return;

    let timer: number | undefined;
    const onScroll = () => {
      setScrolling(true);
      window.clearTimeout(timer);
      timer = window.setTimeout(() => setScrolling(false), quietMs);
    };

    // `capture`, because scroll does not bubble; `passive`, because this never
    // calls preventDefault and saying so keeps it off the scrolling path.
    document.addEventListener('scroll', onScroll, { capture: true, passive: true });
    return () => {
      window.clearTimeout(timer);
      document.removeEventListener('scroll', onScroll, { capture: true });
      // A screen that unmounts mid-flick would otherwise leave the button
      // faded with nothing left to un-fade it.
      setScrolling(false);
    };
  }, [quietMs]);

  return scrolling;
}
