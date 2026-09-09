/**
 * A shelf, opened in place.
 *
 * Tapping a shelf on the launcher does not navigate. Navigating away to a
 * list and back is how the directory already worked, and it costs the thing
 * the launcher was for: you lose the grid you were looking at, so the second
 * tap is a fresh search rather than a correction of the first. Opening over
 * it keeps the grid behind the wash, so "no, the other one" is one tap.
 *
 * ## Dragging, and the keyboard that has to do the same job
 *
 * Tiles are dragged with pointer events rather than HTML5 drag-and-drop,
 * which does not fire on touch at all — a phone-first app whose only
 * arrangement gesture works on a laptop has not shipped the feature.
 *
 * A drag is also not a thing everybody can do, so Alt with the arrow keys
 * moves the focused tile by one. Same operation, same look key, no pointer.
 *
 * ## Focus
 *
 * Trapped while it is open, and handed back to the tile that opened it on the
 * way out — an overlay that dumps focus on `<body>` sends a keyboard user to
 * the top of the page to find their place again.
 *
 * ## Why it is a portal
 *
 * Rendered where it is written, this sits inside the scrolling column, inside
 * `Page`'s frame — so `inset: 0` covered the content area and not the app,
 * and the wash left the header, the tab bar and the screen's own stat row
 * showing round its edges. `Command` solves the same problem the same way:
 * one element, `absolute` against `.device`, above everything. The portal is
 * what makes "over the launcher" true rather than approximately true.
 */

import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useStore } from '../../state/store';
import { readOrder, writeOrder } from '../../lib/launcher';
import { MOVE_HINT, useMovable } from '../../lib/arrange';
import { currentLook } from '../../state/shape';
import type { Destination, Group } from '../../lib/nav';
import type { Screen } from '../../lib/types';
import { TabGlyph } from '../TabIcon';
import { Blueprint } from '../Blueprint';
import { Caps } from '../soft/Soft';

/** How far down a swipe has to travel before it counts as a dismissal. */
const SWIPE = 70;

export function Folder({
  group,
  tiles,
  says,
  onClose,
}: {
  group: Group;
  tiles: Destination[];
  says: (d: Destination) => { label: string; blurb: string };
  onClose: () => void;
}) {
  const { state, dispatch } = useStore();
  const box = useRef<HTMLDivElement>(null);
  const shut = useRef<HTMLButtonElement>(null);
  const came = useRef<Element | null>(null);
  const down = useRef(0);

  /* Remember where focus was, take it, and give it back on the way out. */
  useEffect(() => {
    came.current = document.activeElement;
    shut.current?.focus();
    return () => {
      const back = came.current;
      if (back instanceof HTMLElement && document.contains(back)) back.focus();
    };
  }, []);

  /*
   * The gesture, and the keyboard that has to do the same job.
   *
   * Both are `lib/arrange.ts`'s now rather than this file's. What was here
   * was the app's first drag-to-arrange, and it had learned three things the
   * hard way — a press is a drag only once it is held, a drop ends in a click
   * that has to be told to stand down, and Alt with the arrow keys does the
   * same job without a pointer. Every list that has since become movable
   * would otherwise have had to learn all three again.
   *
   * `tiles` is the shelf as drawn, so the whole of it is written down on
   * every move rather than the pair that swapped: a partial order leaves the
   * rest at the mercy of a registry edit, which is the one thing somebody who
   * has arranged their tiles does not expect.
   */
  const shelf = useMovable<Screen>({
    items: tiles.map((d) => d.screen),
    onMove: (moved) => {
      const order = readOrder(currentLook(state).groupOrder);
      dispatch({
        type: 'setLook',
        look: { groupOrder: writeOrder({ ...order, [group]: moved }) },
      });
    },
  });

  const sheet = (
    <div
      className="soft-folder"
      role="dialog"
      aria-modal="true"
      aria-label={group}
      ref={box}
      onKeyDown={(e) => {
        if (e.key === 'Escape') {
          e.preventDefault();
          e.stopPropagation();
          onClose();
          return;
        }
        if (e.key !== 'Tab') return;
        // The trap. Two ends of the tab ring, wrapped by hand.
        const focusable = box.current?.querySelectorAll<HTMLElement>('button:not([disabled])');
        if (!focusable || focusable.length === 0) return;
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }}
      onTouchStart={(e) => {
        down.current = e.touches[0]?.clientY ?? 0;
      }}
      onTouchEnd={(e) => {
        const up = e.changedTouches[0]?.clientY ?? 0;
        // Down only. A swipe up is a scroll, and closing on one would make
        // the grid impossible to read past its second row.
        if (down.current > 0 && up - down.current > SWIPE) onClose();
      }}
    >
      <div className="soft-folder-top">
        <div>
          <div className="soft-folder-name chrome-text">{group}</div>
          <Caps quiet>{tiles.length === 1 ? '1 screen' : `${tiles.length} screens`}</Caps>
        </div>
        <button type="button" className="bare pill-soft" ref={shut} onClick={onClose}>
          Close
        </button>
      </div>

      <div className="soft-folder-grid">
        {tiles.map((d) => {
          const said = says(d);
          return (
            <Blueprint
              plain
              as="button"
              key={d.screen}
              {...shelf.props(d.screen, { className: 'soft-tile surface soft-folder-tile' })}
              aria-label={`${said.label}. ${MOVE_HINT}`}
              onClick={() => {
                // A drop ends in a click on the tile it started from, so
                // without this the drag would open what it landed on.
                if (shelf.tookDrop()) return;
                dispatch({ type: 'go', screen: d.screen });
                onClose();
              }}
            >
              <div className="soft-tile-glyph">
                <TabGlyph screen={d.screen} size={18} />
              </div>
              <Caps>{said.label}</Caps>
              <div className="soft-tile-sub">{said.blurb}</div>
            </Blueprint>
          );
        })}
      </div>
    </div>
  );

  // `.device` is the app's own box and is positioned; body would put the wash
  // outside the phone frame on a wide screen.
  const host = typeof document === 'undefined' ? null : document.querySelector('.device');
  return host ? createPortal(sheet, host) : sheet;
}
