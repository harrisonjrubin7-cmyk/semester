/**
 * The toast that offers the last removal back.
 *
 * Mounted once at the top of the app, like `Ringing` and `Keys`, because a
 * removal on the Letters screen should still be undoable after tapping through
 * to somewhere else — and because a toast per screen is twenty-two toasts to
 * maintain and one of them will be forgotten.
 *
 * ## It is a status, not a dialogue
 *
 * `role="status"` and `aria-live="polite"`, so a screen reader is told about it
 * after finishing the sentence it was on rather than interrupting. It never
 * takes focus: the whole point of an undo over a confirmation is that it costs
 * nothing when you meant it, and stealing focus is a cost.
 *
 * ## It disappears by itself, in the reducer's terms
 *
 * The eight seconds are `SHOWN_FOR` in `lib/undo.ts`, and when they are up this
 * dispatches `forgetUndo` rather than merely hiding — a snapshot that is no
 * longer offerable should not still be sitting in memory holding a copy of
 * every note you had.
 */

import { useEffect, useLayoutEffect, useRef } from 'react';
import { useStore } from '../state/store';
import { SHOWN_FOR, fresh } from '../lib/undo';

/** A gap between the toast and whatever is under it. */
const CLEAR = 10;

export function Undone() {
  const { state, dispatch } = useStore();
  const took = state.undone;
  const box = useRef<HTMLDivElement>(null);

  /*
   * One timeout per snapshot, not a running interval, and the clock read here
   * rather than during render.
   *
   * The store's own thirty-second tick is far too slow to retire an eight
   * second toast, and a one-second interval left running for the whole session
   * would be a wasted wake-up every second of a term for a thing that is on
   * screen for eight of them. Expiry lives entirely in this effect: it runs on
   * the same commit that put the snapshot there, so there is no frame in which
   * a stale toast is drawn, and reading `Date.now()` below instead would make
   * the render impure for no gain.
   */
  useEffect(() => {
    if (!took) return;
    if (!fresh(took, Date.now())) {
      dispatch({ type: 'forgetUndo' });
      return;
    }
    const id = setTimeout(() => dispatch({ type: 'forgetUndo' }), took.at + SHOWN_FOR - Date.now());
    return () => clearTimeout(id);
  }, [took, dispatch]);

  /*
   * How high to sit, measured rather than guessed.
   *
   * A fixed offset was wrong the first time it was driven: the toast's bottom
   * edge landed four pixels inside the tab bar. And a corrected constant would
   * only have been right at one text size — the bar is icon, label and padding,
   * so it grows with `--text-scale`, and the wide layout has no bar at all.
   * Reading the element settles all three cases at once.
   *
   * Written onto the node rather than held as state: the measurement exists to
   * place this one element and nothing else reads it, so a second render to
   * carry it would be a render for nobody.
   */
  useLayoutEffect(() => {
    const node = box.current;
    if (!node) return;
    const bar = document.querySelector('.app-tabs');
    const height = bar ? bar.getBoundingClientRect().height : 0;
    node.style.bottom = height > 0 ? `${height + CLEAR}px` : '';
  }, [took]);

  if (!took) return null;

  return (
    <div
      ref={box}
      role="status"
      aria-live="polite"
      style={{
        position: 'absolute',
        left: 12,
        right: 12,
        // Overwritten by the layout effect where there is a tab bar to clear.
        bottom: `calc(${CLEAR}px + env(safe-area-inset-bottom, 0px))`,
        zIndex: 80,
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        padding: '10px 12px',
        borderRadius: 10,
        background: 'var(--card)',
        border: '1px solid var(--line)',
        boxShadow: '0 8px 24px rgba(0, 0, 0, 0.28)',
      }}
    >
      <span style={{ flex: 1, fontSize: 'calc(13px * var(--text-scale, 1))' }}>{took.label}</span>
      <button
        type="button"
        className="btn"
        onClick={() => dispatch({ type: 'undo' })}
        style={{ height: 32, padding: '0 14px', flexShrink: 0 }}
      >
        Undo
      </button>
    </div>
  );
}
