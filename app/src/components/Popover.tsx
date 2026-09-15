/**
 * A little panel that opens beside the thing that summoned it.
 *
 * The strip has two of these — what a tab can do, what a group can do — and
 * the bookmarks bar has a third, and all three want the same four things: open
 * at a corner, stay inside the window, close on Escape or on a click
 * anywhere else, and give focus back to whatever opened them. Written once
 * here rather than three times over, which is the shape this codebase treats
 * as a bug in itself (`arrange.ts` for dragging, `chrome.ts` for navigation).
 *
 * ## Fixed, not absolute
 *
 * The strip and the bar both scroll sideways, and a panel placed inside a box
 * with `overflow-x: auto` is a panel clipped to the height of one tab. So the
 * caller reads the rectangle it wants to open at — at the moment of the click,
 * before anything can scroll it away — and this places itself against the
 * window and clamps to it. A context menu that opens half off the edge of the
 * screen is the one failure everybody notices.
 *
 * ## Both edges, not just the left one
 *
 * That clamp was horizontal only, and the panel that most needs the other one
 * is the group menu: a name field, twelve swatches and four rows, opened from
 * a strip that on a phone sits at the bottom of the search overlay. Below
 * about two thirds down the window it ran off the end — and `position: fixed`
 * means off the end is gone, not scrolled to. So the height is measured before
 * the browser paints and the panel opens *above* the corner when there is not
 * room under it, which is what a context menu does everywhere else. A panel
 * taller than the whole window scrolls inside itself rather than being cut.
 *
 * ## `role="dialog"`, and not `menu`
 *
 * The app says elsewhere what it means by an ARIA role and does not claim
 * relationships it has not built — see the note on the strip about tabs and
 * tab panels. `role="menu"` promises arrow-key navigation between items with
 * roving focus; this is a small panel of buttons and one field, where Tab is
 * the right key and is the key `useModal` already traps. A dialog is what that
 * is, and the label says which one.
 */

import { useEffect, useLayoutEffect, useState, type ReactNode } from 'react';
import { useModal } from '../a11y/modal';
import { secondLine } from '../lib/dim';

/** How close to the window's edge a panel is allowed to sit. */
const EDGE = 8;
/** And how far it keeps off the control it flipped above. */
const GAP = 4;

/** Where it opens: a point in the window, from a click or a control's corner. */
export interface Corner {
  x: number;
  y: number;
}

export function Popover({
  label,
  corner,
  width = 232,
  onClose,
  children,
}: {
  /** What this panel is, for a screen reader arriving in it. */
  label: string;
  corner: Corner;
  /** Wide enough for its longest row and no wider. */
  width?: number;
  onClose: () => void;
  children: ReactNode;
}) {
  const { ref: box, onKeyDown } = useModal<HTMLDivElement>({ onClose });
  /*
   * Where it actually opens, once its height is known.
   *
   * Starts at the corner, which is right for the great majority of openings
   * and is what is drawn if the measurement cannot happen at all. `useLayout
   * Effect` rather than `useEffect` so the correction lands before the paint
   * and the panel does not visibly jump up the screen.
   */
  const [top, setTop] = useState(corner.y);
  useLayoutEffect(() => {
    const panel = box.current;
    if (!panel) return;
    const place = () => {
      const tall = panel.offsetHeight;
      const room = window.innerHeight - EDGE;
      if (corner.y + tall <= room) return setTop(corner.y);
      // Above the corner, the way every context menu flips. `corner.y` is the
      // bottom of the control that summoned it, so `GAP` keeps the panel off
      // the control rather than under it.
      const above = corner.y - tall - GAP;
      setTop(above >= EDGE ? above : Math.max(EDGE, room - tall));
    };
    place();
    window.addEventListener('resize', place);
    return () => window.removeEventListener('resize', place);
  }, [box, corner.x, corner.y, children]);

  /*
   * A click anywhere else closes it, and it is `pointerdown` rather than
   * `click`: a panel that waits for the button to come back up stays open
   * under the pointer for the whole of a drag started outside it, and on a
   * touch screen the tap that dismisses it would also land on whatever is
   * beneath. Captured, so a control that stops the event still dismisses it.
   */
  useEffect(() => {
    const away = (e: PointerEvent) => {
      if (box.current && e.target instanceof Node && !box.current.contains(e.target)) onClose();
    };
    window.addEventListener('pointerdown', away, true);
    return () => window.removeEventListener('pointerdown', away, true);
  }, [box, onClose]);

  return (
    <div
      ref={box}
      role="dialog"
      aria-modal="false"
      aria-label={label}
      onKeyDown={onKeyDown}
      style={{
        position: 'fixed',
        left: Math.max(EDGE, Math.min(corner.x, window.innerWidth - width - EDGE)),
        top,
        zIndex: 90,
        width,
        maxWidth: 'calc(100vw - 16px)',
        // The last resort, for a panel taller than the window itself: it
        // scrolls rather than losing its bottom rows to the edge.
        maxHeight: 'calc(100dvh - 16px)',
        overflowY: 'auto',
        overscrollBehavior: 'contain',
        padding: 'var(--sp-2)',
        borderRadius: 'var(--r-md)',
        border: '1px solid var(--app-line-top)',
        background: 'var(--app-panel)',
        boxShadow: '0 18px 40px rgba(0,0,0,0.4)',
      }}
    >
      {children}
    </div>
  );
}

/** One line of a panel: a label, and a dot ahead of it where one says a colour. */
export function MenuRow({
  children,
  onPress,
  tone,
}: {
  children: ReactNode;
  onPress: () => void;
  tone?: string;
}) {
  return (
    <button
      type="button"
      className="bare tappable"
      onClick={onPress}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 'var(--sp-4)',
        width: '100%',
        textAlign: 'left',
        padding: 'var(--sp-3) var(--sp-4)',
        borderRadius: 'var(--r-sm)',
        fontSize: 'var(--type-md)',
      }}
    >
      {tone && (
        <span
          aria-hidden="true"
          style={{
            flex: 'none',
            width: 'var(--sp-5)',
            height: 'var(--sp-5)',
            borderRadius: '50%',
            background: tone,
          }}
        />
      )}
      <span
        style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
      >
        {children}
      </span>
    </button>
  );
}

/** The hairline between two kinds of thing a panel can do. */
export function MenuRule() {
  return (
    <div
      aria-hidden="true"
      style={{ height: 1, background: 'var(--app-line)', margin: 'var(--sp-2) var(--sp-3)' }}
    />
  );
}

/** A heading over a run of rows. */
export function MenuLabel({ children }: { children: ReactNode }) {
  return (
    <div className="kicker" style={{ padding: 'var(--sp-3) var(--sp-4) var(--sp-1)', ...secondLine() }}>
      {children}
    </div>
  );
}

/** What a panel says when the thing it is about has nothing to offer. */
export function MenuSaid({ children }: { children: ReactNode }) {
  return (
    <div style={{ padding: 'var(--sp-3) var(--sp-4)', fontSize: 'var(--type-sm)', ...secondLine() }}>
      {children}
    </div>
  );
}
