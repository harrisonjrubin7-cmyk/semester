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
