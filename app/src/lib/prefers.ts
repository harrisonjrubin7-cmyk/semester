import { useEffect, useState } from 'react';

/**
 * What the device has been told about light and dark.
 *
 * There are forty-two grounds in this app and, until this, no way to say
 * "whichever one matches the rest of my phone". Somebody who has their device
 * on a schedule — light in the day, dark at night — had to come here and
 * change it by hand twice a day, which nobody does; they pick one and squint
 * for half of it.
 *
 * Read live rather than once, because the OS can flip while the app is open
 * and a theme that only follows on next launch is not following.
 */
export function usePrefersDark(): boolean {
  const [dark, setDark] = useState(() => query()?.matches ?? true);

  useEffect(() => {
    const mq = query();
    if (!mq) return;
    const on = () => setDark(mq.matches);
    on();
    mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, []);

  return dark;
}

/**
 * Whether the device asks for more contrast than the design gives it.
 *
 * The lift itself happens in `lib/look.ts` rather than in a media query,
 * because these tokens are written as inline styles on the root element and a
 * `:root` rule in the stylesheet would never win.
 */
export function usePrefersContrast(): boolean {
  const [more, setMore] = useState(() => contrast()?.matches ?? false);

  useEffect(() => {
    const mq = contrast();
    if (!mq) return;
    const on = () => setMore(mq.matches);
    on();
    mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, []);

  return more;
}

/**
 * Whether the device asks for less movement.
 *
 * `app.css` already answers this for CSS: one block flattens every animation
 * and transition in the app to a millisecond. What that block cannot reach is
 * a scroll the app performs itself. `scrollTo({ behavior: 'smooth' })` is a
 * script calling for motion, not a style declaring it, and the media query
 * does not apply to it — so five places went on flying the page hundreds of
 * pixels for somebody who had asked the operating system, in as many words,
 * for that not to happen.
 *
 * Which is the case the setting exists for. Reduced motion is not a matter of
 * taste: large sweeping movement is what triggers nausea and dizziness in
 * vestibular disorders, and a page travelling its whole length under its own
 * power is the largest movement this app makes.
 *
 * Read live, like the other two here, and answering "yes, reduce" wherever
 * `matchMedia` cannot be asked — a server render, an old browser. The wrong
 * answer in that direction is a jump instead of a glide; in the other it is a
 * symptom.
 */
export function prefersLessMotion(): boolean {
  // `?? true`, which is what the paragraph above argues for and what this
  // answered the other way round. A browser that cannot be asked got a page
  // sweeping its whole length, for the people the setting exists to protect.
  return motion()?.matches ?? true;
}

/**
 * Scroll the way the person has asked to be scrolled.
 *
 * The one place the app decides how a scroll moves, so that a new caller gets
 * the setting for free rather than having to remember it — the same bargain
 * `lib/arrange.ts` makes for dragging.
 */
export function scrollKindly(
  el: Element | null | undefined,
  to: ScrollToOptions,
): void {
  el?.scrollTo({ ...to, behavior: prefersLessMotion() ? 'auto' : 'smooth' });
}

/** The same, for bringing an element into view rather than a position. */
export function revealKindly(
  el: Element | null | undefined,
  how: Omit<ScrollIntoViewOptions, 'behavior'> = {},
): void {
  el?.scrollIntoView({ ...how, behavior: prefersLessMotion() ? 'auto' : 'smooth' });
}

function motion(): MediaQueryList | null {
  try {
    return typeof matchMedia === 'function'
      ? matchMedia('(prefers-reduced-motion: reduce)')
      : null;
  } catch {
    return null;
  }
}

function contrast(): MediaQueryList | null {
  try {
    return typeof matchMedia === 'function' ? matchMedia('(prefers-contrast: more)') : null;
  } catch {
    return null;
  }
}

/**
 * Dark when nothing can be read.
 *
 * A browser with no `matchMedia`, or one that refuses the query, gets the
 * app's own default rather than a light theme it never asked for.
 */
function query(): MediaQueryList | null {
  try {
    return typeof matchMedia === 'function' ? matchMedia('(prefers-color-scheme: dark)') : null;
  } catch {
    return null;
  }
}
