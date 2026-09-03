import { useEffect, useState } from 'react';

/**
 * A media query as state.
 *
 * The app was drawn as a phone and still is one at phone size. On a laptop the
 * same screens sit in a wider frame with the tab bar unrolled into a rail —
 * that is a layout decision, not a different app, so it is decided here in one
 * place and read wherever it matters.
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
 * Wide enough for the rail and a reading column beside it.
 *
 * 760px rather than 900 so an iPad in portrait gets the rail: the 11-inch is
 * 834pt wide, the 10.9-inch 820, the 9.7-inch 768. Below that — an iPad mini
 * held upright at 744, and every phone — the app is the phone it was drawn as,
 * filling the screen. Split View is just a narrower window, and the query
 * follows it live.
 */
export const DESKTOP = '(min-width: 760px)';
