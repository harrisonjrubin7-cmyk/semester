/**
 * Pull down to check, and a sentence saying what came of it.
 *
 * The app checked the account once, on sign-in, and never again while it was
 * open. Import a syllabus on your laptop, look at your phone, and you saw
 * yesterday's app with no way to ask it to look.
 *
 * ## The sentence is the feature
 *
 * Almost every pull-to-refresh spins for a moment and then shows exactly what
 * it showed before, leaving you to guess whether it found nothing or failed
 * silently. Those are different facts. So this always says which — including
 * "Nothing new", which is a real answer and worth the line it takes. The
 * wording lives in `lib/refresh.ts` and is tested there.
 *
 * ## Only from the very top, and only a real pull
 *
 * A gesture that fires while somebody is flicking back up a long list is a
 * gesture they will learn to be careful around. This arms only when the scroll
 * area is already at 0 and the finger moves down, and the threshold is far
 * enough that overscroll momentum does not reach it.
 *
 * Touch only. A mouse has a scrollbar and a Sync now button on the account
 * screen; inventing a drag gesture for it would be a novelty rather than a
 * convenience.
 */

import { useEffect, useRef, useState } from 'react';
import { useStore } from '../state/store';
import { fires, pullLabel, pulled } from '../lib/refresh';

/** How long the result stays up. Long enough to read a sentence. */
const SAYS_FOR = 6000;

export function PullDown({ area }: { area: React.RefObject<HTMLElement | null> }) {
  const { refresh } = useStore();
  const [drag, setDrag] = useState(0);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState('');

  /*
   * The gesture's own copy of what it needs, written only by the handlers.
   *
   * The listeners are registered once and would otherwise close over the first
   * render's `drag` and `busy` forever. Mirroring the state into the ref during
   * render is the obvious fix and is the thing React tells you not to do — so
   * the handlers keep this up to date themselves, and the state exists only for
   * what is drawn.
   */
  const live = useRef({ from: -1, drag: 0, busy: false });

  useEffect(() => {
    const node = area.current;
    if (!node) return;

    const start = (e: TouchEvent) => {
      // Armed only at the very top. Anywhere else this is an ordinary scroll
      // and must stay one.
      live.current.from = node.scrollTop <= 0 && !live.current.busy ? e.touches[0].clientY : -1;
    };

    const move = (e: TouchEvent) => {
      if (live.current.from < 0) return;
      const down = e.touches[0].clientY - live.current.from;
      if (down <= 0) {
        // Went back up. Disarm rather than tracking a negative — otherwise a
        // small up-then-down within one gesture reads as a fresh pull.
        live.current.from = -1;
        live.current.drag = 0;
        setDrag(0);
        return;
      }
      live.current.drag = down;
      setDrag(down);
    };

    const end = () => {
      if (live.current.from < 0) return;
      const far = fires(live.current.drag);
      live.current.from = -1;
      live.current.drag = 0;
      setDrag(0);
      if (!far) return;
      live.current.busy = true;
      setBusy(true);
      setResult('');
      void refresh().then((line) => {
        live.current.busy = false;
        setBusy(false);
        setResult(line);
      });
    };

    node.addEventListener('touchstart', start, { passive: true });
    node.addEventListener('touchmove', move, { passive: true });
    node.addEventListener('touchend', end, { passive: true });
    node.addEventListener('touchcancel', end, { passive: true });
    return () => {
      node.removeEventListener('touchstart', start);
      node.removeEventListener('touchmove', move);
      node.removeEventListener('touchend', end);
      node.removeEventListener('touchcancel', end);
    };
  }, [area, refresh]);

  // The result clears itself. A stale "Nothing new" sitting at the top of a
  // screen an hour later is a claim about now that was true then.
  useEffect(() => {
    if (!result) return;
    const id = setTimeout(() => setResult(''), SAYS_FOR);
    return () => clearTimeout(id);
  }, [result]);

  const drawn = pulled(drag);
  if (drawn <= 0 && !busy && !result) return null;

  const text = busy ? 'Checking…' : result || pullLabel(drag);

  return (
    <div
      role="status"
      aria-live="polite"
      style={{
        // In the flow rather than floating, so it pushes the screen down the
        // way a pulled sheet of paper would rather than covering its first row.
        height: busy || result ? 'auto' : drawn,
        minHeight: busy || result ? 34 : 0,
        overflow: 'hidden',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: busy || result ? '9px 16px' : 0,
        fontSize: 'calc(12px * var(--text-scale, 1))',
        lineHeight: 1.4,
        textAlign: 'center',
        textWrap: 'pretty',
        opacity: result ? 0.85 : 0.55,
        transition: drag > 0 ? 'none' : 'height 160ms ease, opacity 160ms ease',
      }}
    >
      {text}
    </div>
  );
}
