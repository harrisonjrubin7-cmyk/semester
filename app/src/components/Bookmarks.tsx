/**
 * The star, the bar, and what a chip on it can do.
 *
 * A tab is where you are; a bookmark is where you keep going back to. The
 * strip made the first cheap and made the second obvious — the ECON guide, the
 * essay brief and the deadline you are counting down to get opened twenty
 * times a term, and before this the only way to keep one to hand was to leave
 * a tab open for a fortnight, at the cost of a strip nobody can read.
 *
 * Three pieces, and they are one feature seen from three places:
 *
 * - **`BookmarkStar`** sits in the workspace's search field, where the star
 *   sits in every browser window anybody has open. Filled means this page is
 *   saved; pressing it saves or forgets.
 * - **`BookmarksBar`** is the row under that field. It is drawn only once
 *   there is something in it — an empty strip of chrome under the search box
 *   is a row people learn to look past, and the app has enough chrome at the
 *   top of the workspace already.
 * - **`BookmarkChips`** is the same row, laid out for the two places that are
 *   not that bar: the new tab page, where a browser puts them under the box,
 *   and the search overlay a phone reaches its tabs through.
 *
 * ## A chip opens here; a menu is where the rest is
 *
 * Clicking goes there in the tab you are on, which is what a bookmark is for.
 * Middle-click opens it in a tab of its own — the browser gesture, and the one
 * people who use it will try first. Everything else (open in a new tab,
 * rename, move along the bar, remove) is one right-click or one press of the ⌄
 * away, which is also the only route a touchscreen has.
 *
 * The rules are in `lib/bookmarks.ts`; nothing here decides anything.
 */

import { useRef, useState, type MouseEvent as ReactMouseEvent } from 'react';
import { useStore } from '../state/store';
import { secondLine } from '../lib/dim';
import { MARK_NAME, savable, type Bookmark } from '../lib/bookmarks';
import {
  dropMark,
  isSaved,
  renameMark,
  shiftMark,
  star,
  useMarks,
} from '../lib/bookmarks.hook';
import { openInNew, useStrip } from '../lib/browser.hook';
import { current } from '../lib/browser';
import { MenuRow, MenuRule, Popover, type Corner } from './Popover';
import { ChevronDown, StarIcon } from './Icons';
import { TabGlyph } from './TabIcon';

/**
 * The star in the search field.
 *
 * It is about the tab you are on rather than about the screen: the strip
 * already knows the difference between "Course" and "ECON 1020", and a star
 * that saved the screen would put four identical chips on the bar for four
 * courses.
 */
export function BookmarkStar() {
  const strip = useStrip();
  // Subscribed to both: the star is filled from the bookmarks and aimed by the
  // strip, and either changing under it has to redraw it.
  useMarks();
  const tab = current(strip);
  const can = savable(tab);
  const saved = can && isSaved(tab.screen, tab.place);

  return (
    <button
      type="button"
      className="bare desktop-star"
      disabled={!can}
      onClick={() => {
        if (tab.screen) star({ screen: tab.screen, title: tab.title, place: tab.place });
      }}
      aria-label={
        !can
          ? 'Nothing to bookmark on a new tab'
          : saved
            ? `Remove the bookmark for ${tab.title}`
            : `Bookmark ${tab.title}`
      }
      aria-pressed={can ? saved : undefined}
      title={saved ? 'Saved — press to remove' : 'Bookmark this page'}
      style={{ width: 'auto', flex: 'none', padding: 'var(--sp-2)', ...(saved ? {} : secondLine()) }}
    >
      <StarIcon on={Boolean(saved)} size={17} />
    </button>
  );
}

/** The row under the workspace's search field. Nothing at all until it has one. */
export function BookmarksBar() {
  const marks = useMarks();
  if (marks.length === 0) return null;
  return (
    <div
      className="deskmarks"
      aria-label="Bookmarks"
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 'var(--sp-1)',
        padding: 'var(--sp-1) var(--sp-4) var(--sp-2)',
        borderBottom: '1px solid var(--app-line)',
        overflowX: 'auto',
        flex: 'none',
      }}
    >
      <Chips marks={marks} />
    </div>
  );
}

/**
 * The same chips, for the new tab page and the search overlay.
 *
 * `said` is the line above them. On the new tab page it is worth having —
 * the row sits under the shortcuts and needs to say which of the two it is;
 * in the overlay, directly under the strip, it would be a label on the
 * obvious.
 */
export function BookmarkChips({ said = '', onOpened }: { said?: string; onOpened?: () => void }) {
  const marks = useMarks();
  if (marks.length === 0) return null;
  return (
    <div aria-label="Bookmarks" style={{ width: '100%' }}>
      {said && (
        <div className="kicker" style={{ padding: '0 0 var(--sp-3)', ...secondLine() }}>
          {said}
        </div>
      )}
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          justifyContent: 'center',
          gap: 'var(--sp-2)',
        }}
      >
        <Chips marks={marks} onOpened={onOpened} />
      </div>
    </div>
  );
}

/** The chips themselves, and the one menu the three rows share. */
function Chips({ marks, onOpened }: { marks: Bookmark[]; onOpened?: () => void }) {
  const { dispatch } = useStore();
  const [menu, setMenu] = useState<{ id: string; corner: Corner } | null>(null);

  /** Go there, in the tab you are on. A bookmark is a place, not a new tab. */
  const open = (mark: Bookmark) => {
    for (const action of mark.place) dispatch(action);
    onOpened?.();
  };

  /** And the middle-click, which is the same place in a tab of its own. */
  const beside = (mark: Bookmark) => {
    openInNew(mark.screen, mark.title, mark.place);
    open(mark);
  };

  const summon = (id: string, e: ReactMouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const box = e.currentTarget.getBoundingClientRect();
    const pointer = e.detail > 0 && e.clientY > 0;
    setMenu({
      id,
      corner: { x: pointer ? e.clientX : box.left, y: pointer ? e.clientY : box.bottom + 2 },
    });
  };

  return (
    <>
      {marks.map((mark) => (
        <div
          key={mark.id}
          onContextMenu={(e) => summon(mark.id, e)}
          style={{ display: 'flex', alignItems: 'center', flex: 'none', maxWidth: 200 }}
        >
          <button
            type="button"
            className="bare tappable"
            onClick={() => open(mark)}
            // The middle button, as every browser has it. `onAuxClick` rather
            // than a check inside `onClick`: a middle press never fires one.
            onAuxClick={(e) => {
              if (e.button === 1) {
                e.preventDefault();
                beside(mark);
              }
            }}
            title={mark.title}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 'var(--sp-3)',
              minWidth: 0,
              width: 'auto',
              textAlign: 'left',
              padding: 'var(--sp-2) var(--sp-3)',
              borderRadius: 'var(--r-sm)',
              fontSize: 'var(--type-sm)',
            }}
          >
            <TabGlyph screen={mark.screen} size={14} />
            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {mark.title}
            </span>
          </button>
          <button
            type="button"
            className="bare tappable"
            onClick={(e) => summon(mark.id, e)}
            aria-label={`What this bookmark can do — ${mark.title}`}
            aria-haspopup="dialog"
            style={{
              width: 'auto',
              flex: 'none',
              padding: 'var(--sp-2) var(--sp-1)',
              ...secondLine(),
            }}
          >
            <ChevronDown size={12} />
          </button>
        </div>
      ))}
      {menu && (
        <MarkMenu
          id={menu.id}
          corner={menu.corner}
          onClose={() => setMenu(null)}
          onOpenBeside={beside}
        />
      )}
    </>
  );
}

function MarkMenu({
  id,
  corner,
  onClose,
  onOpenBeside,
}: {
  id: string;
  corner: Corner;
  onClose: () => void;
  onOpenBeside: (mark: Bookmark) => void;
}) {
  const marks = useMarks();
  const mark = marks.find((m) => m.id === id);
  /*
   * The name is typed here and saved on every keystroke, with a local copy as
   * what is drawn — the same arrangement the group's name has, and for the
   * same reason: a field reading back from the store it writes to loses a
   * character the moment anything else re-renders.
   */
  const [name, setName] = useState(mark?.title ?? '');
  const field = useRef<HTMLInputElement>(null);

  if (!mark) return null;
  const at = marks.findIndex((m) => m.id === id);

  return (
    <Popover label={`Bookmark — ${mark.title}`} corner={corner} onClose={onClose}>
      <input
        ref={field}
        className="input"
        value={name}
        maxLength={MARK_NAME}
        aria-label="Name this bookmark"
        onChange={(e) => {
          setName(e.target.value);
          renameMark(id, e.target.value);
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            onClose();
          }
        }}
        style={{ width: '100%', marginBottom: 'var(--sp-2)', fontSize: 'var(--type-md)' }}
      />
      <MenuRow
        onPress={() => {
          onOpenBeside(mark);
          onClose();
        }}
      >
        Open in a new tab
      </MenuRow>
      <MenuRule />
      {at > 0 && (
        <MenuRow
          onPress={() => {
            shiftMark(id, -1);
            onClose();
          }}
        >
          Move left
        </MenuRow>
      )}
      {at < marks.length - 1 && (
        <MenuRow
          onPress={() => {
            shiftMark(id, 1);
            onClose();
          }}
        >
          Move right
        </MenuRow>
      )}
      <MenuRow
        onPress={() => {
          dropMark(id);
          onClose();
        }}
      >
        Remove this bookmark
      </MenuRow>
    </Popover>
  );
}
