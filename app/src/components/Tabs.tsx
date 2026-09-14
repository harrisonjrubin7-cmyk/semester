/**
 * The tab strip, in the two places it is drawn — and the piece that keeps it
 * honest.
 *
 * A strip that only exists inside the search overlay is a list of places you
 * have been, which the app already had. What makes tabs worth having is the
 * thing a browser does: they are *on the window*, all the time, so going back
 * to the deadline you were reading is one click from wherever you are, with
 * nothing opened and nothing dismissed on the way.
 *
 * So this is mounted above the header on a window wide enough to hold it, and
 * again inside the overlay where a phone can reach it. One component, because
 * two strips would disagree about which tab is on the first time one of them
 * was changed — and one store behind it, `lib/browser.hook.ts`, for the same
 * reason.
 *
 * ## It appears when it is useful, and not before
 *
 * With one tab open there is nothing to switch to, and a row of chrome that
 * never does anything is a row of chrome people learn to ignore. So the bar
 * above the header draws itself from the second tab onwards. Inside the
 * overlay it is always there, because that is where tabs are opened.
 *
 * ## Picking a tab replays what opened it
 *
 * Not `go(screen)`: "Course" is not a place, and a tab that lands you on the
 * last course you happened to open is a tab that lies. Each tab carries the
 * actions that opened it — see `place` in `lib/browser.ts` — so ECON 1020
 * comes back as ECON 1020, and the guide unit comes back in the mode it was
 * being read in.
 *
 * ## Groups are drawn as runs, not as a second row
 *
 * A group is its tabs with a coloured head in front of them and a wash behind
 * them — one object on the strip rather than a folder somewhere else. That is
 * the whole reason the model keeps a group's tabs next to each other
 * (`tidy` in `lib/browser.ts`): the drawing is the grouping, and a run split
 * in two by somebody else's tab would be a colour repeated rather than a
 * group. Folded, the run is its head alone with a count on it, which is what
 * buys back the room on a strip that has reached ten.
 */

import { useEffect, useMemo, useRef, useState, type MouseEvent as ReactMouseEvent } from 'react';
import { useStore } from '../state/store';
import { strip as stripNow } from '../lib/browser.hook';
import {
  closeTab,
  foldGroup,
  here,
  openTab,
  pickTab,
  record,
  useStrip,
} from '../lib/browser.hook';
import { MAX_TABS, NEW_TAB, lanes, placeFor, sameplace } from '../lib/browser';
import { screenName } from '../lib/nav';
import type { Catalog } from '../data/catalog';
import type { State } from '../state/shape';
import { secondLine } from '../lib/dim';
import { ChevronDown, Plus, Search as SearchIcon } from './Icons';
import { TabGlyph } from './TabIcon';
import { StripMenu, type MenuOn } from './TabMenu';
import type { Corner } from './Popover';
import { toneAt, useTones } from './tones';
import type { CourseTint } from '../lib/tint';
import type { AppTab, Seat, TabGroup } from '../lib/browser';
import { useModernShell } from './shell-context';

/**
 * The strip follows the app, wherever the app is driven from.
 *
 * Mounted once, next to the search overlay, so a tab records the place you
 * navigated to whether you got there from the strip, the tab bar, a link in
 * an answer or the browser's own Back button. Without it the strip would only
 * be right about the places search sent you to, which is the minority of them.
 *
 * Nothing is recorded on the app's first look. A tab opened and left empty is a
 * new tab, and a new tab that adopted whatever was already on screen the
 * moment the app reloaded would be a tab nobody opened.
 */
/**
 * What the guide-family screens are called on a tab.
 *
 * `screenName` answers "this study guide" and "this quiz", which is right for
 * the sentence it was written for — "Ask about ___" — and wrong on a tab,
 * where the label is a name rather than a phrase. A tab says ECON 1020 · Quiz.
 */
const UNDER_A_COURSE: Partial<Record<string, string>> = {
  guide: 'Study guide',
  quiz: 'Quiz',
  drill: 'Drill',
  lesson: 'Lesson',
  slides: 'Slides',
  edit: 'Edit',
};

/**
 * What to call a tab that the app navigated to by itself.
 *
 * A tab reading "this course" is the strip admitting it does not know which
 * one, and the app does know: the screen is about an id, and the id names
 * something with a title. Search-opened tabs already carry the name of what
 * was opened; this is the other half, for everything reached by tapping.
 */
function nameFor(state: State, catalog: Catalog): string {
  const { screen } = state;
  const code = catalog.byId[state.courseId]?.code;
  const under = UNDER_A_COURSE[screen];
  if (under) {
    const guideCode = catalog.byId[state.guideId]?.code;
    // The editor is about the course you are editing; the other four are
    // about the guide you are reading, which is its own id.
    const prefix = screen === 'edit' ? code : guideCode;
    return prefix ? `${prefix} · ${under}` : under;
  }
  switch (screen) {
    /*
     * The two screens the workspace shell is made of, named the way a browser
     * names them rather than the way the registry does. `screenName` answers
     * "the search home", which is right in the sentence it was written for and
     * wrong on a tab — a tab on a blank search page says New tab, because that
     * is what it is.
     */
    case 'search':
      return NEW_TAB;
    case 'directory':
      return 'All apps';
    case 'course':
      return code ?? screenName(screen);
    case 'item':
      return catalog.items.find((i) => i.id === state.itemId)?.title ?? 'Deadline';
    case 'note':
      return state.notes.find((n) => n.id === state.noteId)?.title || 'Note';
    case 'write':
      return state.documents.find((d) => d.id === state.documentId)?.title || 'Document';
    case 'sheet':
      return state.sheets.find((x) => x.id === state.sheetId)?.title || 'Sheet';
    case 'deck':
      return state.decks.find((d) => d.id === state.deckId)?.title || 'Deck';
    default:
      return screenName(screen);
  }
}

/**
 * Whether the app has looked at where it is yet, since the page loaded.
 *
 * The guard below is about the *reload* — a strip coming back off the device
 * must not have its blank tab silently filled in with whatever screen the
 * address happened to name. That is a fact about the page, and it was kept as
 * a ref, which made it a fact about this component's mounting instead.
 *
 * The two came apart the moment a shell moved this between two positions in
 * its tree: every navigation remounted it, every remount looked like a reload,
 * and the guard then fired on every navigation rather than once. The strip
 * stopped recording anything at all — see `BrowserShell` in `App.tsx`, which
 * is where that happened and is now also mounted so it cannot.
 *
 * Module state, because that is what "since the page loaded" means. It is only
 * ever set, so there is nothing to reset between tests: a second mount in one
 * page is not a reload and should not behave like one.
 */
let looked = false;

export function TabsFollow() {
  const { state, catalog } = useStore();
  // Destructured, so the memo below depends on the ten ids that make a place
  // rather than on the whole store: `state` changes on every keystroke
  // anywhere in the app, and this would then re-run on every keystroke too.
  const {
    screen,
    courseId,
    itemId,
    eventId,
    guideId,
    noteId,
    documentId,
    sheetId,
    deckId,
    mode,
    openUnit,
    callCode,
  } = state;
  const at = useMemo(
    () =>
      placeFor(screen, {
        courseId,
        itemId,
        eventId,
        guideId,
        noteId,
        documentId,
        sheetId,
        deckId,
        mode,
        /* A study tab remembers the unit it is open on and a call tab its
           room, so two study tabs come back to their own. See `placeFor`. */
        openUnit,
        callCode,
      }),
    [
      screen,
      courseId,
      itemId,
      eventId,
      guideId,
      noteId,
      documentId,
      sheetId,
      deckId,
      mode,
      openUnit,
      callCode,
    ],
  );
  const seen = useRef<string | null>(null);

  useEffect(() => {
    const key = JSON.stringify(at);
    const firstLook = !looked;
    looked = true;
    if (seen.current === key) return;
    seen.current = key;
    const tab = here();
    /*
     * On the first look the strip adopts the app only if the tab it is on is
     * showing a page — and a lone new tab counts as one, because a strip of
     * one blank tab is not a tab somebody opened and left empty, it is the
     * app before anybody opened a second one. With several tabs open, a blank
     * one was deliberate and stays the search page.
     */
    if (firstLook && !tab.screen && stripNow().tabs.length > 1) return;
    /*
     * And the name the tab keeps: whoever opened it named it after the thing
     * — "ECON 1020", not "this course" — so re-recording the same place must
     * not rename it. Only a move gets a new name.
     */
    const named = sameplace(tab.place, at) && tab.title ? tab.title : nameFor(state, catalog);
    record(screen, named, at);
  }, [at, screen, state, catalog]);

  return null;
}

export function TabStrip({
  /** Drawn inside the search overlay, which has its own ground and a Close. */
  inOverlay = false,
  /**
   * Drawn from the first tab rather than the second.
   *
   * The workspace asks for this, and it is the one layout where it is right:
   * there the strip is the top edge of the navigation itself, so a bar that
   * arrived on the second tab would push the whole app down a row the first
   * time somebody opened one. Everywhere else the rule above still holds —
   * a row of chrome that can never do anything is a row people learn to look
   * past.
   */
  alwaysOn = false,
  /** What the tab you are on is searching for, if it is searching. */
  searching = '',
  /** Called after a tab has been opened — the overlay closes itself. */
  onOpened,
  /** Called when the tab you land on is a new tab, which is the search page. */
  onBlank,
  /** The overlay's own dismiss, drawn at the end of the row. */
  onDismiss,
}: {
  inOverlay?: boolean;
  alwaysOn?: boolean;
  searching?: string;
  onOpened?: () => void;
  onBlank?: () => void;
  onDismiss?: () => void;
}) {
  const { dispatch } = useStore();
  const strip = useStrip();
  const tones = useTones();
  /** The tab or group menu, and where it was summoned from. See `TabMenu`. */
  const [menu, setMenu] = useState<{ on: MenuOn; corner: Corner } | null>(null);
  const modern = useModernShell();
  const full = strip.tabs.length >= MAX_TABS;

  /*
   * A new tab's page is the search page, and going to one is a navigation.
   *
   * The overlay hands in its own `onBlank` because it has to close itself on
   * the way. Every other mount is a bare `<TabStrip />` on the window, and
   * those had no handler at all — so picking a new tab, or pressing the +,
   * marked it as the tab you were on and left the previous screen in front of
   * you. The strip then said you were somewhere you were not, which is the one
   * thing it cannot get wrong. `search` is `SearchHome` in every navigation,
   * so this is the same landing the overlay makes.
   */
  const blank = () => {
    if (onBlank) onBlank();
    else dispatch({ type: 'go', screen: 'search' });
  };

  /** Put the app where a tab says, or hand a new tab to the search page. */
  const land = (tab: AppTab) => {
    if (tab.screen && tab.place.length > 0) {
      for (const action of tab.place) dispatch(action);
      onOpened?.();
      return;
    }
    blank();
  };

  /** Close a tab, and go wherever closing it revealed. */
  const shut = (which: number) => {
    const landed = closeTab(which);
    // Closing the tab you are on reveals its neighbour, and a tab's page is
    // the app — so revealing one is going to it.
    if (which === strip.at) land(landed);
  };

  /*
   * The menu opens under the control that asked for it, or at the pointer
   * when it was a right-click. Both are read here rather than in the menu: by
   * the time it renders, the strip may have scrolled the control away.
   */
  const summon = (on: MenuOn, e: ReactMouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const box = e.currentTarget.getBoundingClientRect();
    const pointer = e.detail > 0 && e.clientY > 0;
    setMenu({ on, corner: { x: pointer ? e.clientX : box.left, y: pointer ? e.clientY : box.bottom + 2 } });
  };
  /* Inside the browser shell the strip is the shell's, not ours — drawing
     this one too is the doubling `lib/chrome.ts` exists to stop. */
  if (modern) return null;
  if (!inOverlay && !alwaysOn && strip.tabs.length < 2) return null;

  const rows = lanes(strip);

  return (
    <div
      // A row of places, not a set of ARIA tabs: there are no tab panels here,
      // and telling a screen reader otherwise would promise a relationship
      // between this and something on the page that does not exist. The tab
      // that is on says so with `aria-current`, which is what a list of links
      // to places uses.
      aria-label="Open tabs"
      className={alwaysOn ? 'deskstrip' : undefined}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 'var(--sp-1)',
        padding: 'var(--sp-2) var(--sp-4)',
        borderBottom: '1px solid var(--app-line)',
        background: inOverlay ? 'var(--app-void)' : 'transparent',
        flex: 'none',
      }}
    >
      <div style={{ display: 'flex', gap: 'var(--sp-1)', overflowX: 'auto', flex: 1, minWidth: 0 }}>
        {rows.map((lane) => {
          const group = lane.group;
          if (!group) {
            const seat = lane.seats[0];
            return (
              <Tab
                key={seat.tab.id}
                seat={seat}
                on={seat.at === strip.at}
                searching={searching}
                onPick={() => land(pickTab(seat.at))}
                onShut={() => shut(seat.at)}
                onMenu={(e) => summon({ kind: 'tab', at: seat.at }, e)}
              />
            );
          }
          const tint = toneAt(tones, group.tone);
          return (
            <div
              key={group.id}
              /*
               * The run, drawn as one object.
               *
               * The wash and the rule under it are what make four tabs read as
               * four tabs *of something* rather than four that happen to be
               * next to each other — and they are the group's own colour, so
               * two groups on one strip are told apart before anything is
               * read. Both come from `lib/tint.ts` at a lightness measured
               * against the ground, which is why a group is legible on
               * Parchment and on Ink without being chosen twice.
               */
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 'var(--sp-1)',
                flex: 'none',
                maxWidth: '100%',
                padding: '0 var(--sp-1)',
                borderRadius: 'var(--r-lg) var(--r-lg) 0 0',
                background: tint.wash,
                borderBottom: `2px solid ${tint.fill}`,
              }}
            >
              <GroupHead
                group={group}
                held={lane.seats.length}
                tint={tint}
                onToggle={() => {
                  const landed = foldGroup(group.id, !group.collapsed);
                  // Only when it moved you: see `foldGroup`. Opening a group
                  // you were never inside leaves you exactly where you were.
                  if (landed) land(landed);
                }}
                onMenu={(e) => summon({ kind: 'group', id: group.id }, e)}
              />
              {/* Folded, the run is its head and nothing else — which is the
                  room a strip at ten tabs gets back for it. */}
              {!group.collapsed &&
                lane.seats.map((seat) => (
                  <Tab
                    key={seat.tab.id}
                    seat={seat}
                    on={seat.at === strip.at}
                    searching={searching}
                    onPick={() => land(pickTab(seat.at))}
                    onShut={() => shut(seat.at)}
                    onMenu={(e) => summon({ kind: 'tab', at: seat.at }, e)}
                  />
                ))}
            </div>
          );
        })}
        <button
          type="button"
          className="bare tappable"
          onClick={() => {
            // Only when one was actually opened. At the cap `openTab` refuses,
            // and going to the search page anyway would answer "no room for
            // another tab" by throwing away the page in the tab you are on.
            if (openTab()) blank();
          }}
          disabled={full}
          aria-label="New tab"
          title={full ? `Close a tab before opening another (${MAX_TABS} open)` : 'New tab'}
          style={{
            width: 'auto',
            flex: 'none',
            padding: 'var(--sp-3) var(--sp-4)',
            borderRadius: 'var(--r-sm)',
            ...secondLine(),
          }}
        >
          <Plus size={15} />
        </button>
      </div>
      {onDismiss && (
        <button
          type="button"
          className="bare"
          onClick={onDismiss}
          /*
           * A gutter, and a rule, because the row beside this one scrolls.
           *
           * The tabs sit in a `overflow-x: auto` box whose right edge was two
           * pixels from this word. A row that has overflowed is cut wherever
           * it is cut — mid-name, mid-letter — so on a phone with four tabs
           * open the strip read "…Practice pap CLOSE", one string, and the
           * cut looked like the app had broken rather than like a row that
           * scrolls. The gutter separates them and the hairline says which
           * side of it a thing belongs to: everything left of the line is a
           * place you can go, and this is not.
           */
          style={{
            width: 'auto',
            flex: 'none',
            marginLeft: 'var(--sp-4)',
            paddingLeft: 'var(--sp-5)',
            paddingRight: 'var(--sp-2)',
            paddingTop: 'var(--sp-4)',
            paddingBottom: 'var(--sp-4)',
            borderLeft: '1px solid var(--app-line)',
            fontSize: 'var(--type-xs)',
            letterSpacing: '0.12em',
            ...secondLine(),
          }}
        >
          CLOSE
        </button>
      )}
      {menu && (
        <StripMenu
          on={menu.on}
          corner={menu.corner}
          onClose={() => setMenu(null)}
          onLand={land}
          onCloseTab={shut}
          onNewTab={blank}
        />
      )}
    </div>
  );
}

/**
 * One tab: its glyph, its name, its cross, and the ⌄ when it is the one on.
 *
 * The chevron is drawn on the current tab only. It is the touchable way into
 * the menu that right-click is for everybody else, and a chevron on every tab
 * would cost the strip exactly the room the names need — nine of them is an
 * inch of chrome to save one click on a tab you are not looking at.
 */
function Tab({
  seat,
  on,
  searching,
  onPick,
  onShut,
  onMenu,
}: {
  seat: Seat;
  on: boolean;
  searching: string;
  onPick: () => void;
  onShut: () => void;
  onMenu: (e: ReactMouseEvent) => void;
}) {
  const { tab } = seat;
  /*
   * A tab in the middle of a search is named after the search, which is what
   * the tab in a browser does and is the only thing that tells two new tabs
   * apart. Not written into the strip: the query is this session's, and a tab
   * reopened tomorrow is a new tab again rather than one carrying a question
   * nobody asked twice.
   */
  const title = (on && searching.trim() ? searching : tab.title) || NEW_TAB;

  return (
    <div
      onContextMenu={onMenu}
      style={{
        display: 'flex',
        alignItems: 'center',
        flex: 'none',
        maxWidth: 190,
        borderRadius: 'var(--r-lg) var(--r-lg) 0 0',
        background: on ? 'var(--app-panel)' : 'transparent',
        border: `1px solid ${on ? 'var(--app-line)' : 'transparent'}`,
        borderBottom: 'none',
      }}
    >
      <button
        type="button"
        className="bare tappable"
        onClick={onPick}
        aria-current={on ? 'page' : undefined}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 'var(--sp-3)',
          minWidth: 0,
          width: 'auto',
          textAlign: 'left',
          padding: 'var(--sp-3) var(--sp-2) var(--sp-3) var(--sp-4)',
          fontSize: 'var(--type-sm)',
          ...(on ? {} : secondLine()),
        }}
      >
        {tab.screen ? <TabGlyph screen={tab.screen} size={15} /> : <SearchIcon size={15} />}
        <span
          style={{
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {title}
        </span>
      </button>
      {on && (
        <button
          type="button"
          className="bare tappable"
          onClick={onMenu}
          aria-label={`What this tab can do — ${title}`}
          aria-haspopup="dialog"
          style={{
            width: 'auto',
            flex: 'none',
            padding: 'var(--sp-3) var(--sp-1)',
            fontSize: 'var(--type-sm)',
          }}
        >
          <ChevronDown size={13} />
        </button>
      )}
      <button
        type="button"
        className="bare tappable"
        onClick={onShut}
        aria-label={`Close ${title}`}
        style={{
          width: 'auto',
          flex: 'none',
          padding: 'var(--sp-3) var(--sp-4) var(--sp-3) var(--sp-1)',
          fontSize: 'var(--type-sm)',
          ...secondLine(),
        }}
      >
        ✕
      </button>
    </div>
  );
}

/**
 * The head of a group: a dot, its name, and how many are folded behind it.
 *
 * Clicking it folds and unfolds, which is the gesture every browser uses and
 * the only one worth a whole click on a strip this size. Everything else the
 * group can do — its name, its colour, ungrouping, closing the lot — is one
 * right-click away, and the head carries `aria-haspopup` so the keyboard has
 * the same route in.
 *
 * An unnamed group is its dot and its count. That is a real state rather than
 * a missing one: three tabs grouped in one gesture and named never is how most
 * groups start, and the colour alone reads a strip.
 */
function GroupHead({
  group,
  held,
  tint,
  onToggle,
  onMenu,
}: {
  group: TabGroup;
  held: number;
  tint: CourseTint;
  onToggle: () => void;
  onMenu: (e: ReactMouseEvent) => void;
}) {
  const says = group.name || 'Unnamed group';
  const count = held === 1 ? '1 tab' : `${held} tabs`;
  return (
    <button
      type="button"
      className="bare tappable"
      onClick={onToggle}
      onContextMenu={onMenu}
      // Not `aria-expanded` alone: what folds is the run of tabs beside this,
      // which is not a region this button owns. The label says the state in
      // words, which is the honest version of the same information.
      aria-label={`${says} — ${count}, ${group.collapsed ? 'open' : 'fold away'}`}
      aria-haspopup="dialog"
      title={`${says} — ${count}`}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 'var(--sp-3)',
        width: 'auto',
        flex: 'none',
        maxWidth: 160,
        padding: 'var(--sp-3) var(--sp-4)',
        borderRadius: 'var(--r-sm)',
        fontSize: 'var(--type-sm)',
        color: tint.ink,
      }}
    >
      <span
        aria-hidden="true"
        style={{
          flex: 'none',
          width: 'var(--sp-4)',
          height: 'var(--sp-4)',
          borderRadius: '50%',
          background: tint.fill,
        }}
      />
      {group.name && (
        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {group.name}
        </span>
      )}
      {/* The count only while it is folded: open, the tabs are right there
          and a number beside them is one more thing to read past. */}
      {group.collapsed && <span aria-hidden="true">{held}</span>}
    </button>
  );
}
