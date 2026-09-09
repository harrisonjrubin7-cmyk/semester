/**
 * A set of tiles, opened in place over the grid that named it.
 *
 * Tapping a tile — a shelf on the launcher, an intention on the task index —
 * does not navigate. Navigating away to a list and back is how the directory
 * already worked, and it costs the thing the grid was for: you lose the grid
 * you were looking at, so the second tap is a fresh search rather than a
 * correction of the first. Opening over it keeps the grid behind the wash, so
 * "no, the other one" is one tap.
 *
 * This is the chrome only — the wash, the title, the count, the way out — and
 * the tiles themselves are the caller's, because the two callers put
 * different things on them: the launcher's can be dragged into a new order,
 * and the task index's cannot, since an intention is not a place anybody
 * arranges. What they must not differ on is the shape of the thing that opens,
 * which is why the shape is here and not written twice.
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
 * what makes "over the grid" true rather than approximately true.
 */

import { useRef, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { useModal } from '../../a11y/modal';
import { Caps } from '../soft/Soft';

/** How far down a swipe has to travel before it counts as a dismissal. */
const SWIPE = 70;

export function TileSheet({
  name,
  sub,
  onClose,
  children,
}: {
  /** The heading, and the dialog's name for anybody who cannot see it. */
  name: string;
  /** The quiet line under it — how many screens are in here. */
  sub: string;
  onClose: () => void;
  children: ReactNode;
}) {
  const shut = useRef<HTMLButtonElement>(null);
  const down = useRef(0);

  /*
   * Remember where focus was, take it, and give it back on the way out — and
   * keep Tab inside while it is open. `a11y/modal.ts` is every dialog's, so
   * this one cannot drift from the rest of them.
   */
  const modal = useModal<HTMLDivElement>({ onClose, initial: shut });

  const sheet = (
    <div
      className="soft-folder"
      role="dialog"
      aria-modal="true"
      aria-label={name}
      ref={modal.ref}
      tabIndex={-1}
      onKeyDown={modal.onKeyDown}
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
          <div className="soft-folder-name chrome-text">{name}</div>
          <Caps quiet>{sub}</Caps>
        </div>
        <button type="button" className="bare pill-soft" ref={shut} onClick={onClose}>
          Close
        </button>
      </div>

      <div className="soft-folder-grid">{children}</div>
    </div>
  );

  // `.device` is the app's own box and is positioned; body would put the wash
  // outside the phone frame on a wide screen.
  const host = typeof document === 'undefined' ? null : document.querySelector('.device');
  return host ? createPortal(sheet, host) : sheet;
}
