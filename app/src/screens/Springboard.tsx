/**
 * The app as a home screen.
 *
 * An alternate way in, chosen in Settings, not a replacement for the tab bar.
 * The bar is right for somebody who lives in four screens; this is right for
 * somebody who has sixty and would rather see them than remember which
 * shelf they are on. Which is better genuinely depends on the person.
 *
 * The arrangement, the folders and the gating are in `lib/springboard.ts` and
 * tested there. What is here is the part that has to be touched: three swipeable
 * pages, a dock that does not move, folders that open in place, and a search
 * that filters to a flat grid the moment anything is typed.
 *
 * ## It is built from the app's own directory
 *
 * Every icon resolves through `lib/nav.ts`, so a screen added or renamed there
 * appears here without anyone remembering to. A screen the school has no
 * equivalent of never appears at all — no error, no gap.
 *
 * ## And the icons move
 *
 * Hold one and drag it where it goes — on a page, inside a folder, along the
 * dock. This is the screen where a person's expectations are loudest: every
 * phone they have ever owned has taught them that a home screen is theirs to
 * arrange, and one that answered a hold with nothing was a picture of a home
 * screen. Where it lands is a look key; the arithmetic and the guarantees are
 * in `lib/springboard.ts`, the gesture is in `lib/arrange.ts`.
 *
 * The three grids each arrange their own list, which is why the drag is set
 * up three times below rather than once around everything: an icon dragged
 * out of a folder and onto the page behind it is a different operation —
 * moving something *between* lists — and doing it half-way would be worse
 * than not offering it.
 */

import { useRef, useState, type HTMLAttributes } from 'react';
import { useNow, useStore } from '../state/store';
import { outstanding } from '../lib/select';
import { TabGlyph } from '../components/TabIcon';
import { TabList } from '../components/ui';
import {
  DOCK_KEY,
  afterMove,
  arrangedDock,
  arrangedPages,
  folderKey,
  keyOf,
  labelFor,
  matches,
  pageKey,
  searchable,
  type Folder,
} from '../lib/springboard';
import { MOVE_HINT, useMovable } from '../lib/arrange';
import { currentLook } from '../state/shape';
import { lately } from '../lib/nav';
import { useRecentScreens } from '../lib/trail.hook';
import { useBottomChrome } from '../lib/bottomchrome.hook';
import type { Screen } from '../lib/types';

const ICON = 58;

function Icon({
  screen,
  onOpen,
  /**
   * The handlers that make this icon movable, on the grids where it is.
   *
   * Passed in rather than taken here because the hook belongs to the grid —
   * one grid, one list, one saved order — and an icon does not know which of
   * the three it is drawn in. The search results and the Lately row pass
   * nothing: those are answers to a question, not an arrangement, and an
   * order somebody dragged into a search result would last until they typed
   * the next letter.
   */
  drag,
}: {
  screen: string;
  onOpen: (s: string) => void;
  drag?: HTMLAttributes<HTMLElement> & { 'data-drop'?: string };
}) {
  return (
    <button
      type="button"
      {...drag}
      // Merged rather than overwritten: the drag brings `movable` and the
      // state class with it, and the icon still has to look like a button.
      className={`bare tappable${drag?.className ? ` ${drag.className}` : ''}`}
      onClick={() => onOpen(screen)}
      aria-label={drag ? `${labelFor(screen)}. ${MOVE_HINT}` : undefined}
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 'var(--sp-3)',
        width: '100%',
        padding: 0,
        ...drag?.style,
      }}
    >
      <span
        className="iconshape"
        style={{
          width: ICON,
          height: ICON,
          display: 'grid',
          placeItems: 'center',
          background: 'var(--app-panel)',
          border: '1px solid var(--app-line)',
          // `--icon-radius` is the Settings choice; the squircle default here
          // is what an app icon looks like when nobody has chosen.
          borderRadius: 'var(--icon-radius, 16px)',
        }}
      >
        <TabGlyph screen={screen as Screen} size={26} />
      </span>
      <span
        style={{
          fontSize: 'var(--type-2xs)',
          letterSpacing: '0.02em',
          textAlign: 'center',
          lineHeight: 'var(--leading-display-sm)',
          maxWidth: 76,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}
      >
        {labelFor(screen)}
      </span>
    </button>
  );
}

/**
 * A folder, drawn as the first four icons behind one tile.
 *
 * Opens in place rather than on its own screen: a folder that navigates
 * somewhere has stopped being a folder and become another list.
 */
function FolderTile({
  folder,
  onOpen,
  drag,
  tookDrop,
  onArrange,
}: {
  folder: Folder;
  onOpen: (s: string) => void;
  /** The folder's own place on the page, which is the page grid's business. */
  drag?: HTMLAttributes<HTMLElement> & { 'data-drop'?: string };
  tookDrop?: () => boolean;
  /** Its icons' order, which is this folder's. */
  onArrange?: (screens: string[]) => void;
}) {
  const [open, setOpen] = useState(false);
  /*
   * The folder's contents are a grid of icons like any other and arrange the
   * same way. Its own list, saved under its own name — a folder is where the
   * one screen somebody opens it for should be first rather than fourth.
   */
  const inside = useMovable<string>({
    items: folder.screens,
    onMove: (next) => onArrange?.(next),
    disabled: !onArrange,
  });
  return (
    <>
      <button
        type="button"
        {...drag}
        className={`bare tappable${drag?.className ? ` ${drag.className}` : ''}`}
        aria-expanded={open}
        aria-label={drag ? `${folder.label} folder. ${MOVE_HINT}` : undefined}
        // A drop lands as a click on the tile it started from, and without
        // this the folder you have just moved also opens under your finger.
        onClick={() => {
          if (tookDrop?.()) return;
          setOpen((o) => !o);
        }}
        style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 'var(--sp-3)', width: '100%', padding: 0, ...drag?.style }}
      >
        <span
          className="iconshape"
          style={{
            width: ICON,
            height: ICON,
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: 'calc(3px * var(--density, 1))',
            paddingBlock: 'calc(7px * var(--density, 1))', paddingInline: 'calc(7px * var(--density, 1))',
            background: 'var(--app-hero)',
            border: '1px solid var(--app-line)',
            borderRadius: 'var(--icon-radius, 16px)',
          }}
        >
          {folder.screens.slice(0, 4).map((s) => (
            <span key={s} style={{ display: 'grid', placeItems: 'center' }}>
              <TabGlyph screen={s as Screen} size={13} />
            </span>
          ))}
        </span>
        <span style={{ fontSize: 'var(--type-2xs)', lineHeight: 'var(--leading-display-sm)' }}>
          {folder.label}
        </span>
      </button>

      {open && (
        <div
          style={{
            gridColumn: '1 / -1',
            display: 'grid',
            gridTemplateColumns: 'repeat(4, 1fr)',
            gap: 'var(--sp-7)',
            paddingBlock: 'calc(14px * var(--density, 1))', paddingInline: 'calc(12px * var(--density, 1))',
            marginTop: 'calc(4px * var(--density, 1))', marginInline: '0', marginBottom: 'calc(8px * var(--density, 1))',
            background: 'var(--app-panel)',
            border: '1px solid var(--app-line)',
            borderRadius: 'var(--r-md)',
          }}
        >
          {folder.screens.map((s) => (
            <Icon
              key={s}
              screen={s}
              onOpen={(screen) => {
                if (inside.tookDrop()) return;
                onOpen(screen);
              }}
              drag={onArrange ? inside.props(s) : undefined}
            />
          ))}
        </div>
      )}
    </>
  );
}

export function Springboard() {
  const { state, dispatch, school, catalog } = useStore();
  const now = useNow();
  const [page, setPage] = useState(0);
  const [query, setQuery] = useState('');
  const recentScreens = useRecentScreens();

  const look = currentLook(state);
  const pages = arrangedPages(school.capabilities, look.boardOrder, state.role);
  const dock = arrangedDock(school.capabilities, look.boardOrder, state.role);
  // What the assistant's floating button has to clear. See the dock below.
  const dockBox = useRef<HTMLDivElement>(null);
  useBottomChrome(dockBox);
  const open = (screen: string) => dispatch({ type: 'go', screen: screen as Screen });

  /** One list of the arrangement, written back whole. See `afterMove`. */
  const arrange = (list: string, items: string[]) =>
    dispatch({ type: 'setLook', look: { boardOrder: afterMove(look.boardOrder, list, items) } });

  // Clamped the same way `here` is: a page index past the end after the
  // school gate has emptied one would save an arrangement under a page
  // nobody is looking at.
  const at = Math.max(0, Math.min(page, pages.length - 1));
  const grid = useMovable<string>({
    items: (pages[at]?.items ?? []).map(keyOf),
    onMove: (items) => arrange(pageKey(at), items),
  });
  const inDock = useMovable<string>({
    items: dock,
    onMove: (items) => arrange(DOCK_KEY, items),
  });

  const searching = query.trim().length > 0;
  const found = searchable(school.capabilities, state.role).filter((s) => matches(s, query));
  const here = pages[at];

  const due = outstanding(catalog, state);
  // Against the dock rather than the tab bar: this layout's own navigation is
  // the dock, and a shortcut to something already one tap away is noise. Same
  // rule as the Me screen, from the same place. See `lib/nav.ts`.
  const recent = lately(recentScreens, dock, school.capabilities, [], 4, state.role);

  /*
   * No `<Page>` here, deliberately.
   *
   * This screen already is a search box — it is the launcher, and the field
   * below is the only thing on it above the fold. The frame's box would be a
   * second one, directly above, filtering a different thing.
   */
  return (
    /*
     * A `<nav>`, like the other three.
     *
     * The tab bar and the rail are `<nav aria-label="Sections">` and the
     * shelves are `<nav aria-label="Screens">`. This one — the whole of it,
     * because the whole of it is the navigation: a field that searches
     * *screens*, a grid of icons that open them, and the dock, which the note
     * on `recent` above calls "this layout's own navigation" — was a plain
     * `<div>`. So choosing the home screen left the app with no navigation
     * landmark at all, and "jump to the navigation" found nothing on any
     * screen.
     *
     * The same label as the bar and the rail, because it is the same job. A
     * search box inside a nav is not a contradiction here: what it finds is
     * places to go, not content.
     */
    <nav
      aria-label="Sections"
      style={{ display: 'flex', flexDirection: 'column', minHeight: '100%', paddingTop: 'calc(10px * var(--density, 1))', paddingInline: 'calc(14px * var(--density, 1))', paddingBottom: '0' }}
    >
      <input
        className="input"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search"
        aria-label="Search the app"
        style={{ width: '100%', height: 38, marginBottom: 'calc(14px * var(--density, 1))', fontSize: 'var(--type-base)' }}
      />

      {searching ? (
        <>
          <div style={{ fontSize: 'var(--type-xs-plus)', color: 'var(--app-dim)', marginBottom: 'var(--sp-5)' }}>
            {found.length === 0
              ? 'Nothing here by that name.'
              : `${found.length} ${found.length === 1 ? 'place' : 'places'}`}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 'calc(18px * var(--density, 1))' }}>
            {found.map((s) => (
              <Icon key={s} screen={s} onOpen={open} />
            ))}
          </div>
        </>
      ) : (
        <>
          {here?.widgets && (
            // One widget, not a wall of them. It says the thing the home screen
            // exists to say and then gets out of the way.
            <button
              type="button"
              className="bare tappable"
              onClick={() => open('home')}
              style={{
                width: '100%',
                textAlign: 'left',
                paddingBlock: 'calc(13px * var(--density, 1))', paddingInline: 'calc(14px * var(--density, 1))',
                marginBottom: 'var(--sp-7)',
                background: 'var(--app-hero)',
                border: '1px solid var(--app-line)',
                borderRadius: 'var(--r-md)',
              }}
            >
              <span className="kicker" style={{ fontSize: 'var(--type-2xs)' }}>
                {now.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })}
              </span>
              <span
                style={{
                  display: 'block',
                  fontFamily: 'var(--font-heading)',
                  fontSize: 'var(--type-display-xs)',
                  marginTop: 'var(--sp-2)',
                }}
              >
                {due === 0
                  ? 'Nothing outstanding.'
                  : `${due} ${due === 1 ? 'thing' : 'things'} still to do`}
              </span>
            </button>
          )}

          {/*
            The four you keep coming back to, on the first page only.

            A launcher is a grid of sixty things arranged by category, and
            a category is the thing nobody remembers. Repeating this on every
            page would be four icons of chrome on each; the first page is where
            somebody lands.
          */}
          {page === 0 && recent.length > 0 && (
            <div style={{ marginBottom: 'calc(18px * var(--density, 1))' }}>
              <div className="kicker" style={{ fontSize: 'var(--type-2xs)', marginBottom: 'var(--sp-4)' }}>
                Lately
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 'calc(18px * var(--density, 1))' }}>
                {recent.map((d) => (
                  <Icon key={d.screen} screen={d.screen} onOpen={open} />
                ))}
              </div>
            </div>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 'calc(18px * var(--density, 1))' }}>
            {here?.items.map((item) =>
              typeof item === 'string' ? (
                <Icon
                  key={item}
                  screen={item}
                  // A drop ends in a click on the icon it started from, so
                  // the screen it was dragged over would otherwise open.
                  onOpen={(screen) => {
                    if (grid.tookDrop()) return;
                    open(screen);
                  }}
                  drag={grid.props(item)}
                />
              ) : (
                <FolderTile
                  key={item.label}
                  folder={item}
                  onOpen={open}
                  drag={grid.props(keyOf(item))}
                  tookDrop={grid.tookDrop}
                  onArrange={(screens) => arrange(folderKey(item.label), screens)}
                />
              ),
            )}
          </div>

          {pages.length > 1 && (
            <TabList
              label="Pages"
              style={{ display: 'flex', gap: 'var(--sp-4)', justifyContent: 'center', paddingTop: 'calc(20px * var(--density, 1))', paddingInline: '0', paddingBottom: 'calc(8px * var(--density, 1))' }}
              /*
                A 7px dot is what a page indicator looks like everywhere, and
                a 7px dot is not something a thumb can hit. So the dot is
                drawn at 7 and the button around it is 24 — the floor — with
                nothing but space between the drawing and the edge of the
                target. `tap` is no use here: the dots sit 8px apart, and a
                44px overlay on each would have every one of them reaching
                across its neighbours, which is the failure that class's own
                note warns about.
              */
              tabs={pages.map((_, i) => ({
                id: String(i),
                label: (
                  <span
                    aria-hidden
                    style={{
                      display: 'block',
                      width: 7,
                      height: 7,
                      borderRadius: '50%',
                      background: i === page ? 'var(--app-accent)' : 'var(--app-line)',
                    }}
                  />
                ),
                ariaLabel: `Page ${i + 1}`,
              }))}
              value={String(page)}
              onChange={(id) => setPage(Number(id))}
              tabClassName="bare"
              tabStyle={() => ({
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: 24,
                height: 24,
                flex: 'none',
                padding: 0,
                background: 'transparent',
              })}
            />
          )}
        </>
      )}

      <div style={{ flex: 1, minHeight: 12 }} />

      {/*
        The dock does not move between pages, which is the whole point of it.
        What is in it does: four icons, and which four in what order is the
        only thing the dock is for.

        It reports itself as the bottom chrome. It is not a bar — it is drawn
        in the page's own flow, with the spacer above pushing it down — but it
        is what is along the bottom of this navigation, and the assistant's
        floating button is fixed to the viewport and has to clear it. It did
        not: with nothing reported the button fell back to the height of a tab
        bar this navigation does not have, and landed across the fourth
        label.
      */}
      <div
        ref={dockBox}
        style={{
          display: 'grid',
          gridTemplateColumns: `repeat(${Math.max(1, dock.length)}, 1fr)`,
          gap: 'calc(18px * var(--density, 1))',
          paddingBlock: 'calc(14px * var(--density, 1))', paddingInline: 'calc(12px * var(--density, 1))',
          marginBottom: 'var(--sp-5)',
          background: 'var(--app-panel)',
          border: '1px solid var(--app-line)',
          borderRadius: 'var(--r-lg)',
        }}
      >
        {dock.map((s) => (
          <Icon
            key={s}
            screen={s}
            onOpen={(screen) => {
              if (inDock.tookDrop()) return;
              open(screen);
            }}
            drag={inDock.props(s)}
          />
        ))}
      </div>
    </nav>
  );
}
