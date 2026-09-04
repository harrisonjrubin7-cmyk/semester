import { useEffect } from 'react';
import { keepAwake } from './device';

/**
 * Hold the screen awake for as long as a screen is open.
 *
 * Separate from `lib/device.ts` so that file stays free of React and can be
 * tested without a renderer; this is the twelve lines of lifecycle that the
 * raw capability needs to be usable.
 *
 * Two things make it more than a call and a cleanup. A wake lock is released
 * by the browser whenever the tab is hidden and is *not* restored when you
 * come back, so it has to be re-taken on `visibilitychange` — otherwise
 * answering a text message quietly ends it. And the release has to survive a
 * re-render, so the current release function is held in a mutable box rather
 * than in state.
 *
 * @param on Whether to hold it. False releases immediately, which is how a
 *   screen that is only sometimes a reading screen opts out.
 */
export function useKeepAwake(on = true): void {
  useEffect(() => {
    if (!on) return;
    let dead = false;
    let release = () => {};

    const take = async () => {
      const stop = await keepAwake();
      // The effect may have been cleaned up while the request was in flight.
      if (dead) stop();
      else release = stop;
    };

    void take();

    const onVisible = () => {
      if (document.visibilityState !== 'visible' || dead) return;
      // The old lock is already gone — the browser dropped it when the tab
      // was hidden — so this replaces rather than stacks.
      void take();
    };
    document.addEventListener('visibilitychange', onVisible);

    return () => {
      dead = true;
      release();
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [on]);
}
