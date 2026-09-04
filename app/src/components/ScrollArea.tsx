/**
 * The app's one scrolling element, which now remembers where you were.
 *
 * `App.tsx` remounts this on every navigation (`key={state.screen}`), which is
 * right for everything except the scroll position: going halfway down Courses,
 * into a guide, and back put you at the top of Courses again. On a phone
 * halfway down a long list is fifteen flicks, and an app that charges you for
 * them twice is one you stop browsing in.
 *
 * The rules — what is worth keeping, when it goes stale, how far a shortened
 * list may be scrolled — are in `lib/scrollback.ts` and tested there. This is
 * the part that has to touch the DOM.
 *
 * ## Restoring has to wait for the screen to exist
 *
 * Screens are lazy, so the first commit is often the Suspense fallback and the
 * element cannot be scrolled to 1,240 when it is 300 tall. Setting `scrollTop`
 * then silently clamps to the bottom of a spinner, which reads as "it forgot".
 * So this watches the element grow and restores at the first size that can hold
 * the position — and gives up on a budget rather than watching forever.
 *
 * ## And it stops the moment you take over
 *
 * Any touch, wheel or key from the person wins immediately. Being yanked
 * somewhere while already reading is worse than not being restored at all.
 */

import { useEffect, useLayoutEffect, useRef, type ReactNode } from 'react';
import { keep, opensAt } from '../lib/scrollback';

/** How long to keep waiting for a lazy screen to become tall enough. */
const WAIT_FOR = 1500;

export function ScrollArea({ screen, children }: { screen: string; children: ReactNode }) {
  const box = useRef<HTMLElement>(null);

  useLayoutEffect(() => {
    const node = box.current;
    if (!node) return;

    const most = () => Math.max(0, node.scrollHeight - node.clientHeight);
    const want = opensAt(screen, Date.now(), Number.MAX_SAFE_INTEGER);
    if (want <= 0) return;

    let done = false;
    const stop = () => {
      if (done) return;
      done = true;
      watcher.disconnect();
      clearTimeout(giveUp);
      for (const e of ['wheel', 'touchstart', 'keydown']) {
        node.removeEventListener(e, stop);
      }
    };

    const tryIt = () => {
      if (done) return;
      const limit = most();
      if (limit <= 0) return;
      node.scrollTop = Math.min(want, limit);
      // Only call it restored once the screen was actually tall enough. A
      // half-loaded list would otherwise pin us to its temporary bottom.
      if (limit >= want) stop();
    };

    const watcher = new ResizeObserver(tryIt);
    watcher.observe(node);
    const giveUp = setTimeout(stop, WAIT_FOR);
    // Whatever the person does beats whatever we were about to do.
    for (const e of ['wheel', 'touchstart', 'keydown']) {
      node.addEventListener(e, stop, { passive: true });
    }
    tryIt();

    return stop;
  }, [screen]);

  /*
   * The position is followed as it moves, and written down on the way out.
   *
   * Reading `scrollTop` in the cleanup was the obvious way and it is wrong:
   * driving it showed every screen saving 0. By the time an unmount cleanup
   * runs the element is detached, and a detached element reports no scroll at
   * all — so the app looked like it was remembering and was in fact recording
   * the top of every screen. The handler itself is a property read into a ref,
   * which is about as little as a scroll listener can do.
   *
   * `moved` is why a screen you never touched is left alone rather than saved
   * as 0. React's development mode mounts, unmounts and remounts every
   * component, and without this that middle unmount would erase the position it
   * had just restored.
   */
  useEffect(() => {
    const node = box.current;
    if (!node) return;
    const at = { top: node.scrollTop, moved: false };
    const follow = () => {
      at.top = node.scrollTop;
      at.moved = true;
    };
    node.addEventListener('scroll', follow, { passive: true });
    return () => {
      node.removeEventListener('scroll', follow);
      if (at.moved) keep(screen, at.top, Date.now());
    };
  }, [screen]);

  return (
    <main className="scrollarea" ref={box}>
      {children}
    </main>
  );
}
