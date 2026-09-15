import { useEffect, useState } from 'react';
import { Mark } from './Brand';
import { useNow, useStore } from '../state/store';
import { greeting, welcomeLine } from '../lib/welcome';
import { prefersLessMotion } from '../lib/prefers';
import { splashDone, splashPlayed } from '../lib/splash';

/**
 * The screen the app opens on: the mark, the name, and one true sentence.
 *
 * The mark and the word are the app's own logo — `components/Brand.tsx`, which
 * is also what the installed icon is generated from, so the tile somebody
 * tapped and the first thing they see after tapping it are one drawing.
 *
 * ## Why there is one at all
 *
 * Opening the app used to mean watching it assemble itself. The store is read
 * out of IndexedDB before anything mounts (see `main.tsx`), the look is written
 * onto the root element in an effect after the first paint, and the screen
 * itself arrives on a lazy chunk behind a `Suspense` fallback — so the first
 * half-second was a header with no tokens on it, a spinner, and whatever
 * standing banners the shell had to draw, all landing in a different order
 * every time. None of that is broken; it is just the machinery, and the
 * machinery is not what somebody opening their semester should be shown.
 *
 * This covers that half-second with something deliberate and then gets out of
 * the way. It is not a loading screen — it does not wait on anything and it
 * does not gate the app. The app mounts, hydrates and settles underneath it on
 * exactly the schedule it always did; this is a curtain, not a queue.
 *
 * ## Once per launch, not once per render
 *
 * The flag is module state in `lib/splash.ts` rather than component state, so
 * a re-render, a StrictMode double-mount in development, or a hot reload
 * cannot replay it. A fresh page load is a fresh module, which is exactly the
 * event this is for: opening the app, or coming back to an installed one the
 * system has since unloaded.
 *
 * ## It is decoration, and says so
 *
 * `aria-hidden`, with nothing focusable inside it. A screen reader is already
 * being read the app underneath — making it sit through a welcome animation
 * first would be a delay bought with somebody else's time. For the same reason
 * a tap, a click or any key dismisses it immediately: this is worth a moment
 * and not worth a second one.
 */

/** How long the mark and the sentence hold before the curtain lifts. */
const HOLD = 1250;

/** The fade itself — matched by `.splash` in `app.css`. */
const FADE = 340;

export function Splash() {
  const { state, catalog } = useStore();
  const now = useNow();
  /*
   * Whether this instance plays at all, decided once and held as state.
   *
   * Not over onboarding: its first screen is already this — the name, a
   * promise, and a sentence built from whatever was loaded — and two title
   * cards in a row is one title card and a delay.
   *
   * The reason it is `useState` and not a plain `played || …` expression is a
   * bug this had and that only a browser found. Reading the module flag on
   * every render meant the effect below, whose whole job is to set that flag,
   * changed its own dependency: the flag flipped, the next render computed
   * "already played", the effect re-ran, took the early return — and cleared
   * the two timers that lift the curtain. The splash stayed up forever, over
   * a working app, which is a worse fault than the one it was written to fix.
   * A `useState` initialiser runs once per instance, so the decision is made
   * at mount and nothing that happens afterwards can revise it.
   */
  const [play] = useState(() => !splashPlayed() && state.screen !== 'onboarding');
  const [phase, setPhase] = useState<'up' | 'going' | 'gone'>(play ? 'up' : 'gone');

  useEffect(() => {
    if (!play) return;
    splashDone();
    // The fade is a CSS transition on the element, so with reduced motion asked
    // for it collapses to nothing (see the blanket rule in `app.css`) and the
    // second timer only decides when the node leaves the tree.
    const gap = prefersLessMotion() ? 0 : FADE;
    const lift = window.setTimeout(() => setPhase('going'), HOLD);
    const clear = window.setTimeout(() => setPhase('gone'), HOLD + gap);
    return () => {
      window.clearTimeout(lift);
      window.clearTimeout(clear);
    };
  }, [play]);

  /* Any input at all takes it away — see the note above. */
  useEffect(() => {
    if (phase === 'gone') return;
    const off = () => setPhase('gone');
    window.addEventListener('pointerdown', off);
    window.addEventListener('keydown', off);
    return () => {
      window.removeEventListener('pointerdown', off);
      window.removeEventListener('keydown', off);
    };
  }, [phase]);

  if (phase === 'gone') return null;

  return (
    <div className="splash" data-going={phase === 'going' ? 'yes' : undefined} aria-hidden="true">
      <div className="splash-in">
        <Mark className="splash-mark" size={92} />
        <div className="splash-name brandword chrome-text">Semester</div>
        <div className="splash-said">
          <span className="splash-hello">{greeting(now)}</span>
          <span className="splash-what">{welcomeLine(catalog, now)}</span>
        </div>
      </div>
    </div>
  );
}

